import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { TablePagination } from '../components/TablePagination'
import { FieldErrorText } from '../components/FieldErrorText'
import { FormErrorBlock } from '../components/FormErrorBlock'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { municipalityFormSchema } from '../validation/schemas/forms'
import { useZodForm } from '../validation/useZodForm'
import { PageLoading } from '../components/PageLoading'
import { BusyButton } from '../components/BusyButton'

type Props = { token: string }

export function AdminMunicipalitiesListPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const form = useZodForm(municipalityFormSchema)
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [fields, setFields] = useState({ name_ar: '', name_fr: '', code: '', daira_id: '' })
  const [dairas, setDairas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.listDairas(token, { pageSize: 100 }).then((r) => setDairas(r.dairas)).catch(() => {})
  }, [token])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listMunicipalities(token, { page, q })
      setRows(res.municipalities)
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
    setFields({ name_ar: '', name_fr: '', code: '', daira_id: '' })
    form.clearErrors()
    setModalOpen(true)
  }

  function openEdit(row: any) {
    setEditId(row.id)
    setFields({
      name_ar: row.name_ar,
      name_fr: row.name_fr,
      code: row.code,
      daira_id: row.daira_id ? String(row.daira_id) : '',
    })
    form.clearErrors()
    setModalOpen(true)
  }

  async function save() {
    if (!form.validate(fields, t, ['name_ar', 'name_fr', 'code', 'daira_id'])) return
    const payload = {
      ...fields,
      daira_id: Number(fields.daira_id),
    }
    setSaving(true)
    try {
      if (editId) await api.patchMunicipality(token, editId, payload)
      else await api.createMunicipality(token, payload)
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
        <h1>{t('navMunicipalities')}</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          {t('createMunicipality')}
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
              <th>{t('municipalityCode')}</th>
              <th>{t('municipalityNameAr')}</th>
              <th>{t('municipalityNameFr')}</th>
              <th>{t('dairaLabel')}</th>
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
                  {r.daira
                    ? i18n.language === 'fr'
                      ? r.daira.name_fr
                      : r.daira.name_ar
                    : '—'}
                </td>
                <td>
                  <button type="button" className="btn btn-ghost" onClick={() => openEdit(r)}>
                    {t('edit')}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={5}>{t('noResults')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <TablePagination page={page} total={total} onPageChange={setPage} />

      {modalOpen ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{editId ? t('editMunicipality') : t('createMunicipality')}</h2>
            <label>
              {t('municipalityCode')}
              <input
                id="code"
                className={form.hasFieldError('code') ? 'inputInvalid' : ''}
                value={fields.code}
                onChange={(e) => setFields({ ...fields, code: e.target.value })}
              />
              <FieldErrorText text={form.fieldErrorText('code', t)} />
            </label>
            <label>
              {t('municipalityNameAr')}
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
              {t('municipalityNameFr')}
              <input
                id="name_fr"
                className={form.hasFieldError('name_fr') ? 'inputInvalid' : ''}
                value={fields.name_fr}
                dir={i18n.language === 'fr' ? 'ltr' : undefined}
                onChange={(e) => setFields({ ...fields, name_fr: e.target.value })}
              />
              <FieldErrorText text={form.fieldErrorText('name_fr', t)} />
            </label>
            <label>
              {t('dairaLabel')}
              <select
                id="daira_id"
                className={form.hasFieldError('daira_id') ? 'inputInvalid' : ''}
                value={fields.daira_id}
                onChange={(e) => setFields({ ...fields, daira_id: e.target.value })}
              >
                <option value="">{t('selectDaira')}</option>
                {dairas.map((d) => (
                  <option key={d.id} value={d.id}>
                    {i18n.language === 'fr' ? d.name_fr : d.name_ar} ({d.code})
                  </option>
                ))}
              </select>
              <FieldErrorText text={form.fieldErrorText('daira_id', t)} />
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
