import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'

type Props = { token: string }

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function WaliCalendarPage({ token }: Props) {
  const { t, i18n } = useTranslation()
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<any>(null)

  const load = useCallback(async () => {
    try {
      setData(await api.getWaliCalendar(token, { week: anchor }))
    } catch {
      setData(null)
    }
  }, [token, anchor])

  useEffect(() => {
    load()
  }, [load])

  const days = useMemo(() => {
    if (!data?.from) return []
    return Array.from({ length: 7 }, (_, i) => addDays(data.from, i))
  }, [data?.from])

  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {}
    for (const d of days) map[d] = []
    for (const e of data?.events || []) {
      if (map[e.event_date]) map[e.event_date].push(e)
    }
    return map
  }, [data?.events, days])

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{t('navCalendar')}</h1>
        <button type="button" className="btn btn-secondary" onClick={() => setAnchor(addDays(anchor, -7))}>
          {t('prevWeek')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setAnchor(new Date().toISOString().slice(0, 10))}>
          {t('thisWeek')}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => setAnchor(addDays(anchor, 7))}>
          {t('nextWeek')}
        </button>
        <BackButton fallbackTo="/wali" />
      </div>
      <p className="muted">
        {data?.from} — {data?.to}
      </p>
      <div className="waliCalendarGrid">
        {days.map((d) => (
          <div key={d} className="waliCalendarDay card">
            <h3>{d}</h3>
            <ul>
              {(byDay[d] || []).map((e: any) => (
                <li key={e.id}>
                  <Link to={`/wali/rapports/${e.rapport_id}/view`}>
                    {i18n.language === 'fr' ? e.title_fr || e.title_ar : e.title_ar || e.title_fr}
                  </Link>
                  <span className="muted small block">{e.rapport?.title}</span>
                </li>
              ))}
            </ul>
            {!byDay[d]?.length ? <p className="muted small">{t('noResults')}</p> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
