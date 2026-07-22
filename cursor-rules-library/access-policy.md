---
description: Central access-policy — UI can* + BE assertCan; never role=== in pages; respect content_kind
alwaysApply: true
---

# Access policy (AI-safe permissions)

Canonical strategy: `PLATFORM_HARDENING_PLAN.md`. Spec: `spec/modules/ACCESS_PROFILES.md` (expand when implementing).

## Three surfaces

1. **UI `can*`** — from `shared/access-policy` (hub tiles, buttons, sections)
2. **BE `assertCan` / `can*`** — same shared rules in services
3. **API** — `effective_permissions`, grants, resource flags (`accessLevel`, `can_comment`, …)

## Hard rules

- Pages/components: **no** `me.role === "WALI"` (etc.). Use `can*(...)` / flags only.
- Allowlist for role strings: shared policy modules, Auth mapping, admin user role picker.
- Before adding a button or endpoint gate: **extend shared ActionKey + `can*` first**, then call it.
- Do not invent a second permission catalog; bridge ActionKey → existing catalog keys + grants + status.

## Content kind / versioning (do not wipe)

Rapport rules are **per kind**. Always pass `content_kind` + `versioning_mode` (and `commune_content_kind` for liste) into rapport `can*`.

| Kind | Do not forget |
|------|----------------|
| `table_grid` | version archive / new version when `versioned`; Excel |
| `document_compose` | version UI only if `versioning_mode=versioned` |
| `fiche_lecture` | file/new-each-time; **no** table-style start-new-version; Wali export block only here |
| `commune_list` | bulk vs entity; Excel in table mode |

- Forbidden: status-only checks for version/export/delete-version when kind matters.
- Forbidden: copy table rules onto `fiche_lecture` or “all kinds”.
- When adding a rule for one kind: same `can*` returns explicit `false` for other kinds.
- Prefer `policies/rapportByKind.ts` over long `content_kind ===` trees in pages.

## Grep mindset

If you change permissions, confirm you did not remove another role’s or another kind’s branch.
