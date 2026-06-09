## Core Specification: Wali Rapports

### Purpose

Cross-cutting standards for all modules. Modules must not redefine these rules unless explicitly extending them.

### Technical Stack (Baseline)

- **Backend**: Node.js (Express.js)
- **Database**: PostgreSQL (Sequelize ORM)
- **Frontend**: React (RTL-first, Vite + TypeScript)
- **UI Languages**: Arabic (default), French (optional toggle) — **no English UI**
- **File Storage**: Local storage under `FILE_STORAGE_ROOT`; serve via authenticated `GET /files/*`

### Actors & Roles

| Internal enum | UI label | Scope |
| ------------- | -------- | ----- |
| `ADMIN` | compte admin | Users, communes, services, rapport types, access profiles |
| `OFFICE_USER` | compte bureau | Create/edit/submit rapports in assigned domains |
| `WALI` | compte wali | Read submitted rapports, respond, request changes |

- **Communes (`municipalities`)**: reference rows (`code`, `name_ar`, `name_fr`) used inside rapport grids — **not login accounts**.
- **User**: `username`, `name`, `role`, optional `department_id`, access role template.

### Authentication & Access Control

- **JWT required** for protected endpoints (12h HS256, payload `{ sub, role }`).
- **Blocked users** (`is_blocked = true`) rejected by `checkBlocked` middleware.
- **Route prefixes** by role:
  - `/admin/*` → `ADMIN`
  - `/office/*` → `OFFICE_USER` or `ADMIN`
  - `/wali/*` → `WALI` or `ADMIN`
- **Granular permissions** via access role templates — `spec/modules/ACCESS_PROFILES.md`.
- UI must not expose internal role enum names.

### Audit Logging (Mandatory)

Write to `audit_logs` for: login, user lifecycle, rapport submit/respond, file exports.

Minimum shape: `actor_id`, `action_type`, `details` (JSON), `timestamp`.

### API Conventions

- **Pagination**: `page` (default 1), `pageSize` (default 20, max 100).
- **Search**: `q` on list endpoints unless module declares otherwise.
- **Validation errors** (HTTP 400):
  ```json
  { "error": "VALIDATION_ERROR", "fieldErrors": { "field": "i18nKey" }, "requestId": "..." }
  ```
- **Business errors**: stable i18n keys in `error` field.

### File Storage & Downloads

- Store under `storage/`; never public static middleware.
- `GET /files/*` with JWT (`Authorization: Bearer` or `?access_token=` for browser downloads).
- Generated exports (Excel, Word, PDF): prefer API blob download with Bearer; audit where applicable.
- **Excel export buttons**: shared green `btnExcel` class.

### Rich text editor (documents & fiches)

Used for `document_compose` and `fiche_lecture` (`RichDocumentEditor`, TipTap).

- **Storage:** `data_json.rich_html_ar`, `rich_html_fr`, optional `embedded_tables[]` (legacy `blocks[]` still supported for old data).
- **Toolbar:** sticky at top of editor scroll area (`position: sticky` on `.richTextToolbar`).
- **RTL alignment:** toolbar container uses `direction: ltr` so **left / center / right** buttons map to **physical** page sides in Arabic UI (not reversed by RTL flex).
- **Editor font:** Tahoma for RTL content in the editor surface.
- **Images:** uploaded via rapport uploads; embedded in HTML as `/files/uploads/...` URLs.

### Rapport export (PDF & Word)

Shared backend: `rapportExportData.js`, `rapportPdfService.js`, `rapportDocxService.js`, `richHtmlExport.js`.

#### Supported content kinds

| Kind | Export includes |
| ---- | ---------------- |
| `table_grid` | Table title/subtitle (from table meta), bordered grid, row media attachments |
| `document_compose`, `fiche_lecture` | Rich HTML body + embedded tables/images only |

**Not included in document/fiche exports:** rapport record title, service name, calendar events block (calendar remains Wali hub + in-app editor only).

#### API

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/office/rapports/:id/export.pdf` | `?locale=ar\|fr` |
| `GET` | `/office/rapports/:id/export.docx` | same |
| `GET` | `/wali/rapports/:id/export.pdf` | `?locale=…&showHidden=0\|1` (hidden table rows) |
| `GET` | `/wali/rapports/:id/export.docx` | same |

#### Filenames

- Pattern: `{sanitized title} - {YYYY-MM-DD}.pdf` or `.docx` (`reference_date`, else last update date).
- Response header: UTF-8 `Content-Disposition` (`filename*` for Arabic titles).

#### Preview (office / wali editors)

- **Exporter** dropdown: preview PDF (iframe) or preview Word (`docx-preview`), then download.
- Office editable pages: **save draft before preview** so export matches the editor (`onPreparePreview`).
- UI note: Word preview page count may differ from Microsoft Word — use PDF preview to verify pagination.

#### Typography & Arabic

- PDF Arabic: register **Tahoma** (fallback Arial/Trad Arabic); PDFKit `features: ['rtla']` per text call.
- Word Arabic: **Tahoma** font family; merge adjacent runs where possible for spacing.
- French: Calibri.

#### Layout rules

- Vertical margin ~14pt around exported tables and bordered HTML blocks (`exportLayout.js`).
- Embedded/export tables with **more than 3 data rows** start on a **portrait A4** page break.
- Images: embedded when file resolves; **videos**: placeholder line only (not embedded in PDF/Word).

#### Audit

- `RAPPORT_PDF_EXPORT`, `RAPPORT_DOCX_EXPORT` (also listed as `RAPPORT_EXPORT` in module docs where generic).

### Form Validation (Mandatory)

#### Client (React)

- Zod schemas under `frontend/src/validation/schemas/`; messages as i18n keys only.
- Use `useZodForm`; `FieldErrorText`, `FormErrorBlock`, snackbar on block/failure.

#### Server (Express)

- Mirror rules in `backend/src/validation/schemas/` using `backend/src/validation/errorKeys.js`.
- Apply `validateBody(schema)` on JSON writes; use `req.validatedBody`.

### UI/UX Global Rules

- **RTL-first**; French LTR toggle optional.
- **Theme**: `frontend/src/theme/tokens.css` — primary teal `#0d4f4f`, accent gold `#c9a227`, rounded cards.
- **Hub layout**: role-specific launcher tiles after login.
- **BackButton** always last in action rows (`frontend/src/components/BackButton.tsx`).
- **Async actions**: loading/disabled state; snackbar on failure — no silent `.catch`.

### App Shell & Navigation

#### Persistent header (authenticated)

- App title, language toggle, user menu (logout).
- Role-appropriate quick links.

#### Hubs by role

| Role | Sections |
| ---- | -------- |
| **Office** | Mes rapports → Services / domaines |
| **Wali** | Rapports reçus → Par service → Historique |
| **Admin** | Communes → Utilisateurs → Services & types → Accès |
