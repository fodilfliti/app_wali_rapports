/** Prefixed entity keys for commune_list data_json */

const KINDS = ["commune", "daira", "direction"];

function normalizeTargetKinds(raw) {
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : ["commune"];
  const filtered = arr.filter((k) => KINDS.includes(k));
  return filtered.length ? [...new Set(filtered)] : ["commune"];
}

function entityKey(kind, code) {
  return `${kind}:${code}`;
}

function parseEntityKey(key) {
  if (!key || typeof key !== "string") return null;
  if (key.includes(":")) {
    const [kind, ...rest] = key.split(":");
    if (!KINDS.includes(kind)) return null;
    return { kind, code: rest.join(":") };
  }
  // Legacy bare commune code
  return { kind: "commune", code: key };
}

function ensureEntitiesMap(dataJson) {
  const data = dataJson && typeof dataJson === "object" ? { ...dataJson } : {};
  const communes =
    data.communes && typeof data.communes === "object" ? { ...data.communes } : {};
  if (data.entities && typeof data.entities === "object") {
    const entities = { ...data.entities };
    for (const [code, val] of Object.entries(communes)) {
      const key = entityKey("commune", code);
      if (!(key in entities)) entities[key] = val;
    }
    return { ...data, entities, communes };
  }
  const entities = {};
  for (const [code, val] of Object.entries(communes)) {
    entities[entityKey("commune", code)] = val;
  }
  return { ...data, entities, communes };
}

function getEntitiesMap(dataJson) {
  return ensureEntitiesMap(dataJson).entities || {};
}

/** null = include all entities of the type's target kinds */
function getIncludedEntityKeys(dataJson) {
  const raw = dataJson?.included_entity_keys;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const keys = [
    ...new Set(
      raw.filter((k) => typeof k === "string" && k.trim()).map((k) => k.trim()),
    ),
  ];
  return keys.length ? keys : null;
}

function filterSummariesByInclusion(summaries, includedKeys) {
  if (!includedKeys) return summaries;
  const set = new Set(includedKeys);
  return summaries.filter((s) => set.has(s.entity_key));
}

function isEntityIncluded(dataJson, key) {
  const included = getIncludedEntityKeys(dataJson);
  if (!included) return true;
  return included.includes(key);
}

module.exports = {
  KINDS,
  normalizeTargetKinds,
  entityKey,
  parseEntityKey,
  ensureEntitiesMap,
  getEntitiesMap,
  getIncludedEntityKeys,
  filterSummariesByInclusion,
  isEntityIncluded,
};
