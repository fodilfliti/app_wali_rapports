import { useTranslation } from 'react-i18next'

export type CalendarEvent = {
  id?: number
  event_date: string
  title_ar: string
  title_fr: string
  note_ar?: string
  note_fr?: string
}

type Props = {
  events: CalendarEvent[]
  editable: boolean
  onChange: (events: CalendarEvent[]) => void
}

function emptyEvent(): CalendarEvent {
  return { event_date: new Date().toISOString().slice(0, 10), title_ar: '', title_fr: '', note_ar: '', note_fr: '' }
}

export function CalendarEventsEditor({ events, editable, onChange }: Props) {
  const { t, i18n } = useTranslation()

  function update(i: number, patch: Partial<CalendarEvent>) {
    onChange(events.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  }

  function add() {
    onChange([...events, emptyEvent()])
  }

  function remove(i: number) {
    onChange(events.filter((_, idx) => idx !== i))
  }

  if (!editable && !events.length) return null

  return (
    <div className="section calendarEventsSection">
      <h2>{t('calendarEvents')}</h2>
      {editable ? <p className="muted small calendarEventsHelp">{t('calendarEventsHelp')}</p> : null}
      {events.map((e, i) => (
        <div key={i} className="calendarEventRow card">
          <label>
            {t('eventDate')}
            <input
              type="date"
              value={e.event_date || ''}
              disabled={!editable}
              onChange={(ev) => update(i, { event_date: ev.target.value })}
            />
          </label>
          <label>
            {t('rapportTitle')}
            <input
              value={i18n.language === 'fr' ? e.title_fr : e.title_ar}
              disabled={!editable}
              onChange={(ev) =>
                update(i, i18n.language === 'fr' ? { title_fr: ev.target.value } : { title_ar: ev.target.value })
              }
            />
          </label>
          <label>
            {t('eventNote')}
            <textarea
              rows={2}
              value={i18n.language === 'fr' ? e.note_fr || '' : e.note_ar || ''}
              disabled={!editable}
              onChange={(ev) =>
                update(i, i18n.language === 'fr' ? { note_fr: ev.target.value } : { note_ar: ev.target.value })
              }
            />
          </label>
          {editable ? (
            <button type="button" className="btn btn-ghost" onClick={() => remove(i)}>
              {t('remove')}
            </button>
          ) : null}
        </div>
      ))}
      {editable ? (
        <button type="button" className="btn btn-secondary" onClick={add}>
          {t('addCalendarEvent')}
        </button>
      ) : null}
    </div>
  )
}

export function CalendarEventsView({ events }: { events: CalendarEvent[] }) {
  const { t, i18n } = useTranslation()
  if (!events?.length) return null
  return (
    <div className="section">
      <h2>{t('calendarEvents')}</h2>
      <ul className="calendarEventList">
        {events.map((e) => (
          <li key={e.id ?? `${e.event_date}-${e.title_ar}`}>
            <strong>{e.event_date}</strong> — {i18n.language === 'fr' ? e.title_fr || e.title_ar : e.title_ar || e.title_fr}
          </li>
        ))}
      </ul>
    </div>
  )
}
