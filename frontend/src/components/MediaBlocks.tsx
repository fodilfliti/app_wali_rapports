import { useState } from 'react'
import { useTranslation } from 'react-i18next'
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

type ViewProps = {
  rows: MediaRow[]
  files: Record<number, MediaFile>
  token: string
}

function MediaAttachmentPreview({
  file,
  token,
  className = 'mediaCell',
}: {
  file: MediaFile
  token: string
  className?: string
}) {
  const url = fileUrl(token, file)

  if (file.media_kind === 'video') {
    return (
      <div className={className}>
        <video controls className="mediaVideo" src={url} preload="metadata" />
        <span className="muted small mediaFileName">{file.original_name}</span>
      </div>
    )
  }

  if (file.media_kind === 'image') {
    return (
      <div className={className}>
        <img className="mediaImage" src={url} alt={file.original_name} />
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
  const fileIds = flattenMediaRows(rows)
  if (!fileIds.length) return null

  return (
    <div className="mediaSection">
      <div className="mediaAttachmentGrid">
        {fileIds.map((id) => {
          const file = files[id]
          if (!file) return null
          return <MediaAttachmentPreview key={id} file={file} token={token} />
        })}
      </div>
    </div>
  )
}

type EditorProps = ViewProps & {
  editable: boolean
  onChange: (rows: MediaRow[]) => void
  onUpload: (file: File) => Promise<MediaFile>
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
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileIds = flattenMediaRows(rows)

  function removeFile(fileId: number) {
    onChange(mediaRowsFromFileIds(fileIds.filter((id) => id !== fileId)))
  }

  async function handleAdd(raw: File) {
    setError(null)
    try {
      const prepared = await prepareFileForUpload(raw)
      setUploading(true)
      const uploaded = await onUpload(prepared)
      onChange(mediaRowsFromFileIds([...fileIds, uploaded.id]))
    } catch (e) {
      if (e instanceof MediaUploadError) {
        setError(t(e.key, e.params))
      } else {
        setError(t('mediaUploadFailed'))
      }
    } finally {
      setUploading(false)
    }
  }

  return (
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
      <div className="mediaAttachmentGrid">
        {fileIds.map((id) => {
          const file = files[id]
          if (!file) return null
          return (
            <div key={id} className="mediaCell mediaCellEditable">
              <MediaAttachmentPreview file={file} token={token} className="mediaCellPreview" />
              {editable ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeFile(id)}>
                  {t('remove')}
                </button>
              ) : null}
            </div>
          )
        })}
        {editable && fileIds.length < maxAttachments ? (
          <label className={`mediaCell mediaUploadSlot${uploading ? ' isUploading' : ''}`}>
            <span>{uploading ? t('mediaUploading') : t('addMedia')}</span>
            <input
              type="file"
              disabled={uploading}
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
