import { useCallback, useEffect, useState } from 'react'
import { getApiBase } from '../utils/apiBase'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { FieldErrorText } from '../components/FieldErrorText'
import { FormErrorBlock } from '../components/FormErrorBlock'
import { useSnackbar } from '../snackbar/SnackbarContext'
import { waliRespondSchema } from '../validation/schemas/forms'
import { useZodForm } from '../validation/useZodForm'

type Props = { token: string }

function statusLabel(status: string, t: (k: string) => string) {
  const map: Record<string, string> = {
    draft: 'statusDraft',
    submitted: 'statusSubmitted',
    under_review: 'statusUnderReview',
    changes_requested: 'statusChangesRequested',
    acknowledged: 'statusAcknowledged',
  }
  return t(map[status] || 'statusDraft')
}

export function OfficeRapportsListPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [params] = useSearchParams()
  const serviceId = params.get('service_id') ? Number(params.get('service_id')) : undefined
  const [rows, setRows] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rapportsRes, servicesRes] = await Promise.all([
        api.listOfficeRapports(token, { service_id: serviceId }),
        api.listOfficeServices(token),
      ])
      setRows(rapportsRes.rapports)
      setServices(servicesRes.services)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    } finally {
      setLoading(false)
    }
  }, [token, serviceId, snack, t])

  useEffect(() => {
    load()
  }, [load])

  async function createSample() {
    const service = services.find((s) => (serviceId ? s.id === serviceId : true))
    const rapportType = service?.rapportTypes?.[0]
    if (!service || !rapportType) return
    try {
      await api.createRapport(token, {
        service_id: service.id,
        rapport_type_id: rapportType.id,
        title: `${i18n.language === 'fr' ? service.name_fr : service.name_ar} — ${new Date().toLocaleDateString()}`,
      })
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  async function submit(id: number) {
    try {
      await api.submitRapport(token, id)
      load()
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navRapports')}</h1>
        <button type="button" className="btn btn-primary" onClick={createSample}>
          {t('createRapport')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          {t('refresh')}
        </button>
        <BackButton fallbackTo="/" />
      </div>

      <div className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>{t('rapportTitle')}</th>
              <th>{t('rapportStatus')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>
                  <span className={`badge badge-${r.status}`}>{statusLabel(r.status, t)}</span>
                </td>
                <td>
                  {r.status === 'draft' || r.status === 'changes_requested' ? (
                    <button type="button" className="btn btn-accent" onClick={() => submit(r.id)}>
                      {t('submitRapport')}
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={3}>{t('noResults')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function WaliRapportsInboxPage({ token }: Props) {
  const { t } = useTranslation()
  const snack = useSnackbar()
  const form = useZodForm(waliRespondSchema)
  const [rows, setRows] = useState<any[]>([])
  const [respondId, setRespondId] = useState<number | null>(null)
  const [decision, setDecision] = useState<'accepted' | 'changes_requested' | 'viewed'>('accepted')
  const [bodyText, setBodyText] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await api.listWaliRapports(token, {})
      setRows(res.rapports)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [token, snack, t])

  useEffect(() => {
    load()
  }, [load])

  async function sendResponse() {
    if (!respondId) return
    const payload = { decision, body_text: bodyText || undefined }
    if (!form.validate(payload, t, decision === 'changes_requested' ? ['body_text'] : [])) return
    try {
      await api.waliRespond(token, respondId, payload)
      setRespondId(null)
      setBodyText('')
      load()
    } catch (e) {
      if (e instanceof api.ApiError && e.fieldErrors) form.setFieldErrorsFromApi(e.fieldErrors)
      snack.show(t('errorGeneric'), 'error')
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navInbox')}</h1>
        <button type="button" className="btn btn-secondary" onClick={load}>
          {t('refresh')}
        </button>
        <BackButton fallbackTo="/" />
      </div>

      <div className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>{t('rapportTitle')}</th>
              <th>{t('rapportStatus')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{statusLabel(r.status, t)}</td>
                <td>
                  <Link className="btn btn-ghost" to={`/wali/rapports/${r.id}/view`}>
                    {t('details')}
                  </Link>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setRespondId(r.id)
                      form.clearErrors()
                    }}
                  >
                    {t('respondRapport')}
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={3}>{t('noResults')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {respondId ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{t('respondRapport')}</h2>
            <label>
              {t('waliDecision')}
              <select value={decision} onChange={(e) => setDecision(e.target.value as typeof decision)}>
                <option value="accepted">{t('waliAccepted')}</option>
                <option value="changes_requested">{t('waliChangesRequested')}</option>
                <option value="viewed">{t('waliViewed')}</option>
              </select>
            </label>
            <label>
              {t('waliResponseText')}
              <textarea
                id="body_text"
                className={form.hasFieldError('body_text') ? 'inputInvalid' : ''}
                rows={5}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
              />
              <FieldErrorText text={form.fieldErrorText('body_text', t)} />
            </label>
            <FormErrorBlock message={form.formError} />
            <div className="modalActions">
              <button type="button" className="btn btn-primary" onClick={sendResponse}>
                {t('save')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setRespondId(null)}>
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function AdminRapportsListPage({ token }: Props) {
  const { t } = useTranslation()
  const [rows, setRows] = useState<any[]>([])

  useEffect(() => {
    fetch(`${getApiBase()}/admin/rapports`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setRows(d.rapports || []))
      .catch(() => {})
  }, [token])

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navRapports')}</h1>
        <BackButton fallbackTo="/" />
      </div>
      <div className="card tableWrap">
        <table>
          <thead>
            <tr>
              <th>{t('rapportTitle')}</th>
              <th>{t('rapportStatus')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.title}</td>
                <td>{statusLabel(r.status, t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
