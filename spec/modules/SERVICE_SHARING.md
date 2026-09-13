### Service sharing (per creator / مجال المتابعة)

Admin creates **services** (UI: **مجالات المتابعة** / **Domaines de suivi**) and assigns each **creator** one level per service (`view` | `manage`).

Office hub path segment: `/cabinet` (`ROUTES.md`). Grant `user_id` / `service_id` in API are public UUIDs (`IDENTITY_UUID.md`).

#### Org scope (`org_scope`)

Every service has an **org scope** (4 types). Display names (`name_ar` / `name_fr`) are **not** unique. Internal `slug` stays unique (auto-suffix for bulk copies).

| Scope | Code | Who receives grants | Unit FK on leaf |
| ----- | ---- | ------------------- | --------------- |
| **ديوان** | `diwan` | `OFFICE_USER` (ملحق بالديوان) | none |
| **دائرة** | `daira` | `PRESIDENT_DAIRA` | `daira_id` required |
| **بلدية** | `commune` | `PRESIDENT_COMMUNE` | `municipality_id` required |
| **مديرية** | `direction` | `DIRECTEUR_DIRECTION` | `direction_id` required |

- **Existing services** migrate to `org_scope = diwan` (no unit FK).
- **Diwan create:** one leaf (or folder) as today.
- **Daira / commune / direction create (leaves):** admin picks names + multi-select org units (or all) → server creates **one leaf per selected unit**, same display names, distinct auto-slugs, matching unit FK.
- **Folders:** same `org_scope` as create context; unit FKs stay null (grouping only). Parent folder must match child `org_scope` when set.
- Only the three org-head roles use **duplicated** unit-scoped services; diwan stays a single shared service per create.

| Level | Code | Grantee can |
| ----- | ---- | ----------------- |
| **Lecture** | `view` | Open domaine, read tables/documents/fiches |
| **Éditeur** | `manage` | Create, save, submit rapports; configure schemas/types for granted domaines |

#### Table `services` (org fields)

- `org_scope` (`diwan` | `daira` | `commune` | `direction`), NOT NULL, default `diwan`
- nullable `daira_id` / `municipality_id` / `direction_id` (CHECK: diwan ⇒ all null; daira ⇒ only `daira_id`; commune ⇒ only `municipality_id`; direction ⇒ only `direction_id`)

#### Table `user_service_grants`

- `user_id`, `service_id`, `access_level` (`view` | `manage`)
- Unique `(user_id, service_id)`
- Grants apply to **leaf services** (content nodes). Folders appear in the tree when a child is granted.
- User role must match service `org_scope` (server rejects mismatches with 400).
- For non-diwan leaves, user org unit must also match the service’s `daira_id` / `municipality_id` / `direction_id` (400 `grantOrgUnitMismatch`).

#### Admin API

| Method | Path | Description |
| ------ | ---- | ----------- |
| `POST` | `/admin/services` | Create service(s): `org_scope`; for non-diwan leaves `org_unit_ids` (or all units). Auto-adds `fiche_lecture` on each leaf. Bulk → audit `SERVICE_CREATE_BULK` |
| `GET` | `/admin/services` | List active services; optional `?org_scope=` and for leaves `?daira_id=` / `?municipality_id=` / `?direction_id=` (public UUIDs) |
| `PATCH` | `/admin/services/:id` | Update service (names / sort / active / department; not org_scope / unit FKs) |
| `GET` | `/admin/services/:id/grants` | List grants |
| `PUT` | `/admin/services/:id/grants` | Replace grants `{ grants: [{ user_id, access_level }] }` — users must match service scope **role and unit** |
| `GET` | `/admin/office-users` | Grant picker: require `org_scope` or `service_id`; returns matching creator role. With `service_id` (or unit query), **also filters to that daira/commune/direction only** (diwan = all ملحق بالديوان) |
| `POST` | `/admin/users` | Create user; for the three org-head roles optional `service_grants: [{ service_id, access_level }]` — each service must match user’s `org_scope` + unit FK |

#### Office enforcement

- Service tree filtered to granted services only
- `GET /cabinet/services` and `GET /cabinet/rapports` are also scoped to the caller’s grants (not the full org catalog)
- Write APIs (`PATCH` table/document, `POST` submit/create) require `manage`
- UI hides save/submit/create when `accessLevel === 'view'`
- Service config page (`/cabinet/services/:id/config`) visible only when `manage`

#### Visibility after grant

When several creators share the same leaf service:

- **Office hub (`/cabinet`):** all non-hidden rapports in granted services appear in hubs / lists (service-scoped, not owner-only).
- **Wali / Chef per-user navigation** (`office_user_id` = creator U → service → type): list and pending badges are **service-scoped** for U’s grants — every inbox-visible rapport in those services, not only rows where `owner_office_user_id` / `created_by_user_id` = U. The same rapport may appear under every co-grantee. Global Wali/Chef inboxes (no `office_user_id`) stay status-only and unduplicated.
- **Feedback notifications** (`wali*` / `chef*` decision keys): all active, non-blocked creators with a grant on that service (not only owner/creator). Preference filtering still applies.
- **Discussion** (`rapportComment`): existing recipients plus other creators with **`manage`** on the service (view-only grantees are not auto-added).

#### UI

- Admin hub → **مجالات المتابعة / Domaines de suivi** → `/admin/services`
- Create: scope select (ديوان / دائرة / بلدية / مديرية); for non-diwan leaves, multi-select units + تحديد الكل
- List: scope badge + unit name on leaves; filter by scope
- Share modal: only users of that service’s scope **and unit** (e.g. دائرة تلمسان → رؤساء دائرة تلمسان only; diwan → all ملحق بالديوان). Default level when enabling a user is **éditeur** (`manage`), not lecture.
- User create (3 org-head roles): after org unit chosen, list **only that unit’s** services; assign lecture / éditeur (default éditeur); ملحق بالديوان keeps share-only grants (no create-user grant UI)
- Leaf label: مجال متابعة / Domaine de suivi · Folder: مجلد / Dossier
- Role labels only — never raw enums
