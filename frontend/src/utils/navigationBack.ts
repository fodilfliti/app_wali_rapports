export type BackNavigationState = {
  backTo?: string
}

/** Parent route passed via React Router location state. */
export function readBackTarget(
  location: { state?: unknown },
  fallback: string,
): string {
  const state = location.state as BackNavigationState | null | undefined
  if (state?.backTo && typeof state.backTo === 'string') return state.backTo
  return fallback
}

export function backNavigationState(backTo: string): BackNavigationState {
  return { backTo }
}

export function currentPath(location: { pathname: string; search?: string }) {
  return location.pathname + (location.search || '')
}
