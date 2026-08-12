# Deploy — DZSecurity cPanel (Wali Rapports)

Hosting: **DZSecurity** ([dzsecurity.com](https://www.dzsecurity.com/ar/)) → **cPanel** + **Setup Node.js App** (Passenger / LiteSpeed).

Last known production target:

| Item     | Value                                       |
| -------- | ------------------------------------------- |
| Domain   | `https://cabinet.wilaya-tlemcen.dz`         |
| Frontend | SPA files in `public_html/`                 |
| Backend  | Node app in `~/wali-api/` mounted at `/api` |
| Files    | `~/wali-storage/` (uploads, exports, PDF)   |
| DB       | PostgreSQL on cPanel (Unix socket)          |

Env templates (do not commit real secrets):

- Backend: `backend/.env.production.example` → server file `~/wali-api/.env`
- Frontend: `frontend/.env.production.example` → local build only (baked into `dist/`)

---

## Package for upload (ask Auto or run locally)

When you say **“package deploy”** (or similar), build + zip **only** what File Manager needs.

```bash
npm run deploy
```

Same as:

```powershell
.\scripts\package-deploy.ps1
```

Output in `deploy-out/` (gitignored):

| Zip                             | Upload to                       | Contains                                                                                                                                         | Never included (keep your server copies)                                         |
| ------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `wali-frontend-public_html.zip` | extract **into** `public_html/` | `dist/` assets only                                                                                                                              | `.htaccess`, env, `src/`, `node_modules`                                         |
| `wali-api.zip`                  | extract **into** `~/wali-api/`  | `src/`, `config/`, `package*.json`, `.sequelizerc`, **`shared/*/dist`**, prod scripts (`seed-prod-ensure`, inventory, `lib/ensureSuperAdmin`, …) | `.env`, env examples, **demo/dev/test** seed scripts, `node_modules`, `storage/` |

After upload:

1. Frontend: unzip into `public_html` — your existing `.htaccess` is left alone.
2. Backend: unzip into `wali-api` — your existing `.env` is left alone → cPanel **Run NPM Install** → **Restart** → `npm run db:migrate` if new migrations (under `src/db/migrations`, not `scripts/`).
3. Confirm `~/wali-api/shared/access-policy/dist/index.js` and `~/wali-api/shared/routes/dist/index.js` exist after unzip (bundled by `package-deploy.ps1`).
4. Confirm prod ensure helpers exist: `~/wali-api/scripts/seed-prod-ensure.js`, `scripts/data/prodBootstrapInventory.js`, `scripts/lib/ensureSuperAdmin.js`, `scripts/lib/prodCabinetUsers.js`.

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
    ├── uploads/              ← final files after magic-byte + ClamAV scan
    │   └── temp/             ← multer staging only (never served via /files)
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
- Prod cabinet scripts (from zip or full API copy): `scripts/seed-prod-ensure.js`, `scripts/seed-prod-bootstrap.js`, `scripts/data/prodBootstrapInventory.js`, `scripts/lib/prodCabinetUsers.js`, `scripts/lib/ensureSuperAdmin.js`, `scripts/load-env.js`, `scripts/ensure-fiche-lecture-types.js`, `scripts/ensure-super-admin.js`

**Not** uploaded by `package-deploy.ps1`: demo/dev/test helpers (`seed-demo*`, `seed-dev`, `seed-test-fixtures`, `seedCabinetHeroes`, …). If you replace the **whole** `~/wali-api/` tree from a local backend copy, keep those out of production or leave them unused — never run demo/test seeds on prod.

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

| Command                                           | Safe on prod?                | Notes                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:migrate`                              | Yes                          | Schema only — run when new migrations ship                                                                                                                                                                                                                                                   |
| `npm run db:seed-dev`                             | Yes (once / as needed)       | Does **not** wipe data; inserts dairas/municipalities if empty; creates/updates admin                                                                                                                                                                                                        |
| `npm run db:seed-test`                            | **No**                       | `DELETE FROM` services, rapports, versions, notifications, broadcasts, etc.                                                                                                                                                                                                                  |
| `npm run db:seed-demo`                            | **No**                       | Same wipe as test seed, plus deletes **departments**                                                                                                                                                                                                                                         |
| `npm run db:seed-prod-bootstrap`                  | **Once only** (after backup) | Wipes **office/wali/chef data** (rapports incl. fiche docs, other schemas, non-admin users, services…) then loads cabinet + **fiche_lecture type per leaf**. **Keeps** guide videos (+ files), ADMIN, org reference.                                                                         |
| `npm run db:seed-prod-ensure`                     | **Safe ongoing**             | Adds missing users/services/grants from the same inventory; never deletes or resets passwords. Plain `npm run …` (passes `--confirm`). New passwords only in `credentials-added-*.xlsx` / printable `credentials-added-*.pdf` (1 page/user). Also ensures fiche_lecture on inventory leaves. |
| `npm run db:ensure-fiche-lecture`                 | **Safe**                     | Creates missing `fiche_lecture` types on all leaf services only. No wipe, no users.                                                                                                                                                                                                          |
| `npm run db:seed-demo-cabinet`                    | **Dev only**                 | Fills cabinet bootstrap services with presentation data; refuses when `NODE_ENV=production`                                                                                                                                                                                                  |
| `npm run db:migrate:undo` / `db:migrate:undo:all` | **No**                       | Rolls back migrations; can drop tables / remove seed rows                                                                                                                                                                                                                                    |

**Prod rule:** migrate (+ optionally `seed-dev` once). Never `seed-test`, `seed-demo`, or migrate undo. For the **one-time** production structure reset: backup DB, then `npm run db:seed-prod-bootstrap` once (keeps guide videos; wipes office/wali/chef data including schemas) — credentials under **`backend/private/bootstrap/`** (outside `FILE_STORAGE_ROOT`; never served via `/files`). For later people/services: deploy updated API (inventory + ensure scripts), then `npm run db:seed-prod-ensure` (no wipe). If credential sheets were ever under `storage/bootstrap/`, run `npm run security:rotate-bootstrap-passwords` once (quarantines sheets + rotates those users’ passwords into a new private Excel).

#### Add cabinet users / services (safe) — after API upload

Do **not** upload only `prodBootstrapInventory.js` if the server is missing helpers — `seed-prod-ensure` will crash with `Cannot find module './lib/ensureSuperAdmin'`.

1. Deploy the **full** API package (or replace `~/wali-api/` while **keeping** `.env` and `node_modules` / re-run NPM Install). Prefer `wali-api.zip` from `package-deploy.ps1`, or sync backend including the prod script whitelist above.
2. Keep server `.env` (do not overwrite).
3. **Restart** Node.js App.
4. If new migrations: `cd ~/wali-api && npm run db:migrate`
5. Add missing people/services from inventory:

   ```bash
   cd ~/wali-api
   npm run db:seed-prod-ensure
   ```

6. Download / print only `~/wali-api/private/bootstrap/credentials-added-*.pdf` (and `.xlsx` for ops). Existing users keep their passwords.

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

1. Upload / unzip into `~/wali-api/` (**keep** `.env`). Full-folder replace is fine if you preserve `.env` (and preferably re-run NPM Install after a clean tree).
2. If `package.json` changed: **Run NPM Install** again.
3. If migrations added:

   ```bash
   cd ~/wali-api && npm run db:migrate
   ```

4. If `prodBootstrapInventory.js` (or ensure scripts) changed — add missing users/services:

   ```bash
   cd ~/wali-api && npm run db:seed-prod-ensure
   ```

5. **Restart** Node.js App in cPanel.
6. Smoke test: `https://YOUR_DOMAIN/api/health`

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

| Check                                     | Expected                             |
| ----------------------------------------- | ------------------------------------ |
| `GET /api/health`                         | OK / healthy JSON                    |
| Open site root                            | Login page (Arabic RTL)              |
| Login with seeded admin                   | Dashboard                            |
| Upload a file in a rapport                | File under `~/wali-storage/uploads/` (not `uploads/temp/`) after ClamAV OK |
| Hard refresh deep link e.g. `/office/...` | Still SPA (`.htaccess` works)        |

---

## Common failures

| Symptom                                | Likely cause                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Site loads, API 404                    | Node app URL not set to `/api`, or app not started                                                      |
| `database_connection_failed` in stderr | Wrong `DATABASE_URL` / socket; fix `PGSOCKETDIR`                                                        |
| CORS errors                            | `CORS_ORIGIN` must match exact site origin (`https://…`)                                                |
| Blank page on refresh of a route       | Missing SPA `.htaccess`                                                                                 |
| Uploads fail                           | `FILE_STORAGE_ROOT` missing/not writable; ClamAV missing (`clamdscan`/`clamscan`); type mismatch |
| Upload fails at ~50–100 MB             | LiteSpeed/proxy **max request body** smaller than app limit — ask host or reduce video size client-side |
| Upload timeout on slow mobile          | Node/proxy idle timeout — prefer client compression; retry once (built into frontend)                   |
| Migrate works but app has no env       | Env only in `.env` — also set in Node.js App UI                                                         |

---

## Upload hosting checks (one-time)

Large uploads (guide videos up to 100 MB) can fail **before Node** if the reverse proxy rejects the body size or times out.

| Check                   | Action                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Proxy max body          | If uploads fail with 413/502 and nothing in Node logs, ask DZSecurity to raise LiteSpeed `max_request_body` (or equivalent) above 100 MB |
| Disk quota              | Monitor `~/wali-storage/uploads/` growth                                                                                                 |
| Node timeout            | If uploads stall then fail, increase app/proxy read timeout for `/api`                                                                   |
| Server tools (optional) | SSH/cPanel terminal — see if native helpers exist before enabling server-side transcode                                                  |

```bash
cd ~/wali-api
# sharp (image processing) — optional future server-side normalize
npm ls sharp 2>/dev/null || npm i sharp --no-save && node -e "require('sharp'); console.log('sharp ok')"

# ffmpeg (video transcode) — often unavailable on shared hosting
which ffmpeg; ffmpeg -version
```

Backend logs upload metrics at `info` when complete: `{ upload: { media_kind, size_bytes, duration_ms } }` — use for before/after tuning.

Client-side: images are compressed in-browser before POST; optional video re-encode via `ENABLE_CLIENT_VIDEO_TRANSCODE` in frontend build (`frontend/src/config/features.ts`, default `false`).
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
5. **New cabinet people:** deploy full API (incl. `scripts/lib/ensureSuperAdmin.js` + inventory) → `npm run db:seed-prod-ensure` → hand out `credentials-added-*.pdf`.
