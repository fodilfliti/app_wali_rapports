const { Op } = require("sequelize");
const {
  Service,
  RapportType,
  Rapport,
  RapportVersion,
  Municipality,
  RapportTableSchema,
} = require("../../db");
const rapportService = require("./rapportService");
const hubCountsService = require("./hubCountsService");
const {
  assertServiceAccess,
  assertRapportAccess,
  resolveAccessLevel,
} = require("./serviceAccessService");
const {
  loadSchemaBySlug,
  buildDefaultTableRows,
  normalizeTablePayload,
  recalcTableRows,
} = require("./tableGridService");
const {
  buildDefaultTableMeta,
  extractTableMeta,
  normalizeMergedRows,
} = require("./tableLayoutService");
const {
  getBaselineCommunes,
  summarizeMunicipality,
} = require("./communeCompareService");
const { enrichDataJsonWithFiles } = require("../../services/uploadService");
const calendarEventService = require("./calendarEventService");
const rapportViewService = require("./rapportViewService");
const schemaConfigService = require("./schemaConfigService");

const { buildCommuneDocumentDefaultBlocks } = require("./documentDefaults");

const DOCUMENT_KINDS = new Set(["document_compose", "fiche_lecture"]);

/**
 * Collect entity codes referenced by this rapport (inclusion + stored content).
 * Used so soft-hidden refs still appear on existing rapports.
 */
function referencedCodesByKind(dataJson, includedEntityKeys) {
  const {
    parseEntityKey,
    getEntitiesMap,
  } = require("./entityKeys");
  const out = { commune: new Set(), daira: new Set(), direction: new Set() };
  const entities = getEntitiesMap(dataJson || {});
  for (const key of Object.keys(entities)) {
    const parsed = parseEntityKey(key);
    if (parsed && out[parsed.kind]) out[parsed.kind].add(parsed.code);
  }
  const communes =
    dataJson?.communes && typeof dataJson.communes === "object"
      ? dataJson.communes
      : {};
  for (const code of Object.keys(communes)) {
    out.commune.add(String(code));
  }
  if (Array.isArray(includedEntityKeys)) {
    for (const key of includedEntityKeys) {
      const parsed = parseEntityKey(key);
      if (parsed && out[parsed.kind]) out[parsed.kind].add(parsed.code);
    }
  }
  return out;
}

function orgRefWhere(referencedCodes) {
  const codes = [...(referencedCodes || [])].filter(Boolean);
  if (!codes.length) return { hidden_at: null };
  return {
    [Op.or]: [{ hidden_at: null }, { code: { [Op.in]: codes } }],
  };
}

async function loadOrgRefsForWorkspace(targetKinds, dataJson, includedEntityKeys) {
  const { Daira, Direction } = require("../../db");
  const refs = referencedCodesByKind(dataJson, includedEntityKeys);
  const [municipalities, dairas, directions] = await Promise.all([
    targetKinds.includes("commune")
      ? Municipality.findAll({
          where: orgRefWhere(refs.commune),
          order: [["code", "ASC"]],
        })
      : Promise.resolve([]),
    targetKinds.includes("daira")
      ? Daira.findAll({
          where: orgRefWhere(refs.daira),
          order: [["code", "ASC"]],
        })
      : Promise.resolve([]),
    targetKinds.includes("direction")
      ? Direction.findAll({
          where: orgRefWhere(refs.direction),
          order: [["code", "ASC"]],
        })
      : Promise.resolve([]),
  ]);
  return { municipalities, dairas, directions };
}

function isOrgRowActive(row) {
  return row && row.hidden_at == null;
}

function normalizeMediaRows(rows) {
  const ids = [];
  for (const row of rows || []) {
    for (const it of row.items || []) {
      const id = Number(it.file_id);
      if (id) ids.push(id);
    }
  }
  if (!ids.length) return [];
  return [{ items: ids.map((file_id) => ({ file_id })) }];
}

async function attachMediaAndCalendar(view, rapportId, actor) {
  const dj = view.rapport?.currentVersion?.data_json || {};
  const enrichPayload =
    view.rows != null
      ? {
          tables: [{ media_rows: view.media_rows || [], rows: view.rows || [] }],
        }
      : {
          blocks: view.blocks ?? dj.blocks ?? [],
          media_rows: view.media_rows ?? dj.media_rows ?? [],
          rich_html_ar: dj.rich_html_ar,
          rich_html_fr: dj.rich_html_fr,
          embedded_tables: dj.embedded_tables,
        };
  const { files } = await enrichDataJsonWithFiles(enrichPayload, rapportId);
  let calendarEvents = [];
  if (actor) {
    calendarEvents = await calendarEventService.listForRapport(
      rapportId,
      actor,
    );
  }
  return { ...view, files, calendarEvents };
}

async function findFallbackServiceSchema(serviceId) {
  if (!serviceId) return null;
  const local = await RapportTableSchema.findOne({
    where: { service_id: serviceId },
    order: [["id", "ASC"]],
  });
  if (local) return local;
  return RapportTableSchema.findOne({
    where: { service_id: null },
    order: [["id", "ASC"]],
  });
}

function typeNeedsTableSchema(rapportType) {
  if (rapportType?.content_kind === "table_grid") return true;
  return (
    rapportType?.content_kind === "commune_list" &&
    rapportType?.commune_content_kind === "table"
  );
}

async function resolveTableSchemaOptional(rapportType, serviceId = null) {
  if (
    rapportType?.content_kind === "commune_list" &&
    rapportType?.commune_content_kind !== "table"
  ) {
    return null;
  }

  const slug = rapportType?.schema_json?.table_schema_slug;
  if (slug) {
    try {
      return await loadSchemaBySlug(slug);
    } catch (e) {
      if (e.status !== 404) throw e;
    }
  }

  return findFallbackServiceSchema(serviceId);
}

async function resolveTableSchema(rapportType, serviceId = null) {
  const schema = await resolveTableSchemaOptional(rapportType, serviceId);
  if (!schema && typeNeedsTableSchema(rapportType)) {
    const err = new Error("tableSchemaNotConfigured");
    err.status = 400;
    throw err;
  }
  return schema;
}

function groupContentKinds(rapportTypes = []) {
  const groups = {
    table_grid: [],
    document_compose: [],
    fiche_lecture: [],
    commune_list: [],
  };
  for (const t of rapportTypes) {
    if (groups[t.content_kind]) groups[t.content_kind].push(t);
  }
  return groups;
}

const CONTENT_KIND_ORDER = [
  "fiche_lecture",
  "document_compose",
  "table_grid",
  "commune_list",
];

function enrichContentKinds(groups, typeById) {
  const out = {};
  for (const [kind, types] of Object.entries(groups)) {
    const enriched = (types || [])
      .map(
        (t) =>
          typeById[Number(t.id)] || {
            ...(t.toJSON ? t.toJSON() : t),
            action_count: 0,
          },
      )
      .filter((t) => t?.id);
    if (enriched.length) out[kind] = enriched;
  }
  return out;
}

function buildContentKindSummaries(contentKinds) {
  return CONTENT_KIND_ORDER.filter((kind) => contentKinds[kind]?.length).map(
    (kind) => {
      const types = contentKinds[kind];
      return {
        content_kind: kind,
        type_count: types.length,
        action_count: types.reduce(
          (sum, t) => sum + Number(t.action_count || 0),
          0,
        ),
      };
    },
  );
}

async function getServiceContentHub(serviceId, user, options = {}) {
  let accessLevel = "view";
  if (options.waliForOfficeUserId) {
    if (!["WALI", "CHEF_CABINET", "ADMIN"].includes(user?.role)) {
      const err = new Error("Forbidden");
      err.status = 403;
      throw err;
    }
    accessLevel = await resolveAccessLevel(
      { id: Number(options.waliForOfficeUserId), role: "OFFICE_USER" },
      serviceId,
    );
    if (accessLevel === "none") {
      const err = new Error("Forbidden");
      err.status = 403;
      throw err;
    }
  } else {
    accessLevel = await assertServiceAccess(user, serviceId, "view");
  }
  const service = await Service.findByPk(serviceId, {
    include: [{ model: RapportType, as: "rapportTypes" }],
  });
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (service.is_folder) {
    const err = new Error("serviceIsFolder");
    err.status = 400;
    throw err;
  }

  let byType = {};
  if (options.waliForOfficeUserId) {
    const forChef =
      options.forChef === true || user?.role === "CHEF_CABINET";
    const counts = forChef
      ? await hubCountsService.getChefServicePendingCounts(
          Number(options.waliForOfficeUserId),
        )
      : await hubCountsService.getWaliServicePendingCounts(
          Number(options.waliForOfficeUserId),
        );
    byType = counts.byType;
  } else {
    const counts = await hubCountsService.getOfficeServiceActionCounts(user.id);
    byType = counts.byType;
  }

  const sid = Number(serviceId);
  const isWaliView = Boolean(options.waliForOfficeUserId);
  const includeHiddenTypes = Boolean(options.includeHiddenTypes);
  const hiddenTypesOnly = Boolean(options.hiddenTypesOnly);

  let visibleTypes = service.rapportTypes || [];
  if (isWaliView) {
    // Wali/Chef: never show soft-hidden types (no office action-badge exception)
    visibleTypes = visibleTypes.filter((t) => !t.hidden_at);
  } else if (hiddenTypesOnly) {
    visibleTypes = visibleTypes.filter((t) => t.hidden_at);
  } else if (!includeHiddenTypes) {
    // Keep soft-hidden types that still need action so badges remain clickable
    visibleTypes = visibleTypes.filter(
      (t) =>
        !t.hidden_at ||
        Number(byType[`${sid}:${Number(t.id)}`]) > 0,
    );
  }

  const rapportTypes = visibleTypes.map((t) => ({
    id: t.id,
    slug: t.slug,
    name_ar: t.name_ar,
    name_fr: t.name_fr,
    content_kind: t.content_kind,
    commune_content_kind: t.commune_content_kind || null,
    versioning_mode: t.versioning_mode,
    hidden_at: t.hidden_at,
    action_count: Number(byType[`${sid}:${Number(t.id)}`]) || 0,
  }));
  const usedTypeIds = await schemaConfigService.rapportTypeIdsWithRapports(
    rapportTypes.map((t) => Number(t.id)),
  );
  for (const t of rapportTypes) {
    t.can_delete =
      t.content_kind !== "fiche_lecture" && !usedTypeIds.has(Number(t.id));
  }
  const typeById = Object.fromEntries(
    rapportTypes.map((t) => [Number(t.id), t]),
  );
  const rawKinds = groupContentKinds(visibleTypes);
  const contentKinds = enrichContentKinds(rawKinds, typeById);
  const contentKindSummaries = buildContentKindSummaries(contentKinds);

  return {
    service: {
      id: service.id,
      slug: service.slug,
      name_ar: service.name_ar,
      name_fr: service.name_fr,
    },
    rapportTypes,
    contentKinds,
    contentKindSummaries,
    accessLevel,
  };
}

async function getServiceWorkspace(
  serviceId,
  actor,
  req,
  rapportTypeId = null,
  rapportId = null,
) {
  const accessLevel = await assertServiceAccess(actor, serviceId, "view");
  const service = await Service.findByPk(serviceId, {
    include: [{ model: RapportType, as: "rapportTypes" }],
  });
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  let rapportType;
  let rapport;

  if (rapportId) {
    await assertRapportAccess(actor, rapportId, "view");
    rapport = await rapportService.getRapportDetail(rapportId);
    if (Number(rapport.service_id) !== Number(serviceId)) {
      const err = new Error("Not found");
      err.status = 404;
      throw err;
    }
    rapportType = rapport.rapportType;
    if (!rapportType || rapportType.content_kind !== "table_grid") {
      const err = new Error("Not a table rapport");
      err.status = 400;
      throw err;
    }
    if (rapportTypeId && Number(rapportType.id) !== Number(rapportTypeId)) {
      const err = new Error("Rapport type mismatch");
      err.status = 400;
      throw err;
    }
  } else {
    if (rapportTypeId) {
      rapportType = service.rapportTypes?.find(
        (t) =>
          Number(t.id) === Number(rapportTypeId) &&
          t.content_kind === "table_grid",
      );
    } else {
      rapportType = service.rapportTypes?.find(
        (t) => t.content_kind === "table_grid",
      );
    }
    if (!rapportType) {
      const err = new Error("Not a table service");
      err.status = 400;
      throw err;
    }

    const meta = rapportType.schema_json || {};
    const schema = await resolveTableSchema(rapportType, serviceId);
    const columns = schema.columns_json || [];
    const layoutJson = schema.layout_json || {};
    const tableMeta = buildDefaultTableMeta(layoutJson, columns);

    rapport = await Rapport.findOne({
      where: {
        service_id: service.id,
        rapport_type_id: rapportType.id,
        status: { [Op.in]: ["draft", "changes_requested"] },
        hidden_at: null,
      },
      order: [["updated_at", "DESC"]],
    });

    if (!rapport) {
      rapport = await Rapport.findOne({
        where: {
          service_id: service.id,
          rapport_type_id: rapportType.id,
          hidden_at: null,
        },
        order: [["updated_at", "DESC"]],
      });
    }

    if (!rapport) {
      const defaultRows =
        accessLevel === "manage" ? await buildDefaultTableRows(columns) : [];
      return {
        service: {
          id: service.id,
          slug: service.slug,
          name_ar: service.name_ar,
          name_fr: service.name_fr,
        },
        rapportType: {
          id: rapportType.id,
          name_ar: rapportType.name_ar,
          name_fr: rapportType.name_fr,
          content_kind: rapportType.content_kind,
          versioning_mode: rapportType.versioning_mode,
        },
        schema: {
          slug: schema.slug,
          name_ar: schema.name_ar,
          name_fr: schema.name_fr,
          columns,
          layout_json: layoutJson,
        },
        rapport: null,
        tableData: {
          tables: [
            {
              key: meta.table_key || "main",
              ...tableMeta,
              rows: defaultRows,
            },
          ],
        },
        versions: [],
        editable: accessLevel === "manage",
        accessLevel,
        suggestedTitle: `${service.name_ar} — ${new Date().toISOString().slice(0, 10)}`,
      };
    }

    rapport = await rapportService.getRapportDetail(rapport.id);
  }

  const schema = await resolveTableSchema(rapportType, serviceId);
  const columns = schema.columns_json || [];
  const layoutJson = schema.layout_json || {};

  const isEditable =
    accessLevel === "manage" &&
    ["draft", "changes_requested"].includes(rapport.status);

  const versions = await rapportService.listRapportVersions(rapport.id);
  const current =
    rapport.currentVersion ||
    rapport.versions?.find((v) => v.id === rapport.current_version_id);
  let tableData = normalizeTablePayload(
    current?.data_json || {},
    columns,
    layoutJson,
  );
  if (
    isEditable &&
    !(tableData?.tables?.[0]?.rows?.length) &&
    accessLevel === "manage"
  ) {
    const meta = rapportType.schema_json || {};
    const tableMeta = buildDefaultTableMeta(layoutJson, columns);
    const defaultRows = await buildDefaultTableRows(columns);
    tableData = {
      tables: [
        {
          key: meta.table_key || "main",
          ...tableMeta,
          rows: defaultRows,
        },
      ],
    };
  }

  return {
    service: {
      id: service.id,
      slug: service.slug,
      name_ar: service.name_ar,
      name_fr: service.name_fr,
    },
    rapportType: {
      id: rapportType.id,
      name_ar: rapportType.name_ar,
      name_fr: rapportType.name_fr,
      content_kind: rapportType.content_kind,
      versioning_mode: rapportType.versioning_mode,
    },
    schema: {
      slug: schema.slug,
      name_ar: schema.name_ar,
      name_fr: schema.name_fr,
      columns,
      layout_json: layoutJson,
    },
    rapport,
    tableData,
    versions,
    editable: isEditable,
    accessLevel,
  };
}

async function getRapportView(
  rapportId,
  showHidden = false,
  actor = null,
  versionId = null,
) {
  // Spec: Wali opens → under_review. Only Wali (not Chef/Admin) advances status.
  // Do this before loading the view so the response status is already updated.
  if (actor?.role === "WALI") {
    await rapportService.markUnderReview(rapportId, actor);
  }

  const rapport = await rapportService.getRapportDetail(rapportId, versionId);
  const kind = rapport.rapportType?.content_kind;
  // Sub-views must not re-mark; Wali already handled above (Chef/Admin never mark).
  let view;
  if (kind === "table_grid")
    view = {
      content_kind: kind,
      ...(await getWaliTableView(rapportId, showHidden, false, versionId)),
    };
  else if (DOCUMENT_KINDS.has(kind))
    view = {
      content_kind: kind,
      ...(await getWaliDocumentView(rapportId, false, versionId)),
    };
  else if (kind === "commune_list")
    view = {
      content_kind: kind,
      ...(await getWaliCommuneView(rapportId, versionId, false)),
    };
  else view = { content_kind: kind || "unknown", rapport };

  if (actor) await rapportViewService.recordView(rapportId, actor);
  return attachMediaAndCalendar(view, rapportId, actor);
}

async function saveTableData(rapportId, payload, actor, req) {
  await assertRapportAccess(actor, rapportId, "manage");
  const rapport = await rapportService.getRapportDetail(rapportId);
  if (!["draft", "changes_requested"].includes(rapport.status)) {
    const err = new Error("Rapport not editable");
    err.status = 409;
    throw err;
  }

  const schema = await resolveTableSchema(rapport.rapportType, rapport.service_id);
  const columns = schema.columns_json || [];
  const layoutJson = schema.layout_json || {};
  const meta = rapport.rapportType?.schema_json || {};

  let rows = payload.rows || [];
  rows = rows.map((r) => ({
    ...r,
    _highlight: r._highlight || "none",
    _row_finished: r._row_finished === true,
    _wali_visible: r._wali_visible !== false,
    _cell_colors:
      r._cell_colors && typeof r._cell_colors === "object"
        ? r._cell_colors
        : {},
  }));
  rows = recalcTableRows(rows, columns);
  const mergeKeys = payload.merge_column_keys || [];
  rows = normalizeMergedRows(rows, mergeKeys);

  const existingTable = rapport.currentVersion?.data_json?.tables?.[0] || {};
  const media_rows = normalizeMediaRows(
    payload.media_rows ?? existingTable.media_rows,
  );

  const data_json = {
    tables: [
      {
        key: payload.table_key || meta.table_key || "main",
        title_ar: payload.title_ar ?? "",
        title_fr: payload.title_fr ?? "",
        subtitle_ar: payload.subtitle_ar ?? "",
        subtitle_fr: payload.subtitle_fr ?? "",
        merge_column_keys: mergeKeys,
        rows,
        media_rows,
      },
    ],
  };

  return rapportService.updateRapportDraft(
    rapportId,
    { data_json },
    actor,
    req,
  );
}

async function getDocumentList(
  serviceId,
  contentKind = "document_compose",
  user,
  rapportTypeId = null,
  query = {},
) {
  const accessLevel = await assertServiceAccess(user, serviceId, "view");
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(query.pageSize, 10) || 20),
  );
  const service = await Service.findByPk(serviceId, {
    include: [{ model: RapportType, as: "rapportTypes" }],
  });
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  let docTypes;
  if (rapportTypeId) {
    const match = service.rapportTypes?.find(
      (t) => Number(t.id) === Number(rapportTypeId),
    );
    docTypes = match && DOCUMENT_KINDS.has(match.content_kind) ? [match] : [];
  } else {
    const kinds = contentKind === "all" ? [...DOCUMENT_KINDS] : [contentKind];
    docTypes = (service.rapportTypes || []).filter((t) =>
      kinds.includes(t.content_kind),
    );
  }
  const hiddenOnly =
    query.hidden_only === "1" || query.hidden_only === "true";
  const includeHidden =
    query.include_hidden === "1" || query.include_hidden === "true";
  if (!includeHidden && !hiddenOnly) {
    docTypes = docTypes.filter((t) => !t.hidden_at);
  }
  const typeIds = docTypes.map((t) => t.id);
  if (!typeIds.length) {
    return {
      service,
      contentKind,
      documentTypes: [],
      rapports: [],
      accessLevel,
      total: 0,
      page,
      pageSize,
    };
  }

  const rapportWhere = {
    service_id: serviceId,
    rapport_type_id: { [Op.in]: typeIds },
  };
  if (hiddenOnly) {
    rapportWhere.hidden_at = { [Op.ne]: null };
  } else if (!includeHidden) {
    rapportWhere.hidden_at = null;
  }

  const { rows, count } = await Rapport.findAndCountAll({
    where: rapportWhere,
    order: [["created_at", "DESC"]],
    offset: (page - 1) * pageSize,
    limit: pageSize,
    include: [
      { model: RapportType, as: "rapportType" },
      {
        model: RapportVersion,
        as: "currentVersion",
        attributes: ["id", "submitted_at"],
      },
    ],
  });

  return {
    service,
    contentKind,
    documentTypes: docTypes,
    rapports: rows,
    accessLevel,
    total: count,
    page,
    pageSize,
  };
}

async function createDocument(serviceId, rapportTypeId, actor, req, opts = {}) {
  await assertServiceAccess(actor, serviceId, "manage");
  const service = await Service.findByPk(serviceId, {
    include: [{ model: RapportType, as: "rapportTypes" }],
  });
  const rapportType = service?.rapportTypes?.find(
    (t) => Number(t.id) === Number(rapportTypeId),
  );
  if (!rapportType || !DOCUMENT_KINDS.has(rapportType.content_kind)) {
    const err = new Error("Invalid document type");
    err.status = 400;
    throw err;
  }

  const localeDate = new Date().toISOString().slice(0, 10);
  const title =
    opts.title?.trim() ||
    (rapportType.content_kind === "fiche_lecture"
      ? `${rapportType.name_ar} — ${localeDate}`
      : `${rapportType.name_ar} — ${localeDate}`);

  const documentTemplateService = require("./documentTemplateService");
  let dataJson;
  if (opts.data_json && typeof opts.data_json === "object") {
    dataJson = opts.data_json;
  } else if (opts.template_id) {
    dataJson = await documentTemplateService.resolveInitialDataJson(
      serviceId,
      rapportType,
      opts.template_id,
    );
  } else if (!opts.skip_default) {
    dataJson = await documentTemplateService.resolveInitialDataJson(
      serviceId,
      rapportType,
      null,
    );
  } else {
    const defaultBlocks = rapportType.schema_json?.default_blocks || [
      {
        type: "heading",
        align: "center",
        bold: true,
        text_ar: rapportType.name_ar,
        text_fr: rapportType.name_fr,
      },
      { type: "paragraph", text_ar: "", text_fr: "" },
    ];
    dataJson = { blocks: defaultBlocks };
  }

  return rapportService.createRapport(
    {
      service_id: serviceId,
      rapport_type_id: rapportType.id,
      title,
      reference_date: opts.reference_date || localeDate,
      data_json: dataJson,
    },
    actor,
    req,
  );
}

/** Resolve initial document content without creating a rapport row. */
async function previewDocumentCreate(
  serviceId,
  rapportTypeId,
  actor,
  opts = {},
) {
  await assertServiceAccess(actor, serviceId, "manage");
  const service = await Service.findByPk(serviceId, {
    include: [{ model: RapportType, as: "rapportTypes" }],
  });
  const rapportType = service?.rapportTypes?.find(
    (t) => Number(t.id) === Number(rapportTypeId),
  );
  if (!rapportType || !DOCUMENT_KINDS.has(rapportType.content_kind)) {
    const err = new Error("Invalid document type");
    err.status = 400;
    throw err;
  }

  const localeDate = new Date().toISOString().slice(0, 10);
  const suggestedTitle = `${rapportType.name_ar} — ${localeDate}`;
  const documentTemplateService = require("./documentTemplateService");
  let data_json;
  if (opts.skip_default) {
    data_json = { rich_html_ar: "<p></p>", rich_html_fr: "<p></p>" };
  } else {
    data_json = await documentTemplateService.resolveInitialDataJson(
      serviceId,
      rapportType,
      opts.template_id || null,
    );
  }

  return {
    service: {
      id: service.id,
      slug: service.slug,
      name_ar: service.name_ar,
      name_fr: service.name_fr,
    },
    rapportType: {
      id: rapportType.id,
      name_ar: rapportType.name_ar,
      name_fr: rapportType.name_fr,
      content_kind: rapportType.content_kind,
      versioning_mode: rapportType.versioning_mode,
    },
    suggestedTitle,
    data_json,
  };
}

async function saveDocumentBlocks(rapportId, payload, actor, req) {
  await assertRapportAccess(actor, rapportId, "manage");
  const rapport = await rapportService.getRapportDetail(rapportId);
  const data = { ...(rapport.currentVersion?.data_json || {}) };
  if (payload.blocks !== undefined) data.blocks = payload.blocks;
  if (payload.rich_html_ar !== undefined)
    data.rich_html_ar = payload.rich_html_ar;
  if (payload.rich_html_fr !== undefined)
    data.rich_html_fr = payload.rich_html_fr;
  if (payload.embedded_tables !== undefined)
    data.embedded_tables = payload.embedded_tables;
  if (payload.media_rows !== undefined)
    data.media_rows = normalizeMediaRows(payload.media_rows);
  return rapportService.updateRapportDraft(
    rapportId,
    { data_json: data },
    actor,
    req,
  );
}

async function getWaliTableView(
  rapportId,
  showHidden = false,
  markReview = true,
  versionId = null,
) {
  const rapport = await rapportService.getRapportDetail(rapportId, versionId);
  if (markReview) await rapportService.markUnderReview(rapportId, null);

  const schema = await resolveTableSchema(rapport.rapportType, rapport.service_id);
  const columns = schema.columns_json || [];
  const layoutJson = schema.layout_json || {};
  const current = rapport.currentVersion;
  const tableData = normalizeTablePayload(
    current?.data_json || {},
    columns,
    layoutJson,
  );
  const table = tableData.tables[0];
  let rows = table.rows || [];
  if (!showHidden) rows = rows.filter((r) => r._wali_visible !== false);

  const versions = await rapportService.listRapportVersions(rapportId);
  return {
    rapport,
    schema: { columns, layout_json: layoutJson },
    tableMeta: {
      title_ar: table.title_ar,
      title_fr: table.title_fr,
      subtitle_ar: table.subtitle_ar,
      subtitle_fr: table.subtitle_fr,
      merge_column_keys: table.merge_column_keys || [],
    },
    rows,
    media_rows: table.media_rows || [],
    versions,
    waliResponses: rapport.waliResponses || [],
    chefResponses: rapport.chefResponses || [],
  };
}

async function getWaliDocumentView(
  rapportId,
  markReview = true,
  versionId = null,
) {
  const rapport = await rapportService.getRapportDetail(rapportId, versionId);
  if (markReview) await rapportService.markUnderReview(rapportId, null);
  const dj = rapport.currentVersion?.data_json || {};
  const blocks = dj.blocks || [];
  const versions = await rapportService.listRapportVersions(rapportId);
  return {
    rapport,
    blocks,
    media_rows: normalizeMediaRows(dj.media_rows),
    versions,
    waliResponses: rapport.waliResponses || [],
    chefResponses: rapport.chefResponses || [],
  };
}

function buildDefaultCommuneBlocks(municipality) {
  return buildCommuneDocumentDefaultBlocks(municipality);
}

function htmlHasContent(html) {
  if (!html || typeof html !== "string") return false;
  const stripped = html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return (
    stripped.length > 0 ||
    /<img\b/i.test(html) ||
    /<video\b/i.test(html) ||
    /<table\b/i.test(html)
  );
}

function buildDefaultCommuneRows(columns, municipality) {
  const row = {
    municipality_code: municipality?.code,
    _municipality_name_ar: municipality?.name_ar,
    _municipality_name_fr: municipality?.name_fr,
    _highlight: "none",
    _row_finished: false,
    _wali_visible: true,
    _cell_colors: {},
  };
  for (const col of columns) {
    if (col.type === "commune_ref") row[col.key] = municipality?.code || "";
    else if (col.type === "number" || col.type === "formula")
      row[col.key] = null;
    else row[col.key] = "";
  }
  return [row];
}

async function getCommuneListWorkspace(
  serviceId,
  actor,
  req,
  rapportTypeId = null,
  rapportId = null,
) {
  const accessLevel = await assertServiceAccess(actor, serviceId, "view");
  const service = await Service.findByPk(serviceId, {
    include: [{ model: RapportType, as: "rapportTypes" }],
  });
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  let rapportType;
  let rapport;

  if (rapportId) {
    await assertRapportAccess(actor, rapportId, "view");
    rapport = await rapportService.getRapportDetail(rapportId);
    if (Number(rapport.service_id) !== Number(serviceId)) {
      const err = new Error("Not found");
      err.status = 404;
      throw err;
    }
    rapportType = rapport.rapportType;
    if (!rapportType || rapportType.content_kind !== "commune_list") {
      const err = new Error("Not a commune list rapport");
      err.status = 400;
      throw err;
    }
    if (rapportTypeId && Number(rapportType.id) !== Number(rapportTypeId)) {
      const err = new Error("Rapport type mismatch");
      err.status = 400;
      throw err;
    }
  } else {
    if (rapportTypeId) {
      rapportType = service.rapportTypes?.find(
        (t) =>
          Number(t.id) === Number(rapportTypeId) &&
          t.content_kind === "commune_list",
      );
    } else {
      rapportType = service.rapportTypes?.find(
        (t) => t.content_kind === "commune_list",
      );
    }
    if (!rapportType) {
      const err = new Error("Not a commune list service");
      err.status = 400;
      throw err;
    }

    rapport = await Rapport.findOne({
      where: {
        service_id: service.id,
        rapport_type_id: rapportType.id,
        status: { [Op.in]: ["draft", "changes_requested"] },
        hidden_at: null,
      },
      order: [["updated_at", "DESC"]],
    });

    if (!rapport) {
      rapport = await Rapport.findOne({
        where: {
          service_id: service.id,
          rapport_type_id: rapportType.id,
          hidden_at: null,
        },
        order: [["updated_at", "DESC"]],
      });
    }

    if (!rapport) {
      // No create on GET — first Enregistrer creates the draft.
    } else {
      rapport = await rapportService.getRapportDetail(rapport.id);
    }
  }

  const schema = await resolveTableSchemaOptional(rapportType, serviceId);
  const columns = schema?.columns_json || [];
  const {
    normalizeTargetKinds,
    entityKey,
    ensureEntitiesMap,
    getEntitiesMap,
    getIncludedEntityKeys,
    filterSummariesByInclusion,
  } = require("./entityKeys");
  const targetKinds = normalizeTargetKinds(
    rapportType.entity_target_kinds || ["commune"],
  );

  let dataJson = ensureEntitiesMap(rapport?.currentVersion?.data_json || {});
  let suggestedTitle = null;
  if (!rapport && accessLevel === "manage") {
    suggestedTitle = `${service.name_ar} — ${new Date().toISOString().slice(0, 10)}`;
    const prevFinished = await Rapport.findOne({
      where: {
        service_id: service.id,
        rapport_type_id: rapportType.id,
        hidden_at: { [Op.ne]: null },
      },
      order: [["updated_at", "DESC"]],
      include: [{ model: RapportVersion, as: "currentVersion" }],
    });
    const inherited = getIncludedEntityKeys(
      prevFinished?.currentVersion?.data_json || {},
    );
    if (inherited) {
      dataJson = { ...dataJson, included_entity_keys: inherited };
    }
  }

  const entitiesData = getEntitiesMap(dataJson);
  const communesData = dataJson.communes || {};
  const includedEntityKeys = getIncludedEntityKeys(dataJson);
  const { municipalities, dairas, directions } = await loadOrgRefsForWorkspace(
    targetKinds,
    dataJson,
    includedEntityKeys,
  );
  const baselineCommunes = getBaselineCommunes(rapport);

  function summarizeEntity(entry, baseline, cols) {
    return summarizeMunicipality(entry, baseline, cols);
  }

  const municipalitySummariesAll = municipalities.map((m) => {
    const key = entityKey("commune", m.code);
    return {
      kind: "commune",
      entity_key: key,
      code: m.code,
      name_ar: m.name_ar,
      name_fr: m.name_fr,
      daira_id: m.daira_id,
      ...summarizeEntity(
        entitiesData[key] || communesData[m.code],
        baselineCommunes[m.code] || baselineCommunes[key],
        columns,
      ),
    };
  });

  const dairaSummariesAll = dairas.map((d) => {
    const key = entityKey("daira", d.code);
    return {
      kind: "daira",
      entity_key: key,
      code: d.code,
      name_ar: d.name_ar,
      name_fr: d.name_fr,
      ...summarizeEntity(entitiesData[key], null, columns),
    };
  });

  const directionSummariesAll = directions.map((d) => {
    const key = entityKey("direction", d.code);
    return {
      kind: "direction",
      entity_key: key,
      code: d.code,
      name_ar: d.name_ar,
      name_fr: d.name_fr,
      ...summarizeEntity(entitiesData[key], null, columns),
    };
  });

  const municipalitySummaries = filterSummariesByInclusion(
    municipalitySummariesAll,
    includedEntityKeys,
  );
  const dairaSummaries = filterSummariesByInclusion(
    dairaSummariesAll,
    includedEntityKeys,
  );
  const directionSummaries = filterSummariesByInclusion(
    directionSummariesAll,
    includedEntityKeys,
  );

  const editable =
    accessLevel === "manage" &&
    (!rapport || ["draft", "changes_requested"].includes(rapport.status));

  function catalogItems(rows, kind) {
    return rows
      .filter(isOrgRowActive)
      .map((row) => ({
        entity_key: entityKey(kind, row.code),
        kind,
        code: row.code,
        name_ar: row.name_ar,
        name_fr: row.name_fr,
      }));
  }

  return {
    service: {
      id: service.id,
      slug: service.slug,
      name_ar: service.name_ar,
      name_fr: service.name_fr,
    },
    rapportType: {
      id: rapportType.id,
      name_ar: rapportType.name_ar,
      name_fr: rapportType.name_fr,
      content_kind: rapportType.content_kind,
      versioning_mode: rapportType.versioning_mode,
      commune_content_kind: rapportType.commune_content_kind,
      entity_target_kinds: targetKinds,
    },
    schema: schema
      ? {
          slug: schema.slug,
          name_ar: schema.name_ar,
          name_fr: schema.name_fr,
          columns,
          layout_json: schema.layout_json || {},
        }
      : null,
    rapport,
    municipalities: municipalitySummaries,
    dairas: dairaSummaries,
    directions: directionSummaries,
    entities: [...municipalitySummaries, ...dairaSummaries, ...directionSummaries],
    entitiesData,
    communesData,
    targetKinds,
    included_entity_keys: includedEntityKeys,
    selection_catalog: editable
      ? {
          municipalities: catalogItems(municipalities, "commune"),
          dairas: catalogItems(dairas, "daira"),
          directions: catalogItems(directions, "direction"),
        }
      : null,
    accessLevel,
    editable,
    suggestedTitle,
  };
}

async function getCommuneBulkWorkspace(
  serviceId,
  actor,
  req,
  rapportTypeId = null,
  rapportId = null,
) {
  const { entityKey, getEntitiesMap, ensureEntitiesMap } = require("./entityKeys");
  const ws = await getCommuneListWorkspace(
    serviceId,
    actor,
    req,
    rapportTypeId,
    rapportId,
  );

  if (!ws.schema) {
    if (!ws.rapport) return { ...ws, tableData: { tables: [{ key: "bulk", rows: [] }] } };
    const err = new Error("tableSchemaNotConfigured");
    err.status = 400;
    throw err;
  }

  const schema = ws.schema;
  const columns = schema.columns || [];
  const dataJson = ensureEntitiesMap({
    communes: ws.communesData || {},
    entities: ws.entitiesData || {},
    included_entity_keys: ws.included_entity_keys,
  });
  const entitiesData = getEntitiesMap(dataJson);
  const communesData = dataJson.communes || {};

  const entityLists = [
    ...(ws.municipalities || []),
    ...(ws.dairas || []),
    ...(ws.directions || []),
  ];

  const allRows = [];
  for (const ent of entityLists) {
    const kind = ent.kind || "commune";
    const key = ent.entity_key || entityKey(kind, ent.code);
    const entry =
      entitiesData[key] ||
      (kind === "commune" ? communesData[ent.code] || {} : {}) ||
      {};
    // Bulk starts empty: only emit rows that were already saved (user adds via UI).
    const rows = entry.rows || [];
    if (!rows.length) continue;
    for (const r of rows) {
      allRows.push({
        ...r,
        municipality_code: ent.code,
        _entity_key: key,
        _entity_kind: kind,
        _municipality_name_ar: ent.name_ar,
        _municipality_name_fr: ent.name_fr,
      });
    }
  }

  return {
    ...ws,
    tableData: {
      tables: [
        {
          key: "bulk",
          rows: recalcTableRows(allRows, columns),
          ...buildDefaultTableMeta(schema.layout_json || {}, columns),
        },
      ],
    },
  };
}

async function saveBulkCommuneData(rapportId, payload, actor, req) {
  const {
    parseEntityKey,
    entityKey,
    ensureEntitiesMap,
  } = require("./entityKeys");
  await assertRapportAccess(actor, rapportId, "manage");
  const rapport = await rapportService.getRapportDetail(rapportId);
  if (rapport.rapportType?.content_kind !== "commune_list") {
    const err = new Error("Not a commune list rapport");
    err.status = 400;
    throw err;
  }

  const table = payload.tables?.[0];
  const rows = table?.rows || [];

  const dataJson = ensureEntitiesMap(rapport.currentVersion?.data_json || {});
  const entities = { ...(dataJson.entities || {}) };
  const communes = { ...(dataJson.communes || {}) };

  // Group rows by entity key
  const byEntity = {};
  for (const r of rows) {
    let key = typeof r._entity_key === "string" ? r._entity_key : null;
    if (!key) {
      const code = r.municipality_code;
      if (!code) continue;
      // Legacy bulk rows without _entity_key are treated as communes
      key = entityKey("commune", code);
    }
    if (!byEntity[key]) byEntity[key] = [];
    byEntity[key].push(r);
  }

  for (const [key, entityRows] of Object.entries(byEntity)) {
    const parsed = parseEntityKey(key);
    if (!parsed) continue;
    const prev =
      entities[key] ||
      (parsed.kind === "commune" ? communes[parsed.code] || {} : {}) ||
      {};
    const cleaned = entityRows.map((r) => {
      const next = { ...r };
      delete next._entity_key;
      delete next._entity_kind;
      delete next._municipality_name_ar;
      delete next._municipality_name_fr;
      return next;
    });
    const nextEntry = { ...prev, rows: cleaned };
    entities[key] = nextEntry;
    if (parsed.kind === "commune") {
      communes[parsed.code] = nextEntry;
    }
  }

  // Explicit clears when user removed the last row for an entity in the bulk editor
  const clearedKeys = Array.isArray(payload.cleared_entity_keys)
    ? payload.cleared_entity_keys
    : [];
  for (const key of clearedKeys) {
    if (typeof key !== "string" || !key.trim()) continue;
    if (byEntity[key]) continue;
    const parsed = parseEntityKey(key.trim());
    if (!parsed) continue;
    const prev =
      entities[key] ||
      (parsed.kind === "commune" ? communes[parsed.code] || {} : {}) ||
      {};
    const nextEntry = { ...prev, rows: [] };
    entities[key] = nextEntry;
    if (parsed.kind === "commune") {
      communes[parsed.code] = nextEntry;
    }
  }

  await rapportService.updateRapportDraft(
    rapportId,
    {
      data_json: {
        ...dataJson,
        entities,
        communes,
      },
    },
    actor,
    req,
  );
  return rapportService.getRapportDetail(rapportId);
}

async function resolveEntityRef(entityKeyOrCode) {
  const { parseEntityKey, entityKey } = require("./entityKeys");
  const { Daira, Direction } = require("../../db");
  const parsed = parseEntityKey(entityKeyOrCode);
  if (!parsed) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const key = entityKey(parsed.kind, parsed.code);
  if (parsed.kind === "commune") {
    const municipality = await Municipality.findOne({ where: { code: parsed.code } });
    if (!municipality) {
      const err = new Error("Not found");
      err.status = 404;
      throw err;
    }
    return {
      kind: "commune",
      entity_key: key,
      code: municipality.code,
      name_ar: municipality.name_ar,
      name_fr: municipality.name_fr,
      municipality,
    };
  }
  if (parsed.kind === "daira") {
    const daira = await Daira.findOne({ where: { code: parsed.code } });
    if (!daira) {
      const err = new Error("Not found");
      err.status = 404;
      throw err;
    }
    return {
      kind: "daira",
      entity_key: key,
      code: daira.code,
      name_ar: daira.name_ar,
      name_fr: daira.name_fr,
      municipality: null,
    };
  }
  const direction = await Direction.findOne({ where: { code: parsed.code } });
  if (!direction) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return {
    kind: "direction",
    entity_key: key,
    code: direction.code,
    name_ar: direction.name_ar,
    name_fr: direction.name_fr,
    municipality: null,
  };
}

async function getCommuneRows(rapportId, municipalityCode, actor) {
  const { accessLevel } = await assertRapportAccess(actor, rapportId, "view");
  const rapport = await rapportService.getRapportDetail(rapportId);
  if (rapport.rapportType?.content_kind !== "commune_list") {
    const err = new Error("Not a commune list rapport");
    err.status = 400;
    throw err;
  }

  const schema =
    rapport.rapportType.commune_content_kind === "table"
      ? await resolveTableSchema(rapport.rapportType, rapport.service_id)
      : null;
  const columns = schema?.columns_json || [];
  const ref = await resolveEntityRef(municipalityCode);
  const { ensureEntitiesMap, isEntityIncluded } = require("./entityKeys");
  const dataJson = ensureEntitiesMap(rapport.currentVersion?.data_json || {});
  if (!isEntityIncluded(dataJson, ref.entity_key)) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const entities = dataJson.entities || {};
  const communes = dataJson.communes || {};
  const communeEntry =
    entities[ref.entity_key] ||
    (ref.kind === "commune" ? communes[ref.code] || {} : {}) ||
    {};

  const fakeMuni = {
    code: ref.code,
    name_ar: ref.name_ar,
    name_fr: ref.name_fr,
  };

  let blocks = communeEntry.blocks;
  if (!blocks?.length) blocks = buildDefaultCommuneBlocks(fakeMuni);

  const rich_html_ar = communeEntry.rich_html_ar || "";
  const rich_html_fr = communeEntry.rich_html_fr || "";
  const embedded_tables = communeEntry.embedded_tables || [];
  const calendar_events = communeEntry.calendar_events || [];
  const media_rows = normalizeMediaRows(communeEntry.media_rows);

  let rows = communeEntry.rows || [];
  if (rows.length) rows = recalcTableRows(rows, columns);
  else if (rapport.rapportType.commune_content_kind === "table")
    rows = buildDefaultCommuneRows(columns, fakeMuni);

  const editable =
    accessLevel === "manage" &&
    ["draft", "changes_requested"].includes(rapport.status);

  return {
    municipality: {
      code: ref.code,
      name_ar: ref.name_ar,
      name_fr: ref.name_fr,
      kind: ref.kind,
      entity_key: ref.entity_key,
    },
    municipality_code: ref.code,
    entity_key: ref.entity_key,
    entity_kind: ref.kind,
    blocks,
    rich_html_ar,
    rich_html_fr,
    embedded_tables,
    calendar_events,
    media_rows,
    rows,
    editable,
    rapport: {
      id: rapport.id,
      title: rapport.title,
      status: rapport.status,
      current_version_id: rapport.current_version_id
    },
    schema: schema
      ? {
          columns,
          layout_json: schema.layout_json || {},
        }
      : null,
  };
}

async function saveCommuneData(
  rapportId,
  municipalityCode,
  payload,
  actor,
  req,
) {
  await assertRapportAccess(actor, rapportId, "manage");
  const rapport = await rapportService.getRapportDetail(rapportId);
  if (rapport.rapportType?.content_kind !== "commune_list") {
    const err = new Error("Not a commune list rapport");
    err.status = 400;
    throw err;
  }
  const ref = await resolveEntityRef(municipalityCode);
  const { ensureEntitiesMap, isEntityIncluded } = require("./entityKeys");
  const dataJson = ensureEntitiesMap(rapport.currentVersion?.data_json || {});
  if (!isEntityIncluded(dataJson, ref.entity_key)) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const entities = { ...(dataJson.entities || {}) };
  const communes = { ...(dataJson.communes || {}) };
  const storageKey = ref.entity_key;
  const prev = entities[storageKey] || (ref.kind === "commune" ? communes[ref.code] : {}) || {};
  const next = { ...prev };

  if (payload.blocks !== undefined) next.blocks = payload.blocks;
  if (payload.rich_html_ar !== undefined)
    next.rich_html_ar = payload.rich_html_ar;
  if (payload.rich_html_fr !== undefined)
    next.rich_html_fr = payload.rich_html_fr;
  if (payload.embedded_tables !== undefined)
    next.embedded_tables = payload.embedded_tables;
  if (payload.calendar_events !== undefined)
    next.calendar_events = payload.calendar_events;
  if (payload.title_ar !== undefined) next.title_ar = payload.title_ar;
  if (payload.title_fr !== undefined) next.title_fr = payload.title_fr;
  if (payload.subtitle_ar !== undefined) next.subtitle_ar = payload.subtitle_ar;
  if (payload.subtitle_fr !== undefined) next.subtitle_fr = payload.subtitle_fr;
  if (payload.media_rows !== undefined)
    next.media_rows = normalizeMediaRows(payload.media_rows);

  if (payload.rows !== undefined) {
    let rows = payload.rows || [];
    if (rapport.rapportType?.commune_content_kind === "table") {
      const schema = await resolveTableSchema(
        rapport.rapportType,
        rapport.service_id,
      );
      const columns = schema.columns_json || [];
      rows = rows.map((r) => ({
        ...r,
        _highlight: r._highlight || "none",
        _row_finished: r._row_finished === true,
        _wali_visible: r._wali_visible !== false,
        _cell_colors:
          r._cell_colors && typeof r._cell_colors === "object"
            ? r._cell_colors
            : {},
      }));
      next.rows = recalcTableRows(rows, columns);
    } else {
      next.rows = rows;
    }
  }

  entities[storageKey] = next;
  if (ref.kind === "commune") {
    communes[ref.code] = next;
  }

  return rapportService.updateRapportDraft(
    rapportId,
    {
      data_json: {
        ...dataJson,
        entities,
        communes,
      },
    },
    actor,
    req,
  );
}

async function getWaliCommuneView(rapportId, versionId = null, markReview = true) {
  const {
    normalizeTargetKinds,
    entityKey,
    ensureEntitiesMap,
    getEntitiesMap,
    getIncludedEntityKeys,
    filterSummariesByInclusion,
  } = require("./entityKeys");
  const { Daira, Direction } = require("../../db");

  const rapport = await rapportService.getRapportDetail(rapportId, versionId);
  if (markReview) await rapportService.markUnderReview(rapportId, null);
  const schemaRow =
    rapport.rapportType?.commune_content_kind === "table"
      ? await resolveTableSchema(rapport.rapportType, rapport.service_id)
      : null;
  const currentVersion = rapport.currentVersion;
  const dataJson = ensureEntitiesMap(currentVersion?.data_json || {});
  const entitiesData = getEntitiesMap(dataJson);
  const communesLegacy =
    dataJson.communes && typeof dataJson.communes === "object"
      ? dataJson.communes
      : {};

  // Dual-read changed keys (new entity keys + legacy bare commune codes)
  const changedEntityKeys = Array.isArray(currentVersion?.changed_entity_keys)
    ? currentVersion.changed_entity_keys
    : [];
  const changedCodes = Array.isArray(currentVersion?.changed_commune_codes)
    ? currentVersion.changed_commune_codes
    : [];
  const changedSet = new Set([
    ...changedEntityKeys,
    ...changedCodes.map((c) =>
      typeof c === "string" && c.includes(":") ? c : entityKey("commune", String(c)),
    ),
    ...changedCodes.map((c) => String(c)),
  ]);

  const baselineCommunes = getBaselineCommunes(rapport);
  const schemaColumns = schemaRow?.columns_json || [];
  const targetKinds = normalizeTargetKinds(
    rapport.rapportType?.entity_target_kinds || ["commune"],
  );
  const includedEntityKeys = getIncludedEntityKeys(dataJson);

  const { municipalities, dairas, directions } = await loadOrgRefsForWorkspace(
    targetKinds,
    dataJson,
    includedEntityKeys,
  );

  function isChanged(key, bareCode) {
    if (changedSet.size) {
      return (
        changedSet.has(key) ||
        changedSet.has(bareCode) ||
        changedSet.has(String(bareCode))
      );
    }
    return summarizeMunicipality(
      entitiesData[key] || communesLegacy[bareCode],
      baselineCommunes[bareCode] || baselineCommunes[key],
      schemaColumns,
    ).is_changed;
  }

  const municipalitySummariesAll = municipalities.map((m) => {
    const key = entityKey("commune", m.code);
    return {
      kind: "commune",
      entity_key: key,
      code: m.code,
      name_ar: m.name_ar,
      name_fr: m.name_fr,
      is_changed: isChanged(key, m.code),
    };
  });
  const dairaSummariesAll = dairas.map((d) => {
    const key = entityKey("daira", d.code);
    return {
      kind: "daira",
      entity_key: key,
      code: d.code,
      name_ar: d.name_ar,
      name_fr: d.name_fr,
      is_changed: isChanged(key, d.code),
    };
  });
  const directionSummariesAll = directions.map((d) => {
    const key = entityKey("direction", d.code);
    return {
      kind: "direction",
      entity_key: key,
      code: d.code,
      name_ar: d.name_ar,
      name_fr: d.name_fr,
      is_changed: isChanged(key, d.code),
    };
  });

  const municipalitySummaries = filterSummariesByInclusion(
    municipalitySummariesAll,
    includedEntityKeys,
  );
  const dairaSummaries = filterSummariesByInclusion(
    dairaSummariesAll,
    includedEntityKeys,
  );
  const directionSummaries = filterSummariesByInclusion(
    directionSummariesAll,
    includedEntityKeys,
  );

  // Legacy communes map keyed by bare code (commune entries only) for older UI
  const communes = { ...communesLegacy };
  for (const [key, val] of Object.entries(entitiesData)) {
    if (key.startsWith("commune:")) {
      const code = key.slice("commune:".length);
      if (!(code in communes)) communes[code] = val;
    }
  }

  const versions = await rapportService.listRapportVersions(rapportId);
  return {
    rapport,
    schema: schemaRow
      ? {
          columns: schemaRow.columns_json || [],
          layout_json: schemaRow.layout_json || {},
        }
      : null,
    municipalities: municipalitySummaries,
    dairas: dairaSummaries,
    directions: directionSummaries,
    entities: [
      ...municipalitySummaries,
      ...dairaSummaries,
      ...directionSummaries,
    ],
    entitiesData,
    communes,
    versions,
    waliResponses: rapport.waliResponses || [],
    chefResponses: rapport.chefResponses || [],
  };
}

async function getRapportTableSnapshot(rapportId, actor) {
  await assertRapportAccess(actor, rapportId, "view");
  const rapport = await rapportService.getRapportDetail(rapportId);
  if (rapport.rapportType?.content_kind !== "table_grid") {
    const err = new Error("notTableRapport");
    err.status = 400;
    throw err;
  }
  const schema = await resolveTableSchema(rapport.rapportType, rapport.service_id);
  const columns = schema.columns_json || [];
  const layoutJson = schema.layout_json || {};
  const current =
    rapport.currentVersion ||
    rapport.versions?.find((v) => v.id === rapport.current_version_id);
  const tableData = normalizeTablePayload(
    current?.data_json || {},
    columns,
    layoutJson,
  );
  const table = tableData.tables?.[0] || {};
  return {
    rapport_id: rapport.id,
    rapport_title: rapport.title,
    schema_slug: schema.slug,
    schema_name_ar: schema.name_ar,
    schema_name_fr: schema.name_fr,
    columns,
    layout_json: layoutJson,
    table_meta: extractTableMeta(table, layoutJson),
    rows: (table.rows || []).map((row) => ({ ...row })),
  };
}

async function saveIncludedEntities(rapportId, keys, actor, req) {
  await assertRapportAccess(actor, rapportId, "manage");
  const rapport = await rapportService.getRapportDetail(rapportId);
  if (rapport.rapportType?.content_kind !== "commune_list") {
    const err = new Error("Not a commune list rapport");
    err.status = 400;
    throw err;
  }
  if (!["draft", "changes_requested"].includes(rapport.status)) {
    const err = new Error("Rapport not editable");
    err.status = 409;
    throw err;
  }

  const {
    normalizeTargetKinds,
    entityKey,
    parseEntityKey,
    ensureEntitiesMap,
    getEntitiesMap,
    getIncludedEntityKeys,
  } = require("./entityKeys");
  const { Daira, Direction } = require("../../db");
  const targetKinds = normalizeTargetKinds(
    rapport.rapportType.entity_target_kinds || ["commune"],
  );
  const dataJson = ensureEntitiesMap(rapport.currentVersion?.data_json || {});
  const entitiesMap = getEntitiesMap(dataJson);
  const prevIncluded = getIncludedEntityKeys(dataJson);

  let included_entity_keys = null;
  if (keys != null) {
    if (!Array.isArray(keys) || keys.length === 0) {
      const err = new Error("includedEntitiesRequired");
      err.status = 400;
      throw err;
    }
    const validated = [];
    for (const raw of keys) {
      const parsed = parseEntityKey(raw);
      if (!parsed || !targetKinds.includes(parsed.kind)) {
        const err = new Error("Invalid entity key");
        err.status = 400;
        throw err;
      }
      const key = entityKey(parsed.kind, parsed.code);
      let row = null;
      if (parsed.kind === "commune") {
        row = await Municipality.findOne({ where: { code: parsed.code } });
      } else if (parsed.kind === "daira") {
        row = await Daira.findOne({ where: { code: parsed.code } });
      } else {
        row = await Direction.findOne({ where: { code: parsed.code } });
      }
      if (!row) {
        const err = new Error("Not found");
        err.status = 404;
        throw err;
      }
      const alreadyAllowed =
        (prevIncluded && prevIncluded.includes(key)) ||
        entitiesMap[key] != null ||
        (parsed.kind === "commune" && dataJson.communes?.[parsed.code] != null);
      if (row.hidden_at && !alreadyAllowed) {
        const err = new Error("hiddenEntityNotSelectable");
        err.status = 400;
        throw err;
      }
      validated.push(key);
    }
    included_entity_keys = [...new Set(validated)];
  }

  const nextJson = { ...dataJson };
  if (included_entity_keys == null) {
    delete nextJson.included_entity_keys;
  } else {
    nextJson.included_entity_keys = included_entity_keys;
  }

  await rapportService.updateRapportDraft(
    rapportId,
    { data_json: nextJson },
    actor,
    req,
  );
  return rapportService.getRapportDetail(rapportId);
}

module.exports = {
  getServiceContentHub,
  getServiceWorkspace,
  getRapportTableSnapshot,
  saveTableData,
  getDocumentList,
  createDocument,
  previewDocumentCreate,
  saveDocumentBlocks,
  getWaliTableView,
  getWaliDocumentView,
  getWaliCommuneView,
  getCommuneListWorkspace,
  getCommuneBulkWorkspace,
  saveBulkCommuneData,
  getCommuneRows,
  saveCommuneData,
  saveIncludedEntities,
  getRapportView,
};
