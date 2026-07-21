# Prod bootstrap inventory (cabinet)

Canonical human-readable list for `npm run db:seed-prod-bootstrap` (wipe once) and `npm run db:seed-prod-ensure` (safe add).  
Machine source: [`backend/scripts/data/prodBootstrapInventory.js`](../../backend/scripts/data/prodBootstrapInventory.js).

## Review accounts

| username | role | name |
| --- | --- | --- |
| `wali` | WALI | والي |
| `chef_cabinet` | CHEF_CABINET | رئيس الديوان |

## Office users

Each person gets **root leaf services** (ملفات) with `parent_service_id: null` and `manage` access — no person-named folders. Each leaf gets a **`fiche_lecture`** type (مذكرة استخلاصية / Fiche lecture); other rapport types are created later in admin UI.

Admin UI folder create is gated by frontend `ENABLE_SERVICE_FOLDERS` (default off) — see `spec/CORE.md`.

### chabira.houssein — شبيرة حسين

مهندس دولة للإدارة الإقليمية في التسيير التقني والحضري

- الموارد المائية
- البريد والمواصلات السلكية واللاسلكية
- الحماية المدنية

### safrou.wafaa — سفرو وفاء

مهندس دولة في التسيير التقني والحضري للجماعات الاقليمية

- التعمير والبناء
- مسح الأراضي والحفظ العقاري

### zaabat.amina — زعباط أمينة

مهندس دولة للإدارة الإقليمية في التسيير التقني والحضري

- الاستثمار
- الصيد البحري و تربية المائيات
- المؤسسات المصنفة
- المؤسسة الولائية لتسيير مراكز الردم التقني
- الوكالة الوطنية لدعم وتنمية المقاولاتية (Nesda)
- الوكالة الوطنية لتسيير القرض المصغر (Angem)
- البنوك
- البلديات الخضراء

### arabia.amira — عربية أميرة

متصرف رئيسي

- السياحة
- مديرية الإدارة المحلية
- التكوين و التعليم المهني
- التعليم العالي

### nedjari.anissa — نجاري أنيسة

متصرف رئيسي بالديوان

- الشباب و الرياضة
- الشؤون الدينية و الأوقاف
- الثقافة و الفنون
- المجاهدين و ذوي الحقوق
- الحركة الجمعوية
- الرعاية السامية
- الاستقبالات
- اللقاءات الدورية مع نواب البرلمان
- الإعانات المالية
- المستفيدين من العمرة
- التحضير لمختلف الفعاليات

### moussaoui.chawki — موسوي شوقي

مهندس رئيس

- الطاقة والمناجم
- خرجات السيد الوالي
- تعليمات السيد الوالي خلال المجلس التنفيذي للولاية

### chafai.zahra — شافعي زهرة

متصرف مستشار

- التشريفات و الملفات ذات الطابع الخاص

### halilim.benamar — حليلم بن اعمر

متصرف اداري

- المستخدمين و ملفات ذات طابع خاص

### bendaoud.amina — بن داود أمينة

رئيس المفتشين في النظافة و النقاوة العمومية و البيئة

- الصحة و السكان
- التجارة
- النشاط الاجتماعي و التضامن
- الهيئة الوطنية لحماية و ترقية الطفولة
- العملية التضامنية لشهر رمضان

## Credentials files (generated at run)

Excel for admin ops; **one PDF** for printing (exactly **1 page per user**).

**Wipe bootstrap** writes:

- `backend/private/bootstrap/credentials-office.xlsx`
- `backend/private/bootstrap/credentials-chef-wali.xlsx`
- `backend/private/bootstrap/credentials-handout.pdf` — all users, 1 page each (FR labels + Arabic Nom/Fonction; same font stack as rapport PDF: Tahoma/Arial, bundled DejaVu on Linux)

**Ensure** (new users only) writes only newly created users:

- `backend/private/bootstrap/credentials-added-<timestamp>.xlsx`
- `backend/private/bootstrap/credentials-added-<timestamp>.pdf` — same users, 1 page each

**Regenerate PDF only** (no wipe, no password change) from existing Excel sheets:

```bash
cd backend
npm run db:regenerate-credentials-handout
```

## Reset (once) — wipe

Destructive for **user activity** only. Use after DB backup. Do **not** re-run casually.

**Keeps:** ADMIN accounts, dairas/communes/directions, access role templates, **guide videos** (+ their files). **Fiche lecture types** are kept during type wipe; services recreate then get a fresh fiche type per leaf.

**Wipes then recreates:** non-admin users (office / wali / chef), cabinet department/services, **all rapports** (including fiche documents), other schemas/types/templates, notifications, instructions/broadcasts, tokens, other uploaded files (not guide videos).

### Backfill missing fiche lecture types (SQL)

If leaf services already exist without a fiche type, run on PostgreSQL:

```sql
INSERT INTO rapport_types (
  service_id,
  slug,
  name_ar,
  name_fr,
  layout_kind,
  versioning_mode,
  content_kind,
  commune_content_kind,
  entity_target_kinds,
  schema_json
)
SELECT
  s.id,
  'fiche_lecture',
  'مذكرة استخلاصية',
  'Fiche lecture',
  'memo',
  'standalone',
  'fiche_lecture',
  'complex',
  '["commune"]'::jsonb,
  jsonb_build_object(
    'default_blocks',
    jsonb_build_array(
      jsonb_build_object('type','heading','align','center','bold',true,
        'text_ar','الجمهـــوريـــة الجـــزائريـــة الديمقـــراطيــــة الشعــبيــــة',
        'text_fr','République Algérienne Démocratique et Populaire'),
      jsonb_build_object('type','heading','align','center','bold',true,
        'text_ar','ولايــة تلمســان','text_fr','Wilaya de Tlemcen'),
      jsonb_build_object('type','heading','align','center','bold',true,
        'text_ar','الديوان','text_fr','Le Diwan'),
      jsonb_build_object('type','heading','align','center','bold',true,
        'text_ar','مذكرة استخلاصية','text_fr','Fiche lecture'),
      jsonb_build_object('type','paragraph','text_ar','','text_fr','')
    )
  )
FROM services s
WHERE s.is_folder = false
  AND NOT EXISTS (
    SELECT 1
    FROM rapport_types rt
    WHERE rt.service_id = s.id
      AND rt.content_kind = 'fiche_lecture'
  );
```

Or on the API host (idempotent, no wipe):

```bash
npm run db:ensure-fiche-lecture
```

That creates missing `fiche_lecture` types on **all** leaf services (no SQL needed).

```bash
cd backend
npm run db:seed-prod-bootstrap
```

## Add / ensure (safe) — no wipe

Idempotent: creates missing users, root leaf services, and `manage` grants; skips existing usernames/slugs; never changes existing passwords.

1. Append people/services to [`prodBootstrapInventory.js`](../../backend/scripts/data/prodBootstrapInventory.js) and this doc.
2. Deploy the updated inventory file (or full API package).
3. Run:

```bash
cd backend
npm run db:seed-prod-ensure
```

4. Hand out only `credentials-added-*.pdf` (print) / `.xlsx` (ops) for new accounts.

Safe to re-run: second run should create nothing if inventory is unchanged.

## Demo 2 — presentation fill (dev only)

After bootstrap, fill all leaf services with presentation data.

- **Hero services (full Demo 1 depth for videos):** `svc-chabira-eau` and `svc-zaabat-invest` as **flat root leaves** (same as bootstrap — no folder nesting).
- **Other services:** lightweight fiche / document / table fill.

```bash
cd backend
npm run db:seed-demo-cabinet
```

Refuses when `NODE_ENV=production`. Keeps users and services; clears and reseeds domain presentation data only.