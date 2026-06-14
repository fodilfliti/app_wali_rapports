## Module: Rapport Investissement (placeholder)

### Purpose & constraints

- First domain slice based on **Amina invest** sample xlsx: *نتائج أشغال الخلية الولائية المتعلقة بمتابعة تسوية المشاريع الاستثمارية*.
- **Versioned** grid rapport under service `investissement`.
- Full 20+ column UI deferred — this spec defines target schema for `data_json`.

### Roles & rules

- **OFFICE_USER** with `rapports.investissement.manage`: create/edit/submit.
- **WALI** with `rapports.inbox.view`: read submitted versions.
- **ADMIN**: configure type; support edits.

### Implemented Schema (`investissement-projets`)

The system seeds a table schema with slug `investissement-projets` containing the following columns:

| Column key | Type | Label (AR) | Label (FR) | Format |
| ---------- | ---- | ---------- | ---------- | ------ |
| `project_title` | `text` | عنوان المشروع | Intitulé du projet | — |
| `owner` | `text` | صاحب المشروع | Maître d'ouvrage | — |
| `municipality_code` | `commune_ref` | البلدية | Commune | — |
| `location` | `text` | موقع المشروع | Localisation | — |
| `total_amount_kdzd` | `number` | المبلغ الإجمالي (دج) | Montant total (DA) | `currency` |
| `completion_pct` | `number` | نسبة الإنجاز | Taux d'avancement | `percent` |
| `notes` | `text` | ملاحظات | Observations | — |

### Target Data model (in `rapport_versions.data_json`)

```json
{
  "sections": [
    {
      "key": "section1_census",
      "title_ar": "إحصاء عام للمشاريع المعينة بأحكام المادة 24",
      "rows": [
        {
          "project_title": "",
          "owner": "",
          "municipality_code": "",
          "location": "",
          "area_m2": null,
          "total_amount_kdzd": null,
          "jobs_count": null,
          "land_delivery_entity": "",
          "building_permit_date": "",
          "completion_pct": null,
          "audit_obstacles": "",
          "legal_solutions": "",
          "qualified_party": "",
          "wilaya_committee": "",
          "ministerial_sector": "",
          "exceptional_permit_needed": false,
          "exploitation_permit_needed": false,
          "wilaya_committee_decision": "",
          "notes": ""
        }
      ]
    },
    {
      "key": "section2_followup",
      "title_ar": "متابعة المشاريع التي تمت دراستها من قبل اللجنة الولائية",
      "subsections": [
        { "key": "restrictions_lifted", "rows": [] },
        { "key": "under_study", "rows": [] }
      ]
    }
  ],
  "header": {
    "republic_line_ar": "الجمهورية الجزائرية الديمقراطية الشعبية",
    "wilaya_line_ar": "",
    "session_date": ""
  }
}
```

### Workflows

- Same as `RAPPORTS.md` core lifecycle.
- Office maintains living version; each cell session may produce new `version_number`.

### API endpoints

- Uses core `/office/rapports` with `rapport_type_id` = investissement grid type.
- Future: `GET /office/rapports/:id/export.xlsx?locale=ar|fr`

### UI/UX (deferred)

- Spreadsheet-style grid with municipality picker from `municipalities` reference.
- Section tabs matching xlsx sheet structure.

### Audit events

- Inherit from `RAPPORTS.md`; add `RAPPORT_INVESTISSEMENT_EXPORT` when export ships.

### Migration notes

- Seed `rapport_types` row: slug `investissement_grid`, `versioning_mode = versioned`, `layout_kind = grid`.
