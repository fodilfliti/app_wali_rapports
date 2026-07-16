---
description: Follow SYSTEM_SPEC.md and keep spec/ in sync whenever code or structure changes
alwaysApply: true
---

# Wali Rapports — spec-first development

This project is **spec-driven**. Canonical docs live under `spec/`; `SYSTEM_SPEC.md` is the **index only**.

## Before coding

1. Read `SYSTEM_SPEC.md` to find the right doc(s).
2. Read `spec/CORE.md` for cross-cutting rules.
3. Read the relevant `spec/modules/<MODULE>.md`.

If behavior is unclear, **update the spec first**, then implement.

## Roles

- `ADMIN` → UI: **compte admin**
- `OFFICE_USER` → UI: **compte bureau**
- `WALI` → UI: **compte wali**

Never expose raw enum names in UI. Communes are **reference data only** (no commune login accounts).

## Implementation must match spec

- **Auth:** short-lived access JWT + refresh cookie (`spec/modules/AUTH.md`) + `checkBlocked`; blocked users rejected immediately.
- **Audit:** critical actions → `AuditLogs` with stable `action_type`.
- **API lists:** pagination (`page`, `pageSize`, max 100), stable sort order.
- **UI:** RTL-first; Arabic default, French optional — **no English** UI copy.
- **Actions row:** primary actions first; **`BackButton` last**; **same button size** within the row (never mix `btn-sm` / default / `btn-lg`) — `spec/CORE.md` § Button sizing.
- **Validation:** Zod client + server on all create/edit forms.

## Code layout

- Backend: `backend/src/modules/<area>/`, routes `backend/src/routes/`, models/migrations under `backend/src/db/`.
- Frontend: pages under `frontend/src/pages/`, shared UI in `frontend/src/components/`.
