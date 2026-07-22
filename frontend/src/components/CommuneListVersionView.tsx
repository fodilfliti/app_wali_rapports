import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HubTile } from './HubTile'
import { TablePagination } from './TablePagination'
import { TableGridView, TableTitleBlock } from './TableGridView'
import { RichDocumentView } from './RichDocumentEditor'
import { CalendarEventsView } from './CalendarEventsEditor'
import { MediaRowsView } from './MediaBlocks'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import type { Column, LayoutJson } from '../utils/tableLayout'
import type { EmbeddedTable } from '../types/embeddedTable'
import type { MediaFile } from '../utils/media'
import {
  entityKey,
  getEntityEntry,
  parseEntityKey,
  type ParsedEntityKey,
} from '../utils/entityKeys'
import {
  listEntityUnitKey,
  type EntityTargetKind,
} from '../utils/entityTargets'
import {
  rowsWithCommuneNames,
  sortRowsByCommune,
  withCommuneNameColumn,
} from '../utils/communeBulkTable'

export type VersionEntityMeta = {
  entity_key?: string
  kind?: EntityTargetKind | string
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

const KIND_ORDER: Record<string, number> = {
  commune: 0,
  daira: 1,
  direction: 2,
}

function entityHasContent(entry?: CommuneEntry | null) {
  if (!entry) return false
  if (entry.rich_html_ar || entry.rich_html_fr) return true
  if (entry.blocks?.length) return true
  if (Array.isArray(entry.embedded_tables) && entry.embedded_tables.length > 0) {
    return true
  }
  if ((entry.rows || []).length > 0) return true
  if ((entry.calendar_events || []).length > 0) return true
  if ((entry.media_rows || []).length > 0) return true
  return false
}

function resolveEntityKey(m: VersionEntityMeta): string {
  if (m.entity_key) return m.entity_key
  const kind = (m.kind as EntityTargetKind) || 'commune'
  return entityKey(kind, m.code)
}

function kindLabelKey(kind?: string) {
  if (kind === 'daira') return 'entityTargetKind_daira'
  if (kind === 'direction') return 'entityTargetKind_direction'
  return 'entityTargetKind_commune'
}

type Props = {
  token: string
  serviceId?: number
  /** Entity catalog (all target kinds). Prefer this over municipalities. */
  entities?: VersionEntityMeta[]
  /** @deprecated Use entities — kept for callers that only pass communes. */
  municipalities?: VersionEntityMeta[]
  /** Prefixed entity map from version snapshot. */
  entitiesData?: Record<string, CommuneEntry>
  /** Legacy bare-code commune map (dual-read). */
  communes?: Record<string, CommuneEntry>
  schema?: { columns?: Column[]; layout_json?: LayoutJson | null } | null
  files?: Record<number, MediaFile>
  communeContentKind?: 'table' | 'complex' | string | null
  targetKinds?: unknown
  /** Optional title for the combined table view */
  tableTitle?: string
}

export function CommuneListVersionView({
  token,
  serviceId,
  entities,
  municipalities,
  entitiesData,
  communes,
  schema,
  files = {},
  communeContentKind,
  targetKinds,
  tableTitle,
}: Props) {
  const { t, i18n } = useTranslation()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [viewMode, setViewMode] = useState<'entity' | 'all'>('entity')

  const isTableMode = communeContentKind === 'table'
  const unitLabel = t(listEntityUnitKey(targetKinds))

  const catalog = useMemo(
    () => (entities?.length ? entities : municipalities) || [],
    [entities, municipalities],
  )

  const entitiesWithData = useMemo(() => {
    const byKey = new Map<string, VersionEntityMeta>()
    for (const m of catalog) {
      byKey.set(resolveEntityKey(m), m)
    }

    const keys = new Set<string>([
      ...Object.keys(entitiesData || {}),
      ...catalog.map((m) => resolveEntityKey(m)),
    ])
    // Legacy communes keys may be bare codes
    for (const code of Object.keys(communes || {})) {
      const parsed = parseEntityKey(code)
      if (parsed) keys.add(entityKey(parsed.kind, parsed.code))
    }

    const list: (VersionEntityMeta & {
      entity_key: string
      entry: CommuneEntry
      parsed: ParsedEntityKey
    })[] = []

    for (const key of keys) {
      const entry = getEntityEntry(entitiesData, communes, key) as
        | CommuneEntry
        | undefined
      if (!entityHasContent(entry)) continue
      const parsed = parseEntityKey(key)
      if (!parsed) continue
      const meta = byKey.get(key)
      list.push({
        entity_key: key,
        kind: meta?.kind || parsed.kind,
        code: meta?.code || parsed.code,
        name_ar: meta?.name_ar || parsed.code,
        name_fr: meta?.name_fr || parsed.code,
        is_changed: meta?.is_changed,
        entry: entry!,
        parsed,
      })
    }

    list.sort((a, b) => {
      const kindA = String(a.kind || 'commune')
      const kindB = String(b.kind || 'commune')
      const kindCmp = (KIND_ORDER[kindA] ?? 9) - (KIND_ORDER[kindB] ?? 9)
      if (kindCmp !== 0) return kindCmp
      return String(a.code).localeCompare(String(b.code), i18n.language, {
        numeric: true,
      })
    })
    return list
  }, [catalog, entitiesData, communes, i18n.language])

  const allTableRows = useMemo(() => {
    if (!isTableMode) return []
    const allRows: Record<string, unknown>[] = []
    for (const m of entitiesWithData) {
      const rows = m.entry.rows || []
      if (!rows.length) continue
      for (const r of rows) {
        allRows.push({
          ...r,
          municipality_code: m.code,
          _entity_key: m.entity_key,
          _entity_kind: m.kind,
          _municipality_name_ar: m.name_ar,
          _municipality_name_fr: m.name_fr,
        })
      }
    }
    return rowsWithCommuneNames(sortRowsByCommune(allRows), i18n.language)
  }, [isTableMode, entitiesWithData, i18n.language])

  useEffect(() => {
    setPage(1)
    setSelectedKey(entitiesWithData[0]?.entity_key ?? null)
  }, [entitiesWithData])

  useEffect(() => {
    setViewMode('entity')
  }, [communeContentKind, targetKinds])

  const paged = paginateSlice(entitiesWithData, page, DEFAULT_PAGE_SIZE)
  const selected =
    entitiesWithData.find(
      (m) => m.entity_key === (selectedKey || entitiesWithData[0]?.entity_key),
    ) || null
  const columns = schema?.columns || []
  const layoutJson = schema?.layout_json || null

  if (!entitiesWithData.length) {
    return <p className="muted communeEmptyHint">{t('noResults')}</p>
  }

  return (
    <>
      <p className="muted communeListIntro">
        {t('entityListIntro', { unit: unitLabel })}
      </p>
      {isTableMode ? (
        <div className="communeViewModeBar">
          <button
            type="button"
            className={`btn btn-secondary btn-sm${viewMode === 'entity' ? ' active' : ''}`}
            onClick={() => setViewMode('entity')}
          >
            {t('entityViewBy', { unit: unitLabel })}
          </button>
          <button
            type="button"
            className={`btn btn-secondary btn-sm${viewMode === 'all' ? ' active' : ''}`}
            onClick={() => setViewMode('all')}
          >
            {t('entityViewAll', { unit: unitLabel })}
          </button>
        </div>
      ) : null}

      {viewMode === 'all' && isTableMode ? (
        <div className="card tableWrap excelTable communeWaliPanel">
          <TableTitleBlock
            tableMeta={{
              title_ar: tableTitle,
              title_fr: tableTitle,
            }}
            editable={false}
          />
          {allTableRows.length ? (
            <TableGridView
              columns={withCommuneNameColumn(columns)}
              rows={allTableRows}
              layoutJson={layoutJson}
              editable={false}
              showRowMeta
              rowFilterMode="active"
            />
          ) : (
            <p className="muted communeEmptyHint">{t('noResults')}</p>
          )}
        </div>
      ) : (
        <>
          <div className="hubGrid communeHubGrid">
            {paged.map((m) => (
              <HubTile
                key={m.entity_key}
                icon="communes"
                title={
                  i18n.language === 'fr'
                    ? m.name_fr || m.code
                    : m.name_ar || m.code
                }
                subtitle={`${t(kindLabelKey(String(m.kind)))} · ${
                  m.is_changed ? t('communeChanged') : t('communeFilled')
                }`}
                className={`${
                  selected?.entity_key === m.entity_key
                    ? 'communeHubTileFilled'
                    : ''
                } ${m.is_changed ? 'communeHubTileChanged' : ''}`}
                onClick={() => setSelectedKey(m.entity_key)}
                badge={
                  m.is_changed ? (
                    <span className="badge badge-accent">{t('new')}</span>
                  ) : null
                }
              />
            ))}
          </div>
          <TablePagination
            page={page}
            total={entitiesWithData.length}
            onPageChange={setPage}
          />

          {selected ? (
            <div className="card communeWaliPanel">
              <h2 className="communeWaliPanelTitle">
                {i18n.language === 'fr' ? selected.name_fr : selected.name_ar}
                <span className="muted small communeWaliPanelCode">
                  {' '}
                  ({selected.code}) · {t(kindLabelKey(String(selected.kind)))}
                </span>
              </h2>
              <RichDocumentView
                data={{
                  rich_html_ar: selected.entry.rich_html_ar,
                  rich_html_fr: selected.entry.rich_html_fr,
                  blocks: selected.entry.blocks,
                  embedded_tables: (selected.entry.embedded_tables ||
                    []) as EmbeddedTable[],
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
                    showRowMeta
                    rowFilterMode="active"
                  />
                </div>
              ) : null}
              {(selected.entry.calendar_events || []).length > 0 ? (
                <CalendarEventsView
                  events={selected.entry.calendar_events as any[]}
                />
              ) : null}
              <MediaRowsView
                rows={selected.entry.media_rows || []}
                files={files}
                token={token}
              />
            </div>
          ) : null}
        </>
      )}
    </>
  )
}
