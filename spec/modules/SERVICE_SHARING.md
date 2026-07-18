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
- Write APIs (`PATCH` table/document, `POST` submit/create) require `manage`
- UI hides save/submit/create when `accessLevel === 'view'`
- Service config page (`/office/services/:id/config`) visible only when `manage`

#### UI

- Admin hub → **مجالات المتابعة / Domaines de suivi** → `/admin/services`
- Leaf label: مجال متابعة / Domaine de suivi · Folder: مجلد / Dossier
- Role picker: ملحق بالديوان / Attaché de cabinet (not «bureau» / «مكتب»)
