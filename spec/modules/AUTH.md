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
- Required on all protected API routes (`requireAuth` → `attachUser` → `checkBlocked` → role/permission).
- File downloads: Bearer or `?access_token=` using the **current access** JWT (short TTL; UI rebuilds URLs when access rotates).

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
| `POST` | `/auth/change-password` | Access JWT | Self password change; **revokes all** refresh sessions for that user. |

### Rotation & reuse detection

1. Each successful `/auth/refresh` creates a **new** refresh row, marks the old row revoked (`replaced_by_id`), and sets a new cookie.
2. If a **already-rotated / revoked** refresh token is presented again → treat as possible theft: **revoke the entire family**, clear cookie, audit `TOKEN_REUSE_DETECTED`, return **401**.
3. Expired or unknown refresh → **401**, clear cookie.

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
| `id` | BIGINT PK | |
| `user_id` | BIGINT FK → `users` | Cascade delete |
| `token_hash` | STRING(64) unique | SHA-256 hex of opaque token |
| `family_id` | UUID | Groups rotations from one login |
| `family_expires_at` | DATE | Absolute end of session (≤ 7d from login) |
| `expires_at` | DATE | Same as family absolute expiry for active rows |
| `revoked_at` | DATE nullable | Set on rotate / logout / kill |
| `replaced_by_id` | BIGINT nullable | Next token in rotation chain |
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

- Persist **no** access JWT in `localStorage` / `sessionStorage`.
- On boot: `POST /auth/refresh` with `credentials: 'include'`; if ok, hold access in memory and load UI; else guest login.
- All API `fetch` calls use `credentials: 'include'`.
- On **401** from a protected call: single-flight refresh once, retry; if refresh fails → clear session and show `sessionExpired`.
- Logout calls `POST /auth/logout` then clears client state.

### CORS / deployment

- Cookie auth requires CORS `credentials: true` and an explicit allowed origin when frontend and API are cross-origin.
- Dev Vite proxy (`/auth` → backend) is same-origin; `SameSite=Lax` works without `Secure`.

### Out of scope

- Admin “active sessions” UI
- Remember-me checkbox (every login gets a 7-day refresh family)
- HttpOnly access JWT (would break `?access_token=` file links without a separate download-token design)
