import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { localizedName } from '../utils/schemaColumns'
import { DocumentTemplateEditModal } from './DocumentTemplateEditModal'
import { DocumentTemplatePickModal } from './DocumentTemplatePickModal'
import { TablePagination } from './TablePagination'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import { hasBilingualText } from '../utils/bilingual'

type Props = {
  token: string
  serviceId: number
  rapportTypes: any[]
}

export function DocumentTemplatesSection({ token, serviceId, rapportTypes }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const navigate = useNavigate()
  const [templates, setTemplates] = useState<any[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [createForTypeId, setCreateForTypeId] = useState<number | null>(null)
  const [page, setPage] = useState(1)

  const load = useCallback(async () => {
    const res = await api.listOfficeDocumentTemplates(token, serviceId)
    setTemplates(res.templates || [])
  }, [token, serviceId])

  useEffect(() => {
    load().catch(() => setTemplates([]))
  }, [load])

  function openCreate() {
    setEditing(null)
    setEditOpen(true)
  }

  function openEdit(tpl: any) {
    const c = tpl.content_json || {}
    const typeIds = Array.isArray(tpl.rapport_type_ids)
      ? tpl.rapport_type_ids.map(String)
      : tpl.rapport_type_id
        ? [String(tpl.rapport_type_id)]
        : []
    setEditing({
      id: tpl.id,
      name_ar: tpl.name_ar,
      name_fr: tpl.name_fr,
      content_kind: tpl.content_kind || '',
      rapport_type_ids: typeIds,
      is_default: !!tpl.is_default,
      rich_html_ar: c.rich_html_ar || '<p></p>',
      rich_html_fr: c.rich_html_fr || '<p></p>',
    })
    setEditOpen(true)
  }

  async function saveTemplate(form: any) {
    if (!hasBilingualText(form.name_ar, form.name_fr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return
    }
    const body = {
      name_ar: form.name_ar.trim() || form.name_fr.trim(),
      name_fr: form.name_fr.trim() || form.name_ar.trim(),
      content_kind: form.content_kind || null,
      rapport_type_ids: (form.rapport_type_ids || []).map(Number).filter(Boolean),
      is_default: form.is_default,
      content_json: {
        rich_html_ar: form.rich_html_ar,
        rich_html_fr: form.rich_html_fr,
        embedded_tables: [],
      },
    }
    if (editing?.id) {
      await api.patchOfficeDocumentTemplate(token, editing.id, body)
    } else {
      await api.createOfficeDocumentTemplate(token, serviceId, body)
    }
    setEditOpen(false)
    setEditing(null)
    await load()
  }

  async function removeTemplate(id: number) {
    if (!window.confirm(t('delete') + '?')) return
    await api.deleteOfficeDocumentTemplate(token, id)
    await load()
  }

  const documentTypes = rapportTypes.filter((rt) =>
    ['document_compose', 'fiche_lecture'].includes(rt.content_kind),
  )

  function typeLabels(tpl: any) {
    const ids = Array.isArray(tpl.rapport_type_ids)
      ? tpl.rapport_type_ids
      : tpl.rapport_type_id
        ? [tpl.rapport_type_id]
        : []
    if (!ids.length) return t('documentTemplateScopeAll')
    return ids
      .map((id: number) => {
        const rt = documentTypes.find((row) => Number(row.id) === Number(id))
        return rt ? localizedName(rt, i18n.language) : `#${id}`
      })
      .join(' · ')
  }

  if (!documentTypes.length) return null

  const pagedTemplates = paginateSlice(templates, page, DEFAULT_PAGE_SIZE)

  async function createRapport(typeId: number, templateId: number | null) {
    try {
      const res = await api.createDocument(token, serviceId, typeId, {
        templateId: templateId ?? undefined,
        skipDefault: templateId == null,
      })
      setCreateForTypeId(null)
      navigate(`/office/rapports/${res.rapport.id}/document`)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  return (
    <div className="section">
      <div className="pageHeader row">
        <h2>{t('documentTemplates')}</h2>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          {t('createDocumentTemplate')}
        </button>
      </div>
      <p className="muted small">{t('documentTemplatesHelp')}</p>

      <div className="documentTemplateCreateRow">
        <span className="muted small">{t('documentTemplateCreateRapportHint')}</span>
        <div className="documentTemplateCreateActions">
          {documentTypes.map((rt) => (
            <button
              key={rt.id}
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setCreateForTypeId(rt.id)}
            >
              {t('createRapport')} — {localizedName(rt, i18n.language)}
            </button>
          ))}
        </div>
      </div>

      <div className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>{t('rapportTitle')}</th>
              <th>{t('status')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {pagedTemplates.map((tpl) => (
              <tr key={tpl.id}>
                <td>
                  {localizedName(tpl, i18n.language)}
                  {tpl.is_default ? ` · ${t('documentTemplateDefault')}` : ''}
                </td>
                <td>
                  {tpl.content_kind ? t(`contentKind_${tpl.content_kind}`) : t('documentTemplateScopeAll')}
                  <div className="muted small">{typeLabels(tpl)}</div>
                </td>
                <td>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(tpl)}>
                    {t('edit')}
                  </button>{' '}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeTemplate(tpl.id)}>
                    {t('delete')}
                  </button>
                </td>
              </tr>
            ))}
            {!templates.length ? (
              <tr>
                <td colSpan={3} className="muted">
                  {t('noResults')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} total={templates.length} onPageChange={setPage} compact />

      <DocumentTemplateEditModal
        open={editOpen}
        title={editing?.id ? t('editDocumentTemplate') : t('createDocumentTemplate')}
        rapportTypes={rapportTypes}
        initial={editing || undefined}
        onClose={() => {
          setEditOpen(false)
          setEditing(null)
        }}
        onSave={saveTemplate}
      />

      {createForTypeId ? (
        <DocumentTemplatePickModal
          token={token}
          serviceId={serviceId}
          rapportTypeId={createForTypeId}
          open={!!createForTypeId}
          mode="create"
          onClose={() => setCreateForTypeId(null)}
          onSelect={(templateId) => {
            if (!createForTypeId) return
            createRapport(createForTypeId, templateId)
          }}
        />
      ) : null}
    </div>
  )
}
