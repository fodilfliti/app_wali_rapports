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

const { buildCommuneDocumentDefaultBlocks } = require("./documentDefaults");

const DOCUMENT_KINDS = new Set(["document_compose", "fiche_lecture"]);

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
    if (!["WALI", "ADMIN"].includes(user?.role)) {
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
    const counts = await hubCountsService.getWaliServicePendingCounts(
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
  if (!isWaliView) {
    if (hiddenTypesOnly) {
      visibleTypes = visibleTypes.filter((t) => t.hidden_at);
    } else if (!includeHiddenTypes) {
      visibleTypes = visibleTypes.filter((t) => !t.hidden_at);
    }
  }

  const rapportTypes = visibleTypes.map((t) => ({
    id: t.id,
    slug: t.slug,
    name_ar: t.name_ar,
    name_fr: t.name_fr,
    content_kind: t.content_kind,
    versioning_mode: t.versioning_mode,
    hidden_at: t.hidden_at,
    action_count: Number(byType[`${sid}:${Number(t.id)}`]) || 0,
  }));
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

    const statusEditable =
      rapport && ["draft", "changes_requested"].includes(rapport.status);

    if (!rapport) {
      if (accessLevel !== "manage") {
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
            tables: [{ key: meta.table_key || "main", ...tableMeta, rows: [] }],
          },
          versions: [],
          editable: false,
          accessLevel,
        };
      }
      const title = `${service.name_ar} — ${new Date().toISOString().slice(0, 10)}`;
      const rows = await buildDefaultTableRows(columns);
      const created = await rapportService.createRapport(
        {
          service_id: service.id,
          rapport_type_id: rapportType.id,
          title,
          data_json: {
            tables: [{ key: meta.table_key || "main", ...tableMeta, rows }],
          },
        },
        actor,
        req,
      );
      rapport = created;
    } else if (statusEditable && accessLevel === "manage") {
      const detail = await rapportService.getRapportDetail(rapport.id);
      const version = detail.currentVersion || detail.versions?.[0];
      const rows = version?.data_json?.tables?.[0]?.rows;
      if (
        !rows?.length &&
        ["draft", "changes_requested"].includes(detail.status)
      ) {
        const defaultRows = await buildDefaultTableRows(columns);
        await rapportService.updateRapportDraft(
          rapport.id,
          {
            data_json: {
              tables: [
                {
                  key: meta.table_key || "main",
                  ...tableMeta,
                  rows: defaultRows,
                },
              ],
            },
          },
          actor,
          req,
        );
      }
      rapport = await rapportService.getRapportDetail(rapport.id);
    } else {
      rapport = await rapportService.getRapportDetail(rapport.id);
    }
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
  const tableData = normalizeTablePayload(
    current?.data_json || {},
    columns,
    layoutJson,
  );

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
  const rapport = await rapportService.getRapportDetail(rapportId, versionId);
  const kind = rapport.rapportType?.content_kind;
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
      ...(await getWaliCommuneView(rapportId, versionId)),
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
    rapportType.content_kind === "fiche_lecture"
      ? `${rapportType.name_ar} — ${localeDate}`
      : `${rapportType.name_ar} — ${localeDate}`;

  const documentTemplateService = require("./documentTemplateService");
  let dataJson;
  if (opts.template_id) {
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
      reference_date: localeDate,
      data_json: dataJson,
    },
    actor,
    req,
  );
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

    if (!rapport && accessLevel === "manage") {
      const title = `${service.name_ar} — ${new Date().toISOString().slice(0, 10)}`;
      rapport = await rapportService.createRapport(
        {
          service_id: service.id,
          rapport_type_id: rapportType.id,
          title,
          data_json: { communes: {} },
        },
        actor,
        req,
      );
    } else if (rapport) {
      rapport = await rapportService.getRapportDetail(rapport.id);
    }
  }

  const schema = await resolveTableSchemaOptional(rapportType, serviceId);
  const columns = schema?.columns_json || [];
  const municipalities = await Municipality.findAll({
    order: [["code", "ASC"]],
  });

  const communesData = rapport?.currentVersion?.data_json?.communes || {};
  const baselineCommunes = getBaselineCommunes(rapport);
  const municipalitySummaries = municipalities.map((m) => ({
    code: m.code,
    name_ar: m.name_ar,
    name_fr: m.name_fr,
    ...summarizeMunicipality(
      communesData[m.code],
      baselineCommunes[m.code],
      columns,
    ),
  }));

  const editable =
    accessLevel === "manage" &&
    rapport &&
    ["draft", "changes_requested"].includes(rapport.status);

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
    communesData,
    accessLevel,
    editable,
  };
}

async function getCommuneBulkWorkspace(
  serviceId,
  actor,
  req,
  rapportTypeId = null,
  rapportId = null,
) {
  const ws = await getCommuneListWorkspace(
    serviceId,
    actor,
    req,
    rapportTypeId,
    rapportId,
  );
  const rapport = ws.rapport;
  if (!rapport) return ws;

  if (!ws.schema) {
    const err = new Error("tableSchemaNotConfigured");
    err.status = 400;
    throw err;
  }

  const schema = ws.schema;
  const columns = schema.columns || [];
  const communesData = ws.communesData || {};

  const allRows = [];
  for (const m of ws.municipalities) {
    const entry = communesData[m.code] || {};
    let rows = entry.rows || [];
    if (!rows.length) {
      rows = buildDefaultCommuneRows(columns, m);
    }
    for (const r of rows) {
      allRows.push({
        ...r,
        municipality_code: m.code,
        _municipality_name_ar: m.name_ar,
        _municipality_name_fr: m.name_fr,
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
  await assertRapportAccess(actor, rapportId, "manage");
  const rapport = await rapportService.getRapportDetail(rapportId);
  if (rapport.rapportType?.content_kind !== "commune_list") {
    const err = new Error("Not a commune list rapport");
    err.status = 400;
    throw err;
  }

  const table = payload.tables?.[0];
  const rows = table?.rows || [];

  const communes = { ...(rapport.currentVersion?.data_json?.communes || {}) };

  // Group rows by commune
  const byCommune = {};
  for (const r of rows) {
    const code = r.municipality_code;
    if (!code) continue;
    if (!byCommune[code]) byCommune[code] = [];
    byCommune[code].push(r);
  }

  // Update communes data
  // We keep existing non-row data (rich text, templates, etc.)
  for (const code of Object.keys(byCommune)) {
    if (!communes[code]) communes[code] = {};
    communes[code].rows = byCommune[code];
  }

  await rapportService.updateRapportDraft(
    rapportId,
    { data_json: { ...(rapport.currentVersion?.data_json || {}), communes } },
    actor,
    req,
  );
  return rapportService.getRapportDetail(rapportId);
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
  const municipality = await Municipality.findOne({
    where: { code: municipalityCode },
  });
  if (!municipality) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  const communes = rapport.currentVersion?.data_json?.communes || {};
  const communeEntry = communes[municipalityCode] || {};
  let blocks = communeEntry.blocks;
  if (!blocks?.length) blocks = buildDefaultCommuneBlocks(municipality);

  const rich_html_ar = communeEntry.rich_html_ar || "";
  const rich_html_fr = communeEntry.rich_html_fr || "";
  const embedded_tables = communeEntry.embedded_tables || [];
  const calendar_events = communeEntry.calendar_events || [];
  const media_rows = normalizeMediaRows(communeEntry.media_rows);

  let rows = communeEntry.rows || [];
  if (rows.length) rows = recalcTableRows(rows, columns);
  else if (rapport.rapportType.commune_content_kind === "table")
    rows = buildDefaultCommuneRows(columns, municipality);

  const editable =
    accessLevel === "manage" &&
    ["draft", "changes_requested"].includes(rapport.status);

  return {
    municipality: {
      code: municipality.code,
      name_ar: municipality.name_ar,
      name_fr: municipality.name_fr,
    },
    municipality_code: municipality.code,
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
  const communes = { ...(rapport.currentVersion?.data_json?.communes || {}) };
  const prev = communes[municipalityCode] || {};
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

  communes[municipalityCode] = next;

  return rapportService.updateRapportDraft(
    rapportId,
    {
      data_json: {
        ...(rapport.currentVersion?.data_json || {}),
        communes,
      },
    },
    actor,
    req,
  );
}

async function getWaliCommuneView(rapportId, versionId = null, markReview = true) {
  const rapport = await rapportService.getRapportDetail(rapportId, versionId);
  if (markReview) await rapportService.markUnderReview(rapportId, null);
  const schemaRow =
    rapport.rapportType?.commune_content_kind === "table"
      ? await resolveTableSchema(rapport.rapportType, rapport.service_id)
      : null;
  const currentVersion = rapport.currentVersion;
  const communes = currentVersion?.data_json?.communes || {};
  const changedCodes = currentVersion?.changed_commune_codes || [];
  const baselineCommunes = getBaselineCommunes(rapport);
  const schemaColumns = schemaRow?.columns_json || [];
  const municipalities = await Municipality.findAll({
    order: [["code", "ASC"]],
  });
  const municipalitySummaries = municipalities.map((m) => ({
    code: m.code,
    name_ar: m.name_ar,
    name_fr: m.name_fr,
    is_changed: changedCodes.length
      ? changedCodes.includes(m.code)
      : summarizeMunicipality(
          communes[m.code],
          baselineCommunes[m.code],
          schemaColumns,
        ).is_changed,
  }));
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
    communes,
    versions,
    waliResponses: rapport.waliResponses || [],
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

module.exports = {
  getServiceContentHub,
  getServiceWorkspace,
  getRapportTableSnapshot,
  saveTableData,
  getDocumentList,
  createDocument,
  saveDocumentBlocks,
  getWaliTableView,
  getWaliDocumentView,
  getWaliCommuneView,
  getCommuneListWorkspace,
  getCommuneBulkWorkspace,
  saveBulkCommuneData,
  getCommuneRows,
  saveCommuneData,
  getRapportView,
};
