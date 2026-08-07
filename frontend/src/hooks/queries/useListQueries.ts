import { keepPreviousData, useQuery } from '@tanstack/react-query'
import * as api from '../../api'
import type { EntityIdParam, GuideVideoListRole } from '../../api'
import { CACHE } from '../../query/cachePolicy'
import { queryKeys } from '../../query/queryKeys'
import { isDedicatedNotificationKey } from '../../utils/notificationKeys'

export function useOfficeServiceTreeQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.officeServiceTree(),
    queryFn: () => api.listOfficeServiceTree(token),
    enabled: !!token,
    staleTime: CACHE.serviceTree.staleTime,
    gcTime: CACHE.serviceTree.gcTime,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    select: (data) => data.services,
  })
}

export function useReviewerOfficeUsersQuery(token: string, reviewer: 'wali' | 'chef') {
  return useQuery({
    queryKey: queryKeys.reviewerOfficeUsers(reviewer),
    queryFn: () =>
      reviewer === 'chef'
        ? api.listChefOfficeUsers(token)
        : api.listWaliOfficeUsers(token),
    enabled: !!token,
    staleTime: CACHE.officeUsers.staleTime,
    gcTime: CACHE.officeUsers.gcTime,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    select: (data) => data.officeUsers,
  })
}

export function useReviewerUserServicesQuery(
  token: string,
  userId: EntityIdParam,
  reviewer: 'wali' | 'chef',
) {
  return useQuery({
    queryKey: queryKeys.reviewerUserServices(reviewer, userId),
    queryFn: () =>
      reviewer === 'chef'
        ? api.listChefUserServices(token, userId)
        : api.listWaliUserServices(token, userId),
    enabled: !!token && userId != null && userId !== '',
    staleTime: CACHE.serviceTree.staleTime,
    gcTime: CACHE.serviceTree.gcTime,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    select: (data) => data.services,
  })
}

export function useReviewerServiceHubQuery(
  token: string,
  userId: EntityIdParam,
  serviceId: EntityIdParam,
  reviewer: 'wali' | 'chef',
) {
  const scope = reviewer === 'chef' ? 'chef' : 'wali'
  return useQuery({
    queryKey: queryKeys.serviceHub(scope, serviceId, { userId }),
    queryFn: () =>
      reviewer === 'chef'
        ? api.getChefServiceContentHub(token, userId, serviceId)
        : api.getWaliServiceContentHub(token, userId, serviceId),
    enabled:
      !!token &&
      userId != null &&
      userId !== '' &&
      serviceId != null &&
      serviceId !== '',
    staleTime: CACHE.serviceHub.staleTime,
    gcTime: CACHE.serviceHub.gcTime,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  })
}

export function useOfficeServiceHubQuery(
  token: string,
  serviceId: EntityIdParam,
  opts?: { hidden_only?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.serviceHub('office', serviceId, opts ?? {}),
    queryFn: () => api.getServiceContentHub(token, serviceId, opts),
    enabled: !!token && serviceId != null && serviceId !== '',
    staleTime: CACHE.serviceHub.staleTime,
    gcTime: CACHE.serviceHub.gcTime,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  })
}

export function useCalendarWeekQuery(
  token: string,
  week: string,
  reviewer: 'wali' | 'chef',
) {
  return useQuery({
    queryKey: queryKeys.calendarWeek(reviewer, week),
    queryFn: () =>
      reviewer === 'chef'
        ? api.getChefCalendar(token, { week })
        : api.getWaliCalendar(token, { week }),
    enabled: !!token && !!week,
    staleTime: CACHE.calendarWeek.staleTime,
    gcTime: CACHE.calendarWeek.gcTime,
    refetchOnWindowFocus: false,
  })
}

type OfficeRapportsParams = {
  service_id?: EntityIdParam
  rapport_type_id?: EntityIdParam
  page: number
  pageSize: number
  search?: string
  status_group?: string
  sort?: string
  hidden_only?: boolean
  unread_discussion?: boolean
  has_discussion?: boolean
}

export function useOfficeRapportsListQuery(token: string, params: OfficeRapportsParams) {
  return useQuery({
    queryKey: queryKeys.rapports('office', params as Record<string, unknown>),
    queryFn: () => api.listOfficeRapports(token, params),
    enabled: !!token,
    staleTime: CACHE.rapportsList.staleTime,
    gcTime: CACHE.rapportsList.gcTime,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })
}

type ReviewerRapportsParams = {
  page: number
  pageSize: number
  search?: string
  status_group?: string
  sort?: string
  service_id?: EntityIdParam
  rapport_type_id?: EntityIdParam
  office_user_id?: EntityIdParam
  unread_discussion?: boolean
  has_discussion?: boolean
}

export function useReviewerRapportsListQuery(
  token: string,
  reviewer: 'wali' | 'chef',
  params: ReviewerRapportsParams,
) {
  const scope = reviewer === 'chef' ? 'chef' : 'wali'
  return useQuery({
    queryKey: queryKeys.rapports(scope, params as Record<string, unknown>),
    queryFn: () =>
      reviewer === 'chef'
        ? api.listChefRapports(token, params)
        : api.listWaliRapports(token, params),
    enabled: !!token,
    staleTime: CACHE.rapportsList.staleTime,
    gcTime: CACHE.rapportsList.gcTime,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  })
}

export function useAdminRapportsListQuery(
  token: string,
  params: {
    page: number
    pageSize: number
    search?: string
    status_group?: string
    sort?: string
    hidden_only?: boolean
  },
) {
  return useQuery({
    queryKey: queryKeys.rapports('admin', params as Record<string, unknown>),
    queryFn: () => api.listAdminRapports(token, params),
    enabled: !!token,
    staleTime: CACHE.rapportsList.staleTime,
    gcTime: CACHE.rapportsList.gcTime,
    placeholderData: keepPreviousData,
  })
}

export function useAdminServicesQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.adminServices(),
    queryFn: () => api.listAdminServices(token),
    enabled: !!token,
    staleTime: CACHE.adminRef.staleTime,
    gcTime: CACHE.adminRef.gcTime,
  })
}

export function useAdminOfficeUsersQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.adminOfficeUsers(),
    queryFn: () => api.listAdminOfficeUsers(token),
    enabled: !!token,
    staleTime: CACHE.adminRef.staleTime,
    gcTime: CACHE.adminRef.gcTime,
    select: (data) => data.users,
  })
}

export function useAdminMunicipalitiesQuery(
  token: string,
  params: { page: number; q?: string; hidden_only?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.adminMunicipalities(params as Record<string, unknown>),
    queryFn: () => api.listMunicipalities(token, params),
    enabled: !!token,
    staleTime: CACHE.adminRef.staleTime,
    gcTime: CACHE.adminRef.gcTime,
    placeholderData: keepPreviousData,
  })
}

export function useAdminDairasQuery(
  token: string,
  params: { page: number; q?: string; hidden_only?: boolean; pageSize?: number },
) {
  return useQuery({
    queryKey: queryKeys.adminDairas(params as Record<string, unknown>),
    queryFn: () => api.listDairas(token, params),
    enabled: !!token,
    staleTime: CACHE.adminRef.staleTime,
    gcTime: CACHE.adminRef.gcTime,
    placeholderData: keepPreviousData,
  })
}

export function useAdminDirectionsQuery(
  token: string,
  params: { page: number; q?: string; hidden_only?: boolean },
) {
  return useQuery({
    queryKey: queryKeys.adminDirections(params as Record<string, unknown>),
    queryFn: () => api.listDirections(token, params),
    enabled: !!token,
    staleTime: CACHE.adminRef.staleTime,
    gcTime: CACHE.adminRef.gcTime,
    placeholderData: keepPreviousData,
  })
}

export function useAdminUsersQuery(
  token: string,
  params: { page: number; q?: string },
) {
  return useQuery({
    queryKey: queryKeys.adminUsers(params as Record<string, unknown>),
    queryFn: () => api.listUsers(token, params),
    enabled: !!token,
    staleTime: CACHE.adminRef.staleTime,
    gcTime: CACHE.adminRef.gcTime,
    placeholderData: keepPreviousData,
  })
}

type InstructionsScope =
  | 'office'
  | 'wali'
  | 'chef'
  | 'office_chef'
  | 'wali_chef'
  | 'chef_authored'

export function useInstructionsListQuery(
  token: string,
  scope: InstructionsScope,
  params: { page: number; pageSize: number },
) {
  return useQuery({
    queryKey: queryKeys.instructions(scope, params as Record<string, unknown>),
    queryFn: () => {
      if (scope === 'wali') return api.listWaliInstructions(token, params)
      if (scope === 'chef') return api.listChefInstructions(token, params)
      if (scope === 'office_chef') return api.listOfficeChefInstructions(token, params)
      if (scope === 'wali_chef') return api.listWaliChefInstructions(token, params)
      if (scope === 'chef_authored') return api.listChefAuthoredInstructions(token, params)
      return api.listOfficeInstructions(token, params)
    },
    enabled: !!token,
    staleTime: CACHE.rapportsList.staleTime,
    gcTime: CACHE.rapportsList.gcTime,
    placeholderData: keepPreviousData,
  })
}

export function useBroadcastsListQuery(token: string, scope: 'wali' | 'office' | 'chef') {
  return useQuery({
    queryKey: queryKeys.broadcasts(scope),
    queryFn: () => {
      if (scope === 'wali') return api.listWaliBroadcasts(token)
      if (scope === 'chef') return api.listChefBroadcasts(token)
      return api.listOfficeBroadcasts(token)
    },
    enabled: !!token,
    staleTime: CACHE.rapportsList.staleTime,
    gcTime: CACHE.rapportsList.gcTime,
    select: (data) => data.broadcasts,
  })
}

export function useGuideVideosListQuery(
  token: string,
  listRole: GuideVideoListRole,
  params: { page: number; pageSize: number; audience: string },
) {
  return useQuery({
    queryKey: queryKeys.guideVideos(listRole, params as Record<string, unknown>),
    queryFn: () => api.listGuideVideos(token, listRole, params),
    enabled: !!token,
    staleTime: CACHE.adminRef.staleTime,
    gcTime: CACHE.adminRef.gcTime,
    placeholderData: keepPreviousData,
  })
}

export function useOfficeNotificationsListQuery(token: string) {
  return useQuery({
    queryKey: queryKeys.officeNotifications(),
    queryFn: async () => {
      const res = await api.listOfficeNotifications(token, false)
      return res.notifications.filter((n) => !isDedicatedNotificationKey(n.message_key))
    },
    enabled: !!token,
    staleTime: CACHE.hubCounts.staleTime,
    gcTime: CACHE.hubCounts.gcTime,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  })
}

