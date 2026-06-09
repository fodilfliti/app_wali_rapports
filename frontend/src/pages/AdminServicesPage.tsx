import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { hasBilingualText } from '../utils/bilingual'
import { AdminOrgTabs } from '../components/AdminOrgTabs'
import { BackButton } from '../components/BackButton'
import { ExpandableHelp } from '../components/ExpandableHelp'
import { TablePagination } from '../components/TablePagination'
import { localizedName } from '../utils/schemaColumns'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'

type Props = { token: string }

type GrantRow = { user_id: number; access_level: 'view' | 'manage'; enabled: boolean }

const emptyForm = () => ({
  department_id: '',
  name_ar: '',
  name_fr: '',
  is_folder: false,
  parent_service_id: '',
  sort_order: '0',
})

export function AdminServicesPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [services, setServices] = useState<any[]>([])
  const [departments, setDepartments] = useState<any[]>([])
  const [officeUsers, setOfficeUsers] = useState<any[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [grantsOpen, setGrantsOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [grantPage, setGrantPage] = useState(1)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [grantRows, setGrantRows] = useState<GrantRow[]>([])
  const [form, setForm] = useState(emptyForm())

  const load = useCallback(async () => {
    try {
      const [svcRes, usersRes, deptRes] = await Promise.all([
        api.listAdminServices(token),
        api.listAdminOfficeUsers(token),
        api.listAdminDepartments(token),
      ])
      setServices(svcRes.services)
      setOfficeUsers(usersRes.users)
      setDepartments(deptRes.departments)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [token, snack, t])

  useEffect(() => {
    load()
  }, [load])

  function openCreateModal() {
    setForm(emptyForm())
    setCreateOpen(true)
  }

  async function createService() {
    if (!form.department_id) {
      snack.show(t('servicesDepartmentRequired'), 'error')
      return
    }
    if (!hasBilingualText(form.name_ar, form.name_fr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return
    }
    try {
      await api.createAdminService(token, {
        department_id: Number(form.department_id),
        name_ar: form.name_ar.trim() || form.name_fr.trim(),
        name_fr: form.name_fr.trim() || form.name_ar.trim(),
        is_folder: form.is_folder,
        parent_service_id: form.is_folder || !form.parent_service_id ? null : Number(form.parent_service_id),
        sort_order: Number(form.sort_order) || 0,
      })
      setCreateOpen(false)
      load()
      snack.show(t('save'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function openGrants(service: any) {
    setSelectedService(service)
    try {
      const res = await api.listServiceGrants(token, service.id)
      const existing = new Map(res.grants.map((g: any) => [Number(g.user_id), g.access_level]))
      setGrantRows(
        officeUsers.map((u) => ({
          user_id: Number(u.id),
          access_level: (existing.get(Number(u.id)) as 'view' | 'manage') || 'view',
          enabled: existing.has(Number(u.id)),
        })),
      )
      setGrantPage(1)
      setGrantsOpen(true)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function saveGrants() {
    if (!selectedService) return
    try {
      await api.saveServiceGrants(
        token,
        selectedService.id,
        grantRows
          .filter((g) => g.enabled)
          .map((g) => ({ user_id: Number(g.user_id), access_level: g.access_level })),
      )
      setGrantsOpen(false)
      load()
      snack.show(t('save'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  const folders = services.filter((s) => s.is_folder && !s.parent_service_id)
  const pagedServices = paginateSlice(services, page, DEFAULT_PAGE_SIZE)
  const pagedGrantRows = paginateSlice(grantRows, grantPage, DEFAULT_PAGE_SIZE)

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navServices')}</h1>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          {t('createService')}
        </button>
        <BackButton fallbackTo="/" />
      </div>

      <AdminOrgTabs />

      <p className="muted">{t('servicesShareHelp')}</p>

      <div className="schemasPageIntro card">
        <p className="schemasPageIntroLead">{t('servicesPageIntro')}</p>
        <ol className="schemasPageSteps muted small">
          <li>{t('servicesPageStep1')}</li>
          <li>{t('servicesPageStep2')}</li>
          <li>{t('servicesPageStep3')}</li>
        </ol>
      </div>

      <div className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>{t('rapportTitle')}</th>
              <th>{t('serviceTypeLabel')}</th>
              <th>{t('serviceGrants')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {pagedServices.length ? (
              pagedServices.map((s) => (
                <tr key={s.id}>
                  <td>{localizedName(s, i18n.language)}</td>
                  <td>{s.is_folder ? t('serviceFolder') : t('serviceLeaf')}</td>
                  <td>
                    {s.grant_count ?? 0}
                    {s.is_folder && (s.grant_count ?? 0) > 0 ? (
                      <span className="muted small serviceFolderGrantHint"> ({t('serviceFolderGrantsRollup')})</span>
                    ) : null}
                  </td>
                  <td>
                    {!s.is_folder ? (
                      <button type="button" className="btn btn-ghost" onClick={() => openGrants(s)}>
                        {t('shareService')}
                      </button>
                    ) : (s.grant_count ?? 0) > 0 ? (
                      <span className="muted small">{t('serviceFolderShareViaChildren')}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="schemasEmptyRow muted">
                  {t('servicesEmpty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} total={services.length} onPageChange={setPage} />

      {createOpen ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{t('createService')}</h2>
            <p className="muted small">{t('servicesCreateHint')}</p>

            <label>
              <span className="fieldLabel">{t('department')}</span>
              <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                <option value="">{t('selectDepartment')}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {i18n.language === 'fr' ? d.name_fr : d.name_ar}
                  </option>
                ))}
              </select>
            </label>
            {!departments.length ? (
              <p className="muted small">
                {t('servicesNoDepartmentsHint')}{' '}
                <Link to="/admin/departments" className="inlineLink">
                  {t('createDepartment')}
                </Link>
              </p>
            ) : null}
            <ExpandableHelp title={t('servicesDepartmentHelpTitle')} className="contentKindHelpExpand">
              <p className="muted small">{t('servicesDepartmentHelp')}</p>
            </ExpandableHelp>

            <label>
              <span className="fieldLabel">{t('municipalityNameAr')}</span>
              <input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
            </label>
            <label>
              <span className="fieldLabel">{t('municipalityNameFr')}</span>
              <input value={form.name_fr} onChange={(e) => setForm({ ...form, name_fr: e.target.value })} />
            </label>

            <fieldset className="serviceTypePick">
              <legend className="fieldLabel">{t('serviceTypeLabel')}</legend>
              <label className="schemaColumnCheck serviceTypeOption">
                <input
                  type="radio"
                  name="serviceKind"
                  checked={!form.is_folder}
                  onChange={() => setForm({ ...form, is_folder: false })}
                />
                <span>{t('serviceLeaf')}</span>
              </label>
              <label className="schemaColumnCheck serviceTypeOption">
                <input
                  type="radio"
                  name="serviceKind"
                  checked={form.is_folder}
                  onChange={() => setForm({ ...form, is_folder: true, parent_service_id: '' })}
                />
                <span>{t('serviceFolder')}</span>
              </label>
            </fieldset>
            <ExpandableHelp title={t('servicesTypeHelpTitle')} className="contentKindHelpExpand">
              <p className="muted small">{t('serviceTypeLeafHint')}</p>
              <p className="muted small">{t('serviceTypeFolderHint')}</p>
            </ExpandableHelp>

            {!form.is_folder ? (
              <label>
                <span className="fieldLabel">{t('parentFolder')}</span>
                <select
                  value={form.parent_service_id}
                  onChange={(e) => setForm({ ...form, parent_service_id: e.target.value })}
                >
                  <option value="">{t('noParent')}</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {localizedName(f, i18n.language)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="modalActions">
              <button type="button" className="btn btn-primary" onClick={createService}>
                {t('save')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setCreateOpen(false)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {grantsOpen && selectedService ? (
        <div className="modalOverlay">
          <div className="modalCard wide">
            <h2>
              {t('shareService')} — {localizedName(selectedService, i18n.language)}
            </h2>
            <p className="muted small">{t('servicesShareModalHint')}</p>
            <div className="card tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('userName')}</th>
                    <th>{t('accessEnabled')}</th>
                    <th>{t('accessLevel')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedGrantRows.map((row) => {
                    const idx = grantRows.findIndex((r) => r.user_id === row.user_id)
                    const user = officeUsers.find((u) => Number(u.id) === row.user_id)
                    return (
                      <tr key={row.user_id}>
                        <td>{user?.name || user?.username}</td>
                        <td>
                          <input
                            type="checkbox"
                            checked={row.enabled}
                            onChange={(e) =>
                              setGrantRows((prev) =>
                                prev.map((r, i) => (i === idx ? { ...r, enabled: e.target.checked } : r)),
                              )
                            }
                          />
                        </td>
                        <td>
                          <select
                            value={row.access_level}
                            disabled={!row.enabled}
                            onChange={(e) =>
                              setGrantRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, access_level: e.target.value as 'view' | 'manage' } : r,
                                ),
                              )
                            }
                          >
                            <option value="view">{t('accessView')}</option>
                            <option value="manage">{t('accessEditor')}</option>
                          </select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <TablePagination page={grantPage} total={grantRows.length} onPageChange={setGrantPage} compact />
            <div className="modalActions">
              <button type="button" className="btn btn-primary" onClick={saveGrants}>
                {t('save')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setGrantsOpen(false)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
