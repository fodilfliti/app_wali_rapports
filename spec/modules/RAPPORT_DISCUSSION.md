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

UI labels: ملحق بالديوان / Attaché de cabinet · رئيس الديوان · حساب الوالي — never raw enums.

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
| `GET` | `/wali/rapports?unread_discussion=1` | Wali discussion New |
| `GET` | `/wali/rapports?has_discussion=1` | Wali discussion All (by latest comment) |
| `GET` | `/chef/rapports?unread_discussion=1` | Chef discussion New |
| `GET` | `/chef/rapports?has_discussion=1` | Chef discussion All |
| `GET` | `/office/rapports?unread_discussion=1` | Office discussion New |
| `GET` | `/office/rapports?has_discussion=1` | Office discussion All (by latest comment; scoped) |

Comment thread pagination: `page`, `pageSize` (default 20, max 100). Order: `created_at ASC` within page (page 1 = oldest, or reverse-pagination for “load older” — implementation: list newest page last in UI chronologically). Discussion list rows include `last_comment_at` and `has_unread_discussion`.

### UI/UX

- Section title: **مناقشة التقرير** / Discussion du rapport
- Below Chef/Wali decision remarks
- Thread + composer; role-colored rows using teal/gold tokens
- Office notifications list: show `rapportComment` with link to rapport
- Office / Chef / Wali hub: `unread_discussion` badge = **distinct rapports** with unread `rapportComment` (not raw notification row count). For Wali, exclude `pending_chef` / draft so the badge matches inbox visibility.
- Office discussion list scope = rapports the user owns/created/commented on **or** any non-draft rapport in a service they can access (so the top-bar badge matches a clickable inbox row).

#### Discussion inbox (office / Chef / Wali)

| Role | URL | Notes |
| ---- | --- | ----- |
| Office | `/office/rapports?view=discussion` | Hub tile **المناقشة** + optional header bell; same New / All sub-tabs |
| Chef | `/chef/rapports?view=discussion` | Hub tile + header bell |
| Wali | `/wali/rapports?view=discussion` | Hub tile + header bell |

Sub-tabs (default = New so hub/bell still land on unread):

| Tab | URL | List API | Meaning |
| --- | --- | --- | --- |
| **New** (جديد / Nouveaux) | `?view=discussion` | `unread_discussion=1` | Rapports with unread `rapportComment` for the current user |
| **All** (كل المناقشات / Toutes) | `?view=discussion&tab=all` | `has_discussion=1` | Rapports with ≥1 comment, **ordered by latest comment `created_at` DESC** |

- Wali visibility on both tabs: exclude `pending_chef` / draft / hidden (same as inbox).
- Chef All/New may include `pending_chef`.
- **Office All:** only rapports the user **owns** (`owner_office_user_id` / `created_by_user_id`) **or** has already posted on (participant). Not a wilaya-wide discussion dump.
- List rows expose `last_comment_at` and `has_unread_discussion` (badge only when unread).
- Purpose of All: reopen past threads without searching by rapport title.
- Office list page keeps the normal rapports inbox when `view` is absent; discussion tabs switch the list API filters above.

### Audit

| Action | When |
| ------ | ---- |
| `RAPPORT_COMMENT_CREATE` | Comment posted |

### Migration notes

- Distinct from decision response tables.
