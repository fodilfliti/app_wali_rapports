import { queryClient } from '../query/queryClient'
import { invalidateHotLists } from '../query/invalidateAppQueries'

export const HUB_COUNTS_REFRESH_EVENT = 'hub-counts-refresh'

/** Invalidate + refetch all hot list caches (including unmounted badge pages). */
export function notifyHubCountsRefresh(): Promise<void> {
  window.dispatchEvent(new Event(HUB_COUNTS_REFRESH_EVENT))
  return invalidateHotLists(queryClient)
}
