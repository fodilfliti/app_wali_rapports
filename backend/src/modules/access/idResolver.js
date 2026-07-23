const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Dual-read loader: accept public UUID string or legacy numeric primary key.
 */
async function findByPublicId(Model, id, options = {}) {
  if (isUuid(id)) {
    const { where, ...rest } = options;
    return Model.findOne({
      ...rest,
      where: { ...where, uuid: id },
    });
  }
  return Model.findByPk(id, options);
}

function publicId(row) {
  if (row == null) return null;
  const raw = row.toJSON ? row.toJSON() : row;
  if (raw.uuid) return String(raw.uuid);
  if (raw.id != null) return String(raw.id);
  return null;
}

/** Shallow JSON copy with API `id` set to public identifier (uuid when present). */
function withPublicId(obj) {
  if (obj == null || typeof obj !== "object") return obj;
  const raw = obj.toJSON ? obj.toJSON() : { ...obj };
  return { ...raw, id: publicId(raw) };
}

function withPublicIds(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(withPublicId);
}

/**
 * Resolve a public UUID or legacy numeric id to the model's BIGINT primary key.
 */
async function resolveNumericId(Model, idOrPlain) {
  const rawId =
    typeof idOrPlain === "object" && idOrPlain != null ? idOrPlain.id : idOrPlain;
  if (rawId == null || rawId === "") return null;
  if (isUuid(String(rawId))) {
    const row = await findByPublicId(Model, rawId, { attributes: ["id"] });
    return row?.id ?? null;
  }
  const n = Number(rawId);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** True if both refs point at the same row (UUID and/or legacy BIGINT). */
async function entityRefsEqual(Model, left, right) {
  if (left == null || right == null || left === "" || right === "") return false;
  if (String(left) === String(right)) return true;
  const [a, b] = await Promise.all([
    resolveNumericId(Model, left),
    resolveNumericId(Model, right),
  ]);
  return a != null && b != null && Number(a) === Number(b);
}

module.exports = {
  isUuid,
  findByPublicId,
  resolveNumericId,
  entityRefsEqual,
  publicId,
  withPublicId,
  withPublicIds,
};
