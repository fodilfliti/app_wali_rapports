import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { FieldErrorText } from '../components/FieldErrorText'
import { FormErrorBlock } from '../components/FormErrorBlock'
import { TableGridView, TableMergeToolbar, TableTitleBlock } from '../components/TableGridView'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { waliRespondSchema } from '../validation/schemas/forms'
import { useZodForm } from '../validation/useZodForm'
import type { Column, LayoutJson, TableMeta } from '../utils/tableLayout'
import { formatCell } from '../utils/tableLayout'
import { CalendarEventsEditor, CalendarEventsView, type CalendarEvent } from '../components/CalendarEventsEditor'
import { DocumentBlocksView, MediaRowsEditor, MediaRowsView } from '../components/MediaBlocks'
import { RapportExportButtons } from '../components/ExportPdfButton'
import { HubTile } from '../components/HubTile'
import type { MediaFile, MediaRow } from '../utils/media'

type Props = { token: string }

function blockText(block: any, locale: string) {
  return locale === 'fr' ? block.text_fr ?? block.text ?? '' : block.text_ar ?? block.text ?? ''
}

export function OfficeTableGridPage({ token }: Props) {
  const { serviceId } = useParams()
  const sid = Number(serviceId)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([])
  const [mediaFiles, setMediaFiles] = useState<Record<number, MediaFile>>({})
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [tableMeta, setTableMeta] = useState<TableMeta>({})
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [versionPreview, setVersionPreview] = useState<any>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (!sid) return
    try {
      const ws = await api.getTableWorkspace(token, sid)
      setWorkspace(ws)
      const table = ws.tableData?.tables?.[0] || {}
      setRows(table.rows || [])
      setMediaRows(table.media_rows || [])
      if (ws.rapport?.id) {
        api.getRapportMediaFiles(token, ws.rapport.id).then((r) => setMediaFiles(r.files || {})).catch(() => {})
        api.getCalendarEvents(token, ws.rapport.id).then((r) => setCalendarEvents(r.events || [])).catch(() => {})
      }
      setTableMeta({
        title_ar: table.title_ar,
        title_fr: table.title_fr,
        subtitle_ar: table.subtitle_ar,
        subtitle_fr: table.subtitle_fr,
        merge_column_keys: table.merge_column_keys || [],
      })
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [token, sid, snack, t])

  useEffect(() => {
    load()
  }, [load])

  async function save() {
    if (!workspace?.rapport?.id) return
    setSaving(true)
    try {
      await api.saveTableData(token, workspace.rapport.id, {
        rows,
        table_key: 'main',
        media_rows: mediaRows,
        ...tableMeta,
      })
      await api.saveCalendarEvents(token, workspace.rapport.id, calendarEvents)
      snack.show(t('save'), 'success')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function submit() {
    if (!workspace?.rapport?.id) return
    try {
      await api.submitRapport(token, workspace.rapport.id)
      snack.show(t('submitRapport'), 'success')
      navigate('/office/rapports')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  const columns: Column[] = workspace?.schema?.columns || []
  const layoutJson: LayoutJson | null = workspace?.schema?.layout_json || null
  const editable = workspace?.editable !== false
  const mergeKeys = tableMeta.merge_column_keys || []

  async function openVersion(versionId: number) {
    if (!workspace?.rapport?.id) return
    try {
      const res = await api.getRapportVersion(token, workspace.rapport.id, versionId)
      setVersionPreview(res.version)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  const previewTable = versionPreview?.data_json?.tables?.[0] || {}
  const previewRows = previewTable.rows || []
  const snapshot = versionPreview?.data_json?.schema_snapshot
  const previewColumns: Column[] = snapshot?.columns || columns
  const previewLayout: LayoutJson | null = snapshot?.layout_json ?? layoutJson
  const previewMeta: TableMeta = {
    title_ar: previewTable.title_ar,
    title_fr: previewTable.title_fr,
    subtitle_ar: previewTable.subtitle_ar,
    subtitle_fr: previewTable.subtitle_fr,
    merge_column_keys: previewTable.merge_column_keys || [],
  }

  function updateRow(idx: number, key: string, value: unknown) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)))
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{workspace?.service ? (i18n.language === 'fr' ? workspace.service.name_fr : workspace.service.name_ar) : t('navRapports')}</h1>
        {editable ? (
          <>
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {t('save')}
            </button>
            <button type="button" className="btn btn-accent" onClick={submit}>
              {t('submitRapport')}
            </button>
          </>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={() => setVersionsOpen(true)}>
          {t('archivedVersions')}
        </button>
        {workspace?.rapport?.id ? (
          <RapportExportButtons token={token} rapportId={workspace.rapport.id} />
        ) : null}
        <BackButton fallbackTo={`/office/services/${sid}`} />
      </div>

      <TableTitleBlock
        tableMeta={tableMeta}
        editable={editable}
        onTableMetaChange={(patch) => setTableMeta((prev) => ({ ...prev, ...patch }))}
      />
      <TableMergeToolbar
        columns={columns}
        mergeKeys={mergeKeys}
        editable={editable}
        onMergeToggle={(colKey, checked) =>
          setTableMeta((prev) => ({
            ...prev,
            merge_column_keys: checked
              ? [...(prev.merge_column_keys || []), colKey]
              : (prev.merge_column_keys || []).filter((k) => k !== colKey),
          }))
        }
      />

      <div className="card tableWrap excelTable">
        <TableGridView
          columns={columns}
          rows={rows}
          layoutJson={layoutJson}
          tableMeta={tableMeta}
          editable={editable}
          showRowMeta
          onUpdateRow={updateRow}
        />
      </div>

      <MediaRowsEditor
        rows={mediaRows}
        files={mediaFiles}
        token={token}
        editable={editable}
        onChange={setMediaRows}
        onUpload={async (file) => {
          const res = await api.uploadRapportFile(token, workspace!.rapport!.id, file)
          setMediaFiles((prev) => ({ ...prev, [res.file.id]: res.file }))
          return res.file
        }}
      />

      <CalendarEventsEditor events={calendarEvents} editable={editable} onChange={setCalendarEvents} />

      {versionsOpen ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{t('archivedVersions')}</h2>
            <ul className="versionList">
              {(workspace?.versions || []).map((v: any) => (
                <li key={v.id}>
                  <button type="button" className="btn btn-ghost" onClick={() => openVersion(v.id)}>
                    v{v.version_number} — {v.submitted_at ? new Date(v.submitted_at).toLocaleString() : t('statusDraft')}
                  </button>
                </li>
              ))}
            </ul>
            {versionPreview ? (
              <div className="section">
                <h3>
                  {t('viewVersion')} v{versionPreview.version_number}
                </h3>
                <div className="tableWrap excelTable">
                  <TableTitleBlock tableMeta={previewMeta} editable={false} />
                  <TableGridView
                    columns={previewColumns}
                    rows={previewRows}
                    layoutJson={previewLayout}
                    tableMeta={previewMeta}
                    editable={false}
                  />
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setVersionsOpen(false)
                setVersionPreview(null)
              }}
            >
              {t('close')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function OfficeServiceContentHubPage({ token }: Props) {
  const { serviceId } = useParams()
  const sid = Number(serviceId)
  const { t, i18n } = useTranslation()
  const [hub, setHub] = useState<any>(null)

  useEffect(() => {
    if (!sid) return
    api.getServiceContentHub(token, sid).then(setHub).catch(() => {})
  }, [sid, token])

  const label = hub?.service
    ? i18n.language === 'fr'
      ? hub.service.name_fr
      : hub.service.name_ar
    : t('navServices')

  const kinds = hub?.contentKinds || {}

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{label}</h1>
        {hub?.accessLevel === 'view' ? <span className="badge">{t('accessView')}</span> : null}
        <BackButton fallbackTo="/office/services" />
      </div>
      <div className="hubGrid">
        {(kinds.table_grid?.length ?? 0) > 0 ? (
          <HubTile to={`/office/services/${sid}/table`} icon="table" title={t('contentKind_table_grid')} />
        ) : null}
        {(kinds.document_compose?.length ?? 0) > 0 ? (
          <HubTile to={`/office/services/${sid}/documents`} icon="document" title={t('contentKind_document_compose')} />
        ) : null}
        {(kinds.fiche_lecture?.length ?? 0) > 0 ? (
          <HubTile to={`/office/services/${sid}/fiches`} icon="fiche" title={t('contentKind_fiche_lecture')} />
        ) : null}
        {(kinds.commune_list?.length ?? 0) > 0 ? (
          <HubTile to={`/office/services/${sid}/communes`} icon="communes" title={t('contentKind_commune_list')} />
        ) : null}
        {hub?.accessLevel === 'manage' ? (
          <HubTile to={`/office/services/${sid}/config`} icon="config" title={t('serviceConfig')} />
        ) : null}
      </div>
      {!Object.values(kinds).some((v: any) => v?.length) ? <p className="muted">{t('noResults')}</p> : null}
    </div>
  )
}

export function OfficeDocumentsPage({ token, contentKind = 'document_compose' }: Props & { contentKind?: string }) {
  const { serviceId } = useParams()
  const sid = Number(serviceId)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)

  const load = useCallback(async () => {
    if (!sid) return
    try {
      setData(await api.getDocumentList(token, sid, contentKind))
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [token, sid, contentKind, snack, t])

  useEffect(() => {
    load()
  }, [load])

  async function createDoc(typeId: number) {
    try {
      const res = await api.createDocument(token, sid, typeId)
      navigate(`/office/rapports/${res.rapport.id}/document`)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  const canEdit = data?.accessLevel === 'manage'

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>
          {data?.service ? (i18n.language === 'fr' ? data.service.name_fr : data.service.name_ar) : t('navRapports')}
          {contentKind === 'fiche_lecture' ? ` — ${t('contentKind_fiche_lecture')}` : ''}
        </h1>
        {data?.accessLevel === 'view' ? <span className="badge">{t('accessView')}</span> : null}
        <BackButton fallbackTo={`/office/services/${sid}`} />
      </div>

      {canEdit ? (
        <div className="section">
          <h2>{t('createRapport')}</h2>
          <div className="hubGrid">
            {(data?.documentTypes || []).map((dt: any) => (
              <HubTile
                key={dt.id}
                icon="create"
                title={i18n.language === 'fr' ? dt.name_fr : dt.name_ar}
                onClick={() => createDoc(dt.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="section">
        <h2>{t('navRapports')}</h2>
        <div className="card tableWrap">
          <table>
            <thead>
              <tr>
                <th>{t('rapportTitle')}</th>
                <th>{t('rapportStatus')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rapports || []).map((r: any) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td>{r.status}</td>
                  <td>
                    <Link className="btn btn-ghost" to={`/office/rapports/${r.id}/document`}>
                      {canEdit ? t('edit') : t('details')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export function OfficeDocumentEditorPage({ token }: Props) {
  const { rapportId } = useParams()
  const rid = Number(rapportId)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const navigate = useNavigate()
  const [rapport, setRapport] = useState<any>(null)
  const [blocks, setBlocks] = useState<any[]>([])
  const [canEdit, setCanEdit] = useState(true)
  const [files, setFiles] = useState<Record<number, MediaFile>>({})
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])

  useEffect(() => {
    if (!rid) return
    api.getRapport(token, rid).then((r) => {
      setRapport(r.rapport)
      setCanEdit(r.accessLevel === 'manage')
      setBlocks(r.rapport?.currentVersion?.data_json?.blocks || r.rapport?.versions?.[0]?.data_json?.blocks || [])
    }).catch(() => snack.show(t('errorGeneric'), 'error'))
    api.getCalendarEvents(token, rid).then((r) => setCalendarEvents(r.events || [])).catch(() => {})
    api.getRapportMediaFiles(token, rid).then((r) => setFiles(r.files || {})).catch(() => {})
  }, [rid, token, snack, t])

  async function save() {
    try {
      await api.saveDocument(token, rid, blocks)
      await api.saveCalendarEvents(token, rid, calendarEvents)
      snack.show(t('save'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function submit() {
    try {
      await api.submitRapport(token, rid)
      snack.show(t('submitRapport'), 'success')
      navigate('/office/services')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  function updateBlock(i: number, patch: Record<string, unknown>) {
    setBlocks((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)))
  }

  function addParagraph() {
    setBlocks((prev) => [...prev, { type: 'paragraph', text_ar: '', text_fr: '' }])
  }

  function addMediaRow() {
    setBlocks((prev) => [...prev, { type: 'media_row', items: [] }])
  }

  const editable = canEdit && rapport && ['draft', 'changes_requested'].includes(rapport.status)

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{rapport?.title || t('navRapports')}</h1>
        {!canEdit ? <span className="badge">{t('accessView')}</span> : null}
        {editable ? (
          <>
            <button type="button" className="btn btn-primary" onClick={save}>
              {t('save')}
            </button>
            <button type="button" className="btn btn-accent" onClick={submit}>
              {t('submitRapport')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={addParagraph}>
              {t('addParagraph')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={addMediaRow}>
              {t('addMediaRow')}
            </button>
          </>
        ) : null}
        <RapportExportButtons token={token} rapportId={rid} />
        <BackButton fallbackTo="/office/services" />
      </div>

      <div className="documentPreview">
        {blocks.map((block, i) => {
          if (block.type === 'media_row') {
            return (
              <div key={i} className="docBlock docBlock-media_row">
                <MediaRowsEditor
                  rows={[{ items: block.items || [] }]}
                  files={files}
                  token={token}
                  editable={!!editable}
                  maxRows={1}
                  onChange={(rows) => updateBlock(i, { items: rows[0]?.items || [] })}
                  onUpload={async (file) => {
                    const res = await api.uploadRapportFile(token, rid, file)
                    setFiles((prev) => ({ ...prev, [res.file.id]: res.file }))
                    return res.file
                  }}
                />
              </div>
            )
          }
          return (
          <div
            key={i}
            className={`docBlock docBlock-${block.type}`}
            style={{ textAlign: block.align === 'center' ? 'center' : 'start' }}
          >
            {block.type === 'heading' ? (
              editable ? (
                <input
                  className="docHeading"
                  value={blockText(block, i18n.language)}
                  onChange={(e) =>
                    updateBlock(i, i18n.language === 'fr' ? { text_fr: e.target.value } : { text_ar: e.target.value })
                  }
                />
              ) : (
                <h2>{blockText(block, i18n.language)}</h2>
              )
            ) : editable ? (
              <textarea
                rows={4}
                value={blockText(block, i18n.language)}
                onChange={(e) =>
                  updateBlock(i, i18n.language === 'fr' ? { text_fr: e.target.value } : { text_ar: e.target.value })
                }
              />
            ) : (
              <p>{blockText(block, i18n.language)}</p>
            )}
          </div>
          )
        })}
      </div>

      <CalendarEventsEditor events={calendarEvents} editable={!!editable} onChange={setCalendarEvents} />
    </div>
  )
}

export function WaliRapportViewPage({ token }: Props) {
  const { rapportId } = useParams()
  const rid = Number(rapportId)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const form = useZodForm(waliRespondSchema)
  const [view, setView] = useState<any>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [respondOpen, setRespondOpen] = useState(false)
  const [decision, setDecision] = useState<'accepted' | 'changes_requested' | 'viewed'>('accepted')
  const [bodyText, setBodyText] = useState('')

  const load = useCallback(async () => {
    if (!rid) return
    try {
      setView(await api.getWaliRapportView(token, rid, showHidden))
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [token, rid, showHidden, snack, t])

  useEffect(() => {
    load()
  }, [load])

  async function sendResponse() {
    const payload = { decision, body_text: bodyText || undefined }
    if (!form.validate(payload, t, decision === 'changes_requested' ? ['body_text'] : [])) return
    try {
      await api.waliRespond(token, rid, payload)
      setRespondOpen(false)
      load()
    } catch (e) {
      if (e instanceof api.ApiError && e.fieldErrors) form.setFieldErrorsFromApi(e.fieldErrors)
      snack.show(t('errorGeneric'), 'error')
    }
  }

  const columns: Column[] = view?.schema?.columns || []
  const layoutJson: LayoutJson | null = view?.schema?.layout_json || null
  const tableMeta: TableMeta = view?.tableMeta || {}

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{view?.rapport?.title || t('navInbox')}</h1>
        <button type="button" className="btn btn-primary" onClick={() => setRespondOpen(true)}>
          {t('respondRapport')}
        </button>
        {view?.content_kind === 'table_grid' ? (
          <button type="button" className="btn btn-secondary" onClick={() => setShowHidden((v) => !v)}>
            {showHidden ? t('hideHiddenRows') : t('showHiddenRows')}
          </button>
        ) : null}
        <RapportExportButtons token={token} rapportId={rid} wali showHidden={showHidden} />
        <BackButton fallbackTo="/wali/rapports" />
      </div>

      {view?.content_kind === 'table_grid' ? (
        <div className="card tableWrap excelTable">
          <TableTitleBlock tableMeta={tableMeta} editable={false} />
          <TableGridView
            columns={columns}
            rows={view.rows || []}
            layoutJson={layoutJson}
            tableMeta={tableMeta}
            editable={false}
          />
          <MediaRowsView rows={view.media_rows || []} files={view.files || {}} token={token} />
        </div>
      ) : view?.content_kind === 'commune_list' ? (
        <div className="communeLayout">
          <aside className="communeList card">
            <h2>{t('navMunicipalities')}</h2>
            <ul>
              {(view.municipalities || []).map((m: any) => {
                const rows = view.communes?.[m.code]?.rows || []
                if (!rows.length) return null
                return (
                  <li key={m.code}>
                    <strong>{i18n.language === 'fr' ? m.name_fr : m.name_ar}</strong>
                    <div className="tableWrap excelTable">
                      <table>
                        <tbody>
                          {rows.map((row: any, idx: number) => (
                            <tr key={idx}>
                              {columns.map((c) => (
                                <td key={c.key}>{formatCell(row[c.key], c, i18n.language)}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </li>
                )
              })}
            </ul>
          </aside>
        </div>
      ) : (
        <div className="documentPreview">
          <DocumentBlocksView blocks={view?.blocks || []} files={view?.files || {}} token={token} />
        </div>
      )}

      <CalendarEventsView events={view?.calendarEvents || []} />

      {(view?.waliResponses || []).length ? (
        <div className="section">
          <h2>{t('waliResponseText')}</h2>
          {view.waliResponses.map((w: any) => (
            <div key={w.id} className="waliNote">
              <strong>{w.decision}</strong>
              <p>{w.body_text}</p>
            </div>
          ))}
        </div>
      ) : null}

      {respondOpen ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{t('respondRapport')}</h2>
            <label>
              {t('waliDecision')}
              <select value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
                <option value="accepted">{t('waliAccepted')}</option>
                <option value="changes_requested">{t('waliChangesRequested')}</option>
                <option value="viewed">{t('waliViewed')}</option>
              </select>
            </label>
            <label>
              {t('waliResponseText')}
              <textarea
                id="body_text"
                className={form.hasFieldError('body_text') ? 'inputInvalid' : ''}
                rows={5}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
              />
              <FieldErrorText text={form.fieldErrorText('body_text', t)} />
            </label>
            <FormErrorBlock message={form.formError} />
            <div className="modalActions">
              <button type="button" className="btn btn-primary" onClick={sendResponse}>
                {t('save')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setRespondOpen(false)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function OfficeFichesPage({ token }: Props) {
  return <OfficeDocumentsPage token={token} contentKind="fiche_lecture" />
}
