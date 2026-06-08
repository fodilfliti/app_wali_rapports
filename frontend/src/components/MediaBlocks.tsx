import { useTranslation } from 'react-i18next'
import type { MediaFile, MediaRow } from '../utils/media'
import { fileUrl } from '../utils/media'

type ViewProps = {
  rows: MediaRow[]
  files: Record<number, MediaFile>
  token: string
}

export function MediaRowsView({ rows, files, token }: ViewProps) {
  if (!rows?.length) return null
  return (
    <div className="mediaSection">
      {rows.map((row, i) => (
        <div key={i} className="mediaRow">
          {row.items.map((it, j) => {
            const file = files[it.file_id]
            if (!file) return null
            const url = fileUrl(token, file)
            if (file.media_kind === 'video') {
              return (
                <div key={j} className="mediaCell">
                  <video controls className="mediaVideo" src={url} />
                  <span className="muted small">{file.original_name}</span>
                </div>
              )
            }
            if (file.media_kind === 'image') {
              return (
                <div key={j} className="mediaCell">
                  <img className="mediaImage" src={url} alt={file.original_name} />
                </div>
              )
            }
            return (
              <div key={j} className="mediaCell mediaFile">
                <a href={url} target="_blank" rel="noreferrer">
                  {file.original_name}
                </a>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

type EditorProps = ViewProps & {
  editable: boolean
  onChange: (rows: MediaRow[]) => void
  onUpload: (file: File) => Promise<MediaFile>
  maxRows?: number
}

export function MediaRowsEditor({ rows, files, token, editable, onChange, onUpload, maxRows }: EditorProps) {
  const { t } = useTranslation()

  async function addRow() {
    onChange([...(rows || []), { items: [] }])
  }

  async function uploadToRow(rowIndex: number, slot: number, file: File) {
    const uploaded = await onUpload(file)
    const next = [...(rows || [])]
    while (next.length <= rowIndex) next.push({ items: [] })
    const items = [...next[rowIndex].items]
    items[slot] = { file_id: uploaded.id }
    next[rowIndex] = { items: items.filter(Boolean).slice(0, 2) }
    onChange(next)
  }

  function removeRow(i: number) {
    onChange((rows || []).filter((_, idx) => idx !== i))
  }

  return (
    <div className="mediaSection">
      <h3>{t('mediaAttachments')}</h3>
      {(rows || []).map((row, i) => (
        <div key={i} className="mediaRow">
          {[0, 1].map((slot) => {
            const item = row.items[slot]
            const file = item ? files[item.file_id] : null
            return (
              <div key={slot} className="mediaCell">
                {file ? (
                  file.media_kind === 'video' ? (
                    <video controls className="mediaVideo" src={fileUrl(token, file)} />
                  ) : file.media_kind === 'image' ? (
                    <img className="mediaImage" src={fileUrl(token, file)} alt={file.original_name} />
                  ) : (
                    <a href={fileUrl(token, file)} target="_blank" rel="noreferrer">
                      {file.original_name}
                    </a>
                  )
                ) : editable ? (
                  <label className="mediaUploadSlot">
                    <span>{t('addMedia')}</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) uploadToRow(i, slot, f).catch(() => {})
                        e.target.value = ''
                      }}
                    />
                  </label>
                ) : null}
              </div>
            )
          })}
          {editable ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRow(i)}>
              {t('remove')}
            </button>
          ) : null}
        </div>
      ))}
      {editable && (!maxRows || (rows || []).length < maxRows) ? (
        <button type="button" className="btn btn-secondary" onClick={addRow}>
          {t('addMediaRow')}
        </button>
      ) : null}
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
