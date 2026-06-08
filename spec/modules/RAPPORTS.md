## Module: Rapports (core)



### Purpose & constraints



- Replace Excel/Word/paper workflows for Wilaya office → Wali reporting.

- **Four content kinds** and Wali navigation (office user → services → sub-services): see **`spec/modules/RAPPORT_SERVICE_TYPES.md`** (canonical detail).

- In-app editing and export to **Excel**, **Word**, **PDF** with **Excel/Word-familiar presentation** for the Wali.



### Roles & rules



| Role | Capabilities |

| ---- | ------------ |

| **OFFICE_USER** | Create/edit drafts, submit versions, export (domain-scoped); receive Wali notifications |

| **WALI** | Browse by office user → service tree; review; optional note or confirm-only |

| **ADMIN** | Configure services, sub-services, schemas, content kinds |



### Wali navigation (summary)



1. Wali → **liste comptes bureau** (one click per user).

2. User → **services / sous-services** (folder or leaf).

3. Leaf opens content per **`content_kind`**: `table_grid` | `document_compose` | `fiche_lecture` | `commune_list`.

4. Wali responds or marks viewed; office gets **notification**.



### Content kinds (summary)



| Kind | Description |

| ---- | ----------- |

| `table_grid` | Typed tables, formulas, row hide/show, highlights, version archive, graphs (future) |

| `document_compose` | List of rich documents (text/table/image blocks) → PDF/Word |

| `fiche_lecture` | Shared dated fiche; new file each time (all office users) |

| `commune_list` | Commune list → per-commune table/inputs; versioned or standalone |



Full rules: **`RAPPORT_SERVICE_TYPES.md`**.



### Data model



#### `departments`



Wilaya departments (Investissement, Finance, Hydraulique).



#### `services`



- `id`, `department_id`, `slug`, `name_ar`, `name_fr`, `is_folder`, `parent_service_id` (nullable), `sort_order`, `is_active`



#### `sub_services` (optional normalized folder; may merge into `services.parent_service_id`)



- See migration 004; Finance → Banque / Budget example in `RAPPORT_SERVICE_TYPES.md`.



#### `rapport_types`



- `id`, `service_id`, `slug`, `name_ar`, `name_fr`

- **`content_kind`**: `table_grid` | `document_compose` | `fiche_lecture` | `commune_list`

- `layout_kind` (legacy alias — prefer `content_kind`)

- `versioning_mode`: `versioned` | `standalone`

- `schema_json`: default table/document schema



#### `rapport_table_schemas` (template library)



- Reusable column definitions; import into type-2 documents or new type-1 tables.



#### `rapports`



- `id`, `service_id`, `rapport_type_id`, `title`, `reference_date`, `status`

- `current_version_id`, `created_by_user_id`, `owner_office_user_id` (for Wali browsing by user)

- `created_at`, `updated_at`



**Status:** `draft` | `submitted` | `under_review` | `changes_requested` | `acknowledged` | `archived`



#### `rapport_versions`



- Snapshot for versioned content; **`data_json`** holds tables/blocks/commune rows.

- **`version_number`**, **`submitted_at`**, archive for graphs.



#### `wali_responses`



- `decision`: `accepted` | `changes_requested` | `viewed`

- `body_text`, optional `scope` / `scope_id` (table, document, commune)



#### `notifications`



- Office user alerted when Wali comments; `read_at` nullable.



### Versioning rules



- **Versioned:** each send → new `rapport_versions` row; UI **Versions archivées** lists history (read-only).

- **Standalone:** new `rapport` row per file/subject/date (types 2, 3, some type 4).



### Workflows



1. Office edits → **brouillon**.

2. **Envoyer au wali** → submitted + version snapshot.

3. Wali opens → under_review; may **confirmer**, **demander modification**, or **lu sans commentaire**.

4. Office notified; if changes requested → edit → new version → resubmit.



### API endpoints



Phase 1 (implemented): list/create/submit/respond — see git routes `office.js`, `wali.js`.



Phase 2 (specified in `RAPPORT_SERVICE_TYPES.md`): Wali office-user tree, version archive, notifications, per-table submit.



### UI/UX



- Wali: office user list → service tree → content by kind; presentation like Excel/Word.

- Office: service tree, draft/save, version archive button, notification bell.

- See **`RAPPORT_SERVICE_TYPES.md`** § UI/UX — Wali presentation rules.



### Audit events



| Action type | When |

| ----------- | ---- |

| `RAPPORT_CREATE` | New rapport |

| `RAPPORT_UPDATE` | Draft save |

| `RAPPORT_SUBMIT` | Submit to wali |

| `RAPPORT_WALI_RESPONSE` | Wali respond |

| `RAPPORT_EXPORT` | Export |

| `NOTIFICATION_READ` | Office reads Wali note |



### Migration notes



- `20260607_*` — foundation.

- `20260608_000004_service_types_navigation.js` — content_kind, schemas, notifications, service tree fields.



### Related specs



- **`RAPPORT_SERVICE_TYPES.md`** — four types, formulas, visibility, composer, navigation API.

- **`RAPPORT_INVESTISSEMENT.md`** — first `table_grid` domain example.

- **`SCHEMA_CONFIGURATION.md`** — admin schema library, rapport types, generic save data flow.

