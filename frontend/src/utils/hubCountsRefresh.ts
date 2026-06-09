export const HUB_COUNTS_REFRESH_EVENT = 'hub-counts-refresh'

export function notifyHubCountsRefresh() {
  window.dispatchEvent(new Event(HUB_COUNTS_REFRESH_EVENT))
}
