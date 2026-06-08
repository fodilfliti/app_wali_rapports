import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BackButton } from '../components/BackButton'
import { HubTile } from '../components/HubTile'
import { serviceHubIcon } from '../components/HubIcons'
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
        <HubTile to="/users" icon="users" title={t('navUsers')} />
        <HubTile to="/admin/rapports" icon="rapports" title={t('navRapports')} />
        <HubTile to="/admin/departments" icon="folder" title={t('departmentsSection')} />
        <HubTile to="/admin/services" icon="services" title={t('navServices')} />
        <HubTile to="/admin/schemas" icon="schemas" title={t('navSchemas')} />
        <HubTile to="/access" icon="access" title={t('navAccess')} />
      </div>
    </div>
  )
}

export function OfficeHubPage() {
  const { t } = useTranslation()
  return (
    <div className="page">
      <div className="pageHeader">
        <h1>{t('hubOffice')}</h1>
      </div>
      <div className="hubGrid">
        <HubTile to="/office/rapports" icon="rapports" title={t('navRapports')} />
        <HubTile to="/office/services" icon="services" title={t('navServices')} />
        <HubTile to="/office/notifications" icon="notifications" title={t('navNotifications')} />
        <HubTile to="/office/shared" icon="shared" title={t('navSharedFiles')} />
      </div>
    </div>
  )
}

export function WaliHubPage() {
  const { t } = useTranslation()
  return (
    <div className="page">
      <div className="pageHeader">
        <h1>{t('hubWali')}</h1>
      </div>
      <div className="hubGrid">
        <HubTile to="/wali/office-users" icon="officeUsers" title={t('navOfficeUsers')} />
        <HubTile to="/wali/rapports" icon="inbox" title={t('navInbox')} />
        <HubTile to="/wali/calendar" icon="calendar" title={t('navCalendar')} />
        <HubTile to="/wali/shared" icon="shared" title={t('navSharedFiles')} />
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

function serviceLink(s: any) {
  if (s.is_folder) return `/office/services`
  return `/office/services/${s.id}`
}

export function OfficeServicesPage({ token }: { token: string }) {
  const { t, i18n } = useTranslation()
  const [services, setServices] = useState<any[]>([])

  useEffect(() => {
    api.listOfficeServiceTree(token).then((r) => setServices(r.services)).catch(() => {})
  }, [token])

  function renderService(s: any) {
    const label = i18n.language === 'fr' ? s.name_fr : s.name_ar
    if (s.is_folder && s.children?.length) {
      return (
        <div key={s.id} className="serviceFolder">
          <h3>{label}</h3>
          <div className="hubGrid nested">{s.children.map((c: any) => renderService(c))}</div>
        </div>
      )
    }
    const kinds = (s.rapportTypes || []).map((t: any) => t.content_kind)
    const kindLabel = kinds.length
      ? kinds.map((k: string) => t(`contentKind_${k}`)).join(' · ')
      : t('noResults')
    return (
      <HubTile
        key={s.id}
        to={serviceLink(s)}
        icon={serviceHubIcon(s)}
        title={label}
        subtitle={kindLabel}
      />
    )  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navServices')}</h1>
        <BackButton fallbackTo="/office" />
      </div>
      {services.map((s) => renderService(s))}
      {!services.length ? <p className="muted">{t('noResults')}</p> : null}
    </div>
  )
}
