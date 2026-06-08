### Service sharing (per office user)

Admin creates **services** and assigns each **office user** one level per service:

| Level | Code | Office user can |
| ----- | ---- | ----------------- |
| **Lecture** | `view` | Open service, read tables/documents/fiches |
| **Éditeur** | `manage` | Create, save, submit rapports; configure schemas/types for granted services |

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
| `GET` | `/admin/office-users` | Office users for picker |

#### Office enforcement

- Service tree filtered to granted services only
- Write APIs (`PATCH` table/document, `POST` submit/create) require `manage`
- UI hides save/submit/create when `accessLevel === 'view'`
- Service config page (`/office/services/:id/config`) visible only when `manage`

#### UI

- Admin hub → **Services** → `/admin/services`
