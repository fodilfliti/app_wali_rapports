const { trimOrEmpty } = require("../validation/bilingual");

const META_LABELS = {
  wali: { ar: "الوالي", fr: "Wali" },
  num: { ar: "#", fr: "#" },
  finished: { ar: "منتهي", fr: "Terminé" },
  commune: { ar: "البلدية", fr: "Commune" },
};

function metaLabel(key, locale) {
  const row = META_LABELS[key];
  if (!row) return key;
  return locale === "fr" ? row.fr : row.ar;
}

function communeNameCell(dataRow, locale) {
  if (locale === "fr") {
    return trimOrEmpty(dataRow._municipality_name_fr) || trimOrEmpty(dataRow._municipality_name_ar);
  }
  return trimOrEmpty(dataRow._municipality_name_ar) || trimOrEmpty(dataRow._municipality_name_fr);
}

function exportMetaColumnKeys(opts = {}) {
  const keys = [];
  if (opts.includeCommuneNames) keys.push("commune");
  keys.push("num");
  if (opts.includeAdminMeta) keys.push("wali", "finished");
  return keys;
}

function metaValuesForRow(dataRow, lineNumber, opts = {}) {
  const values = { num: String(lineNumber) };
  if (opts.includeAdminMeta) {
    values.wali = dataRow._wali_visible === false ? "" : "✓";
    values.finished = dataRow._row_finished ? "✓" : "";
  }
  return values;
}

module.exports = {
  META_LABELS,
  metaLabel,
  communeNameCell,
  metaValuesForRow,
  exportMetaColumnKeys,
};
