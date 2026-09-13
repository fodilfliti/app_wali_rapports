## Module: Access profiles

### Purpose & constraints

- Fine-grained permissions per account without replacing login role (`ADMIN` / `CREATOR_ROLES` / `CHEF_CABINET` / `WALI`).
- Creators scoped by **rapport domain** keys (e.g. `rapports.investissement.manage`).
- **View-only** profiles expressible via `view` level.
- Platform hardening: UI and BE share one policy package; pages never gate with `role === "WALI"` (etc.). Prefer `isCreatorRole` / `CREATOR_ROLES` over scattered `OFFICE_USER` checks.

### Three surfaces (platform hardening)

| Surface | Location | Use |
| ------- | -------- | --- |
| UI `can*` | `@wali/access-policy` + `AuthProvider` / `useAuth().can` | Hub tiles, buttons, sections — true/false only |
| BE `assertCan` | `backend/src/modules/access/assertCan.js` + shared | Server never trusts UI; same ActionKeys |
| API | `effective_permissions`, grants, resource flags (`accessLevel`, `can_comment`, …) | Runtime profiles; `/me` + list/detail payloads |

### Creator roles (shared)

In `@wali/access-policy` (`roles.ts`):

| Export | Meaning |
| ------ | ------- |
| `CREATOR_ROLES` | `OFFICE_USER`, `PRESIDENT_DAIRA`, `PRESIDENT_COMMUNE`, `DIRECTEUR_DIRECTION` |
| `isCreatorRole(role)` | True for any of the four |
| `CreatorKey` | URL segment: `office` \| `daira` \| `commune` \| `direction` |
| `hubKeyForRole` | All creators → hub key `office` (`/cabinet`) |

UI labels via `ROLE_LABEL_KEYS` / `CREATOR_HUB_LABEL_KEYS` — never raw enums in pages.

### Roles & layers

| Layer | Meaning |
| ----- | ------- |
| **Account role** (`users.role`) | JWT scope and which hub shell (`requireRole`) |
| **Access role template** | Permission matrix (`none` / `view` / `manage`) |
| **ActionKey bridge** | `ACTION_REQUIREMENTS` maps ActionKey → catalog key + min level + optional roles |

- Template `account_scope` must match user role family: `admin`, `office` (**all creators**), `chef`, or `wali`.
- **Default template on user create** — assign the matching system template; do not rely on legacy full-manage for new users.
- Users without template (legacy): full manage on applicable keys (seed admin uses template). Prefer always assigning a template.

### Backend handler pattern

Thin routes: **validate → `assertCan(user, action, resource)` → service**.

- `requireRole` = coarse hub shell only (who may enter `/cabinet`, `/chief`, …) — cabinet = `CREATOR_ROLES` (+ Admin).
- Business allow/deny lives in shared `can*` / `assertCan`, not `if (role)` trees in routers when a policy exists.
- After `attachUser`, `req.user` must carry the same permission map as `req.effectivePermissions` (`effectivePermissions` / `effective_permissions`) so `assertCan(req.user, …)` and `requirePermission` both work (e.g. Chef/Wali `rapport.respond`).

### Hub tiles

- Resolve visible tiles with `resolveHubTiles` / `canShowHubTile` (shared).
- Pages must not invent a second hub allowlist with `role ===`.
- **Wali / Chef:** four creator cards (`creators_office` | `creators_daira` | `creators_commune` | `creators_direction`) → `/governor/creators/{key}` and `/chief/creators/{key}` (ActionKeys `hub.wali.office_users` / `hub.chef.office_users`).
- **Admin:** includes `workflow_role_settings` → `/admin/workflow-role-settings`.
- All four creator login roles share the same **office** tile set (`/cabinet/...`).

### ActionKey inventory

Source of truth: `shared/access-policy/src/actions.ts`. Grouped:

**Hub (admin):** `hub.admin.municipalities` | `dairas` | `directions` | `users` | `rapports` | `services` | `schemas` | `guide`  
(`hub.admin.access` exists for API/policy / workflow-role settings; the **الوصول** hub tile stays hidden.)

**Hub (office / all creators):** `hub.office.services` | `rapports` | `discussion` | `notifications` | `shared` | `instructions` | `chef_instructions` | `guide`

**Hub (wali):** `hub.wali.office_users` (creator cards) | `inbox` | `discussion` | `calendar` | `shared` | `instructions` | `chef_instructions` | `guide`

**Hub (chef):** `hub.chef.office_users` (creator cards) | `inbox` | `delete_requested` | `discussion` | `calendar` | `instructions` | `chef_instructions` | `shared` | `guide`

**Rapport lifecycle:** `rapport.view` | `edit` | `submit` | `return_to_draft` | `start_new_version` | `show_version_archive` | `export_excel` | `show_wali_response_export` | `respond` | `comment` | `delete` | `finish` | `discussion.view`

**Organization:** `organization.municipalities.view|manage` | `organization.users.view|manage` | `organization.access_roles.manage`

**Inbox / instructions / broadcast:** `rapports.inbox.view|respond` | `rapports.instructions.view|create|delete` | `rapports.chef_instructions.view|create|delete` | `broadcast.create` (Wali + Chef)

Bridge table: `ACTION_REQUIREMENTS` in `shared/access-policy/src/permissions.ts` (role gate ± catalog key ± `minAccessLevel`). Creator ActionKeys use `roles: CREATOR_ROLES`. Evaluate via `canAction` / FE `can(action)`.

### Rapport kinds (required on rapport `can*`)

Discriminators — always pass into rapport-scoped policy:

| Field | Values |
| ----- | ------ |
| `content_kind` | `table_grid` \| `document_compose` \| `fiche_lecture` \| `commune_list` |
| `versioning_mode` | `versioned` \| `standalone` |
| `commune_content_kind` | when `commune_list` (e.g. table vs complex) |

Kind-aware helpers live in `shared/access-policy/src/policies/rapportByKind.ts` (not long `content_kind ===` trees in pages):

| Helper | Rule (summary) |
| ------ | ---------------- |
| `canStartNewVersion` | `versioned` + `acknowledged`; **never** `fiche_lecture` |
| `canShowVersionArchive` | `versioning_mode=versioned`; false for `fiche_lecture` |
| `canExportExcel` | `table_grid`, or `commune_list` in table mode |
| `canShowWaliResponseExportBlock` | `fiche_lecture` only |
| `canOfficeEditRapportKind` | manage `accessLevel` + editable status |

Product detail: `RAPPORTS.md`, `RAPPORT_SERVICE_TYPES.md`.

### Permission keys (catalog)

- `hub.dashboard`
- `organization.municipalities.view|manage`
- `organization.dairas.view|manage` / `organization.directions.view|manage` (admin UI; catalog may lag — prefer ActionKeys for new gates)
- `organization.users.view|manage`
- `organization.access_roles.manage`
- `rapports.investissement.view|manage|export`
- `rapports.finance.view|manage|export`
- `rapports.hydraulique.view|manage|export`
- `rapports.inbox.view` (wali / chef)
- `rapports.inbox.respond` (wali / chef)
- `rapports.instructions.view` (creators / chef / wali)
- `rapports.instructions.create` (wali only)
- `rapports.instructions.delete` (wali only; cascades notifications)
- `rapports.chef_instructions.view` (creators / chef / wali)
- `rapports.chef_instructions.create` (chef only)
- `rapports.chef_instructions.delete` (chef only; cascades notifications)

Scope mapping:

- `admin` → `ADMIN` only
- `office` → **any** `CREATOR_ROLES` (not `OFFICE_USER` alone)
- `chef` → `CHEF_CABINET` only
- `wali` → `WALI` only
- `both` → any role

### Data model

Tables: `departments`, `access_role_templates`, `access_role_template_permissions`, `user_permission_overrides`.

System templates (seeded):

- `ADMIN_FULL` — admin scope, all manage
- `OFFICE_STANDARD` — office scope, investissement manage + others view
- `DAIRA_STANDARD` / `COMMUNE_STANDARD` / `DIRECTION_STANDARD` — **`account_scope = office`**, clone of `OFFICE_STANDARD` permissions (one per org creator role)
- `WALI_STANDARD` — wali scope, inbox view + respond + instructions create
- `CHEF_STANDARD` — chef scope, inbox view + respond + Wali-instructions view (no create) + Chef-instructions create + broadcast create

### API endpoints

- `GET /admin/access/permissions-catalog`
- `GET /admin/access/role-templates`
- Template CRUD deferred (catalog read + assign template on user create is live)

### UI/UX

- Admin hub → **Accès** page listing catalog (tile may stay hidden; Chef-validate via `workflow_role_settings`).
- All other hubs: tiles and buttons via `can*` / resource flags only.

### Audit events

- `ACCESS_ROLE_TEMPLATE_UPDATE` (future)

### Related

- `.cursor/rules/access-policy.mdc`
- `spec/modules/WORKFLOW_TREE.md` (respond levels + `chef_validate_by_role`)
- Entity ids: `spec/modules/IDENTITY_UUID.md`
