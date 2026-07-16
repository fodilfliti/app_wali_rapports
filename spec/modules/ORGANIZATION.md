## Module: Organization — Communes, Dairas, Directions (Modiriyat) & Users

### Purpose & constraints

- **Admin** manages **reference data** (dairas, communes, modiriyat / **Directions**) and **user accounts** (admin, office, chef cabinet, wali).
- Communes / dairas / modiriyat are **not** login accounts — they appear as rows/keys inside entity-list rapports (**قائمة**).
- Align municipality shape with app_wilaya: `code`, `name_ar`, `name_fr`, plus `daira_id`.
- **Service departments (القطاعات)** exist in DB/API but are **hidden in the admin UI** (no hub tile, create-service field, or `/admin/departments` page — that path redirects to services).

### Roles & rules

- **ADMIN**: full CRUD on dairas, communes, modiriyat, and users.
- **OFFICE_USER**, **WALI**, **CHEF_CABINET**: no access to organization module.

### Data model

#### `dairas`

- `id`, `code` (unique), `name_ar`, `name_fr`, `created_at`

#### `modiriyat` (UI: **المديريات** / **Directions**)

- `id`, `code` (unique), `name_ar`, `name_fr`, `created_at`
- Independent — no FK to daira or commune.
- **UI:** code column/field hidden; on create, `code` is auto-assigned as next numeric index (`max(numeric codes)+1`).

#### `municipalities`

- `id`, `code` (unique, digits), `name_ar`, `name_fr`, `daira_id` (FK → dairas, required), `created_at`

#### `users`

- `id`, `username` (unique), `password_hash`, `name`, `role` (`ADMIN` | `OFFICE_USER` | `CHEF_CABINET` | `WALI`)
- `department_id` (FK, nullable — not exposed in current admin UI), `job_title` (nullable string), `email` (nullable string), `email_hidden` (boolean, default false)
- `access_role_template_id` (nullable FK to role templates), `use_custom_permissions` (boolean, default false)
- `is_blocked`, `created_at`
- No `municipality_id` — communes are reference only

### Workflows

#### Dairas / Directions (Modiriyat) / Communes

- List with search/pagination; create/edit modal.
- Commune create/edit requires selecting a daira.
- Direction create: names only; code auto-generated server/client.
- Used as lookup when office users fill entity-list / table grids.

#### Users

- Admin creates accounts with role (including رئيس الديوان), initial password (8 digits), optional access template.
- Block/unblock, reset password; cannot block own account.

### API endpoints

#### Admin

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/admin/dairas` | List: `page`, `pageSize`, `q`. Order: code ASC |
| `POST` | `/admin/dairas` | Create daira |
| `PATCH` | `/admin/dairas/:id` | Update daira |
| `GET` | `/admin/modiriyat` | List modiriyat |
| `POST` | `/admin/modiriyat` | Create modiriya (`code` optional → auto index) |
| `PATCH` | `/admin/modiriyat/:id` | Update modiriya |
| `GET` | `/admin/municipalities` | List: `page`, `pageSize`, `q`, optional `daira_id` |
| `POST` | `/admin/municipalities` | Create commune (`daira_id` required) |
| `PATCH` | `/admin/municipalities/:id` | Update commune |
| `GET` | `/admin/users` | List users: `page`, `pageSize`, `q`, optional `role` |
| `POST` | `/admin/users` | Create user |
| `PATCH` | `/admin/users/:id` | Update name, department |
| `POST` | `/admin/users/:id/block` | Toggle block |
| `POST` | `/admin/users/:id/reset-password` | New random 8-digit password |

**Client validation:** `frontend/src/validation/schemas/forms.ts`  
**Server validation:** `backend/src/validation/schemas/adminCrud.js`

### UI/UX

- Admin hub → **الدوائر** / Daïras → `/dairas`
- Admin hub → **المديريات** / **Directions** → `/directions` (legacy `/modiriyat` redirects here)
- Admin hub → **البلديات** / Communes → `/municipalities` (daira selector on form)
- Admin hub → **Users** → `/users`
- Account type shown as compte admin / bureau / wali / **رئيس الديوان**

### Audit events

| Action type | When |
| ----------- | ---- |
| `DAIRA_CREATE` / `DAIRA_UPDATE` | Daira write |
| `MODIRIYA_CREATE` / `MODIRIYA_UPDATE` | Modiriya write |
| `MUNICIPALITY_CREATE` | POST municipality |
| `MUNICIPALITY_UPDATE` | PATCH municipality |
| `USER_CREATE` | POST user |
| `USER_UPDATE` | PATCH user |
| `USER_BLOCK` | Block toggle |
| `USER_PASSWORD_RESET` | Reset password |

### Migration notes

- Seed 20 Tlemcen dairas; link existing 53 municipalities via `daira_id`.
- Modiriyat start empty (admin fills).
