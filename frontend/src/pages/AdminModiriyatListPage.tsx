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
import { modiriyaFormSchema } from '../validation/schemas/forms'
import { useZodForm } from '../validation/useZodForm'

type Props = { token: string }

function nextModiriyaCode(rows: { code?: string }[]) {
  let max = 0
  for (const r of rows) {
    const n = Number.parseInt(String(r.code ?? ''), 10)
    if (!Number.isNaN(n) && n > max) max = n
  }
  return String(max + 1)
}

export function AdminModiriyatListPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const form = useZodForm(modiriyaFormSchema)
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [fields, setFields] = useState({ name_ar: '', name_fr: '' })
  const [editCode, setEditCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listModiriyat(token, { page, q })
      setRows(res.modiriyat)
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
    setEditCode(null)
    setFields({ name_ar: '', name_fr: '' })
    form.clearErrors()
    setModalOpen(true)
  }

  function openEdit(row: any) {
    setEditId(row.id)
    setEditCode(row.code)
    setFields({ name_ar: row.name_ar, name_fr: row.name_fr })
    form.clearErrors()
    setModalOpen(true)
  }

  async function save() {
    if (!form.validate(fields, t, ['name_ar', 'name_fr'])) return
    setSaving(true)
    try {
      if (editId) {
        await api.patchModiriya(token, editId, {
          name_ar: fields.name_ar,
          name_fr: fields.name_fr,
          ...(editCode != null ? { code: editCode } : {}),
        })
      } else {
        let code = nextModiriyaCode(rows)
        if (q || page > 1 || total > rows.length) {
          const all = await api.listModiriyat(token, { page: 1, pageSize: 100, q: '' })
          code = nextModiriyaCode(all.modiriyat || [])
        } else if (total > 0 && rows.length === 0) {
          code = String(total + 1)
        }
        await api.createModiriya(token, {
          name_ar: fields.name_ar,
          name_fr: fields.name_fr,
          code,
        })
      }
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
        <h1>{t('navModiriyat')}</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          {t('createModiriya')}
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
              <th>{t('modiriyaNameAr')}</th>
              <th>{t('modiriyaNameFr')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
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
                <td colSpan={3}>{t('noResults')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <TablePagination page={page} total={total} onPageChange={setPage} />

      {modalOpen ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{editId ? t('editModiriya') : t('createModiriya')}</h2>
            <label>
              {t('modiriyaNameAr')}
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
              {t('modiriyaNameFr')}
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
