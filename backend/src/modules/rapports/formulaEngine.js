const FORMULA_COL_TYPES = new Set(["formula"]);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeFormulaExpression(expr) {
  let s = String(expr || "").trim();
  if (!s) return "0";
  s = s.replace(/×|✕/g, "*");
  s = s.replace(/÷/g, "/");
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*[xX]\s*(\d+(?:[.,]\d+)?)/g, (_, a, b) => {
    const x = a.replace(",", ".");
    const y = b.replace(",", ".");
    return `(${x}*${y})`;
  });
  s = s.replace(/\b([A-Z]{1,3})\s*[xX]\s*([A-Z]{1,3})\b/g, "($1*$2)");
  s = s.replace(/\b([A-Z]{1,3})\s*[xX]\s*(\d+(?:[.,]\d+)?)\b/g, "($1*$2)");
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*[xX]\s*([A-Z]{1,3})\b/g, "($1*$2)");
  s = s.replace(/(\d+),(\d+)/g, "$1.$2");
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)");
  return s;
}

function normalizeEquality(expr) {
  return expr.replace(/(?<![<>!=])=(?!=)/g, "==");
}

function expandFormulaFunctions(expr) {
  let s = expr;
  const replacers = [
    [
      /\b(?:IF|SI|إذا)\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi,
      (_, cond, whenTrue, whenFalse) => `((${cond.trim()})?(${whenTrue.trim()}):(${whenFalse.trim()}))`
    ],
    [
      /\bSUM\s*\(\s*([^)]*)\s*\)/gi,
      (_, args) => {
        const parts = args.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
        return parts.length ? `(${parts.join("+")})` : "0";
      }
    ],
    [
      /\bAVG\s*\(\s*([^)]*)\s*\)/gi,
      (_, args) => {
        const parts = args.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
        return parts.length ? `((${parts.join("+")})/${parts.length})` : "0";
      }
    ],
    [
      /\b(MIN|MAX)\s*\(\s*([^)]*)\s*\)/gi,
      (_, fn, args) => {
        const parts = args.split(/[,;]/).map((p) => p.trim()).filter(Boolean);
        return parts.length ? `Math.${fn.toLowerCase()}(${parts.join(",")})` : "0";
      }
    ],
    [
      /\b(PCT|PERCENT)\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi,
      (_, _fn, num, den) => `((${num.trim()})/(${den.trim()})*100)`
    ]
  ];
  for (const [re, fn] of replacers) {
    s = s.replace(re, fn);
  }
  return s;
}

function cellNumericValue(row, col) {
  if (col.type === "commune_ref") return 0;
  const val = row[col.key];
  const n = val === "" || val == null ? 0 : Number(val);
  return Number.isFinite(n) ? n : 0;
}

function substituteColumnRefs(expr, row, columns) {
  const refs = (columns || [])
    .filter((c) => c.key && c.type !== "commune_ref")
    .sort((a, b) => b.key.length - a.key.length);

  let s = expr;
  for (const col of refs) {
    const safe = cellNumericValue(row, col);
    s = s.replace(new RegExp(`\\b${escapeRegex(col.key)}\\b`, "gi"), String(safe));
  }
  return s;
}

function safeEvalFormula(expr, row, columns) {
  try {
    let code = normalizeFormulaExpression(expr);
    code = expandFormulaFunctions(code);
    code = substituteColumnRefs(code, row, columns);
    code = normalizeEquality(code);
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${code});`)();
    return Number.isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

function excelColumnLetter(index) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

module.exports = {
  normalizeFormulaExpression,
  expandFormulaFunctions,
  safeEvalFormula,
  excelColumnLetter,
  FORMULA_COL_TYPES
};
