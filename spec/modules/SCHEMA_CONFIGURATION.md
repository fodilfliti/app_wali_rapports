## Module: Schema configuration (generic data model)

### Purpose

Admin defines **reusable table column schemas** and **rapport types** per service. Office users fill data against those schemas — **no separate module per domain** (Finance, Hydraulique, etc. are examples in seed data only).

### Data model

#### `rapport_table_schemas`

| Field | Description |
| ----- | ----------- |
| `id` | Primary key (BIGINT) |
| `slug` | Unique key (e.g. `consommation-credits`) |
| `name_ar`, `name_fr` | Display name |
| `columns_json` | Array of column defs (see below) |
| `layout_json` | Optional table presentation (see below) |
| `service_id` | Optional link to one service |
| `is_system` | Seed/demo schemas; admin cannot delete |
| `created_at` | Date created |

#### Column definition (`columns_json[]`)

| Field | Required | Notes |
| ----- | -------- | ----- |
| `key` | yes | Row field name |
| `type` | yes | `text` \| `number` \| `date` \| `choice` \| `commune_ref` \| `formula` |
| `label_ar`, `label_fr` | yes | Header labels |
| `format` | no | `currency` \| `percent` \| `integer` |
| `formula` | if type=formula | Expression using column keys |
| `merge_vertical_suggested` | no | Default merge column for new tables |

#### `layout_json` (optional)

| Field | Notes |
| ----- | ----- |
| `header_groups[]` | `{ label_ar, label_fr, column_keys[] }` — grouped column headers |
| `default_title_ar/fr` | Default table title when rapport is created |
| `default_subtitle_ar/fr` | Default subtitle |

#### Table data (`data_json.tables[]`)

| Field | Notes |
| ----- | ----- |
| `title_ar`, `title_fr` | Per-rapport title |
| `subtitle_ar`, `subtitle_fr` | Per-rapport subtitle |
| `merge_column_keys[]` | Column keys to vertically merge repeated values |
| `rows[]` | Row data |

#### `rapport_types` (per service)

| Field | Notes |
| ----- | ----- |
| `content_kind` | `table_grid` \| `document_compose` \| `fiche_lecture` \| `commune_list` |
| `versioning_mode` | `versioned` \| `standalone` |
| `schema_json` | For `table_grid`: `{ table_schema_slug, table_key }`. For documents: optional `default_blocks` |

**Fiche lecture rule:** every **leaf service** has exactly one rapport type with `content_kind = fiche_lecture`, slug `fiche_lecture`.

#### `rapport_document_templates` (office-managed)

Reusable **rich HTML starters** for `document_compose` and `fiche_lecture` on a service.

| Field | Notes |
| ----- | ----- |
| `id` | Primary key (BIGINT) |
| `service_id` | Owner service (required) |
| `rapport_type_id` | Legacy optional field — limit template to one rapport type |
| `rapport_type_ids` | JSONB array of numbers — limit template to multiple rapport types |
| `content_kind` | Optional — `document_compose` \| `fiche_lecture` when no type ids |
| `slug` | Unique key |
| `name_ar`, `name_fr` | List label |
| `is_default` | At most one default per scope (type → kind → service-wide) |
| `content_json` | `{ rich_html_ar, rich_html_fr, embedded_tables[] }` |
| `created_at`, `updated_at` | Timestamps |

**Create rapport:** `POST …/documents` body may include `template_id` or `skip_default: true` (blank document).

**Editor import:** `POST /office/rapports/:id/document/apply-template` with `{ template_id, mode: "replace" \| "append" }`.

### Admin API

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/admin/table-schemas` | List schemas (`?q=` search) |
| `POST` | `/admin/table-schemas` | Create schema |
| `PATCH` | `/admin/table-schemas/:id` | Update name/columns |
| `DELETE` | `/admin/table-schemas/:id` | Delete (non-system only) |
| `GET` | `/admin/services/:serviceId/rapport-types` | List types for service |
| `POST` | `/admin/services/:serviceId/rapport-types` | Add type (links schema for table_grid) |
| `PATCH` | `/admin/rapport-types/:id` | Update type |

### Office schema API (editors only, `manage` on service)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/office/services/:id/schemas` | Service schemas + system templates |
| `POST` | `/office/services/:id/schemas` | Create schema for service |
| `PATCH` | `/office/schemas/:id` | Update owned schema (not `is_system`) |
| `POST` | `/office/services/:id/schemas/duplicate` | Copy template into service |
| `GET` | `/office/services/:id/rapport-types` | List types |
| `POST` | `/office/services/:id/rapport-types` | Add type |

### Office document-template API (`manage` on service)

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/office/services/:serviceId/document-templates` | List templates (`?rapport_type_id`, `?content_kind`) |
| `GET` | `/office/services/:serviceId/document-templates/for-create` | Templates valid for new rapport (`?rapport_type_id` required) |
| `POST` | `/office/services/:serviceId/document-templates` | Create template |
| `PATCH` | `/office/document-templates/:id` | Update template |
| `DELETE` | `/office/document-templates/:id` | Delete template |
| `POST` | `/office/rapports/:id/document/apply-template` | Import into draft (`replace` \| `append`) |

Validation: `documentTemplateCreateSchema`, `documentTemplatePatchSchema`, `applyDocumentTemplateSchema` in `schemaConfig.js`.

### Office data flow

1. Admin creates schema → creates `rapport_type` on service with `table_schema_slug`.
2. Office opens service hub → **Tableaux** → grid loads schema columns; rows saved in `rapport_versions.data_json`.
3. Formulas recalculated on save server-side.
4. **Documents** / **Fiches lecture** use rich HTML JSON (`rich_html_*`, `embedded_tables`) with optional document templates on create/import.

### UI

- French content-value inputs (`name_fr`, column/choice/header `label_fr`, etc.) respect `ENABLE_FR_VALUE_INPUTS` — see `spec/CORE.md` § Bilingual content fields.
- Admin hub → **Schémas & types** → `/admin/schemas`
- Office editor → service hub → **Configuration** → `/office/services/:id/config` — **tabbed** UI (schemas | rapport types | document templates); one list visible at a time; document templates tab with bilingual editor, default flag, scope by type/kind
- Office service hub (`manage` access): direct shortcuts **create schema**, **create rapport type**, **create document template** → `/office/services/:id/config?new=schema|type|template` (auto-opens the matching create modal); full **Configuration** link remains for list/edit
- Office → service → hub tiles per content kind — **new document/fiche** opens template picker (default pre-selected, or blank)
- Document editor → **Importer un modèle** (replace or append)

### Audit

| Action | When |
| ------ | ---- |
| `TABLE_SCHEMA_CREATE` | POST schema |
| `TABLE_SCHEMA_UPDATE` | PATCH schema |
| `TABLE_SCHEMA_DELETE` | DELETE schema |
| `RAPPORT_TYPE_CREATE` | POST rapport type |
| `RAPPORT_TYPE_UPDATE` | PATCH rapport type |
| `DOCUMENT_TEMPLATE_CREATE` | POST document template |
| `DOCUMENT_TEMPLATE_UPDATE` | PATCH document template |
| `DOCUMENT_TEMPLATE_DELETE` | DELETE document template |

### Migrations

- `20260609_000005_*` — demo example seeds only
- `20260610_000006_fiche_lecture_all_services.js` — attach fiche to all leaf services
- `20260613_000009_table_layout_json.js` — `layout_json` column + demo header groups
- `20260617_000014_document_templates.js` — `rapport_document_templates`
