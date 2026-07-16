# Wali Rapports

Spec-driven platform for Wilaya office rapports → Wali review.

## Structure

- `spec/` — canonical specifications
- `backend/` — Express + Sequelize (port 4001)
- `frontend/` — React + Vite (port 5174)
- `DEPLOY.md` — production on DZSecurity cPanel (File Manager + Node.js App)
- `scripts/package-deploy.ps1` — build + zip only uploadable packages → `deploy-out/`

## Quick start

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run dev
```

Seed admin: `admin` / `12345678`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5174

## Roles

| Internal | UI label |
| -------- | -------- |
| ADMIN | compte admin |
| OFFICE_USER | compte bureau |
| WALI | compte wali |

Communes are reference data only (no commune login accounts).
