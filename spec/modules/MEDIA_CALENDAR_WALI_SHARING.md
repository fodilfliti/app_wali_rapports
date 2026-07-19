## Module: Media, calendar events, and Wali file sharing

### Purpose

Extend rapports with visual media (images/videos), calendar triggers for the Wali hub, rapport view tracking, and Wali-to-office file broadcasts with comments and read receipts.

### Media in rapports

#### Document blocks (`data_json.blocks[]`)

| Block type | Fields | Rules |
| ---------- | ------ | ----- |
| `media_row` | `items: { file_id: number }[]` | 1–2 items per row; rendered as grid (max 2 per line) |

#### Table attachments (`data_json.tables[].media_rows[]`)

Same shape as document `media_row`, appended after the table grid in preview and Wali view.

#### File storage

- Table `uploaded_files` — binary stored under `storage/uploads/{storage_key}`
- Served via authenticated `GET /files/uploads/{storage_key}`
- Kinds: `image`, `video`, `file` (from MIME)
- **New complex/fiche drafts:** the attachments block is shown while editable even before the first save. The first inline image/video insert or attachment upload **auto-creates** the draft rapport (title required). If the title is missing, show an error and do not insert.
- **Inline / attachment videos in UI:** shown as compact thumbnails (~¼ row width, up to 4 per line); click opens a modal player (drag/reorder does not open). Full playback is in the popup only — keeps mobile-portrait videos from dominating the rapport layout. Same behavior for **office**, **Chef**, and **Wali** live views and **version archive** pages.

#### Export (PDF & Word)

Canonical rules: **`spec/CORE.md`** § Rapport export.

| Endpoint | Role |
| -------- | ---- |
| `GET /office/rapports/:id/export.pdf?locale=ar\|fr` | Office PDF |
| `GET /office/rapports/:id/export.docx?locale=ar\|fr` | Office Word |
| `GET /wali/rapports/:id/export.pdf?locale=…&showHidden=0\|1` | Wali PDF |
| `GET /wali/rapports/:id/export.docx?locale=…&showHidden=0\|1` | Wali Word |

- **Filename:** `{rapport title} - {date}.pdf` / `.docx` (UTF-8 Content-Disposition).
- **Preview:** export menu opens full-size modal — PDF iframe or Word HTML preview (`docx-preview`); office saves draft first when editing.
- **Document/fiche body:** rich HTML + embedded tables/images only — **excludes** rapport title, service name, and **calendar events** (calendar stays in Wali hub + editor UI).
- **Table grid:** table title/subtitle, grid, table media attachments.
- PDF and DOCX include **images**; videos show a placeholder note (not embedded).
- Arabic: Tahoma; PDF tables use RTL column order + right-aligned cells (`liga`/`calt`, not `rtla`); tables follow **`spec/CORE.md` § Table layout policy** (margins, landscape when wide, no row-count page break).
- **Fiche lecture:** Wali response export block appended after body — `spec/CORE.md` § Wali response export block.
- Audit: `RAPPORT_PDF_EXPORT`, `RAPPORT_DOCX_EXPORT`

### Calendar events

Table `rapport_calendar_events`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | BIGINT | Primary key |
| `rapport_id` | BIGINT | FK to rapports |
| `event_date` | DATEONLY | Date shown on Wali calendar |
| `title_ar`, `title_fr` | STRING(200) | Short label |
| `note_ar`, `note_fr` | TEXT | Optional detail |
| `created_by_user_id` | BIGINT | FK to users |
| `created_at`, `updated_at` | DATE | Timestamps |

Office users manage events on draft/editable rapports. Events appear on the **Wali hub calendar** (`GET /wali/calendar`) and Chef calendar; they are **not** appended to PDF/Word export files. Help text in the calendar editor should reflect Wali calendar visibility only.

**Today / tomorrow reminders:** active Wali + Chef receive in-app + Web Push for events on today / tomorrow (`calendarToday` / `calendarTomorrow`), with optimistic once-per-day hub-counts scan and immediate fanout on save — see `DEVICE_NOTIFICATIONS.md`.

### Rapport views

Table `rapport_views`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | BIGINT | Primary key |
| `rapport_id` | BIGINT | FK to rapports |
| `user_id` | BIGINT | FK to users (Wali) |
| `viewed_at` | DATE | Timestamp |

Recorded when Wali opens a rapport. Exposed to Wali on rapport detail. Unique index on `(rapport_id, user_id)`.

### Wali broadcasts

Wali uploads a file and shares with all eligible recipients or selected users.

**Recipients:** non-blocked `OFFICE_USER` **and** `CHEF_CABINET`. The recipient picker (`GET /wali/office-users-for-share`) and “all users” create both include Chef. Chef cannot create broadcasts; they receive via `/chef/broadcasts` / UI `/chef/shared`.

Broadcast create `title_fr` / calendar editor bilingual fields respect `ENABLE_FR_VALUE_INPUTS` — see `spec/CORE.md` § Bilingual content fields.

#### `wali_broadcasts`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | BIGINT | Primary key |
| `uploaded_file_id` | BIGINT | FK to `uploaded_files` |
| `title_ar`, `title_fr` | STRING(200) | Title |
| `message_ar`, `message_fr` | TEXT | Description |
| `allow_comments` | BOOLEAN | Allow comments toggle |
| `created_by_user_id` | BIGINT | FK to users (Wali) |
| `created_at` | DATE | Timestamp |

#### `wali_broadcast_recipients`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | BIGINT | Primary key |
| `broadcast_id` | BIGINT | FK to `wali_broadcasts` |
| `user_id` | BIGINT | FK to users (recipient) |
| `read_at` | DATE | Timestamp (nullable) |
| `created_at` | DATE | Timestamp |

#### `wali_broadcast_comments`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | BIGINT | Primary key |
| `broadcast_id` | BIGINT | FK to `wali_broadcasts` |
| `user_id` | BIGINT | FK to users |
| `body_text` | TEXT | Comment body |
| `created_at` | DATE | Timestamp |

**Notifications wiring:** Sharing a broadcast creates notifications for recipients with `message_key = 'waliBroadcast'`, `broadcast_id` pointing to the broadcast record, and a `null` `rapport_id` (which is nullable in the database). Recipients who have not opened receive reminder notifications.

### API summary

| Method | Path | Role |
| ------ | ---- | ---- |
| POST | `/office/rapports/:id/uploads` | Office upload (multipart) |
| POST | `/wali/uploads` | Wali upload for broadcast |
| GET/PATCH | `/office/rapports/:id/calendar-events` | List / replace events |
| GET | `/wali/calendar` | Events in date range |
| GET | `/wali/rapports/:id/views` | Who viewed rapport |
| POST | `/wali/broadcasts` | Create broadcast |
| GET | `/wali/broadcasts` | Wali list + read stats |
| GET | `/office/broadcasts` | Office inbox |
| POST | `/office/broadcasts/:id/read` | Mark read |
| GET | `/chef/broadcasts` | Chef recipient inbox |
| GET | `/chef/broadcasts/:id` | Chef detail |
| POST | `/chef/broadcasts/:id/read` | Chef mark read |
| POST | `/*/broadcasts/:id/comments` | Add comment |
