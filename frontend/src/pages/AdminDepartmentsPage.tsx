import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { ApiError } from '../api'
import { ENABLE_FR_VALUE_INPUTS } from '../config/features'
import { AdminOrgTabs } from '../components/AdminOrgTabs'
import { BackButton } from '../components/BackButton'
import { TablePagination } from '../components/TablePagination'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { ConfirmActionModal } from '../components/ConfirmActionModal'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import { bilingualPairForSave, hasBilingualText } from '../utils/bilingual'
import type { EntityIdParam } from '../api'

type Props = { token: string }

const emptyDeptForm = () => ({ name_ar: '', name_fr: '' })

export function AdminDepartmentsPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [departments, setDepartments] = useState<any[]>([])
  const [deptModalOpen, setDeptModalOpen] = useState(false)
  const [editingDepartmentId, setEditingDepartmentId] = useState<EntityIdParam | null>(null)
  const [deptForm, setDeptForm] = useState(emptyDeptForm())
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const deptRes = await api.listAdminDepartments(token)
      setDepartments(deptRes.departments)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [token, snack, t])

  useEffect(() => {
    load()
  }, [load])

  function openCreateDepartment() {
    setEditingDepartmentId(null)
    setDeptForm(emptyDeptForm())
    setDeptModalOpen(true)
  }

  function openEditDepartment(department: any) {
    setEditingDepartmentId(department.id)
    setDeptForm({ name_ar: department.name_ar || '', name_fr: department.name_fr || '' })
    setDeptModalOpen(true)
  }

  async function saveDepartment() {
    if (!hasBilingualText(deptForm.name_ar, deptForm.name_fr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return
    }
    try {
      const names = bilingualPairForSave(deptForm.name_ar, deptForm.name_fr)
      if (editingDepartmentId) {
        await api.patchAdminDepartment(token, editingDepartmentId, {
          name_ar: names.ar,
          name_fr: names.fr,
        })
      } else {
        await api.createAdminDepartment(token, {
          name_ar: names.ar,
          name_fr: names.fr,
        })
      }
      setDeptModalOpen(false)
      load()
      snack.show(t('save'), 'success')
    } catch (e) {
      if (e instanceof ApiError && e.message === 'departmentNameExists') {
        snack.show(t('departmentNameExists'), 'error')
      } else {
        snack.show(t('errorGeneric'), 'error')
      }
    }
  }

  async function confirmDeleteDepartment() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.deleteAdminDepartment(token, deleteTarget.id)
      snack.show(t('deleteDepartmentDone'), 'success')
      setDeleteTarget(null)
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  const pagedDepartments = paginateSlice(departments, page, DEFAULT_PAGE_SIZE)

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('departmentsSection')}</h1>
        <button type="button" className="btn btn-primary" onClick={openCreateDepartment}>
          {t('createDepartment')}
        </button>
        <BackButton fallbackTo="/" />
      </div>

      <AdminOrgTabs />

      <p className="muted">{t('departmentsSectionHelp')}</p>

      <div className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>{t('municipalityNameAr')}</th>
              {ENABLE_FR_VALUE_INPUTS ? <th>{t('municipalityNameFr')}</th> : null}
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {pagedDepartments.length ? (
              pagedDepartments.map((d) => (
                <tr key={d.id}>
                  <td>{d.name_ar}</td>
                  {ENABLE_FR_VALUE_INPUTS ? <td>{d.name_fr}</td> : null}
                  <td>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => openEditDepartment(d)}>
                      {t('edit')}
                    </button>{' '}
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeleteTarget(d)}
                    >
                      {t('deleteDepartment')}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={ENABLE_FR_VALUE_INPUTS ? 3 : 2} className="schemasEmptyRow muted">
                  {t('departmentsEmpty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} total={departments.length} onPageChange={setPage} />

      {deptModalOpen ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{editingDepartmentId ? t('editDepartment') : t('createDepartment')}</h2>
            <label>
              <span className="fieldLabel">{t('municipalityNameAr')}</span>
              <input
                value={deptForm.name_ar}
                onChange={(e) => setDeptForm({ ...deptForm, name_ar: e.target.value })}
              />
            </label>
            {ENABLE_FR_VALUE_INPUTS ? (
              <label>
                <span className="fieldLabel">{t('municipalityNameFr')}</span>
                <input
                  value={deptForm.name_fr}
                  onChange={(e) => setDeptForm({ ...deptForm, name_fr: e.target.value })}
                />
              </label>
            ) : null}
            <div className="modalActions">
              <button type="button" className="btn btn-primary" onClick={saveDepartment}>
                {t('save')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setDeptModalOpen(false)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmActionModal
        open={!!deleteTarget}
        title={t('deleteDepartmentConfirmTitle')}
        message={t('deleteDepartmentConfirmMessage', {
          name: deleteTarget
            ? i18n.language === 'fr'
              ? deleteTarget.name_fr
              : deleteTarget.name_ar
            : '',
        })}
        confirmLabel={t('deleteDepartment')}
        variant="danger"
        loading={deleting}
        onConfirm={confirmDeleteDepartment}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
