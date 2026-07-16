"use strict";

/**
 * Rename legacy table `modiriyat` → `directions` and rewrite soft entity keys
 * `modiriya:` → `direction:` in JSON columns. No-op when already migrated.
 */

function rewriteEntityKeyString(value) {
  if (typeof value !== "string") return value;
  if (value.startsWith("modiriya:")) return `direction:${value.slice("modiriya:".length)}`;
  if (value === "modiriya") return "direction";
  return value;
}

function rewriteJsonValue(value) {
  if (value == null) return value;
  if (typeof value === "string") return rewriteEntityKeyString(value);
  if (Array.isArray(value)) return value.map(rewriteJsonValue);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const newKey = rewriteEntityKeyString(k);
      out[newKey] = rewriteJsonValue(v);
    }
    return out;
  }
  return value;
}

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  const normalized = tables.map((t) => (typeof t === "string" ? t : t.tableName || t.name || String(t)));
  return normalized.map((t) => t.toLowerCase()).includes(tableName.toLowerCase());
}

async function columnExists(queryInterface, table, column) {
  const desc = await queryInterface.describeTable(table);
  return Object.prototype.hasOwnProperty.call(desc, column);
}

async function rewriteColumnJson(queryInterface, table, column) {
  if (!(await tableExists(queryInterface, table))) return;
  if (!(await columnExists(queryInterface, table, column))) return;
  const [rows] = await queryInterface.sequelize.query(
    `SELECT id, "${column}" AS payload FROM "${table}" WHERE "${column}" IS NOT NULL`
  );
  for (const row of rows) {
    const next = rewriteJsonValue(row.payload);
    if (JSON.stringify(next) === JSON.stringify(row.payload)) continue;
    await queryInterface.sequelize.query(
      `UPDATE "${table}" SET "${column}" = :payload::jsonb WHERE id = :id`,
      { replacements: { id: row.id, payload: JSON.stringify(next) } }
    );
  }
}

module.exports = {
  up: async (queryInterface) => {
    if (await tableExists(queryInterface, "modiriyat")) {
      await queryInterface.renameTable("modiriyat", "directions");
    }

    await rewriteColumnJson(queryInterface, "rapport_types", "entity_target_kinds");
    await rewriteColumnJson(queryInterface, "rapport_versions", "data_json");
    await rewriteColumnJson(queryInterface, "rapport_versions", "changed_entity_keys");
    await rewriteColumnJson(queryInterface, "rapport_versions", "entity_versions");
    await rewriteColumnJson(queryInterface, "rapport_versions", "changed_commune_codes");
    await rewriteColumnJson(queryInterface, "rapport_versions", "commune_versions");
  },

  down: async (queryInterface) => {
    // Irreversible for JSON rewrites; only rename table back if present.
    if (await tableExists(queryInterface, "directions")) {
      const stillHasModiriyat = await tableExists(queryInterface, "modiriyat");
      if (!stillHasModiriyat) {
        await queryInterface.renameTable("directions", "modiriyat");
      }
    }
  }
};
