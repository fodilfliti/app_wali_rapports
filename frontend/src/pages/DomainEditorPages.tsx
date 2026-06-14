import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { ApiError } from '../api'
import { DocumentTemplatePickModal } from '../components/DocumentTemplatePickModal'
import { BackButton } from '../components/BackButton'
import { WaliRespondModal } from '../components/WaliRespondModal'
import { WaliResponsesSection } from '../components/WaliResponsesSection'
import { TableGridView, TableMergeToolbar, TableWorkspace, TableTitleBlock } from '../components/TableGridView'
import { emptyRowsForColumns } from '../types/embeddedTable'
import { countFinishedRows, type TableRowFilterMode } from '../utils/tableRowMeta'
import { useSnackbar } from '../snackbar/SnackbarContext'
import type { Column, LayoutJson, TableMeta } from '../utils/tableLayout'
import { CalendarEventsEditor, CalendarEventsView, type CalendarEvent } from '../components/CalendarEventsEditor'
import { DocumentBlocksView, MediaRowsEditor, MediaRowsView } from '../components/MediaBlocks'
import { RichDocumentEditor, RichDocumentView } from '../components/RichDocumentEditor'
import { RapportExportButtons } from '../components/ExportPdfButton'
import { RapportTitleField, patchRapportTitle } from '../components/RapportTitleField'
import { TablePagination } from '../components/TablePagination'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import { HubTile } from '../components/HubTile'
import { ServiceRapportTypesHub } from '../components/ServiceRapportTypesHub'
import { ServiceContentKindsHub } from '../components/ServiceContentKindsHub'
import {
  isDirectWorkspaceKind,
  localizedRapportTypeName,
  officeRapportTypeListPath,
  officeRapportTypeWorkspacePath,
  rapportTypesForContentKind,
} from '../utils/rapportNavigation'
import { notifyHubCountsRefresh, HUB_COUNTS_REFRESH_EVENT } from '../utils/hubCountsRefresh'
import { markOfficeRapportOpened } from '../utils/officeRapportList'
import type { MediaFile, MediaRow } from '../utils/media'

type Props = { token: string }

export function OfficeTableGridPage({ token }: Props) {
  const { serviceId } = useParams()
  const [searchParams] = useSearchParams()
  const rapportTypeId = searchParams.get('rapport_type_id') ? Number(searchParams.get('rapport_type_id')) : undefined
  const rapportId = searchParams.get('rapport_id') ? Number(searchParams.get('rapport_id')) : undefined
  const sid = Number(serviceId)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const navigate = useNavigate()
  const [workspace, setWorkspace] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([])
  const [mediaFiles, setMediaFiles] = useState<Record<number, MediaFile>>({})
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [title, setTitle] = useState('')
  const [tableMeta, setTableMeta] = useState<TableMeta>({})
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [versionPreview, setVersionPreview] = useState<any>(null)
  const [versionPage, setVersionPage] = useState(1)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [rowFilterMode, setRowFilterMode] = useState<TableRowFilterMode>('active')

  const load = useCallback(async () => {
    if (!sid) return
    setLoading(true)
    setLoadError(null)
    try {
      const ws = await api.getTableWorkspace(token, sid, { rapportTypeId, rapportId })
      setWorkspace(ws)
      setTitle(ws.rapport?.title || '')
      const table = ws.tableData?.tables?.[0] || {}
      setRows(table.rows || [])
      setMediaRows(table.media_rows || [])
      if (ws.rapport?.id) {
        void markOfficeRapportOpened(token, ws.rapport.id)
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
    } catch (e) {
      setWorkspace(null)
      const msg = e instanceof ApiError ? e.message : 'errorGeneric'
      setLoadError(msg)
      snack.show(t(msg, { defaultValue: t('errorGeneric') }), 'error')
    } finally {
      setLoading(false)
    }
  }, [token, sid, rapportTypeId, rapportId, snack, t])

  useEffect(() => {
    load()
  }, [load])

  const pageTitle = workspace?.rapportType
    ? localizedRapportTypeName(workspace.rapportType, i18n.language)
    : workspace?.service
      ? i18n.language === 'fr'
        ? workspace.service.name_fr
        : workspace.service.name_ar
      : t('navRapports')

  async function saveForPreview() {
    if (!workspace?.rapport?.id) return
    const patched = await patchRapportTitle(token, workspace.rapport.id, title)
    setTitle(patched.title)
    await api.saveTableData(token, workspace.rapport.id, {
      rows,
      table_key: 'main',
      media_rows: mediaRows,
      ...tableMeta,
    })
    await api.saveCalendarEvents(token, workspace.rapport.id, calendarEvents)
  }

  async function save() {
    if (!workspace?.rapport?.id) return
    setSaving(true)
    try {
      await saveForPreview()
      snack.show(t('save'), 'success')
      load()
    } catch (e) {
      const msg = e instanceof Error && e.message === 'rapportTitleRequired' ? 'rapportTitleRequired' : 'errorGeneric'
      snack.show(t(msg), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function submit() {
    if (!workspace?.rapport?.id) return
    try {
      await saveForPreview()
      await api.submitRapport(token, workspace.rapport.id)
      notifyHubCountsRefresh()
      snack.show(t('submitRapport'), 'success')
      navigate('/office/rapports')
    } catch (e) {
      const msg = e instanceof Error && e.message === 'rapportTitleRequired' ? 'rapportTitleRequired' : 'errorGeneric'
      snack.show(t(msg), 'error')
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
  const versionRows = workspace?.versions || []
  const pagedVersions = paginateSlice(versionRows, versionPage, DEFAULT_PAGE_SIZE)
  const finishedRowCount = countFinishedRows(rows)

  function updateRow(idx: number, key: string, value: unknown) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)))
  }

  function updateCellColor(rowIdx: number, colKey: string, color: string | null) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r
        const cellColors = { ...((r._cell_colors as Record<string, string>) || {}) }
        if (!color || color === 'none') delete cellColors[colKey]
        else cellColors[colKey] = color
        return { ...r, _cell_colors: cellColors }
      }),
    )
  }

  function setAllWaliVisible(visible: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, _wali_visible: visible })))
  }

  function addRow() {
    setRows((prev) => [...prev, ...emptyRowsForColumns(columns, 1)])
  }

  function deleteRow(idx: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev))
  }

  return (
    <div className="page">
      <div className="pageHeader row compact">
        <RapportTitleField
          title={title}
          onChange={setTitle}
          editable={!!editable}
          fallback={pageTitle}
        />
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
        <button type="button" className="btn btn-secondary" onClick={() => {
          setVersionPage(1)
          setVersionsOpen(true)
        }}>
          {t('archivedVersions')}
        </button>
        {workspace?.rapport?.id ? (
          <RapportExportButtons token={token} rapportId={workspace.rapport.id} onPreparePreview={saveForPreview} />
        ) : null}
        <BackButton fallbackTo={`/office/services/${sid}`} />
      </div>

      {loading ? <p className="muted communeStatus">{t('loading')}</p> : null}
      {loadError ? (
        <div className="communeError card">
          <p>{loadError === 'tableSchemaNotConfigured' ? t('tableSchemaNotConfigured') : t('tableWorkspaceError')}</p>
          {loadError === 'tableSchemaNotConfigured' ? (
            <Link className="btn btn-primary" to={`/office/services/${sid}/config`}>
              {t('goToServiceConfig')}
            </Link>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={load}>
              {t('refresh')}
            </button>
          )}
        </div>
      ) : null}

      {!loading && !loadError ? (
        <>
      <TableTitleBlock
        tableMeta={tableMeta}
        editable={editable}
        onTableMetaChange={(patch) => setTableMeta((prev) => ({ ...prev, ...patch }))}
      />

      <TableWorkspace
        columns={columns}
        rows={rows}
        layoutJson={layoutJson}
        tableMeta={tableMeta}
        editable={editable}
        showRowMeta
        onUpdateRow={updateRow}
        onSetAllWaliVisible={setAllWaliVisible}
        onUpdateCellColor={updateCellColor}
        onDeleteRow={editable ? deleteRow : undefined}
        rowCount={rows.length}
        finishedCount={finishedRowCount}
        filterMode={rowFilterMode}
        onFilterModeChange={setRowFilterMode}
        onAddRow={addRow}
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

      <WaliResponsesSection responses={workspace?.rapport?.waliResponses || []} />
        </>
      ) : null}

      {versionsOpen ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{t('archivedVersions')}</h2>
            <ul className="versionList">
              {pagedVersions.map((v: any) => (
                <li key={v.id}>
                  <button type="button" className="btn btn-ghost" onClick={() => openVersion(v.id)}>
                    v{v.version_number} — {v.submitted_at ? new Date(v.submitted_at).toLocaleString() : t('statusDraft')}
                  </button>
                </li>
              ))}
            </ul>
            <TablePagination
              page={versionPage}
              total={versionRows.length}
              onPageChange={setVersionPage}
              compact
            />
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
                    showRowMeta
                    rowFilterMode="all"
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
  const [hub, setHub] = useState<any>(null)

  const loadHub = useCallback(() => {
    if (!sid) return
    api.getServiceContentHub(token, sid).then(setHub).catch(() => {})
  }, [sid, token])

  useEffect(() => {
    loadHub()
  }, [loadHub])

  useEffect(() => {
    window.addEventListener(HUB_COUNTS_REFRESH_EVENT, loadHub)
    return () => window.removeEventListener(HUB_COUNTS_REFRESH_EVENT, loadHub)
  }, [loadHub])

  if (!hub?.service) {
    return (
      <div className="page">
        <p className="muted">…</p>
      </div>
    )
  }

  return (
    <ServiceContentKindsHub
      service={hub.service}
      summaries={hub.contentKindSummaries || []}
      contentKinds={hub.contentKinds}
      accessLevel={hub.accessLevel}
      backTo="/office/services"
      rapportTypePath={(rt) =>
        isDirectWorkspaceKind(rt.content_kind)
          ? officeRapportTypeWorkspacePath(sid, rt)
          : officeRapportTypeListPath(sid, rt.id)
      }
      mode="office"
      showConfig={hub.accessLevel === 'manage'}
    />
  )
}

export function OfficeServiceKindRapportTypesPage({ token }: Props) {
  const { serviceId, contentKind } = useParams()
  const sid = Number(serviceId)
  const kind = contentKind || ''
  const { t } = useTranslation()
  const [hub, setHub] = useState<any>(null)

  const loadHub = useCallback(() => {
    if (!sid) return
    api.getServiceContentHub(token, sid).then(setHub).catch(() => {})
  }, [sid, token])

  useEffect(() => {
    loadHub()
  }, [loadHub])

  useEffect(() => {
    window.addEventListener(HUB_COUNTS_REFRESH_EVENT, loadHub)
    return () => window.removeEventListener(HUB_COUNTS_REFRESH_EVENT, loadHub)
  }, [loadHub])

  if (!hub?.service) {
    return (
      <div className="page">
        <p className="muted">…</p>
      </div>
    )
  }

  const types = rapportTypesForContentKind(hub, kind)

  return (
    <ServiceRapportTypesHub
      service={hub.service}
      rapportTypes={types}
      accessLevel={hub.accessLevel}
      backTo={`/office/services/${sid}`}
      mode="office"
      showConfig={hub.accessLevel === 'manage'}
      pageTitle={t(`contentKind_${kind}`, { defaultValue: kind })}
    />
  )
}

export function OfficeDocumentsPage({ token, contentKind = 'document_compose' }: Props & { contentKind?: string }) {
  const { serviceId } = useParams()
  const [searchParams] = useSearchParams()
  const rapportTypeId = searchParams.get('rapport_type_id') ? Number(searchParams.get('rapport_type_id')) : undefined
  const sid = Number(serviceId)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const navigate = useNavigate()
  const [data, setData] = useState<any>(null)
  const [createPickOpen, setCreatePickOpen] = useState(false)
  const [importFor, setImportFor] = useState<{ rapportId: number; typeId: number } | null>(null)
  const [listPage, setListPage] = useState(1)
  const [listTotal, setListTotal] = useState(0)

  useEffect(() => {
    setListPage(1)
  }, [sid, contentKind, rapportTypeId])

  const load = useCallback(async () => {
    if (!sid) return
    try {
      const res = await api.getDocumentList(
        token,
        sid,
        rapportTypeId
          ? { rapportTypeId, page: listPage, pageSize: DEFAULT_PAGE_SIZE }
          : { contentKind, page: listPage, pageSize: DEFAULT_PAGE_SIZE },
      )
      setData(res)
      setListTotal(res.total ?? res.rapports?.length ?? 0)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [token, sid, contentKind, rapportTypeId, listPage, snack, t])

  useEffect(() => {
    load()
  }, [load])

  async function createDoc(typeId: number, templateId: number | null, skipDefault = false) {
    try {
      const res = await api.createDocument(token, sid, typeId, {
        templateId,
        skipDefault: templateId == null && skipDefault,
      })
      navigate(`/office/rapports/${res.rapport.id}/document`)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  const canEdit = data?.accessLevel === 'manage'
  const activeType = data?.documentTypes?.[0]
  const pageTitle = activeType
    ? localizedRapportTypeName(activeType, i18n.language)
    : data?.service
      ? i18n.language === 'fr'
        ? data.service.name_fr
        : data.service.name_ar
      : t('navRapports')

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{pageTitle}</h1>
        {data?.accessLevel === 'view' ? <span className="badge">{t('accessView')}</span> : null}
        <BackButton fallbackTo={`/office/services/${sid}`} />
      </div>

      {canEdit && activeType ? (
        <div className="section">
          <button type="button" className="btn btn-primary" onClick={() => setCreatePickOpen(true)}>
            {t('createRapport')}
          </button>
        </div>
      ) : null}

      {createPickOpen && activeType ? (
        <DocumentTemplatePickModal
          token={token}
          serviceId={sid}
          rapportTypeId={activeType.id}
          open={createPickOpen}
          mode="create"
          onClose={() => setCreatePickOpen(false)}
          onSelect={(templateId) => {
            setCreatePickOpen(false)
            createDoc(activeType.id, templateId, templateId == null)
          }}
        />
      ) : null}

      {importFor ? (
        <DocumentTemplatePickModal
          token={token}
          serviceId={sid}
          rapportTypeId={importFor.typeId}
          open={!!importFor}
          mode="import"
          onClose={() => setImportFor(null)}
          onSelect={async (templateId, mode) => {
            if (!templateId || !importFor) return
            const { rapportId } = importFor
            setImportFor(null)
            try {
              await api.applyDocumentTemplate(token, rapportId, templateId, mode || 'replace')
              snack.show(t('documentTemplateImported'), 'success')
              load()
            } catch {
              snack.show(t('errorGeneric'), 'error')
            }
          }}
        />
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
                    {canEdit && ['draft', 'changes_requested'].includes(r.status) ? (
                      <>
                        {' '}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setImportFor({ rapportId: r.id, typeId: r.rapport_type_id || activeType?.id })
                          }
                        >
                          {t('documentTemplateImport')}
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!data?.rapports?.length ? (
                <tr>
                  <td colSpan={3} className="muted">
                    {t('noResults')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={listPage}
          total={listTotal}
          pageSize={DEFAULT_PAGE_SIZE}
          onPageChange={setListPage}
        />
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
  const [title, setTitle] = useState('')
  const [docData, setDocData] = useState<{
    rich_html_ar?: string
    rich_html_fr?: string
    blocks?: any[]
    embedded_tables?: import('../types/embeddedTable').EmbeddedTable[]
  }>({})
  const [embeddedTables, setEmbeddedTables] = useState<import('../types/embeddedTable').EmbeddedTable[]>([])
  const [canEdit, setCanEdit] = useState(true)
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([])
  const [importPickOpen, setImportPickOpen] = useState(false)
  const [waliResponses, setWaliResponses] = useState<any[]>([])

  useEffect(() => {
    if (!rid) return
    void markOfficeRapportOpened(token, rid)
    api.getRapport(token, rid).then((r) => {
      setRapport(r.rapport)
      setTitle(r.rapport?.title || '')
      setCanEdit(r.accessLevel === 'manage')
      setWaliResponses(r.rapport?.waliResponses || [])
      const dj = r.rapport?.currentVersion?.data_json || r.rapport?.versions?.[0]?.data_json || {}
      const tables = dj.embedded_tables || []
      setDocData({
        rich_html_ar: dj.rich_html_ar,
        rich_html_fr: dj.rich_html_fr,
        blocks: dj.blocks,
        embedded_tables: tables,
      })
      setEmbeddedTables(tables)
    }).catch(() => snack.show(t('errorGeneric'), 'error'))
    api.getCalendarEvents(token, rid).then((r) => setCalendarEvents(r.events || [])).catch(() => {})
  }, [rid, token, snack, t])

  async function saveForPreview() {
    const patched = await patchRapportTitle(token, rid, title)
    setTitle(patched.title)
    setRapport(patched.rapport)
    await api.saveDocument(token, rid, {
      rich_html_ar: docData.rich_html_ar,
      rich_html_fr: docData.rich_html_fr,
      blocks: docData.blocks,
      embedded_tables: embeddedTables,
    })
    await api.saveCalendarEvents(token, rid, calendarEvents)
  }

  async function save() {
    try {
      await saveForPreview()
      snack.show(t('save'), 'success')
    } catch (e) {
      const msg = e instanceof Error && e.message === 'rapportTitleRequired' ? 'rapportTitleRequired' : 'errorGeneric'
      snack.show(t(msg), 'error')
    }
  }

  async function submit() {
    try {
      await saveForPreview()
      await api.submitRapport(token, rid)
      notifyHubCountsRefresh()
      snack.show(t('submitRapport'), 'success')
      navigate('/office/services')
    } catch (e) {
      const msg = e instanceof Error && e.message === 'rapportTitleRequired' ? 'rapportTitleRequired' : 'errorGeneric'
      snack.show(t(msg), 'error')
    }
  }

  async function importTemplate(templateId: number, mode: 'replace' | 'append') {
    try {
      const res = await api.applyDocumentTemplate(token, rid, templateId, mode)
      const dj = res.rapport?.currentVersion?.data_json || {}
      const tables = dj.embedded_tables || []
      setDocData({
        rich_html_ar: dj.rich_html_ar,
        rich_html_fr: dj.rich_html_fr,
        blocks: dj.blocks,
        embedded_tables: tables,
      })
      setEmbeddedTables(tables)
      snack.show(t('documentTemplateImported'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  const editable = canEdit && rapport && ['draft', 'changes_requested'].includes(rapport.status)

  return (
    <div className="page">
      <div className="pageHeader row compact">
        <RapportTitleField
          title={title}
          onChange={setTitle}
          editable={!!editable}
          fallback={t('navRapports')}
        />
        {!canEdit ? <span className="badge">{t('accessView')}</span> : null}
        {editable ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setImportPickOpen(true)}>
              {t('documentTemplateImport')}
            </button>
            <button type="button" className="btn btn-primary" onClick={save}>
              {t('save')}
            </button>
            <button type="button" className="btn btn-accent" onClick={submit}>
              {t('submitRapport')}
            </button>
          </>
        ) : null}
        <RapportExportButtons token={token} rapportId={rid} onPreparePreview={editable ? saveForPreview : undefined} />
        <BackButton fallbackTo="/office/services" />
      </div>

      {editable ? (
        <RichDocumentEditor
          data={{ ...docData, embedded_tables: embeddedTables }}
          editable
          token={token}
          rapportId={rid}
          serviceId={rapport?.service_id}
          onEmbeddedTablesChange={setEmbeddedTables}
          onChange={(locale, html) =>
            setDocData((prev) => ({
              ...prev,
              ...(locale === 'fr' ? { rich_html_fr: html } : { rich_html_ar: html }),
            }))
          }
        />
      ) : (
        <RichDocumentView
          data={docData}
          locale={i18n.language}
          token={token}
          serviceId={rapport?.service_id}
        />
      )}

      {importPickOpen && rapport?.service_id && rapport?.rapport_type_id ? (
        <DocumentTemplatePickModal
          token={token}
          serviceId={Number(rapport.service_id)}
          rapportTypeId={Number(rapport.rapport_type_id)}
          open={importPickOpen}
          mode="import"
          onClose={() => setImportPickOpen(false)}
          onSelect={(templateId, mode) => {
            setImportPickOpen(false)
            if (templateId) importTemplate(templateId, mode || 'replace')
          }}
        />
      ) : null}

      <CalendarEventsEditor events={calendarEvents} editable={!!editable} onChange={setCalendarEvents} />

      <WaliResponsesSection responses={waliResponses} />
    </div>
  )
}

export function WaliRapportViewPage({ token }: Props) {
  const { rapportId } = useParams()
  const rid = Number(rapportId)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [view, setView] = useState<any>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [respondOpen, setRespondOpen] = useState(false)
  const [waliCommuneCode, setWaliCommuneCode] = useState<string | null>(null)
  const [waliCommunePage, setWaliCommunePage] = useState(1)

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

  async function sendResponse(payload: {
    decision: string
    follow_up_status?: string
    body_text?: string
  }) {
    try {
      await api.waliRespond(token, rid, payload)
      notifyHubCountsRefresh()
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
      throw new Error('respond failed')
    }
  }

  const columns: Column[] = view?.schema?.columns || []
  const layoutJson: LayoutJson | null = view?.schema?.layout_json || null
  const tableMeta: TableMeta = view?.tableMeta || {}

  const waliCommunesWithData = (view?.municipalities || []).filter((m: any) => {
    const entry = view?.communes?.[m.code]
    if (!entry) return false
    if (entry.rich_html_ar || entry.rich_html_fr) return true
    if (entry.blocks?.length) return true
    return (entry.rows || []).length > 0
  })
  const waliSelected =
    waliCommunesWithData.find((m: any) => m.code === (waliCommuneCode || waliCommunesWithData[0]?.code)) || null
  const waliCommuneEntry = waliSelected ? view?.communes?.[waliSelected.code] : null
  const pagedWaliCommunes = paginateSlice(waliCommunesWithData, waliCommunePage, DEFAULT_PAGE_SIZE)
  const waliResponses = view?.waliResponses || []

  useEffect(() => {
    setWaliCommunePage(1)
  }, [rid, waliCommunesWithData.length, waliResponses.length])

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
        <>
          <p className="muted communeListIntro">{t('communeListIntro')}</p>
          <div className="hubGrid communeHubGrid">
            {pagedWaliCommunes.map((m: any) => (
              <HubTile
                key={m.code}
                icon="communes"
                title={i18n.language === 'fr' ? m.name_fr : m.name_ar}
                subtitle={t('communeFilled')}
                className={waliSelected?.code === m.code ? 'communeHubTileFilled' : ''}
                onClick={() => setWaliCommuneCode(m.code)}
              />
            ))}
          </div>
          <TablePagination
            page={waliCommunePage}
            total={waliCommunesWithData.length}
            onPageChange={setWaliCommunePage}
          />
          {waliSelected && waliCommuneEntry ? (
            <div className="card communeWaliPanel">
              <h2 className="communeWaliPanelTitle">
                {i18n.language === 'fr' ? waliSelected.name_fr : waliSelected.name_ar}
              </h2>
              <RichDocumentView
                data={{
                  rich_html_ar: waliCommuneEntry.rich_html_ar,
                  rich_html_fr: waliCommuneEntry.rich_html_fr,
                  blocks: waliCommuneEntry.blocks,
                  embedded_tables: waliCommuneEntry.embedded_tables,
                }}
                locale={i18n.language}
                token={token}
                serviceId={view?.rapport?.service_id}
              />
              {!waliCommuneEntry.rich_html_ar && !waliCommuneEntry.rich_html_fr && waliCommuneEntry.blocks?.length ? (
                <DocumentBlocksView blocks={waliCommuneEntry.blocks} files={view?.files || {}} token={token} />
              ) : null}
              {(waliCommuneEntry.rows || []).length ? (
                <div className="tableWrap excelTable">
                  <TableGridView
                    columns={columns}
                    rows={waliCommuneEntry.rows || []}
                    layoutJson={layoutJson}
                    editable={false}
                  />
                </div>
              ) : null}
              {(waliCommuneEntry.calendar_events || []).length ? (
                <CalendarEventsView events={waliCommuneEntry.calendar_events} />
              ) : null}
            </div>
          ) : (
            <p className="muted communeEmptyHint">{t('noResults')}</p>
          )}
        </>
      ) : (
        <>
          <RichDocumentView
            data={{
              rich_html_ar: view?.rapport?.currentVersion?.data_json?.rich_html_ar,
              rich_html_fr: view?.rapport?.currentVersion?.data_json?.rich_html_fr,
              blocks: view?.blocks,
              embedded_tables: view?.rapport?.currentVersion?.data_json?.embedded_tables,
            }}
            locale={i18n.language}
            token={token}
            serviceId={view?.rapport?.service_id}
          />
          {!view?.rapport?.currentVersion?.data_json?.rich_html_ar &&
          !view?.rapport?.currentVersion?.data_json?.rich_html_fr ? (
            <div className="documentPreview">
              <DocumentBlocksView blocks={view?.blocks || []} files={view?.files || {}} token={token} />
            </div>
          ) : null}
        </>
      )}

      <CalendarEventsView events={view?.calendarEvents || []} />

      <WaliResponsesSection responses={waliResponses} />

      <WaliRespondModal open={respondOpen} onClose={() => setRespondOpen(false)} onSubmit={sendResponse} />
    </div>
  )
}

export function OfficeFichesPage({ token }: Props) {
  return <OfficeDocumentsPage token={token} contentKind="fiche_lecture" />
}
