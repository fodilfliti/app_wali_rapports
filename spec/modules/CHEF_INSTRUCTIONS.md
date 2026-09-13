## Module: Chef instructions (إشعارات رئيس الديوان)

### Purpose & constraints

Chef de cabinet sends operational notices to all or selected creator accounts: title, description, optional file attachments. **Separate channel** from Wali instructions (`wali_instructions`) and from file broadcasts (`wali_broadcasts`). Do not merge UIs or inboxes with Wali instructions.

**UI copy:** Arabic/French labels depend on role — **ملحق بالديوان** (`OFFICE_USER`), **رئيس الديوان** (`CHEF_CABINET`), and Wali keep **تعليمات** / Instructions; **org heads** (رئيس دائرة / بلدية / مدير) use **إشعارات** / Notifications when `ORG_HEAD_FEATURE_FLAGS.chefChannelAsNotifications` is true. Internal API/DB/keys remain `chef_instructions` / `chefInstruction`. Helper: `usesChefNotificationsWording` / FE `chefChannelCopy`.

Paths: `/governor`, `/cabinet`, `/chief` (`ROUTES.md`). Public ids UUID (`IDENTITY_UUID.md`). Create gated by `rapports.chef_instructions.create` / ActionKey (`ACCESS_PROFILES.md`).

### Roles & rules

- **CHEF_CABINET**: create + list/detail + **delete** own instructions (`/chief/chef-instructions`). Delete removes the instruction, recipient rows, file links, and all related `chefInstruction` notifications. Keeps **read-only** access to Wali instructions via existing `/chief/instructions`.
- **Creator roles** (`CREATOR_ROLES`): list/detail Chef instructions addressed to them; separate hub tile + unread (`unread_chef_instructions`).
- **WALI**: read-only list/detail of **all** Chef instructions via `/governor/chef-instructions`; **notified** when included (`all_wali` default on, or individual pick); hub badge `unread_chef_instructions` (unread notification rows); opening detail marks those notifications read.
- **ADMIN**: may read via support routes.

### Data model

#### `chef_instructions`

- `id`, `title_ar`, `title_fr`, `body_ar`, `body_fr`, `created_by_user_id`, `created_at`, `updated_at` (+ UUID public id)

#### `chef_instruction_files`

- `id`, `instruction_id`, `uploaded_file_id`, `sort_order`

#### `chef_instruction_recipients`

- `id`, `instruction_id`, `user_id` (any creator role), `read_at`, `created_at`

#### `notifications`

- `message_key = chefInstruction`, `chef_instruction_id` FK (nullable), `rapport_id` null
- Hub badge for this channel is **`unread_chef_instructions`**: office via recipient `read_at`; Wali via unread `chefInstruction` notification rows. **Not** the general office `unread_notifications` counter and **not** `unread_instructions` (Wali channel).
- Office `unread_notifications` **and** `GET /cabinet/notifications` **exclude** `chefInstruction` (same as `waliInstruction` / broadcast keys).
- Marking a notification read (`PATCH /cabinet/notifications/:id/read`) also sets the matching Chef-instruction recipient `read_at` when present. Wali open of detail marks matching `chefInstruction` notifications read.

### Workflows

1. Chef composes title/body, optional uploads, selects recipients → create.
   - Bulk flags (combinable): `all_office` | `all_daira` | `all_commune` | `all_direction` | `all_wali` + optional `recipient_ids`.
   - Defaults: `all_office` + `all_wali` on; other role bulks off.
2. System inserts recipient rows + notifications (`chefInstruction`) for selected creators **and** Wali when `all_wali` / individual Wali selected.
3. Creator / Wali / Chef open from the list **modal** → recipient marks read + notification read; Wali marks notification read (also when browsing without recipient row).
4. Wali browses full list of **all** Chef instructions (`/governor/chef-instructions`), with notifs + unread badge.

### API endpoints

| Method | Path | Role |
| ------ | ---- | ---- |
| `POST` | `/chief/chef-instructions` | Chef create (multipart or JSON + file ids) |
| `GET` | `/chief/chef-instructions` | Chef list (pagination) |
| `GET` | `/chief/chef-instructions/:id` | Chef detail + recipients |
| `DELETE` | `/chief/chef-instructions/:id` | Chef delete (cascade recipients + notifications) |
| `GET` | `/cabinet/chef-instructions` | Creator: my Chef instructions |
| `GET` | `/cabinet/chef-instructions/:id` | Creator detail + mark read |
| `GET` | `/governor/chef-instructions` | Wali read-only all |
| `GET` | `/governor/chef-instructions/:id` | Wali detail |

### UI/UX

- Create form `title_fr` / `body_fr` inputs respect `ENABLE_FR_VALUE_INPUTS` — see `spec/CORE.md` § Bilingual content fields.
- Chef hub tile **تعليمات رئيس الديوان** → create form (title, description, files, **role bulk checkboxes** including **كل حسابات الوالي** + recipient multi-select). Defaults: ملحقو الديوان + الوالي.
- Creators: separate section **تعليمات رئيس الديوان** (not mixed with Wali instructions or rapport feedback); hub uses `unread_chef_instructions` only for this channel.
- Wali: read-only cards; no create/delete.
- **All roles** open cards in an **in-page modal** (same pattern as Wali instructions). Detail routes `/:id` redirect to the list and auto-open that modal.
- Cards are **compact** (title + date/meta; short one-line preview).
- **Chef delete:** confirm from the open modal only; hard-deletes instruction + related notifications.
- Attachment open/download: `url_path` + signed `?dl=` — never rely on a bare `file.url` without signing (`AUTH.md`).
- Zod client + server on create.

### Audit events

| Action type | When |
| ----------- | ---- |
| `CHEF_INSTRUCTION_CREATE` | Create |
| `CHEF_INSTRUCTION_READ` | Recipient/Wali opens |
| `CHEF_INSTRUCTION_DELETE` | Chef deletes instruction (+ related notifs) |

### Migration notes

- Distinct from `wali_instructions` and `wali_broadcasts`; do not merge UIs.
- Soft-delete user cleanup clears Chef-instruction recipient rows (parity with Wali).
