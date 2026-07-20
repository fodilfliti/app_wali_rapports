import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

type Props = { token: string; currentUserId: number }

type UserFields = {
  username: string
  name: string
  role: api.UserRole
  job_title: string
}

function roleLabel(role: string, t: (k: string) => string) {
  if (role === 'ADMIN') return t('roleAdmin')
  if (role === 'WALI') return t('roleWali')
  if (role === 'CHEF_CABINET') return t('roleChefCabinet')
  return t('roleOffice')
}

function emptyFields(): UserFields {
  return { username: '', name: '', role: 'OFFICE_USER', job_title: '' }
}

export function AdminUsersPage({ token, currentUserId }: Props) {
  const { t } = useTranslation()
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
  const [saving, setSaving] = useState(false)

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

  function openCreate() {
    setFields(emptyFields())
    createForm.clearErrors()
    setModalOpen(true)
  }

  function openEdit(row: any) {
    setEditOpen(row)
    setEditFields({ name: row.name || '', job_title: row.job_title || '' })
    editForm.clearErrors()
  }

  function userPayload(fields: UserFields) {
    const body: { username: string; name: string; role: api.UserRole; job_title?: string } = {
      username: fields.username,
      name: fields.name,
      role: fields.role,
    }
    const jobTitle = fields.job_title.trim()
    if (jobTitle) body.job_title = jobTitle
    return body
  }

  async function save() {
    if (!createForm.validate(fields, t, ['username', 'name', 'role', 'job_title'])) return
    setSaving(true)
    try {
      const res = await api.createUser(token, userPayload(fields))
      setModalOpen(false)
      setCredentialsModal(res.credentials)
      await invalidate({ adminRef: true })
    } catch (e) {
      if (e instanceof api.ApiError) {
        if (e.fieldErrors) createForm.setFieldErrorsFromApi(e.fieldErrors)
        if (e.message === 'errorUsernameExists') snack.show(t('errorUsernameExists'), 'error')
        else snack.show(t('errorGeneric'), 'error')
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
                <td>{r.username}</td>
                <td>{r.name}</td>
                <td>{r.job_title || '—'}</td>
                <td>{roleLabel(r.role, t)}</td>
                <td>{r.is_blocked ? t('block') : '—'}</td>
                <td className="actionsCell">
                  <div className="actionsCellInner">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => openEdit(r)}>
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${r.is_blocked ? 'btn-secondary' : 'btn-danger'}`}
                      onClick={() => toggleBlock(r.id)}
                      disabled={r.id === currentUserId}
                    >
                      {r.is_blocked ? t('unblock') : t('block')}
                    </button>
                    {r.id !== currentUserId ? (
                      <button
                        type="button"
                        className="btn btn-accent btn-sm"
                        onClick={() => setResetTarget({ id: r.id, username: r.username })}
                      >
                        {t('resetPassword')}
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
                onChange={(e) => setFields({ ...fields, role: e.target.value as api.UserRole })}
              >
                <option value="OFFICE_USER">{t('roleOffice')}</option>
                <option value="CHEF_CABINET">{t('roleChefCabinet')}</option>
                <option value="WALI">{t('roleWali')}</option>
                <option value="ADMIN">{t('roleAdmin')}</option>
              </select>
              <FieldErrorText text={createForm.fieldErrorText('role', t)} />
            </label>
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
            <a
              className="btn btn-primary"
              href={api.apiFileUrl(credentialsModal.pdf_url, token)}
              target="_blank"
              rel="noreferrer"
            >
              {t('downloadPdf')}
            </a>
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
