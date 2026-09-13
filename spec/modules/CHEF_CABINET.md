## Module: Chef Cabinet (رئيس الديوان)

### Purpose & constraints

- Account role: **`CHEF_CABINET`** (UI: **رئيس الديوان**).
- Same review tools as Wali (inbox, navigation tree, respond, calendar, exports, versions). May create **shared broadcasts** (same pool as Wali) and **Chef instructions** (separate channel). Cannot create Wali instructions.
- First-line validator: creator submissions go to Chef before Wali can see them (unless gate is bypassed after a Wali change request, **or** admin turned off `chef_validate` for that creator’s role).
- Hub paths: live segment `/chief/*` (hub key `chef`) — `ROUTES.md`. UI/BE gates via `can*` / `assertCan` — `ACCESS_PROFILES.md`. Workflow levels: `WORKFLOW_TREE.md`.

### Roles & rules

- **CHEF_CABINET**: `/chief/*` routes; inbox for `pending_chef`; respond → accept / changes_requested (رفض أو طلب تعديل); **delete requests** (`delete_requested_at`) → approve / reject; read-only **Wali** instructions (`/chief/instructions`); create/delete **Chef** instructions (`/chief/chef-instructions` — `CHEF_INSTRUCTIONS.md`); create + receive **shared files** (`/chief/shared`, `broadcast.create`). Hub: **4 creator cards** → `/chief/creators/{office|daira|commune|direction}`.
- **Creator roles** (`CREATOR_ROLES`): submit → `pending_chef` when `chef_gate = required` **and** `workflow_role_settings.chef_validate = true` for that role; if role toggle is off → first submit goes `submitted` (Wali). Editable when `draft` or `changes_requested`. May **return to draft** while `pending_chef` | `submitted` | `under_review` (Éditeur / `manage`, confirm UI) — clears current version `submitted_at` and current-version chef remarks, resets `chef_gate = required`, removes from Chef inbox until re-send; older-version history kept; blocked after Wali accept/view — see **`RAPPORTS.md`** § Office recall. May **delete** or **request delete** per **`RAPPORTS.md`** § Office delete (confirm dialog: instant vs Chef approval).
- **WALI**: inbox excludes `pending_chef`; sees rapport only after Chef accept, on bypass resubmit, or when role’s `chef_validate` is off.
- **ADMIN**: may use chef/wali hub routes for support.

### Data model

#### `users.role`

- ENUM includes `CHEF_CABINET` and all `CREATOR_ROLES` (see `ORGANIZATION.md`).

#### `rapports`

- `status` includes `pending_chef`.
- `chef_gate`: `required` | `bypass` (default `required`).
- Submit also consults **`workflow_role_settings.chef_validate`** for the actor’s creator role (admin toggle; default true) — `WORKFLOW_TREE.md`.
- `delete_requested_at` / `delete_requested_by_user_id` when creator asks Chef to approve permanent delete — `RAPPORTS.md` §6.

#### `chef_responses`

- Mirror of `wali_responses`: `decision` (`accepted` | `changes_requested` | `viewed`), `body_text`, `rapport_id`, `rapport_version_id`, `scope`, `follow_up_status`, timestamps.
- Reject and demand modification both set rapport to `changes_requested` (office can fix and resubmit).

### Workflows

```
draft|changes_requested + chef_gate=required
  → submit → if workflow_role_settings.chef_validate[role]: pending_chef
             else: submitted (Wali; skip Chef)
Chef accept → submitted (Wali inbox), chef_gate stays until Wali acts
Chef changes_requested → changes_requested, chef_gate=required
Wali changes_requested → changes_requested, chef_gate=bypass
Creator resubmit with bypass → submitted (+ notify Chef info-only `rapportResubmittedBypass` + notify Wali `rapportPendingWali`)
Creator return-to-draft (while pending_chef | submitted | under_review, before Wali accept/view)
  → draft + chef_gate=required; wipe current-version chef/wali remarks + discussion only
    (older versions kept; out of Chef/Wali inbox until re-send)
Creator delete: no chef/wali responses → instant hard-delete (or discard unsubmitted draft version only)
Creator delete: any chef/wali response → delete_requested → Chef approve (restore previous version if any, else destroy) | reject
```

### API endpoints

| Method | Path | Notes |
| ------ | ---- | ----- |
| `GET` | `/chief/rapports` | Inbox: `pending_chef`, `submitted`, `under_review`, …; `status_group=delete_requested` |
| `GET` | `/chief/rapports/:id` (+ view / versions / exports) | Requires `assertVisibleToChef` — never `draft` / hidden; status must be in Chef inbox set |
| `POST` | `/chief/rapports/:id/respond` | Chef decision (also gated by `assertVisibleToChef`) |
| `POST` | `/chief/rapports/:id/delete-decision` | `{ decision: "approved" \| "rejected" }`; approve → restore previous version or destroy if sole v1 |
| `GET` | `/chief/creators/:creatorKey` | Creator list by key (`office` \| `daira` \| `commune` \| `direction`) |
| `GET` | `/chief/creators/:creatorKey/:userId/...` | Grantee lens tree (same as Wali) |
| `GET` | `/chief/office-users` | **Legacy** → redirect / alias of `creators/office` (one release) |
| `GET` | `/chief/instructions` | Read-only Wali instructions |
| `GET` | `/chief/instructions/:id` | Wali instruction detail |
| `GET/POST/DELETE` | `/chief/chef-instructions` (+ `/:id`) | Chef instructions CRUD — `CHEF_INSTRUCTIONS.md` |
| `GET` | `/chief/broadcasts` | Shared-files list (created + received) |
| `POST` | `/chief/broadcasts` | Create shared broadcast |
| `POST` | `/chief/uploads` | Pre-upload for broadcast/Chef instruction |
| `GET` | `/chief/office-users-for-share` | Recipient picker (all creators + Wali) |
| `GET` | `/chief/broadcasts/:id` | Broadcast detail |
| `POST` | `/chief/broadcasts/:id/read` | Mark read |
| `POST` | `/chief/broadcasts/:id/comments` | Comment if allowed |

### UI/UX

- Hub label **رئيس الديوان**; nav mirrors Wali including shared create and Chef-instructions create; Wali-instructions tile stays read-only.
- Hub: **4 creator cards** (ملحقو الديوان / رؤساء الدوائر / رؤساء البلديات / مديرو المديريات) → `/chief/creators/...` — never raw enums.
- Hub tile **ملفات مشتركة** → `/chief/shared` (create + inbox); unread via `unread_shared_files`. Cards/details show uploader (والي / رئيس الديوان).
- Hub tile **تعليمات رئيس الديوان** → `/chief/chef-instructions`; separate from **تعليمات السيد الوالي**.
- Hub / filter: **طلبات الحذف** (`delete_pending` count + `status_group=delete_requested`) for creator delete requests.
- Included in Wali broadcast recipient picker and “all” sends; Chef uploads notify Wali — see `MEDIA_CALENDAR_WALI_SHARING.md`.
- Rapport bottom: **ملاحظات رئيس الديوان** then **ملاحظات الوالي**, then **مناقشة التقرير** (see `RAPPORT_DISCUSSION.md`).
- Never show enum `CHEF_CABINET` in UI.

### Notifications

| message_key | Recipient |
| ----------- | --------- |
| `rapportPendingChef` | Chef — creator Envoyer lands in `pending_chef` when role `chef_validate` on (device + in-app; **not** Wali) |
| `rapportPendingWali` | Wali — after Chef accept → `submitted`, on creator bypass resubmit → `submitted`, or when role `chef_validate` off |
| `rapportDeleteRequested` | Chef — office delete request (`rapport_inbox`) |
| `rapportDeleteApproved` / `rapportDeleteRejected` | Office service `manage` grantees |
| `chefAccepted`, `chefChangesRequested`, `chefFeedback` | Office — all active grant holders on the rapport’s service (`SERVICE_SHARING.md`) |
| `rapportResubmittedBypass`, `waliChangesRequested` (info) | Chef |
| `rapportComment` | Office / Chef / Wali (fanout — `RAPPORT_DISCUSSION.md`; office also includes `manage` co-grantees on the service) |
| Existing wali\* keys | Office — all active grant holders on the rapport’s service |

Device push + preference filtering: `DEVICE_NOTIFICATIONS.md`.

### Per-user navigation

- `GET /chief/creators/:creatorKey/:userId/...` (legacy `office-users`) and list queries with `office_user_id` use the **grantee lens** (all rapports in that creator’s granted services), same as Wali — `SERVICE_SHARING.md`.

### Audit events

| Action type | When |
| ----------- | ---- |
| `CHEF_RESPOND` | Chef posts response |
| `RAPPORT_SUBMIT_PENDING_CHEF` | Submit lands in chef gate |
| `RAPPORT_DELETE` | Chef approves delete request (also used for office instant delete — `RAPPORTS.md`) |
| `RAPPORT_DELETE_REJECTED` | Chef rejects delete request |

### Migration notes

- Existing rapports: set `chef_gate = bypass` so in-flight Wali work is not blocked; new rapports default `required`.
- Seed `workflow_role_settings` with `chef_validate=true` for all four creator roles.
- Related: `WORKFLOW_TREE.md` (Wilaya level map + role toggles), `ACCESS_PROFILES.md` (`rapport.respond`).
