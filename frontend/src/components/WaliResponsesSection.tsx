import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TablePagination } from './TablePagination'
import { waliResponseBodyText } from './WaliRespondModal'
import { waliDecisionLabel } from '../utils/waliDecision'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'

export type ReviewResponseRow = {
  id: number
  decision: string
  follow_up_status?: string | null
  body_text?: string | null
  created_at?: string
  rapport_version_id?: number | string | null
}

type Props = {
  chefResponses?: ReviewResponseRow[]
  responses: ReviewResponseRow[]
  className?: string
}

function ResponseNotesList({
  responses,
  heading,
  className,
}: {
  responses: ReviewResponseRow[]
  heading: string
  className?: string
}) {
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
      <h2>{heading}</h2>
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

export function WaliResponsesSection({ chefResponses, responses, className }: Props) {
  const { t } = useTranslation()
  const chefList = chefResponses || []
  const waliList = responses || []

  if (!chefList.length && !waliList.length) return null

  return (
    <>
      <ResponseNotesList
        responses={chefList}
        heading={t('chefResponseText')}
        className={className}
      />
      <ResponseNotesList
        responses={waliList}
        heading={t('waliResponseText')}
        className={className}
      />
    </>
  )
}

export type WaliResponseRow = ReviewResponseRow
