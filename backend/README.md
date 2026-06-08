# Wali Rapports — Backend

Node.js + Express + PostgreSQL (Sequelize).

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL`, `JWT_SECRET`.
2. Create database: `createdb wali_rapports` (or via pgAdmin).
3. `npm install`
4. `npm run db:migrate`
5. `npm run dev`

Default seed admin: **username** `admin`, **password** `12345678`

API runs on port **4001** by default.
