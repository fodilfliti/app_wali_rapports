---
description: Shared route paths — never hardcode /office /wali /chef; rename via segments.ts only
alwaysApply: true
---

# Routes / URL paths

Canonical strategy: `PLATFORM_HARDENING_PLAN.md` § routes. Spec (when written): `spec/modules/ROUTES.md`.

## Source of truth

- Package: `shared/routes`
- Renameable URL segments: `shared/routes/src/segments.ts` **only**
- Builders: `paths.hub.*`, `paths.api.*` — use these everywhere (FE Router, `api.ts`, Express mounts, push/SW deep links)
- Legacy paths: `aliases.ts` only

## Stable hub keys (do not rename lightly)

`admin` | `office` | `chef` | `wali`

## Default English segments (after hardening)

| Key | Segment |
|-----|---------|
| admin | `admin` |
| office | `cabinet` |
| chef | `chief` |
| wali | `governor` |

## Hard rules

- Forbidden in pages / `api.ts` / `app.js` / push code: hardcoded `"/office"`, `"/wali"`, `"/chef"` (except inside `aliases.ts`).
- Path rename ≠ role rename: DB/JWT enums stay `OFFICE_USER`, `CHEF_CABINET`, `WALI`, `ADMIN`.
- After changing `segments.ts`, rebuild shared and keep legacy redirects until one release is stable.
