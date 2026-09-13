# Workflow validation tree

## Purpose

Model N-level validation (`create` → `validate` → `final_validate`) so Wilaya and future Direction trees share one shape. Types live in `@wali/access-policy` → `workflowTree.ts`.

## Types (shared)

| Type | Meaning |
| ---- | ------- |
| `WorkflowLevelKind` | `create` \| `validate` \| `final_validate` |
| `WorkflowLevel` | `id`, `kind`, optional `actorRole`, `labelKey` |
| `WorkflowTree` | `id` + ordered `levels[]` |

Exports:

- `WILAYA_DEFAULT_TREE` — creator family → Chef → Wali (live map of existing statuses)
- `DIRECTION_EXAMPLE_3_LEVEL` / `DIRECTION_EXAMPLE_2_LEVEL` — **scaffold only** (no Direction workflow rewrite in v1)

## Wilaya status ↔ level map

| Level id | Kind | Actor | Typical statuses / notes |
| -------- | ---- | ----- | ------------------------ |
| `office_create` | create | **Creator family** (`CREATOR_ROLES`) | draft / edit; submit |
| `chef_validate` | validate | `CHEF_CABINET` | `pending_chef`; Chef accept → Wali path |
| `wali_final` | final_validate | `WALI` | `submitted` / `under_review` / respond |

Create level is the **creator family** (ملحق بالديوان + رئيس الدائرة + رئيس البلدية + مدير المديرية), not `OFFICE_USER` alone. Shared helpers: `CREATOR_ROLES` / `isCreatorRole` in `@wali/access-policy`.

**Chef bypass (Wilaya):** after Wali demands changes (`changes_requested`), creator resubmit skips Chef (info notification only). Product detail: `CHEF_CABINET.md`, `RAPPORTS.md`.

### `chef_validate_by_role` (admin config)

Table / API: `workflow_role_settings` — one boolean `chef_validate` **per creator role** (default **true**).

| `chef_validate` | First submit (when `chef_gate = required`) |
| --------------- | ------------------------------------------ |
| `true` (default) | → `pending_chef` (Chef inbox; Wali not yet) |
| `false` | → `submitted` + notify Wali (skip Chef), same landing as today’s bypass first-submit semantics |

- Admin UI: `/admin/workflow-role-settings` (4 switches — UI labels only).
- API: `GET` / `PATCH` `/admin/workflow-role-settings`.
- Does **not** replace `chef_gate` on the rapport: Wali `changes_requested` still sets `chef_gate = bypass` for that rapport’s resubmit path.
- Status enum unchanged.

Config knobs (types / live):

- `chef_validate_by_role` / `workflow_role_settings.chef_validate` — per creator role
- `levelsCount`: 2 or 3+
- `skipValidateOnResubmit`: Wilaya true after Wali changes_requested; Direction trees may differ
- Future: org scope (`direction_id`, …)

## UI / BE gates

- Respond and related actions use shared ActionKey / `can*` (e.g. `rapport.respond`) with workflow context — **not** `reviewer === 'chef'` or raw role checks in pages.
- See `ACCESS_PROFILES.md` for ActionKeys and `assertCan`.

## Non-goals (this phase)

- New roles are **creators only** — not validators.
- No rewrite of the rapport status enum from scratch.
- Direction examples remain types + docs only (no Direction login workflow tree).

## Related

- `CHEF_CABINET.md`, `RAPPORTS.md`, `ACCESS_PROFILES.md`, `ORGANIZATION.md`
