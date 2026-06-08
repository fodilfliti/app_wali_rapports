import type { DraftSchemaColumn, SchemaColumnPayload } from './schemaColumns'

export function normalizeFormulaExpression(expr: string): string {
  let s = String(expr || '').trim()
  if (!s) return '0'
  s = s.replace(/×|✕/g, '*')
  s = s.replace(/÷/g, '/')
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*[xX]\s*(\d+(?:[.,]\d+)?)/g, (_, a, b) => {
    const x = a.replace(',', '.')
    const y = b.replace(',', '.')
    return `(${x}*${y})`
  })
  s = s.replace(/\b([A-Z]{1,3})\s*[xX]\s*([A-Z]{1,3})\b/g, '($1*$2)')
  s = s.replace(/\b([A-Z]{1,3})\s*[xX]\s*(\d+(?:[.,]\d+)?)\b/g, '($1*$2)')
  s = s.replace(/(\d+(?:[.,]\d+)?)\s*[xX]\s*([A-Z]{1,3})\b/g, '($1*$2)')
  s = s.replace(/(\d+),(\d+)/g, '$1.$2')
  s = s.replace(/(\d+(?:\.\d+)?)\s*%/g, '($1/100)')
  return s
}

export function normalizeEquality(expr: string): string {
  return expr.replace(/(?<![<>!=])=(?!=)/g, '==')
}

export function expandFormulaFunctions(expr: string): string {
  let s = expr
  s = s.replace(
    /\b(?:IF|SI|إذا)\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi,
    (_, cond, whenTrue, whenFalse) => `((${cond.trim()})?(${whenTrue.trim()}):(${whenFalse.trim()}))`,
  )
  s = s.replace(/\bSUM\s*\(\s*([^)]*)\s*\)/gi, (_, args: string) => {
    const parts = args.split(/[,;]/).map((p) => p.trim()).filter(Boolean)
    return parts.length ? `(${parts.join('+')})` : '0'
  })
  s = s.replace(/\bAVG\s*\(\s*([^)]*)\s*\)/gi, (_, args: string) => {
    const parts = args.split(/[,;]/).map((p) => p.trim()).filter(Boolean)
    return parts.length ? `((${parts.join('+')})/${parts.length})` : '0'
  })
  s = s.replace(/\b(MIN|MAX)\s*\(\s*([^)]*)\s*\)/gi, (_, fn: string, args: string) => {
    const parts = args.split(/[,;]/).map((p) => p.trim()).filter(Boolean)
    return parts.length ? `Math.${fn.toLowerCase()}(${parts.join(',')})` : '0'
  })
  s = s.replace(/\b(PCT|PERCENT)\s*\(\s*([^,]+)\s*,\s*([^)]+)\s*\)/gi, (_, _fn, num, den) => {
    return `((${num.trim()})/(${den.trim()})*100)`
  })
  return s
}

export function excelColumnLetter(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export type FormulaColumnRef = {
  uid: string
  letter: string
  index: number
  type: string
  label: string
}

export function formulaColumnRefs(
  columns: { uid: string; type: string; label_ar: string; label_fr: string }[],
  lang: string,
): FormulaColumnRef[] {
  return columns.map((col, index) => ({
    uid: col.uid,
    letter: excelColumnLetter(index),
    index,
    type: col.type,
    label: lang === 'fr' ? col.label_fr.trim() || col.label_ar.trim() : col.label_ar.trim() || col.label_fr.trim(),
  }))
}

export const FORMULA_OPERATORS = [
  { symbol: '+', labelKey: 'schemaFormulaOp_add' },
  { symbol: '-', labelKey: 'schemaFormulaOp_sub' },
  { symbol: '×', labelKey: 'schemaFormulaOp_mul' },
  { symbol: '÷', labelKey: 'schemaFormulaOp_div' },
  { symbol: '(', labelKey: 'schemaFormulaOp_lparen' },
  { symbol: ')', labelKey: 'schemaFormulaOp_rparen' },
] as const

export const FORMULA_COMPARISONS = [
  { symbol: '>', labelKey: 'schemaFormulaCmp_gt' },
  { symbol: '<', labelKey: 'schemaFormulaCmp_lt' },
  { symbol: '>=', labelKey: 'schemaFormulaCmp_gte' },
  { symbol: '<=', labelKey: 'schemaFormulaCmp_lte' },
  { symbol: '=', labelKey: 'schemaFormulaCmp_eq' },
] as const

export const FORMULA_FUNCTIONS = [
  { id: 'SUM', template: 'SUM(A,B)', labelKey: 'schemaFormulaFn_sum' },
  { id: 'AVG', template: 'AVG(A,B)', labelKey: 'schemaFormulaFn_avg' },
  { id: 'PCT', template: 'PCT(A,B)', labelKey: 'schemaFormulaFn_pct' },
  { id: 'MIN', template: 'MIN(A,B)', labelKey: 'schemaFormulaFn_min' },
  { id: 'MAX', template: 'MAX(A,B)', labelKey: 'schemaFormulaFn_max' },
  { id: 'IF', template: 'IF(A>B,C,0)', labelKey: 'schemaFormulaFn_if' },
] as const

export function previewFormulaExample(refs: FormulaColumnRef[]): string {
  const a = refs.find((r) => r.type === 'number')?.letter || 'A'
  const b = refs.find((r) => r.type === 'number' && r.letter !== a)?.letter || 'B'
  return `${a} x ${b}`
}

/** Map legacy slug keys in saved formulas to Excel letters by column order. */
export function remapFormulaToExcelLetters(formula: string, columns: DraftSchemaColumn[] | SchemaColumnPayload[]): string {
  if (!formula.trim()) return formula
  let s = formula
  columns.forEach((col, i) => {
    const letter =
      'key' in col && col.key?.trim() ? col.key.trim().toUpperCase() : excelColumnLetter(i)
    const legacyKey =
      'key' in col && col.key?.trim() && col.key.trim().toUpperCase() !== letter
        ? col.key.trim()
        : null
    // Replace old slug keys only when key is not already an Excel letter
    const oldSlug =
      legacyKey && !/^[A-Z]{1,3}$/i.test(legacyKey) ? legacyKey : null
    if (oldSlug) {
      s = s.replace(new RegExp(`\\b${oldSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), letter)
    }
  })
  return s
}
