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

- `WILAYA_DEFAULT_TREE` — Office → Chef → Wali (live map of existing statuses)
- `DIRECTION_EXAMPLE_3_LEVEL` / `DIRECTION_EXAMPLE_2_LEVEL` — **scaffold only** (no Direction login accounts yet)

## Wilaya status ↔ level map

| Level id | Kind | Actor | Typical statuses / notes |
| -------- | ---- | ----- | ------------------------ |
| `office_create` | create | `OFFICE_USER` | draft / edit; submit |
| `chef_validate` | validate | `CHEF_CABINET` | `pending_chef`; Chef accept → Wali path |
| `wali_final` | final_validate | `WALI` | `submitted` / `under_review` / respond |

**Chef bypass (Wilaya):** after Wali demands changes (`changes_requested`), office resubmit skips Chef (info notification only). Product detail: `CHEF_CABINET.md`, `RAPPORTS.md`.

Config knobs (types / future):

- `levelsCount`: 2 or 3+
- `skipValidateOnResubmit`: Wilaya true after Wali changes_requested; Direction trees may differ
- Future: org scope (`direction_id`, …)

## UI / BE gates

- Respond and related actions use shared ActionKey / `can*` (e.g. `rapport.respond`) with workflow context — **not** `reviewer === 'chef'` or raw role checks in pages.
- See `ACCESS_PROFILES.md` for ActionKeys and `assertCan`.

## Non-goals (this phase)

- No Direction / Daira / Commune **login** accounts.
- No rewrite of the rapport status enum from scratch.
- Direction examples remain types + docs only.

## Related

- `PLATFORM_HARDENING_PLAN.md` § Phase 6
- `CHEF_CABINET.md`, `RAPPORTS.md`, `ACCESS_PROFILES.md`
