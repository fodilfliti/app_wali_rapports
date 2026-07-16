## Module: Access profiles

### Purpose & constraints

- Fine-grained permissions per account without replacing login role (`ADMIN` / `OFFICE_USER` / `CHEF_CABINET` / `WALI`).
- Office users scoped by **rapport domain** keys (e.g. `rapports.investissement.manage`).
- **View-only** profiles expressible via `view` level.

### Roles & rules

| Layer | Meaning |
| ----- | ------- |
| **Account role** (`users.role`) | JWT scope and route prefix |
| **Access role template** | Permission matrix (`none` / `view` / `manage`) |

- Template `account_scope` must match user role: `admin`, `office`, `chef`, or `wali`.
- Users without template: legacy **full manage** on applicable keys (seed admin uses template).

### Permission keys (initial catalog)

- `hub.dashboard`
- `organization.municipalities.view|manage`
- `organization.dairas.view|manage`
- `organization.directions.view|manage`
- `organization.users.view|manage`
- `organization.access_roles.manage`
- `rapports.investissement.view|manage|export`
- `rapports.finance.view|manage|export`
- `rapports.hydraulique.view|manage|export`
- `rapports.inbox.view` (wali / chef)
- `rapports.inbox.respond` (wali / chef)
- `rapports.instructions.view` (office / chef / wali)
- `rapports.instructions.create` (wali only)

Scope mapping:
- `admin` scope → `ADMIN` only
- `office` scope → `OFFICE_USER` only
- `chef` scope → `CHEF_CABINET` only
- `wali` scope → `WALI` only
- `both` → any role

### Data model

Same tables as app_wilaya pattern: `departments`, `access_role_templates`, `access_role_template_permissions`, `user_permission_overrides`.

System templates (seeded):
- `ADMIN_FULL` — admin scope, all manage
- `OFFICE_STANDARD` — office scope, investissement manage + others view
- `WALI_STANDARD` — wali scope, inbox view + respond + instructions create
- `CHEF_STANDARD` — chef scope, inbox view + respond + instructions view (no create)

### API endpoints

- `GET /admin/access/permissions-catalog`
- `GET /admin/access/role-templates`
- Phase 1: read-only catalog; template CRUD deferred

### UI/UX

- Admin hub → **Accès** placeholder page listing catalog (phase 1).

### Audit events

- `ACCESS_ROLE_TEMPLATE_UPDATE` (future)
