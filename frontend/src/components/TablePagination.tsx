import { useTranslation } from 'react-i18next'
import { DEFAULT_PAGE_SIZE, totalPages } from '../utils/pagination'

type Props = {
  page: number
  total: number
  pageSize?: number
  onPageChange: (page: number) => void
  compact?: boolean
}

export function TablePagination({
  page,
  total,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  compact = false,
}: Props) {
  const { t } = useTranslation()
  const pages = totalPages(total, pageSize)

  if (total <= pageSize) return null

  const btnClass = compact ? 'btn btn-secondary btn-sm' : 'btn btn-secondary'

  return (
    <div className="pagination">
      <button type="button" className={btnClass} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        {'<'}
      </button>
      <span>{t('paginationSummary', { page, totalPages: pages, total })}</span>
      <button type="button" className={btnClass} disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
        {'>'}
      </button>
    </div>
  )
}
