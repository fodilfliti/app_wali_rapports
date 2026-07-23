# Platform hardening — smoke matrix (P7)

Run after migrations `000032` / `000033` and restart of `npm run dev`.
Log in with each role; mark pass/fail.

**P7 status (2026-07-23):** green via code/policy gates + live API evidence (UUID routes on `/cabinet` `/chief` `/governor`, signed `?dl=` path). Spot-check UI in browser still recommended once after deploy.

## Hubs & routes

| Check | ADMIN | OFFICE | CHEF | WALI |
|-------|-------|--------|------|------|
| Lands on hub (`/` / `/cabinet` / `/chief` / `/governor`) | pass | pass | pass | pass |
| Legacy `/office` redirects to `/cabinet` | — | pass | — | — |
| Hub tiles match role (no wrong tiles) | pass | pass | pass | pass |

## Rapports

| Check | OFFICE manage | OFFICE view | CHEF | WALI |
|-------|---------------|-------------|------|------|
| Create/edit draft | pass | blocked | — | — |
| Submit | pass | — | — | — |
| Start new version (table, not fiche) | pass | — | — | — |
| Fiche: no “start new version” | pass | — | — | — |
| Respond / inbox | — | — | pass | pass |
| Discussion comment | pass | — | pass | pass |

## Files & identity

| Check | Result |
|-------|--------|
| Image/file opens via signed `?dl=` (no access JWT in URL) | pass |
| Rapport URL / API `id` is UUID after migrate | pass |
| Re-login after migrate (JWT may use uuid `sub`) | pass (dual-read; internal `userId` may still be BIGINT until PK cutover) |

## Admin

| Check | Result |
|-------|--------|
| Create user assigns default access template | pass |
| Org CRUD still works | pass |

### Validator checks (P7)

| Check | Result |
|-------|--------|
| “Start new version” never for `fiche_lecture` | pass (`canStartNewVersion` UI+BE) |
| Version archive only when `versioning_mode=versioned` | pass (`canShowVersionArchive`) |
| Excel only where allowed (`table_grid` / `commune_list` table) | pass (UI menu + BE `canExportExcel`) |
| Wali response export block only `fiche_lecture` | pass (PDF/Word via `canShowWaliResponseExportBlock`) |

When all pass, tick P7 in `PLATFORM_HARDENING_PLAN.md`.
