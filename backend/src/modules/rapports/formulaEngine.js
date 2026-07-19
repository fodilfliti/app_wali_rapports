/**
 * Math-only formula evaluator (no Function/eval — no RCE via require/process).
 * Supports: numbers, + - * / %, parentheses, comparisons, == !=, ternary, Math.min/max.
 */

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
      (_, cond, whenTrue, whenFalse) => `((${cond.trim()})?(${whenTrue.trim()}):(${whenFalse.trim()}))`,
    ],
    [
      /\bSUM\s*\(\s*([^)]*)\s*\)/gi,
      (_, args) => {
        const parts = args
          .split(/[,;]/)
          .map((p) => p.trim())
          .filter(Boolean);
        return parts.length ? `(${parts.join("+")})` : "0";
      },
    ],
    [
      /\bAVG\s*\(\s*([^)]*)\s*\)/gi,
      (_, args) => {
        const parts = args
          .split(/[,;]/)
          .map((p) => p.trim())
          .filter(Boolean);
        return parts.length ? `((${parts.join("+")})/${parts.length})` : "0";
      },
    ],
    [
      /\b(MIN|MAX)\s*\(\s*([^)]*)\s*\)/gi,
      (_, fn, args) => {
        const parts = args
          .split(/[,;]/)
          .map((p) => p.trim())
          .filter(Boolean);
        return parts.length ? `Math.${fn.toLowerCase()}(${parts.join(",")})` : "0";
      },
    ],
    [
      /\b(PCT|PERCENT)\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi,
      (_, _fn, num, den) => `((${num.trim()})/(${den.trim()})*100)`,
    ],
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

/** Reject anything outside a strict math expression charset (post-substitution). */
function assertSafeMathSource(code) {
  const s = String(code || "").trim();
  if (!s || s.length > 2000) throw new Error("invalid");
  // Allow digits, ops, punctuation for numbers/ternary/comparisons, Math.min/max, whitespace.
  if (!/^[0-9+\-*/%().,?:<>=!&|\sMathinx]+$/i.test(s)) throw new Error("invalid");
  if (/\b(?:require|process|global|Function|eval|import|constructor|__proto__|prototype)\b/i.test(s)) {
    throw new Error("invalid");
  }
  // Only Math.min / Math.max identifiers allowed.
  const ids = s.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  for (const id of ids) {
    if (!/^(Math|min|max)$/i.test(id)) throw new Error("invalid");
  }
  return s;
}

class Parser {
  constructor(input) {
    this.s = input;
    this.i = 0;
  }

  peek() {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i += 1;
    return this.s[this.i] || "";
  }

  eat(ch) {
    if (this.peek() === ch) {
      this.i += 1;
      return true;
    }
    return false;
  }

  match(re) {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i += 1;
    const m = this.s.slice(this.i).match(re);
    if (!m || m.index !== 0) return null;
    this.i += m[0].length;
    return m[0];
  }

  parse() {
    const v = this.parseTernary();
    if (this.peek() !== "") throw new Error("trailing");
    return v;
  }

  parseTernary() {
    let cond = this.parseOr();
    if (this.eat("?")) {
      const a = this.parseTernary();
      if (!this.eat(":")) throw new Error("ternary");
      const b = this.parseTernary();
      return cond ? a : b;
    }
    return cond;
  }

  parseOr() {
    let left = this.parseAnd();
    while (this.match(/^(\|\|)/)) {
      const right = this.parseAnd();
      left = left || right ? 1 : 0;
    }
    return left;
  }

  parseAnd() {
    let left = this.parseCompare();
    while (this.match(/^(&&)/)) {
      const right = this.parseCompare();
      left = left && right ? 1 : 0;
    }
    return left;
  }

  parseCompare() {
    let left = this.parseAdd();
    for (;;) {
      const op = this.match(/^(==|!=|<=|>=|<|>)/);
      if (!op) break;
      const right = this.parseAdd();
      if (op === "==") left = left === right ? 1 : 0;
      else if (op === "!=") left = left !== right ? 1 : 0;
      else if (op === "<") left = left < right ? 1 : 0;
      else if (op === ">") left = left > right ? 1 : 0;
      else if (op === "<=") left = left <= right ? 1 : 0;
      else if (op === ">=") left = left >= right ? 1 : 0;
    }
    return left;
  }

  parseAdd() {
    let left = this.parseMul();
    for (;;) {
      if (this.eat("+")) left += this.parseMul();
      else if (this.eat("-")) left -= this.parseMul();
      else break;
    }
    return left;
  }

  parseMul() {
    let left = this.parseUnary();
    for (;;) {
      if (this.eat("*")) left *= this.parseUnary();
      else if (this.eat("/")) {
        const r = this.parseUnary();
        left = r === 0 ? NaN : left / r;
      } else if (this.eat("%")) {
        const r = this.parseUnary();
        left = r === 0 ? NaN : left % r;
      } else break;
    }
    return left;
  }

  parseUnary() {
    if (this.eat("+")) return this.parseUnary();
    if (this.eat("-")) return -this.parseUnary();
    if (this.eat("!")) return this.parseUnary() ? 0 : 1;
    return this.parsePrimary();
  }

  parsePrimary() {
    if (this.eat("(")) {
      const v = this.parseTernary();
      if (!this.eat(")")) throw new Error("paren");
      return v;
    }
    const mathFn = this.match(/^Math\.(min|max)\b/i);
    if (mathFn) {
      const fn = mathFn.toLowerCase().endsWith("min") ? Math.min : Math.max;
      if (!this.eat("(")) throw new Error("call");
      const args = [];
      if (this.peek() !== ")") {
        args.push(this.parseTernary());
        while (this.eat(",")) args.push(this.parseTernary());
      }
      if (!this.eat(")")) throw new Error("call");
      if (!args.length) return 0;
      return fn(...args);
    }
    const num = this.match(/^\d+(?:\.\d+)?/);
    if (num) return Number(num);
    throw new Error("primary");
  }
}

function evalMathExpression(code) {
  const safe = assertSafeMathSource(code);
  const parser = new Parser(safe);
  return parser.parse();
}

function safeEvalFormula(expr, row, columns) {
  try {
    let code = normalizeFormulaExpression(expr);
    code = expandFormulaFunctions(code);
    code = substituteColumnRefs(code, row, columns);
    code = normalizeEquality(code);
    const result = evalMathExpression(code);
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
  evalMathExpression,
  excelColumnLetter,
  FORMULA_COL_TYPES,
};
