---
description: Clean React/Node architecture for this repo — AuthProvider, thin routes, no token prop-drill
alwaysApply: true
---

# Architecture habits

Canonical strategy: `PLATFORM_HARDENING_PLAN.md` § Phase 4.

## Frontend

- Use `AuthProvider` / `useAuth()`; do **not** prop-drill `token={token}` through routes/pages.
- API client reads access token from `frontend/src/auth/session.ts` (single place).
- Prefer splitting large gods: `App.tsx` routes table, `api.ts` by domain — gradual, no pointless big-bang moves.
- UI gates: `can*` / API flags only (see `access-policy` rule).

## Backend

- Thin route handlers: validate → `assertCan` → service. No business `if (role)` in routers when policy exists.
- One shared module for rapport **status visibility** sets (lists, hub counts, calendar) — do not duplicate status arrays.
- Keep backend **JS** runtime; import compiled `shared/*` packages.
- Errors: consistent `{ error, code? }` for 403/404; keep inbox **404** IDOR-hide semantics where already used.

## Files / security

- Do **not** put the access JWT in file download query strings.
- Prefer cookie-authenticated stream or short-lived signed download token.

## IDs (when UUID phase is active)

- Entity ids in API/UI/validators: UUID via `entityIdSchema`.
- Do not use `Number(rapportId)` / `z.number()` for entity ids (allowlist: `page`, `pageSize`, `sort_order`, `version_number`).
