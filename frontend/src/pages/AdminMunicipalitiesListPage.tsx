import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { ENABLE_FR_VALUE_INPUTS } from '../config/features'
import { BackButton } from '../components/BackButton'
import { TablePagination } from '../components/TablePagination'
import { FieldErrorText } from '../components/FieldErrorText'
import { FormErrorBlock } from '../components/FormErrorBlock'
import { RapportListScopeFilter } from '../components/RapportListScopeFilter'
import { ConfirmActionModal } from '../components/ConfirmActionModal'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { municipalityFormSchema } from '../validation/schemas/forms'
import { useZodForm } from '../validation/useZodForm'
import { QueryListShell } from '../components/QueryListShell'
import { BusyButton } from '../components/BusyButton'
import { useAdminDairasQuery, useAdminMunicipalitiesQuery } from '../hooks/queries/useListQueries'
import { useInvalidateAppQueries } from '../hooks/useInvalidateAppQueries'

type Props = { token: string }

export function AdminMunicipalitiesListPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const invalidate = useInvalidateAppQueries()
  const form = useZodForm(municipalityFormSchema)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [fields, setFields] = useState({ name_ar: '', name_fr: '', code: '', daira_id: '' })
  const [editDaira, setEditDaira] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [hideTarget, setHideTarget] = useState<any | null>(null)
  const [hideBusy, setHideBusy] = useState(false)

  const dairasQuery = useAdminDairasQuery(token, { page: 1, pageSize: 100 })
  const dairas = dairasQuery.data?.dairas ?? []

  const listQuery = useAdminMunicipalitiesQuery(token, { page, q, hidden_only: showHidden })
  const rows = listQuery.data?.municipalities ?? []
  const total = listQuery.data?.total ?? 0
  const isInitialLoading = listQuery.isLoading && !listQuery.data
  const isRefreshing = listQuery.isFetching && !listQuery.isLoading

  useEffect(() => {
    setPage(1)
  }, [showHidden, q])

  useEffect(() => {
    if (listQuery.isError) {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [listQuery.isError, snack, t])

  const dairaOptions = useMemo(() => {
    const list = [...dairas]
    if (editDaira && !list.some((d) => Number(d.id) === Number(editDaira.id))) {
      list.push(editDaira)
    }
    return list
  }, [dairas, editDaira])

  function openCreate() {
    setEditId(null)
    setEditDaira(null)
    setFields({ name_ar: '', name_fr: '', code: '', daira_id: '' })
    form.clearErrors()
    setModalOpen(true)
  }

  function openEdit(row: any) {
    setEditId(row.id)
    setEditDaira(row.daira || null)
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
      await invalidate({ adminRef: true })
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
      await api.hideMunicipality(token, hideTarget.id)
      snack.show(t('orgRefHideDone'), 'success')
      setHideTarget(null)
      await invalidate({ adminRef: true })
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setHideBusy(false)
    }
  }

  async function restoreRow(row: any) {
    try {
      await api.restoreMunicipality(token, row.id)
      snack.show(t('orgRefRestoreDone'), 'success')
      await invalidate({ adminRef: true })
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navMunicipalities')}</h1>
        {!showHidden ? (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            {t('createMunicipality')}
          </button>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={() => listQuery.refetch()} disabled={listQuery.isFetching}>
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
          onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
        />
      </div>

      <QueryListShell isInitialLoading={isInitialLoading} isRefreshing={isRefreshing}>

      <div className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>{t('municipalityCode')}</th>
              <th>{t('municipalityNameAr')}</th>
              {ENABLE_FR_VALUE_INPUTS ? <th>{t('municipalityNameFr')}</th> : null}
              <th>{t('dairaLabel')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.code}</td>
                <td>{r.name_ar}</td>
                {ENABLE_FR_VALUE_INPUTS ? <td>{r.name_fr}</td> : null}
                <td>
                  {r.daira
                    ? i18n.language === 'fr'
                      ? r.daira.name_fr
                      : r.daira.name_ar
                    : '—'}
                </td>
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
            {!isInitialLoading && !rows.length ? (
              <tr>
                <td colSpan={ENABLE_FR_VALUE_INPUTS ? 5 : 4}>{t('noResults')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <TablePagination page={page} total={total} onPageChange={setPage} />
      </QueryListShell>

      <ConfirmActionModal
        open={!!hideTarget}
        title={t('orgRefHideConfirmTitle')}
        message={t('orgRefHideConfirmMunicipality')}
        confirmLabel={t('orgRefHide')}
        variant="danger"
        loading={hideBusy}
        onConfirm={confirmHide}
        onClose={() => setHideTarget(null)}
      />

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
            {ENABLE_FR_VALUE_INPUTS ? (
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
            ) : null}
            <label>
              {t('dairaLabel')}
              <select
                id="daira_id"
                className={form.hasFieldError('daira_id') ? 'inputInvalid' : ''}
                value={fields.daira_id}
                onChange={(e) => setFields({ ...fields, daira_id: e.target.value })}
              >
                <option value="">{t('selectDaira')}</option>
                {dairaOptions.map((d) => (
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
