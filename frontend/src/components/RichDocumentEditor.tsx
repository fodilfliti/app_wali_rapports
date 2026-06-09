import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import type { EmbeddedTable } from '../types/embeddedTable'
import { pruneEmbeddedTables } from '../types/embeddedTable'
import { fileUrl } from '../utils/media'
import { getRichHtml } from '../utils/richDocument'
import { embeddedTablesEqual, resolveEmbeddedTables } from '../utils/embeddedTableSchema'
import { RichTextEditor } from './richText/RichTextEditor'
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
  rapportId: number
  serviceId?: number
}

function SyncLinkedSchemaTables({
  token,
  serviceId,
  initial,
  onResolved,
}: {
  token: string
  serviceId?: number
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
  serviceId,
}: Props) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'fr' ? 'fr' : 'ar'
  const html = getRichHtml(data, locale)
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
    onChange(locale, next)
    const pruned = pruneEmbeddedTables(next, Object.values(tablesRef.current))
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
        key={`${rapportId}-${locale}`}
        value={html}
        locale={locale}
        editable={editable}
        enableSchemaTables={Boolean(serviceId)}
        placeholder={t('richTextPlaceholder')}
        insertTableId={insertTableId}
        onInsertTableDone={handleInsertTableDone}
        onOpenSchemaTablePick={serviceId ? () => setPickOpen(true) : undefined}
        onChange={handleHtmlChange}
        onUpload={async (file) => {
          const res = await api.uploadRapportFile(token, rapportId, file)
          return { id: res.file.id, url: fileUrl(token, res.file) }
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
  const html = getRichHtml(data, locale)
  const tables = data?.embedded_tables || []
  const tableMap = Object.fromEntries(tables.map((t) => [t.id, t]))
  const ids = extractSchemaTableIds(html)

  if (!html && !ids.length) return null

  if (ids.length && ids.some((id) => tableMap[id])) {
    return (
      <SchemaTableProvider initialTables={tables} readOnly>
        <div className="richDocumentView card">
          {token && serviceId ? (
            <SyncLinkedSchemaTables token={token} serviceId={serviceId} initial={tables} />
          ) : null}
          <RichTextEditor value={html} editable={false} enableSchemaTables locale={locale} onChange={() => {}} />
        </div>
      </SchemaTableProvider>
    )
  }

  if (!html || html === '<p></p>') return null
  return <div className="richDocumentView card" dangerouslySetInnerHTML={{ __html: html }} />
}

export function RichDocumentEditor(props: Props) {
  const initial = props.data?.embedded_tables || []
  return (
    <SchemaTableProvider key={props.rapportId} initialTables={initial}>
      <RichDocumentEditorInner {...props} />
    </SchemaTableProvider>
  )
}
