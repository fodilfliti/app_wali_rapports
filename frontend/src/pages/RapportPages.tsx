import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { RapportListScopeFilter } from '../components/RapportListScopeFilter'
import { RapportTypeHideActions } from '../components/RapportTypeHideActions'
import { RapportRowHideActions } from '../components/RapportRowHideActions'
import { ConfirmActionModal } from '../components/ConfirmActionModal'
import { DocumentTemplatePickModal } from '../components/DocumentTemplatePickModal'
import { TablePagination } from '../components/TablePagination'
import { WaliRespondModal } from '../components/WaliRespondModal'
import { useSnackbar } from '../snackbar/SnackbarContext'
import {
  canOfficeEditRapport,
  isDirectWorkspaceKind,
  localizedRapportTypeName,
  officeContentKindPath,
  officeRapportTypeWorkspacePath,
  officeRapportWorkspacePath,
  type RapportTypeNav,
} from '../utils/rapportNavigation'
import {
  markOfficeRapportOpened,
  patchRapportUnread,
  rapportNeedsAttention,
  rapportStatusLabel,
  waliCommentPreview,
  waliResponseLabel,
} from '../utils/officeRapportList'
import { waliInboxRowClass } from '../utils/waliInboxList'
import { notifyHubCountsRefresh } from '../utils/hubCountsRefresh'
import { localizedName } from '../utils/schemaColumns'
import { RapportExportButtons } from '../components/ExportPdfButton'
import { DEFAULT_PAGE_SIZE } from '../utils/pagination'

type Props = { token: string }

function isDocumentKind(r: any) {
  return ['document_compose', 'fiche_lecture'].includes(r.rapportType?.content_kind)
}

function openOfficeRapport(
  token: string,
  rapportId: number,
  setRows: Dispatch<SetStateAction<any[]>>,
) {
  setRows((prev) => patchRapportUnread(prev, rapportId))
  void markOfficeRapportOpened(token, rapportId)
}

function OfficeRapportTitleCell({ r, t }: { r: any; t: (k: string) => string }) {
  const comment = waliCommentPreview(r)
  return (
    <td className="rapportTitleCell">
      <div className="rapportRowTitleCell">
        <span className="rapportRowTitle">{r.title}</span>
        {r.has_unread_notification ? (
          <span className="badge badge-submitted rapportUnreadBadge">{t('unread')}</span>
        ) : null}
      </div>
      {comment ? (
        <div className="rapportRowDetails">
          <p className="rapportWaliCommentPreview">
            <span className="rapportWaliCommentLabel">{t('waliResponseText')}:</span> {comment}
          </p>
        </div>
      ) : null}
    </td>
  )
}

function OfficeRapportStatusCell({ r, t }: { r: any; t: (k: string) => string }) {
  const waliLabel = waliResponseLabel(r, t)
  const decision = r.latest_wali_response?.decision
  return (
    <td className="rapportStatusCell">
      <div className="rapportStatusStack">
        <span className={`badge badge-${r.status}`}>{rapportStatusLabel(r.status, t)}</span>
        {waliLabel && decision ? (
          <p className="rapportWaliStatusNote muted small">
            {t('waliResponseShort')}:{' '}
            <span className={`badge badge-wali-${decision} rapportWaliDecisionBadge`}>{waliLabel}</span>
          </p>
        ) : null}
      </div>
    </td>
  )
}

export function OfficeRapportsListPage({ token }: Props) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const [params] = useSearchParams()
  const serviceId = params.get('service_id') ? Number(params.get('service_id')) : undefined
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [showHidden, setShowHidden] = useState(false)
  const [importFor, setImportFor] = useState<{ rapportId: number; serviceId: number; typeId: number } | null>(
    null,
  )

  useEffect(() => {
    setPage(1)
  }, [serviceId, showHidden])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const rapportsRes = await api.listOfficeRapports(token, {
        service_id: serviceId,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        hidden_only: showHidden,
      })
      setRows(rapportsRes.rapports)
      setTotal(rapportsRes.total ?? rapportsRes.rapports.length)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setLoading(false)
    }
  }, [token, serviceId, page, showHidden, snack, t])

  useEffect(() => {
    load()
  }, [load])

  async function finishRapport(id: number) {
    try {
      await api.finishRapport(token, id)
      notifyHubCountsRefresh()
      snack.show(t('finishRapportDone'), 'success')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function restoreRapport(id: number) {
    try {
      await api.restoreRapport(token, id)
      notifyHubCountsRefresh()
      snack.show(t('restoreRapportDone'), 'success')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function submit(id: number) {
    try {
      await api.submitRapport(token, id)
      notifyHubCountsRefresh()
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navRapports')}</h1>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          {t('refresh')}
        </button>
        <BackButton fallbackTo="/" />
      </div>

      <div className="rapportListToolbar">
        <RapportListScopeFilter showHidden={showHidden} onChange={setShowHidden} />
      </div>

      {importFor ? (
        <DocumentTemplatePickModal
          token={token}
          serviceId={importFor.serviceId}
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
            {rows.map((r) => (
              <tr
                key={r.id}
                className={
                  rapportNeedsAttention(r)
                    ? `rapportRowAttention${r.has_unread_notification ? ' rapportRowUnread' : ''}`
                    : undefined
                }
              >
                <OfficeRapportTitleCell r={r} t={t} />
                <OfficeRapportStatusCell r={r} t={t} />
                <td className="actionsCell">
                  <div className="actionsCellInner">
                  {officeRapportWorkspacePath(r) ? (
                    <Link
                      className="btn btn-ghost btn-sm"
                      to={officeRapportWorkspacePath(r)!}
                      onClick={() => openOfficeRapport(token, r.id, setRows)}
                    >
                      {canOfficeEditRapport(r.status) ? t('edit') : t('details')}
                    </Link>
                  ) : null}
                  {isDocumentKind(r) &&
                  canOfficeEditRapport(r.status) &&
                  r.service_id &&
                  r.rapport_type_id ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        setImportFor({
                          rapportId: r.id,
                          serviceId: r.service_id,
                          typeId: r.rapport_type_id,
                        })
                      }
                    >
                      {t('documentTemplateImport')}
                    </button>
                  ) : null}
                  {canOfficeEditRapport(r.status) ? (
                    <button type="button" className="btn btn-accent btn-sm" onClick={() => submit(r.id)}>
                      {t('submitRapport')}
                    </button>
                  ) : null}
                  <RapportRowHideActions
                    rapport={r}
                    canManage
                    showHidden={showHidden}
                    onHide={() => finishRapport(r.id)}
                    onRestore={() => restoreRapport(r.id)}
                  />
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={3}>{t('noResults')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} total={total} onPageChange={setPage} />
    </div>
  )
}

export function OfficeServiceRapportListPage({ token }: Props) {
  const { serviceId, rapportTypeId } = useParams()
  const sid = Number(serviceId)
  const typeId = Number(rapportTypeId)
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const navigate = useNavigate()
  const [hub, setHub] = useState<any>(null)
  const [rapportType, setRapportType] = useState<RapportTypeNav | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [createPickOpen, setCreatePickOpen] = useState(false)
  const [importFor, setImportFor] = useState<{ rapportId: number; typeId: number } | null>(null)
  const [showHidden, setShowHidden] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [sid, typeId, showHidden])

  const load = useCallback(async () => {
    if (!sid || !typeId) return
    setLoading(true)
    try {
      const [hubRes, rapportsRes] = await Promise.all([
        api.getServiceContentHub(token, sid),
        api.listOfficeRapports(token, {
          service_id: sid,
          rapport_type_id: typeId,
          page,
          pageSize: DEFAULT_PAGE_SIZE,
          hidden_only: showHidden,
        }),
      ])
      setHub(hubRes)
      const rt =
        hubRes.rapportTypes?.find((x: RapportTypeNav) => Number(x.id) === typeId) || null
      setRapportType(rt)
      setRows(rapportsRes.rapports)
      setTotal(rapportsRes.total ?? rapportsRes.rapports.length)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setLoading(false)
    }
  }, [token, sid, typeId, page, showHidden, snack, t])

  useEffect(() => {
    load()
  }, [load])

  async function finishRapportRow(id: number) {
    try {
      await api.finishRapport(token, id)
      notifyHubCountsRefresh()
      snack.show(t('finishRapportDone'), 'success')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function restoreRapportRow(id: number) {
    try {
      await api.restoreRapport(token, id)
      notifyHubCountsRefresh()
      snack.show(t('restoreRapportDone'), 'success')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function hideTypeFromPage(typeId: number) {
    try {
      await api.hideRapportType(token, typeId)
      notifyHubCountsRefresh()
      snack.show(t('hideRapportTypeDone'), 'success')
      navigate(`/office/services/${sid}`)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function restoreTypeFromPage(typeId: number) {
    try {
      await api.restoreRapportType(token, typeId)
      notifyHubCountsRefresh()
      snack.show(t('restoreRapportTypeDone'), 'success')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function submit(id: number) {
    try {
      await api.submitRapport(token, id)
      notifyHubCountsRefresh()
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function createDoc(templateId: number | null, skipDefault = false) {
    if (!rapportType) return
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

  const canEdit = hub?.accessLevel === 'manage'
  const isDocKind =
    rapportType && ['document_compose', 'fiche_lecture'].includes(rapportType.content_kind)
  const pageTitle = rapportType
    ? localizedRapportTypeName(rapportType, i18n.language)
    : hub?.service
      ? i18n.language === 'fr'
        ? hub.service.name_fr
        : hub.service.name_ar
      : t('navRapports')

  if (loading) {
    return (
      <div className="page">
        <p className="muted">{t('loading')}</p>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <div className="hubPageHeading">
          <h1>{pageTitle}</h1>
          {rapportType ? (
            <p className="muted small hubLevelHint">
              {i18n.language === 'fr' ? hub?.service?.name_fr : hub?.service?.name_ar}
            </p>
          ) : null}
        </div>
        {hub?.accessLevel === 'view' ? <span className="badge">{t('accessView')}</span> : null}
        {canEdit && isDocKind ? (
          <button type="button" className="btn btn-primary" onClick={() => setCreatePickOpen(true)}>
            {t('createRapport')}
          </button>
        ) : null}
        {canEdit && rapportType && isDirectWorkspaceKind(rapportType.content_kind) && !rows.length ? (
          <Link className="btn btn-primary" to={officeRapportTypeWorkspacePath(sid, rapportType)}>
            {t('createRapport')}
          </Link>
        ) : null}
        {canEdit && rapportType ? (
          <div className="pageHeaderActionsMenu">
            <RapportTypeHideActions
              rapportType={rapportType}
              canManage={canEdit}
              onHideType={hideTypeFromPage}
              onRestoreType={restoreTypeFromPage}
              variant="page"
            />
          </div>
        ) : null}
        <BackButton
          fallbackTo={
            rapportType?.content_kind
              ? officeContentKindPath(sid, rapportType.content_kind)
              : `/office/services/${sid}`
          }
        />
      </div>

      <div className="rapportListToolbar">
        <RapportListScopeFilter showHidden={showHidden} onChange={setShowHidden} />
      </div>

      {createPickOpen && rapportType ? (
        <DocumentTemplatePickModal
          token={token}
          serviceId={sid}
          rapportTypeId={typeId}
          open={createPickOpen}
          mode="create"
          onClose={() => setCreatePickOpen(false)}
          onSelect={(templateId) => {
            setCreatePickOpen(false)
            createDoc(templateId, templateId == null)
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
            {rows.map((r) => (
              <tr
                key={r.id}
                className={
                  rapportNeedsAttention(r)
                    ? `rapportRowAttention${r.has_unread_notification ? ' rapportRowUnread' : ''}`
                    : undefined
                }
              >
                <OfficeRapportTitleCell r={r} t={t} />
                <OfficeRapportStatusCell r={r} t={t} />
                <td className="actionsCell">
                  <div className="actionsCellInner">
                  {officeRapportWorkspacePath(r) || (rapportType && officeRapportTypeWorkspacePath(sid, rapportType, r.id)) ? (
                    <Link
                      className="btn btn-ghost btn-sm"
                      to={officeRapportWorkspacePath(r) || officeRapportTypeWorkspacePath(sid, rapportType!, r.id)}
                      onClick={() => openOfficeRapport(token, r.id, setRows)}
                    >
                      {canOfficeEditRapport(r.status) ? t('edit') : t('details')}
                    </Link>
                  ) : null}
                  {isDocumentKind(r) && canOfficeEditRapport(r.status) && canEdit ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        setImportFor({
                          rapportId: r.id,
                          typeId: r.rapport_type_id || typeId,
                        })
                      }
                    >
                      {t('documentTemplateImport')}
                    </button>
                  ) : null}
                  {canOfficeEditRapport(r.status) && canEdit ? (
                    <button type="button" className="btn btn-accent btn-sm" onClick={() => submit(r.id)}>
                      {t('submitRapport')}
                    </button>
                  ) : null}
                  <RapportRowHideActions
                    rapport={r}
                    canManage={canEdit}
                    showHidden={showHidden}
                    onHide={() => finishRapportRow(r.id)}
                    onRestore={() => restoreRapportRow(r.id)}
                  />
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={3}>{t('noResults')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} total={total} onPageChange={setPage} />
    </div>
  )
}

export function WaliRapportsInboxPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [rows, setRows] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [respondId, setRespondId] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.listWaliRapports(token, { page, pageSize: DEFAULT_PAGE_SIZE })
      setRows(res.rapports)
      setTotal(res.total ?? res.rapports.length)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [token, page, snack, t])

  useEffect(() => {
    load()
  }, [load])

  async function sendResponse(payload: {
    decision: string
    follow_up_status?: string
    body_text?: string
  }) {
    if (!respondId) return
    try {
      await api.waliRespond(token, respondId, payload)
      setRespondId(null)
      notifyHubCountsRefresh()
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
      throw new Error('respond failed')
    }
  }

  function serviceLabel(r: any) {
    const svc = r.service
    if (!svc) return '—'
    return i18n.language === 'fr' ? svc.name_fr || svc.name_ar : svc.name_ar || svc.name_fr
  }

  function typeLabel(r: any) {
    const rt = r.rapportType
    if (!rt) return '—'
    return localizedRapportTypeName(rt, i18n.language)
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navInbox')}</h1>
        <button type="button" className="btn btn-secondary" onClick={load}>
          {t('refresh')}
        </button>
        <BackButton fallbackTo="/" />
      </div>

      <div className="waliInboxLegend" aria-hidden="true">
        <span className="waliInboxLegendItem">
          <span className="waliInboxLegendSwatch waliInboxLegendSwatchNew" />
          {t('waliInboxNew')}
        </span>
        <span className="badge badge-submitted">{t('statusSubmitted')}</span>
        <span className="badge badge-under_review">{t('statusUnderReview')}</span>
        <span className="badge badge-acknowledged">{t('statusAcknowledged')}</span>
        <span className="badge badge-changes_requested">{t('statusChangesRequested')}</span>
      </div>

      <div className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>{t('rapportTitle')}</th>
              <th>{t('service')}</th>
              <th>{t('rapportTypes')}</th>
              <th>{t('rapportStatus')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const waliLabel = waliResponseLabel(r, t)
              const decision = r.latest_wali_response?.decision
              return (
                <tr key={r.id} className={waliInboxRowClass(r)}>
                  <td className="rapportTitleCell">
                    <div className="rapportRowTitleCell">
                      <span className="rapportRowTitle">{r.title}</span>
                      {r.is_inbox_new ? (
                        <span className="badge badge-submitted rapportUnreadBadge">{t('waliInboxNew')}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>{serviceLabel(r)}</td>
                  <td>{typeLabel(r)}</td>
                  <td className="rapportStatusCell">
                    <div className="rapportStatusStack">
                      <span className={`badge badge-${r.status}`}>{rapportStatusLabel(r.status, t)}</span>
                      {waliLabel && decision ? (
                        <p className="rapportWaliStatusNote muted small">
                          {t('waliResponseShort')}:{' '}
                          <span className={`badge badge-wali-${decision} rapportWaliDecisionBadge`}>
                            {waliLabel}
                          </span>
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="actionsCell">
                    <div className="actionsCellInner">
                      <Link className="btn btn-ghost" to={`/wali/rapports/${r.id}/view`}>
                        {t('details')}
                      </Link>
                      {r.status === 'submitted' ? (
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => setRespondId(r.id)}
                        >
                          {t('respondRapport')}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={5}>{t('noResults')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} total={total} onPageChange={setPage} />

      <WaliRespondModal open={!!respondId} onClose={() => setRespondId(null)} onSubmit={sendResponse} />
    </div>
  )
}

export function AdminRapportsListPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [rows, setRows] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [search, showHidden])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listAdminRapports(token, {
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        search: search || undefined,
        hidden_only: showHidden,
      })
      setRows(res.rapports)
      setTotal(res.total ?? res.rapports.length)
    } catch {
      snack.show(t('errorGeneric'), 'error')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [token, page, search, showHidden, snack, t])

  useEffect(() => {
    load()
  }, [load])

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
  }

  async function confirmDeleteRapport() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteAdminRapport(token, deleteTarget.id)
      snack.show(t('deleteRapportAdminDone'), 'success')
      setDeleteTarget(null)
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navRapports')}</h1>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          {t('refresh')}
        </button>
        <BackButton fallbackTo="/" />
      </div>

      <form className="rapportListToolbar rapportListSearchForm card" onSubmit={submitSearch}>
        <label className="rapportListSearch">
          <span className="fieldLabel">{t('search')}</span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('rapportTitle')}
          />
        </label>
        <button type="submit" className="btn btn-secondary rapportListSearchBtn">
          {t('search')}
        </button>
        <RapportListScopeFilter showHidden={showHidden} onChange={setShowHidden} />
      </form>

      <div className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>{t('rapportTitle')}</th>
              <th>{t('navServices')}</th>
              <th>{t('rapportTypes')}</th>
              <th>{t('rapportStatus')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{r.service ? localizedName(r.service, i18n.language) : '—'}</td>
                <td>
                  {r.rapportType
                    ? localizedRapportTypeName(r.rapportType, i18n.language)
                    : '—'}
                </td>
                <td>{rapportStatusLabel(r.status, t)}</td>
                <td className="actionsCell">
                  <div className="actionsCellInner">
                    <Link className="btn btn-ghost btn-sm" to={`/admin/rapports/${r.id}/view`}>
                      {t('details')}
                    </Link>
                    <RapportExportButtons token={token} rapportId={r.id} />
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm btn-danger-text"
                      onClick={() => setDeleteTarget(r)}
                    >
                      {t('deleteRapportAdmin')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="muted">
                  {t('noResults')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} total={total} onPageChange={setPage} />

      <ConfirmActionModal
        open={!!deleteTarget}
        title={t('deleteRapportAdminConfirmTitle')}
        message={t('deleteRapportAdminConfirmMessage', { name: deleteTarget?.title || '' })}
        confirmLabel={t('deleteRapportAdmin')}
        variant="danger"
        loading={deleting}
        onConfirm={confirmDeleteRapport}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
