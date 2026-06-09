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
- Arabic: Tahoma + PDF RTL shaping; tables/bordered blocks have export margins; tables **>3 rows** → portrait page break.
- Audit: `RAPPORT_PDF_EXPORT`, `RAPPORT_DOCX_EXPORT`

### Calendar events

Table `rapport_calendar_events` — multiple events per rapport.

| Field | Notes |
| ----- | ----- |
| `event_date` | DATE — shown on Wali calendar |
| `title_ar`, `title_fr` | Short label |
| `note_ar`, `note_fr` | Optional detail |

Office users manage events on draft/editable rapports. Events appear on the **Wali hub calendar** (`GET /wali/calendar`); they are **not** appended to PDF/Word export files. Help text in the calendar editor should reflect Wali calendar visibility only.

### Rapport views

Table `rapport_views` — `(rapport_id, user_id, viewed_at)` unique. Recorded when Wali opens a rapport. Exposed to Wali on rapport detail.

### Wali broadcasts

Wali uploads a file and shares with all office users or selected recipients.

| Table | Purpose |
| ----- | ------- |
| `wali_broadcasts` | Title, message, file ref, `allow_comments` |
| `wali_broadcast_recipients` | Per-user `read_at`, notification state |
| `wali_broadcast_comments` | Optional thread when enabled |

Notifications: `message_key` = `waliBroadcast` on share; office bell shows unread. Recipients who have not opened receive reminder notifications.

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
| POST | `/*/broadcasts/:id/comments` | Add comment |
