## Module: Organization — Communes & Users

### Purpose & constraints

- **Admin** manages **commune reference data** and **user accounts** (office, wali, admin).
- Communes are **not** login accounts — they appear as rows/keys inside rapport grids.
- Align municipality shape with app_wilaya: `code`, `name_ar`, `name_fr`.

### Roles & rules

- **ADMIN**: full CRUD on communes and users.
- **OFFICE_USER**, **WALI**: no access to organization module.

### Data model

#### `municipalities`

- `id`, `code` (unique, digits), `name_ar`, `name_fr`, `created_at`

#### `users`

- `id`, `username` (unique), `password_hash`, `name`, `role` (`ADMIN` | `OFFICE_USER` | `WALI`)
- `department_id` (FK, nullable), `job_title` (nullable string), `email` (nullable string), `email_hidden` (boolean, default false)
- `access_role_template_id` (nullable FK to role templates), `use_custom_permissions` (boolean, default false)
- `is_blocked`, `created_at`
- No `municipality_id` — communes are reference only

### Workflows

#### Communes

- List with search/pagination; create/edit modal.
- Used as lookup when office users fill rapport grids.

#### Users

- Admin creates accounts with role, initial password (8 digits), optional department and access template.
- Block/unblock, reset password; cannot block own account.

### API endpoints

#### Admin

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/admin/municipalities` | List: `page`, `pageSize`, `q` (code/names). Order: code ASC |
| `POST` | `/admin/municipalities` | Create commune |
| `PATCH` | `/admin/municipalities/:id` | Update commune |
| `GET` | `/admin/users` | List users: `page`, `pageSize`, `q`, optional `role` |
| `POST` | `/admin/users` | Create user |
| `PATCH` | `/admin/users/:id` | Update name, department |
| `POST` | `/admin/users/:id/block` | Toggle block |
| `POST` | `/admin/users/:id/reset-password` | New random 8-digit password |

**Client validation:** `frontend/src/validation/schemas/municipality.ts`, `user.ts`  
**Server validation:** `backend/src/validation/schemas/adminCrud.js`

### UI/UX

- Admin hub → **Communes** → `/municipalities`
- Admin hub → **Utilisateurs** → `/users`
- Create/edit modals with Zod validation; account type shown as compte admin / bureau / wali

### Audit events

| Action type | When |
| ----------- | ---- |
| `MUNICIPALITY_CREATE` | POST municipality |
| `MUNICIPALITY_UPDATE` | PATCH municipality |
| `USER_CREATE` | POST user |
| `USER_UPDATE` | PATCH user |
| `USER_BLOCK` | Block toggle |
| `USER_PASSWORD_RESET` | Reset password |

### Migration notes

- Commune import/sync from app_wilaya deferred to future prompt.
