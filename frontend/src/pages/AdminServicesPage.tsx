import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { ENABLE_FR_VALUE_INPUTS, ENABLE_SERVICE_FOLDERS } from '../config/features'
import { bilingualPairForSave, hasBilingualText } from '../utils/bilingual'
import { BackButton } from '../components/BackButton'
import { ExpandableHelp } from '../components/ExpandableHelp'
import { TablePagination } from '../components/TablePagination'
import { localizedName } from '../utils/schemaColumns'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { ConfirmActionModal } from '../components/ConfirmActionModal'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import { useAdminServicesQuery } from '../hooks/queries/useListQueries'
import { useInvalidateAppQueries } from '../hooks/useInvalidateAppQueries'
import { QueryListShell } from '../components/QueryListShell'

type Props = { token: string }

type OrgScope = 'diwan' | 'daira' | 'commune' | 'direction'
type GrantRow = { user_id: string; access_level: 'view' | 'manage'; enabled: boolean; label: string }

const emptyForm = () => ({
  name_ar: '',
  name_fr: '',
  is_folder: false,
  parent_service_id: '',
  sort_order: '0',
  org_scope: 'diwan' as OrgScope,
  org_unit_ids: [] as string[],
  org_units_all: true,
})

function unitDisplay(service: any, lang: string, t: (k: string) => string): string {
  if ((service.org_scope || 'diwan') === 'diwan') return t('orgUnitDiwanValue')
  const unit = service.daira || service.municipality || service.direction
  if (unit) return localizedName(unit, lang)
  if (service.is_folder) return t('orgUnitFolderValue')
  return t('orgUnitDiwanValue')
}

export function AdminServicesPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const invalidate = useInvalidateAppQueries()
  const [scopeFilter, setScopeFilter] = useState<OrgScope | ''>('')
  const servicesQuery = useAdminServicesQuery(token, scopeFilter ? { org_scope: scopeFilter } : undefined)
  const services = servicesQuery.data?.services ?? []
  const isInitialLoading = servicesQuery.isLoading && !servicesQuery.data
  const isRefreshing = servicesQuery.isFetching && !servicesQuery.isLoading

  const [createOpen, setCreateOpen] = useState(false)
  const [grantsOpen, setGrantsOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [grantPage, setGrantPage] = useState(1)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [grantRows, setGrantRows] = useState<GrantRow[]>([])
  const [form, setForm] = useState(emptyForm())
  const [editOpen, setEditOpen] = useState(false)
  const [editingService, setEditingService] = useState<any>(null)
  const [editForm, setEditForm] = useState({ name_ar: '', name_fr: '' })
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const [orgUnits, setOrgUnits] = useState<any[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)

  async function refreshAdminServices() {
    await invalidate({ adminRef: true, serviceTrees: true })
  }

  function openCreateModal() {
    setForm(emptyForm())
    setOrgUnits([])
    setCreateOpen(true)
  }

  useEffect(() => {
    if (!createOpen) return
    if (form.org_scope === 'diwan' || form.is_folder) {
      setOrgUnits([])
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingUnits(true)
      try {
        const params = { page: 1, pageSize: 100 }
        let rows: any[] = []
        if (form.org_scope === 'daira') {
          const res = await api.listDairas(token, params)
          rows = res.dairas || res.items || []
        } else if (form.org_scope === 'commune') {
          const res = await api.listMunicipalities(token, params)
          rows = res.municipalities || res.items || []
        } else if (form.org_scope === 'direction') {
          const res = await api.listDirections(token, params)
          rows = res.directions || res.items || []
        }
        if (!cancelled) setOrgUnits(rows)
      } catch {
        if (!cancelled) {
          setOrgUnits([])
          snack.show(t('errorGeneric'), 'error')
        }
      } finally {
        if (!cancelled) setLoadingUnits(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [createOpen, form.org_scope, form.is_folder, token])

  async function createService() {
    if (!hasBilingualText(form.name_ar, form.name_fr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return
    }
    if (
      !form.is_folder &&
      form.org_scope !== 'diwan' &&
      !form.org_units_all &&
      form.org_unit_ids.length === 0
    ) {
      snack.show(t('orgUnitsRequired'), 'error')
      return
    }
    try {
      const names = bilingualPairForSave(form.name_ar, form.name_fr)
      const body: Record<string, unknown> = {
        department_id: null,
        name_ar: names.ar,
        name_fr: names.fr,
        is_folder: ENABLE_SERVICE_FOLDERS ? form.is_folder : false,
        parent_service_id:
          !ENABLE_SERVICE_FOLDERS || form.is_folder || !form.parent_service_id
            ? null
            : form.parent_service_id,
        sort_order: Number(form.sort_order) || 0,
        org_scope: form.org_scope,
      }
      if (!form.is_folder && form.org_scope !== 'diwan') {
        body.org_units_all = form.org_units_all
        if (!form.org_units_all) body.org_unit_ids = form.org_unit_ids
      }
      const res = await api.createAdminService(token, body)
      setCreateOpen(false)
      await refreshAdminServices()
      const count = res.count ?? res.services?.length ?? 1
      snack.show(count > 1 ? t('createServiceBulkDone', { count }) : t('save'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  function openEditService(service: any) {
    setEditingService(service)
    setEditForm({
      name_ar: service.name_ar || '',
      name_fr: service.name_fr || '',
    })
    setEditOpen(true)
  }

  async function saveEditService() {
    if (!editingService) return
    if (!hasBilingualText(editForm.name_ar, editForm.name_fr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return
    }
    try {
      const names = bilingualPairForSave(editForm.name_ar, editForm.name_fr)
      await api.patchAdminService(token, editingService.id, {
        name_ar: names.ar,
        name_fr: names.fr,
        department_id: null,
      })
      setEditOpen(false)
      await refreshAdminServices()
      snack.show(t('save'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function openGrants(service: any) {
    setSelectedService(service)
    setGrantPage(1)
    try {
      const [grantsRes, usersRes] = await Promise.all([
        api.listServiceGrants(token, service.id),
        api.listAdminOfficeUsers(token, {
          org_scope: service.org_scope || 'diwan',
          service_id: service.id,
        }),
      ])
      const users = usersRes.users || []
      const byUser = new Map(
        (grantsRes.grants || []).map((g: any) => [String(g.user_id), g.access_level as 'view' | 'manage']),
      )
      setGrantRows(
        users.map((u: any) => ({
          user_id: String(u.id),
          access_level: byUser.get(String(u.id)) || 'manage',
          enabled: byUser.has(String(u.id)),
          label: u.name || u.username,
        })),
      )
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
          .filter((r) => r.enabled)
          .map((r) => ({ user_id: r.user_id, access_level: r.access_level })),
      )
      setGrantsOpen(false)
      await refreshAdminServices()
      snack.show(t('save'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function confirmDeleteService() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteAdminService(token, deleteTarget.id)
      setDeleteTarget(null)
      await refreshAdminServices()
      snack.show(t('deleteServiceDone'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  function scopeLabel(scope: string) {
    if (scope === 'daira') return t('orgScopeDaira')
    if (scope === 'commune') return t('orgScopeCommune')
    if (scope === 'direction') return t('orgScopeDirection')
    return t('orgScopeDiwan')
  }

  const folders = services.filter(
    (s) => s.is_folder && !s.parent_service_id && (!form.org_scope || s.org_scope === form.org_scope),
  )
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

      <p className="muted">{t('servicesShareHelp')}</p>

      <div className="schemasPageIntro card">
        <p className="schemasPageIntroLead">{t('servicesPageIntro')}</p>
        <ol className="schemasPageSteps muted small">
          <li>{t('servicesPageStep1')}</li>
          <li>{t('servicesPageStep2')}</li>
          <li>{t('servicesPageStep3')}</li>
        </ol>
      </div>

      <label className="fieldInline">
        <span className="fieldLabel">{t('orgScopeFilter')}</span>
        <select
          value={scopeFilter}
          onChange={(e) => {
            setScopeFilter(e.target.value as OrgScope | '')
            setPage(1)
          }}
        >
          <option value="">{t('orgScopeAll')}</option>
          <option value="diwan">{t('orgScopeDiwan')}</option>
          <option value="daira">{t('orgScopeDaira')}</option>
          <option value="commune">{t('orgScopeCommune')}</option>
          <option value="direction">{t('orgScopeDirection')}</option>
        </select>
      </label>

      <QueryListShell isInitialLoading={isInitialLoading} isRefreshing={isRefreshing}>
        <div className="card tableWrap">
          <table>
            <thead>
              <tr>
                <th>{t('rapportTitle')}</th>
                <th>{t('orgScopeLabel')}</th>
                <th>{t('orgUnitLabel')}</th>
                <th>{t('serviceGrants')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pagedServices.length ? (
                pagedServices.map((s) => (
                  <tr key={s.id}>
                    <td>{localizedName(s, i18n.language)}</td>
                    <td>{scopeLabel(s.org_scope || 'diwan')}</td>
                    <td>{unitDisplay(s, i18n.language, t)}</td>
                    <td>
                      {s.grant_count ?? 0}
                      {s.is_folder && (s.grant_count ?? 0) > 0 ? (
                        <span className="muted small serviceFolderGrantHint">
                          {' '}
                          ({t('serviceFolderGrantsRollup')})
                        </span>
                      ) : null}
                    </td>
                    <td className="actionsCell">
                      <div className="actionsCellInner">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => openEditService(s)}
                        >
                          {t('editService')}
                        </button>
                        {!s.is_folder ? (
                          <button
                            type="button"
                            className="btn btn-accent btn-sm"
                            onClick={() => openGrants(s)}
                          >
                            {t('shareService')}
                          </button>
                        ) : (s.grant_count ?? 0) > 0 ? (
                          <span className="muted small">{t('serviceFolderShareViaChildren')}</span>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setDeleteTarget(s)}
                        >
                          {t('deleteService')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="schemasEmptyRow muted">
                    {t('servicesEmpty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination page={page} total={services.length} onPageChange={setPage} />
      </QueryListShell>

      {createOpen ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{t('createService')}</h2>
            <p className="muted small">{t('servicesCreateHint')}</p>

            <label>
              <span className="fieldLabel">{t('orgScopeLabel')}</span>
              <select
                value={form.org_scope}
                onChange={(e) =>
                  setForm({
                    ...form,
                    org_scope: e.target.value as OrgScope,
                    org_unit_ids: [],
                    org_units_all: true,
                    parent_service_id: '',
                  })
                }
              >
                <option value="diwan">{t('orgScopeDiwan')}</option>
                <option value="daira">{t('orgScopeDaira')}</option>
                <option value="commune">{t('orgScopeCommune')}</option>
                <option value="direction">{t('orgScopeDirection')}</option>
              </select>
            </label>

            <label>
              <span className="fieldLabel">{t('municipalityNameAr')}</span>
              <input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
            </label>
            {ENABLE_FR_VALUE_INPUTS ? (
              <label>
                <span className="fieldLabel">{t('municipalityNameFr')}</span>
                <input value={form.name_fr} onChange={(e) => setForm({ ...form, name_fr: e.target.value })} />
              </label>
            ) : null}

            {!form.is_folder && form.org_scope !== 'diwan' ? (
              <fieldset className="serviceTypePick">
                <legend className="fieldLabel">{t('orgUnitsLabel')}</legend>
                <label className="schemaColumnCheck serviceTypeOption">
                  <input
                    type="checkbox"
                    checked={form.org_units_all}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        org_units_all: e.target.checked,
                        org_unit_ids: e.target.checked ? [] : form.org_unit_ids,
                      })
                    }
                  />
                  <span>{t('orgUnitsSelectAll')}</span>
                </label>
                {loadingUnits ? <p className="muted small">{t('loading')}</p> : null}
                {!form.org_units_all ? (
                  <div className="orgUnitMultiList">
                    {orgUnits.map((u) => {
                      const id = String(u.id)
                      const checked = form.org_unit_ids.includes(id)
                      return (
                        <label key={id} className="schemaColumnCheck">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...form.org_unit_ids, id]
                                : form.org_unit_ids.filter((x) => x !== id)
                              setForm({ ...form, org_unit_ids: next })
                            }}
                          />
                          <span>{localizedName(u, i18n.language)}</span>
                        </label>
                      )
                    })}
                  </div>
                ) : (
                  <p className="muted small">
                    {t('orgUnitsAllHint', { count: orgUnits.length || '…' })}
                  </p>
                )}
              </fieldset>
            ) : null}

            {ENABLE_SERVICE_FOLDERS ? (
              <>
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
              </>
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

      {editOpen && editingService ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>
              {t('editService')} — {localizedName(editingService, i18n.language)}
            </h2>
            <label>
              <span className="fieldLabel">{t('municipalityNameAr')}</span>
              <input
                value={editForm.name_ar}
                onChange={(e) => setEditForm({ ...editForm, name_ar: e.target.value })}
              />
            </label>
            {ENABLE_FR_VALUE_INPUTS ? (
              <label>
                <span className="fieldLabel">{t('municipalityNameFr')}</span>
                <input
                  value={editForm.name_fr}
                  onChange={(e) => setEditForm({ ...editForm, name_fr: e.target.value })}
                />
              </label>
            ) : null}
            <div className="modalActions">
              <button type="button" className="btn btn-primary" onClick={saveEditService}>
                {t('save')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(false)}>
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
            <p className="muted small">
              {t('servicesShareModalHintScoped', {
                scope: scopeLabel(selectedService.org_scope || 'diwan'),
              })}
            </p>
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
                  {pagedGrantRows.length ? (
                    pagedGrantRows.map((row) => {
                      const idx = grantRows.findIndex((r) => r.user_id === row.user_id)
                      return (
                        <tr key={row.user_id}>
                          <td>{row.label}</td>
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
                                    i === idx
                                      ? { ...r, access_level: e.target.value as 'view' | 'manage' }
                                      : r,
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
                    })
                  ) : (
                    <tr>
                      <td colSpan={3} className="muted">
                        {t('servicesShareNoUsers')}
                      </td>
                    </tr>
                  )}
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

      <ConfirmActionModal
        open={!!deleteTarget}
        title={t('deleteServiceConfirmTitle')}
        message={t('deleteServiceConfirmMessage', {
          name: deleteTarget ? localizedName(deleteTarget, i18n.language) : '',
        })}
        confirmLabel={t('deleteService')}
        variant="danger"
        loading={deleting}
        onConfirm={confirmDeleteService}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
