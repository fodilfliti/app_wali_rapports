import type { EntityIdParam } from '../api'

export type HubCountsRole = 'office' | 'wali' | 'chef'
export type ReviewerRole = 'wali' | 'chef'

export const queryKeys = {
  hubCounts: (role: HubCountsRole) => ['hubCounts', role] as const,
  officeServiceTree: () => ['office', 'serviceTree'] as const,
  reviewerOfficeUsers: (role: ReviewerRole, creatorKey = 'office') =>
    ['reviewer', role, 'officeUsers', creatorKey] as const,
  reviewerUserServices: (role: ReviewerRole, userId: EntityIdParam, creatorKey = 'office') =>
    ['reviewer', role, 'userServices', creatorKey, userId] as const,
  rapports: (scope: string, params: Record<string, unknown>) =>
    ['rapports', scope, params] as const,
  calendarWeek: (role: ReviewerRole, week: string) => ['calendar', role, week] as const,
  serviceHub: (scope: string, serviceId: EntityIdParam, extra?: Record<string, unknown>) =>
    ['serviceHub', scope, serviceId, extra ?? {}] as const,
  adminServices: (params?: Record<string, unknown>) =>
    ['admin', 'services', params ?? {}] as const,
  adminOfficeUsers: (params?: Record<string, unknown>) =>
    ['admin', 'officeUsers', params ?? {}] as const,
  adminMunicipalities: (params: Record<string, unknown>) =>
    ['admin', 'municipalities', params] as const,
  adminDairas: (params: Record<string, unknown>) => ['admin', 'dairas', params] as const,
  adminDirections: (params: Record<string, unknown>) =>
    ['admin', 'directions', params] as const,
  adminUsers: (params: Record<string, unknown>) => ['admin', 'users', params] as const,
  adminSchemas: () => ['admin', 'schemas'] as const,
  instructions: (scope: string, params: Record<string, unknown>) =>
    ['instructions', scope, params] as const,
  broadcasts: (scope: string) => ['broadcasts', scope] as const,
  guideVideos: (listRole: string, params: Record<string, unknown>) =>
    ['guideVideos', listRole, params] as const,
  officeNotifications: () => ['office', 'notifications'] as const,
} as const
