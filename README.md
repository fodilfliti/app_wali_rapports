# Wali Rapports

Digital platform for the **Wilaya governor’s office (cabinet du Wali)** to create, version, review, and export official **rapports / états** — replacing fragmented Excel and Word workflows.

Production: [cabinet.wilaya-tlemcen.dz](https://cabinet.wilaya-tlemcen.dz)

## What it does

- **Attachés de cabinet** draft tables, rich documents, fiches, and commune/daira/direction lists under granted **domaines de suivi**
- **Chef de cabinet** validates first submissions before they reach the Wali
- **Wali** reviews by office user → domain tree, leaves decisions, shares files, sends instructions
- **Admin** manages users, reference data (communes / dairas / directions), services, schemas, and access grants
- Full **version history**, **PDF / Word / Excel export**, **discussion threads**, **Web Push** notifications, bilingual **AR (RTL) / FR** UI

## Stack

| Layer | Tech |
| ----- | ---- |
| Frontend | React 19, Vite, TypeScript, TanStack Query, TipTap, i18next, Zod |
| Backend | Node.js, Express, Sequelize, PostgreSQL |
| Auth | Short-lived JWT + httpOnly refresh cookie, role checks, blocked-user gate |
| Specs | Spec-first docs under `spec/` (`SYSTEM_SPEC.md` is the index) |

## Repository layout

```
spec/                 Canonical product & technical specs
backend/              Express API (default port 4001)
frontend/             React SPA (default port 5174)
DEPLOY.md             Production deploy on DZSecurity cPanel
scripts/              package-deploy.ps1 and helpers
```

## Roles (never show raw enums in UI)

| Code | UI |
| ---- | -- |
| `ADMIN` | Compte admin |
| `OFFICE_USER` | ملحق بالديوان / Attaché de cabinet |
| `CHEF_CABINET` | رئيس الديوان |
| `WALI` | Compte wali |

Communes, dairas, and directions are **reference data only** (no login accounts).

## Local development

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Default seed admin (dev): `admin` / `12345678` — change in production.

### Frontend

```bash
cd frontend
cp .env.example .env   # if present; see .env.production.example for build
npm install
npm run dev
```

Open http://localhost:5174

## Deploy (production packages)

Build uploadable zips (does **not** overwrite server `.env` or `.htaccess`):

```powershell
.\scripts\package-deploy.ps1
```

Output in `deploy-out/` (gitignored):

| Zip | Extract into |
| --- | ------------ |
| `wali-frontend-public_html.zip` | `public_html/` |
| `wali-api.zip` | `~/wali-api/` |

Then on the server: **Run NPM Install** → **Restart** Node app → `npm run db:migrate` if there are new migrations.

Full steps: **[DEPLOY.md](DEPLOY.md)**.

## Documentation for recruiters / portfolio

See **[docs/PORTFOLIO_AND_CV.md](docs/PORTFOLIO_AND_CV.md)** for ready-to-use CV bullets, LinkedIn/post copy, and talking points (English + French + Arabic).

## License / ownership

Internal government / Wilaya cabinet project — not an open-source product unless otherwise stated by the owner.
