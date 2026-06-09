import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { localizedName } from '../utils/schemaColumns'

type Props = {
  token: string
  serviceId: number
  rapportTypeId: number
  open: boolean
  mode: 'create' | 'import'
  onClose: () => void
  onSelect: (templateId: number | null, importMode?: 'replace' | 'append') => void
}

export function DocumentTemplatePickModal({
  token,
  serviceId,
  rapportTypeId,
  open,
  mode,
  onClose,
  onSelect,
}: Props) {
  const { t, i18n } = useTranslation()
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<number | ''>('')
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSelectedId('')
    api
      .listDocumentTemplatesForCreate(token, serviceId, rapportTypeId)
      .then((res) => {
        const list = res.templates || []
        setTemplates(list)
        if (mode === 'create') {
          const def = list.find((tpl) => tpl.is_default)
          setSelectedId(def ? def.id : '')
        }
      })
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [open, token, serviceId, rapportTypeId])

  if (!open) return null

  const defaultTpl = templates.find((tpl) => tpl.is_default)

  function confirm() {
    if (mode === 'create') {
      onSelect(selectedId === '' ? null : Number(selectedId))
      return
    }
    if (selectedId === '') return
    onSelect(Number(selectedId), importMode)
  }

  return createPortal(
    <div className="modalOverlay templatePickModalOverlay">
      <div className="modalCard templatePickModalCard">
        <h2>{mode === 'create' ? t('documentTemplatePickCreate') : t('documentTemplatePickImport')}</h2>
        <p className="muted small">
          {mode === 'create' ? t('documentTemplatePickCreateHint') : t('documentTemplatePickImportHint')}
        </p>
        {loading ? <p className="muted">{t('loading')}</p> : null}
        {!loading && !templates.length ? <p className="muted">{t('documentTemplateNone')}</p> : null}
        {!loading && templates.length ? (
          <div className="templatePickList">
            {mode === 'create' ? (
              <label className="templatePickItem">
                <input
                  type="radio"
                  name="docTemplate"
                  checked={selectedId === ''}
                  onChange={() => setSelectedId('')}
                />
                <span>{t('documentTemplateBlank')}</span>
              </label>
            ) : null}
            {templates.map((tpl) => (
              <label key={tpl.id} className="templatePickItem">
                <input
                  type="radio"
                  name="docTemplate"
                  checked={selectedId === tpl.id}
                  onChange={() => setSelectedId(tpl.id)}
                />
                <span>
                  {localizedName(tpl, i18n.language)}
                  {tpl.is_default ? ` (${t('documentTemplateDefault')})` : ''}
                </span>
              </label>
            ))}
          </div>
        ) : null}
        {!loading && mode === 'create' && defaultTpl && selectedId === defaultTpl.id ? (
          <p className="muted small">{t('documentTemplateDefaultSelected')}</p>
        ) : null}
        {mode === 'import' && templates.length ? (
          <label>
            {t('documentTemplateImportMode')}
            <select value={importMode} onChange={(e) => setImportMode(e.target.value as 'replace' | 'append')}>
              <option value="replace">{t('documentTemplateImportReplace')}</option>
              <option value="append">{t('documentTemplateImportAppend')}</option>
            </select>
          </label>
        ) : null}
        <div className="modalActions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || (mode === 'import' && selectedId === '')}
            onClick={confirm}
          >
            {mode === 'create' ? t('createRapport') : t('documentTemplateImport')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
