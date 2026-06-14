## Master Technical Specification (Index): Wali Rapports

### Objective

Digital platform for **Wilaya governor's office** users to create, version, and submit **rapports / états** (tables and memos) to the **Wali**, replacing Excel/Word workflows. **Admin** manages users, communes (reference data), services, and access profiles.

### Canonical spec documents

- **Core (shared standards + app shell + export + validation)**: `spec/CORE.md`
- **System Architecture Context (directories + models + flows)**: `spec/ARCHITECTURE_CONTEXT.md`
- **Modules**:
  - **Organization (communes reference + user accounts)**: `spec/modules/ORGANIZATION.md`
  - **Access profiles (domain permissions)**: `spec/modules/ACCESS_PROFILES.md`
  - **Rapports (lifecycle, versioning, export)**: `spec/modules/RAPPORTS.md`
  - **Rapport service types & Wali navigation (4 kinds, formulas, notifications)**: `spec/modules/RAPPORT_SERVICE_TYPES.md`
  - **Investissement rapport slice (placeholder)**: `spec/modules/RAPPORT_INVESTISSEMENT.md`
  - **Schema configuration (admin schemas + rapport types)**: `spec/modules/SCHEMA_CONFIGURATION.md`
  - **Service sharing (view / editor per office user)**: `spec/modules/SERVICE_SHARING.md`
  - **Media, calendar events & Wali sharing (image/video, calendars, broadcast)**: `spec/modules/MEDIA_CALENDAR_WALI_SHARING.md`

### Cross-cutting updates (initial)

- **Three account types:** `ADMIN` (compte admin), `OFFICE_USER` (compte bureau), `WALI` (compte wali) — never show raw enums in UI.
- **Communes:** reference rows only (`municipalities` table); no commune login accounts.
- **Route prefixes:** `/admin/*`, `/office/*`, `/wali/*` + `POST /auth/login`.
- **Form validation:** mandatory Zod client + server on all create/edit flows — `spec/CORE.md`.
- **Distinct UI theme:** teal/gold tokens in `frontend/src/theme/tokens.css` (not app_wilaya green).
- **Rapport architecture (4 content kinds):** Wali navigates office user → service/sub-service tree; types table grid, document compose, fiche lecture, commune list — `spec/modules/RAPPORT_SERVICE_TYPES.md`.
- **Version archive + Wali notifications:** old versions for graphs/history; office notified on Wali note — `RAPPORT_SERVICE_TYPES.md`, `RAPPORTS.md`.

### Cross-cutting updates (2026-06)

- **Rich document editor:** TipTap HTML (`rich_html_ar` / `rich_html_fr`), sticky toolbar, physical LTR align buttons in RTL UI — `spec/CORE.md`.
- **Document templates:** per-service reusable starters for `document_compose` / `fiche_lecture` — `spec/modules/SCHEMA_CONFIGURATION.md`.
- **Export PDF/Word:** preview before download, title+date filenames, Arabic Tahoma + PDF RTL shaping, editor-only body for documents (no rapport title / service / calendar in file) — `spec/CORE.md`, `spec/modules/MEDIA_CALENDAR_WALI_SHARING.md`.
- **Office rapports list**: `/office/rapports` is a cross-service inbox only — **new documents are created from the service content hub**, not from this page.

### Cross-cutting updates (2026-06-09)

- **Excel Export**: Support for exporting table-based reports to Excel (.xlsx) with header grouping and cell merging preservation — `spec/modules/RAPPORTS.md`.
- **Commune Report Redesign**:
  - **Versioning**: Incremental updates that track changed communes between versions.
  - **Report Mode Choice**: Admin can choose between "Table" (bulk entry) or "Complex" (per-commune document) modes.
  - **Bulk Entry**: A single-view table editor for all communes in "Table" mode — `spec/modules/RAPPORT_SERVICE_TYPES.md`.
  - **Wali Insights**: Highlighting changed communes and allowing version comparison in the Wali inbox — `spec/modules/RAPPORT_SERVICE_TYPES.md`.

### Cross-cutting updates (2026-06-23)

- **Table row drag reorder** + sequential `#` line numbers (UI filter-aware; export uses stored order) — `spec/modules/RAPPORT_SERVICE_TYPES.md`, `spec/CORE.md`.
- **Hide rapport / hide rapport type** (soft-hide with restore; fiche type exempt) — `spec/modules/RAPPORT_SERVICE_TYPES.md`, `spec/modules/RAPPORTS.md`.
- **Export meta columns** (#, Wali, Terminé, Commune) in PDF, Word, Excel — `spec/CORE.md`.

### Cross-cutting updates (2026-06-07)

- **Unified table layout policy** (view scroll, PDF/Word column widths, page breaks, landscape threshold) — `spec/CORE.md` § Table layout policy.
- **PDF Arabic tables (RTL):** right-to-left column order, right-aligned cells, Tahoma with `liga`/`calt` (no `rtla`) — `spec/CORE.md`.
- **Word Arabic tables:** `FIXED` layout, weighted column widths, `visuallyRightToLeft` — `spec/CORE.md`.
- **PDF pagination fix:** no blank intermediate pages; tables that fit on the current portrait page stay there — `spec/CORE.md`.
- **Wali fiche export block:** bordered « رد الوالي » section after fiche body (PDF + Word) — `spec/CORE.md`, `spec/modules/RAPPORT_SERVICE_TYPES.md`.
- **Wali inbox UI:** status row colors, legend, « جديد » badge, service/type columns; **single inbox counter** in top bar (`WaliInboxBell`) — `spec/modules/RAPPORT_SERVICE_TYPES.md`.
- **Demo presentation seed:** `npm run db:seed-demo` — Hydraulique + Investissement with rich fiches, embedded tables, storage media — `spec/ARCHITECTURE_CONTEXT.md` § Demo data.

### What to do when adding a new feature

- Create `spec/modules/<NAME>.md` from `spec/modules/_TEMPLATE.md`.
- Link it under **Modules** in this index.
- Extend `spec/CORE.md` only for rules shared by 2+ modules.
