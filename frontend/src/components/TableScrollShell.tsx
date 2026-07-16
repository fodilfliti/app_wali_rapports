import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  computeTableLayoutPolicy,
  tableScrollShellClass,
  type TableLayoutPolicy,
} from '../utils/tableLayoutPolicy'
import type { Column } from '../utils/tableLayout'

type Props = {
  columns: Column[]
  rows?: Record<string, unknown>[]
  metaColCount?: number
  embedded?: boolean
  policy?: TableLayoutPolicy
  className?: string
  children: ReactNode
}

export function TableScrollShell({
  columns,
  rows = [],
  metaColCount = 0,
  embedded = false,
  policy: policyProp,
  className = '',
  children,
}: Props) {
  const { i18n } = useTranslation()
  const locale = i18n.language === 'fr' ? 'fr' : 'ar'
  const policy =
    policyProp ??
    computeTableLayoutPolicy({
      columns,
      rows,
      metaColCount,
      embedded,
      locale,
    })

  const shellClass = `${tableScrollShellClass(policy)}${className ? ` ${className}` : ''}`.trim()

  const style: CSSProperties | undefined =
    policy.estimatedMinWidthPx > 0
      ? ({ ['--table-min-width' as string]: `${policy.estimatedMinWidthPx}px` } as CSSProperties)
      : undefined

  return (
    <div
      className={shellClass}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      style={style}
      data-table-cols={policy.totalCols}
      data-table-orient={policy.orientation}
      data-table-min-w={policy.estimatedMinWidthPx}
    >
      {children}
    </div>
  )
}
