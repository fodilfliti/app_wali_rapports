import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { apiFileUrl } from '../api'
import { BackButton } from '../components/BackButton'
import { BusyButton } from '../components/BusyButton'
import { TablePagination } from '../components/TablePagination'
import { QueryListShell } from '../components/QueryListShell'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { hasBilingualText, bilingualPairForSave, pickBilingualText } from '../utils/bilingual'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import { notifyHubCountsRefresh } from '../utils/hubCountsRefresh'
import { useInvalidateAppQueries } from '../hooks/useInvalidateAppQueries'
import { useInstructionsListQuery } from '../hooks/queries/useListQueries'
import { useOfficeHubCounts } from '../hooks/useHubCounts'
import { ENABLE_FR_VALUE_INPUTS } from '../config/features'
import { MediaUploadError, prepareFileForUpload } from '../utils/media'
import { blendedBatchPercent, runUploadQueue } from '../utils/uploadQueue'
import { UploadProgressBar } from '../components/UploadProgressBar'

type Props = { token: string }

type InstructionAudience = 'office' | 'wali' | 'chef'

function instructionTitle(row: any, locale: string) {
  return pickBilingualText(row.title_ar, row.title_fr, locale)
}

function instructionBody(row: any, locale: string) {
  return pickBilingualText(row.body_ar, row.body_fr, locale)
}

function formatInstructionDate(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale === 'fr' ? 'fr-FR' : 'ar-DZ')
}

function InstructionFilesList({ files, token }: { files: any[]; token: string }) {
  const { t } = useTranslation()
  if (!files?.length) return null
  return (
    <div className="instructionFilesList">
      <h3>{t('instructionAttachments')}</h3>
      <ul className="versionList">
        {files.map((f) => {
          const file = f.file
          if (!file) return null
          return (
            <li key={f.id}>
              <a
                className="btn btn-ghost"
                href={apiFileUrl(file.url || file.path, token)}
                target="_blank"
                rel="noreferrer"
              >
                {file.original_name || file.filename || t('downloadPdf')}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

async function fetchInstruction(audience: InstructionAudience, token: string, id: number) {
  if (audience === 'office') return api.getOfficeInstruction(token, id)
  if (audience === 'chef') return api.getChefInstruction(token, id)
  return api.getWaliInstruction(token, id)
}

function InstructionViewModal({
  token,
  audience,
  instructionId,
  onClose,
}: {
  token: string
  audience: InstructionAudience
  instructionId: number
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const [row, setRow] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setRow(null)
    fetchInstruction(audience, token, instructionId)
      .then((r) => {
        if (cancelled) return
        setRow(r.instruction)
        notifyHubCountsRefresh()
      })
      .catch(() => {
        if (!cancelled) setRow(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, instructionId, audience])

  return (
    <div
      className="modalOverlay"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        className="modalCard wide instructionViewModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="instructionModalTitle"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <p className="muted instructionModalLoading">{t('loading')}</p>
        ) : row ? (
          <>
            <div className="instructionModalHeader">
              <div className="instructionModalHeading">
                <h2 id="instructionModalTitle">{instructionTitle(row, i18n.language)}</h2>
                {row.created_at ? (
                  <p className="muted small instructionModalMeta">
                    {formatInstructionDate(row.created_at, i18n.language)}
                  </p>
                ) : null}
              </div>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {t('close')}
              </button>
            </div>
            <div className="instructionModalBody formStack">
              {instructionBody(row, i18n.language) ? (
                <p className="instructionBody">{instructionBody(row, i18n.language)}</p>
              ) : (
                <p className="muted">{t('instructionNoBody')}</p>
              )}
              <InstructionFilesList files={row.files || []} token={token} />
              {audience === 'wali' && row.recipients?.length ? (
                <div className="instructionRecipientsBlock">
                  <h3>{t('instructionRecipients')}</h3>
                  <p className="muted small">
                    {row.recipients.map((r: any) => r.user?.name || r.user?.username).join(' · ')}
                  </p>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <p className="muted">{t('errorGeneric')}</p>
            <div className="modalActions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {t('close')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function useOpenInstructionFromState() {
  const location = useLocation()
  const navigate = useNavigate()
  const [openId, setOpenId] = useState<number | null>(null)

  useEffect(() => {
    const state = location.state as { openInstructionId?: number } | null
    const id = state?.openInstructionId
    if (!id) return
    setOpenId(Number(id))
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.state, location.pathname, navigate])

  return { openId, setOpenId }
}

function InstructionDetailRedirect({ listPath }: { listPath: string }) {
  const { id } = useParams()
  const instructionId = id ? Number(id) : NaN
  if (!Number.isFinite(instructionId)) {
    return <Navigate to={listPath} replace />
  }
  return <Navigate to={listPath} replace state={{ openInstructionId: instructionId }} />
}

export function WaliInstructionsPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(1)
  const { openId, setOpenId } = useOpenInstructionFromState()
  const listQuery = useInstructionsListQuery(token, 'wali', { page, pageSize: DEFAULT_PAGE_SIZE })
  const rows = listQuery.data?.instructions ?? []
  const total = listQuery.data?.total ?? 0
  const isInitialLoading = listQuery.isLoading && !listQuery.data
  const isRefreshing = listQuery.isFetching && !listQuery.isLoading

  return (
    <div className="page instructionsPage">
      <div className="pageHeader row">
        <h1>{t('navWaliInstructions')}</h1>
        <Link className="btn btn-primary" to="/wali/instructions/new">
          {t('createInstruction')}
        </Link>
        <BackButton fallbackTo="/wali" />
      </div>
      <p className="muted small instructionsListHint">{t('instructionsListHint')}</p>
      <QueryListShell isInitialLoading={isInitialLoading} isRefreshing={isRefreshing}>
      <div className="card instructionsListCard">
        {!rows.length && !isInitialLoading ? <p className="muted instructionsEmpty">{t('instructionsEmpty')}</p> : null}
        <ul className="instructionsList">
          {rows.map((row) => {
            const recipientsLabel = row.recipients?.length
              ? t('instructionRecipientCount', { count: row.recipients.length })
              : null
            return (
              <li key={row.id}>
                <button
                  type="button"
                  className="instructionListItem"
                  onClick={() => setOpenId(Number(row.id))}
                >
                  <span className="instructionListTitle">{instructionTitle(row, i18n.language)}</span>
                  <span className="instructionListMeta muted small">
                    {formatInstructionDate(row.created_at, i18n.language)}
                    {recipientsLabel ? ` · ${recipientsLabel}` : ''}
                  </span>
                  {instructionBody(row, i18n.language) ? (
                    <span className="instructionListPreview muted small">
                      {instructionBody(row, i18n.language)}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      <TablePagination page={page} total={total} onPageChange={setPage} />
      </QueryListShell>

      {openId ? (
        <InstructionViewModal
          token={token}
          audience="wali"
          instructionId={openId}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  )
}

export function WaliInstructionCreatePage({ token }: Props) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const navigate = useNavigate()
  const invalidate = useInvalidateAppQueries()
  const [users, setUsers] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState(true)
  const [selected, setSelected] = useState<number[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [titleAr, setTitleAr] = useState('')
  const [titleFr, setTitleFr] = useState('')
  const [bodyAr, setBodyAr] = useState('')
  const [bodyFr, setBodyFr] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState<{ id: number; name: string }[]>([])
  const [uploading, setUploading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const perFileProgressRef = useRef<number[]>([])
  const [userPage, setUserPage] = useState(1)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .listWaliShareUsers(token)
      .then((r) => setUsers((r.users || []).filter((u: any) => u.role !== 'CHEF_CABINET')))
      .catch(() => {})
  }, [token])

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase()
    if (!q) return true
    return (
      String(u.name || '').toLowerCase().includes(q) ||
      String(u.username || '').toLowerCase().includes(q)
    )
  })

  useEffect(() => {
    setUserPage(1)
  }, [userSearch])

  const pagedUsers = paginateSlice(filteredUsers, userPage, DEFAULT_PAGE_SIZE)

  function toggleUser(userId: number, enabled: boolean) {
    setSelected((prev) =>
      enabled ? [...new Set([...prev, userId])] : prev.filter((id) => id !== userId),
    )
  }

  async function handleFilesPick(list: FileList | null) {
    if (!list?.length) return
    setUploadError(null)
    const raw = Array.from(list)
    const totalFiles = raw.length
    perFileProgressRef.current = new Array(totalFiles).fill(0)
    try {
      setCompressing(true)
      setUploadPercent(0)
      const prepared = await Promise.all(
        raw.map((file) => prepareFileForUpload(file, { onCompressing: () => setCompressing(true) })),
      )
      setCompressing(false)
      setUploading(true)
      setUploadPercent(0)
      const results = await runUploadQueue(
        prepared.map((file, fileIndex) => async () => {
          const res = await api.uploadWaliFile(token, file, {
            onProgress: (p) => {
              perFileProgressRef.current[fileIndex] = p.percent
              setUploadPercent(blendedBatchPercent(perFileProgressRef.current, totalFiles))
            },
          })
          perFileProgressRef.current[fileIndex] = 100
          setUploadPercent(blendedBatchPercent(perFileProgressRef.current, totalFiles))
          return { id: Number(res.file.id), name: res.file.original_name }
        }),
        3,
      )
      setUploadedFiles((prev) => [...prev, ...results])
      setUploadPercent(100)
    } catch (e) {
      if (e instanceof MediaUploadError) {
        setUploadError(t(e.key, e.params))
      } else {
        setUploadError(t('mediaUploadFailed'))
      }
    } finally {
      setUploading(false)
      setCompressing(false)
    }
  }

  async function submit() {
    if (uploading || compressing) return
    if (!hasBilingualText(titleAr, titleFr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return
    }
    if (!allUsers && selected.length === 0) {
      snack.show(t('shareRecipientsRequired'), 'error')
      return
    }
    setSaving(true)
    try {
      const titles = bilingualPairForSave(titleAr, titleFr)
      await api.createWaliInstruction(token, {
        title_ar: titles.ar,
        title_fr: titles.fr,
        body_ar: bodyAr.trim() || null,
        body_fr: bodyFr.trim() || null,
        all_office: allUsers,
        recipient_ids: allUsers ? [] : selected,
        uploaded_file_ids: uploadedFiles.map((f) => f.id),
      })
      await invalidate({ instructions: true, hubCounts: true })
      snack.show(t('save'), 'success')
      navigate('/wali/instructions')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('createInstruction')}</h1>
        <BackButton fallbackTo="/wali/instructions" />
      </div>
      <div className="card formStack">
        <label className="formField">
          <span>{t('rapportTitle')} (AR)</span>
          <input value={titleAr} dir="rtl" onChange={(e) => setTitleAr(e.target.value)} />
        </label>
        {ENABLE_FR_VALUE_INPUTS ? (
          <label className="formField">
            <span>{t('rapportTitle')} (FR)</span>
            <input value={titleFr} onChange={(e) => setTitleFr(e.target.value)} />
          </label>
        ) : null}
        <label className="formField">
          <span>{t('instructionBody')} (AR)</span>
          <textarea value={bodyAr} dir="rtl" rows={5} onChange={(e) => setBodyAr(e.target.value)} />
        </label>
        {ENABLE_FR_VALUE_INPUTS ? (
          <label className="formField">
            <span>{t('instructionBody')} (FR)</span>
            <textarea value={bodyFr} rows={5} onChange={(e) => setBodyFr(e.target.value)} />
          </label>
        ) : null}
        <label className="formField">
          <span>{t('instructionAttachments')}</span>
          <input
            type="file"
            multiple
            disabled={uploading || compressing}
            onChange={(e) => {
              void handleFilesPick(e.target.files)
              e.target.value = ''
            }}
          />
          {uploadedFiles.length ? (
            <p className="muted small">{uploadedFiles.map((f) => f.name).join(' · ')}</p>
          ) : null}
          {compressing || uploading ? (
            <UploadProgressBar
              percent={compressing ? 0 : uploadPercent}
              label={
                compressing
                  ? t('mediaCompressing')
                  : t('mediaUploadProgress', { percent: uploadPercent })
              }
            />
          ) : null}
          {uploadError ? <p className="formErrorBlock">{uploadError}</p> : null}
        </label>
        <label className="checkboxLabel">
          <input
            type="checkbox"
            checked={allUsers}
            onChange={(e) => setAllUsers(e.target.checked)}
          />
          {t('instructionAllOfficeUsers')}
        </label>
        {!allUsers ? (
          <>
            <input
              placeholder={t('search')}
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <div className="shareUserPickList">
              {pagedUsers.map((u) => (
                <label key={u.id} className="checkboxLabel">
                  <input
                    type="checkbox"
                    checked={selected.includes(Number(u.id))}
                    onChange={(e) => toggleUser(Number(u.id), e.target.checked)}
                  />
                  {u.name || u.username}
                </label>
              ))}
            </div>
            <TablePagination page={userPage} total={filteredUsers.length} onPageChange={setUserPage} />
          </>
        ) : null}
        <div className="modalActions">
          <BusyButton type="button" className="btn btn-primary" onClick={submit} busy={saving} busyLabel={t('saving')}>
            {t('save')}
          </BusyButton>
        </div>
      </div>
    </div>
  )
}

export function WaliInstructionDetailPage(_props: Props) {
  return <InstructionDetailRedirect listPath="/wali/instructions" />
}

export function OfficeInstructionsPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const { counts, refresh } = useOfficeHubCounts(token)
  const invalidate = useInvalidateAppQueries()
  const [page, setPage] = useState(1)
  const { openId, setOpenId } = useOpenInstructionFromState()
  const listQuery = useInstructionsListQuery(token, 'office', { page, pageSize: DEFAULT_PAGE_SIZE })
  const rows = listQuery.data?.instructions ?? []
  const total = listQuery.data?.total ?? 0
  const isInitialLoading = listQuery.isLoading && !listQuery.data
  const isRefreshing = listQuery.isFetching && !listQuery.isLoading

  useEffect(() => {
    refresh()
  }, [refresh, rows.length])

  async function closeModal() {
    setOpenId(null)
    await invalidate({ hubCounts: 'office', instructions: true })
    refresh()
  }

  return (
    <div className="page instructionsPage">
      <div className="pageHeader row">
        <div className="notificationPageHeading">
          <h1>{t('navWaliInstructions')}</h1>
          {counts.unread_instructions > 0 ? (
            <p className="muted small">{t('unread')}: {counts.unread_instructions}</p>
          ) : null}
        </div>
        <BackButton fallbackTo="/office" />
      </div>
      <p className="muted small instructionsListHint">{t('instructionsListHintOffice')}</p>
      <QueryListShell isInitialLoading={isInitialLoading} isRefreshing={isRefreshing}>
      <div className="card instructionsListCard">
        {!rows.length && !isInitialLoading ? <p className="muted instructionsEmpty">{t('noResults')}</p> : null}
        <ul className="instructionsList">
          {rows.map((row) => (
            <li key={row.id} className={row.read_at ? 'instructionListRow read' : 'instructionListRow unread'}>
              <button
                type="button"
                className="instructionListItem"
                onClick={() => setOpenId(Number(row.id))}
              >
                <span className="instructionListTitleRow">
                  <span className="instructionListTitle">{instructionTitle(row, i18n.language)}</span>
                  {!row.read_at ? (
                    <span className="badge badge-submitted">{t('unread')}</span>
                  ) : null}
                </span>
                <span className="instructionListMeta muted small">
                  {formatInstructionDate(row.created_at, i18n.language)}
                </span>
                {instructionBody(row, i18n.language) ? (
                  <span className="instructionListPreview muted small">
                    {instructionBody(row, i18n.language)}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <TablePagination page={page} total={total} onPageChange={setPage} />
      </QueryListShell>

      {openId ? (
        <InstructionViewModal
          token={token}
          audience="office"
          instructionId={openId}
          onClose={() => {
            void closeModal()
          }}
        />
      ) : null}
    </div>
  )
}

export function OfficeInstructionDetailPage(_props: Props) {
  return <InstructionDetailRedirect listPath="/office/instructions" />
}

export function ChefInstructionsPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(1)
  const { openId, setOpenId } = useOpenInstructionFromState()
  const listQuery = useInstructionsListQuery(token, 'chef', { page, pageSize: DEFAULT_PAGE_SIZE })
  const rows = listQuery.data?.instructions ?? []
  const total = listQuery.data?.total ?? 0
  const isInitialLoading = listQuery.isLoading && !listQuery.data
  const isRefreshing = listQuery.isFetching && !listQuery.isLoading

  return (
    <div className="page instructionsPage">
      <div className="pageHeader row">
        <h1>{t('navWaliInstructions')}</h1>
        <BackButton fallbackTo="/chef" />
      </div>
      <p className="muted small instructionsListHint">{t('instructionsListHintChef')}</p>
      <QueryListShell isInitialLoading={isInitialLoading} isRefreshing={isRefreshing}>
      <div className="card instructionsListCard">
        {!rows.length && !isInitialLoading ? <p className="muted instructionsEmpty">{t('instructionsEmptyChef')}</p> : null}
        <ul className="instructionsList">
          {rows.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                className="instructionListItem"
                onClick={() => setOpenId(Number(row.id))}
              >
                <span className="instructionListTitle">{instructionTitle(row, i18n.language)}</span>
                <span className="instructionListMeta muted small">
                  {formatInstructionDate(row.created_at, i18n.language)}
                </span>
                {instructionBody(row, i18n.language) ? (
                  <span className="instructionListPreview muted small">
                    {instructionBody(row, i18n.language)}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <TablePagination page={page} total={total} onPageChange={setPage} />
      </QueryListShell>

      {openId ? (
        <InstructionViewModal
          token={token}
          audience="chef"
          instructionId={openId}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  )
}

export function ChefInstructionDetailPage(_props: Props) {
  return <InstructionDetailRedirect listPath="/chef/instructions" />
}
