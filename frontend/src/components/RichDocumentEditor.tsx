import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntityIdParam } from '../api'
import * as api from '../api'
import { contentLocale } from '../config/features'
import type { EmbeddedTable } from '../types/embeddedTable'
import { pruneEmbeddedTables } from '../types/embeddedTable'
import { signFileUrl } from '../api'
import { getRichHtml, richHtmlIsEmpty } from '../utils/richDocument'
import {
  prepareRichHtmlForSave,
  usePreparedRichHtml,
} from '../utils/richHtmlSecurity'
import { embeddedTablesEqual, resolveEmbeddedTables } from '../utils/embeddedTableSchema'
import { RichTextEditor } from './richText/RichTextEditor'
import { ImageLightbox, useImageLightbox } from './ImageLightbox'
import { SchemaTableProvider, useSchemaTables } from './richText/SchemaTableContext'
import { SchemaTablePickModal } from './richText/SchemaTablePickModal'
import { SchemaTableEditModal } from './richText/SchemaTableEditModal'
import { extractSchemaTableIds } from '../types/embeddedTable'
import './richText/richText.css'

type Props = {
  data: {
    rich_html_ar?: string
    rich_html_fr?: string
    blocks?: any[]
    embedded_tables?: EmbeddedTable[]
  } | null | undefined
  onChange: (locale: 'ar' | 'fr', html: string) => void
  onEmbeddedTablesChange?: (tables: EmbeddedTable[]) => void
  editable?: boolean
  token: string
  rapportId?: EntityIdParam
  /** Create/persist draft before upload when rapportId is missing (title required). */
  ensureRapportId?: () => Promise<EntityIdParam>
  onUploadError?: (err: unknown) => void
  serviceId?: EntityIdParam
}

function SyncLinkedSchemaTables({
  token,
  serviceId,
  initial,
  onResolved,
}: {
  token: string
  serviceId?: EntityIdParam
  initial: EmbeddedTable[]
  onResolved?: (tables: EmbeddedTable[]) => void
}) {
  const { setTablesFromList, tables } = useSchemaTables()
  const tablesRef = useRef(tables)
  const initialKey = useRef('')
  tablesRef.current = tables

  const applyTables = useCallback(
    (next: EmbeddedTable[]) => {
      setTablesFromList(next)
      onResolved?.(next)
    },
    [setTablesFromList, onResolved],
  )

  const refresh = useCallback(async () => {
    const base = Object.values(tablesRef.current).length
      ? Object.values(tablesRef.current)
      : initial
    if (!base.length) {
      applyTables([])
      return
    }
    if (!serviceId) {
      applyTables(base)
      return
    }
    try {
      const res = await api.listOfficeServiceSchemas(token, serviceId)
      const schemas = [...(res.schemas || []), ...(res.templates || [])]
      applyTables(resolveEmbeddedTables(base, schemas))
    } catch {
      applyTables(base)
    }
  }, [token, serviceId, initial, applyTables])

  useEffect(() => {
    const key = initial.map((t) => t.id).join(',')
    if (key === initialKey.current && Object.keys(tablesRef.current).length) return
    initialKey.current = key
    refresh()
  }, [refresh, initial])

  useEffect(() => {
    if (!serviceId) return
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [serviceId, refresh])

  return null
}

function RichDocumentEditorInner({
  data,
  onChange,
  onEmbeddedTablesChange,
  editable = true,
  token,
  rapportId,
  ensureRapportId,
  onUploadError,
  serviceId,
}: Props) {
  const { t, i18n } = useTranslation()
  const locale = contentLocale(i18n.language)
  const html = usePreparedRichHtml(getRichHtml(data, locale))
  const { tables, upsertTable, updateTable, removeTable, editingId, setEditingId } = useSchemaTables()
  const [pickOpen, setPickOpen] = useState(false)
  const [insertTableId, setInsertTableId] = useState<string | null>(null)
  const pendingInsertRef = useRef<string | null>(null)
  const tablesRef = useRef(tables)

  tablesRef.current = tables

  const notifyParent = useCallback(
    (next: Record<string, EmbeddedTable>) => {
      onEmbeddedTablesChange?.(Object.values(next))
    },
    [onEmbeddedTablesChange],
  )

  const handleInsertTableDone = useCallback(() => setInsertTableId(null), [])

  const handleResolvedTables = useCallback(
    (resolved: EmbeddedTable[]) => {
      const map = Object.fromEntries(resolved.map((tbl) => [tbl.id, tbl]))
      const prev = tablesRef.current
      if (embeddedTablesEqual(Object.values(prev), resolved)) return
      notifyParent(map)
    },
    [notifyParent],
  )

  function handleHtmlChange(next: string) {
    const cleaned = prepareRichHtmlForSave(next)
    const prevHtml = getRichHtml(data, locale)
    // Don't wipe stored content with empty HTML from TipTap mount race.
    if (richHtmlIsEmpty(cleaned) && !richHtmlIsEmpty(prevHtml)) return
    onChange(locale, cleaned)
    const pruned = pruneEmbeddedTables(cleaned, Object.values(tablesRef.current))
    if (pruned.length !== Object.values(tablesRef.current).length) {
      const prunedMap = Object.fromEntries(pruned.map((tbl) => [tbl.id, tbl]))
      notifyParent(prunedMap)
    }
  }

  const editingTable = editingId ? tables[editingId] : null

  return (
    <div className="richDocumentEditor card">
      <SyncLinkedSchemaTables
        token={token}
        serviceId={serviceId}
        initial={data?.embedded_tables || []}
        onResolved={handleResolvedTables}
      />
      {editable && serviceId && pickOpen ? (
        <SchemaTablePickModal
          token={token}
          serviceId={serviceId}
          onClose={() => setPickOpen(false)}
          onConfirm={(table, opts) => {
            setPickOpen(false)
            if (opts?.openEdit) {
              upsertTable(table)
              pendingInsertRef.current = table.id
              setEditingId(table.id)
              return
            }
            const next = { ...tablesRef.current, [table.id]: table }
            upsertTable(table)
            notifyParent(next)
            setInsertTableId(table.id)
          }}
        />
      ) : null}
      {editable && editingTable ? (
        <SchemaTableEditModal
          table={editingTable}
          onClose={() => {
            const pendingId = pendingInsertRef.current
            if (pendingId && editingId === pendingId) {
              pendingInsertRef.current = null
              removeTable(pendingId)
              const next = Object.fromEntries(
                Object.entries(tablesRef.current).filter(([id]) => id !== pendingId),
              )
              notifyParent(next)
            }
            setEditingId(null)
          }}
          onSave={(updated) => {
            const next = { ...tablesRef.current, [updated.id]: updated }
            updateTable(updated.id, updated)
            notifyParent(next)
            if (pendingInsertRef.current === updated.id) {
              pendingInsertRef.current = null
              setInsertTableId(updated.id)
            }
            setEditingId(null)
          }}
        />
      ) : null}
      <RichTextEditor
        key={locale}
        value={html}
        locale={locale}
        editable={editable}
        enableSchemaTables={Boolean(serviceId)}
        placeholder={t('richTextPlaceholder')}
        insertTableId={insertTableId}
        onInsertTableDone={handleInsertTableDone}
        onOpenSchemaTablePick={serviceId ? () => setPickOpen(true) : undefined}
        onChange={handleHtmlChange}
        onUploadError={onUploadError}
        onUpload={async (file, opts) => {
          const id = rapportId || (await ensureRapportId?.())
          if (!id) {
            throw new Error('rapportTitleRequired')
          }
          const isVideo = file.type.startsWith('video/')
          const res = await api.uploadRapportFile(token, id, file, {
            onProgress: opts?.onProgress,
            signal: opts?.signal,
            timeoutMs: opts?.timeoutMs ?? (isVideo ? 15 * 60 * 1000 : 5 * 60 * 1000),
          })
          // Display URL uses short-lived signed dl token; save path strips it via prepareRichHtmlForSave.
          return { id: res.file.id, url: await signFileUrl(res.file.url_path) }
        }}
      />
    </div>
  )
}

export function RichDocumentView({
  data,
  locale,
  token,
  serviceId,
}: {
  data: Props['data']
  locale: string
  token?: string
  serviceId?: number
}) {
  // Match editor storage locale (AR-only when FR value inputs are off) + bilingual fallback in getRichHtml.
  const contentLang = contentLocale(locale)
  const html = usePreparedRichHtml(getRichHtml(data, contentLang))
  const tables = data?.embedded_tables || []
  const tableMap = Object.fromEntries(tables.map((t) => [t.id, t]))
  const ids = extractSchemaTableIds(html)
  const containerRef = useRef<HTMLDivElement>(null)
  const lightbox = useImageLightbox()

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.querySelectorAll('video').forEach((v) => {
      v.removeAttribute('controls')
      v.controls = false
      v.muted = true
      v.preload = 'metadata'
    })
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'IMG') {
        const img = target as HTMLImageElement
        if (!img.src) return
        e.preventDefault()
        lightbox.open(img.src, img.alt || '', 'image')
        return
      }
      const video =
        target.tagName === 'VIDEO'
          ? (target as HTMLVideoElement)
          : (target.closest('video') as HTMLVideoElement | null)
      if (video?.src) {
        e.preventDefault()
        e.stopPropagation()
        lightbox.openVideo(video.currentSrc || video.src)
      }
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [html, lightbox.open, lightbox.openVideo])

  if (!html && !ids.length) return null

  if (ids.length && ids.some((id) => tableMap[id])) {
    return (
      <>
        <SchemaTableProvider initialTables={tables} readOnly>
          <div ref={containerRef} className="richDocumentView card richDocumentViewZoomable">
            {token && serviceId ? (
              <SyncLinkedSchemaTables token={token} serviceId={serviceId} initial={tables} />
            ) : null}
            <RichTextEditor value={html} editable={false} enableSchemaTables locale={contentLang} onChange={() => {}} />
          </div>
        </SchemaTableProvider>
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

  if (!html || richHtmlIsEmpty(html)) return null
  return (
    <>
      <div
        ref={containerRef}
        className="richDocumentView card richDocumentViewZoomable"
        dangerouslySetInnerHTML={{ __html: html }}
      />
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

export function RichDocumentEditor(props: Props) {
  const initial = props.data?.embedded_tables || []
  return (
    <SchemaTableProvider initialTables={initial}>
      <RichDocumentEditorInner {...props} />
    </SchemaTableProvider>
  )
}
