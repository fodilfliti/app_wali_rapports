## Module: <NAME>

### Purpose & constraints
- What problem this module solves
- Hard constraints (legal, language, performance, etc.)

### Roles & rules
- **ADMIN**:
  - ...
- **OFFICE_USER**:
  - ...
- **WALI**:
  - ...

### Data model
- **Tables**:
  - `<TableName>`: fields...
- **Relationships**:
  - ...
- **Indexes & constraints**:
  - ...

### Workflows
- Main flows (create, update, submit, respond, etc.)
- If there is a lifecycle, define a **state machine** and allowed transitions

### API endpoints
- **Admin**:
  - `GET ...`
  - `POST ...`
- **Office**:
  - `GET ...`
  - `POST ...`
- **Wali**:
  - `GET ...`
  - `POST ...`
- Define pagination/search params and ordering for list endpoints

### UI/UX
- Navigation entry point(s)
- Screens: List, Details, Create/edit
- **Form validation** (required — see `spec/CORE.md`):
  - Zod schema path and i18n keys
  - Matching server `validateBody` on write endpoints

### Audit events (minimum)
- Stable action types and required `details` payload fields

### Non-functional requirements
- Performance, storage, security

### Migration/compatibility notes
- Interactions with other modules
