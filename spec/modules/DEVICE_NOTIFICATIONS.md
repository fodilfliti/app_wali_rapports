## Module: Device notifications (إشعارات الجهاز)

### Purpose & constraints

Extend the existing in-app `notifications` system with **Web Push** (browser / phone OS toasts) and **per-user preference toggles**, plus **optimistic calendar reminders** for today and tomorrow — without client polling or a separate cron daemon.

- **Channels:** `in_app` (existing rows + hub badges) + `web_push` (VAPID). Email and native FCM are out of scope for v1.
- **No interval polling.** Push is fire-and-forget on domain writes. Calendar uses save-time fanout + at most one scan per user per local day on hub-counts.
- UI copy: Arabic default, French optional — **no English**.
- Admin role: no device push in v1.

### Roles & rules

| Role | In-app | Web push | Calendar reminders |
| ---- | ------ | -------- | ------------------ |
| `OFFICE_USER` | Yes (existing + prefs) | Yes if subscribed | No (no hub calendar) |
| `CHEF_CABINET` | Inbox + discussion + shared; new pending keys | Yes | Yes (visible events) |
| `WALI` | Inbox + discussion; new pending keys | Yes | Yes (visible events) |
| `ADMIN` | Support only | No | No |

**Smart fanout (Chef gate):**

| Event | Who gets notified | `message_key` |
| ----- | ----------------- | ------------- |
| Office Envoyer → `pending_chef` | Active Chef only (**not** Wali) | `rapportPendingChef` |
| Chef accept → `submitted` | Active Wali | `rapportPendingWali` |
| Bypass resubmit | Chef info | `rapportResubmittedBypass` (existing) |
| Chef/Wali respond | Office (existing keys) | `chef*` / `wali*` |
| Discussion comment | Fanout per `RAPPORT_DISCUSSION.md` | `rapportComment` |
| Instruction / broadcast | Recipients | `waliInstruction` / `waliBroadcast*` |
| Calendar today / tomorrow | Active Wali + Chef (same visibility as hub calendar) | `calendarToday` / `calendarTomorrow` |

Disabled preference types are **not inserted**, **not pushed**, and **hidden** from notification lists / hub unread for that type.

### Preference keys

| Key | Meaning |
| --- | ------- |
| `enabled` | Master switch — off disables all types |
| `push_enabled` | Allow Web Push subscription / delivery |
| `rapport_inbox` | New rapport awaiting me (`rapportPendingChef`, `rapportPendingWali`, `rapportResubmittedBypass`) |
| `rapport_feedback` | Chef/Wali decision notes to office |
| `discussion` | `rapportComment` |
| `instructions` | `waliInstruction` |
| `broadcasts` | `waliBroadcast`, `waliBroadcastReminder` |
| `calendar` | `calendarToday`, `calendarTomorrow` |

Defaults: all `true`.

### Data model

#### `user_notification_preferences`

- `user_id` PK FK → `users`
- Booleans for each preference key above
- `updated_at`

#### `web_push_subscriptions`

- `id`, `user_id`, `endpoint` (UNIQUE), `p256dh`, `auth`, `user_agent`, `created_at`, `last_seen_at`
- Dead endpoints (HTTP 404/410 from push) are deleted

#### `users.calendar_reminders_checked_on`

- `DATEONLY` — last Africa/Algiers calendar day when hub-counts ran the reminder scan for this user

#### `notifications` extensions

- New keys: `rapportPendingChef`, `rapportPendingWali`, `calendarToday`, `calendarTomorrow`
- Optional `calendar_event_id` FK → `rapport_calendar_events` (nullable, SET NULL on delete)
- Dedupe calendar: unique on `(user_id, calendar_event_id, message_key)` where `calendar_event_id` IS NOT NULL

### Workflows

#### Notify pipeline (`notifyService`)

1. Resolve recipient user IDs (skip author / blocked).
2. Filter by preferences (`message_key` → pref type; master `enabled` must be on).
3. Insert `notifications` rows (bulk).
4. If `push_enabled` and VAPID configured: send Web Push to subscriptions; drop dead endpoints.
5. Existing hub-counts / mark-read behaviour unchanged except prefs hide disabled types from counts/lists.

#### Optimistic calendar reminders

1. **On calendar events replace-save:** if any `event_date` is today or tomorrow (Africa/Algiers) and the rapport is visible to Wali and/or Chef filters, fanout reminders immediately (idempotent).
2. **On first `GET /*/hub-counts` per user per local day:** if `calendar_reminders_checked_on` ≠ today, scan today+tomorrow events visible to that role, create missing rows + push, set `calendar_reminders_checked_on = today`.

### API endpoints

Shared under auth (any non-admin logged-in role that may receive push):

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/auth/me/notification-preferences` | Current prefs (defaults if no row) |
| `PUT` | `/auth/me/notification-preferences` | Update prefs (Zod) |
| `GET` | `/auth/push/vapid-public-key` | Public VAPID key (or 503 if unset) |
| `POST` | `/auth/push/subscribe` | Upsert subscription `{ endpoint, keys: { p256dh, auth } }` |
| `DELETE` | `/auth/push/subscribe` | Remove by `{ endpoint }` |

Hub-counts endpoints keep their paths; calendar day-scan is a side effect.

### UI/UX

- Profile menu → **إعدادات الإشعارات** / Paramètres des notifications
- Master toggle, type toggles, device push enable (permission + subscribe)
- Soft-fail if permission denied
- Service worker: `push` + `notificationclick` → deep-link (inbox, calendar, discussion, shared, instructions)
- While tab open: SW may postMessage → `hub-counts-refresh` (no poll)

**Form validation:** Zod client + server on prefs PUT and subscribe body — see `spec/CORE.md`.

### Audit events (minimum)

| Action type | When |
| ----------- | ---- |
| `NOTIFICATION_PREFS_UPDATE` | User saves preference toggles |
| `PUSH_SUBSCRIBE` | Subscription upserted |
| `PUSH_UNSUBSCRIBE` | Subscription removed |

### Non-functional requirements

- No client `setInterval` for notifications
- Push send failures must not fail the domain write transaction (best-effort after commit)
- VAPID: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in server env
- Toast titles/bodies bilingual via payload `title_ar` / `title_fr` / `body_*` (client picks locale)

### Migration/compatibility notes

- Existing in-app notification creators move through `notifyService` (prefs + push).
- Dedicated hub counters (instructions / shared) unchanged; prefs can still hide those channels.
- Commune-list embedded `data_json` calendar events remain out of hub reminder scan (same as hub calendar DB-only).
- Cross-refs: `CHEF_CABINET.md`, `MEDIA_CALENDAR_WALI_SHARING.md`, `RAPPORTS.md`, `RAPPORT_SERVICE_TYPES.md`, `RAPPORT_DISCUSSION.md`, `WALI_INSTRUCTIONS.md`.
