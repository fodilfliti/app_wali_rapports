## Module: Authentication & sessions

### Purpose

Login, short-lived access JWTs, and long-lived refresh sessions so users stay signed in for up to **one week** without weakening security.

### Token model

| Token | Lifetime | Transport | Storage |
| ----- | -------- | --------- | ------- |
| **Access JWT** | **15 minutes** (env `JWT_ACCESS_EXPIRES_IN`, default `15m`) | `Authorization: Bearer` | Frontend memory / React state only — **not** `localStorage` |
| **Refresh** | **7 days absolute** from login (env `REFRESH_TOKEN_EXPIRES_IN`, default `7d`) | HttpOnly cookie `wr_refresh` | Server stores **SHA-256 hash only**; plaintext never logged or returned in JSON |

#### Access JWT

- Algorithm: **HS256** (`JWT_SECRET`, min 32 chars).
- Payload: `{ sub, role, typ: "access" }` plus standard `exp` / `iat`.
- **`sub`** = user’s **public UUID** (see `spec/modules/IDENTITY_UUID.md`); dual-read may still resolve legacy digit ids during transition.
- Required on all protected API routes (`requireAuth` → `attachUser` → `checkBlocked` → hub `requireRole` / `assertCan`).
- **File downloads:** do **not** put the access JWT in query strings. Browser media / links use a **short-lived signed download token** (`?dl=`, separate JWT `typ: file_dl`, ~60s) issued by the API; authenticated XHR may use `Authorization: Bearer`. Frontend: `SignedFileLink` / `useSignedFileUrl`.
- **`GET /files/*` ACL:** path resolved under `FILE_STORAGE_ROOT` with `..` rejection; serve only if the caller may access that object:
  - `bootstrap/**` — **never** served (bootstrap Excels live under `backend/private/bootstrap`, outside the web root).
  - `pdf/credentials_*` — **ADMIN only**.
  - `uploads/*` — uploader, admin, or rapport/service grant (office) / Wali-or-Chef visibility for linked rapports; guide/broadcast/instruction recipients as applicable.
  - other `pdf/` / `exports/` — admin only.
- Dangerous types (`html`/`svg`/`js`/…) rejected on upload; non-inline types use `Content-Disposition: attachment` + `nosniff`.
- Frontend rich HTML: sanitize (DOMPurify); **never persist** access or download tokens inside document HTML (strip on save via `prepareRichHtmlForSave`). Inject signed `?dl=` only at display (`usePreparedRichHtml`) for **both** TipTap edit and read-only view. Other media (attachments, instructions, guides, inbox cards): `SignedFileLink` / `useSignedFileUrl` on `url_path` — never raw `file.url` / JWT query.

#### Refresh cookie

- Opaque random ≥ 32 bytes (hex/base64url).
- Flags: `HttpOnly`, `SameSite=Lax`, `Secure` in production (or when `COOKIE_SECURE=true`), `Path` = `{API_BASE_PATH}/auth` (e.g. `/auth` or `/api/auth`).
- Cookie sent only to auth refresh/logout routes — not on every API call.
- Absolute family expiry: rotations do **not** extend past `family_expires_at` from the original login. After that, user must log in again.

### Endpoints

| Method | Path | Auth | Behavior |
| ------ | ---- | ---- | -------- |
| `POST` | `/auth/login` | Public | Username/password; rate limit 20 / 15 min / IP (skip successes). Issues access JWT + refresh cookie. Response `{ token, user }` (`token` = access JWT). |
| `POST` | `/auth/refresh` | Refresh cookie | Rate limit 30 / 15 min / IP. Rotates refresh token; returns `{ token, user }`. |
| `POST` | `/auth/logout` | Access JWT **or** refresh cookie | Revokes current token family; clears cookie. |
| `GET` | `/auth/me` | Access JWT | Session user (unchanged). |
| `PATCH` | `/auth/me` | Access JWT | Self-update **name** (required) and **job_title** (optional, nullable to clear). Not username/role. Returns `{ user }`. Zod. Audit `USER_SELF_UPDATE`. |
| `POST` | `/auth/change-password` | Access JWT | Self password (الرمز) change. Body: `{ current_code, new_code }` (Zod). Server **must** verify `current_code` against `password_hash` before update; reject with `errorCurrentCodeIncorrect` if wrong. On success: **revokes all** refresh sessions for that user and clears refresh cookie. |

### Rotation & reuse detection

1. Each successful `/auth/refresh` creates a **new** refresh row, marks the old row revoked (`replaced_by_id`), and sets a new cookie.
2. **Concurrent-reuse grace (multi-tab):** If an already-rotated refresh token is presented again within **~10 seconds** of rotation (`revoked_at` set, `replaced_by_id` set, env `REFRESH_REUSE_GRACE_MS` default `10000`), treat as a concurrent tab race — not theft: issue a **new access JWT** for the same user, **do not** rotate again, **do not** `revokeFamily`, **do not** clear or overwrite the cookie (leave the successor cookie from the winning refresh). Family / user must still be valid and unblocked.
3. If a **already-rotated / revoked** refresh is presented **outside** the grace window (or was revoked without a successor, e.g. logout / kill-all) → treat as possible theft: **revoke the entire family**, clear cookie, audit `TOKEN_REUSE_DETECTED`, return **401**.
4. Expired or unknown refresh → **401**, clear cookie.

### Revocation (kill all sessions)

Revoke **all** refresh tokens for the user when:

- Admin **blocks** the user
- Admin **resets** password
- User **changes** their own password

Logout revokes only the **current family** (other devices keep their sessions until absolute expiry or a kill-all event).

Blocked users: login and refresh fail; protected routes still use `checkBlocked`.

### Data model

#### Table `refresh_tokens`

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | BIGINT PK | Internal only (not a public entity id) |
| `user_id` | BIGINT FK → `users` | Cascade delete; join via internal PK. Public user id is UUID — `IDENTITY_UUID.md` |
| `token_hash` | STRING(64) unique | SHA-256 hex of opaque token |
| `family_id` | UUID | Groups rotations from one login |
| `family_expires_at` | DATE | Absolute end of session (≤ 7d from login) |
| `expires_at` | DATE | Same as family absolute expiry for active rows |
| `revoked_at` | DATE nullable | Set on rotate / logout / kill |
| `replaced_by_id` | BIGINT nullable | Next token in rotation chain (internal) |
| `user_agent` | STRING nullable | Optional audit |
| `ip` | STRING nullable | Optional audit |
| `created_at` | DATE | |

### Audit action types

| `action_type` | When |
| ------------- | ---- |
| `LOGIN_ATTEMPT` | Login success/fail (details include `success`, `blocked`) |
| `TOKEN_REFRESH` | Successful refresh (details: `family_id`) |
| `TOKEN_REUSE_DETECTED` | Reuse of rotated/revoked refresh |
| `LOGOUT` | Explicit logout |
| `USER_SELF_UPDATE` | User updates own name / job_title via `PATCH /auth/me` |
| Existing password / block audits | Also trigger session revoke |

### Frontend rules

- **`AuthProvider` / `useAuth()`** — session, `me`, and `can(action)` live here; do **not** prop-drill `token={token}` through routes/pages.
- Access token held in **`frontend/src/auth/session.ts`** (memory); API client reads it from there by default.
- Persist **no** access JWT in `localStorage` / `sessionStorage`.
- On boot: `POST /auth/refresh` with `credentials: 'include'`; if ok, hold access in memory and load UI; else guest login.
- All API `fetch` calls use `credentials: 'include'`.
- On **401** from a protected call: single-flight refresh once, retry; if refresh fails → clear session, show explicit `sessionExpired` message (Arabic/French: session ended — please log in again), and return to the login screen. No device push for this case (user is already in the browser).
- Logout calls `POST /auth/logout` then clears client state.
- **Change own code:** profile menu opens a modal that requires **current code** then **new code** (min 8); never offer a self-change path that skips current-code verification. After success, treat session as ended (force re-login).
- **Multi-tab:** Use `navigator.locks` (`wr-auth-refresh`) so only one tab calls `/auth/refresh` at a time; use `BroadcastChannel('wr-auth')` to share the new access JWT (`{ type: 'access', token }`) and to propagate session expiry (`{ type: 'expired' }`) across tabs. Access JWT remains memory-only per tab (updated via the channel).
- File/media links: `SignedFileLink` / `useSignedFileUrl` → `?dl=` (never `?access_token=`).
- Hub navigation: `paths.hub.*` from `shared/routes` — `ROUTES.md`.

### CORS / deployment

- Cookie auth requires CORS `credentials: true` and an explicit allowed origin when frontend and API are cross-origin.
- Dev Vite proxy (`/auth` → backend) is same-origin; `SameSite=Lax` works without `Secure`.

### Out of scope

- Admin “active sessions” UI
- Remember-me checkbox (every login gets a 7-day refresh family)
- HttpOnly access JWT in cookies (access stays Bearer + memory; file downloads use separate signed `?dl=`)
