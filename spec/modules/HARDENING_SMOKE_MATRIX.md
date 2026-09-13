# Platform hardening — smoke matrix (P7)

Run after migrations `000032` / `000033` / `000036` / `000037` and restart of `npm run dev`.
Log in with each role; mark pass/fail.

**P7 status (2026-07-23):** green via code/policy gates + live API evidence (UUID routes on `/cabinet` `/chief` `/governor`, signed `?dl=` path). Spot-check UI in browser still recommended once after deploy.

**Creator roles:** clone OFFICE rows for `PRESIDENT_DAIRA` / `PRESIDENT_COMMUNE` / `DIRECTEUR_DIRECTION` (same `/cabinet` hub).

## Hubs & routes

| Check | ADMIN | OFFICE | DAIRA | COMMUNE | DIRECTION | CHEF | WALI |
|-------|-------|--------|-------|---------|-----------|------|------|
| Lands on hub (`/` / `/cabinet` / `/chief` / `/governor`) | pass | pass | pass | pass | pass | pass | pass |
| Legacy `/office` redirects to `/cabinet` | — | pass | pass | pass | pass | — | — |
| Hub tiles match role (no wrong tiles) | pass | pass | pass | pass | pass | pass | pass |
| Wali/Chef 4 creator cards → `/…/creators/{office\|daira\|commune\|direction}` | — | — | — | — | — | pass | pass |
| Legacy `/office-users` → `creators/office` | — | — | — | — | — | pass | pass |

## Rapports

| Check | OFFICE manage | DAIRA manage | COMMUNE manage | DIRECTION manage | OFFICE view | CHEF | WALI |
|-------|---------------|--------------|----------------|------------------|-------------|------|------|
| Create/edit draft | pass | pass | pass | pass | blocked | — | — |
| Submit (Chef on → `pending_chef`) | pass | pass | pass | pass | — | — | — |
| Submit (Chef off for that role → `submitted`) | pass* | pass* | pass* | pass* | — | — | pass |
| Return to draft after send | pass | blocked† | blocked† | blocked† | — | — | — |
| Start new version (table, not fiche) | pass | pass | pass | pass | — | — | — |
| Fiche: no “start new version” | pass | —‡ | —‡ | —‡ | — | — | — |
| Hub hides قائمة + مذكرة استخلاصية | — | pass† | pass† | pass† | — | — | — |
| Respond / inbox | — | — | — | — | — | pass | pass |
| Discussion comment | pass | pass | pass | pass | — | pass | pass |

\*Toggle only the role under test; others stay Chef-on.  
†`ORG_HEAD_FEATURE_FLAGS` in `@wali/access-policy` (`blockReturnToDraft`, `hideCommuneList`, `hideFicheLecture`) — set `false` to restore.  
‡Fiche kind omitted for org heads while `hideFicheLecture` is on.

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
| Create org creators requires daira / commune / direction FK | pass |
| `workflow_role_settings` chef_validate defaults true | pass |
| Org CRUD still works | pass |
| Existing services migrate to `org_scope=diwan` | pass (after `000037`) |
| Bulk create daira/commune/direction × units → N leaves, same names, distinct slugs | pass |
| Share on daira/commune/direction leaf → only users of **that** unit | pass |
| Share picker default level = éditeur (`manage`) | pass |
| `PUT` grants with wrong role → 400 `grantRoleScopeMismatch` | pass |
| `PUT` grants with wrong unit → 400 `grantOrgUnitMismatch` | pass |

### Validator checks (P7)

| Check | Result |
|-------|--------|
| “Start new version” never for `fiche_lecture` | pass (`canStartNewVersion` UI+BE) |
| Version archive only when `versioning_mode=versioned` | pass (`canShowVersionArchive`) |
| Excel only where allowed (`table_grid` / `commune_list` table) | pass (UI menu + BE `canExportExcel`) |
| Wali response export block only `fiche_lecture` | pass (PDF/Word via `canShowWaliResponseExportBlock`) |

## Shared files & instructions

| Check | OFFICE | DAIRA | COMMUNE | DIRECTION | CHEF | WALI |
|-------|--------|-------|---------|-----------|------|------|
| Shared files hub; uploader label (والي / رئيس الديوان) | pass | pass | pass | pass | pass | pass |
| Chef create shared → creators + Wali notif | — | — | — | — | pass | pass (recipient) |
| Wali create shared → creators + Chef | pass | pass | pass | pass | pass | pass |
| Wali instructions: `all_*` role bulks + `recipient_ids` | pass | pass | pass | pass | pass (RO) | pass |
| Chef instructions: same recipient model / Wali RO | pass | pass | pass | pass | pass | pass |
| Separate hub tiles + unread counters | pass | pass | pass | pass | pass | pass |

When all pass, tick P7 in `PLATFORM_HARDENING_PLAN.md`.
