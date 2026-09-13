## Module: Guide videos (فيديوهات الدليل)

### Purpose & constraints

- Admin uploads short **guide / help videos** so each account type can learn the product.
- Videos are tagged by **one or more audiences**: `general` and/or login roles (`OFFICE_USER`, `PRESIDENT_DAIRA`, `PRESIDENT_COMMUNE`, `DIRECTEUR_DIRECTION`, `CHEF_CABINET`, `WALI`, `ADMIN`). Minimum one audience required.
- **Admin-audience videos are secret**: if `ADMIN` is among a video’s audiences, never list (or stream) that video to non-admin users.
- Frontend flag `ENABLE_GUIDE_VIDEOS` hides the whole section (hub tile + routes) when `false`.
- Storage reuses `uploaded_files` + local disk (same limits as rapport media: video ≤ 100MB, mp4/webm/mov).
- UI: Arabic default, French optional — no English copy. Never show raw role enums.

### Roles & rules

- **Super-admin** (`is_super_admin`):
  - Full CRUD (upload, edit metadata, replace file, toggle `is_new`, delete).
  - Sees all audiences including `ADMIN`.
  - Hub tile → `/admin/guide`.
- **Regular ADMIN** (not super):
  - Read-only list of all audiences including `ADMIN` (no upload/edit/delete).
  - Hub tile → `/admin/guide`.
- **OFFICE_USER** / **PRESIDENT_DAIRA** / **PRESIDENT_COMMUNE** / **DIRECTEUR_DIRECTION** / **CHEF_CABINET** / **WALI**:
  - Read-only list + large video player.
  - See videos whose audiences are only among `general` + role audiences **except** any video that includes `ADMIN`.
  - Hub tiles → `/cabinet/guide`, `/chief/guide`, `/governor/guide`.

### Data model

#### Table `guide_videos`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | Public UUID (API); internal BIGINT until drop — `IDENTITY_UUID.md` | |
| `title_ar`, `title_fr` | STRING(200) | At least one required (bilingual helpers) |
| `description_ar`, `description_fr` | TEXT | Optional |
| `uploaded_file_id` | FK → `uploaded_files` (public file id = UUID in API) | Must be `media_kind = video` |
| `is_new` | BOOLEAN | Default `false`; admin toggle for « جديد » badge |
| `sort_order` | INT | Default `0` |
| `created_by_user_id` | FK → `users` (public user id = UUID in API) | |
| `created_at`, `updated_at` | DATE | |

#### Table `guide_video_audiences`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | BIGINT PK | |
| `guide_video_id` | FK → `guide_videos.id` CASCADE | |
| `audience` | ENUM (same type as former `guide_videos.audience`) | `general` \| `ADMIN` \| `OFFICE_USER` \| `PRESIDENT_DAIRA` \| `PRESIDENT_COMMUNE` \| `DIRECTEUR_DIRECTION` \| `CHEF_CABINET` \| `WALI` |
| Unique | `(guide_video_id, audience)` | |

#### Relationships

- `GuideVideo` belongsTo `UploadedFile` (`file`)
- `GuideVideo` belongsTo `User` (`createdByUser`)
- `GuideVideo` hasMany `GuideVideoAudience` (`audienceRows`)

#### Indexes

- `guide_videos`: `(is_new)`, `(sort_order)`
- `guide_video_audiences`: `(audience)`, unique `(guide_video_id, audience)`

### Workflows

1. Admin opens guide page → uploads video + title + **one or more audiences** + optional « فيديو جديد ».
2. Users open hub tile → filter tabs (Général / ملحق بالديوان / رئيس الدائرة / رئيس البلدية / مدير المديرية / Chef / Wali; Admin tab only for admin) → a video appears under a tab if that audience is one of its tags → open large player.
3. Admin can clear `is_new` or edit/delete anytime (no auto-expire, no per-user watched state).

### API endpoints

#### Admin (manage) — prefix `/admin`

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/guide-videos` | Paginated; all audiences; `?audience=` optional (contains); `?page` / `pageSize` (max 100) |
| `POST` | `/guide-videos` | Multipart: `file` + `payload` JSON (`audiences: string[]`, min 1) |
| `PATCH` | `/guide-videos/:id` | JSON metadata (`audiences` replace-all when sent), or multipart with optional new `file` |
| `DELETE` | `/guide-videos/:id` | |

#### View (authenticated role prefixes)

| Method | Path |
| ------ | ---- |
| `GET` | `/cabinet/guide-videos` |
| `GET` | `/governor/guide-videos` |
| `GET` | `/chief/guide-videos` |

Same list shape as admin GET. Each item serializes `audiences: string[]`. Non-admin lists **exclude any video that has `ADMIN` among audiences**. Optional `?audience=` filter matches videos that **contain** that audience. Sort: `sort_order ASC`, `created_at ASC` (oldest first; latest at end), then `id ASC`. Each item includes serialized `file` (`url_path`, mime, …). « جديد » is a badge only — it does **not** reorder the list.

**File stream:** non-admin may play if `general` ∈ audiences **or** `user.role` ∈ audiences; admins may play any guide video they can see. Videos with `ADMIN` among audiences are admin-only.

### UI/UX

- **Entry:** `HubTile` on each role hub when `ENABLE_GUIDE_VIDEOS === true` ([`frontend/src/config/features.ts`](../../frontend/src/config/features.ts)).
- **Routes:** `/admin/guide`, `/cabinet/guide`, `/governor/guide`, `/chief/guide`.
- **Tabs:** Général, ملحق بالديوان, رئيس الدائرة, رئيس البلدية, مدير المديرية, Chef, Wali; Admin tab only if current user is admin.
- **Cards:** title, optional description, audience chips (all tags), « جديد » / « Nouveau » when `is_new`.
- **Player:** near-fullscreen modal + native `<video controls>` and browser fullscreen; URLs via `SignedFileLink` / signed `?dl=` (never access JWT in query) — `AUTH.md`.
- **Admin form:** upload-on-pick with byte progress (`mediaUploadProgress`); optional client video prep when `ENABLE_CLIENT_VIDEO_TRANSCODE`. Titles, descriptions (FR gated by `ENABLE_FR_VALUE_INPUTS`), **audience checkboxes** (min 1), `is_new` checkbox, edit/delete. Save sends metadata only when file already uploaded via `POST /admin/uploads` or multipart create/patch.
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
- Do not expose videos that include Admin audience to non-admin (API filter, not UI-only hide).

### Migration/compatibility notes

- Junction table `guide_video_audiences`; backfill from former scalar `guide_videos.audience`, then drop that column.
- Feature flag default `true`; flip to `false` to hide UI without removing data/API.
