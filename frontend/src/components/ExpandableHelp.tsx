import type { ReactNode } from 'react'

type Props = {
  title: string
  children: ReactNode
  className?: string
}

/** Collapsible help block — keeps long descriptions out of the way until expanded. */
export function ExpandableHelp({ title, children, className = '' }: Props) {
  return (
    <details className={`schemaHelpExpand ${className}`.trim()}>
      <summary className="schemaHelpExpandSummary">{title}</summary>
      <div className="schemaHelpExpandBody">{children}</div>
    </details>
  )
}
