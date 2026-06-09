const { Op } = require("sequelize");
const { Rapport, RapportType, RapportVersion } = require("../../db");
const { defaultCellForColumn } = require("./tableGridService");

const ROW_META_KEYS = new Set([
  "municipality_code",
  "_municipality_name_ar",
  "_municipality_name_fr",
  "_highlight",
  "_row_finished",
  "_wali_visible",
  "_cell_colors"
]);

function isRowMetaKey(key) {
  return ROW_META_KEYS.has(key) || key.startsWith("_");
}

function remapRowByColumnIndex(row, oldColumns, newColumns) {
  const next = {};
  for (const [key, val] of Object.entries(row || {})) {
    if (isRowMetaKey(key)) next[key] = val;
  }
  for (let i = 0; i < newColumns.length; i++) {
    const newCol = newColumns[i];
    const oldCol = oldColumns[i];
    if (oldCol?.key && Object.prototype.hasOwnProperty.call(row, oldCol.key)) {
      next[newCol.key] = row[oldCol.key];
    } else if (Object.prototype.hasOwnProperty.call(row, newCol.key)) {
      next[newCol.key] = row[newCol.key];
    } else {
      next[newCol.key] = defaultCellForColumn(newCol, row);
    }
  }
  return next;
}

function remapDataJsonTables(dataJson, oldColumns, newColumns) {
  if (!dataJson?.tables?.length) return dataJson;
  return {
    ...dataJson,
    tables: dataJson.tables.map((table) => ({
      ...table,
      rows: (table.rows || []).map((row) => remapRowByColumnIndex(row, oldColumns, newColumns))
    }))
  };
}

function columnKeySetChanged(oldColumns, newColumns) {
  const oldKeys = (oldColumns || []).map((c) => c.key).filter(Boolean).sort().join("|");
  const newKeys = (newColumns || []).map((c) => c.key).filter(Boolean).sort().join("|");
  if (oldKeys !== newKeys) return true;
  return (oldColumns || []).length !== (newColumns || []).length;
}

async function remapDraftRapportsForSchemaChange(schemaSlug, oldColumns, newColumns) {
  if (!columnKeySetChanged(oldColumns, newColumns)) return;

  const types = await RapportType.findAll();
  const typeIds = types
    .filter((t) => t.schema_json?.table_schema_slug === schemaSlug && t.content_kind === "table_grid")
    .map((t) => t.id);
  if (!typeIds.length) return;

  const rapports = await Rapport.findAll({
    where: {
      rapport_type_id: { [Op.in]: typeIds },
      status: { [Op.in]: ["draft", "changes_requested"] }
    },
    include: [{ model: RapportVersion, as: "currentVersion", required: false }]
  });

  for (const rapport of rapports) {
    const version = rapport.currentVersion;
    if (!version?.data_json) continue;
    const nextData = remapDataJsonTables(version.data_json, oldColumns, newColumns);
    await RapportVersion.update({ data_json: nextData }, { where: { id: version.id } });
  }
}

module.exports = {
  remapDraftRapportsForSchemaChange,
  remapRowByColumnIndex,
  remapDataJsonTables
};
