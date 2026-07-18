# Prod bootstrap inventory (cabinet)

Canonical human-readable list for `npm run db:seed-prod-bootstrap` (wipe once) and `npm run db:seed-prod-ensure` (safe add).  
Machine source: [`backend/scripts/data/prodBootstrapInventory.js`](../../backend/scripts/data/prodBootstrapInventory.js).

## Review accounts

| username | role | name |
| --- | --- | --- |
| `wali` | WALI | والي |
| `chef_cabinet` | CHEF_CABINET | رئيس الديوان |

## Office users

Each person gets **root leaf services** (ملفات) with `parent_service_id: null` and `manage` access — no person-named folders. No rapport types in bootstrap v1.

Nested sub-services under الموارد المائية exist only in **dev Demo 2** (`db:seed-demo-cabinet`), never in prod bootstrap/ensure.

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

## Credentials Excel (generated at run)

**Wipe bootstrap** writes:

- `backend/storage/bootstrap/credentials-office.xlsx`
- `backend/storage/bootstrap/credentials-chef-wali.xlsx`

**Ensure (add)** writes only newly created users:

- `backend/storage/bootstrap/credentials-added-<timestamp>.xlsx`

## Reset (once) — wipe

Destructive. Use only for the initial prod cabinet reset (after DB backup). Do **not** re-run casually.

```bash
cd backend
CONFIRM_PROD_BOOTSTRAP=YES npm run db:seed-prod-bootstrap
```

## Add / ensure (safe) — no wipe

Idempotent: creates missing users, root leaf services, and `manage` grants; skips existing usernames/slugs; never changes existing passwords.

1. Append people/services to [`prodBootstrapInventory.js`](../../backend/scripts/data/prodBootstrapInventory.js) and this doc.
2. Deploy the updated inventory file (or full API package).
3. Run:

```bash
cd backend
CONFIRM_PROD_ENSURE=YES npm run db:seed-prod-ensure
```

4. Hand out only `credentials-added-*.xlsx` for new accounts.

Safe to re-run: second run should create nothing if inventory is unchanged.

## Demo 2 — presentation fill (dev only)

After bootstrap, fill all leaf services with presentation data.

- **Hero services (full Demo 1 depth for videos):** `svc-chabira-eau` and `svc-zaabat-invest`. In **dev only**, Demo 2 nests chabira water under a folder (السدود / توزيع / متابعة بلدية) — not created by prod bootstrap/ensure.
- **Other services:** lightweight fiche / document / table fill.

```bash
cd backend
npm run db:seed-demo-cabinet
```

Refuses when `NODE_ENV=production`. Keeps users and services; clears and reseeds domain presentation data only.