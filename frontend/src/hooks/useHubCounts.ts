import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import * as api from '../api'
import { HUB_COUNTS_REFRESH_EVENT } from '../utils/hubCountsRefresh'

const emptyOfficeCounts: api.OfficeHubCounts = {
  unread_notifications: 0,
  changes_requested_rapports: 0,
  unread_shared_files: 0,
  unread_instructions: 0,
  services_action_count: 0,
}

const emptyWaliCounts: api.WaliHubCounts = {
  inbox_pending: 0,
  office_users_pending: 0,
  unread_discussion: 0,
}

const emptyChefCounts: api.ChefHubCounts = {
  inbox_pending: 0,
  office_users_pending: 0,
  unread_discussion: 0,
}

export function useOfficeHubCounts(token: string) {
  const location = useLocation()
  const [counts, setCounts] = useState<api.OfficeHubCounts>(emptyOfficeCounts)

  const refresh = useCallback(() => {
    api.getOfficeHubCounts(token).then(setCounts).catch(() => setCounts(emptyOfficeCounts))
  }, [token])

  useEffect(() => {
    refresh()
  }, [refresh, location.pathname])

  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener(HUB_COUNTS_REFRESH_EVENT, refresh)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(HUB_COUNTS_REFRESH_EVENT, refresh)
    }
  }, [refresh])

  return { counts, refresh }
}

export function useWaliHubCounts(token: string) {
  const location = useLocation()
  const [counts, setCounts] = useState<api.WaliHubCounts>(emptyWaliCounts)

  const refresh = useCallback(() => {
    api.getWaliHubCounts(token).then(setCounts).catch(() => setCounts(emptyWaliCounts))
  }, [token])

  useEffect(() => {
    refresh()
  }, [refresh, location.pathname])

  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener(HUB_COUNTS_REFRESH_EVENT, refresh)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(HUB_COUNTS_REFRESH_EVENT, refresh)
    }
  }, [refresh])

  return { counts, refresh }
}

export function useChefHubCounts(token: string) {
  const location = useLocation()
  const [counts, setCounts] = useState<api.ChefHubCounts>(emptyChefCounts)

  const refresh = useCallback(() => {
    api.getChefHubCounts(token).then(setCounts).catch(() => setCounts(emptyChefCounts))
  }, [token])

  useEffect(() => {
    refresh()
  }, [refresh, location.pathname])

  useEffect(() => {
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener(HUB_COUNTS_REFRESH_EVENT, refresh)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(HUB_COUNTS_REFRESH_EVENT, refresh)
    }
  }, [refresh])

  return { counts, refresh }
}
