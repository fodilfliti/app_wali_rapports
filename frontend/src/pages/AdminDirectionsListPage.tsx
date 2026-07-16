import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { ENABLE_FR_VALUE_INPUTS } from '../config/features'
import { BackButton } from '../components/BackButton'
import { BusyButton } from '../components/BusyButton'
import { PageLoading } from '../components/PageLoading'
import { TablePagination } from '../components/TablePagination'
import { FieldErrorText } from '../components/FieldErrorText'
import { FormErrorBlock } from '../components/FormErrorBlock'
import { RapportListScopeFilter } from '../components/RapportListScopeFilter'
import { ConfirmActionModal } from '../components/ConfirmActionModal'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { directionFormSchema } from '../validation/schemas/forms'
import { useZodForm } from '../validation/useZodForm'

type Props = { token: string }

export function AdminDirectionsListPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const form = useZodForm(directionFormSchema)
  const [rows, setRows] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [fields, setFields] = useState({ name_ar: '', name_fr: '' })
  const [editCode, setEditCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hideTarget, setHideTarget] = useState<any | null>(null)
  const [hideBusy, setHideBusy] = useState(false)

  useEffect(() => {
    setPage(1)
  }, [showHidden, q])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.listDirections(token, { page, q, hidden_only: showHidden })
      setRows(res.directions)
      setTotal(res.total)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setLoading(false)
    }
  }, [token, page, q, showHidden, snack, t])

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
        await api.patchDirection(token, editId, {
          name_ar: fields.name_ar,
          name_fr: fields.name_fr,
          ...(editCode != null ? { code: editCode } : {}),
        })
      } else {
        await api.createDirection(token, {
          name_ar: fields.name_ar,
          name_fr: fields.name_fr,
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

  async function confirmHide() {
    if (!hideTarget) return
    setHideBusy(true)
    try {
      await api.hideDirection(token, hideTarget.id)
      snack.show(t('orgRefHideDone'), 'success')
      setHideTarget(null)
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setHideBusy(false)
    }
  }

  async function restoreRow(row: any) {
    try {
      await api.restoreDirection(token, row.id)
      snack.show(t('orgRefRestoreDone'), 'success')
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navDirections')}</h1>
        {!showHidden ? (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            {t('createDirection')}
          </button>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          {t('refresh')}
        </button>
        <BackButton fallbackTo="/" />
      </div>

      <div className="rapportListToolbar">
        <RapportListScopeFilter
          showHidden={showHidden}
          onChange={setShowHidden}
          scopeLabelKey="orgRefHiddenScope"
          activeLabelKey="orgRefListActive"
          hiddenLabelKey="orgRefListHidden"
          ariaLabelKey="orgRefHiddenScope"
        />
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
              <th>{t('directionNameAr')}</th>
              {ENABLE_FR_VALUE_INPUTS ? <th>{t('directionNameFr')}</th> : null}
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name_ar}</td>
                {ENABLE_FR_VALUE_INPUTS ? <td>{r.name_fr}</td> : null}
                <td className="actionsCell">
                  <div className="actionsCellInner">
                    {!showHidden ? (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => openEdit(r)}>
                          {t('edit')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setHideTarget(r)}
                        >
                          {t('orgRefHide')}
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => restoreRow(r)}>
                        {t('orgRefRestore')}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !rows.length ? (
              <tr>
                <td colSpan={ENABLE_FR_VALUE_INPUTS ? 3 : 2}>{t('noResults')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <TablePagination page={page} total={total} onPageChange={setPage} />

      <ConfirmActionModal
        open={!!hideTarget}
        title={t('orgRefHideConfirmTitle')}
        message={t('orgRefHideConfirmDirection')}
        confirmLabel={t('orgRefHide')}
        variant="danger"
        loading={hideBusy}
        onConfirm={confirmHide}
        onClose={() => setHideTarget(null)}
      />

      {modalOpen ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{editId ? t('editDirection') : t('createDirection')}</h2>
            <label>
              {t('directionNameAr')}
              <input
                id="name_ar"
                className={form.hasFieldError('name_ar') ? 'inputInvalid' : ''}
                value={fields.name_ar}
                dir="rtl"
                onChange={(e) => setFields({ ...fields, name_ar: e.target.value })}
              />
              <FieldErrorText text={form.fieldErrorText('name_ar', t)} />
            </label>
            {ENABLE_FR_VALUE_INPUTS ? (
              <label>
                {t('directionNameFr')}
                <input
                  id="name_fr"
                  className={form.hasFieldError('name_fr') ? 'inputInvalid' : ''}
                  value={fields.name_fr}
                  dir={i18n.language === 'fr' ? 'ltr' : undefined}
                  onChange={(e) => setFields({ ...fields, name_fr: e.target.value })}
                />
                <FieldErrorText text={form.fieldErrorText('name_fr', t)} />
              </label>
            ) : null}
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
