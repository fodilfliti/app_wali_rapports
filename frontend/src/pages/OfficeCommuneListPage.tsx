import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { formatCell } from '../utils/tableLayout'
import { useSnackbar } from '../snackbar/SnackbarContext'

type Props = { token: string }

type Column = {
  key: string
  type: string
  label_ar: string
  label_fr: string
  format?: string
  choices?: { value: string; label_ar: string; label_fr: string }[]
}

function colLabel(col: Column, locale: string) {
  return locale === 'fr' ? col.label_fr : col.label_ar
}

export function OfficeCommuneListPage({ token }: Props) {
  const { serviceId } = useParams()
  const sid = Number(serviceId)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [workspace, setWorkspace] = useState<any>(null)
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [columns, setColumns] = useState<Column[]>([])
  const [saving, setSaving] = useState(false)

  const loadWorkspace = useCallback(async () => {
    if (!sid) return
    try {
      const ws = await api.getCommuneWorkspace(token, sid)
      setWorkspace(ws)
      setColumns(ws.schema?.columns || [])
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [token, sid, snack, t])

  useEffect(() => {
    loadWorkspace()
  }, [loadWorkspace])

  useEffect(() => {
    if (!workspace?.municipalities?.length) return
    setSelectedCode((prev) => prev || workspace.municipalities[0].code)
  }, [workspace?.municipalities])

  useEffect(() => {
    if (!workspace?.rapport?.id || !selectedCode) return
    api.getCommuneRows(token, workspace.rapport.id, selectedCode)
      .then((r) => setRows(r.rows || []))
      .catch(() => snack.show(t('errorGeneric'), 'error'))
  }, [workspace?.rapport?.id, selectedCode, token, snack, t])

  async function save() {
    if (!workspace?.rapport?.id || !selectedCode) return
    setSaving(true)
    try {
      await api.saveCommuneData(token, workspace.rapport.id, { municipality_code: selectedCode, rows })
      snack.show(t('save'), 'success')
      loadWorkspace()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function submitAll() {
    if (!workspace?.rapport?.id) return
    try {
      await api.submitRapport(token, workspace.rapport.id)
      snack.show(t('submitRapport'), 'success')
      loadWorkspace()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  const editable = workspace?.editable === true

  function updateRow(idx: number, key: string, value: unknown) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)))
  }

  const label = workspace?.service
    ? i18n.language === 'fr'
      ? workspace.service.name_fr
      : workspace.service.name_ar
    : t('contentKind_commune_list')

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{label}</h1>
        {editable ? (
          <>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !selectedCode}>
              {t('save')}
            </button>
            <button type="button" className="btn btn-accent" onClick={submitAll}>
              {t('submitRapport')}
            </button>
          </>
        ) : null}
        {workspace?.accessLevel === 'view' ? <span className="badge">{t('accessView')}</span> : null}
        <BackButton fallbackTo={`/office/services/${sid}`} />
      </div>

      <div className="communeLayout">
        <aside className="communeList card">
          <h2>{t('navMunicipalities')}</h2>
          <ul>
            {(workspace?.municipalities || []).map((m: any) => (
              <li key={m.code}>
                <button
                  type="button"
                  className={selectedCode === m.code ? 'active' : ''}
                  onClick={() => setSelectedCode(m.code)}
                >
                  <span>{i18n.language === 'fr' ? m.name_fr : m.name_ar}</span>
                  {m.filled ? <span className="badge badge-submitted">{t('communeFilled')}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="communePanel card tableWrap excelTable">
          {selectedCode ? (
            <table>
              <thead>
                <tr>
                  {columns.map((c) => (
                    <th key={c.key}>{colLabel(c, i18n.language)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    {columns.map((c) => (
                      <td key={c.key}>
                        {editable && c.type !== 'formula' && c.type !== 'commune_ref' ? (
                          c.type === 'choice' ? (
                            <select
                              value={(row[c.key] as string) ?? ''}
                              onChange={(e) => updateRow(idx, c.key, e.target.value)}
                            >
                              <option value="">—</option>
                              {(c.choices || []).map((ch) => (
                                <option key={ch.value} value={ch.value}>
                                  {i18n.language === 'fr' ? ch.label_fr : ch.label_ar}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'}
                              value={row[c.key] ?? ''}
                              onChange={(e) => updateRow(idx, c.key, e.target.value)}
                            />
                          )
                        ) : (
                          formatCell(row[c.key], c, i18n.language)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">{t('selectCommune')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
