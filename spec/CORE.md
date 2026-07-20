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
| `ADMIN` | compte admin / حساب مدير | Users, communes, dairas, directions, domaines de suivi (services), rapport types, access profiles |
| `OFFICE_USER` | **ملحق بالديوان** / **Attaché de cabinet** | Create/edit/submit rapports in assigned domaines de suivi |
| `CHEF_CABINET` | رئيس الديوان / Chef de cabinet | First-line validation before Wali; same review tools as Wali (no instruction/broadcast create) |
| `WALI` | حساب الوالي / Compte wali | Read validated rapports, respond, request changes, create instructions |

**UI vocabulary (never show raw enums):** `OFFICE_USER` → ملحق بالديوان / Attaché de cabinet (plural: ملحقو الديوان / Attachés du cabinet). Domain tree nodes (`services` table): leaf UI = **مجال المتابعة** / **Domaine de suivi**; folder UI = **مجلد** / **Dossier**. Keep code/API names (`OFFICE_USER`, `/office/*`, `services`) unchanged.

- **Reference geography/org:** `dairas`, `municipalities` (FK `daira_id`), `directions` (flat) — **not login accounts**.
- **User**: `username`, `name`, `role`, optional `department_id`, access role template.

### Authentication & Access Control

- **Access JWT** required for protected endpoints (15m HS256, payload `{ sub, role, typ: "access" }`).
- **Refresh session** (opaque HttpOnly cookie, 7 days absolute) renews access without re-login — full rules in `spec/modules/AUTH.md`.
- **Blocked users** (`is_blocked = true`) rejected by `checkBlocked` middleware; block / password change / reset revoke refresh sessions.
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

### App / console logging (backend)

Readable operational logs via **pino** (`backend/src/logger.js`) + **pino-http** — not ad-hoc `console.log` in routes/services.

- **Levels:** `LOG_LEVEL` — day-to-day **`info`**; use **`debug`** only when digging into a bug. Production default `info`.
- **Access lines:** one short line per request, e.g. `GET /admin/users → 200` (skip `/health` and `/files/*`).
  - ≥500 → **error**; 4xx → **warn**; 2xx/3xx → **info**.
- **Errors:** central `errorHandler` — full stack only for **5xx**; 4xx log reason + `requestId` without dumping huge objects.
- **Secrets:** redact `authorization`, cookies, passwords.
- **SQL:** off by default; opt-in with `SEQUELIZE_LOGGING=true` (never leave on in production).
- **Correlation:** every response includes `x-request-id` / JSON `requestId` — match that id in logs when debugging a failed UI call.
- Prefer `req.log` / `getLogger()` for any new operational messages; do not log request bodies by default (PII / large rapport payloads).

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
| Wide table (view scroll) | `estimatedMinWidthPx > VIEW_SCROLL_BUDGET_PX` (~380px) | `TableScrollShell` adds horizontal scroll + `--table-min-width` |
| Landscape (PDF width) | `totalCols × 48pt > 515pt` | PDF uses landscape A4 for that table |
| Portrait inner width | 515pt | A4 portrait minus margins |
| Row height (PDF) | 16pt (schema tables), 18pt (HTML tables) | Used in height estimates |
| Export font size | 9 / 8 / 7pt | Scales down when `totalCols` > 9 / > 12 |

**Column widths (export):** weighted by column type (`text` > `commune_ref` > `number` > meta `#`). Meta columns use a fixed narrow weight. Same ratios drive PDF points and Word twips (`pdfColumnWidths`, `docxColumnWidthsTwip`).

**In-app view (content-aware min widths)**

- `TableGridView` wraps tables in `TableScrollShell`.
- Shell sets `dir="rtl"` for Arabic, `dir="ltr"` for French.
- `data-table-cols` and `data-table-orient` attributes reflect computed policy (debug/layout).
- Per-column min widths are estimated from header labels + sampled cell content (no DOM measure): char × locale glyph width, with type floors/caps.
  - **choice:** longest option label (or header) + pad; cap ~220px; `nowrap`.
  - **text:** floor for ~3–4 words/line (~14–18 AR / ~20–24 FR chars) + header; wrap allowed; cap ~280px.
  - **number / formula:** longest formatted sample + header; floor ~88px; `nowrap`.
  - **date:** readable floor (~112px) vs header.
  - **commune_ref:** header + longest sampled name; floor ~108px; cap ~180px.
  - **meta** (`#`, drag, wali, finished, delete): fixed CSS widths; policy uses meta px sum.
- Scroll when the **sum of mins** exceeds the view budget (mobile-first), not when column count alone is high — so preview / embedded / ≤6-col tables do not crush cells.
- Table uses `width: max(var(--table-min-width), 100%)` so short tables still fill the card; overflow scrolls when mins exceed the shell.

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

#### Bilingual content fields (frontend preference)

Paired storage (`name_ar`/`name_fr`, `label_ar`/`label_fr`, `title_ar`/`title_fr`, `rich_html_ar`/`rich_html_fr`, etc.) remains in API and DB. Create/edit validation for **names and labels** still requires **at least one** language (`hasBilingualText`).

**Display / export fallback** (frontend + backend): requested locale first, then the other language (`pickBilingualText` / export `?locale=`).

**Frontend flags** in `frontend/src/config/features.ts`:

| Flag | Default | Behavior |
| ---- | ------- | -------- |
| `ENABLE_FR_VALUE_INPUTS` | `false` | Hide French **content-value** inputs in forms across admin / office / wali / chef UIs. JSX for FR inputs stays in source (wrapped by the flag) so they can be re-enabled. Content editors that normally follow UI language bind to **Arabic** fields only. When `true`, show dual AR/FR value inputs as before. |
| `ENABLE_SERVICE_FOLDERS` | `false` | When `false`, admin **create service** UI hides folder vs leaf radio and parent-folder picker; creates always use `is_folder: false` and `parent_service_id: null`. When `true`, restore folder create UX. Tree navigation for any pre-existing folders remains; API still accepts `is_folder` (UI gate only). |
| `ENABLE_DOCUMENT_TEMPLATES` | `false` | See `SCHEMA_CONFIGURATION.md` / `RAPPORT_SERVICE_TYPES.md`. |
| `ENABLE_GUIDE_VIDEOS` | `true` | See `GUIDE_VIDEOS.md`. |

- **UI language toggle** (chrome AR/FR, RTL/LTR) is **independent** of this flag — keep the French UI option.
- When the flag is `false`, **do not** wipe or overwrite existing `*_fr` on save (leave loaded FR as-is / omit from patch). Do **not** auto-copy AR→FR on save; empty FR already falls back to AR at display/export time.
- Applies to dual-input forms (org names, services, schema/column labels, instructions, broadcasts, template names, etc.) and to locale-switched editors (rich HTML, calendar title/note, table title/subtitle).
- **Layout:** when FR inputs are hidden, dual-field grids must expand the remaining AR field to full row width (`schemaMetaGrid--arOnly`, `schemaColumnGrid--arOnly`, `schemaChoiceRow--arOnly`) — do not leave a half-empty column.
- **Hub layout**: role-specific launcher tiles after login.
- **BackButton** always last in action rows (`frontend/src/components/BackButton.tsx`).
  - Default: **history pop** (`navigate(-1)`) when in-app history exists; otherwise **`fallbackTo`** with `replace`.
  - Explicit `to` (structural parent / archive escape) uses **`replace: true` by default** — never push the parent under the current page (avoids list ↔ view bounce loops).
  - Pass `location.state.backTo` via `backNavigationState` for entry context; consume it as **fallback**, not as a push target.
  - Do not send Back to obsolete intermediate routes (e.g. `/kinds/:contentKind`); prefer service hub / list parents.
  - Must use the **same size class** as sibling controls in that row (default `btn btn-secondary` unless the whole row is intentionally `btn-sm`).

#### Button sizing & action rows

Shared classes live in `frontend/src/App.css` (`.btn`, `.btn-sm`, `.btn-lg` + color variants). Agents and UI work must keep heights and padding consistent.

- **One size per row:** Every control in the same action group (`.pageHeaderActions`, modal footers, filter/toggle bars, confirm dialogs) must use the **same** size class. Never mix `btn-sm`, default `.btn`, and `btn-lg` in one row.
- **Page primary actions = default `.btn`:** Save / submit / Back / edit-list links in page headers use default `.btn` (+ color variant only). Do not put `btn-sm` on a header Save (or similar) while neighbors stay default.
- **Size roles:**
  - `btn-sm` — dense secondary only (inline table/row actions, compact filter chips when the **whole** bar is `btn-sm`)
  - default `.btn` — standard page/modal actions
  - `btn-lg` — single standout CTA in a banner/empty state, **not** beside default header buttons
- **Equal metrics:** Within a size tier, buttons share the same vertical padding, `line-height`, `box-sizing`, and effective min-height. No one-off `padding` / `height` / `min-height` on individual buttons except via shared size classes.
- **Links as buttons:** `<Link className="btn …">` must use the same size class as sibling `<button>` / `BusyButton` / `BackButton` in that row.
- **Alignment:** Action rows keep `align-items: center`; icon-only and text buttons in one row must match the height of the shared size tier.
- **List/table action colors** (`.actionsCell` / card action rows — prefer filled variants, not all `btn-ghost`):
  - Edit / open-to-edit → `btn-primary`
  - Details / view-only → `btn-secondary`
  - Share / reset-password / respond / submit CTA → `btn-accent` (or keep existing export color classes)
  - Block / delete / remove → `btn-danger` (unblock → `btn-secondary`)
  - Dense list rows use `btn-sm` for the whole cell.

- **Async actions**: show loading and disable primary controls while pending (`BusyButton`, `PageLoading`, confirm-modal `loading`); snackbar on failure — no silent `.catch`. List/page fetch must show `PageLoading` before an empty “no results” state.
- **Media upload** (rich text / media blocks / guide videos / Wali shares): disable **media pick** controls while a file is in flight (rich-text formatting toolbar stays usable). States:
  - `mediaCompressing` — client-side image resize/WebP (or optional video prep when `ENABLE_CLIENT_VIDEO_TRANSCODE`).
  - `mediaUploading` — bytes transferring; show **byte-level percentage** (`mediaUploadProgress`, e.g. `45%`) via XHR progress — required for inline editor image/video inserts, not file-count only.
  - Controls re-enable after success, failure, or upload timeout/abort (failed uploads must not leave pick buttons disabled).
- **Client image compression:** all image upload entry points call `prepareFileForUpload` (max 1920px, WebP/JPEG ladder, 10 MB cap) before POST — attachments, rich-text inline images, Wali instruction/broadcast images.
- **Multi-file:** parallel upload queue (concurrency 3) for rich-text multi-select and instruction attachments.

#### Client data cache (TanStack Query)

List and hub-badge fetches use **TanStack Query** with **stale-while-revalidate** (`frontend/src/query/`).

- **In-memory only** — never persist query cache to `localStorage` or IndexedDB (government data; shared-device risk).
- **Clear on logout / session expiry / password change** — `queryClient.clear()` alongside token removal.
- **First visit** to a list: show `PageLoading` until the first fetch completes (no empty “no results” flash).
- **Return visit** (cached data exists): show the **last list immediately**; show a subtle **updating** indicator (`QueryListShell` / `ListRefreshIndicator`) while a background refetch runs — do **not** replace visible rows with a full-page spinner.
- **Refetch failure** with cached data: keep showing the cache; snackbar the error.
- **After mutations** (submit, respond, finish, mark read, etc.): call `invalidateAppQueries` for affected keys (rapports, hub counts, service trees) — do not rely on stale cache for status badges.
- **Per-data policies** (defaults in `queryClient.ts` / query hooks):
  - Hub badge counts: short stale window, refetch on window focus.
  - Rapport inbox lists: short stale window, `keepPreviousData` for pagination/filter changes.
  - Service trees / office-user navigation: longer stale window; background refresh on focus.
  - Calendar week view: keyed by week anchor; cache only visited weeks.
  - Admin reference lists (communes, dairas, directions): moderate stale window; invalidate on admin CRUD.
- **Out of scope:** file uploads, export preview blobs, rich-text editor loads — remain imperative (action-scoped, not navigation lists).
- **i18n:** new cache UX strings (e.g. updating indicator) — Arabic + French only.

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
