# Deploy — DZSecurity cPanel (Wali Rapports)

Hosting: **DZSecurity** ([dzsecurity.com](https://www.dzsecurity.com/ar/)) → **cPanel** + **Setup Node.js App** (Passenger / LiteSpeed).

Last known production target:

| Item | Value |
| ---- | ----- |
| Domain | `https://cabinet.wilaya-tlemcen.dz` |
| Frontend | SPA files in `public_html/` |
| Backend | Node app in `~/wali-api/` mounted at `/api` |
| Files | `~/wali-storage/` (uploads, exports, PDF) |
| DB | PostgreSQL on cPanel (Unix socket) |

Env templates (do not commit real secrets):

- Backend: `backend/.env.production.example` → server file `~/wali-api/.env`
- Frontend: `frontend/.env.production.example` → local build only (baked into `dist/`)

---

## Package for upload (ask Auto or run locally)

When you say **“package deploy”** (or similar), build + zip **only** what File Manager needs.

```powershell
.\scripts\package-deploy.ps1
```

Output in `deploy-out/` (gitignored):

| Zip | Upload to | Contains | Never included (keep your server copies) |
| --- | --------- | -------- | ---------------------------------------- |
| `wali-frontend-public_html.zip` | extract **into** `public_html/` | `dist/` assets only | `.htaccess`, env, `src/`, `node_modules` |
| `wali-api.zip` | extract **into** `~/wali-api/` | `src/`, `config/`, `package*.json`, `.sequelizerc` | `.env`, env examples, `scripts/` (seeds/tests), `node_modules`, `storage/` |

After upload:

1. Frontend: unzip into `public_html` — your existing `.htaccess` is left alone.
2. Backend: unzip into `wali-api` — your existing `.env` is left alone → cPanel **Run NPM Install** → **Restart** → `npm run db:migrate` if new migrations (under `src/db/migrations`, not `scripts/`).

`deploy/public_html.htaccess` is a first-version **reference only** — never upload it over the cPanel `.htaccess`.

---

## Server layout (File Manager)

```
/home/<CPANEL_USER>/
├── public_html/              ← frontend build (index.html, assets/…)
│   └── .htaccess             ← SPA fallback (see below)
├── wali-api/                 ← backend source + node_modules
│   ├── .env                  ← production secrets (from .env.production.example)
│   ├── package.json
│   ├── src/
│   └── …
└── wali-storage/             ← FILE_STORAGE_ROOT (outside public_html)
    ├── uploads/
    ├── exports/
    └── pdf/
```

**Rules**

- Never put `.env`, `node_modules` source of truth, or `wali-storage` inside `public_html`.
- Frontend is **static** only: build on your PC, upload `dist/` contents.
- Backend runs via **cPanel → Setup Node.js App**, not by opening `server.js` in the browser.

---

## One-time setup

### 1. PostgreSQL (cPanel → PostgreSQL Databases)

1. Create database + user; grant ALL on that DB.
2. Note credentials for `DATABASE_URL`.
3. On DZSecurity shared hosting, prefer **Unix socket**:

```env
DATABASE_URL=postgres://DB_USER:PASSWORD@localhost:5432/DB_NAME?host=/var/run/postgresql
PGSOCKETDIR=/var/run/postgresql
```

If socket fails, try TCP: `PGHOST=127.0.0.1` (and drop `PGSOCKETDIR` / `?host=`).

### 2. Folders

In File Manager (or SSH):

```bash
mkdir -p ~/wali-api ~/wali-storage/{uploads,exports,pdf}
```

### 3. Backend files

Upload the **backend** project into `~/wali-api/` (or git clone via SSH).

Required on server:

- `package.json` / `package-lock.json`
- `src/` (includes migrations)
- `config/`
- `.sequelizerc`
- `.env` (create once on server; **never** overwrite from a zip)

Not uploaded on redeploy: `backend/scripts/` (seed-dev / demo / test helpers — local only).

### 4. Setup Node.js App (cPanel)

1. **Create Application**
   - Application root: `wali-api` (path under home)
   - Application URL: your domain + path **`/api`** (so health is `https://YOUR_DOMAIN/api/health`)
   - Application startup file: `src/server.js`
   - Node version: **18+** (match local if possible)
2. Click **Run NPM Install** (or SSH: `cd ~/wali-api && npm ci --omit=dev`).
3. Put the **same** env vars in:
   - file `~/wali-api/.env` (migrate/seed scripts read this), **and**
   - Setup Node.js App → **Environment variables** (Passenger often ignores `.env` for the running process — keep both in sync).

Minimum production env (see example file for full list):

```env
NODE_ENV=production
PORT=4001
API_BASE_PATH=/api
DATABASE_URL=postgres://…?host=/var/run/postgresql
PGSOCKETDIR=/var/run/postgresql
JWT_SECRET=<at least 32 characters>
FILE_STORAGE_ROOT=/home/<CPANEL_USER>/wali-storage
CORS_ORIGIN=https://cabinet.wilaya-tlemcen.dz
LOG_LEVEL=info
TRUST_PROXY=true
# Device notifications (Web Push) — generate once with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
VAPID_SUBJECT=mailto:admin@cabinet.wilaya-tlemcen.dz
```

Keep the VAPID key pair stable across deploys (rotating it forces every user to re-subscribe). If unset, in-app notifications still work; browser/phone toasts are skipped.

The API already supports Passenger (`PhusionPassenger` in `backend/src/server.js`).

### 5. Database migrate + first admin

Via cPanel Terminal / SSH (preferred):

```bash
cd ~/wali-api
npm run db:migrate
npm run db:seed-dev
```

`seed-dev` creates the admin from `DEV_ADMIN_*` in `.env`. Change the password after first login.

#### DB scripts — production safety

| Command | Safe on prod? | Notes |
| ------- | ------------- | ----- |
| `npm run db:migrate` | Yes | Schema only — run when new migrations ship |
| `npm run db:seed-dev` | Yes (once / as needed) | Does **not** wipe data; inserts dairas/municipalities if empty; creates/updates admin |
| `npm run db:seed-test` | **No** | `DELETE FROM` services, rapports, versions, notifications, broadcasts, etc. |
| `npm run db:seed-demo` | **No** | Same wipe as test seed, plus deletes **departments** |
| `npm run db:seed-prod-bootstrap` | **Once only** (after backup) | Wipes domain data + loads cabinet users and **root leaf** services from `spec/data/PROD_BOOTSTRAP.md` (no person folders); requires `CONFIRM_PROD_BOOTSTRAP=YES`. Temporary — do not re-run after the initial reset. |
| `npm run db:seed-prod-ensure` | **Safe ongoing** | Adds missing users/services/grants from the same inventory; never deletes or resets passwords; requires `CONFIRM_PROD_ENSURE=YES`. New passwords only in `credentials-added-*.xlsx`. |
| `npm run db:seed-demo-cabinet` | **Dev only** | Fills cabinet bootstrap services with presentation data; refuses when `NODE_ENV=production` |
| `npm run db:migrate:undo` / `db:migrate:undo:all` | **No** | Rolls back migrations; can drop tables / remove seed rows |

**Prod rule:** migrate (+ optionally `seed-dev` once). Never `seed-test`, `seed-demo`, or migrate undo. For the **one-time** production structure reset: backup DB, then `CONFIRM_PROD_BOOTSTRAP=YES npm run db:seed-prod-bootstrap` once — credentials under `storage/bootstrap/`. For later people/services: edit inventory, then `CONFIRM_PROD_ENSURE=YES npm run db:seed-prod-ensure` (no wipe).

### 6. Frontend build (on your PC)

```bash
cd frontend
cp .env.production.example .env.production
# Edit if domain differs; keep VITE_API_URL=/api for same-origin
npm ci
npm run build
```

Upload **contents** of `frontend/dist/` into `public_html/` (not the `dist` folder itself).

### 7. SPA `.htaccess` in `public_html`

Managed **once** on cPanel (you already customized it). Redeploy zips **never** include `.htaccess`, so File Manager updates won’t wipe your rules.

First-time only: ensure React Router fallback + leave `/api` alone (see commented example in `deploy/public_html.htaccess`).

---

## Update / redeploy checklist

### Backend change

1. Upload changed files under `~/wali-api/` (or `git pull`).
2. If `package.json` changed: **Run NPM Install** again.
3. If migrations added:

   ```bash
   cd ~/wali-api && npm run db:migrate
   ```

4. **Restart** Node.js App in cPanel.
5. Smoke test: `https://YOUR_DOMAIN/api/health`

### Frontend change

1. Locally: `npm run build` (or ask Auto: **package deploy**).
2. Upload / unzip frontend package into `public_html/` (does not touch `.htaccess`).
3. Hard-refresh the browser (cache).

### Env / secrets change

1. Edit `~/wali-api/.env` **on the server only** (never from a zip).
2. Mirror the same keys in Setup Node.js App → Environment variables.
3. Restart the Node app.

---

## How traffic is split

```
Browser → https://cabinet.wilaya-tlemcen.dz/
            ├── /*           → public_html (static SPA)
            └── /api/*       → Node.js App (wali-api / Passenger)
                  ├── /api/health
                  ├── /api/auth/...
                  ├── /api/admin|office|wali|chef/...
                  └── /api/files/...
```

Frontend uses relative `VITE_API_URL=/api` so API calls stay same-origin (no CORS pain).

---

## Verify after deploy

| Check | Expected |
| ----- | -------- |
| `GET /api/health` | OK / healthy JSON |
| Open site root | Login page (Arabic RTL) |
| Login with seeded admin | Dashboard |
| Upload a file in a rapport | File under `~/wali-storage/uploads/` |
| Hard refresh deep link e.g. `/office/...` | Still SPA (`.htaccess` works) |

---

## Common failures

| Symptom | Likely cause |
| ------- | ------------ |
| Site loads, API 404 | Node app URL not set to `/api`, or app not started |
| `database_connection_failed` in stderr | Wrong `DATABASE_URL` / socket; fix `PGSOCKETDIR` |
| CORS errors | `CORS_ORIGIN` must match exact site origin (`https://…`) |
| Blank page on refresh of a route | Missing SPA `.htaccess` |
| Uploads fail | `FILE_STORAGE_ROOT` missing or not writable |
| Migrate works but app has no env | Env only in `.env` — also set in Node.js App UI |
| Old frontend after upload | Browser cache; confirm `assets/` hashes changed |

---

## What not to do

- Do not run `npm run dev` on the server.
- Do not commit real `.env` or passwords to git.
- Do not leave default `DEV_ADMIN_PASSWORD` after go-live.
- Do not expose `wali-storage` or `wali-api` under a public URL folder.
- Do not run `db:seed-test`, `db:seed-demo`, or `db:migrate:undo` / `db:migrate:undo:all` on production — they delete or drop data.

---

## Quick “I forgot last time” summary

1. **cPanel File Manager**: frontend → `public_html`, API → `wali-api`, files → `wali-storage`.
2. **Setup Node.js App** on `/api` → startup `src/server.js` → env + restart.
3. **Postgres** + `npm run db:migrate` (+ seed once).
4. **Build frontend** locally with `VITE_API_URL=/api` → upload `dist/` only (never overwrite cPanel `.htaccess` / `.env`).
