/** Shared TanStack Query cache timings (ms). */
export const CACHE = {
  hubCounts: { staleTime: 30_000, gcTime: 5 * 60_000 },
  rapportsList: { staleTime: 30_000, gcTime: 10 * 60_000 },
  serviceTree: { staleTime: 2 * 60_000, gcTime: 30 * 60_000 },
  officeUsers: { staleTime: 60_000, gcTime: 15 * 60_000 },
  calendarWeek: { staleTime: 5 * 60_000, gcTime: 21 * 24 * 60 * 60_000 },
  adminRef: { staleTime: 5 * 60_000, gcTime: 30 * 60_000 },
  serviceHub: { staleTime: 60_000, gcTime: 10 * 60_000 },
  detail: { staleTime: 30_000, gcTime: 5 * 60_000 },
} as const
