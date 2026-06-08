# Local development setup

## 1. Install PostgreSQL

Install **PostgreSQL 14+** on Windows (installer from [postgresql.org](https://www.postgresql.org/download/windows/) or via Chocolatey: `choco install postgresql`).

During install, note the **postgres user password** you choose.

## 2. Create the database

Open **psql** or pgAdmin and run:

```sql
CREATE DATABASE wali_rapports
  ENCODING 'UTF8'
  LC_COLLATE 'French_France.1252'
  LC_CTYPE 'French_France.1252'
  TEMPLATE template0;
```

Or from PowerShell (replace `YOUR_PASSWORD`):

```powershell
$env:PGPASSWORD = "YOUR_PASSWORD"
psql -U postgres -h localhost -c "CREATE DATABASE wali_rapports;"
```

## 3. Configure `backend/.env`

Copy the example and set your Postgres password in `DATABASE_URL`:

```powershell
cd app_wali_rapports\backend
copy .env.example .env
```

Edit `.env` — at minimum:

| Variable | Purpose |
| -------- | ------- |
| `DATABASE_URL` | `postgres://postgres:YOUR_PASSWORD@localhost:5432/wali_rapports` |
| `JWT_SECRET` | Any random string, at least 32 characters |
| `DEV_ADMIN_USERNAME` | Login username (default `admin`) |
| `DEV_ADMIN_EMAIL` | Stored on admin account (reference only for login) |
| `DEV_ADMIN_PASSWORD` | Login password — **saved here so you don't forget** |

Login uses **username + password** (not email).

## 4. Install dependencies & migrate

```powershell
cd app_wali_rapports\backend
npm install
npm run db:migrate
npm run db:seed-dev
```

`db:migrate` creates all tables and demo services/schemas.

`db:seed-dev`:
- Inserts **53 communes** of Wilaya Tlemcen (codes 1301–1353) if the table is empty
- Creates/updates the **admin** account from `DEV_ADMIN_*` in `.env` with full access (`ADMIN_FULL`)

## 5. Start backend & frontend

```powershell
# Terminal 1 — backend (port 4001)
cd app_wali_rapports\backend
npm run dev

# Terminal 2 — frontend (port 5174)
cd app_wali_rapports\frontend
npm install
npm run dev
```

Open http://localhost:5174 and log in with the credentials from `.env`:

```
username: admin          (or DEV_ADMIN_USERNAME)
password: Admin123!      (or DEV_ADMIN_PASSWORD)
```

## Troubleshooting

**`password authentication failed for user "postgres"`**  
Wrong password in `DATABASE_URL`. Reset Postgres password or update `.env` to match.

**`database "wali_rapports" does not exist`**  
Run step 2 to create the database.

**Re-sync admin password after changing `.env`**  
```powershell
npm run db:seed-dev
```

**Reset database completely**  
```powershell
npm run db:migrate:undo:all
npm run db:migrate
npm run db:seed-dev
```
