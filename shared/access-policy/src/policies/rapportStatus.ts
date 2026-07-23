/** Rapport workflow status helpers — shared between UI and BE. */

export function canOfficeEditRapport(status: string): boolean {
  return status === 'draft' || status === 'changes_requested';
}

/** Office may recall a sent rapport to draft before Wali accept/view. */
export function canOfficeReturnToDraft(status: string): boolean {
  return (
    status === 'pending_chef' ||
    status === 'submitted' ||
    status === 'under_review'
  );
}

export function isAwaitingWaliResponse(status: string): boolean {
  return status === 'submitted' || status === 'under_review';
}

export function isAwaitingChefResponse(status: string): boolean {
  return status === 'pending_chef';
}

export function isAwaitingReviewerResponse(status: string): boolean {
  return isAwaitingChefResponse(status) || isAwaitingWaliResponse(status);
}

/** Reviewer (wali) may respond from inbox list. */
export function canReviewerRespondFromList(status: string | undefined): boolean {
  return isAwaitingWaliResponse(status ?? '');
}

/** Chef may respond when rapport awaits chef validation. */
export function canChefRespondFromList(status: string | undefined): boolean {
  return isAwaitingChefResponse(status ?? '');
}
