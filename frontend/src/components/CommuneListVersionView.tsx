import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HubTile } from './HubTile'
import { TablePagination } from './TablePagination'
import { TableGridView } from './TableGridView'
import { RichDocumentView } from './RichDocumentEditor'
import { CalendarEventsView } from './CalendarEventsEditor'
import { MediaRowsView } from './MediaBlocks'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import type { Column, LayoutJson } from '../utils/tableLayout'
import type { MediaFile } from '../utils/media'

type Municipality = {
  code: string
  name_ar?: string
  name_fr?: string
  is_changed?: boolean
}

type CommuneEntry = {
  rich_html_ar?: string
  rich_html_fr?: string
  blocks?: unknown[]
  embedded_tables?: unknown
  rows?: Record<string, unknown>[]
  calendar_events?: unknown[]
  media_rows?: { items: { file_id: number }[] }[]
}

function communeHasContent(entry?: CommuneEntry | null) {
  if (!entry) return false
  if (entry.rich_html_ar || entry.rich_html_fr) return true
  if (entry.blocks?.length) return true
  if ((entry.rows || []).length > 0) return true
  if ((entry.calendar_events || []).length > 0) return true
  if ((entry.media_rows || []).length > 0) return true
  return false
}

type Props = {
  token: string
  serviceId?: number
  municipalities: Municipality[]
  communes: Record<string, CommuneEntry>
  schema?: { columns?: Column[]; layout_json?: LayoutJson | null } | null
  files?: Record<number, MediaFile>
}

export function CommuneListVersionView({
  token,
  serviceId,
  municipalities,
  communes,
  schema,
  files = {},
}: Props) {
  const { t, i18n } = useTranslation()
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const communesWithData = useMemo(() => {
    const byCode = new Map(municipalities.map((m) => [String(m.code), m]))
    const codes = new Set([
      ...Object.keys(communes || {}),
      ...municipalities.map((m) => String(m.code)),
    ])
    const list: (Municipality & { entry: CommuneEntry })[] = []
    for (const code of codes) {
      const entry = communes?.[code]
      if (!communeHasContent(entry)) continue
      const meta = byCode.get(code)
      list.push({
        code,
        name_ar: meta?.name_ar || code,
        name_fr: meta?.name_fr || code,
        is_changed: meta?.is_changed,
        entry: entry!,
      })
    }
    list.sort((a, b) =>
      String(a.code).localeCompare(String(b.code), i18n.language, { numeric: true }),
    )
    return list
  }, [communes, municipalities, i18n.language])

  useEffect(() => {
    setPage(1)
    setSelectedCode(communesWithData[0]?.code ?? null)
  }, [communesWithData])

  const paged = paginateSlice(communesWithData, page, DEFAULT_PAGE_SIZE)
  const selected =
    communesWithData.find((m) => m.code === (selectedCode || communesWithData[0]?.code)) || null
  const columns = schema?.columns || []
  const layoutJson = schema?.layout_json || null

  if (!communesWithData.length) {
    return <p className="muted communeEmptyHint">{t('noResults')}</p>
  }

  return (
    <>
      <p className="muted communeListIntro">{t('communeListIntro')}</p>
      <div className="hubGrid communeHubGrid">
        {paged.map((m) => (
          <HubTile
            key={m.code}
            icon="communes"
            title={i18n.language === 'fr' ? m.name_fr || m.code : m.name_ar || m.code}
            subtitle={m.is_changed ? t('communeChanged') : t('communeFilled')}
            className={`${selected?.code === m.code ? 'communeHubTileFilled' : ''} ${
              m.is_changed ? 'communeHubTileChanged' : ''
            }`}
            onClick={() => setSelectedCode(m.code)}
            badge={m.is_changed ? <span className="badge badge-accent">{t('new')}</span> : null}
          />
        ))}
      </div>
      <TablePagination page={page} total={communesWithData.length} onPageChange={setPage} />

      {selected ? (
        <div className="card communeWaliPanel">
          <h2 className="communeWaliPanelTitle">
            {i18n.language === 'fr' ? selected.name_fr : selected.name_ar}
            <span className="muted small communeWaliPanelCode"> ({selected.code})</span>
          </h2>
          <RichDocumentView
            data={{
              rich_html_ar: selected.entry.rich_html_ar,
              rich_html_fr: selected.entry.rich_html_fr,
              blocks: selected.entry.blocks,
              embedded_tables: selected.entry.embedded_tables,
            }}
            locale={i18n.language}
            token={token}
            serviceId={serviceId}
          />
          {(selected.entry.rows || []).length > 0 ? (
            <div className="tableWrap excelTable">
              <TableGridView
                columns={columns}
                rows={selected.entry.rows || []}
                layoutJson={layoutJson}
                editable={false}
              />
            </div>
          ) : null}
          {(selected.entry.calendar_events || []).length > 0 ? (
            <CalendarEventsView events={selected.entry.calendar_events as any[]} />
          ) : null}
          <MediaRowsView
            rows={selected.entry.media_rows || []}
            files={files}
            token={token}
          />
        </div>
      ) : null}
    </>
  )
}
