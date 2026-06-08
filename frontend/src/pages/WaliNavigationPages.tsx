import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { HubTile } from '../components/HubTile'
import { serviceHubIcon } from '../components/HubIcons'

type Props = { token: string }

export function WaliOfficeUsersPage({ token }: Props) {
  const { t } = useTranslation()
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    api.listWaliOfficeUsers(token).then((r) => setUsers(r.officeUsers)).catch(() => {})
  }, [token])

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navOfficeUsers')}</h1>
        <BackButton fallbackTo="/wali" />
      </div>
      <div className="hubGrid">
        {users.map((u) => (
          <HubTile
            key={u.id}
            to={`/wali/office-users/${u.id}/services`}
            icon="users"
            title={u.name || u.username}
            subtitle={u.job_title || undefined}
            badge={
              u.pending_rapports_count > 0 ? (
                <span className="badge badge-submitted">{u.pending_rapports_count}</span>
              ) : undefined
            }
          />
        ))}
        {!users.length ? <p className="muted">{t('noResults')}</p> : null}
      </div>
    </div>
  )
}

export function WaliUserServicesPage({ token, userId }: Props & { userId: number }) {
  const { t, i18n } = useTranslation()
  const [services, setServices] = useState<any[]>([])

  useEffect(() => {
    api.listWaliUserServices(token, userId).then((r) => setServices(r.services)).catch(() => {})
  }, [token, userId])

  function renderService(s: any) {
    const label = i18n.language === 'fr' ? s.name_fr : s.name_ar
    if (s.is_folder && s.children?.length) {
      return (
        <div key={s.id} className="serviceFolder">
          <h3>{label}</h3>
          <div className="hubGrid nested">
            {s.children.map((c: any) => renderService(c))}
          </div>
        </div>
      )
    }
    const kind = s.rapportTypes?.[0]?.content_kind || 'table_grid'
    return (
      <HubTile
        key={s.id}
        to={`/wali/rapports?service_id=${s.id}`}
        icon={serviceHubIcon(s)}
        title={label}
        subtitle={t(`contentKind_${kind}`)}
      />
    )
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navServices')}</h1>
        <BackButton fallbackTo="/wali/office-users" />
      </div>
      {services.map((s) => renderService(s))}
    </div>
  )
}
