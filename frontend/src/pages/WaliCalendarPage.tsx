import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import * as api from '../api'
import { BackButton } from '../components/BackButton'
import { backNavigationState } from '../utils/navigationBack'
import type { ReviewerMode } from '../utils/reviewerMode'
import { reviewerCalendarPath, reviewerHubPath, reviewerRapportViewPath } from '../utils/reviewerMode'

type Props = { token: string; reviewer?: ReviewerMode }

type CalendarEvent = {
  id: number
  rapport_id: number
  event_date: string
  title_ar?: string
  title_fr?: string
  note_ar?: string | null
  note_fr?: string | null
  rapport?: {
    title?: string
    content_kind?: string
    service?: { name_ar?: string; name_fr?: string }
  } | null
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatDayHeading(iso: string, locale: string) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'ar-DZ', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function pickLocalized(
  locale: string,
  ar?: string | null,
  fr?: string | null,
) {
  if (locale === 'fr') return String(fr || ar || '').trim()
  return String(ar || fr || '').trim()
}

function contentKindKey(kind?: string) {
  if (!kind) return null
  return `contentKind_${kind}`
}

const EVENT_KIND_CLASS: Record<string, string> = {
  table_grid: 'waliCalendarEvent--table_grid',
  document_compose: 'waliCalendarEvent--document_compose',
  fiche_lecture: 'waliCalendarEvent--fiche_lecture',
  commune_list: 'waliCalendarEvent--commune_list',
}

function eventCardClass(kind?: string, index = 0) {
  if (kind && EVENT_KIND_CLASS[kind]) return EVENT_KIND_CLASS[kind]
  return `waliCalendarEvent--tone${index % 4}`
}

export function WaliCalendarPage({ token, reviewer = 'wali' }: Props) {
  const { t, i18n } = useTranslation()
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<{ from?: string; to?: string; events?: CalendarEvent[] } | null>(
    null,
  )

  const load = useCallback(async () => {
    try {
      setData(
        await (reviewer === 'chef' ? api.getChefCalendar : api.getWaliCalendar)(token, { week: anchor }),
      )
    } catch {
      setData(null)
    }
  }, [token, anchor, reviewer])

  useEffect(() => {
    load()
  }, [load])

  const days = useMemo(() => {
    if (!data?.from) return []
    return Array.from({ length: 7 }, (_, i) => addDays(data.from!, i))
  }, [data?.from])

  const byDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const d of days) map[d] = []
    for (const e of data?.events || []) {
      if (map[e.event_date]) map[e.event_date].push(e)
    }
    return map
  }, [data?.events, days])

  const locale = i18n.language === 'fr' ? 'fr' : 'ar'
  const todayIso = new Date().toISOString().slice(0, 10)

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
        <BackButton to={reviewerHubPath(reviewer)} fallbackTo={reviewerHubPath(reviewer)} />
      </div>
      <p className="muted">
        {data?.from} — {data?.to}
      </p>
      <div className="waliCalendarList">
        {days.map((d) => {
          const events = byDay[d] || []
          const isToday = d === todayIso
          return (
            <section
              key={d}
              className={`waliCalendarDay card${isToday ? ' waliCalendarDay--today' : ''}`}
            >
              <header className="waliCalendarDayHeader">
                <time dateTime={d} className="waliCalendarDayDate">
                  {formatDayHeading(d, locale)}
                </time>
                <span className="waliCalendarDayIso">{d}</span>
                {isToday ? (
                  <span className="waliCalendarDayToday badge badge-submitted">{t('today')}</span>
                ) : null}
                {events.length ? (
                  <span className="waliCalendarDayCount badge">{events.length}</span>
                ) : null}
              </header>
              {events.length ? (
                <ul className="waliCalendarEvents">
                  {events.map((e, eventIndex) => {
                    const eventTitle = pickLocalized(locale, e.title_ar, e.title_fr)
                    const serviceName = pickLocalized(
                      locale,
                      e.rapport?.service?.name_ar,
                      e.rapport?.service?.name_fr,
                    )
                    const kindKey = contentKindKey(e.rapport?.content_kind)
                    const note = pickLocalized(locale, e.note_ar, e.note_fr)
                    const showRapportTitle =
                      e.rapport?.title &&
                      eventTitle &&
                      e.rapport.title.trim() !== eventTitle.trim()
                    return (
                      <li
                        key={e.id}
                        className={`waliCalendarEvent ${eventCardClass(e.rapport?.content_kind, eventIndex)}`}
                      >
                        <Link
                          to={reviewerRapportViewPath(reviewer, e.rapport_id)}
                          state={backNavigationState(reviewerCalendarPath(reviewer))}
                          className="waliCalendarEventTitle"
                        >
                          {eventTitle || e.rapport?.title || `#${e.rapport_id}`}
                        </Link>
                        <div className="waliCalendarEventMeta">
                          {kindKey ? (
                            <span className="waliCalendarEventKind badge">{t(kindKey)}</span>
                          ) : null}
                          {serviceName ? (
                            <span className="waliCalendarEventService muted small">{serviceName}</span>
                          ) : null}
                          {showRapportTitle ? (
                            <span className="waliCalendarEventRapport muted small">{e.rapport!.title}</span>
                          ) : null}
                        </div>
                        {note ? <p className="waliCalendarEventNote muted small">{note}</p> : null}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="waliCalendarEmpty muted small">{t('noResults')}</p>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
