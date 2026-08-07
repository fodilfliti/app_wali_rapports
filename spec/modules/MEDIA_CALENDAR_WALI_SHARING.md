## Module: Media, calendar events, and Wali file sharing

### Purpose

Extend rapports with visual media (images/videos), calendar triggers for the Wali hub, rapport view tracking, and Wali-to-office file broadcasts with comments and read receipts.

Hub paths: `/cabinet`, `/chief`, `/governor` (`ROUTES.md`). Public ids: UUID (`IDENTITY_UUID.md`). File media: signed `?dl=` (`AUTH.md`).

### Media in rapports

#### Document blocks (`data_json.blocks[]`)

| Block type | Fields | Rules |
| ---------- | ------ | ----- |
| `media_row` | `items: { file_id: string /* UUID */ }[]` | 1–2 items per row; rendered as grid (max 2 per line) |

#### Table attachments (`data_json.tables[].media_rows[]`)

Same shape as document `media_row`, appended after the table grid in preview and Wali view.

#### File storage

- Table `uploaded_files` — binary stored under `storage/uploads/{storage_key}`
- Served via authenticated `GET /files/uploads/{storage_key}`
- Kinds: `image`, `video`, `file` (from MIME)
- **New complex/fiche drafts:** the attachments block is shown while editable even before the first save. The first inline image/video insert or attachment upload **auto-creates** the draft rapport (title required). If the title is missing, show an error and do not insert.
- **Draft id for media must not wipe the editor:** assigning a persisted rapport id (create-on-upload) must **not** remount the page, re-run create-preview, or replace in-memory rich HTML / tables / media rows. Keep client editor state until an explicit save/load. Upload failure shows an error only — existing typed content stays.
- **`file_id` values:** public UUID strings everywhere (API, `media_rows`, HTML `data-file-id`). Backend normalize/save must **not** coerce with `Number(file_id)` (drops UUIDs).
- **Serve / open media:** signed `?dl=` (`SignedFileLink` / `useSignedFileUrl` / `usePreparedRichHtml`). API file payloads expose `url_path`; UI must not rely on a pre-signed `url` field alone.
- **Inline images in rich HTML (edit + view):** up to **3 per row** (~⅓ width); click → lightbox. Rules for TipTap signing / empty-mount: **`spec/CORE.md`** § Rich text editor.
- **Inline / attachment videos in UI:** shown as compact thumbnails (~¼ row width, up to 4 per line); click opens a modal player (drag/reorder does not open). Full playback is in the popup only — keeps mobile-portrait videos from dominating the rapport layout. Same behavior for **office**, **Chef**, and **Wali** live views and **version archive** pages.

#### Export (PDF & Word)

Canonical rules: **`spec/CORE.md`** § Rapport export.

| Endpoint | Role |
| -------- | ---- |
| `GET /cabinet/rapports/:id/export.pdf?locale=ar\|fr` | Office PDF |
| `GET /cabinet/rapports/:id/export.docx?locale=ar\|fr` | Office Word |
| `GET /governor/rapports/:id/export.pdf?locale=…&showHidden=0\|1` | Wali PDF |
| `GET /governor/rapports/:id/export.docx?locale=…&showHidden=0\|1` | Wali Word |

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
| `id` | UUID (public API id); internal BIGINT until drop |
| `rapport_id` | UUID (public) / internal FK |
| `event_date` | DATEONLY | Date shown on Wali calendar |
| `title_ar`, `title_fr` | STRING(200) | Short label |
| `note_ar`, `note_fr` | TEXT | Optional detail |
| `created_by_user_id` | UUID (public) / internal FK |
| `created_at`, `updated_at` | DATE | Timestamps |

Office users manage events on draft/editable rapports. Events appear on the **Wali hub calendar** (`GET /governor/calendar`) and Chef calendar; they are **not** appended to PDF/Word export files. Help text in the calendar editor should reflect Wali calendar visibility only.

**Today / tomorrow reminders:** active Wali + Chef receive in-app + Web Push for events on today / tomorrow (`calendarToday` / `calendarTomorrow`), with optimistic once-per-day hub-counts scan and immediate fanout on save — see `DEVICE_NOTIFICATIONS.md`.

### Rapport views

Table `rapport_views`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | UUID (public API id); internal BIGINT until drop |
| `rapport_id` | UUID (public) / internal FK |
| `user_id` | UUID (public) / internal FK (Wali) |
| `viewed_at` | DATE | Timestamp |

Recorded when Wali opens a rapport. Exposed to Wali on rapport detail. Unique index on `(rapport_id, user_id)`.

### Shared broadcasts (Wali + Chef)

Wali **or** Chef uploads a file into the **same** shared pool (`wali_broadcasts` table name kept) and shares with eligible recipients.

**Who can create:** `WALI` and `CHEF_CABINET` (`broadcast.create`). UI: `/governor/shared` and `/chief/shared` (create via `/…/shared/new`).

**Recipients (by creator):**

| Creator | Eligible recipients |
| ------- | ------------------- |
| Wali / Admin | non-blocked `OFFICE_USER` **and** `CHEF_CABINET` |
| Chef | non-blocked `OFFICE_USER` **and** `WALI` (exclude self) |

Pickers: `GET /governor/office-users-for-share` (Wali) and `GET /chief/office-users-for-share` (Chef). “All users” uses the same role set for that creator.

**Uploader display:** API serializes `created_by: { id, name, role }`. Cards and detail show UI labels **والي** / **رئيس الديوان** (never raw enums).

**Wali as recipient:** when Chef uploads, Wali is a recipient — hub `unread_shared_files` counts unread recipient rows; mark-read on open. Wali list still shows **all** broadcasts (creator + received).

Broadcast create `title_fr` / calendar editor bilingual fields respect `ENABLE_FR_VALUE_INPUTS` — see `spec/CORE.md` § Bilingual content fields.

#### `wali_broadcasts`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | UUID (public API id); internal BIGINT until drop |
| `uploaded_file_id` | UUID (public) / internal FK to `uploaded_files` |
| `title_ar`, `title_fr` | STRING(200) | Title |
| `message_ar`, `message_fr` | TEXT | Description |
| `allow_comments` | BOOLEAN | Allow comments toggle |
| `created_by_user_id` | UUID (public) / internal FK (Wali or Chef) |
| `created_at` | DATE | Timestamp |

#### `wali_broadcast_recipients`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | UUID (public API id); internal BIGINT until drop |
| `broadcast_id` | UUID (public) / internal FK to `wali_broadcasts` |
| `user_id` | UUID (public) / internal FK (recipient) |
| `read_at` | DATE | Timestamp (nullable) |
| `created_at` | DATE | Timestamp |

#### `wali_broadcast_comments`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | UUID (public API id); internal BIGINT until drop |
| `broadcast_id` | UUID (public) / internal FK to `wali_broadcasts` |
| `user_id` | UUID (public) / internal FK |
| `body_text` | TEXT | Comment body |
| `created_at` | DATE | Timestamp |

**Notifications wiring:** Sharing a broadcast creates notifications for recipients with `message_key = 'waliBroadcast'`, `broadcast_id` pointing to the broadcast record, and a `null` `rapport_id` (which is nullable in the database). Copy is **role-aware** (from Wali vs from Chef). Recipients who have not opened receive reminder notifications (`waliBroadcastReminder`). Pref type remains `broadcasts`. Deep links: office `/cabinet/shared/…`, Chef `/chief/shared/…`, Wali `/governor/shared/…`.

**File ACL:** creator **or** recipient **or** Wali/Admin support access.

### API summary

| Method | Path | Role |
| ------ | ---- | ---- |
| POST | `/cabinet/rapports/:id/uploads` | Office upload (multipart `file`) |
| POST | `/governor/uploads` | Wali pre-upload (multipart `file`) → `{ file }` for broadcast/instruction create with `uploaded_file_id` / `uploaded_file_ids` |
| POST | `/chief/uploads` | Chef pre-upload (same shape) |
| GET/PATCH | `/cabinet/rapports/:id/calendar-events` | List / replace events |
| GET | `/governor/calendar` | Events in date range |
| GET | `/governor/rapports/:id/views` | Who viewed rapport |
| POST | `/governor/broadcasts` | Wali create broadcast |
| GET | `/governor/broadcasts` | Wali list + read stats (all) |
| POST | `/governor/broadcasts/:id/read` | Wali mark read when recipient |
| GET | `/governor/office-users-for-share` | Wali recipient picker |
| POST | `/chief/broadcasts` | Chef create broadcast |
| GET | `/chief/office-users-for-share` | Chef recipient picker |
| GET | `/cabinet/broadcasts` | Office inbox |
| POST | `/cabinet/broadcasts/:id/read` | Mark read |
| GET | `/chief/broadcasts` | Chef list (created + received) |
| GET | `/chief/broadcasts/:id` | Chef detail |
| POST | `/chief/broadcasts/:id/read` | Chef mark read |
| POST | `/*/broadcasts/:id/comments` | Add comment |
