const { z } = require("zod");
const { V } = require("./errorKeys");

function trimOrEmpty(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasBilingualText(ar, fr) {
  return Boolean(trimOrEmpty(ar) || trimOrEmpty(fr));
}

function pickBilingualText(ar, fr, locale = "ar") {
  const a = trimOrEmpty(ar);
  const f = trimOrEmpty(fr);
  if (locale === "fr") return f || a;
  return a || f;
}

function bilingualLabelShape(max = 200) {
  return {
    label_ar: z.string().trim().max(max),
    label_fr: z.string().trim().max(max)
  };
}

function bilingualNameShape(max = 200) {
  return {
    name_ar: z.string().trim().max(max),
    name_fr: z.string().trim().max(max)
  };
}

function addBilingualPairIssues(data, ctx, arKey, frKey, message = V.bilingualLabelRequired) {
  if (!hasBilingualText(data[arKey], data[frKey])) {
    ctx.addIssue({ code: "custom", message, path: [arKey] });
    ctx.addIssue({ code: "custom", message, path: [frKey] });
  }
}

function refineBilingualPair(schema, arKey, frKey, message = V.bilingualLabelRequired) {
  return schema.superRefine((data, ctx) => addBilingualPairIssues(data, ctx, arKey, frKey, message));
}

function refineBilingualNames(schema, message = V.bilingualLabelRequired) {
  return refineBilingualPair(schema, "name_ar", "name_fr", message);
}

function refineBilingualLabels(schema, message = V.bilingualLabelRequired) {
  return refineBilingualPair(schema, "label_ar", "label_fr", message);
}

module.exports = {
  trimOrEmpty,
  hasBilingualText,
  pickBilingualText,
  bilingualLabelShape,
  bilingualNameShape,
  addBilingualPairIssues,
  refineBilingualPair,
  refineBilingualNames,
  refineBilingualLabels
};
