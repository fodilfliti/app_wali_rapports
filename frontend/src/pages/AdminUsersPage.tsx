import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntityIdParam } from '../api'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { BusyButton } from '../components/BusyButton'
import { ConfirmActionModal } from '../components/ConfirmActionModal'
import { QueryListShell } from '../components/QueryListShell'
import { TablePagination } from '../components/TablePagination'
import { FieldErrorText } from '../components/FieldErrorText'
import { FormErrorBlock } from '../components/FormErrorBlock'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { userFormSchema, userPatchFormSchema } from '../validation/schemas/forms'
import { useZodForm } from '../validation/useZodForm'
import { useAdminUsersQuery } from '../hooks/queries/useListQueries'
import { useInvalidateAppQueries } from '../hooks/useInvalidateAppQueries'
import { SignedFileLink } from '../components/SignedFileLink'

type Props = { token: string; currentUserId: EntityIdParam; isSuperAdmin?: boolean }

type UserFields = {
  username: string
  name: string
  role: api.UserRole
  job_title: string
  daira_id: string
  municipality_id: string
  direction_id: string
}

function roleLabel(role: string, t: (k: string) => string) {
  if (role === 'ADMIN') return t('roleAdmin')
  if (role === 'WALI') return t('roleWali')
  if (role === 'CHEF_CABINET') return t('roleChefCabinet')
  if (role === 'PRESIDENT_DAIRA') return t('rolePresidentDaira')
  if (role === 'PRESIDENT_COMMUNE') return t('rolePresidentCommune')
  if (role === 'DIRECTEUR_DIRECTION') return t('roleDirecteurDirection')
  return t('roleOffice')
}

function emptyFields(): UserFields {
  return {
    username: '',
    name: '',
    role: 'OFFICE_USER',
    job_title: '',
    daira_id: '',
    municipality_id: '',
    direction_id: '',
  }
}

export function AdminUsersPage({ token, currentUserId, isSuperAdmin = false }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const invalidate = useInvalidateAppQueries()
  const createForm = useZodForm(userFormSchema)
  const editForm = useZodForm(userPatchFormSchema)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editOpen, setEditOpen] = useState<any | null>(null)
  const [editFields, setEditFields] = useState({ name: '', job_title: '' })
  const [fields, setFields] = useState<UserFields>(emptyFields)
  const [credentialsModal, setCredentialsModal] = useState<api.UserCredentials | null>(null)
  const [resetTarget, setResetTarget] = useState<{ id: number; username: string } | null>(null)
  const [resetBusy, setResetBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; username: string } | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dairas, setDairas] = useState<any[]>([])
  const [municipalities, setMunicipalities] = useState<any[]>([])
  const [directions, setDirections] = useState<any[]>([])
  const [serviceGrantRows, setServiceGrantRows] = useState<
    { service_id: string; name: string; access_level: 'view' | 'manage'; enabled: boolean }[]
  >([])
  const [loadingUnitServices, setLoadingUnitServices] = useState(false)

  const listQuery = useAdminUsersQuery(token, { page, q })
  const rows = listQuery.data?.users ?? []
  const total = listQuery.data?.total ?? 0
  const isInitialLoading = listQuery.isLoading && !listQuery.data
  const isRefreshing = listQuery.isFetching && !listQuery.isLoading

  useEffect(() => {
    if (listQuery.isError) {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [listQuery.isError, snack, t])

  useEffect(() => {
    if (!modalOpen) return
    const needDaira = fields.role === 'PRESIDENT_DAIRA'
    const needCommune = fields.role === 'PRESIDENT_COMMUNE'
    const needDirection = fields.role === 'DIRECTEUR_DIRECTION'
    if (needDaira && !dairas.length) {
      api.listDairas(token, { page: 1, pageSize: 100 }).then((r) => setDairas(r.dairas || [])).catch(() => {})
    }
    if (needCommune && !municipalities.length) {
      api
        .listMunicipalities(token, { page: 1, pageSize: 100 })
        .then((r) => setMunicipalities(r.municipalities || []))
        .catch(() => {})
    }
    if (needDirection && !directions.length) {
      api
        .listDirections(token, { page: 1, pageSize: 100 })
        .then((r) => setDirections(r.directions || []))
        .catch(() => {})
    }
  }, [modalOpen, fields.role, token, dairas.length, municipalities.length, directions.length])

  useEffect(() => {
    if (!modalOpen) return
    const orgHead =
      fields.role === 'PRESIDENT_DAIRA' ||
      fields.role === 'PRESIDENT_COMMUNE' ||
      fields.role === 'DIRECTEUR_DIRECTION'
    if (!orgHead) {
      setServiceGrantRows([])
      return
    }
    const unitId =
      fields.role === 'PRESIDENT_DAIRA'
        ? fields.daira_id
        : fields.role === 'PRESIDENT_COMMUNE'
          ? fields.municipality_id
          : fields.direction_id
    if (!unitId) {
      setServiceGrantRows([])
      return
    }
    let cancelled = false
    ;(async () => {
      setLoadingUnitServices(true)
      try {
        const params =
          fields.role === 'PRESIDENT_DAIRA'
            ? { org_scope: 'daira', daira_id: unitId }
            : fields.role === 'PRESIDENT_COMMUNE'
              ? { org_scope: 'commune', municipality_id: unitId }
              : { org_scope: 'direction', direction_id: unitId }
        const res = await api.listAdminServices(token, params)
        if (cancelled) return
        const leaves = (res.services || []).filter((s: any) => !s.is_folder)
        setServiceGrantRows(
          leaves.map((s: any) => ({
            service_id: String(s.id),
            name: i18n.language?.startsWith('fr') ? s.name_fr || s.name_ar : s.name_ar || s.name_fr,
            access_level: 'manage' as const,
            enabled: false,
          })),
        )
      } catch {
        if (!cancelled) setServiceGrantRows([])
      } finally {
        if (!cancelled) setLoadingUnitServices(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    modalOpen,
    fields.role,
    fields.daira_id,
    fields.municipality_id,
    fields.direction_id,
    token,
    i18n.language,
  ])

  function openCreate() {
    setFields(emptyFields())
    setServiceGrantRows([])
    createForm.clearErrors()
    setModalOpen(true)
  }

  function openEdit(row: any) {
    setEditOpen(row)
    setEditFields({ name: row.name || '', job_title: row.job_title || '' })
    editForm.clearErrors()
  }

  function userPayload(fields: UserFields) {
    const body: {
      username: string
      name: string
      role: api.UserRole
      job_title?: string
      daira_id?: EntityIdParam | null
      municipality_id?: EntityIdParam | null
      direction_id?: EntityIdParam | null
      service_grants?: { service_id: EntityIdParam; access_level: 'view' | 'manage' }[]
    } = {
      username: fields.username,
      name: fields.name,
      role: fields.role,
    }
    const jobTitle = fields.job_title.trim()
    if (jobTitle) body.job_title = jobTitle
    if (fields.role === 'PRESIDENT_DAIRA') body.daira_id = fields.daira_id || null
    if (fields.role === 'PRESIDENT_COMMUNE') body.municipality_id = fields.municipality_id || null
    if (fields.role === 'DIRECTEUR_DIRECTION') body.direction_id = fields.direction_id || null
    const grants = serviceGrantRows
      .filter((r) => r.enabled)
      .map((r) => ({ service_id: r.service_id, access_level: r.access_level }))
    if (grants.length) body.service_grants = grants
    return body
  }

  async function save() {
    const validateFields: (keyof UserFields)[] = ['username', 'name', 'role', 'job_title']
    if (fields.role === 'PRESIDENT_DAIRA') validateFields.push('daira_id')
    if (fields.role === 'PRESIDENT_COMMUNE') validateFields.push('municipality_id')
    if (fields.role === 'DIRECTEUR_DIRECTION') validateFields.push('direction_id')
    if (!createForm.validate(fields, t, validateFields)) return
    setSaving(true)
    try {
      const res = await api.createUser(token, userPayload(fields))
      setModalOpen(false)
      setCredentialsModal(res.credentials)
      await invalidate({ adminRef: true })
    } catch (e) {
      if (e instanceof api.ApiError) {
        if (e.message === 'errorUsernameExists' || e.status === 409) {
          createForm.setFieldErrorsFromApi(
            e.fieldErrors || { username: 'errorUsernameExists' },
          )
          snack.show(t('errorUsernameExists'), 'error')
          const el = document.getElementById('username')
          if (el instanceof HTMLElement) el.focus()
        } else if (e.fieldErrors) {
          createForm.setFieldErrorsFromApi(e.fieldErrors)
          snack.show(t('errorGeneric'), 'error')
        } else {
          snack.show(t('errorGeneric'), 'error')
        }
      }
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit() {
    if (!editOpen) return
    if (!editForm.validate(editFields, t, ['name', 'job_title'])) return
    setSaving(true)
    try {
      const jobTitle = editFields.job_title.trim()
      await api.patchUser(token, editOpen.id, {
        name: editFields.name,
        job_title: jobTitle || null,
      })
      setEditOpen(null)
      await invalidate({ adminRef: true })
      snack.show(t('save'), 'success')
    } catch (e) {
      if (e instanceof api.ApiError && e.fieldErrors) editForm.setFieldErrorsFromApi(e.fieldErrors)
      else snack.show(t('errorGeneric'), 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleBlock(id: number) {
    try {
      await api.toggleBlockUser(token, id)
      await invalidate({ adminRef: true })
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function confirmResetPwd() {
    if (!resetTarget) return
    setResetBusy(true)
    try {
      const res = await api.resetUserPassword(token, resetTarget.id)
      setResetTarget(null)
      setCredentialsModal(res.credentials)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setResetBusy(false)
    }
  }

  async function confirmSoftDelete() {
    if (!deleteTarget) return
    setDeleteBusy(true)
    try {
      await api.softDeleteUser(token, deleteTarget.id)
      setDeleteTarget(null)
      await invalidate({ adminRef: true })
      snack.show(t('userSoftDeleted'), 'success')
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  function canManageRow(r: { id: number; is_super_admin?: boolean }) {
    if (r.is_super_admin && String(r.id) !== String(currentUserId)) return false
    return true
  }

  function canDeleteRow(r: { id: number; is_super_admin?: boolean }) {
    if (!isSuperAdmin) return false
    if (String(r.id) === String(currentUserId)) return false
    if (r.is_super_admin) return false
    return true
  }

  function orgLabel(row: { name_ar?: string; name_fr?: string; code?: string }) {
    const name = i18n.language === 'fr' ? row.name_fr || row.name_ar : row.name_ar || row.name_fr
    return row.code ? `${name} (${row.code})` : name || ''
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navUsers')}</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          {t('createUser')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => listQuery.refetch()} disabled={listQuery.isFetching}>
          {t('refresh')}
        </button>
        <BackButton fallbackTo="/" />
      </div>

      <div className="toolbar">
        <input placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <QueryListShell isInitialLoading={isInitialLoading} isRefreshing={isRefreshing}>

      <div className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>{t('username')}</th>
              <th>{t('userName')}</th>
              <th>{t('jobTitle')}</th>
              <th>{t('userRole')}</th>
              <th>{t('status')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.username}
                  {r.is_super_admin ? (
                    <span className="badge badge-accent" style={{ marginInlineStart: 8 }}>
                      {t('roleSuperAdmin')}
                    </span>
                  ) : null}
                </td>
                <td>{r.name}</td>
                <td>{r.job_title || '—'}</td>
                <td>{roleLabel(r.role, t)}</td>
                <td>{r.is_blocked ? t('block') : '—'}</td>
                <td className="actionsCell">
                  <div className="actionsCellInner">
                    {canManageRow(r) ? (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => openEdit(r)}>
                          {t('edit')}
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${r.is_blocked ? 'btn-secondary' : 'btn-danger'}`}
                          onClick={() => toggleBlock(r.id)}
                          disabled={String(r.id) === String(currentUserId)}
                        >
                          {r.is_blocked ? t('unblock') : t('block')}
                        </button>
                        {String(r.id) !== String(currentUserId) ? (
                          <button
                            type="button"
                            className="btn btn-accent btn-sm"
                            onClick={() => setResetTarget({ id: r.id, username: r.username })}
                          >
                            {t('resetPassword')}
                          </button>
                        ) : null}
                      </>
                    ) : null}
                    {canDeleteRow(r) ? (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteTarget({ id: r.id, username: r.username })}
                      >
                        {t('softDeleteUser')}
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!isInitialLoading && !rows.length ? (
              <tr>
                <td colSpan={6}>{t('noResults')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TablePagination page={page} total={total} onPageChange={setPage} />
      </QueryListShell>

      <ConfirmActionModal
        open={!!resetTarget}
        title={t('resetPasswordConfirmTitle')}
        message={t('resetPasswordConfirmMessage', { username: resetTarget?.username || '' })}
        confirmLabel={t('resetPassword')}
        variant="danger"
        loading={resetBusy}
        onConfirm={confirmResetPwd}
        onClose={() => {
          if (!resetBusy) setResetTarget(null)
        }}
      />

      <ConfirmActionModal
        open={!!deleteTarget}
        title={t('softDeleteUserConfirmTitle')}
        message={t('softDeleteUserConfirmMessage', { username: deleteTarget?.username || '' })}
        confirmLabel={t('softDeleteUser')}
        variant="danger"
        loading={deleteBusy}
        onConfirm={confirmSoftDelete}
        onClose={() => {
          if (!deleteBusy) setDeleteTarget(null)
        }}
      />

      {modalOpen ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{t('createUser')}</h2>
            <label>
              {t('username')}
              <input
                id="username"
                className={createForm.hasFieldError('username') ? 'inputInvalid' : ''}
                value={fields.username}
                onChange={(e) => setFields({ ...fields, username: e.target.value })}
              />
              <FieldErrorText text={createForm.fieldErrorText('username', t)} />
            </label>
            <label>
              {t('userName')}
              <input
                id="name"
                className={createForm.hasFieldError('name') ? 'inputInvalid' : ''}
                value={fields.name}
                onChange={(e) => setFields({ ...fields, name: e.target.value })}
              />
              <FieldErrorText text={createForm.fieldErrorText('name', t)} />
            </label>
            <label>
              {t('jobTitle')}
              <input
                id="job_title"
                className={createForm.hasFieldError('job_title') ? 'inputInvalid' : ''}
                value={fields.job_title}
                onChange={(e) => setFields({ ...fields, job_title: e.target.value })}
                placeholder={t('optional')}
                maxLength={120}
              />
              <FieldErrorText text={createForm.fieldErrorText('job_title', t)} />
            </label>
            <label>
              {t('userRole')}
              <select
                id="role"
                value={fields.role}
                onChange={(e) =>
                  setFields({
                    ...fields,
                    role: e.target.value as api.UserRole,
                    daira_id: '',
                    municipality_id: '',
                    direction_id: '',
                  })
                }
              >
                <option value="OFFICE_USER">{t('roleOffice')}</option>
                <option value="PRESIDENT_DAIRA">{t('rolePresidentDaira')}</option>
                <option value="PRESIDENT_COMMUNE">{t('rolePresidentCommune')}</option>
                <option value="DIRECTEUR_DIRECTION">{t('roleDirecteurDirection')}</option>
                <option value="CHEF_CABINET">{t('roleChefCabinet')}</option>
                <option value="WALI">{t('roleWali')}</option>
                <option value="ADMIN">{t('roleAdmin')}</option>
              </select>
              <FieldErrorText text={createForm.fieldErrorText('role', t)} />
            </label>
            {fields.role === 'PRESIDENT_DAIRA' ? (
              <label>
                {t('navDairas')}
                <select
                  id="daira_id"
                  className={createForm.hasFieldError('daira_id') ? 'inputInvalid' : ''}
                  value={fields.daira_id}
                  onChange={(e) => setFields({ ...fields, daira_id: e.target.value })}
                >
                  <option value="">{t('selectDaira')}</option>
                  {dairas.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {orgLabel(d)}
                    </option>
                  ))}
                </select>
                <FieldErrorText text={createForm.fieldErrorText('daira_id', t)} />
              </label>
            ) : null}
            {fields.role === 'PRESIDENT_COMMUNE' ? (
              <label>
                {t('navMunicipalities')}
                <select
                  id="municipality_id"
                  className={createForm.hasFieldError('municipality_id') ? 'inputInvalid' : ''}
                  value={fields.municipality_id}
                  onChange={(e) => setFields({ ...fields, municipality_id: e.target.value })}
                >
                  <option value="">{t('selectCommune')}</option>
                  {municipalities.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {orgLabel(m)}
                    </option>
                  ))}
                </select>
                <FieldErrorText text={createForm.fieldErrorText('municipality_id', t)} />
              </label>
            ) : null}
            {fields.role === 'DIRECTEUR_DIRECTION' ? (
              <label>
                {t('navDirections')}
                <select
                  id="direction_id"
                  className={createForm.hasFieldError('direction_id') ? 'inputInvalid' : ''}
                  value={fields.direction_id}
                  onChange={(e) => setFields({ ...fields, direction_id: e.target.value })}
                >
                  <option value="">{t('selectDirection')}</option>
                  {directions.map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {orgLabel(d)}
                    </option>
                  ))}
                </select>
                <FieldErrorText text={createForm.fieldErrorText('direction_id', t)} />
              </label>
            ) : null}
            {fields.role === 'PRESIDENT_DAIRA' ||
            fields.role === 'PRESIDENT_COMMUNE' ||
            fields.role === 'DIRECTEUR_DIRECTION' ? (
              <fieldset className="serviceTypePick">
                <legend className="fieldLabel">{t('userServiceGrantsTitle')}</legend>
                <p className="muted small">{t('userServiceGrantsHint')}</p>
                {!(
                  (fields.role === 'PRESIDENT_DAIRA' && fields.daira_id) ||
                  (fields.role === 'PRESIDENT_COMMUNE' && fields.municipality_id) ||
                  (fields.role === 'DIRECTEUR_DIRECTION' && fields.direction_id)
                ) ? (
                  <p className="muted small">{t('userServiceGrantsPickUnitFirst')}</p>
                ) : loadingUnitServices ? (
                  <p className="muted small">{t('loading')}</p>
                ) : serviceGrantRows.length === 0 ? (
                  <p className="muted small">{t('userServiceGrantsEmpty')}</p>
                ) : (
                  <div className="card tableWrap">
                    <table>
                      <thead>
                        <tr>
                          <th>{t('rapportTitle')}</th>
                          <th>{t('accessEnabled')}</th>
                          <th>{t('accessLevel')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {serviceGrantRows.map((row, idx) => (
                          <tr key={row.service_id}>
                            <td>{row.name}</td>
                            <td>
                              <input
                                type="checkbox"
                                checked={row.enabled}
                                onChange={(e) =>
                                  setServiceGrantRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx ? { ...r, enabled: e.target.checked } : r,
                                    ),
                                  )
                                }
                              />
                            </td>
                            <td>
                              <select
                                value={row.access_level}
                                disabled={!row.enabled}
                                onChange={(e) =>
                                  setServiceGrantRows((prev) =>
                                    prev.map((r, i) =>
                                      i === idx
                                        ? {
                                            ...r,
                                            access_level: e.target.value as 'view' | 'manage',
                                          }
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </fieldset>
            ) : null}
            <FormErrorBlock message={createForm.formError} />
            <div className="modalActions">
              <BusyButton type="button" className="btn btn-primary" onClick={save} busy={saving} busyLabel={t('saving')}>
                {t('save')}
              </BusyButton>
              <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{t('editUser')}</h2>
            <p className="muted">{editOpen.username}</p>
            <label>
              {t('userName')}
              <input
                id="edit-name"
                className={editForm.hasFieldError('name') ? 'inputInvalid' : ''}
                value={editFields.name}
                onChange={(e) => setEditFields({ ...editFields, name: e.target.value })}
              />
              <FieldErrorText text={editForm.fieldErrorText('name', t)} />
            </label>
            <label>
              {t('jobTitle')}
              <input
                id="edit-job_title"
                className={editForm.hasFieldError('job_title') ? 'inputInvalid' : ''}
                value={editFields.job_title}
                onChange={(e) => setEditFields({ ...editFields, job_title: e.target.value })}
                placeholder={t('optional')}
                maxLength={120}
              />
              <FieldErrorText text={editForm.fieldErrorText('job_title', t)} />
            </label>
            <FormErrorBlock message={editForm.formError} />
            <div className="modalActions">
              <BusyButton type="button" className="btn btn-primary" onClick={saveEdit} busy={saving} busyLabel={t('saving')}>
                {t('save')}
              </BusyButton>
              <button type="button" className="btn btn-secondary" onClick={() => setEditOpen(null)} disabled={saving}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {credentialsModal ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{t('userCreatedTitle')}</h2>
            <p className="muted">{t('codeLabel', { code: credentialsModal.code8 })}</p>
            <p className="passwordReveal">{credentialsModal.code8}</p>
            <SignedFileLink
              className="btn btn-primary"
              path={credentialsModal.pdf_url}
              target="_blank"
              rel="noreferrer"
            >
              {t('downloadPdf')}
            </SignedFileLink>
            <div className="modalActions">
              <button type="button" className="btn btn-secondary" onClick={() => setCredentialsModal(null)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
