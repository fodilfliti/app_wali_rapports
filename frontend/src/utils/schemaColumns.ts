import { excelColumnLetter, remapFormulaToExcelLetters } from './formulaEngine'
import { hasBilingualText, pickBilingualText } from './bilingual'

export type SchemaColumnType = 'text' | 'number' | 'date' | 'choice' | 'commune_ref' | 'formula'

export type SchemaColumnFormat = 'currency' | 'percent' | 'integer' | 'decimal'

export type ColumnFooterAggregate = 'sum' | 'avg' | 'min' | 'max' | 'count'

export const FOOTER_AGGREGATES: ColumnFooterAggregate[] = ['sum', 'avg', 'min', 'max', 'count']

export type SchemaChoiceOption = {
  value: string
  label_ar: string
  label_fr: string
}

export type SchemaColumnPayload = {
  key: string
  type: SchemaColumnType
  label_ar: string
  label_fr: string
  format?: SchemaColumnFormat
  formula?: string
  footer_aggregate?: ColumnFooterAggregate
  merge_vertical_suggested?: boolean
  choices?: SchemaChoiceOption[]
}

export type DraftChoiceOption = {
  uid: string
  label_ar: string
  label_fr: string
}

export type DraftSchemaColumn = {
  uid: string
  /** Persisted column key when editing an existing schema column */
  key?: string
  type: SchemaColumnType
  label_ar: string
  label_fr: string
  format: SchemaColumnFormat | ''
  formula: string
  footer_aggregate: ColumnFooterAggregate | ''
  merge_vertical_suggested: boolean
  choices: DraftChoiceOption[]
}

export const SCHEMA_COLUMN_TYPES: SchemaColumnType[] = [
  'text',
  'number',
  'formula',
  'date',
  'choice',
  'commune_ref',
]

export const SCHEMA_COLUMN_TYPE_GROUPS: { labelKey: string; types: SchemaColumnType[] }[] = [
  { labelKey: 'schemaColTypeGroup_input', types: ['text', 'number', 'date', 'choice', 'commune_ref'] },
  { labelKey: 'schemaColTypeGroup_calculated', types: ['formula'] },
]

export const NUMBER_FORMATS: SchemaColumnFormat[] = ['currency', 'percent', 'integer', 'decimal']

export function newDraftChoice(labelAr?: string, labelFr?: string): DraftChoiceOption {
  return {
    uid: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    label_ar: labelAr ?? '',
    label_fr: labelFr ?? '',
  }
}

export function newDraftColumn(labelAr?: string, labelFr?: string): DraftSchemaColumn {
  return {
    uid: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: 'text',
    label_ar: labelAr ?? '',
    label_fr: labelFr ?? '',
    format: '',
    formula: '',
    footer_aggregate: '',
    merge_vertical_suggested: false,
    choices: [],
  }
}

export function defaultDraftColumns(): DraftSchemaColumn[] {
  return [{ ...newDraftColumn('ملاحظات', 'Observations'), key: 'A' }]
}

export function columnKeyFromLabels(labelFr: string, labelAr: string, index: number, used: Set<string>): string {
  const base = suggestColumnKey(labelFr, labelAr, index)
  let key = base
  let n = 2
  while (used.has(key)) {
    key = `${base}_${n}`
    n += 1
  }
  used.add(key)
  return key
}

export function suggestColumnKey(labelFr: string, labelAr: string, index: number): string {
  const src = (labelFr || labelAr).trim().toLowerCase()
  const slug = src
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  return slug || `col_${index + 1}`
}

export function choiceValueFromLabels(labelFr: string, labelAr: string, index: number, used: Set<string>): string {
  const base = suggestColumnKey(labelFr, labelAr, index)
  let value = base
  let n = 2
  while (used.has(value)) {
    value = `${base}_${n}`
    n += 1
  }
  used.add(value)
  return value
}

export function nextAvailableColumnKey(columns: DraftSchemaColumn[]): string {
  const used = new Set(
    columns.map((c) => c.key?.trim().toUpperCase()).filter((k): k is string => Boolean(k)),
  )
  let i = 0
  while (used.has(excelColumnLetter(i))) i += 1
  return excelColumnLetter(i)
}

/** Assign stable Excel letters (A, B, C…) that stay with each column when reordering. */
export function ensureDraftColumnKeys(columns: DraftSchemaColumn[]): DraftSchemaColumn[] {
  const used = new Set<string>()
  return columns.map((col) => {
    let key = col.key?.trim().toUpperCase()
    if (!key || !/^[A-Z]{1,3}$/.test(key) || used.has(key)) {
      let i = 0
      while (used.has(excelColumnLetter(i))) i += 1
      key = excelColumnLetter(i)
    }
    used.add(key)
    return { ...col, key }
  })
}

export function previewColumnKeys(columns: DraftSchemaColumn[], lang: string) {
  return ensureDraftColumnKeys(columns).map((col, index) => ({
    uid: col.uid,
    key: col.key!,
    letter: col.key!,
    index,
    type: col.type,
    label: lang === 'fr' ? col.label_fr.trim() || col.label_ar.trim() : col.label_ar.trim() || col.label_fr.trim(),
  }))
}

export function draftColumnsFromPayload(columns: SchemaColumnPayload[]): DraftSchemaColumn[] {
  const draft = (columns || []).map((c) => ({
    uid: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    key: c.key,
    type: c.type as SchemaColumnType,
    label_ar: c.label_ar,
    label_fr: c.label_fr,
    format: (c.format as SchemaColumnFormat) || '',
    formula: c.formula || '',
    footer_aggregate: (c.footer_aggregate as ColumnFooterAggregate) || '',
    merge_vertical_suggested: Boolean(c.merge_vertical_suggested),
    choices: (c.choices || []).map((ch) => ({
      uid: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      label_ar: ch.label_ar,
      label_fr: ch.label_fr,
    })),
  }))
  return ensureDraftColumnKeys(draft)
}

export function buildColumnsPayload(cols: DraftSchemaColumn[]): SchemaColumnPayload[] {
  const withKeys = ensureDraftColumnKeys(cols)
  const payloads: SchemaColumnPayload[] = withKeys.map((c) => {
    const key = c.key!
    const payload: SchemaColumnPayload = {
      key,
      type: c.type,
      label_ar: c.label_ar.trim() || c.label_fr.trim(),
      label_fr: c.label_fr.trim() || c.label_ar.trim(),
    }
    if ((c.type === 'number' || c.type === 'formula') && c.format) payload.format = c.format
    if ((c.type === 'number' || c.type === 'formula') && c.footer_aggregate) {
      payload.footer_aggregate = c.footer_aggregate
    }
    if (c.type === 'formula' && c.formula.trim()) payload.formula = c.formula.trim()
    if (c.type === 'choice') {
      const used = new Set<string>()
      const choices = (c.choices || [])
        .filter((ch) => hasBilingualText(ch.label_ar, ch.label_fr))
        .map((ch, ci) => ({
          value: choiceValueFromLabels(ch.label_fr, ch.label_ar, ci, used),
          label_ar: ch.label_ar.trim() || ch.label_fr.trim(),
          label_fr: ch.label_fr.trim() || ch.label_ar.trim(),
        }))
      if (choices.length) payload.choices = choices
    }
    if (c.merge_vertical_suggested) payload.merge_vertical_suggested = true
    return payload
  })
  return payloads.map((p) =>
    p.type === 'formula' && p.formula ? { ...p, formula: remapFormulaToExcelLetters(p.formula, withKeys) } : p,
  )
}

export function validateDraftColumns(cols: DraftSchemaColumn[]): string | null {
  if (!cols.length) return 'schemaColumnsRequired'
  for (const c of cols) {
    if (!hasBilingualText(c.label_ar, c.label_fr)) return 'bilingualLabelRequired'
    if (c.type === 'formula' && !c.formula.trim()) return 'schemaFormulaRequired'
    if (c.type === 'choice') {
      const opts = (c.choices || []).filter((ch) => hasBilingualText(ch.label_ar, ch.label_fr))
      if (!opts.length) return 'schemaChoiceOptionsRequired'
    }
  }
  return null
}

export function localizedName(row: { name_ar?: string; name_fr?: string }, lang: string) {
  return pickBilingualText(row.name_ar, row.name_fr, lang)
}
