## Module: Chef Cabinet (رئيس الديوان)

### Purpose & constraints

- Fourth account role: **`CHEF_CABINET`** (UI: **رئيس الديوان**).
- Same review tools as Wali (inbox, navigation tree, respond, calendar, exports, versions) **except** cannot create Wali instructions or broadcasts.
- First-line validator: office submissions go to Chef before Wali can see them (unless gate is bypassed after a Wali change request).

### Roles & rules

- **CHEF_CABINET**: `/chef/*` routes; inbox for `pending_chef`; respond → accept / changes_requested (رفض أو طلب تعديل); read-only instructions list; **recipient** of Wali broadcasts (`/chef/shared`, included in share picker and “all”).
- **OFFICE_USER**: submit → `pending_chef` when `chef_gate = required`; editable when `draft` or `changes_requested`. May **return to draft** while `pending_chef` (Éditeur / `manage`, confirm UI) — clears current version `submitted_at`, removes from Chef inbox until re-send; blocked after Wali accept/view — see **`RAPPORTS.md`** § Office recall.
- **WALI**: inbox excludes `pending_chef`; sees rapport only after Chef accept or on bypass resubmit.
- **ADMIN**: may use chef/wali routes for support.

### Data model

#### `users.role`

- ENUM includes `CHEF_CABINET`.

#### `rapports`

- `status` includes `pending_chef`.
- `chef_gate`: `required` | `bypass` (default `required`).

#### `chef_responses`

- Mirror of `wali_responses`: `decision` (`accepted` | `changes_requested` | `viewed`), `body_text`, `rapport_id`, `rapport_version_id`, `scope`, `follow_up_status`, timestamps.
- Reject and demand modification both set rapport to `changes_requested` (office can fix and resubmit).

### Workflows

```
draft|changes_requested + chef_gate=required
  → submit → pending_chef
Chef accept → submitted (Wali inbox), chef_gate stays until Wali acts
Chef changes_requested → changes_requested, chef_gate=required
Wali changes_requested → changes_requested, chef_gate=bypass
Office resubmit with bypass → submitted (+ notify Chef info-only, no gate)
Office return-to-draft (while pending_chef | submitted | under_review, before Wali accept/view)
  → draft (same current version; out of Chef/Wali inbox)
```

### API endpoints

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/chef/rapports` | Inbox: `pending_chef`, `submitted`, `under_review`, … |
| `POST` | `/chef/rapports/:id/respond` | Chef decision |
| `GET` | `/chef/office-users` | Same tree as Wali |
| `GET` | `/chef/instructions` | Read-only list |
| `GET` | `/chef/instructions/:id` | Detail |
| `GET` | `/chef/broadcasts` | Shared-files inbox (recipient) |
| `GET` | `/chef/broadcasts/:id` | Broadcast detail |
| `POST` | `/chef/broadcasts/:id/read` | Mark read |
| `POST` | `/chef/broadcasts/:id/comments` | Comment if allowed |

### UI/UX

- Hub label **رئيس الديوان**; nav mirrors Wali minus instruction/broadcast create.
- Hub tile **ملفات مشتركة** → `/chef/shared` (same UX as office shared inbox); unread via `unread_shared_files`.
- Included in Wali broadcast recipient picker and “all” sends — see `MEDIA_CALENDAR_WALI_SHARING.md`.
- Rapport bottom: **ملاحظات رئيس الديوان** then **ملاحظات الوالي**, then **مناقشة التقرير** (see `RAPPORT_DISCUSSION.md`).
- Never show enum `CHEF_CABINET` in UI.

### Notifications

| message_key | Recipient |
| ----------- | --------- |
| `rapportPendingChef` | Chef — office Envoyer lands in `pending_chef` (device + in-app; **not** Wali) |
| `rapportPendingWali` | Wali — after Chef accept → `submitted` |
| `chefAccepted`, `chefChangesRequested`, `chefFeedback` | Office |
| `rapportResubmittedBypass`, `waliChangesRequested` (info) | Chef |
| `rapportComment` | Office / Chef / Wali (fanout — `RAPPORT_DISCUSSION.md`) |
| Existing wali\* keys | Office (unchanged) |

Device push + preference filtering: `DEVICE_NOTIFICATIONS.md`.

### Audit events

| Action type | When |
| ----------- | ---- |
| `CHEF_RESPOND` | Chef posts response |
| `RAPPORT_SUBMIT_PENDING_CHEF` | Submit lands in chef gate |

### Migration notes

- Existing rapports: set `chef_gate = bypass` so in-flight Wali work is not blocked; new rapports default `required`.
