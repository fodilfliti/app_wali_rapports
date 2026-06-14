/** Cell color presets aligned with frontend tableCellColors.ts */
const TABLE_COLOR_BG = {
  important: "FFFDE8E8",
  warning: "FFFEF3C7",
  info: "FFDBEAFE",
  success: "FFDCFCE7",
};

function cellBackgroundArgb(row, colKey) {
  const colors = row._cell_colors;
  if (!colors || typeof colors !== "object") return null;
  const key = colors[colKey];
  if (!key || key === "none") return null;
  if (TABLE_COLOR_BG[key]) return TABLE_COLOR_BG[key];
  if (/^#[0-9a-f]{6}$/i.test(key)) return `FF${key.slice(1).toUpperCase()}`;
  return null;
}

module.exports = { cellBackgroundArgb, TABLE_COLOR_BG };
