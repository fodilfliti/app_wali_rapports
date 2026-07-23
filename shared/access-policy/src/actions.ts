/**
 * Stable action identifiers for UI `can*` / BE `assertCan`.
 * Bridge to permission catalog keys via `ACTION_REQUIREMENTS` in permissions.ts.
 */
export type ActionKey =
  // —— Hub tiles (admin) ——
  | 'hub.admin.municipalities'
  | 'hub.admin.dairas'
  | 'hub.admin.directions'
  | 'hub.admin.users'
  | 'hub.admin.rapports'
  | 'hub.admin.services'
  | 'hub.admin.schemas'
  | 'hub.admin.guide'
  | 'hub.admin.access'
  // —— Hub tiles (office) ——
  | 'hub.office.services'
  | 'hub.office.rapports'
  | 'hub.office.discussion'
  | 'hub.office.notifications'
  | 'hub.office.shared'
  | 'hub.office.instructions'
  | 'hub.office.guide'
  // —— Hub tiles (wali) ——
  | 'hub.wali.office_users'
  | 'hub.wali.inbox'
  | 'hub.wali.discussion'
  | 'hub.wali.calendar'
  | 'hub.wali.shared'
  | 'hub.wali.instructions'
  | 'hub.wali.guide'
  // —— Hub tiles (chef) ——
  | 'hub.chef.office_users'
  | 'hub.chef.inbox'
  | 'hub.chef.delete_requested'
  | 'hub.chef.discussion'
  | 'hub.chef.calendar'
  | 'hub.chef.instructions'
  | 'hub.chef.shared'
  | 'hub.chef.guide'
  // —— Rapport lifecycle ——
  | 'rapport.view'
  | 'rapport.edit'
  | 'rapport.submit'
  | 'rapport.return_to_draft'
  | 'rapport.start_new_version'
  | 'rapport.show_version_archive'
  | 'rapport.export_excel'
  | 'rapport.show_wali_response_export'
  | 'rapport.respond'
  | 'rapport.comment'
  | 'rapport.delete'
  | 'rapport.finish'
  | 'rapport.discussion.view'
  // —— Organization (admin) ——
  | 'organization.municipalities.view'
  | 'organization.municipalities.manage'
  | 'organization.users.view'
  | 'organization.users.manage'
  | 'organization.access_roles.manage'
  // —— Inbox / instructions ——
  | 'rapports.inbox.view'
  | 'rapports.inbox.respond'
  | 'rapports.instructions.view'
  | 'rapports.instructions.create'
  | 'rapports.instructions.delete'
  // —— Broadcasts ——
  | 'broadcast.create';
