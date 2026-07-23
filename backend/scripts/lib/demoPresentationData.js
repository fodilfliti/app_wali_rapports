"use strict";

/**
 * Shared Demo 1 / Demo 2 presentation builders (hydraulique + investissement).
 */

const crypto = require("crypto");
const {
  buildFicheDefaultBlocks,
  buildFicheDefaultDataJson,
  buildCommuneDocumentDefaultBlocks,
  buildCommuneDocumentDefaultDataJson,
} = require("../../src/modules/rapports/documentDefaults");

function appendAfterLetterhead(baseHtml, extraHtml) {
  const base = String(baseHtml || "").replace(/<p><\/p>\s*$/i, "");
  const extra = String(extraHtml || "").trim();
  if (!extra) return `${base}<p></p>`;
  return `${base}${extra}`;
}

function rowMeta(overrides = {}) {
  return {
    _row_finished: false,
    _wali_visible: true,
    _highlight: "none",
    _cell_colors: {},
    ...overrides,
  };
}

function headingBlock(textAr, textFr) {
  return { type: "heading", align: "center", bold: true, text_ar: textAr, text_fr: textFr };
}

function paragraphBlock(textAr, textFr) {
  return { type: "paragraph", text_ar: textAr, text_fr: textFr };
}

function communeStatusTable(id, titleAr, titleFr, rows) {
  return {
    id,
    schema_slug: "commune-suivi",
    schema_name_ar: titleAr,
    schema_name_fr: titleFr,
    columns: [
      { key: "label", type: "text", label_ar: "البند", label_fr: "Rubrique" },
      { key: "value", type: "text", label_ar: "القيمة", label_fr: "Valeur" },
    ],
    layout_json: {},
    table_meta: { title_ar: titleAr, title_fr: titleFr },
    rows,
    rapport_only: true,
  };
}

function buildCommuneComplexEntry(municipality, opts = {}) {
  const tableId = opts.tableId || crypto.randomUUID();
  const defaults = buildCommuneDocumentDefaultDataJson(municipality);
  const blocks = (defaults.blocks || buildCommuneDocumentDefaultBlocks(municipality)).concat(
    opts.extraBlocks || [],
  );
  const embeddedTable = opts.table ? { ...opts.table, id: tableId } : null;
  const embedded_tables = embeddedTable ? [embeddedTable] : [];
  const introAr = opts.introAr || "";
  const introFr = opts.introFr || "";
  const bodyAr =
    opts.rich_html_ar ||
    (embedded_tables.length
      ? `<p>${introAr}</p><div data-schema-table-id="${tableId}"></div>`
      : introAr
        ? `<p>${introAr}</p>`
        : "");
  const bodyFr =
    opts.rich_html_fr ||
    (embedded_tables.length
      ? `<p>${introFr}</p><div data-schema-table-id="${tableId}"></div>`
      : introFr
        ? `<p>${introFr}</p>`
        : "");
  return {
    blocks,
    rich_html_ar: appendAfterLetterhead(defaults.rich_html_ar, bodyAr),
    rich_html_fr: appendAfterLetterhead(defaults.rich_html_fr, bodyFr),
    embedded_tables,
    calendar_events: opts.calendar_events || [],
  };
}

function ficheEmbeddedTable(id, titleAr, titleFr, columns, rows) {
  return {
    id,
    schema_slug: "fiche-summary",
    schema_name_ar: titleAr,
    schema_name_fr: titleFr,
    columns,
    layout_json: {},
    table_meta: { title_ar: titleAr, title_fr: titleFr },
    rows,
    rapport_only: true,
  };
}

function buildHydFicheDataJson(tableId) {
  const introAr =
    "الموضوع: عرض وضعية الموارد المائية والسدود وشبكات التوزيع بتراب ولاية تلمسان، تمهيداً لمتابعة برامج الصيانة والتوسيع.";
  const introFr =
    "Objet: présentation de la situation des ressources en eau, des barrages et des réseaux de distribution dans la wilaya de Tlemcen.";
  const blocks = buildFicheDefaultBlocks().concat([
    paragraphBlock(introAr, introFr),
    paragraphBlock(
      `تاريخ الإعداد: ${new Date().toISOString().slice(0, 10)} — مصلحة الموارد المائية.`,
      `Date: ${new Date().toISOString().slice(0, 10)} — Direction des ressources en eau.`,
    ),
    headingBlock("I — وضعية السدود", "I — État des barrages"),
    paragraphBlock(
      "تتوفر الولاية على ثلاثة سدود رئيسية. الوضعية العامة مستقرة مع انخفاض طفيف في نسب الملء مقارنة بالسنة الماضية، خصوصاً لسد بني بهدل (-4%).",
      "La wilaya dispose de trois barrages principaux. Situation globalement stable avec une légère baisse des taux de remplissage, notamment Beni Bahdel (-4 %).",
    ),
    paragraphBlock(
      "سد تلمسان: سعة 45 مليون م³، نسبة الملء 62% — مستوى طبيعي. سد بني بهدل: 12 مليون م³، نسبة الملء 41% — يتطلب متابعة أسبوعية. سد السواني: 8 مليون م³، نسبة الملء 55%.",
      "Barrage Tlemcen: 45 Mm³, remplissage 62 %. Barrage Beni Bahdel: 12 Mm³, 41 % — suivi hebdomadaire. Barrage Souani: 8 Mm³, 55 %.",
    ),
    headingBlock("II — شبكات التوزيع", "II — Réseaux de distribution"),
    paragraphBlock(
      "شبكة التوزيع الحضرية: 186 كm، تغطية 94% من الأحياء المركزية. الضواحي: 78 كm، نقاط ضغط منخفض في حي بن سنوس وعين نحالة.",
      "Réseau urbain: 186 km, couverture 94 %. Périphérie: 78 km, points de basse pression (Ben Snous, Ain Nehala).",
    ),
    paragraphBlock(
      "برنامج توسيع عين نحالة: 3.1 كm قيد الإنجاز (85%). صيانة محطات الضخ: 6 محطات برمجت لهذا الربع.",
      "Extension Ain Nehala: 3,1 km en cours (85 %). Maintenance stations de pompage: 6 stations ce trimestre.",
    ),
    { type: "media_row", items: [{ file_id: null }, { file_id: null }] },
    headingBlock("III — التوصيات", "III — Recommandations"),
    paragraphBlock(
      "1) إطلاق أعمال صيانة سد بني بهدل قبل نهاية الربع. 2) تسريع توسيع شبكة عين نحالة. 3) تعزيز مراقبة جودة المياه في المناطق الساحلية.",
      "1) Lancer la maintenance du barrage Beni Bahdel avant fin de trimestre. 2) Accélérer l'extension Ain Nehala. 3) Renforcer le contrôle qualité en zone côtière.",
    ),
  ]);

  const rich_html_ar = [
    `<p><strong>${introAr}</strong></p>`,
    `<p>تُقدَّم هذه المذكرة الاستخلاصية لعرض أبرز المؤشرات الميدانية والبرامج الجارية في قطاع الموارد المائية.</p>`,
    `<p><strong>I — وضعية السدود</strong></p>`,
    `<p>الوضعية العامة مستقرة. يُلاحظ تراجع طفيف في ملء سد بني بهدل يستدعي تدخل صيانة وقائية.</p>`,
    `<div data-schema-table-id="${tableId}"></div>`,
    `<p><strong>II — شبكات التوزيع</strong></p>`,
    `<p>معدل التغطية بالمياه الشروب 92% على مستوى الولاية. أعمال التوسيع مستمرة في بلديات عين نحالة والغزوات.</p>`,
    `<p><strong>III — التوصيات</strong></p>`,
    `<p>المصلحة توصي باعتماد برنامج الصيانة العاجل لسد بني بهدل ومتابعة تنفيذ توسيع شبكة عين نحالة.</p>`,
  ].join("");

  const rich_html_fr = [
    `<p><strong>${introFr}</strong></p>`,
    `<p>Cette fiche lecture présente les principaux indicateurs terrain et programmes en cours dans le secteur hydraulique.</p>`,
    `<p><strong>I — État des barrages</strong></p>`,
    `<p>Situation globalement stable. Légère baisse au barrage Beni Bahdel nécessitant une maintenance préventive.</p>`,
    `<div data-schema-table-id="${tableId}"></div>`,
    `<p><strong>II — Réseaux de distribution</strong></p>`,
    `<p>Taux de couverture AEP: 92 % à l'échelle wilaya. Extensions en cours à Ain Nehala et Ghazaouet.</p>`,
    `<p><strong>III — Recommandations</strong></p>`,
    `<p>Maintenance urgente Beni Bahdel et suivi de l'extension du réseau Ain Nehala.</p>`,
  ].join("");

  return {
    blocks,
    rich_html_ar: appendAfterLetterhead(buildFicheDefaultDataJson().rich_html_ar, rich_html_ar),
    rich_html_fr: appendAfterLetterhead(buildFicheDefaultDataJson().rich_html_fr, rich_html_fr),
    embedded_tables: [
      ficheEmbeddedTable(
        tableId,
        "ملخص مؤشرات السدود",
        "Synthèse indicateurs barrages",
        [
          { key: "dam", type: "text", label_ar: "السد", label_fr: "Barrage" },
          { key: "capacity", type: "text", label_ar: "السعة", label_fr: "Capacité" },
          { key: "fill_pct", type: "text", label_ar: "نسبة الملء", label_fr: "Remplissage" },
          { key: "status", type: "text", label_ar: "الحالة", label_fr: "Statut" },
          { key: "notes", type: "text", label_ar: "ملاحظات", label_fr: "Observations" },
        ],
        [
          rowMeta({
            dam: "سد تلمسان",
            capacity: "45 Mm³",
            fill_pct: "62%",
            status: "مستقر",
            notes: "وضعية طبيعية",
            _cell_colors: { fill_pct: "info", status: "success" },
          }),
          rowMeta({
            dam: "سد بني بهدل",
            capacity: "12 Mm³",
            fill_pct: "41%",
            status: "مراقبة",
            notes: "انخفاض — صيانة مطلوبة",
            _cell_colors: { fill_pct: "warning", status: "warning", notes: "important" },
          }),
          rowMeta({
            dam: "سد السواني",
            capacity: "8 Mm³",
            fill_pct: "55%",
            status: "مستقر",
            notes: "—",
            _cell_colors: { fill_pct: "info" },
          }),
          rowMeta({
            dam: "سد واد لحلاف",
            capacity: "3 Mm³",
            fill_pct: "48%",
            status: "مستقر",
            notes: "منطقة جبلية",
          }),
        ],
      ),
    ],
  };
}

function buildInvFicheDataJson(tableId) {
  const introAr =
    "الموضوع: نتائج أشغال الخلية الولائية المتعلقة بمتابعة تسوية المشاريع الاستثمارية — دورة 2026.";
  const introFr =
    "Objet: résultats des travaux de la cellule wilaya — suivi de la régularisation des projets d'investissement — session 2026.";
  const blocks = buildFicheDefaultBlocks().concat([
    paragraphBlock(introAr, introFr),
    paragraphBlock(
      "إشارة إلى محضر الجلسة المنعقدة بتاريخ الأسبوع الجاري، يُعرض أدناه ملخص المشاريع قيد المتابعة والمبالغ المرصودة.",
      "Référence au procès-verbal de la session de la semaine — synthèse des projets suivis et montants engagés.",
    ),
    headingBlock("I — مؤشرات عامة", "I — Indicateurs généraux"),
    paragraphBlock(
      "عدد المشاريع المتابعة: 47 مشروعاً. المبلغ الإجمالي: 285 مليار دج. متوسط نسبة الإنجاز: 58%. مشاريع متأخرة: 8 (17%).",
      "Projets suivis: 47. Montant total: 285 Md DZD. Avancement moyen: 58 %. Projets en retard: 8 (17 %).",
    ),
    paragraphBlock(
      "الخلية الولائية أوصت بجلسات متابعة شهرية للمشاريع ذات النسب دون 40%، ورفع ملفات التراخيص المتأخرة إلى المصالح المعنية.",
      "La cellule recommande un suivi mensuel pour les projets < 40 % et le relèvement des dossiers d'autorisation en retard.",
    ),
    headingBlock("II — أبرز المشاريع", "II — Projets principaux"),
    paragraphBlock(
      "مجمع صناعي مغنية (120 Md — 75%)، فندق تلمسان (45 Md — 35%)، محطة تعبئة عين نحالة (28 Md — 90%).",
      "Complexe Maghnia (120 Md — 75 %), hôtel Tlemcen (45 Md — 35 %), station Ain Nehala (28 Md — 90 %).",
    ),
    { type: "media_row", items: [{ file_id: null }] },
    headingBlock("III — التوصيات", "III — Recommandations"),
    paragraphBlock(
      "1) تسريع إجراءات فندق تلمسان. 2) تسليم محطة عين نحالة قبل الصيف. 3) عقد لقاء مع المستثمرين بالمنطقة الصناعية مغنية.",
      "1) Accélérer l'hôtel Tlemcen. 2) Réception station Ain Nehala avant l'été. 3) Rencontre investisseurs zone Maghnia.",
    ),
  ]);

  const rich_html_ar = [
    `<p><strong>${introAr}</strong></p>`,
    `<p>تُرفق هذه المذكرة الاستخلاصية جدولاً تفصيلياً لأهم المشاريع الاستثمارية المعروضة على قرار الوالي.</p>`,
    `<p><strong>I — مؤشرات عامة</strong></p>`,
    `<ul><li>47 مشروعاً تحت المتابعة</li><li>285 مليار دج من الاستثمارات</li><li>8 مشاريع في حالة تأخر</li><li>12 مشروعاً شبه منجز (&gt; 90%)</li></ul>`,
    `<div data-schema-table-id="${tableId}"></div>`,
    `<p><strong>II — التوصيات</strong></p>`,
    `<p>طلب اعتماد المذكرة وموافاة الخلية بقرار الوالي بخصوص المشاريع المتأخرة.</p>`,
  ].join("");

  const rich_html_fr = [
    `<p><strong>${introFr}</strong></p>`,
    `<p>Cette fiche lecture est accompagnée d'un tableau détaillé des principaux projets soumis à la décision du wali.</p>`,
    `<p><strong>I — Indicateurs généraux</strong></p>`,
    `<ul><li>47 projets suivis</li><li>285 Md DZD d'investissements</li><li>8 projets en retard</li><li>12 projets quasi achevés (&gt; 90 %)</li></ul>`,
    `<div data-schema-table-id="${tableId}"></div>`,
    `<p><strong>II — Recommandations</strong></p>`,
    `<p>Demande d'avis favorable et retour de la cellule après décision du wali sur les projets en retard.</p>`,
  ].join("");

  return {
    blocks,
    rich_html_ar: appendAfterLetterhead(buildFicheDefaultDataJson().rich_html_ar, rich_html_ar),
    rich_html_fr: appendAfterLetterhead(buildFicheDefaultDataJson().rich_html_fr, rich_html_fr),
    embedded_tables: [
      ficheEmbeddedTable(
        tableId,
        "ملخص المشاريع الاستثمارية",
        "Synthèse projets investissement",
        [
          { key: "project_title", type: "text", label_ar: "المشروع", label_fr: "Projet" },
          { key: "owner", type: "text", label_ar: "المالك", label_fr: "Maître d'ouvrage" },
          { key: "municipality", type: "text", label_ar: "البلدية", label_fr: "Commune" },
          { key: "total_amount", type: "text", label_ar: "المبلغ (دج)", label_fr: "Montant (DZD)" },
          { key: "completion_pct", type: "text", label_ar: "نسبة الإنجاز", label_fr: "Avancement" },
          { key: "notes", type: "text", label_ar: "ملاحظات", label_fr: "Observations" },
        ],
        [
          rowMeta({
            project_title: "مجمع صناعي — مغنية",
            owner: "Groupe Maghnia SA",
            municipality: "مغنية",
            total_amount: "120 000 000",
            completion_pct: "75%",
            notes: "إنجاز جيد",
            _cell_colors: { completion_pct: "success" },
          }),
          rowMeta({
            project_title: "فندق — تلمسان",
            owner: "SARL Tourisme",
            municipality: "تلمسان",
            total_amount: "45 000 000",
            completion_pct: "35%",
            notes: "تأخر تراخيص",
            _cell_colors: { completion_pct: "warning", notes: "important" },
          }),
          rowMeta({
            project_title: "محطة تعبئة — عين نحالة",
            owner: "Hydrocarbures Ouest",
            municipality: "عين نحالة",
            total_amount: "28 000 000",
            completion_pct: "90%",
            notes: "شبه منجز",
            _cell_colors: { completion_pct: "info" },
          }),
          rowMeta({
            project_title: "مصنع تعبئة — تلمسان",
            owner: "شركة SA",
            municipality: "تلمسان",
            total_amount: "85 000 000",
            completion_pct: "52%",
            notes: "قيد التنفيذ",
          }),
          rowMeta({
            project_title: "مركز تجاري — الرمشي",
            owner: "Promo Ouest",
            municipality: "الرمشي",
            total_amount: "32 000 000",
            completion_pct: "18%",
            notes: "تأخر كبير",
            _cell_colors: { completion_pct: "warning", notes: "important" },
          }),
        ],
      ),
    ],
  };
}

const hydBarrageCols = [
  {
    key: "dam_name",
    type: "text",
    label_ar: "اسم السد",
    label_fr: "Nom du barrage",
    merge_vertical_suggested: true,
  },
  {
    key: "capacity_m3",
    type: "number",
    format: "integer",
    footer_aggregate: "sum",
    label_ar: "السعة (م³)",
    label_fr: "Capacité (m³)",
  },
  {
    key: "fill_pct",
    type: "number",
    format: "percent",
    label_ar: "نسبة الملء",
    label_fr: "Taux de remplissage",
  },
  {
    key: "alert_level",
    type: "choice",
    label_ar: "مستوى التنبيه",
    label_fr: "Niveau d'alerte",
    choices: [
      { value: "normal", label_ar: "عادي", label_fr: "Normal" },
      { value: "watch", label_ar: "مراقبة", label_fr: "Surveillance" },
      { value: "critical", label_ar: "حرج", label_fr: "Critique" },
    ],
  },
  { key: "notes", type: "text", label_ar: "ملاحظات", label_fr: "Observations" },
];

const hydBarrageLayout = {
  header_groups: [
    {
      label_ar: "بيانات السد",
      label_fr: "Données barrage",
      column_keys: ["dam_name", "capacity_m3"],
    },
    {
      label_ar: "متابعة",
      label_fr: "Suivi",
      column_keys: ["fill_pct", "alert_level", "notes"],
    },
  ],
  default_title_ar: "حالة السدود — ولاية تلمسان",
  default_title_fr: "État des barrages — Wilaya de Tlemcen",
  default_subtitle_ar: "تقرير دوري",
  default_subtitle_fr: "Rapport périodique",
};

const invCols = [
  {
    key: "project_title",
    type: "text",
    label_ar: "عنوان المشروع",
    label_fr: "Intitulé du projet",
    merge_vertical_suggested: true,
  },
  { key: "owner", type: "text", label_ar: "صاحب المشروع", label_fr: "Maître d'ouvrage" },
  { key: "municipality_code", type: "commune_ref", label_ar: "البلدية", label_fr: "Commune" },
  {
    key: "total_amount",
    type: "number",
    format: "currency",
    footer_aggregate: "sum",
    label_ar: "المبلغ الإجمالي (دج)",
    label_fr: "Montant total (DA)",
  },
  {
    key: "completion_pct",
    type: "number",
    format: "percent",
    label_ar: "نسبة الإنجاز",
    label_fr: "Taux d'avancement",
  },
  {
    key: "remaining_pct",
    type: "formula",
    formula: "100 - completion_pct",
    format: "percent",
    label_ar: "المتبقي %",
    label_fr: "Reste %",
  },
  { key: "notes", type: "text", label_ar: "ملاحظات", label_fr: "Observations" },
];

const invLayout = {
  header_groups: [
    {
      label_ar: "المشروع",
      label_fr: "Projet",
      column_keys: ["project_title", "owner", "municipality_code"],
    },
    {
      label_ar: "مالي",
      label_fr: "Financier",
      column_keys: ["total_amount", "completion_pct", "remaining_pct", "notes"],
    },
  ],
  default_title_ar: "متابعة تسوية المشاريع الاستثمارية",
  default_title_fr: "Suivi des projets d'investissement",
  default_subtitle_ar: "نتائج أشغال الخلية الولائية — 2026",
  default_subtitle_fr: "Travaux cellule wilaya — 2026",
};

function buildHydTableV1() {
  const snap = { columns: hydBarrageCols, layout_json: hydBarrageLayout };
  return {
    schema_snapshot: snap,
    tables: [
      {
        key: "main",
        title_ar: hydBarrageLayout.default_title_ar,
        title_fr: hydBarrageLayout.default_title_fr,
        subtitle_ar: hydBarrageLayout.default_subtitle_ar,
        subtitle_fr: hydBarrageLayout.default_subtitle_fr,
        merge_column_keys: ["dam_name"],
        rows: [
          rowMeta({
            dam_name: "سد تلمسان",
            capacity_m3: 45000000,
            fill_pct: 62,
            alert_level: "normal",
            notes: "وضعية مستقرة",
            _cell_colors: { fill_pct: "info" },
          }),
          rowMeta({
            dam_name: "سد تلمسان",
            capacity_m3: 45000000,
            fill_pct: 58,
            alert_level: "watch",
            notes: "انخفاض طفيف",
            _cell_colors: { fill_pct: "warning", alert_level: "warning" },
          }),
          rowMeta({
            dam_name: "سد بني بهدل",
            capacity_m3: 12000000,
            fill_pct: 41,
            alert_level: "critical",
            notes: "يتطلب متابعة عاجلة",
            _cell_colors: { fill_pct: "important", alert_level: "important" },
            _row_finished: true,
          }),
        ],
        media_rows: [{ items: [] }],
      },
    ],
  };
}

function buildHydTableV2() {
  const v2 = JSON.parse(JSON.stringify(buildHydTableV1()));
  v2.tables[0].rows[2].fill_pct = 44;
  v2.tables[0].rows[2].notes = "تحسن بعد تدخلات — v2";
  return v2;
}

function buildInvTableV1() {
  const snap = { columns: invCols, layout_json: invLayout };
  return {
    schema_snapshot: snap,
    tables: [
      {
        key: "main",
        title_ar: invLayout.default_title_ar,
        title_fr: invLayout.default_title_fr,
        subtitle_ar: invLayout.default_subtitle_ar,
        subtitle_fr: invLayout.default_subtitle_fr,
        merge_column_keys: ["project_title"],
        rows: [
          rowMeta({
            project_title: "مجمع صناعي — مغنية",
            owner: "Groupe Maghnia SA",
            municipality_code: "1327",
            total_amount: 120000000,
            completion_pct: 75,
            notes: "في طور الإنجاز",
            _cell_colors: { completion_pct: "success" },
          }),
          rowMeta({
            project_title: "فندق — تلمسان",
            owner: "SARL Tourisme",
            municipality_code: "1301",
            total_amount: 45000000,
            completion_pct: 35,
            notes: "تأخر في التراخيص",
            _cell_colors: { completion_pct: "warning", notes: "important" },
          }),
          rowMeta({
            project_title: "محطة تعبئة — عين نحالة",
            owner: "Hydrocarbures Ouest",
            municipality_code: "1325",
            total_amount: 28000000,
            completion_pct: 90,
            notes: "شبه منجز",
            _cell_colors: { completion_pct: "info" },
            _row_finished: true,
          }),
        ],
      },
    ],
  };
}

const HERO_SLUGS = {
  HYDRAULIQUE: "svc-chabira-eau",
  INVESTISSEMENT: "svc-zaabat-invest",
};

module.exports = {
  rowMeta,
  headingBlock,
  paragraphBlock,
  communeStatusTable,
  buildCommuneComplexEntry,
  appendAfterLetterhead,
  ficheEmbeddedTable,
  buildHydFicheDataJson,
  buildInvFicheDataJson,
  hydBarrageCols,
  hydBarrageLayout,
  invCols,
  invLayout,
  buildHydTableV1,
  buildHydTableV2,
  buildInvTableV1,
  HERO_SLUGS,
};
