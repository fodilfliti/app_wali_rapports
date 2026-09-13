# Routes & URL hubs

## Purpose

Single source of truth for hub URL segments shared by frontend and backend: `shared/routes`.

## Hub keys vs segments

| Concept | Meaning |
| --- | --- |
| **Hub key** (stable) | `admin` \| `office` \| `chef` \| `wali` — code, JWT mapping, policy. Do not rename lightly. |
| **URL segment** (renameable) | First path segment — edit **only** `shared/routes/src/segments.ts` (`HUB_SEGMENTS`). |

Path rename ≠ role rename: JWT/DB enums stay `OFFICE_USER`, `PRESIDENT_DAIRA`, `PRESIDENT_COMMUNE`, `DIRECTEUR_DIRECTION`, `CHEF_CABINET`, `WALI`, `ADMIN`. All four **creator** roles map to hub key `office` (`CREATOR_ROLES` / `hubKeyFromRole`).

## Live English segments

| Hub key | Segment | UI home | API mount |
| --- | --- | --- | --- |
| admin | `admin` | `/admin` | `/api/admin` |
| office | `cabinet` | `/cabinet` | `/api/cabinet` |
| chef | `chief` | `/chief` | `/api/chief` |
| wali | `governor` | `/governor` | `/api/governor` |

Examples (builders, not literals in new code):

- Office / creator rapports list: `/cabinet/rapports`
- Chef inbox: `/chief/inbox`
- Wali inbox: `/governor/inbox`
- Office submit API: `POST /api/cabinet/rapports/:id/submit`
- Shared files: `/cabinet|chief|governor/shared` (same pool; Chef + Wali create)
- Wali instructions: `…/instructions` — Chef instructions (separate): `…/chef-instructions`

## Creators navigation (Wali / Chef)

Short `creatorKey` (not role enum): `office` \| `daira` \| `commune` \| `direction`.

| Surface | Canonical path |
| --- | --- |
| Creators list | `/governor/creators/:creatorKey` or `/chief/creators/:creatorKey` |
| Creator user | `/…/creators/:creatorKey/:userId` |
| Creator service tree | `/…/creators/:creatorKey/:userId/services/:serviceId` |

Builders: `paths.hub.creators.list|user|userService` in `shared/routes`.

| Legacy | Canonical (one release) |
| --- | --- |
| `/governor/office-users` (+ `/:userId…`) | `/governor/creators/office` (+ `/:userId…`) |
| `/chief/office-users` (+ `/:userId…`) | `/chief/creators/office` (+ `/:userId…`) |

**Not used as login hubs:** `/daira`, `/commune`, `/direction` — admin reference paths stay `/admin/dairas`, `/admin/municipalities`, `/admin/directions`.

## Liste (`commune_list`) path segment

Internal content kind remains `commune_list`. Public URL/API segment for the office liste hub and per-entity editors is **`entities`** (communes, dairas, and/or directions — not communes-only).

| Surface | Canonical path |
| --- | --- |
| Liste hub (UI) | `/cabinet/services/:serviceId/entities` |
| Bulk editor (UI) | `/cabinet/services/:serviceId/entities/bulk` |
| Entity editor (UI) | `/cabinet/services/:serviceId/entities/:entityKey` |
| Entity GET/clear (API) | `/api/cabinet/rapports/:id/entities/:entityKey` (+ `/clear`) |
| Entity PATCH body (API) | `PATCH /api/cabinet/rapports/:id/entity-data` |

Constants: `LISTE_PATH_SEGMENT` / `LEGACY_LISTE_PATH_SEGMENT` in `shared/routes`. Admin municipality CRUD paths stay `/admin/…` (those rows really are communes).

## Builders

Package: `@wali/routes` (`shared/routes`).

- `paths.hub.home(key)` / `paths.hub.path(key, ...parts)` — UI paths
- `paths.api.mount(key)` — Express mount under API base
- `hubKeyFromRole(role)` — map account role → hub key (creators → `office`)
- `paths.hub.creators.*` — Wali/Chef creators navigation
- `LISTE_PATH_SEGMENT` — liste UI/API path segment (`entities`)

**All new code** (FE Router, `api.ts`, Express mounts, push/SW deep links) must use these builders.

## Legacy aliases (one release)

| Legacy prefix | Hub key |
| --- | --- |
| `/office` | office → `cabinet` |
| `/chef` | chef → `chief` |
| `/wali` | wali → `governor` |

| Legacy liste segment | Canonical |
| --- | --- |
| `communes` (UI + API under office hub) | `entities` |
| `commune-data` (API) | `entity-data` |

Defined in `shared/routes/src/aliases.ts` (`LEGACY_HUB_ALIASES`, `LEGACY_PATH_PREFIXES`, `LEGACY_LISTE_PATH_SEGMENT`).

- FE: redirect legacy UI paths to English segments (incl. `office-users` → `creators/office`).
- BE: dual-mount API routers on English **and** legacy prefixes for one release.
- After one stable release: remove dual mounts / redirects.

## Forbidden

Hardcoded `"/office"`, `"/wali"`, `"/chef"` in pages, `api.ts`, `app.js`, or push code — **except** inside `aliases.ts`. Prefer `LISTE_PATH_SEGMENT` over hardcoded `"communes"` / `"entities"` in liste navigation. Prefer `paths.hub.creators.*` over hardcoded `"/office-users"` / `"/creators/"`.

## Related

- `.cursor/rules/routes.mdc`
- `SYSTEM_SPEC.md` (index)
- `ACCESS_PROFILES.md` (hub cards)
