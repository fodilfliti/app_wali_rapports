function slugifyPart(text, separator = "-") {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`^${separator}+|${separator}+$`, "g"), "")
    .slice(0, 60);
}

function baseSlugFromNames(nameFr, nameAr, fallback = "item", separator = "-") {
  const base = slugifyPart(nameFr, separator) || slugifyPart(nameAr, separator) || fallback;
  return base.slice(0, 80);
}

async function ensureUniqueSlug(base, existsFn, separator = "-") {
  let slug = base.slice(0, 80);
  let n = 2;
  while (await existsFn(slug)) {
    const suffix = `${separator}${n}`;
    slug = `${base.slice(0, 80 - suffix.length)}${suffix}`;
    n += 1;
  }
  return slug;
}

function rapportTypeSlugFromNames(nameFr, nameAr) {
  const base = baseSlugFromNames(nameFr, nameAr, "type", "_").replace(/-/g, "_");
  return base.replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 80) || "type";
}

module.exports = {
  slugifyPart,
  baseSlugFromNames,
  ensureUniqueSlug,
  rapportTypeSlugFromNames
};
