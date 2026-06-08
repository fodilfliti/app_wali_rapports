import {
  buildColumnsPayload,
  defaultDraftColumns,
  draftColumnsFromPayload,
  type DraftSchemaColumn,
  type SchemaColumnPayload,
} from './schemaColumns'
import {
  buildLayoutJsonFromDraft,
  defaultDraftHeaderGroups,
  headerGroupsFromLayout,
  type DraftHeaderGroup,
} from './schemaHeaderGroups'
import type { LayoutJson } from './tableLayout'

export type SchemaFormState = { name_ar: string; name_fr: string }

export type TableSchemaRecord = {
  id?: number
  name_ar?: string
  name_fr?: string
  columns_json?: SchemaColumnPayload[]
  layout_json?: LayoutJson | null
  is_system?: boolean
}

export function emptySchemaEditorState(): {
  schemaForm: SchemaFormState
  draftColumns: DraftSchemaColumn[]
  draftHeaderGroups: DraftHeaderGroup[]
} {
  return {
    schemaForm: { name_ar: '', name_fr: '' },
    draftColumns: defaultDraftColumns(),
    draftHeaderGroups: defaultDraftHeaderGroups(),
  }
}

export function loadSchemaEditorState(schema: TableSchemaRecord) {
  const draftColumns = draftColumnsFromPayload(schema.columns_json || [])
  return {
    schemaForm: {
      name_ar: schema.name_ar || '',
      name_fr: schema.name_fr || '',
    },
    draftColumns,
    draftHeaderGroups: headerGroupsFromLayout(draftColumns, schema.layout_json),
  }
}

export function buildSchemaSaveBody(
  schemaForm: SchemaFormState,
  draftColumns: DraftSchemaColumn[],
  draftHeaderGroups: DraftHeaderGroup[],
) {
  return {
    name_ar: schemaForm.name_ar.trim(),
    name_fr: schemaForm.name_fr.trim(),
    columns: buildColumnsPayload(draftColumns),
    layout_json: buildLayoutJsonFromDraft(draftColumns, draftHeaderGroups),
  }
}
