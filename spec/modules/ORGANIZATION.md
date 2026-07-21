## Module: Organization — Communes, Dairas, Directions & Users

### Purpose & constraints

- **Admin** manages **reference data** (dairas, communes, **directions**) and **user accounts** (admin, office, chef cabinet, wali).
- Communes / dairas / directions are **not** login accounts — they appear as rows/keys inside entity-list rapports (**قائمة**).
- Align municipality shape with app_wilaya: `code`, `name_ar`, `name_fr`, plus `daira_id`.
- **Service departments (القطاعات)** exist in DB/API but are **hidden in the admin UI** (no hub tile, create-service field, or `/admin/departments` page — that path redirects to services).
- **No hard delete** for dairas / communes / directions — admin “delete” is **soft-hide** (`hidden_at`) so old rapport versions keep labels and stored data.

### Roles & rules

- **ADMIN**: create / edit / soft-hide / restore on dairas, communes, directions; full user management.
- **OFFICE_USER**, **WALI**, **CHEF_CABINET**: no access to organization module.

### Data model

#### `dairas`

- `id`, `code` (unique), `name_ar`, `name_fr`, `created_at`, `hidden_at` (nullable — soft-hide)

#### `directions` (UI: **المديريات** / **Directions**)

- `id`, `code` (unique), `name_ar`, `name_fr`, `created_at`, `hidden_at` (nullable — soft-hide)
- Independent — no FK to daira or commune.
- **UI:** code column/field hidden; on create, `code` is auto-assigned as next numeric index (`max(numeric codes)+1`).

#### `municipalities`

- `id`, `code` (unique, digits), `name_ar`, `name_fr`, `daira_id` (FK → dairas, required), `created_at`, `hidden_at` (nullable — soft-hide)

#### `users`

- `id`, `username` (unique), `password_hash`, `name`, `role` (`ADMIN` | `OFFICE_USER` | `CHEF_CABINET` | `WALI`)
- `department_id` (FK, nullable — not exposed in current admin UI), `job_title` (nullable string), `email` (nullable string), `email_hidden` (boolean, default false)
- `access_role_template_id` (nullable FK to role templates), `use_custom_permissions` (boolean, default false)
- `is_blocked`, `created_at`
- `is_super_admin` (boolean, default false) — set only via env bootstrap; never via admin create/patch UI
- `deleted_at` (nullable timestamptz) — soft-delete; row kept for FKs (rapports, discussion, etc.)
- No `municipality_id` — communes are reference only

#### Super-admin (مسؤول أعلى)

- Created/marked by env: prefer `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD` (optional `SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`); if unset, fall back to `DEV_ADMIN_*` — upsert `role=ADMIN`, `is_super_admin=true`.
- Regular admins **cannot** edit / block / reset-password the super-admin account.
- Only the super-admin may **soft-delete** users and **manage guide videos** (upload/edit/delete) — see `GUIDE_VIDEOS.md`.
- Soft-delete targets: `OFFICE_USER`, `CHEF_CABINET`, `WALI`, and other non-super `ADMIN`s. **Cannot** soft-delete self or another `is_super_admin`.
- Soft-delete does **not** remove the `users` row: sets `deleted_at` + `is_blocked`, revokes tokens, clears grants/overrides/personal notifications/push/prefs and instruction/broadcast recipient rows. Discussion comments and rapports stay; UI shows role label when author is deleted — `RAPPORT_DISCUSSION.md`.
- Login / refresh reject soft-deleted users (`deleted_at` set). Default user lists exclude soft-deleted rows.
- Expose `is_super_admin` on `GET /auth/me` and admin user list for UI gating only.

### Workflows

#### Dairas / Directions / Communes

- List with search/pagination; create/edit modal; **active / hidden** scope filter (like rapports).
- Admin hide (UI may say حذف / Supprimer): sets `hidden_at`; row stays in DB. Restore clears `hidden_at`.
- **Hide daira:** cascade-hide all its communes (confirm must mention cascade).
- **Restore daira:** restore the daira and all its communes that are currently hidden.
- Hide/restore commune or direction: independent.
- Commune create/edit requires selecting a daira (active dairas for create; edit may keep existing daira even if later hidden).
- Direction create: names only; code auto-generated server/client.
- Used as lookup when office users fill entity-list / table grids — **new** catalogs exclude hidden; **existing** rapport keys still resolve (see `RAPPORT_SERVICE_TYPES.md` § Type 4).

#### Users

- Admin creates accounts with role (including رئيس الديوان), initial password (8 digits, **CSPRNG** via `crypto.randomInt`), optional access template.
- Block/unblock, reset password; cannot block own account; cannot edit/block/reset a **super-admin** unless you are that same user (self still cannot block/reset self).
- **Soft-delete (super-admin only):** `DELETE /admin/users/:id` — see Super-admin section. Confirm dialog in UI.
- **Reset password (users list):** shown only for **other** users (never on the logged-in admin’s own row; never on super-admin when actor is not super). Must open a **confirm dialog** before calling `POST /admin/users/:id/reset-password` — never reset on a single click. Confirm copy should name the target user (username / display name). On confirm → new random 8-digit code + credentials PDF modal (same as create).
- **Self-service profile:** any logged-in user may update **own** `name` and `job_title` via `PATCH /auth/me` (see `AUTH.md`); username/role remain admin-managed.
- **Self-service code (الرمز):** any logged-in user changes **own** password via `POST /auth/change-password` — must enter **current code** then **new code** (see `AUTH.md`). UI: profile menu → تغيير الرمز / Changer le code. Admin must **not** use the users-list reset action for self.
- On **create** and **password reset**, the server generates an **8-digit code** and a **credentials PDF** (`credentialsPdfService.js`) returned as `credentials.pdf_url` (**ADMIN-only** via `/files` ACL).
- Prod bootstrap credential Excels: `backend/private/bootstrap/` (outside web storage root). If ever exposed under `storage/bootstrap/`, run `npm run security:rotate-bootstrap-passwords`.
- **Credentials PDF language:** **French only** (labels and body). Do **not** include Arabic (or English) bilingual lines in this generated file — it is a handout for the account holder, not a UI surface.

### API endpoints

#### Admin

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/admin/dairas` | List: `page`, `pageSize`, `q`, optional `hidden_only=1`. Default = active only. Order: code ASC |
| `POST` | `/admin/dairas` | Create daira |
| `PATCH` | `/admin/dairas/:id` | Update daira |
| `POST` | `/admin/dairas/:id/hide` | Soft-hide daira + cascade communes |
| `POST` | `/admin/dairas/:id/restore` | Restore daira + its hidden communes |
| `GET` | `/admin/directions` | List directions (`hidden_only` same as dairas) |
| `POST` | `/admin/directions` | Create direction (`code` optional → auto index) |
| `PATCH` | `/admin/directions/:id` | Update direction |
| `POST` | `/admin/directions/:id/hide` | Soft-hide direction |
| `POST` | `/admin/directions/:id/restore` | Restore direction |
| `GET` | `/admin/municipalities` | List: `page`, `pageSize`, `q`, optional `daira_id`, `hidden_only` |
| `POST` | `/admin/municipalities` | Create commune (`daira_id` required) |
| `PATCH` | `/admin/municipalities/:id` | Update commune |
| `POST` | `/admin/municipalities/:id/hide` | Soft-hide commune |
| `POST` | `/admin/municipalities/:id/restore` | Restore commune |
| `GET` | `/admin/users` | List users: `page`, `pageSize`, `q`, optional `role` (excludes soft-deleted) |
| `POST` | `/admin/users` | Create user |
| `PATCH` | `/admin/users/:id` | Update name, department (403 if target is super-admin and actor is not that user) |
| `POST` | `/admin/users/:id/block` | Toggle block (403 on super-admin target for other admins; cannot block self) |
| `POST` | `/admin/users/:id/reset-password` | New random 8-digit password (403 on super-admin for other admins) |
| `DELETE` | `/admin/users/:id` | Soft-delete (super-admin only; not self / not other super-admin) |

**Client validation:** `frontend/src/validation/schemas/forms.ts`  
**Server validation:** `backend/src/validation/schemas/adminCrud.js`

### UI/UX

- Daira / direction / municipality `name_fr` form fields and list columns respect `ENABLE_FR_VALUE_INPUTS` — see `spec/CORE.md` § Bilingual content fields.
- Admin hub → **الدوائر** / Daïras → `/dairas`
- Admin hub → **المديريات** / **Directions** → `/directions` (legacy `/modiriyat` redirects here)
- Admin hub → **البلديات** / Communes → `/municipalities` (daira selector on form)
- Admin hub → **Users** → `/users`
- Users list **إعادة الرمز / Réinitialiser**: hidden on own row; for others, confirm dialog before reset (see Users workflows).
- Account type shown as حساب مدير / **ملحق بالديوان** (Attaché de cabinet) / حساب والي / **رئيس الديوان** — never raw enums (`OFFICE_USER`, etc.)
- Org ref lists: active/hidden filter; row hide (confirm) / restore; no permanent delete.

### Audit events

| Action type | When |
| ----------- | ---- |
| `DAIRA_CREATE` / `DAIRA_UPDATE` | Daira write |
| `DAIRA_HIDE` / `DAIRA_RESTORE` | Soft-hide / restore daira (cascade communes) |
| `DIRECTION_CREATE` / `DIRECTION_UPDATE` | Direction write |
| `DIRECTION_HIDE` / `DIRECTION_RESTORE` | Soft-hide / restore direction |
| `MUNICIPALITY_CREATE` | POST municipality |
| `MUNICIPALITY_UPDATE` | PATCH municipality |
| `MUNICIPALITY_HIDE` / `MUNICIPALITY_RESTORE` | Soft-hide / restore commune |
| `USER_CREATE` | POST user |
| `USER_UPDATE` | PATCH user |
| `USER_BLOCK` | Block toggle |
| `USER_PASSWORD_RESET` | Reset password |
| `USER_SOFT_DELETE` | Super-admin soft-deletes a user |

### Migration notes

- Seed 20 Tlemcen dairas; link existing 53 municipalities via `daira_id`.
- Directions start empty (admin fills).
- Legacy table name `modiriyat` / kind `modiriya` renamed to `directions` / `direction` (see migration `rename_modiriyat_to_directions`).
- Soft-hide: `hidden_at` on `dairas`, `municipalities`, `directions`.
