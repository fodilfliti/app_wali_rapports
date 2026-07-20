import type { ReactNode } from 'react'
import { PageLoading } from './PageLoading'
import { ListRefreshIndicator } from './ListRefreshIndicator'

type Props = {
  /** True when there is no cached data yet (first load). */
  isInitialLoading: boolean
  /** True when a background refetch is running and cached data exists. */
  isRefreshing?: boolean
  children: ReactNode
  loadingClassName?: string
}

/**
 * Wraps list content with correct loading UX:
 * - first visit → PageLoading
 * - return visit → show children + subtle updating indicator
 */
export function QueryListShell({
  isInitialLoading,
  isRefreshing,
  children,
  loadingClassName,
}: Props) {
  if (isInitialLoading) {
    return <PageLoading className={loadingClassName} />
  }
  return (
    <>
      <ListRefreshIndicator show={isRefreshing} />
      {children}
    </>
  )
}
