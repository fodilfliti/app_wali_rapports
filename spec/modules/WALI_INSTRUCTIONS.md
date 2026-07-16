## Module: Wali instructions (تعليمات السيد الوالي)

### Purpose & constraints

Wali sends operational instructions to all or selected office users: title, description, optional file attachments. Separate from file broadcasts (`wali_broadcasts`) and from rapport feedback notifications.

### Roles & rules

- **WALI**: create + list/detail own/all instructions (`/wali/instructions`).
- **OFFICE_USER**: list/detail instructions addressed to them; separate hub section + notifs.
- **CHEF_CABINET**: read-only list/detail of **all** instructions (not in recipient picker).
- **ADMIN**: may read via support routes.

### Data model

#### `wali_instructions`

- `id`, `title_ar`, `title_fr`, `body_ar`, `body_fr`, `created_by_user_id`, `created_at`, `updated_at`

#### `wali_instruction_files`

- `id`, `instruction_id`, `uploaded_file_id`, `sort_order`

#### `wali_instruction_recipients`

- `id`, `instruction_id`, `user_id` (OFFICE_USER), `read_at`, `created_at`

#### `notifications`

- `message_key = waliInstruction`, `instruction_id` FK (nullable), `rapport_id` null
- Hub badge for this channel is **`unread_instructions`** (recipient `read_at`), **not** the general office `unread_notifications` counter.
- Office `unread_notifications` **and** `GET /office/notifications` **exclude** `waliInstruction` (and broadcast keys) so Instructions / Shared tiles are not double-counted on the Notifications tile or header bell.
- Marking a notification read (`PATCH /office/notifications/:id/read`) also sets the matching instruction/broadcast recipient `read_at` when present.

### Workflows

1. Wali composes title/body, optional uploads, selects all office users or subset → create.
2. System inserts recipient rows + notifications.
3. Office / Chef / Wali open instruction from the list **modal** → office marks recipient + notification read.
4. Chef browses full list without recipient membership.

### API endpoints

| Method | Path | Role |
| ------ | ---- | ---- |
| `POST` | `/wali/instructions` | Wali create (multipart or JSON + file ids) |
| `GET` | `/wali/instructions` | Wali list (pagination) |
| `GET` | `/wali/instructions/:id` | Wali detail + recipients |
| `GET` | `/office/instructions` | Office: my instructions |
| `GET` | `/office/instructions/:id` | Office detail + mark read |
| `GET` | `/chef/instructions` | Chef read-only all |
| `GET` | `/chef/instructions/:id` | Chef detail |

### UI/UX

- Wali hub tile **تعليمات** → create form (title, description, files, recipient multi-select).
- Office: separate section **تعليمات السيد الوالي** (not mixed into rapport feedback list); hub + header use `unread_instructions` only for this channel.
- **All roles (office / wali / chef)** open instruction cards in an **in-page modal** (title, body, attachments; wali also shows recipients). Detail routes `/:id` redirect to the list and auto-open that modal.
- Office `GET /office/instructions/:id` still marks recipient read when the modal loads.
- Chef: same cards, no create button.
- Zod client + server on create.

### Audit events

| Action type | When |
| ----------- | ---- |
| `WALI_INSTRUCTION_CREATE` | Create |
| `WALI_INSTRUCTION_READ` | Recipient/Chef opens |

### Migration notes

- Distinct from `wali_broadcasts`; do not merge UIs.
