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
| `ADMIN` | compte admin | Users, communes, dairas, modiriyat, services, rapport types, access profiles |
| `OFFICE_USER` | compte bureau | Create/edit/submit rapports in assigned domains |
| `CHEF_CABINET` | رئيس الديوان | First-line validation before Wali; same review tools as Wali (no instruction/broadcast create) |
| `WALI` | compte wali | Read validated rapports, respond, request changes, create instructions |

- **Reference geography/org:** `dairas`, `municipalities` (FK `daira_id`), `modiriyat` (flat) — **not login accounts**.
- **User**: `username`, `name`, `role`, optional `department_id`, access role template.

### Authentication & Access Control

- **JWT required** for protected endpoints (12h HS256, payload `{ sub, role }`).
- **Blocked users** (`is_blocked = true`) rejected by `checkBlocked` middleware.
- **Route prefixes** by role:
  - `/admin/*` → `ADMIN`
  - `/office/*` → `OFFICE_USER` or `ADMIN`
  - `/chef/*` → `CHEF_CABINET` or `ADMIN`
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

- PDF Arabic: register **Tahoma** (fallback Arial/Trad Arabic).
- PDF Arabic text: **logical order** in storage; **right align** in tables and body text.
- PDFKit font features for Arabic: **`liga`**, **`calt`** only — **do not use `rtla`** (breaks letter joining into disconnected glyphs).
- Word Arabic: **Tahoma** font family; `bidirectional` / `rightToLeft` on runs; merge adjacent runs where possible for spacing.
- French: Calibri.

#### Table layout policy (view + export)

Canonical code (backend + frontend must stay aligned):

| Layer | Path |
| ----- | ---- |
| Backend policy | `backend/src/services/tableLayoutPolicy.js` |
| Frontend policy | `frontend/src/utils/tableLayoutPolicy.ts` |
| View wrapper | `frontend/src/components/TableScrollShell.tsx` |
| PDF tables | `backend/src/services/rapportPdfService.js` (`drawTable`) |
| PDF HTML/embedded tables | `backend/src/services/richHtmlExport.js` (`drawPdfHtmlTable`) |
| Word tables | `backend/src/services/rapportDocxService.js` |

**Shared thresholds**

| Rule | Value | Effect |
| ---- | ----- | ------ |
| Wide table (view scroll) | `totalCols > 6` | `TableScrollShell` adds horizontal scroll + `--table-min-width` |
| Landscape (PDF width) | `totalCols × 48pt > 515pt` | PDF uses landscape A4 for that table |
| Portrait inner width | 515pt | A4 portrait minus margins |
| Row height (PDF) | 16pt (schema tables), 18pt (HTML tables) | Used in height estimates |
| Export font size | 9 / 8 / 7pt | Scales down when `totalCols` > 9 / > 12 |

**Column widths:** weighted by column type (`text` > `commune_ref` > `number` > meta `#`). Meta columns use a fixed narrow weight. Same ratios drive PDF points and Word twips (`pdfColumnWidths`, `docxColumnWidthsTwip`).

**In-app view**

- `TableGridView` wraps tables in `TableScrollShell`.
- Shell sets `dir="rtl"` for Arabic, `dir="ltr"` for French.
- `data-table-cols` and `data-table-orient` attributes reflect computed policy (debug/layout).

**PDF pagination (`ensurePdfTablePage`)**

- **Default:** draw on the **current page** when the table fits vertically in portrait.
- **New landscape page:** only when column count requires landscape width.
- **New portrait page:** only when remaining vertical space is insufficient (continuation).
- **Removed:** automatic page break before tables based on row count alone (old « >3 rows » rule).
- **Removed:** double page break (blank portrait page followed by landscape).

**PDF Arabic table RTL**

- Column **order** is right-to-left for `locale=ar`: `#` column on the far right, schema columns flow leftward (`buildTableColumnSlots`).
- Group header rows with **colspan** use `tableColumnSpanRect` so merged cells align correctly in RTL.
- Cell text: headers **center**; data cells **right** for Arabic, **left** for French (`pdfCellAlign`).
- All table cell text goes through `pdfTextOpts(locale, …)` from `exportFonts.js`.

**Word Arabic tables**

- `TableLayoutType.FIXED` with weighted `columnWidths` (twips).
- `visuallyRightToLeft: true` when `locale=ar`.
- Header cells centered; data cells right (AR) / left (FR).

**Embedded tables in rich HTML**

- Same pagination and RTL slot rules as schema tables when rendered in PDF.
- Rich HTML export does **not** insert an extra portrait page break before embedded/schema tables when the current page has room.

#### Wali response export block (`fiche_lecture` only)

Shared: `backend/src/services/waliResponseExport.js`.

- Appended **after** the fiche document body in PDF and Word exports (not on `table_grid` / `document_compose` / `commune_list` exports).
- Bordered box with **8px rounded corners** (PDF); decision line + optional note text.
- Skips empty notes and placeholder `—`.
- Includes **2 ruled blank lines** below the decision for manual annotations (PDF + Word).
- Labels localized (ar/fr): section title « رد الوالي », decision variants including follow-up status.

#### Layout rules (general)

- Vertical margin ~14pt around exported tables and bordered HTML blocks (`exportLayout.js`).
- Images: embedded when file resolves; **videos**: placeholder line only (not embedded in PDF/Word).
- **Table meta columns** (PDF, Word, Excel): prepended before schema columns on all table exports:
  - **#** (sequential line number in export row order, 1-based).
  - **Commune list** exports also prepend **Commune** name column.
  - **Wali** and **Terminé** are **edit-mode only** (office table editor) — not shown in read-only view or exports.
  - Labels localized (`tableExportMeta.js`: ar/fr). Line numbers follow **stored row order** after drag reorder.

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
  - Default: **history pop** (`navigate(-1)`) when in-app history exists; otherwise **`fallbackTo`** with `replace`.
  - Explicit `to` (structural parent / archive escape) uses **`replace: true` by default** — never push the parent under the current page (avoids list ↔ view bounce loops).
  - Pass `location.state.backTo` via `backNavigationState` for entry context; consume it as **fallback**, not as a push target.
  - Do not send Back to obsolete intermediate routes (e.g. `/kinds/:contentKind`); prefer service hub / list parents.
- **Async actions**: show loading and disable primary controls while pending (`BusyButton`, `PageLoading`, confirm-modal `loading`); snackbar on failure — no silent `.catch`. List/page fetch must show `PageLoading` before an empty “no results” state.
- **Media upload** (rich text / media blocks): show `mediaUploading` and disable insert controls until the file is inserted.

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
