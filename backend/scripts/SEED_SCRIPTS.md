# Seed / bootstrap scripts — post-UUID hardening

Use these only after migrations (`000032`–`000034`). Prefer **prod ensure** over wipe scripts on real data.

## Safe (identity + letterhead aligned)

| Script | npm | Notes |
|--------|-----|--------|
| `seed-dev.js` | `npm run seed` / `db:seed-dev` | Dairas/communes/admin; **uuid** on bulkCreate |
| `seed-prod-ensure.js` | `db:seed-prod-ensure` | Additive users/services/fiche types only |
| `ensure-fiche-lecture-types.js` | `db:ensure-fiche-lecture` | Missing fiche types only |
| `ensure-super-admin.js` | `db:ensure-super-admin` | Admin account |
| Shared | `scripts/lib/seedIdentity.js` | Stamps `uuid` + `*_uuid` FKs on rapport/version/notification/file |
| Shared | `documentDefaults.js` + `demoPresentationData.js` | Official letterhead in rich_html |

## Wipe / heavy demo (DEV)

| Script | npm | Notes |
|--------|-----|--------|
| `seed-test-fixtures.js` | `db:seed-test` / `seed:test` | Clears rapport domain; UUID FKs + letterhead |
| `seed-demo-cabinet.js` | `db:seed-demo-cabinet` | DEV only; heroes + light fill |
| `seed-demo-presentation.js` | `db:seed-demo` | Full wipe of demo domain |
| `seed-prod-bootstrap.js` | `db:seed-prod-bootstrap` | **Destructive** — confirm flag; prod inventory |

## Do not use for wrong-shaped data

- Re-run **old** seed copies from before UUID expand without `seedIdentity` — they leave null `*_uuid` and empty document HTML.
- `bulkCreate` without `uuid` fails or inserts incomplete rows (uuid NOT NULL).

## After reseed

Restart API (`npm run dev`). Log in with handout credentials / test users. Check a fiche opens with letterhead and URLs use public UUIDs.
