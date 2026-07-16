## Module: Rapport discussion (مناقشة التقرير)

### Purpose & constraints

Non-live **comment thread** at the bottom of a rapport so **office**, **Chef cabinet**, and **Wali** can discuss content. Separate from accept / demand-change decision notes (`wali_responses`, `chef_responses`).

- Available only **after first Envoyer** (at least one version with `submitted_at`, or status in `pending_chef` | `submitted` | `under_review` | `changes_requested` | `acknowledged`).
- Pure drafts (never submitted) → discussion disabled.
- Append-only (no edit/delete in v1). No live/WebSocket. No attachments in v1.

### Roles & rules

| Role | Read / post | Notes |
| ---- | ----------- | ----- |
| `OFFICE_USER` | Yes if can open the rapport | Including while `pending_chef` |
| `CHEF_CABINET` | Yes | Including while `pending_chef` |
| `WALI` | Yes only if visible to Wali | Blocked for `pending_chef` / draft via `assertVisibleToWali` |
| `ADMIN` | Yes (support) | Via chef/wali/office routes as applicable |

UI labels: compte bureau / رئيس الديوان / حساب الوالي — never raw enums.

### Data model

#### `rapport_comments`

- `id`, `rapport_id`, `author_user_id`, `body_text` (required, max 5000), `rapport_version_id` (nullable), `created_at`

#### `notifications`

- `message_key = rapportComment`, `comment_id` (nullable FK), `rapport_id`

### Notify fanout (on create)

Never notify the author. Notify:

1. Every non-blocked `CHEF_CABINET` and `WALI`
2. Rapport office owner (`owner_office_user_id`) or creator (`created_by_user_id`) if OFFICE_USER
3. Any other `OFFICE_USER` who already posted on this thread

Opening rapport / comments marks unread discussion notifications for that `rapport_id` + current user. Chef/Wali opening a rapport marks **all** unread notifications for that rapport (not only `rapportComment`), so info keys like bypass-resubmit are cleared.

### API

| Method | Path | Role |
| ------ | ---- | ---- |
| `GET` | `/office/rapports/:id/comments` | Office |
| `POST` | `/office/rapports/:id/comments` | Office |
| `GET`/`POST` | `/chef/rapports/:id/comments` | Chef |
| `GET`/`POST` | `/wali/rapports/:id/comments` | Wali (+ visibility gate) |

Pagination: `page`, `pageSize` (default 20, max 100). Order: `created_at ASC` within page (page 1 = oldest, or reverse-pagination for “load older” — implementation: list newest page last in UI chronologically).

### UI/UX

- Section title: **مناقشة التقرير** / Discussion du rapport
- Below Chef/Wali decision remarks
- Thread + composer; role-colored rows using teal/gold tokens
- Office notifications list: show `rapportComment` with link to rapport
- Chef/Wali hub: `unread_discussion` badge = **distinct rapports** with unread `rapportComment` (not raw notification row count). For Wali, exclude `pending_chef` / draft so the badge matches inbox visibility.

### Audit

| Action | When |
| ------ | ---- |
| `RAPPORT_COMMENT_CREATE` | Comment posted |

### Migration notes

- Distinct from decision response tables.
