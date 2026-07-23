import type { EntityIdParam } from '../api'

export type ReviewerMode = 'wali' | 'chef'

export function reviewerBase(mode: ReviewerMode) {
  return mode === 'chef' ? '/chief' : '/governor'
}

export function reviewerHubPath(mode: ReviewerMode) {
  return reviewerBase(mode)
}

export function reviewerInboxPath(mode: ReviewerMode) {
  return `${reviewerBase(mode)}/rapports`
}

export function reviewerOfficeUsersPath(mode: ReviewerMode) {
  return `${reviewerBase(mode)}/office-users`
}

export function reviewerUserServicesPath(mode: ReviewerMode, userId: EntityIdParam) {
  return `${reviewerBase(mode)}/office-users/${userId}/services`
}

export function reviewerContentKindPath(
  mode: ReviewerMode,
  userId: EntityIdParam,
  serviceId: EntityIdParam,
  contentKind: string,
) {
  return `${reviewerBase(mode)}/office-users/${userId}/services/${serviceId}/kinds/${contentKind}`
}

export function reviewerRapportTypeListPath(
  mode: ReviewerMode,
  userId: EntityIdParam,
  serviceId: EntityIdParam,
  rapportTypeId: EntityIdParam,
) {
  return `${reviewerBase(mode)}/office-users/${userId}/services/${serviceId}/rapports/${rapportTypeId}`
}

export function reviewerRapportViewPath(mode: ReviewerMode, rapportId: EntityIdParam) {
  return `${reviewerBase(mode)}/rapports/${rapportId}/view`
}

export function reviewerInstructionsPath(mode: ReviewerMode) {
  return `${reviewerBase(mode)}/instructions`
}

export function reviewerCalendarPath(mode: ReviewerMode) {
  return `${reviewerBase(mode)}/calendar`
}

export function chefCanRespondFromList(status?: string) {
  return status === 'pending_chef'
}
