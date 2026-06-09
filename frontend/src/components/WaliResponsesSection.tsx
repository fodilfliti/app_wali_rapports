import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TablePagination } from './TablePagination'
import { waliResponseBodyText } from './WaliRespondModal'
import { waliDecisionLabel } from '../utils/waliDecision'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'

export type WaliResponseRow = {
  id: number
  decision: string
  follow_up_status?: string | null
  body_text?: string | null
  created_at?: string
}

type Props = {
  responses: WaliResponseRow[]
  className?: string
}

export function WaliResponsesSection({ responses, className }: Props) {
  const { t, i18n } = useTranslation()
  const [page, setPage] = useState(1)
  const list = responses || []

  useEffect(() => {
    setPage(1)
  }, [list.length])

  if (!list.length) return null

  const paged = paginateSlice(list, page, DEFAULT_PAGE_SIZE)

  return (
    <div className={`section waliResponsesSection${className ? ` ${className}` : ''}`}>
      <h2>{t('waliResponseText')}</h2>
      <div className="waliNotesList">
        {paged.map((w) => (
          <div key={w.id} className={`waliNote waliNote-${w.decision}`}>
            <div className="waliNoteHeader">
              <span className={`badge badge-wali-${w.decision}`}>
                {waliDecisionLabel(w.decision, t, w.follow_up_status)}
              </span>
              {w.created_at ? (
                <time className="waliNoteDate muted small" dateTime={w.created_at}>
                  {new Date(w.created_at).toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'ar-DZ')}
                </time>
              ) : null}
            </div>
            {waliResponseBodyText(w.body_text) ? (
              <p className="waliNoteBody">{waliResponseBodyText(w.body_text)}</p>
            ) : null}
          </div>
        ))}
      </div>
      <TablePagination page={page} total={list.length} onPageChange={setPage} />
    </div>
  )
}
