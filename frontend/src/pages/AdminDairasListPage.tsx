import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { BusyButton } from '../components/BusyButton'
import { PageLoading } from '../components/PageLoading'
import { TablePagination } from '../components/TablePagination'
import { FieldErrorText } from '../components/FieldErrorText'
import { FormErrorBlock } from '../components/FormErrorBlock'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { dairaFormSchema } from '../validation/schemas/forms'
import { useZodForm } from '../validation/useZodForm'

type Props = { token: string }

export function AdminDairasListPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const form = useZodForm(dairaFormSchema)
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [fields, setFields] = useState({ name_ar: '', name_fr: '', code: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listDairas(token, { page, q })
      setRows(res.dairas)
      setTotal(res.total)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setLoading(false)
    }
  }, [token, page, q, snack, t])

  useEffect(() => {
    load()
  }, [load])

  function openCreate() {
    setEditId(null)
    setFields({ name_ar: '', name_fr: '', code: '' })
    form.clearErrors()
    setModalOpen(true)
  }

  function openEdit(row: any) {
    setEditId(row.id)
    setFields({ name_ar: row.name_ar, name_fr: row.name_fr, code: row.code })
    form.clearErrors()
    setModalOpen(true)
  }

  async function save() {
    if (!form.validate(fields, t, ['name_ar', 'name_fr', 'code'])) return
    setSaving(true)
    try {
      if (editId) await api.patchDaira(token, editId, fields)
      else await api.createDaira(token, fields)
      setModalOpen(false)
      load()
    } catch (e) {
      if (e instanceof api.ApiError && e.fieldErrors) form.setFieldErrorsFromApi(e.fieldErrors)
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navDairas')}</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          {t('createDaira')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          {t('refresh')}
        </button>
        <BackButton fallbackTo="/" />
      </div>

      <div className="toolbar">
        <input
          placeholder={t('search')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
      </div>

      {loading ? <PageLoading /> : null}

      <div className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>{t('dairaCode')}</th>
              <th>{t('dairaNameAr')}</th>
              <th>{t('dairaNameFr')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.code}</td>
                <td>{r.name_ar}</td>
                <td>{r.name_fr}</td>
                <td>
                  <button type="button" className="btn btn-ghost" onClick={() => openEdit(r)}>
                    {t('edit')}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={4}>{t('noResults')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <TablePagination page={page} total={total} onPageChange={setPage} />

      {modalOpen ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{editId ? t('editDaira') : t('createDaira')}</h2>
            <label>
              {t('dairaCode')}
              <input
                id="code"
                className={form.hasFieldError('code') ? 'inputInvalid' : ''}
                value={fields.code}
                onChange={(e) => setFields({ ...fields, code: e.target.value })}
              />
              <FieldErrorText text={form.fieldErrorText('code', t)} />
            </label>
            <label>
              {t('dairaNameAr')}
              <input
                id="name_ar"
                className={form.hasFieldError('name_ar') ? 'inputInvalid' : ''}
                value={fields.name_ar}
                dir="rtl"
                onChange={(e) => setFields({ ...fields, name_ar: e.target.value })}
              />
              <FieldErrorText text={form.fieldErrorText('name_ar', t)} />
            </label>
            <label>
              {t('dairaNameFr')}
              <input
                id="name_fr"
                className={form.hasFieldError('name_fr') ? 'inputInvalid' : ''}
                value={fields.name_fr}
                dir={i18n.language === 'fr' ? 'ltr' : undefined}
                onChange={(e) => setFields({ ...fields, name_fr: e.target.value })}
              />
              <FieldErrorText text={form.fieldErrorText('name_fr', t)} />
            </label>
            <FormErrorBlock message={form.formError} />
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
    </div>
  )
}
