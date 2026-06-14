/** Compare commune draft entries against last submitted baseline. */



function stripRowMeta(row) {

  if (!row || typeof row !== "object") return row;

  const next = { ...row };

  delete next._cell_colors;

  delete next._highlight;

  delete next._municipality_name_ar;

  delete next._municipality_name_fr;

  delete next.municipality_code;

  return next;

}



function isUserDataColumn(col) {

  return col && col.type !== "commune_ref" && col.type !== "formula";

}



function defaultCellValue(col) {

  if (!col) return null;

  if (col.type === "number") return null;

  if (col.type === "choice") return col.choices?.[0]?.value ?? "";

  return "";

}



function isDefaultCellValue(col, value) {

  if (!isUserDataColumn(col)) return true;

  const def = defaultCellValue(col);

  if (col.type === "number") {

    if (value == null || value === "") return true;

    return false;

  }

  return String(value ?? "").trim() === String(def ?? "").trim();

}



function isDefaultCommuneTableRow(row, columns = []) {

  if (!row || typeof row !== "object") return true;

  const userCols = columns.filter(isUserDataColumn);

  if (!userCols.length) return true;

  return userCols.every((col) => isDefaultCellValue(col, row[col.key]));

}



function meaningfulRowSnapshot(row, columns = []) {

  if (!row || isDefaultCommuneTableRow(row, columns)) return null;

  const snap = {};

  for (const col of columns) {

    if (!isUserDataColumn(col)) continue;

    const v = row[col.key];

    if (col.type === "number") {

      if (v != null && v !== "") snap[col.key] = v;

    } else if (String(v ?? "").trim() !== "") {

      snap[col.key] = v;

    }

  }

  return Object.keys(snap).length ? snap : null;

}



function htmlHasMeaningfulContent(html) {

  const strip = (h) =>

    String(h || "")

      .replace(/<[^>]+>/g, "")

      .replace(/&nbsp;/g, " ")

      .trim();

  return Boolean(strip(html));

}



function hasUserBlockContent(blocks) {

  if (!Array.isArray(blocks) || !blocks.length) return false;

  return blocks.some((b) => {

    if (b.type === "media_row") return (b.items || []).length > 0;

    if (b.type === "paragraph") {

      return Boolean(

        String(b.text_ar || "").trim() || String(b.text_fr || "").trim(),

      );

    }

    return false;

  });

}



function meaningfulCommuneSnapshot(entry, columns = []) {

  if (!entry || typeof entry !== "object") return null;

  const snap = {};



  if (htmlHasMeaningfulContent(entry.rich_html_ar)) {

    snap.rich_html_ar = entry.rich_html_ar;

  }

  if (htmlHasMeaningfulContent(entry.rich_html_fr)) {

    snap.rich_html_fr = entry.rich_html_fr;

  }

  if (Array.isArray(entry.embedded_tables) && entry.embedded_tables.length) {

    snap.embedded_tables = entry.embedded_tables;

  }

  if (hasUserBlockContent(entry.blocks)) {

    snap.blocks = entry.blocks;

  }

  if (Array.isArray(entry.rows) && entry.rows.length && columns?.length) {

    const rows = entry.rows

      .map(stripRowMeta)

      .map((row) => meaningfulRowSnapshot(row, columns))

      .filter(Boolean);

    if (rows.length) snap.rows = rows;

  } else if (Array.isArray(entry.rows) && entry.rows.length && !columns?.length) {

    const rows = entry.rows

      .map(stripRowMeta)

      .filter((row) =>

        Object.entries(row).some(

          ([k, v]) =>

            !k.startsWith("_") &&

            v != null &&

            String(v).trim() !== "",

        ),

      );

    if (rows.length) snap.rows = rows;

  }



  return Object.keys(snap).length ? snap : null;

}



function getBaselineCommunes(rapport) {

  const versions = rapport?.versions || [];

  const submitted = versions

    .filter((v) => v.submitted_at)

    .sort((a, b) => b.version_number - a.version_number);

  if (!submitted.length) return {};

  return submitted[0]?.data_json?.communes || {};

}



function isCommuneEntryFilled(entry, { columns } = {}) {

  return meaningfulCommuneSnapshot(entry, columns) != null;

}



function isCommuneChangedFromBaseline(currentEntry, baselineEntry, columns = []) {

  const current = meaningfulCommuneSnapshot(currentEntry, columns);

  const baseline = meaningfulCommuneSnapshot(baselineEntry, columns);

  return JSON.stringify(current) !== JSON.stringify(baseline);

}



function summarizeMunicipality(entry, baselineEntry, columns) {

  return {

    filled: isCommuneEntryFilled(entry, { columns }),

    is_changed: isCommuneChangedFromBaseline(entry, baselineEntry, columns),

  };

}



module.exports = {

  getBaselineCommunes,

  isCommuneEntryFilled,

  isCommuneChangedFromBaseline,

  summarizeMunicipality,

  meaningfulCommuneSnapshot,

  isDefaultCommuneTableRow,

};

