# Identity — BIGINT → UUID

## Purpose

Replace sequential BIGINT primary keys with UUID v4 for domain entities (anti-enumeration on URLs) **without wiping data**.

## Process (expand → backfill → cutover → contract)

1. Add `uuid` column + parallel `*_uuid` FK columns beside BIGINT.
2. Backfill UUID v4 for every row; fill FK uuid columns via id maps.
3. Dual-read/dual-write until API/FE/JWT use UUID.
4. Cutover: API/FE expose public UUID; validators accept UUID (and legacy digit strings during transition).
5. After stable release: drop BIGINT PKs/FKs and tighten validators to UUID-only.

## Current state (2026-07)

- **Expand applied** (data preserved). **BIGINT PK drop deferred.**
- API responses expose `id` = public UUID via `publicId` / `withPublicId` (`backend/src/modules/access/idResolver.js`).
- Get-by-id dual-reads UUID **or** legacy BIGINT string via `findByPublicId`.
- JWT `sub` / authenticated user identity use the user’s public UUID where cut over.
- Internal DB rows may still use BIGINT PKs; public contract is UUID.

## Migrations

| Migration | Scope |
| --- | --- |
| `20260722_000032_uuid_expand_core` | Core: `users`, `rapports`, `rapport_versions`, `services`, `rapport_types`, `uploaded_files`, `notifications` |
| `20260722_000033_uuid_expand_fks` | Parallel `*_uuid` FK columns filled from id maps |
| `20260723_000034_uuid_expand_url_entities` | URL-facing: `wali_broadcasts`, `wali_instructions`, `guide_videos`, `departments`, `dairas`, `directions`, `municipalities`, `rapport_table_schemas`, `rapport_document_templates`, `rapport_comments` |

## Validators

- Shared: `entityIdSchema` in `@wali/access-policy` (`shared/access-policy/src/ids.ts`).
- **Today (transition):** dual — `z.string().uuid()` **or** `/^\d+$/` (legacy BIGINT string).
- **After BIGINT drop:** tighten to `z.string().uuid()` only.
- Numeric allowlist (still numbers): `page`, `pageSize`, `sort_order`, `version_number`.
- Forbidden after cutover: `Number(entityId)` / `z.number()` for entity ids.

## Still required

`assertCan` + 404 IDOR-hide — UUID opacity is **not** authorization.

## Agent rules

- Treat API/UI `:id` params and JSON `id` fields as **public UUID strings** (dual-read may still accept digits).
- Do not document BIGINT as the public API contract.
- FK arrays in payloads (e.g. template ↔ type ids) are UUID strings, not numbers.

## Related

- `PLATFORM_HARDENING_PLAN.md` § Phase 5
- `.cursor/rules/architecture.mdc` (IDs)
- `spec/modules/AUTH.md` (JWT `sub`)
