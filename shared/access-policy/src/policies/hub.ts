import type { ActionKey } from '../actions';
import type { UserRole } from '../roles';

export type HubTileDef = {
  id: string;
  /** Route path (English hub segments via shared/routes). */
  to: string;
  actionKeys: ActionKey[];
};

export type ResolveHubTilesOpts = {
  guideVideos?: boolean;
  /** @deprecated access hub tile is hidden; kept for call-site compat */
  isSuperAdmin?: boolean;
};

const ADMIN_TILES: HubTileDef[] = [
  { id: 'municipalities', to: '/municipalities', actionKeys: ['hub.admin.municipalities'] },
  { id: 'dairas', to: '/dairas', actionKeys: ['hub.admin.dairas'] },
  { id: 'directions', to: '/directions', actionKeys: ['hub.admin.directions'] },
  { id: 'users', to: '/users', actionKeys: ['hub.admin.users'] },
  { id: 'rapports', to: '/admin/rapports', actionKeys: ['hub.admin.rapports'] },
  { id: 'services', to: '/admin/services', actionKeys: ['hub.admin.services'] },
  { id: 'schemas', to: '/admin/schemas', actionKeys: ['hub.admin.schemas'] },
];

const OFFICE_TILES: HubTileDef[] = [
  { id: 'services', to: '/cabinet/services', actionKeys: ['hub.office.services'] },
  { id: 'rapports', to: '/cabinet/rapports', actionKeys: ['hub.office.rapports'] },
  { id: 'discussion', to: '/cabinet/rapports?view=discussion', actionKeys: ['hub.office.discussion'] },
  { id: 'notifications', to: '/cabinet/notifications', actionKeys: ['hub.office.notifications'] },
  { id: 'shared', to: '/cabinet/shared', actionKeys: ['hub.office.shared'] },
  { id: 'instructions', to: '/cabinet/instructions', actionKeys: ['hub.office.instructions'] },
];

const WALI_TILES: HubTileDef[] = [
  { id: 'office_users', to: '/governor/office-users', actionKeys: ['hub.wali.office_users'] },
  { id: 'inbox', to: '/governor/rapports', actionKeys: ['hub.wali.inbox'] },
  { id: 'discussion', to: '/governor/rapports?view=discussion', actionKeys: ['hub.wali.discussion'] },
  { id: 'calendar', to: '/governor/calendar', actionKeys: ['hub.wali.calendar'] },
  { id: 'shared', to: '/governor/shared', actionKeys: ['hub.wali.shared'] },
  { id: 'instructions', to: '/governor/instructions', actionKeys: ['hub.wali.instructions'] },
];

const CHEF_TILES: HubTileDef[] = [
  { id: 'office_users', to: '/chief/office-users', actionKeys: ['hub.chef.office_users'] },
  { id: 'inbox', to: '/chief/rapports', actionKeys: ['hub.chef.inbox'] },
  {
    id: 'delete_requested',
    to: '/chief/rapports?status_group=delete_requested',
    actionKeys: ['hub.chef.delete_requested'],
  },
  { id: 'discussion', to: '/chief/rapports?view=discussion', actionKeys: ['hub.chef.discussion'] },
  { id: 'calendar', to: '/chief/calendar', actionKeys: ['hub.chef.calendar'] },
  { id: 'instructions', to: '/chief/instructions', actionKeys: ['hub.chef.instructions'] },
  { id: 'shared', to: '/chief/shared', actionKeys: ['hub.chef.shared'] },
];

function withGuideTile(
  tiles: HubTileDef[],
  hubPrefix: '/admin' | '/cabinet' | '/governor' | '/chief',
  actionKey: ActionKey,
): HubTileDef[] {
  return [...tiles, { id: 'guide', to: `${hubPrefix}/guide`, actionKeys: [actionKey] }];
}

/**
 * Resolve hub tiles for a role — matches HubPages.tsx tile sets.
 */
export function resolveHubTiles(role: UserRole, opts: ResolveHubTilesOpts = {}): HubTileDef[] {
  const { guideVideos = false } = opts;

  switch (role) {
    case 'ADMIN': {
      // Access profiles tile (`/admin/access`) intentionally hidden from hub.
      const tiles = [...ADMIN_TILES];
      return guideVideos ? withGuideTile(tiles, '/admin', 'hub.admin.guide') : tiles;
    }
    case 'OFFICE_USER':
      return guideVideos ? withGuideTile(OFFICE_TILES, '/cabinet', 'hub.office.guide') : [...OFFICE_TILES];
    case 'WALI':
      return guideVideos ? withGuideTile(WALI_TILES, '/governor', 'hub.wali.guide') : [...WALI_TILES];
    case 'CHEF_CABINET':
      return guideVideos ? withGuideTile(CHEF_TILES, '/chief', 'hub.chef.guide') : [...CHEF_TILES];
  }
}

/** Check whether a hub tile action is allowed (coarse — full check via canAction). */
export function canShowHubTile(role: UserRole, tile: HubTileDef): boolean {
  return tile.actionKeys.length > 0 && resolveHubTiles(role).some((t) => t.id === tile.id);
}
