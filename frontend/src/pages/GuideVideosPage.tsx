import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { ENABLE_FR_VALUE_INPUTS } from '../config/features'
import { BackButton } from '../components/BackButton'
import { BusyButton } from '../components/BusyButton'
import { PageLoading } from '../components/PageLoading'
import { TablePagination } from '../components/TablePagination'
import { FieldErrorText } from '../components/FieldErrorText'
import { FormErrorBlock } from '../components/FormErrorBlock'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { guideVideoFormSchema } from '../validation/schemas/forms'
import { useZodForm } from '../validation/useZodForm'
import { bilingualPairForSave, pickBilingualText } from '../utils/bilingual'
import { fileUrl, formatBytes, MEDIA_MAX_VIDEO_BYTES } from '../utils/media'

type Audience = api.GuideVideoAudience
type ListRole = api.GuideVideoListRole

type Props = {
  token: string
  listRole: ListRole
  canManage?: boolean
}

type FormFields = {
  title_ar: string
  title_fr: string
  description_ar: string
  description_fr: string
  audience: Audience
  is_new: boolean
}

const EMPTY_FORM: FormFields = {
  title_ar: '',
  title_fr: '',
  description_ar: '',
  description_fr: '',
  audience: 'general',
  is_new: false,
}

function audienceTabs(canSeeAdmin: boolean): Audience[] {
  const tabs: Audience[] = ['general', 'OFFICE_USER', 'CHEF_CABINET', 'WALI']
  if (canSeeAdmin) tabs.push('ADMIN')
  return tabs
}

function audienceLabelKey(audience: Audience): string {
  if (audience === 'general') return 'guideAudienceGeneral'
  if (audience === 'ADMIN') return 'roleAdmin'
  if (audience === 'OFFICE_USER') return 'roleOffice'
  if (audience === 'CHEF_CABINET') return 'roleChefCabinet'
  return 'roleWali'
}

export function GuideVideosPage({ token, listRole, canManage = false }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const form = useZodForm(guideVideoFormSchema)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const [audience, setAudience] = useState<Audience>('general')
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [fields, setFields] = useState<FormFields>(EMPTY_FORM)
  const [file, setFile] = useState<File | null>(null)
  const [playing, setPlaying] = useState<any | null>(null)

  const tabs = audienceTabs(canManage || listRole === 'admin')
  const locale = i18n.language === 'fr' ? 'fr' : 'ar'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listGuideVideos(token, listRole, {
        page,
        pageSize: 20,
        audience,
      })
      setRows(res.videos)
      setTotal(res.total)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setLoading(false)
    }
  }, [token, listRole, page, audience, snack, t])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setEditId(null)
    setFields({ ...EMPTY_FORM, audience })
    setFile(null)
    form.clearErrors()
    setModalOpen(true)
  }

  function openEdit(row: any) {
    setEditId(row.id)
    setFields({
      title_ar: row.title_ar || '',
      title_fr: row.title_fr || '',
      description_ar: row.description_ar || '',
      description_fr: row.description_fr || '',
      audience: row.audience,
      is_new: Boolean(row.is_new),
    })
    setFile(null)
    form.clearErrors()
    setModalOpen(true)
  }

  async function save() {
    if (!form.validate(fields, t, ['title_ar', 'title_fr', 'audience'])) return
    if (!editId && !file) {
      snack.show(t('guideVideoFileRequired'), 'error')
      return
    }
    if (file && file.size > MEDIA_MAX_VIDEO_BYTES) {
      snack.show(t('mediaFileTooLarge', { max: formatBytes(MEDIA_MAX_VIDEO_BYTES) }), 'error')
      return
    }
    if (file && !file.type.startsWith('video/')) {
      snack.show(t('guideVideoFileRequired'), 'error')
      return
    }

    const titles = bilingualPairForSave(fields.title_ar, fields.title_fr)
    const descs = bilingualPairForSave(fields.description_ar, fields.description_fr)
    const body = {
      title_ar: titles.ar,
      title_fr: titles.fr,
      description_ar: descs.ar || null,
      description_fr: descs.fr || null,
      audience: fields.audience,
      is_new: fields.is_new,
    }

    setSaving(true)
    try {
      if (editId) {
        await api.patchGuideVideo(token, editId, body, file)
        snack.show(t('done'), 'success')
      } else {
        await api.createGuideVideo(token, file!, body)
        snack.show(t('done'), 'success')
      }
      setModalOpen(false)
      await load()
    } catch (e: any) {
      snack.show(e?.message === 'bilingualLabelRequired' ? t('bilingualLabelRequired') : t('errorGeneric'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!window.confirm(t('guideVideoDeleteConfirm'))) return
    try {
      await api.deleteGuideVideo(token, id)
      snack.show(t('done'), 'success')
      await load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function toggleNew(row: any) {
    try {
      await api.patchGuideVideo(token, row.id, { is_new: !row.is_new })
      await load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  function requestFullscreen() {
    const el = videoRef.current
    if (!el) return
    const anyEl = el as HTMLVideoElement & { webkitRequestFullscreen?: () => void }
    if (el.requestFullscreen) el.requestFullscreen()
    else if (anyEl.webkitRequestFullscreen) anyEl.webkitRequestFullscreen()
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navGuideVideos')}</h1>
        {canManage ? (
          <BusyButton type="button" className="btn btn-primary" busy={false} onClick={openCreate}>
            {t('guideVideoUpload')}
          </BusyButton>
        ) : null}
        <BackButton />
      </div>

      <p className="muted guideVideosHint">{t('guideVideosHint')}</p>

      <div className="inboxViewTabs inboxViewTabs--segment guideAudienceTabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            className={`inboxViewTab${audience === tab ? ' active' : ''}`}
            aria-selected={audience === tab}
            onClick={() => {
              setAudience(tab)
              setPage(1)
            }}
          >
            {t(audienceLabelKey(tab))}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoading />
      ) : rows.length === 0 ? (
        <p className="muted">{t('guideVideosEmpty')}</p>
      ) : (
        <div className="guideVideoGrid">
          {rows.map((row) => {
            const title = pickBilingualText(row.title_ar, row.title_fr, locale)
            const desc = pickBilingualText(row.description_ar, row.description_fr, locale)
            const thumbSrc = fileUrl(token, row.file)
            return (
              <article key={row.id} className="guideVideoCard">
                <button
                  type="button"
                  className="guideVideoThumb"
                  onClick={() => setPlaying(row)}
                  aria-label={t('guideVideoPlay', { title })}
                >
                  {thumbSrc ? (
                    <video
                      className="guideVideoThumbMedia"
                      src={`${thumbSrc}#t=0.1`}
                      muted
                      playsInline
                      preload="metadata"
                      tabIndex={-1}
                      aria-hidden
                    />
                  ) : (
                    <span className="guideVideoThumbFallback" aria-hidden />
                  )}
                  <span className="guideVideoThumbScrim" aria-hidden />
                  <span className="guideVideoPlayBtn" aria-hidden>
                    <span className="guideVideoPlayIcon" />
                  </span>
                  {row.is_new ? (
                    <span className="badge badge-submitted guideVideoNewBadge">{t('guideVideoNew')}</span>
                  ) : null}
                </button>
                <div className="guideVideoCardBody">
                  <div className="guideVideoCardMeta">
                    <span className="guideVideoAudienceChip">
                      {t(audienceLabelKey(row.audience as Audience))}
                    </span>
                  </div>
                  <h2 className="guideVideoTitle">{title}</h2>
                  {desc ? <p className="guideVideoDesc muted small">{desc}</p> : null}
                  {canManage ? (
                    <div className="guideVideoCardActions">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => openEdit(row)}>
                        {t('edit')}
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggleNew(row)}>
                        {row.is_new ? t('guideVideoClearNew') : t('guideVideoMarkNew')}
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(row.id)}>
                        {t('remove')}
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <TablePagination
        page={page}
        pageSize={20}
        total={total}
        onPageChange={setPage}
      />

      {playing ? (
        <div className="modalOverlay guideVideoPlayerOverlay" onClick={() => setPlaying(null)}>
          <div
            className="modalCard guideVideoPlayerCard"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
            aria-label={pickBilingualText(playing.title_ar, playing.title_fr, locale)}
          >
            <div className="guideVideoPlayerHeader">
              <h2>{pickBilingualText(playing.title_ar, playing.title_fr, locale)}</h2>
              <div className="guideVideoPlayerActions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={requestFullscreen}>
                  {t('guideVideoFullscreen')}
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPlaying(null)}>
                  {t('close')}
                </button>
              </div>
            </div>
            <video
              ref={videoRef}
              className="guideVideoPlayer"
              controls
              autoPlay
              playsInline
              src={fileUrl(token, playing.file)}
            />
          </div>
        </div>
      ) : null}

      {modalOpen && canManage ? (
        <div className="modalOverlay" onClick={() => setModalOpen(false)}>
          <div className="modalCard guideVideoFormCard" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? t('guideVideoEdit') : t('guideVideoUpload')}</h2>
            <label>
              {t('guideVideoTitleAr')}
              <input
                id="title_ar"
                className={form.hasFieldError('title_ar') ? 'inputInvalid' : ''}
                value={fields.title_ar}
                dir="rtl"
                onChange={(e) => setFields((f) => ({ ...f, title_ar: e.target.value }))}
              />
              <FieldErrorText text={form.fieldErrorText('title_ar', t)} />
            </label>
            {ENABLE_FR_VALUE_INPUTS ? (
              <label>
                {t('guideVideoTitleFr')}
                <input
                  id="title_fr"
                  className={form.hasFieldError('title_fr') ? 'inputInvalid' : ''}
                  value={fields.title_fr}
                  dir={i18n.language === 'fr' ? 'ltr' : undefined}
                  onChange={(e) => setFields((f) => ({ ...f, title_fr: e.target.value }))}
                />
                <FieldErrorText text={form.fieldErrorText('title_fr', t)} />
              </label>
            ) : null}
            <label>
              {t('guideVideoDescriptionAr')}
              <textarea
                rows={3}
                value={fields.description_ar}
                dir="rtl"
                onChange={(e) => setFields((f) => ({ ...f, description_ar: e.target.value }))}
              />
            </label>
            {ENABLE_FR_VALUE_INPUTS ? (
              <label>
                {t('guideVideoDescriptionFr')}
                <textarea
                  rows={3}
                  value={fields.description_fr}
                  dir={i18n.language === 'fr' ? 'ltr' : undefined}
                  onChange={(e) => setFields((f) => ({ ...f, description_fr: e.target.value }))}
                />
              </label>
            ) : null}
            <label>
              {t('guideVideoAudience')}
              <select
                value={fields.audience}
                onChange={(e) => setFields((f) => ({ ...f, audience: e.target.value as Audience }))}
              >
                {audienceTabs(true).map((a) => (
                  <option key={a} value={a}>
                    {t(audienceLabelKey(a))}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkboxRow">
              <input
                type="checkbox"
                checked={fields.is_new}
                onChange={(e) => setFields((f) => ({ ...f, is_new: e.target.checked }))}
              />
              <span>{t('guideVideoMarkNew')}</span>
            </label>
            <label>
              {editId ? t('guideVideoReplaceFile') : t('guideVideoFile')}
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <span className="muted small">
                {t('guideVideoFileHint', { max: formatBytes(MEDIA_MAX_VIDEO_BYTES) })}
              </span>
            </label>
            <FormErrorBlock message={form.formError} />
            <div className="modalActions">
              <BusyButton type="button" className="btn btn-primary" busy={saving} busyLabel={t('saving')} onClick={save}>
                {t('save')}
              </BusyButton>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
