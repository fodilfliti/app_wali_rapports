### Service sharing (per office user / ملحق بالديوان)

Admin creates **services** (UI: **مجالات المتابعة** / **Domaines de suivi**) and assigns each **attaché de cabinet** (`OFFICE_USER`) one level per service:

| Level | Code | Attaché can |
| ----- | ---- | ----------------- |
| **Lecture** | `view` | Open domaine, read tables/documents/fiches |
| **Éditeur** | `manage` | Create, save, submit rapports; configure schemas/types for granted domaines |

#### Table `user_service_grants`

- `user_id`, `service_id`, `access_level` (`view` | `manage`)
- Unique `(user_id, service_id)`
- Grants apply to **leaf services** (content nodes). Folders appear in the tree when a child is granted.

#### Admin API

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/admin/services` | Create service (auto-adds `fiche_lecture` on leaf) |
| `PATCH` | `/admin/services/:id` | Update service |
| `GET` | `/admin/services/:id/grants` | List grants |
| `PUT` | `/admin/services/:id/grants` | Replace grants `{ grants: [{ user_id, access_level }] }` |
| `GET` | `/admin/office-users` | Attachés (`OFFICE_USER`) for picker |

#### Office enforcement

- Service tree filtered to granted services only
- `GET /office/services` and `GET /office/rapports` are also scoped to the caller’s grants (not the full org catalog)
- Write APIs (`PATCH` table/document, `POST` submit/create) require `manage`
- UI hides save/submit/create when `accessLevel === 'view'`
- Service config page (`/office/services/:id/config`) visible only when `manage`

#### Visibility after grant

When several attachés share the same leaf service:

- **Office:** all non-hidden rapports in granted services appear in hubs / lists (service-scoped, not owner-only).
- **Wali / Chef per-user navigation** (`office_user_id` = attaché U → service → type): list and pending badges are **service-scoped** for U’s grants — every inbox-visible rapport in those services, not only rows where `owner_office_user_id` / `created_by_user_id` = U. The same rapport may appear under every co-grantee. Global Wali/Chef inboxes (no `office_user_id`) stay status-only and unduplicated.
- **Feedback notifications** (`wali*` / `chef*` decision keys): all active, non-blocked `OFFICE_USER`s with a grant on that service (not only owner/creator). Preference filtering still applies.
- **Discussion** (`rapportComment`): existing recipients plus other attachés with **`manage`** on the service (view-only grantees are not auto-added).

#### UI

- Admin hub → **مجالات المتابعة / Domaines de suivi** → `/admin/services`
- Leaf label: مجال متابعة / Domaine de suivi · Folder: مجلد / Dossier
- Role picker: ملحق بالديوان / Attaché de cabinet (not «bureau» / «مكتب»)
