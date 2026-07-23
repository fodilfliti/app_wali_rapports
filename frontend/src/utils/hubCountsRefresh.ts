import { queryClient } from '../query/queryClient'
import { invalidateHotLists } from '../query/invalidateAppQueries'

export const HUB_COUNTS_REFRESH_EVENT = 'hub-counts-refresh'
export const DISCUSSION_REFRESH_EVENT = 'wali:discussion-refresh'

import type { EntityIdParam } from '../api'

export type DiscussionRefreshDetail = { rapportId: EntityIdParam }

/** Invalidate + refetch all hot list caches (including unmounted badge pages). */
export function notifyHubCountsRefresh(): Promise<void> {
  window.dispatchEvent(new Event(HUB_COUNTS_REFRESH_EVENT))
  return invalidateHotLists(queryClient)
}

/** Ask open discussion sections for this rapport to reload + scroll (push while viewing). */
export function notifyDiscussionRefresh(rapportId: EntityIdParam) {
  if (rapportId == null || rapportId === '') return
  window.dispatchEvent(
    new CustomEvent(DISCUSSION_REFRESH_EVENT, {
      detail: { rapportId } satisfies DiscussionRefreshDetail,
    }),
  )
}
