import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { ApiError } from '../api'
import { BackButton } from '../components/BackButton'
import { CalendarEventsEditor, type CalendarEvent } from '../components/CalendarEventsEditor'
import { RapportTitleField, patchRapportTitle } from '../components/RapportTitleField'
import { RichDocumentEditor } from '../components/RichDocumentEditor'
import { useSnackbar } from '../snackbar/SnackbarContext'
import type { EmbeddedTable } from '../types/embeddedTable'
import { mergeRichHtmlIntoData } from '../utils/richDocument'
import { markOfficeRapportOpened } from '../utils/officeRapportList'

type Props = { token: string }

type CommuneContent = {
  rich_html_ar?: string
  rich_html_fr?: string
  blocks?: any[]
  embedded_tables?: EmbeddedTable[]
  calendar_events?: CalendarEvent[]
}

export function OfficeCommuneEditorPage({ token }: Props) {
  const { serviceId, municipalityCode } = useParams()
  const [searchParams] = useSearchParams()
  const rapportTypeId = searchParams.get('rapport_type_id') ? Number(searchParams.get('rapport_type_id')) : undefined
  const rapportIdParam = searchParams.get('rapport_id') ? Number(searchParams.get('rapport_id')) : undefined
  const sid = Number(serviceId)
  const code = municipalityCode || ''
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [workspace, setWorkspace] = useState<any>(null)
  const [content, setContent] = useState<CommuneContent>({})
  const [embeddedTables, setEmbeddedTables] = useState<EmbeddedTable[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [municipality, setMunicipality] = useState<any>(null)
  const [editable, setEditable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')

  const listPath = `/office/services/${sid}/communes${
    rapportTypeId || rapportIdParam
      ? `?${new URLSearchParams({
          ...(rapportTypeId ? { rapport_type_id: String(rapportTypeId) } : {}),
          ...(rapportIdParam ? { rapport_id: String(rapportIdParam) } : {}),
        }).toString()}`
      : ''
  }`
  const rapportId = workspace?.rapport?.id as number | undefined

  const load = useCallback(async () => {
    if (!sid || !code) return
    setLoading(true)
    setLoadError(null)
    try {
      const ws = await api.getCommuneWorkspace(token, sid, { rapportTypeId, rapportId: rapportIdParam })
      setWorkspace(ws)
      setTitle(ws.rapport?.title || '')
      if (!ws.rapport?.id) {
        setLoadError('communeWorkspaceError')
        return
      }
      void markOfficeRapportOpened(token, ws.rapport.id)
      const detail = await api.getCommuneRows(token, ws.rapport.id, code)
      setMunicipality(detail.municipality)
      const tables = detail.embedded_tables || []
      setContent({
        rich_html_ar: detail.rich_html_ar,
        rich_html_fr: detail.rich_html_fr,
        blocks: detail.blocks,
        embedded_tables: tables,
      })
      setEmbeddedTables(tables)
      setCalendarEvents(detail.calendar_events || [])
      setEditable(detail.editable === true)
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'errorGeneric'
      setLoadError(msg)
      snack.show(t(msg, { defaultValue: t('errorGeneric') }), 'error')
    } finally {
      setLoading(false)
    }
  }, [token, sid, code, rapportTypeId, rapportIdParam, snack, t])

  useEffect(() => {
    load()
  }, [load])

  async function save() {
    if (!rapportId || !code) return
    setSaving(true)
    try {
      const patched = await patchRapportTitle(token, rapportId, title)
      setTitle(patched.title)
      await api.saveCommuneData(token, rapportId, {
        municipality_code: code,
        rich_html_ar: content.rich_html_ar,
        rich_html_fr: content.rich_html_fr,
        embedded_tables: embeddedTables,
        calendar_events: calendarEvents,
      })
      snack.show(t('save'), 'success')
      load()
    } catch (e) {
      const msg = e instanceof Error && e.message === 'rapportTitleRequired' ? 'rapportTitleRequired' : 'errorGeneric'
      snack.show(t(msg), 'error')
    } finally {
      setSaving(false)
    }
  }

  const communeName = municipality
    ? i18n.language === 'fr'
      ? municipality.name_fr
      : municipality.name_ar
    : code

  return (
    <div className="page communeEditorPage">
      <div className="pageHeader row compact communeEditorHeader">
        <div className="communeEditorHeaderTitles">
          <RapportTitleField
            title={title}
            onChange={setTitle}
            editable={editable}
            fallback={t('navRapports')}
          />
          <p className="muted small communeEditorCommuneLabel">{communeName}</p>
        </div>
        <div className="pageHeaderActions">
          {editable ? (
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {t('save')}
            </button>
          ) : null}
          {workspace?.accessLevel === 'view' ? <span className="badge">{t('accessView')}</span> : null}
          <BackButton fallbackTo={listPath} />
        </div>
      </div>

      {loading ? <p className="muted communeStatus">{t('loading')}</p> : null}
      {loadError ? (
        <div className="communeError card">
          <p>{t(loadError, { defaultValue: t('errorGeneric') })}</p>
        </div>
      ) : null}

      {!loading && !loadError && rapportId ? (
        <>
          <RichDocumentEditor
            data={{ ...content, embedded_tables: embeddedTables }}
            editable={editable}
            token={token}
            rapportId={rapportId}
            serviceId={sid}
            onEmbeddedTablesChange={setEmbeddedTables}
            onChange={(locale, html) => setContent((prev) => mergeRichHtmlIntoData(prev, locale, html) as CommuneContent)}
          />
          <CalendarEventsEditor events={calendarEvents} editable={editable} onChange={setCalendarEvents} />
        </>
      ) : null}
    </div>
  )
}
