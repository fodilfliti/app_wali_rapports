import type { QueryClient, InvalidateQueryFilters } from '@tanstack/react-query'
import type { HubCountsRole, ReviewerRole } from './queryKeys'

import type { EntityIdParam } from '../api'

export type InvalidateOptions = {
  hubCounts?: HubCountsRole | HubCountsRole[] | true
  rapports?: boolean
  serviceTrees?: boolean
  officeUsers?: ReviewerRole | ReviewerRole[] | true
  serviceHub?: { scope: string; serviceId?: EntityIdParam }
  calendar?: ReviewerRole | ReviewerRole[] | true
  adminRef?: boolean
  instructions?: boolean
  broadcasts?: boolean
  guideVideos?: boolean
  officeNotifications?: boolean
}

/** Refetch inactive queries too — badge counts live on pages the user just left. */
const REFETCH_ALL: InvalidateQueryFilters = { refetchType: 'all' }

function hubRoles(opt: InvalidateOptions['hubCounts']): HubCountsRole[] {
  if (!opt) return []
  if (opt === true) return ['office', 'wali', 'chef']
  return Array.isArray(opt) ? opt : [opt]
}

function reviewerRoles(opt: ReviewerRole | ReviewerRole[] | true | undefined): ReviewerRole[] {
  if (!opt) return []
  if (opt === true) return ['wali', 'chef']
  return Array.isArray(opt) ? opt : [opt]
}

/** Targeted cache invalidation after mutations or push notifications. */
export async function invalidateAppQueries(
  client: QueryClient,
  opts: InvalidateOptions = {},
): Promise<void> {
  const tasks: Promise<unknown>[] = []

  for (const role of hubRoles(opts.hubCounts)) {
    tasks.push(client.invalidateQueries({ queryKey: ['hubCounts', role], ...REFETCH_ALL }))
  }

  if (opts.rapports) {
    tasks.push(client.invalidateQueries({ queryKey: ['rapports'], ...REFETCH_ALL }))
  }

  if (opts.serviceTrees) {
    tasks.push(client.invalidateQueries({ queryKey: ['office', 'serviceTree'], ...REFETCH_ALL }))
    tasks.push(client.invalidateQueries({ queryKey: ['reviewer'], ...REFETCH_ALL }))
    tasks.push(client.invalidateQueries({ queryKey: ['admin', 'services'], ...REFETCH_ALL }))
  }

  if (opts.officeUsers) {
    for (const role of reviewerRoles(opts.officeUsers)) {
      tasks.push(
        client.invalidateQueries({ queryKey: ['reviewer', role, 'officeUsers'], ...REFETCH_ALL }),
      )
    }
  }

  if (opts.serviceHub) {
    const { scope, serviceId } = opts.serviceHub
    if (serviceId != null) {
      tasks.push(
        client.invalidateQueries({
          queryKey: ['serviceHub', scope, serviceId],
          ...REFETCH_ALL,
        }),
      )
    } else {
      tasks.push(client.invalidateQueries({ queryKey: ['serviceHub', scope], ...REFETCH_ALL }))
    }
  }

  if (opts.calendar) {
    for (const role of reviewerRoles(opts.calendar)) {
      tasks.push(client.invalidateQueries({ queryKey: ['calendar', role], ...REFETCH_ALL }))
    }
  }

  if (opts.adminRef) {
    tasks.push(client.invalidateQueries({ queryKey: ['admin'], ...REFETCH_ALL }))
  }

  if (opts.instructions) {
    tasks.push(client.invalidateQueries({ queryKey: ['instructions'], ...REFETCH_ALL }))
  }

  if (opts.broadcasts) {
    tasks.push(client.invalidateQueries({ queryKey: ['broadcasts'], ...REFETCH_ALL }))
  }

  if (opts.guideVideos) {
    tasks.push(client.invalidateQueries({ queryKey: ['guideVideos'], ...REFETCH_ALL }))
  }

  if (opts.officeNotifications) {
    tasks.push(
      client.invalidateQueries({ queryKey: ['office', 'notifications'], ...REFETCH_ALL }),
    )
  }

  await Promise.all(tasks)
}

/**
 * Broad invalidation for mutations / push / legacy `notifyHubCountsRefresh()`.
 * Uses refetchType `all` so office-users / services / service-hub badge caches update
 * even while those pages are unmounted.
 */
export async function invalidateHotLists(client: QueryClient): Promise<void> {
  await Promise.all([
    invalidateAppQueries(client, {
      hubCounts: true,
      rapports: true,
      serviceTrees: true,
      officeUsers: true,
      instructions: true,
      broadcasts: true,
      officeNotifications: true,
      guideVideos: true,
      calendar: true,
      adminRef: true,
    }),
    client.invalidateQueries({ queryKey: ['serviceHub'], ...REFETCH_ALL }),
  ])
}
