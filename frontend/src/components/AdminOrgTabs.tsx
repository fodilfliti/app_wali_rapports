import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

function tabClass({ isActive }: { isActive: boolean }) {
  return `schemasPanelTab adminOrgTab${isActive ? ' active' : ''}`
}

export function AdminOrgTabs() {
  const { t } = useTranslation()

  return (
    <nav className="schemasPanelTabs adminOrgTabs" aria-label={t('adminOrgNav')}>
      <NavLink to="/admin/departments" className={tabClass} end>
        {t('departmentsSection')}
      </NavLink>
      <NavLink to="/admin/services" className={tabClass} end>
        {t('navServices')}
      </NavLink>
    </nav>
  )
}
