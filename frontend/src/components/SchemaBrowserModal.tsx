import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntityIdParam } from '../api'
import * as api from '../api'
import { ApiError } from '../api'
import { SchemaListPanel, type SchemaBrowserRow } from './SchemaListPanel'
import { TableSchemaEditorModal } from './TableSchemaEditorModal'
import {
  validateDraftColumns,
  type DraftSchemaColumn,
} from './SchemaColumnsEditor'
import {
  buildSchemaSaveBody,
  emptySchemaEditorState,
  loadSchemaEditorState,
  type SchemaFormState,
} from '../utils/schemaEditorState'
import {
  defaultDraftHeaderGroups,
  validateDraftHeaderGroups,
  type DraftHeaderGroup,
} from '../utils/schemaHeaderGroups'
import { hasBilingualText } from '../utils/bilingual'
import { useSnackbar } from '../snackbar/SnackbarContext'

type Props = {
  token: string
  serviceId: EntityIdParam
  open: boolean
  onClose: () => void
}

export function SchemaBrowserModal({ token, serviceId, open, onClose }: Props) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const [schemas, setSchemas] = useState<SchemaBrowserRow[]>([])
  const [templates, setTemplates] = useState<SchemaBrowserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [schemaForm, setSchemaForm] = useState<SchemaFormState>({ name_ar: '', name_fr: '' })
  const [draftColumns, setDraftColumns] = useState<DraftSchemaColumn[]>(
    () => emptySchemaEditorState().draftColumns,
  )
  const [draftHeaderGroups, setDraftHeaderGroups] = useState<DraftHeaderGroup[]>(() =>
    defaultDraftHeaderGroups(),
  )
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!serviceId) return
    setLoading(true)
    try {
      const res = await api.listOfficeServiceSchemas(token, serviceId)
      setSchemas(res.schemas || [])
      setTemplates(res.templates || [])
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setLoading(false)
    }
  }, [token, serviceId, snack, t])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  if (!open) return null

  function openEditColumns(schema: SchemaBrowserRow) {
    const loaded = loadSchemaEditorState(schema as any)
    setEditingId(schema.id)
    setSchemaForm(loaded.schemaForm)
    setDraftColumns(loaded.draftColumns)
    setDraftHeaderGroups(loaded.draftHeaderGroups)
    setEditorOpen(true)
  }

  async function saveNames(schemaId: number, names: { name_ar: string; name_fr: string }) {
    try {
      await api.patchOfficeSchema(token, schemaId, names)
      await load()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'errorGeneric'
      snack.show(t(msg, { defaultValue: t('errorGeneric') }), 'error')
      throw e
    }
  }

  async function saveEdit() {
    if (!editingId) return
    const colErr = validateDraftColumns(draftColumns)
    if (colErr) {
      snack.show(t(colErr), 'error')
      return
    }
    const groupErr = validateDraftHeaderGroups(draftHeaderGroups, draftColumns)
    if (groupErr) {
      snack.show(t(groupErr), 'error')
      return
    }
    if (!hasBilingualText(schemaForm.name_ar, schemaForm.name_fr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return
    }
    const body = buildSchemaSaveBody(schemaForm, draftColumns, draftHeaderGroups)
    setSaving(true)
    try {
      await api.patchOfficeSchema(token, editingId, body)
      setEditorOpen(false)
      setEditingId(null)
      snack.show(t('save'), 'success')
      await load()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'errorGeneric'
      snack.show(t(msg, { defaultValue: t('errorGeneric') }), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSchema(schemaId: number) {
    try {
      await api.deleteOfficeSchema(token, schemaId)
      snack.show(t('deleteUnusedSchemaDone'), 'success')
      await load()
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'errorGeneric'
      snack.show(t(msg, { defaultValue: t('errorGeneric') }), 'error')
      throw e
    }
  }

  return (
    <>
      <div className="modalOverlay" role="presentation" onClick={onClose}>
        <div
          className="modalCard wide schemaModal schemaBrowserModal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="schemaBrowserTitle"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="schemaBrowserTitle">{t('schemaBrowserTitle')}</h2>
          <p className="muted small">{t('schemaBrowserHint')}</p>
          {loading ? (
            <p className="muted">…</p>
          ) : (
            <SchemaListPanel
              schemas={schemas}
              templates={templates}
              includeTemplates
              onEditColumns={openEditColumns}
              onSaveNames={saveNames}
              onDelete={deleteSchema}
            />
          )}
          <div className="modalActions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              {t('close')}
            </button>
          </div>
        </div>
      </div>

      {editorOpen ? (
        <TableSchemaEditorModal
          title={t('editSchema')}
          hint={t('createSchemaHint')}
          schemaForm={schemaForm}
          onSchemaFormChange={setSchemaForm}
          draftColumns={draftColumns}
          onDraftColumnsChange={setDraftColumns}
          draftHeaderGroups={draftHeaderGroups}
          onDraftHeaderGroupsChange={setDraftHeaderGroups}
          onSave={() => void saveEdit()}
          onCancel={() => {
            setEditorOpen(false)
            setEditingId(null)
          }}
          saving={saving}
        />
      ) : null}
    </>
  )
}
