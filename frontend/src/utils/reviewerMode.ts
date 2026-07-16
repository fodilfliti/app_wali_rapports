export type ReviewerMode = 'wali' | 'chef'

export function reviewerBase(mode: ReviewerMode) {
  return mode === 'chef' ? '/chef' : '/wali'
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

export function reviewerUserServicesPath(mode: ReviewerMode, userId: number) {
  return `${reviewerBase(mode)}/office-users/${userId}/services`
}

export function reviewerContentKindPath(
  mode: ReviewerMode,
  userId: number,
  serviceId: number,
  contentKind: string,
) {
  return `${reviewerBase(mode)}/office-users/${userId}/services/${serviceId}/kinds/${contentKind}`
}

export function reviewerRapportTypeListPath(
  mode: ReviewerMode,
  userId: number,
  serviceId: number,
  rapportTypeId: number,
) {
  return `${reviewerBase(mode)}/office-users/${userId}/services/${serviceId}/rapports/${rapportTypeId}`
}

export function reviewerRapportViewPath(mode: ReviewerMode, rapportId: number) {
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
