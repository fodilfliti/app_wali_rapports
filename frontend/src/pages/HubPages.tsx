import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { useParams } from 'react-router-dom'

import { useTranslation } from 'react-i18next'

import type { TFunction } from 'i18next'

import { resolveHubTiles, type HubTileDef } from '@wali/access-policy'

import { useAuthOptional } from '../auth/AuthProvider'

import { BackButton } from '../components/BackButton'

import { HubTile } from '../components/HubTile'

import { HubCountBadge } from '../components/HubCountBadge'

import { serviceHubIcon, type HubIconName } from '../components/HubIcons'

import { useOfficeHubCounts, useWaliHubCounts, useChefHubCounts } from '../hooks/useHubCounts'

import { findServiceNode, folderBackPath, serviceLabel } from '../utils/serviceTree'

import { TablePagination } from '../components/TablePagination'

import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'

import { QueryListShell } from '../components/QueryListShell'

import { useOfficeServiceTreeQuery } from '../hooks/queries/useListQueries'

import { ENABLE_GUIDE_VIDEOS } from '../config/features'

import { asEntityId } from '../utils/entityIds'

import type { ChefHubCounts, OfficeHubCounts, WaliHubCounts } from '../api'

const HUB_TILE_TITLE_KEYS: Record<string, string> = {
  municipalities: 'navMunicipalities',
  dairas: 'navDairas',
  directions: 'navDirections',
  users: 'navUsers',
  rapports: 'navRapports',
  services: 'navServices',
  schemas: 'navSchemas',
  guide: 'navGuideVideos',
  access: 'navAccess',
  discussion: 'navDiscussion',
  notifications: 'navNotifications',
  shared: 'navSharedFiles',
  instructions: 'navWaliInstructions',
  chef_instructions: 'navChefInstructions',
  office_users: 'navOfficeUsers',
  inbox: 'navInbox',
  delete_requested: 'statusGroupDeleteRequested',
  calendar: 'navCalendar',
}

const HUB_TILE_ICONS: Record<string, HubIconName> = {
  municipalities: 'municipalities',
  dairas: 'folder',
  directions: 'services',
  users: 'users',
  rapports: 'rapports',
  services: 'services',
  schemas: 'schemas',
  guide: 'guide',
  access: 'access',
  discussion: 'notifications',
  notifications: 'notifications',
  shared: 'shared',
  instructions: 'document',
  chef_instructions: 'document',
  office_users: 'officeUsers',
  inbox: 'inbox',
  delete_requested: 'inbox',
  calendar: 'calendar',
}

type HubTileExtras = { badge?: ReactNode; subtitle?: string }

function officeHubTileExtras(tile: HubTileDef, counts: OfficeHubCounts, t: TFunction): HubTileExtras {
  switch (tile.id) {
    case 'services':
      return {
        badge: <HubCountBadge count={counts.services_action_count} />,
        subtitle: counts.services_action_count > 0 ? t('officeHubServicesActionHint') : undefined,
      }
    case 'rapports':
      return {
        badge: <HubCountBadge count={counts.changes_requested_rapports} />,
        subtitle:
          counts.changes_requested_rapports > 0 ? t('officeHubChangesRequestedHint') : undefined,
      }
    case 'discussion':
      return {
        badge: <HubCountBadge count={counts.unread_discussion || 0} />,
        subtitle: t('discussionInboxHintShort'),
      }
    case 'notifications':
      return { badge: <HubCountBadge count={counts.unread_notifications} /> }
    case 'shared':
      return { badge: <HubCountBadge count={counts.unread_shared_files} /> }
    case 'instructions':
      return { badge: <HubCountBadge count={counts.unread_instructions} /> }
    case 'chef_instructions':
      return { badge: <HubCountBadge count={counts.unread_chef_instructions || 0} /> }
    default:
      return {}
  }
}

function waliHubTileExtras(tile: HubTileDef, counts: WaliHubCounts, t: TFunction): HubTileExtras {
  switch (tile.id) {
    case 'office_users':
      return {
        badge: <HubCountBadge count={counts.office_users_pending} />,
        subtitle: counts.office_users_pending > 0 ? t('waliHubOfficeUsersBadgeHint') : undefined,
      }
    case 'inbox':
      return {
        badge: <HubCountBadge count={counts.inbox_pending} />,
        subtitle: t('actionInboxHintShort'),
      }
    case 'discussion':
      return {
        badge: <HubCountBadge count={counts.unread_discussion || 0} />,
        subtitle: t('discussionInboxHintShort'),
      }
    case 'shared':
      return { badge: <HubCountBadge count={counts.unread_shared_files || 0} /> }
    case 'chef_instructions':
      return { badge: <HubCountBadge count={counts.unread_chef_instructions || 0} /> }
    default:
      return {}
  }
}

function chefHubTileExtras(tile: HubTileDef, counts: ChefHubCounts, t: TFunction): HubTileExtras {
  switch (tile.id) {
    case 'office_users':
      return {
        badge: <HubCountBadge count={counts.office_users_pending} />,
        subtitle: counts.office_users_pending > 0 ? t('waliHubOfficeUsersBadgeHint') : undefined,
      }
    case 'inbox':
      return {
        badge: (
          <HubCountBadge count={(counts.inbox_pending || 0) + (counts.delete_pending || 0)} />
        ),
        subtitle: t('actionInboxHintShort'),
      }
    case 'delete_requested':
      return {
        badge: <HubCountBadge count={counts.delete_pending || 0} />,
        subtitle: t('chefDeletePendingHint'),
      }
    case 'discussion':
      return {
        badge: <HubCountBadge count={counts.unread_discussion || 0} />,
        subtitle: t('discussionInboxHintShort'),
      }
    case 'shared':
      return { badge: <HubCountBadge count={counts.unread_shared_files || 0} /> }
    case 'chef_instructions':
      return { badge: <HubCountBadge count={counts.unread_chef_instructions || 0} /> }
    default:
      return {}
  }
}

function HubTileList({
  tiles,
  t,
  getExtras,
}: {
  tiles: HubTileDef[]
  t: TFunction
  getExtras?: (tile: HubTileDef) => HubTileExtras
}) {
  return (
    <>
      {tiles.map((tile) => {
        const extras = getExtras?.(tile) ?? {}
        return (
          <HubTile
            key={tile.id}
            to={tile.to}
            icon={HUB_TILE_ICONS[tile.id] ?? 'document'}
            title={t(HUB_TILE_TITLE_KEYS[tile.id] ?? tile.id)}
            badge={extras.badge}
            subtitle={extras.subtitle}
          />
        )
      })}
    </>
  )
}

export function AdminHubPage() {
  const { t } = useTranslation()
  const auth = useAuthOptional()
  const tiles = useMemo(
    () =>
      resolveHubTiles('ADMIN', {
        guideVideos: ENABLE_GUIDE_VIDEOS,
        isSuperAdmin: Boolean(auth?.me?.is_super_admin),
      }),
    [auth?.me?.is_super_admin],
  )

  return (
    <div className="page">
      <div className="pageHeader">
        <h1>{t('hubAdmin')}</h1>
      </div>
      <div className="hubGrid">
        <HubTileList tiles={tiles} t={t} />
      </div>
    </div>
  )
}

export function OfficeHubPage({ token }: { token: string }) {
  const { t } = useTranslation()
  const { counts } = useOfficeHubCounts(token)
  const tiles = useMemo(
    () => resolveHubTiles('OFFICE_USER', { guideVideos: ENABLE_GUIDE_VIDEOS }),
    [],
  )

  return (
    <div className="page">
      <div className="pageHeader">
        <h1>{t('hubOffice')}</h1>
      </div>
      <div className="hubGrid">
        <HubTileList
          tiles={tiles}
          t={t}
          getExtras={(tile) => officeHubTileExtras(tile, counts, t)}
        />
      </div>
    </div>
  )
}

export function WaliHubPage({ token }: { token: string }) {
  const { t } = useTranslation()
  const { counts } = useWaliHubCounts(token)
  const tiles = useMemo(
    () => resolveHubTiles('WALI', { guideVideos: ENABLE_GUIDE_VIDEOS }),
    [],
  )

  return (
    <div className="page">
      <div className="pageHeader">
        <h1>{t('hubWali')}</h1>
      </div>
      <div className="hubGrid">
        <HubTileList tiles={tiles} t={t} getExtras={(tile) => waliHubTileExtras(tile, counts, t)} />
      </div>
    </div>
  )
}

export function ChefHubPage({ token }: { token: string }) {
  const { t } = useTranslation()
  const { counts } = useChefHubCounts(token)
  const tiles = useMemo(
    () => resolveHubTiles('CHEF_CABINET', { guideVideos: ENABLE_GUIDE_VIDEOS }),
    [],
  )

  return (
    <div className="page">
      <div className="pageHeader">
        <h1>{t('hubChef')}</h1>
      </div>
      <div className="hubGrid">
        <HubTileList tiles={tiles} t={t} getExtras={(tile) => chefHubTileExtras(tile, counts, t)} />
      </div>
    </div>
  )
}



export function AdminAccessPage() {

  const { t } = useTranslation()

  return (

    <div className="page">

      <div className="pageHeader row">

        <h1>{t('navAccess')}</h1>

        <BackButton fallbackTo="/" />

      </div>

      <p className="muted">{t('navAccess')}</p>

    </div>

  )

}



export function OfficeServicesPage({ token }: { token: string }) {

  const { folderId } = useParams()

  const fid = asEntityId(folderId)

  const { t, i18n } = useTranslation()

  const [page, setPage] = useState(1)

  const treeQuery = useOfficeServiceTreeQuery(token)
  const services = treeQuery.data ?? []
  const isInitialLoading = treeQuery.isLoading && !treeQuery.data
  const isRefreshing = treeQuery.isFetching && !treeQuery.isLoading

  useEffect(() => {
    setPage(1)
  }, [fid])



  const folder = fid ? findServiceNode(services, fid) : null

  const items = folder ? folder.children || [] : services

  const pagedItems = paginateSlice(items, page, DEFAULT_PAGE_SIZE)

  const pageTitle = folder ? serviceLabel(folder, i18n.language) : t('navServices')

  const backTo = fid ? folderBackPath(services, fid, '/cabinet/services') : '/cabinet'



  return (

    <div className="page">

      <div className="pageHeader row">

        <h1>{pageTitle}</h1>

        <BackButton to={backTo} fallbackTo={backTo} />

      </div>

      <QueryListShell isInitialLoading={isInitialLoading} isRefreshing={isRefreshing}>

      <div className="hubGrid hubGridServices">

        {pagedItems.map((s: any) => {

          const label = serviceLabel(s, i18n.language)

          const to = s.is_folder

            ? `/cabinet/services/folder/${s.id}`

            : `/cabinet/services/${s.id}`

          return (

            <HubTile

              key={s.id}

              to={to}

              icon={s.is_folder ? 'folder' : serviceHubIcon(s)}

              title={label}

              badge={Number(s.action_count) > 0 ? <HubCountBadge count={Number(s.action_count)} /> : undefined}

            />

          )

        })}

      </div>

      {!items.length && !isInitialLoading ? <p className="muted">{t('noResults')}</p> : null}

      <TablePagination page={page} total={items.length} onPageChange={setPage} />

      </QueryListShell>

    </div>

  )

}


