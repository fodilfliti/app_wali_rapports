## Module: Guide videos (فيديوهات الدليل)

### Purpose & constraints

- Admin uploads short **guide / help videos** so each account type can learn the product.
- Videos are tagged by **audience**: general, or one login role (`OFFICE_USER`, `CHEF_CABINET`, `WALI`, `ADMIN`).
- **Admin-audience videos are secret**: never listed to non-admin users.
- Frontend flag `ENABLE_GUIDE_VIDEOS` hides the whole section (hub tile + routes) when `false`.
- Storage reuses `uploaded_files` + local disk (same limits as rapport media: video ≤ 100MB, mp4/webm/mov).
- UI: Arabic default, French optional — no English copy. Never show raw role enums.

### Roles & rules

- **ADMIN**:
  - Full CRUD (upload, edit metadata, replace file, toggle `is_new`, delete).
  - Sees all audiences including `ADMIN`.
  - Hub tile → `/admin/guide`.
- **OFFICE_USER** / **CHEF_CABINET** / **WALI**:
  - Read-only list + large video player.
  - See `general` + all role audiences **except** `ADMIN`.
  - Hub tiles → `/office/guide`, `/chef/guide`, `/wali/guide`.

### Data model

#### Table `guide_videos`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | BIGINT PK | |
| `title_ar`, `title_fr` | STRING(200) | At least one required (bilingual helpers) |
| `description_ar`, `description_fr` | TEXT | Optional |
| `audience` | ENUM | `general` \| `ADMIN` \| `OFFICE_USER` \| `CHEF_CABINET` \| `WALI` |
| `uploaded_file_id` | BIGINT FK → `uploaded_files` | Must be `media_kind = video` |
| `is_new` | BOOLEAN | Default `false`; admin toggle for « جديد » badge |
| `sort_order` | INT | Default `0` |
| `created_by_user_id` | BIGINT FK → `users` | |
| `created_at`, `updated_at` | DATE | |

#### Relationships

- `GuideVideo` belongsTo `UploadedFile` (`file`)
- `GuideVideo` belongsTo `User` (`createdByUser`)

#### Indexes

- `(audience)`, `(is_new)`, `(sort_order)`

### Workflows

1. Admin opens guide page → uploads video + title + audience + optional « فيديو جديد ».
2. Users open hub tile → filter tabs (Général / Bureau / Chef / Wali; Admin tab only for admin) → open large player.
3. Admin can clear `is_new` or edit/delete anytime (no auto-expire, no per-user watched state).

### API endpoints

#### Admin (manage) — prefix `/admin`

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/guide-videos` | Paginated; all audiences; `?audience=` optional; `?page` / `pageSize` (max 100) |
| `POST` | `/guide-videos` | Multipart: `file` + `payload` JSON |
| `PATCH` | `/guide-videos/:id` | JSON metadata, or multipart with optional new `file` |
| `DELETE` | `/guide-videos/:id` | |

#### View (authenticated role prefixes)

| Method | Path |
| ------ | ---- |
| `GET` | `/office/guide-videos` |
| `GET` | `/wali/guide-videos` |
| `GET` | `/chef/guide-videos` |

Same list shape as admin GET, but **exclude `audience = ADMIN`** unless caller role is `ADMIN`. Optional `?audience=` filter. Sort: `sort_order ASC`, `created_at ASC` (oldest first; latest at end), then `id ASC`. Each item includes serialized `file` (`url_path`, mime, …). « جديد » is a badge only — it does **not** reorder the list.

### UI/UX

- **Entry:** `HubTile` on each role hub when `ENABLE_GUIDE_VIDEOS === true` ([`frontend/src/config/features.ts`](../../frontend/src/config/features.ts)).
- **Routes:** `/admin/guide`, `/office/guide`, `/wali/guide`, `/chef/guide`.
- **Tabs:** Général, Bureau, Chef, Wali; Admin tab only if current user is admin.
- **Cards:** title, optional description, « جديد » / « Nouveau » when `is_new`.
- **Player:** near-fullscreen modal + native `<video controls>` and browser fullscreen; URLs via `fileUrl(token, file)`.
- **Admin form:** upload-on-pick with byte progress (`mediaUploadProgress`); optional client video prep when `ENABLE_CLIENT_VIDEO_TRANSCODE`. Titles, descriptions (FR gated by `ENABLE_FR_VALUE_INPUTS`), audience select, `is_new` checkbox, edit/delete. Save sends metadata only when file already uploaded via `POST /admin/uploads` or multipart create/patch.
- **Pre-upload API:** `POST /admin/uploads` (multipart `file`) → `{ file }` for guide-video create/patch with `uploaded_file_id` in payload.
- **Validation:** Zod client `guideVideoFormSchema` in `frontend/src/validation/schemas/forms.ts`; server `guideVideoCreateSchema` / `guideVideoPatchSchema` in `backend/src/validation/schemas/adminCrud.js` (payload parsed from multipart).

### Audit events (minimum)

| `action_type` | `details` |
| ------------- | --------- |
| `GUIDE_VIDEO_CREATE` | `{ guide_video_id }` |
| `GUIDE_VIDEO_UPDATE` | `{ guide_video_id }` |
| `GUIDE_VIDEO_DELETE` | `{ guide_video_id }` |

### Non-functional requirements

- Authenticated file serve only (`GET /files/...`).
- List pagination required; max `pageSize` 100.
- Do not expose Admin-audience rows to non-admin (API filter, not UI-only hide).

### Migration/compatibility notes

- New table only; no change to rapport media.
- Feature flag default `true`; flip to `false` to hide UI without removing data/API.
