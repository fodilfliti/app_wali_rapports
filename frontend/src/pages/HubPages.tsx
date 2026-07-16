import { useEffect, useState } from 'react'

import { useParams, useLocation } from 'react-router-dom'

import { useTranslation } from 'react-i18next'

import { BackButton } from '../components/BackButton'

import { HubTile } from '../components/HubTile'

import { HubCountBadge } from '../components/HubCountBadge'

import { serviceHubIcon } from '../components/HubIcons'

import { useOfficeHubCounts, useWaliHubCounts, useChefHubCounts } from '../hooks/useHubCounts'

import { findServiceNode, folderBackPath, serviceLabel } from '../utils/serviceTree'

import { TablePagination } from '../components/TablePagination'

import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'

import { HUB_COUNTS_REFRESH_EVENT } from '../utils/hubCountsRefresh'

import { PageLoading } from '../components/PageLoading'

import * as api from '../api'



export function AdminHubPage() {

  const { t } = useTranslation()

  return (

    <div className="page">

      <div className="pageHeader">

        <h1>{t('hubAdmin')}</h1>

      </div>

      <div className="hubGrid">

        <HubTile to="/municipalities" icon="municipalities" title={t('navMunicipalities')} />

        <HubTile to="/dairas" icon="folder" title={t('navDairas')} />

        <HubTile to="/directions" icon="services" title={t('navModiriyat')} />

        <HubTile to="/users" icon="users" title={t('navUsers')} />

        <HubTile to="/admin/rapports" icon="rapports" title={t('navRapports')} />

        <HubTile to="/admin/services" icon="services" title={t('navServices')} />

        <HubTile to="/admin/schemas" icon="schemas" title={t('navSchemas')} />

      </div>

    </div>

  )

}



export function OfficeHubPage({ token }: { token: string }) {

  const { t } = useTranslation()

  const { counts } = useOfficeHubCounts(token)

  return (

    <div className="page">

      <div className="pageHeader">

        <h1>{t('hubOffice')}</h1>

      </div>

      <div className="hubGrid">

        <HubTile
          to="/office/rapports"
          icon="rapports"
          title={t('navRapports')}
          badge={<HubCountBadge count={counts.changes_requested_rapports} />}
          subtitle={
            counts.changes_requested_rapports > 0 ? t('officeHubChangesRequestedHint') : undefined
          }
        />

        <HubTile
          to="/office/services"
          icon="services"
          title={t('navServices')}
          badge={<HubCountBadge count={counts.services_action_count} />}
          subtitle={counts.services_action_count > 0 ? t('officeHubServicesActionHint') : undefined}
        />

        <HubTile
          to="/office/notifications"
          icon="notifications"
          title={t('navNotifications')}
          badge={<HubCountBadge count={counts.unread_notifications} />}
        />

        <HubTile
          to="/office/shared"
          icon="shared"
          title={t('navSharedFiles')}
          badge={<HubCountBadge count={counts.unread_shared_files} />}
        />

        <HubTile
          to="/office/instructions"
          icon="document"
          title={t('navWaliInstructions')}
          badge={<HubCountBadge count={counts.unread_instructions} />}
        />

      </div>

    </div>

  )

}



export function WaliHubPage({ token }: { token: string }) {

  const { t } = useTranslation()

  const { counts } = useWaliHubCounts(token)

  return (

    <div className="page">

      <div className="pageHeader">

        <h1>{t('hubWali')}</h1>

      </div>

      <div className="hubGrid">

        <HubTile
          to="/wali/office-users"
          icon="officeUsers"
          title={t('navOfficeUsers')}
          badge={<HubCountBadge count={counts.office_users_pending} />}
          subtitle={counts.office_users_pending > 0 ? t('waliHubOfficeUsersBadgeHint') : undefined}
        />

        <HubTile
          to="/wali/rapports"
          icon="inbox"
          title={t('navInbox')}
          badge={<HubCountBadge count={counts.inbox_pending} />}
          subtitle={t('actionInboxHintShort')}
        />

        <HubTile
          to="/wali/rapports?view=discussion"
          icon="notifications"
          title={t('navDiscussion')}
          badge={<HubCountBadge count={counts.unread_discussion || 0} />}
          subtitle={t('discussionInboxHintShort')}
        />

        <HubTile to="/wali/calendar" icon="calendar" title={t('navCalendar')} />

        <HubTile to="/wali/shared" icon="shared" title={t('navSharedFiles')} />

        <HubTile to="/wali/instructions" icon="document" title={t('navWaliInstructions')} />

      </div>

    </div>

  )

}



export function ChefHubPage({ token }: { token: string }) {

  const { t } = useTranslation()

  const { counts } = useChefHubCounts(token)

  return (

    <div className="page">

      <div className="pageHeader">

        <h1>{t('hubChef')}</h1>

      </div>

      <div className="hubGrid">

        <HubTile
          to="/chef/office-users"
          icon="officeUsers"
          title={t('navOfficeUsers')}
          badge={<HubCountBadge count={counts.office_users_pending} />}
          subtitle={counts.office_users_pending > 0 ? t('waliHubOfficeUsersBadgeHint') : undefined}
        />

        <HubTile
          to="/chef/rapports"
          icon="inbox"
          title={t('navInbox')}
          badge={<HubCountBadge count={counts.inbox_pending} />}
          subtitle={t('actionInboxHintShort')}
        />

        <HubTile
          to="/chef/rapports?view=discussion"
          icon="notifications"
          title={t('navDiscussion')}
          badge={<HubCountBadge count={counts.unread_discussion || 0} />}
          subtitle={t('discussionInboxHintShort')}
        />

        <HubTile to="/chef/calendar" icon="calendar" title={t('navCalendar')} />

        <HubTile to="/chef/instructions" icon="document" title={t('navWaliInstructions')} />

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

  const location = useLocation()

  const fid = folderId ? Number(folderId) : undefined

  const { t, i18n } = useTranslation()

  const [services, setServices] = useState<any[]>([])

  const [page, setPage] = useState(1)

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api
      .listOfficeServiceTree(token)
      .then((r) => setServices(r.services))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, location.pathname])

  useEffect(() => {

    const refresh = () => {

      api.listOfficeServiceTree(token).then((r) => setServices(r.services)).catch(() => {})

    }

    window.addEventListener(HUB_COUNTS_REFRESH_EVENT, refresh)

    return () => window.removeEventListener(HUB_COUNTS_REFRESH_EVENT, refresh)

  }, [token])

  useEffect(() => {
    setPage(1)
  }, [fid])



  const folder = fid ? findServiceNode(services, fid) : null

  const items = folder ? folder.children || [] : services

  const pagedItems = paginateSlice(items, page, DEFAULT_PAGE_SIZE)

  const pageTitle = folder ? serviceLabel(folder, i18n.language) : t('navServices')

  const backTo = fid ? folderBackPath(services, fid, '/office/services') : '/office'



  return (

    <div className="page">

      <div className="pageHeader row">

        <h1>{pageTitle}</h1>

        <BackButton to={backTo} fallbackTo={backTo} />

      </div>

      {loading ? <PageLoading /> : null}

      <div className="hubGrid hubGridServices">

        {pagedItems.map((s: any) => {

          const label = serviceLabel(s, i18n.language)

          const to = s.is_folder

            ? `/office/services/folder/${s.id}`

            : `/office/services/${s.id}`

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

      {!items.length ? <p className="muted">{t('noResults')}</p> : null}

      <TablePagination page={page} total={items.length} onPageChange={setPage} />

    </div>

  )

}


