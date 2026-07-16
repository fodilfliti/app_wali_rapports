## Module: Rapports (core)



### Purpose & constraints



- Replace Excel/Word/paper workflows for Wilaya office → Wali reporting.

- **Four content kinds** and Wali navigation (office user → services → sub-services): see **`spec/modules/RAPPORT_SERVICE_TYPES.md`** (canonical detail).

- In-app editing and export to **Excel**, **Word**, **PDF** with **Excel/Word-familiar presentation** for the Wali.
- **Excel (.xlsx)**: Exported via `exceljs` on the backend. Preserves merged column headers, cell colors (where applicable), and row-level vertical merges. RTL support for Arabic locale. Available for `table_grid` and `commune_list` (in table mode).
- **Word (.docx)**: Exported via `docx` library; Arabic tables use `visuallyRightToLeft` + fixed weighted column widths — `spec/CORE.md`.
- **PDF (.pdf)**: Exported via **PDFKit** (`rapportPdfService.js`, `richHtmlExport.js`); Arabic tables use RTL column slots + Tahoma with `liga`/`calt` — `spec/CORE.md` § Table layout policy.

### Data Model Extension (2026-06-09)

#### `RapportVersion`
- `changed_commune_codes`: JSON array of municipality codes updated in this version.
- `commune_versions`: JSON object mapping municipality codes to their specific version IDs for incremental tracking.



### Roles & rules



| Role | Capabilities |

| ---- | ------------ |

| **OFFICE_USER** | Create/edit drafts, submit versions, **return to draft** after send (Éditeur / `manage` only), export (domain-scoped); receive Wali notifications |

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

| `commune_list` | **قائمة / Liste** — per-entity (commune / daira / direction) table/inputs; versioned or standalone |



Full rules: **`RAPPORT_SERVICE_TYPES.md`**.



### Data model



#### `departments`

- `id`, `name_ar`, `name_fr`, `sort_order`, `is_active`

#### `services`

- `id`, `department_id`, `slug`, `name_ar`, `name_fr`, `is_folder`, `parent_service_id` (nullable self-referential FK), `sort_order`, `is_active`
- **Sub-services & folder hierarchy:** stored directly in this table using `parent_service_id` and `is_folder`. There is no separate `sub_services` table.



#### `rapport_types`



- `id`, `service_id`, `slug`, `name_ar`, `name_fr`

- **`content_kind`**: `table_grid` | `document_compose` | `fiche_lecture` | `commune_list`

- `layout_kind` (legacy alias — prefer `content_kind`)

- `versioning_mode`: `versioned` | `standalone`

- `schema_json`: default table/document schema



#### `rapport_table_schemas` (template library)



- Reusable column definitions; import into type-2 documents or new type-1 tables.



#### `rapport_document_templates` (document starters)



- Per-**service** reusable content for `document_compose` and `fiche_lecture`.

- `id`, `service_id`, optional `rapport_type_id`, optional `content_kind`, `slug`, `name_ar`, `name_fr`, `is_default`, `content_json` (`rich_html_ar`, `rich_html_fr`, `embedded_tables`).

- **Default resolution on create:** type-specific default → content-kind default → service-wide default → `rapport_type.schema_json.default_blocks`.

- Managed in office **Configuration** (`/office/services/:id/config`); see **`SCHEMA_CONFIGURATION.md`**.



#### `rapports`



- `id`, `service_id`, `rapport_type_id`, `title`, `reference_date`, `status`

- `current_version_id`, `created_by_user_id`, `owner_office_user_id` (for Wali browsing by user)

- `created_at`, `updated_at`



**Status:** `draft` | `pending_chef` | `submitted` | `under_review` | `changes_requested` | `acknowledged` | `archived`



#### `rapport_versions`



- Snapshot for versioned content; **`data_json`** holds tables/blocks/commune rows.

- **`version_number`**, **`submitted_at`**, archive for graphs.



#### `wali_responses`

- `id`, `rapport_id` (FK), `rapport_version_id` (FK), `decision` (`accepted` | `changes_requested` | `viewed`), `follow_up_status` (`none` | `pending` | `completed`), `body_text`, `scope` (`whole_rapport` | `table` | `document` | `commune`), `scope_id` (nullable), `created_by_user_id` (FK), `created_at`

#### `notifications`

- `id`, `user_id` (FK), `rapport_id` (FK, nullable), `broadcast_id` (FK, nullable), `instruction_id` / `chef_response_id` / `comment_id` (nullable FKs), `wali_response_id` (FK, nullable), `message_key` (default `waliFeedback`), `read_at` (nullable), `created_at`

#### `rapport_comments`

- Discussion thread — see **`RAPPORT_DISCUSSION.md`**.

### Versioning rules



- **Versioned:** each send → new `rapport_versions` row; UI **Versions archivées** lists history (read-only).

- **Standalone:** new `rapport` row per file/subject/date (types 2, 3, some type 4).



### Workflows



1. Office edits → **brouillon**.

2. **Envoyer au wali** → `pending_chef` (chef gate required) or `submitted` + version snapshot (`submitted_at` on current version).

3. Wali opens → under_review; may **confirmer**, **demander modification**, or **lu sans commentaire**.

4. Office notified; if changes requested → edit → new version → resubmit.

5. **Office recall (return to draft)** — urgent correction after send, before Wali accept/view:

   - **Who:** `OFFICE_USER` with service **`manage`** (Éditeur) — same ACL as Envoyer.
   - **When:** status ∈ `pending_chef` | `submitted` | `under_review`.
   - **Blocked:** status `acknowledged`, or any `wali_responses` on the **current** version with `decision ∈ {accepted, viewed}`.
   - **Effect:** clear `submitted_at` on the **current** version (same `version_number` / `current_version_id` — **do not fork**); set `status = draft`. Rapport disappears from Chef/Wali inboxes until re-sent.
   - **UI:** confirm dialog (AR « تعديل بعد الإرسال » / FR « Modifier après envoi ») explaining return to brouillon and removal from Chef/Wali until re-send.
   - Distinct from Chef/Wali `changes_requested` reopen (which forks a new version for versioned types).



### API endpoints



Phase 1 (implemented): list/create/submit/respond — see git routes `office.js`, `wali.js`.



Phase 2 (specified in `RAPPORT_SERVICE_TYPES.md`): Wali office-user tree, version archive, notifications, per-table submit.

| Method | Path | Notes |
| ------ | ---- | ----- |
| `POST` | `/office/rapports/:id/return-to-draft` | Éditeur (`manage`); recall sent rapport to draft (see workflow §5). `409` if status not allowed or Wali already accepted/viewed current version |



### UI/UX



- Wali: office user list → service tree → content by kind; presentation like Excel/Word.

- Office: service tree, draft/save, version archive button, notification bell; **Modifier après envoi** on awaiting Chef/Wali banner (confirm → draft).

- **Office rapports list** (`/office/rapports`): cross-service status inbox — **no “new rapport” action**; create documents/fiches/tables from each **service content hub**. Discussion inbox: `?view=discussion` (New / All) — see **`RAPPORT_DISCUSSION.md`**.
- **Global rapport lists** (`/admin/rapports`, `/office/rapports`, `/wali/rapports`, `/chef/rapports`): optional title **search** query param (`search`) filters by rapport title (`iLike`); same search field in UI across roles.

- **Document/fiche editors:** export menu (preview + download), optional **import template** (replace or append); compact page header.

- **Table editors:** drag row reorder, sequential `#` column, total line count hint, hide/finish rapport with confirm.

- See **`RAPPORT_SERVICE_TYPES.md`** § UI/UX — Wali presentation rules.



### Audit events



| Action type | When |

| ----------- | ---- |

| `RAPPORT_CREATE` | New rapport |

| `RAPPORT_UPDATE` | Draft save |

| `RAPPORT_SUBMIT` | Submit to wali |

| `RAPPORT_RETURN_TO_DRAFT` | Office recalls sent rapport to draft (before Wali accept/view) |

| `RAPPORT_WALI_RESPONSE` | Wali respond |

| `RAPPORT_EXPORT` | Export (generic) |

| `RAPPORT_PDF_EXPORT` | PDF download / preview blob |

| `RAPPORT_DOCX_EXPORT` | Word download / preview blob |
| `RAPPORT_TYPE_HIDE` | Office hides rapport type from service hub |
| `RAPPORT_TYPE_RESTORE` | Office restores hidden rapport type |
| `RAPPORT_FINISH` | Office soft-hides individual rapport |
| `RAPPORT_RESTORE` | Office restores hidden rapport |

| `DOCUMENT_TEMPLATE_CREATE` | Document template created |

| `DOCUMENT_TEMPLATE_UPDATE` | Document template updated |

| `DOCUMENT_TEMPLATE_DELETE` | Document template deleted |

| `NOTIFICATION_READ` | Office reads Wali note |



### Migration notes



- `20260607_*` — foundation.

- `20260608_000004_service_types_navigation.js` — content_kind, schemas, notifications, service tree fields.

- `20260617_000014_document_templates.js` — `rapport_document_templates`.



### Related specs



- **`RAPPORT_SERVICE_TYPES.md`** — four types, formulas, visibility, composer, navigation API.

- **`RAPPORT_INVESTISSEMENT.md`** — first `table_grid` domain example.

- **`SCHEMA_CONFIGURATION.md`** — admin schema library, rapport types, generic save data flow.

