import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageLightbox, useImageLightbox } from './ImageLightbox'
import { UploadProgressBar } from './UploadProgressBar'
import type { MediaFile, MediaRow } from '../utils/media'
import {
  MEDIA_MAX_ATTACHMENTS,
  MEDIA_MAX_FILE_BYTES,
  MEDIA_MAX_IMAGE_BYTES,
  MEDIA_MAX_VIDEO_BYTES,
  MediaUploadError,
  fileExtension,
  fileUrl,
  flattenMediaRows,
  formatBytes,
  mediaRowsFromFileIds,
  prepareFileForUpload,
} from '../utils/media'
import type { UploadProgress } from '../utils/uploadFile'

type ViewProps = {
  rows: MediaRow[]
  files: Record<number, MediaFile>
  token: string
}

function MediaAttachmentPreview({
  file,
  token,
  className = 'mediaCell',
  onImageClick,
  onVideoClick,
}: {
  file: MediaFile
  token: string
  className?: string
  onImageClick?: (src: string, alt: string) => void
  onVideoClick?: (src: string, alt: string) => void
}) {
  const { t } = useTranslation()
  const url = fileUrl(token, file)

  if (file.media_kind === 'video') {
    return (
      <div className={className}>
        <button
          type="button"
          className="mediaVideoThumb"
          onClick={() => onVideoClick?.(url, file.original_name)}
          aria-label={file.original_name || t('mediaVideoPreview')}
        >
          <video className="mediaVideo" src={url} preload="metadata" muted playsInline />
          <span className="mediaVideoPlay" aria-hidden>
            ▶
          </span>
        </button>
        <span className="muted small mediaFileName">{file.original_name}</span>
      </div>
    )
  }

  if (file.media_kind === 'image') {
    return (
      <div className={className}>
        <button
          type="button"
          className="mediaImageButton"
          onClick={() => onImageClick?.(url, file.original_name)}
          aria-label={file.original_name}
        >
          <img className="mediaImage mediaImageClickable" src={url} alt={file.original_name} />
        </button>
        <span className="muted small mediaFileName">{file.original_name}</span>
      </div>
    )
  }

  return (
    <div className={`${className} mediaFileTile`}>
      <span className="mediaFileExt">{fileExtension(file.original_name)}</span>
      <a className="mediaFileLink" href={url} target="_blank" rel="noreferrer">
        {file.original_name}
      </a>
      {file.size_bytes ? <span className="muted small">{formatBytes(file.size_bytes)}</span> : null}
    </div>
  )
}

export function MediaRowsView({ rows, files, token }: ViewProps) {
  const lightbox = useImageLightbox()
  const fileIds = flattenMediaRows(rows)
  if (!fileIds.length) return null

  return (
    <>
      <div className="mediaSection">
        <div className="mediaAttachmentGrid">
          {fileIds.map((id) => {
            const file = files[id]
            if (!file) return null
            return (
              <MediaAttachmentPreview
                key={id}
                file={file}
                token={token}
                className="mediaCell mediaFileCard"
                onImageClick={lightbox.open}
                onVideoClick={(src, alt) => lightbox.open(src, alt, 'video')}
              />
            )
          })}
        </div>
      </div>
      <ImageLightbox
        src={lightbox.state?.src || ''}
        alt={lightbox.state?.alt}
        kind={lightbox.state?.kind}
        open={lightbox.isOpen}
        onClose={lightbox.close}
      />
    </>
  )
}

type EditorProps = ViewProps & {
  editable: boolean
  onChange: (rows: MediaRow[]) => void
  onUpload: (file: File, opts?: { onProgress?: (p: UploadProgress) => void }) => Promise<MediaFile>
  maxAttachments?: number
}

export function MediaRowsEditor({
  rows,
  files,
  token,
  editable,
  onChange,
  onUpload,
  maxAttachments = MEDIA_MAX_ATTACHMENTS,
}: EditorProps) {
  const { t } = useTranslation()
  const lightbox = useImageLightbox()
  const [uploading, setUploading] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileIds = flattenMediaRows(rows)

  function removeFile(fileId: number) {
    onChange(mediaRowsFromFileIds(fileIds.filter((id) => id !== fileId)))
  }

  async function handleAdd(raw: File) {
    setError(null)
    try {
      setCompressing(true)
      const prepared = await prepareFileForUpload(raw, { onCompressing: () => setCompressing(true) })
      setCompressing(false)
      setUploading(true)
      setUploadPercent(0)
      const uploaded = await onUpload(prepared, {
        onProgress: (p) => setUploadPercent(p.percent),
      })
      setUploadPercent(100)
      onChange(mediaRowsFromFileIds([...fileIds, uploaded.id]))
    } catch (e) {
      if (e instanceof MediaUploadError) {
        setError(t(e.key, e.params))
      } else {
        setError(t('mediaUploadFailed'))
      }
    } finally {
      setUploading(false)
      setCompressing(false)
    }
  }

  const busy = uploading || compressing

  return (
    <>
      <div className="mediaSection">
        <h3>{t('mediaAttachments')}</h3>
        <p className="muted small mediaAttachmentsHint">
          {t('mediaAttachmentsHint', {
            imageMax: formatBytes(MEDIA_MAX_IMAGE_BYTES),
            videoMax: formatBytes(MEDIA_MAX_VIDEO_BYTES),
            fileMax: formatBytes(MEDIA_MAX_FILE_BYTES),
            maxCount: maxAttachments,
          })}
        </p>
        {error ? <p className="formErrorBlock">{error}</p> : null}
        {compressing ? <p className="muted small">{t('mediaCompressing')}</p> : null}
        {uploading && !compressing ? (
          <UploadProgressBar percent={uploadPercent} label={t('mediaUploadProgress', { percent: uploadPercent })} />
        ) : null}
        <div className="mediaAttachmentGrid">
          {fileIds.map((id) => {
            const file = files[id]
            if (!file) return null
            return (
              <div key={id} className="mediaCell mediaCellEditable">
                <MediaAttachmentPreview
                  file={file}
                  token={token}
                  className="mediaCellPreview"
                  onImageClick={lightbox.open}
                  onVideoClick={(src, alt) => lightbox.open(src, alt, 'video')}
                />
                {editable ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeFile(id)}>
                    {t('remove')}
                  </button>
                ) : null}
              </div>
            )
          })}
          {editable && fileIds.length < maxAttachments ? (
            <label className={`mediaCell mediaUploadSlot${busy ? ' isUploading' : ''}`}>
              <span>{busy ? (compressing ? t('mediaCompressing') : t('mediaUploading')) : t('addMedia')}</span>
              <input
                type="file"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleAdd(f)
                  e.target.value = ''
                }}
              />
            </label>
          ) : null}
        </div>
      </div>
      <ImageLightbox
        src={lightbox.state?.src || ''}
        alt={lightbox.state?.alt}
        kind={lightbox.state?.kind}
        open={lightbox.isOpen}
        onClose={lightbox.close}
      />
    </>
  )
}

export function DocumentBlocksView({
  blocks,
  files,
  token,
}: {
  blocks: any[]
  files: Record<number, MediaFile>
  token: string
}) {
  const { i18n } = useTranslation()

  function blockText(block: any) {
    return i18n.language === 'fr' ? block.text_fr ?? block.text ?? '' : block.text_ar ?? block.text ?? ''
  }

  return (
    <>
      {(blocks || []).map((block, i) => {
        if (block.type === 'media_row') {
          return <MediaRowsView key={i} rows={[{ items: block.items || [] }]} files={files} token={token} />
        }
        return (
          <div key={i} className="docBlock" style={{ textAlign: block.align === 'center' ? 'center' : 'start' }}>
            {block.type === 'heading' ? <h2>{blockText(block)}</h2> : <p>{blockText(block)}</p>}
          </div>
        )
      })}
    </>
  )
}
