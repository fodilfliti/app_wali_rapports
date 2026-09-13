import type { EntityIdParam } from '../api'
import { creatorsListPath, creatorsUserServicePath, creatorsUserPath } from '@wali/routes'

export type ReviewerMode = 'wali' | 'chef'

export type CreatorKeyParam = string

export function reviewerBase(mode: ReviewerMode) {
  return mode === 'chef' ? '/chief' : '/governor'
}

export function reviewerHubPath(mode: ReviewerMode) {
  return reviewerBase(mode)
}

export function reviewerInboxPath(mode: ReviewerMode) {
  return `${reviewerBase(mode)}/rapports`
}

export function reviewerOfficeUsersPath(mode: ReviewerMode, creatorKey: CreatorKeyParam = 'office') {
  return creatorsListPath(mode, creatorKey)
}

export function reviewerUserServicesPath(
  mode: ReviewerMode,
  userId: EntityIdParam,
  creatorKey: CreatorKeyParam = 'office',
) {
  return `${creatorsUserPath(mode, creatorKey, String(userId))}/services`
}

export function reviewerContentKindPath(
  mode: ReviewerMode,
  userId: EntityIdParam,
  serviceId: EntityIdParam,
  contentKind: string,
  creatorKey: CreatorKeyParam = 'office',
) {
  return `${reviewerUserServicesPath(mode, userId, creatorKey)}/${serviceId}/kinds/${contentKind}`
}

export function reviewerRapportTypeListPath(
  mode: ReviewerMode,
  userId: EntityIdParam,
  serviceId: EntityIdParam,
  rapportTypeId: EntityIdParam,
  creatorKey: CreatorKeyParam = 'office',
) {
  return `${reviewerUserServicesPath(mode, userId, creatorKey)}/${serviceId}/rapports/${rapportTypeId}`
}

export function reviewerUserServicePath(
  mode: ReviewerMode,
  userId: EntityIdParam,
  serviceId: EntityIdParam,
  creatorKey: CreatorKeyParam = 'office',
) {
  return creatorsUserServicePath(mode, creatorKey, String(userId), String(serviceId))
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
