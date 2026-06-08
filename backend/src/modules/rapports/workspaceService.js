const { Op } = require("sequelize");
const {
  Service,
  RapportType,
  Rapport,
  RapportVersion,
  Municipality
} = require("../../db");
const rapportService = require("./rapportService");
const { assertServiceAccess, assertRapportAccess, resolveAccessLevel } = require("./serviceAccessService");
const {
  loadSchemaBySlug,
  buildDefaultTableRows,
  normalizeTablePayload,
  recalcTableRows
} = require("./tableGridService");
const {
  buildDefaultTableMeta,
  extractTableMeta,
  normalizeMergedRows
} = require("./tableLayoutService");
const { enrichDataJsonWithFiles } = require("../../services/uploadService");
const calendarEventService = require("./calendarEventService");
const rapportViewService = require("./rapportViewService");

const DOCUMENT_KINDS = new Set(["document_compose", "fiche_lecture"]);

function normalizeMediaRows(rows) {
  return (rows || [])
    .map((row) => ({
      items: (row.items || [])
        .slice(0, 2)
        .map((it) => ({ file_id: Number(it.file_id) }))
        .filter((it) => it.file_id)
    }))
    .filter((row) => row.items.length);
}

async function attachMediaAndCalendar(view, rapportId, actor) {
  const { files } = await enrichDataJsonWithFiles(
    view.blocks != null
      ? { blocks: view.blocks }
      : { tables: [{ media_rows: view.media_rows || [], rows: view.rows || [] }] }
  );
  let calendarEvents = [];
  if (actor) {
    calendarEvents = await calendarEventService.listForRapport(rapportId, actor);
  }
  return { ...view, files, calendarEvents };
}

async function resolveTableSchema(rapportType) {
  const slug = rapportType?.schema_json?.table_schema_slug;
  if (!slug) {
    const err = new Error("tableSchemaNotConfigured");
    err.status = 400;
    throw err;
  }
  return loadSchemaBySlug(slug);
}

function groupContentKinds(rapportTypes = []) {
  const groups = {
    table_grid: [],
    document_compose: [],
    fiche_lecture: [],
    commune_list: []
  };
  for (const t of rapportTypes) {
    if (groups[t.content_kind]) groups[t.content_kind].push(t);
  }
  return groups;
}

async function getServiceContentHub(serviceId, user) {
  const accessLevel = await assertServiceAccess(user, serviceId, "view");
  const service = await Service.findByPk(serviceId, {
    include: [{ model: RapportType, as: "rapportTypes" }]
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
  const kinds = groupContentKinds(service.rapportTypes || []);
  return {
    service: {
      id: service.id,
      slug: service.slug,
      name_ar: service.name_ar,
      name_fr: service.name_fr
    },
    contentKinds: kinds,
    accessLevel
  };
}

async function getServiceWorkspace(serviceId, actor, req) {
  const accessLevel = await assertServiceAccess(actor, serviceId, "view");
  const service = await Service.findByPk(serviceId, {
    include: [{ model: RapportType, as: "rapportTypes" }]
  });
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  const rapportType = service.rapportTypes?.find((t) => t.content_kind === "table_grid");
  if (!rapportType) {
    const err = new Error("Not a table service");
    err.status = 400;
    throw err;
  }

  const meta = rapportType.schema_json || {};
  const schema = await resolveTableSchema(rapportType);
  const columns = schema.columns_json || [];
  const layoutJson = schema.layout_json || {};
  const tableMeta = buildDefaultTableMeta(layoutJson, columns);

  let rapport = await Rapport.findOne({
    where: {
      service_id: service.id,
      rapport_type_id: rapportType.id,
      status: { [Op.in]: ["draft", "changes_requested"] }
    },
    order: [["updated_at", "DESC"]]
  });

  if (!rapport) {
    rapport = await Rapport.findOne({
      where: { service_id: service.id, rapport_type_id: rapportType.id },
      order: [["updated_at", "DESC"]]
    });
  }

  const statusEditable = rapport && ["draft", "changes_requested"].includes(rapport.status);

  if (!rapport) {
    if (accessLevel !== "manage") {
      return {
        service: {
          id: service.id,
          slug: service.slug,
          name_ar: service.name_ar,
          name_fr: service.name_fr
        },
        rapportType: {
          id: rapportType.id,
          content_kind: rapportType.content_kind,
          versioning_mode: rapportType.versioning_mode
        },
        schema: {
          slug: schema.slug,
          name_ar: schema.name_ar,
          name_fr: schema.name_fr,
          columns,
          layout_json: layoutJson
        },
        rapport: null,
        tableData: {
          tables: [{ key: meta.table_key || "main", ...tableMeta, rows: [] }]
        },
        versions: [],
        editable: false,
        accessLevel
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
          tables: [{ key: meta.table_key || "main", ...tableMeta, rows }]
        }
      },
      actor,
      req
    );
    rapport = created;
  } else if (statusEditable && accessLevel === "manage") {
    const detail = await rapportService.getRapportDetail(rapport.id);
    const version = detail.currentVersion || detail.versions?.[0];
    const rows = version?.data_json?.tables?.[0]?.rows;
    if (!rows?.length && ["draft", "changes_requested"].includes(detail.status)) {
      const defaultRows = await buildDefaultTableRows(columns);
      await rapportService.updateRapportDraft(
        rapport.id,
        {
          data_json: {
            tables: [{ key: meta.table_key || "main", ...tableMeta, rows: defaultRows }]
          }
        },
        actor,
        req
      );
    }
    rapport = await rapportService.getRapportDetail(rapport.id);
  } else {
    rapport = await rapportService.getRapportDetail(rapport.id);
  }

  const isEditable =
    accessLevel === "manage" && ["draft", "changes_requested"].includes(rapport.status);

  const versions = await rapportService.listRapportVersions(rapport.id);
  const current = rapport.currentVersion || rapport.versions?.find((v) => v.id === rapport.current_version_id);
  const tableData = normalizeTablePayload(current?.data_json || {}, columns, layoutJson);

  return {
    service: {
      id: service.id,
      slug: service.slug,
      name_ar: service.name_ar,
      name_fr: service.name_fr
    },
    rapportType: {
      id: rapportType.id,
      content_kind: rapportType.content_kind,
      versioning_mode: rapportType.versioning_mode
    },
    schema: {
      slug: schema.slug,
      name_ar: schema.name_ar,
      name_fr: schema.name_fr,
      columns,
      layout_json: layoutJson
    },
    rapport,
    tableData,
    versions,
    editable: isEditable,
    accessLevel
  };
}

async function getRapportView(rapportId, showHidden = false, actor = null) {
  const rapport = await rapportService.getRapportDetail(rapportId);
  const kind = rapport.rapportType?.content_kind;
  let view;
  if (kind === "table_grid") view = { content_kind: kind, ...(await getWaliTableView(rapportId, showHidden, false)) };
  else if (DOCUMENT_KINDS.has(kind)) view = { content_kind: kind, ...(await getWaliDocumentView(rapportId, false)) };
  else if (kind === "commune_list") view = { content_kind: kind, ...(await getWaliCommuneView(rapportId)) };
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

  const schema = await resolveTableSchema(rapport.rapportType);
  const columns = schema.columns_json || [];
  const layoutJson = schema.layout_json || {};
  const meta = rapport.rapportType?.schema_json || {};

  let rows = payload.rows || [];
  rows = rows.map((r) => ({
    ...r,
    _highlight: r._highlight || "none",
    _wali_visible: r._wali_visible !== false
  }));
  rows = recalcTableRows(rows, columns);
  const mergeKeys = payload.merge_column_keys || [];
  rows = normalizeMergedRows(rows, mergeKeys);

  const existingTable = rapport.currentVersion?.data_json?.tables?.[0] || {};
  const media_rows = normalizeMediaRows(payload.media_rows ?? existingTable.media_rows);

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
        media_rows
      }
    ]
  };

  return rapportService.updateRapportDraft(rapportId, { data_json }, actor, req);
}

async function getDocumentList(serviceId, contentKind = "document_compose", user) {
  const accessLevel = await assertServiceAccess(user, serviceId, "view");
  const service = await Service.findByPk(serviceId, {
    include: [{ model: RapportType, as: "rapportTypes" }]
  });
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  const kinds = contentKind === "all" ? [...DOCUMENT_KINDS] : [contentKind];
  const docTypes = (service.rapportTypes || []).filter((t) => kinds.includes(t.content_kind));
  const typeIds = docTypes.map((t) => t.id);
  if (!typeIds.length) {
    return { service, contentKind, documentTypes: [], rapports: [], accessLevel };
  }

  const rapports = await Rapport.findAll({
    where: {
      service_id: serviceId,
      rapport_type_id: { [Op.in]: typeIds }
    },
    order: [["created_at", "DESC"]],
    limit: 100,
    include: [
      { model: RapportType, as: "rapportType" },
      { model: RapportVersion, as: "currentVersion", attributes: ["id", "submitted_at"] }
    ]
  });

  return { service, contentKind, documentTypes: docTypes, rapports, accessLevel };
}

async function createDocument(serviceId, rapportTypeId, actor, req) {
  await assertServiceAccess(actor, serviceId, "manage");
  const service = await Service.findByPk(serviceId, {
    include: [{ model: RapportType, as: "rapportTypes" }]
  });
  const rapportType = service?.rapportTypes?.find((t) => Number(t.id) === Number(rapportTypeId));
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
  const defaultBlocks = rapportType.schema_json?.default_blocks || [
    { type: "heading", align: "center", bold: true, text_ar: rapportType.name_ar, text_fr: rapportType.name_fr },
    { type: "paragraph", text_ar: "", text_fr: "" }
  ];

  return rapportService.createRapport(
    {
      service_id: serviceId,
      rapport_type_id: rapportType.id,
      title,
      reference_date: localeDate,
      data_json: { blocks: defaultBlocks }
    },
    actor,
    req
  );
}

async function saveDocumentBlocks(rapportId, blocks, actor, req) {
  await assertRapportAccess(actor, rapportId, "manage");
  return rapportService.updateRapportDraft(rapportId, { data_json: { blocks } }, actor, req);
}

async function getWaliTableView(rapportId, showHidden = false, markReview = true) {
  const rapport = await rapportService.getRapportDetail(rapportId);
  if (markReview) await rapportService.markUnderReview(rapportId, null);

  const schema = await resolveTableSchema(rapport.rapportType);
  const columns = schema.columns_json || [];
  const layoutJson = schema.layout_json || {};
  const current = rapport.currentVersion;
  const tableData = normalizeTablePayload(current?.data_json || {}, columns, layoutJson);
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
      merge_column_keys: table.merge_column_keys || []
    },
    rows,
    media_rows: table.media_rows || [],
    versions,
    waliResponses: rapport.waliResponses || []
  };
}

async function getWaliDocumentView(rapportId, markReview = true) {
  const rapport = await rapportService.getRapportDetail(rapportId);
  if (markReview) await rapportService.markUnderReview(rapportId, null);
  const blocks = rapport.currentVersion?.data_json?.blocks || [];
  const versions = await rapportService.listRapportVersions(rapportId);
  return { rapport, blocks, versions, waliResponses: rapport.waliResponses || [] };
}

function buildDefaultCommuneRows(columns, municipality) {
  const row = {
    municipality_code: municipality?.code,
    _municipality_name_ar: municipality?.name_ar,
    _municipality_name_fr: municipality?.name_fr,
    _highlight: "none",
    _wali_visible: true
  };
  for (const col of columns) {
    if (col.type === "commune_ref") row[col.key] = municipality?.code || "";
    else if (col.type === "number" || col.type === "formula") row[col.key] = null;
    else row[col.key] = "";
  }
  return [row];
}

async function getCommuneListWorkspace(serviceId, actor, req) {
  const accessLevel = await assertServiceAccess(actor, serviceId, "view");
  const service = await Service.findByPk(serviceId, {
    include: [{ model: RapportType, as: "rapportTypes" }]
  });
  if (!service) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  const rapportType = service.rapportTypes?.find((t) => t.content_kind === "commune_list");
  if (!rapportType) {
    const err = new Error("Not a commune list service");
    err.status = 400;
    throw err;
  }

  const schema = await resolveTableSchema(rapportType);
  const columns = schema.columns_json || [];
  const municipalities = await Municipality.findAll({ order: [["code", "ASC"]] });

  let rapport = await Rapport.findOne({
    where: {
      service_id: service.id,
      rapport_type_id: rapportType.id,
      status: { [Op.in]: ["draft", "changes_requested"] }
    },
    order: [["updated_at", "DESC"]]
  });

  if (!rapport && accessLevel === "manage") {
    const title = `${service.name_ar} — ${new Date().toISOString().slice(0, 10)}`;
    rapport = await rapportService.createRapport(
      {
        service_id: service.id,
        rapport_type_id: rapportType.id,
        title,
        data_json: { communes: {} }
      },
      actor,
      req
    );
  } else if (!rapport) {
    rapport = await Rapport.findOne({
      where: { service_id: service.id, rapport_type_id: rapportType.id },
      order: [["updated_at", "DESC"]]
    });
  } else {
    rapport = await rapportService.getRapportDetail(rapport.id);
  }

  const communesData = rapport?.currentVersion?.data_json?.communes || {};
  const municipalitySummaries = municipalities.map((m) => ({
    code: m.code,
    name_ar: m.name_ar,
    name_fr: m.name_fr,
    filled: Boolean(communesData[m.code]?.rows?.length)
  }));

  const editable =
    accessLevel === "manage" && rapport && ["draft", "changes_requested"].includes(rapport.status);

  return {
    service: {
      id: service.id,
      slug: service.slug,
      name_ar: service.name_ar,
      name_fr: service.name_fr
    },
    rapportType: { id: rapportType.id, versioning_mode: rapportType.versioning_mode },
    schema: { slug: schema.slug, name_ar: schema.name_ar, name_fr: schema.name_fr, columns },
    rapport,
    municipalities: municipalitySummaries,
    communesData,
    accessLevel,
    editable
  };
}

async function getCommuneRows(rapportId, municipalityCode, actor) {
  const { rapport, accessLevel } = await assertRapportAccess(actor, rapportId, "view");
  if (rapport.rapportType?.content_kind !== "commune_list") {
    const err = new Error("Not a commune list rapport");
    err.status = 400;
    throw err;
  }

  const schema = await resolveTableSchema(rapport.rapportType);
  const columns = schema.columns_json || [];
  const municipality = await Municipality.findOne({ where: { code: municipalityCode } });
  if (!municipality) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  const communes = rapport.currentVersion?.data_json?.communes || {};
  let rows = communes[municipalityCode]?.rows;
  if (!rows?.length) rows = buildDefaultCommuneRows(columns, municipality);
  else rows = recalcTableRows(rows, columns);

  return { municipality, rows, columns, accessLevel };
}

async function saveCommuneData(rapportId, municipalityCode, payload, actor, req) {
  await assertRapportAccess(actor, rapportId, "manage");
  const rapport = await rapportService.getRapportDetail(rapportId);
  const schema = await resolveTableSchema(rapport.rapportType);
  const columns = schema.columns_json || [];

  let rows = payload.rows || [];
  rows = rows.map((r) => ({
    ...r,
    _highlight: r._highlight || "none",
    _wali_visible: r._wali_visible !== false
  }));
  rows = recalcTableRows(rows, columns);

  const communes = { ...(rapport.currentVersion?.data_json?.communes || {}) };
  communes[municipalityCode] = { rows };

  return rapportService.updateRapportDraft(rapportId, { data_json: { communes } }, actor, req);
}

async function getWaliCommuneView(rapportId) {
  const rapport = await rapportService.getRapportDetail(rapportId);
  await rapportService.markUnderReview(rapportId, null);
  const schema = await resolveTableSchema(rapport.rapportType);
  const communes = rapport.currentVersion?.data_json?.communes || {};
  const municipalities = await Municipality.findAll({ order: [["code", "ASC"]] });
  const versions = await rapportService.listRapportVersions(rapportId);
  return {
    rapport,
    schema: { columns: schema.columns_json || [] },
    municipalities,
    communes,
    versions,
    waliResponses: rapport.waliResponses || []
  };
}

module.exports = {
  getServiceContentHub,
  getServiceWorkspace,
  saveTableData,
  getDocumentList,
  createDocument,
  saveDocumentBlocks,
  getWaliTableView,
  getWaliDocumentView,
  getWaliCommuneView,
  getCommuneListWorkspace,
  getCommuneRows,
  saveCommuneData,
  getRapportView
};
