import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import * as api from '../api'
import { CACHE } from '../query/cachePolicy'
import { queryKeys } from '../query/queryKeys'

const emptyWaliCounts: api.WaliHubCounts = {
  inbox_pending: 0,
  office_users_pending: 0,
  unread_discussion: 0,
  unread_shared_files: 0,
  unread_chef_instructions: 0,
}

const emptyChefCounts: api.ChefHubCounts = {
  inbox_pending: 0,
  office_users_pending: 0,
  unread_discussion: 0,
  unread_shared_files: 0,
  delete_pending: 0,
  unread_chef_instructions: 0,
}

const emptyOfficeCounts: api.OfficeHubCounts = {
  unread_notifications: 0,
  changes_requested_rapports: 0,
  unread_shared_files: 0,
  unread_instructions: 0,
  unread_chef_instructions: 0,
  unread_discussion: 0,
  services_action_count: 0,
}

export function useOfficeHubCounts(token: string) {
  const query = useQuery({
    queryKey: queryKeys.hubCounts('office'),
    queryFn: () => api.getOfficeHubCounts(token),
    enabled: !!token,
    staleTime: CACHE.hubCounts.staleTime,
    gcTime: CACHE.hubCounts.gcTime,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    placeholderData: emptyOfficeCounts,
  })

  const queryClient = useQueryClient()
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.hubCounts('office'),
      refetchType: 'all',
    })
  }, [queryClient])

  return { counts: query.data ?? emptyOfficeCounts, refresh, isFetching: query.isFetching }
}

export function useWaliHubCounts(token: string) {
  const query = useQuery({
    queryKey: queryKeys.hubCounts('wali'),
    queryFn: () => api.getWaliHubCounts(token),
    enabled: !!token,
    staleTime: CACHE.hubCounts.staleTime,
    gcTime: CACHE.hubCounts.gcTime,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    placeholderData: emptyWaliCounts,
  })

  const queryClient = useQueryClient()
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.hubCounts('wali'),
      refetchType: 'all',
    })
  }, [queryClient])

  return { counts: query.data ?? emptyWaliCounts, refresh, isFetching: query.isFetching }
}

export function useChefHubCounts(token: string) {
  const query = useQuery({
    queryKey: queryKeys.hubCounts('chef'),
    queryFn: () => api.getChefHubCounts(token),
    enabled: !!token,
    staleTime: CACHE.hubCounts.staleTime,
    gcTime: CACHE.hubCounts.gcTime,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    placeholderData: emptyChefCounts,
  })

  const queryClient = useQueryClient()
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.hubCounts('chef'),
      refetchType: 'all',
    })
  }, [queryClient])

  return { counts: query.data ?? emptyChefCounts, refresh, isFetching: query.isFetching }
}
