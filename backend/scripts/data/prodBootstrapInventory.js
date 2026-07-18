"use strict";

/**
 * Prod bootstrap inventory — keep in sync with spec/data/PROD_BOOTSTRAP.md
 *
 * Each office user gets root leaf services (parent_service_id null) with manage grants.
 * No person-named folders. Nested demo-only trees are created in seed-demo-cabinet, not here.
 */

function collectLeafServiceSpecs(services) {
  const leaves = [];
  for (const svc of services) {
    if (svc.is_folder && Array.isArray(svc.children)) {
      for (const child of svc.children) leaves.push(child);
    } else {
      leaves.push(svc);
    }
  }
  return leaves;
}

module.exports = {
  collectLeafServiceSpecs,

  reviewUsers: [
    {
      username: "wali",
      role: "WALI",
      name: "والي",
      job_title: "والي الولاية",
      templateSlug: "WALI_STANDARD",
    },
    {
      username: "chef_cabinet",
      role: "CHEF_CABINET",
      name: "رئيس الديوان",
      job_title: "رئيس الديوان",
      templateSlug: "CHEF_STANDARD",
    },
  ],

  officeUsers: [
    {
      username: "chabira.houssein",
      name: "شبيرة حسين",
      job_title: "مهندس دولة للإدارة الإقليمية في التسيير التقني والحضري",
      services: [
        { slug: "svc-chabira-eau", name_ar: "الموارد المائية", name_fr: "Ressources hydriques" },
        {
          slug: "svc-chabira-poste",
          name_ar: "البريد والمواصلات السلكية واللاسلكية",
          name_fr: "Poste et télécommunications",
        },
        {
          slug: "svc-chabira-protection",
          name_ar: "الحماية المدنية",
          name_fr: "Protection civile",
        },
      ],
    },
    {
      username: "safrou.wafaa",
      name: "سفرو وفاء",
      job_title: "مهندس دولة في التسيير التقني والحضري للجماعات الاقليمية",
      services: [
        { slug: "svc-safrou-urbanisme", name_ar: "التعمير والبناء", name_fr: "Urbanisme et construction" },
        {
          slug: "svc-safrou-cadastre",
          name_ar: "مسح الأراضي والحفظ العقاري",
          name_fr: "Cadastre et conservation foncière",
        },
      ],
    },
    {
      username: "zaabat.amina",
      name: "زعباط أمينة",
      job_title: "مهندس دولة للإدارة الإقليمية في التسيير التقني والحضري",
      services: [
        { slug: "svc-zaabat-invest", name_ar: "الاستثمار", name_fr: "Investissement" },
        {
          slug: "svc-zaabat-peche",
          name_ar: "الصيد البحري و تربية المائيات",
          name_fr: "Pêche et aquaculture",
        },
        {
          slug: "svc-zaabat-icpe",
          name_ar: "المؤسسات المصنفة",
          name_fr: "Établissements classés",
        },
        {
          slug: "svc-zaabat-cet",
          name_ar: "المؤسسة الولائية لتسيير مراكز الردم التقني",
          name_fr: "CET — centres d'enfouissement technique",
        },
        {
          slug: "svc-zaabat-nesda",
          name_ar: "الوكالة الوطنية لدعم وتنمية المقاولاتية (Nesda)",
          name_fr: "NESDA",
        },
        {
          slug: "svc-zaabat-angem",
          name_ar: "الوكالة الوطنية لتسيير القرض المصغر (Angem)",
          name_fr: "ANGEM",
        },
        { slug: "svc-zaabat-banques", name_ar: "البنوك", name_fr: "Banques" },
        {
          slug: "svc-zaabat-communes-vertes",
          name_ar: "البلديات الخضراء",
          name_fr: "Communes vertes",
        },
      ],
    },
    {
      username: "arabia.amira",
      name: "عربية أميرة",
      job_title: "متصرف رئيسي",
      services: [
        { slug: "svc-arabia-tourisme", name_ar: "السياحة", name_fr: "Tourisme" },
        {
          slug: "svc-arabia-dal",
          name_ar: "مديرية الإدارة المحلية",
          name_fr: "Direction de l'administration locale",
        },
        {
          slug: "svc-arabia-formation",
          name_ar: "التكوين و التعليم المهني",
          name_fr: "Formation et enseignement professionnels",
        },
        {
          slug: "svc-arabia-sup",
          name_ar: "التعليم العالي",
          name_fr: "Enseignement supérieur",
        },
      ],
    },
    {
      username: "nedjari.anissa",
      name: "نجاري أنيسة",
      job_title: "متصرف رئيسي بالديوان",
      services: [
        { slug: "svc-nedjari-jeunesse", name_ar: "الشباب و الرياضة", name_fr: "Jeunesse et sports" },
        {
          slug: "svc-nedjari-affaires-religieuses",
          name_ar: "الشؤون الدينية و الأوقاف",
          name_fr: "Affaires religieuses et wakfs",
        },
        { slug: "svc-nedjari-culture", name_ar: "الثقافة و الفنون", name_fr: "Culture et arts" },
        {
          slug: "svc-nedjari-moudjahidine",
          name_ar: "المجاهدين و ذوي الحقوق",
          name_fr: "Moudjahidine et ayants droit",
        },
        {
          slug: "svc-nedjari-associatif",
          name_ar: "الحركة الجمعوية",
          name_fr: "Mouvement associatif",
        },
        { slug: "svc-nedjari-haut-patronage", name_ar: "الرعاية السامية", name_fr: "Haut patronage" },
        { slug: "svc-nedjari-receptions", name_ar: "الاستقبالات", name_fr: "Réceptions" },
        {
          slug: "svc-nedjari-deputes",
          name_ar: "اللقاءات الدورية مع نواب البرلمان",
          name_fr: "Rencontres périodiques avec les députés",
        },
        { slug: "svc-nedjari-aides", name_ar: "الإعانات المالية", name_fr: "Aides financières" },
        {
          slug: "svc-nedjari-omra",
          name_ar: "المستفيدين من العمرة",
          name_fr: "Bénéficiaires de la Omra",
        },
        {
          slug: "svc-nedjari-evenements",
          name_ar: "التحضير لمختلف الفعاليات",
          name_fr: "Préparation des événements",
        },
      ],
    },
    {
      username: "moussaoui.chawki",
      name: "موسوي شوقي",
      job_title: "مهندس رئيس",
      services: [
        { slug: "svc-moussaoui-energie", name_ar: "الطاقة والمناجم", name_fr: "Énergie et mines" },
        {
          slug: "svc-moussaoui-sorties-wali",
          name_ar: "خرجات السيد الوالي",
          name_fr: "Sorties du wali",
        },
        {
          slug: "svc-moussaoui-instructions-executif",
          name_ar: "تعليمات السيد الوالي خلال المجلس التنفيذي للولاية",
          name_fr: "Instructions du wali — conseil exécutif",
        },
      ],
    },
    {
      username: "chafai.zahra",
      name: "شافعي زهرة",
      job_title: "متصرف مستشار",
      services: [
        {
          slug: "svc-chafai-protocole",
          name_ar: "التشريفات و الملفات ذات الطابع الخاص",
          name_fr: "Protocole et dossiers spéciaux",
        },
      ],
    },
    {
      username: "halilim.benamar",
      name: "حليلم بن اعمر",
      job_title: "متصرف اداري",
      services: [
        {
          slug: "svc-halilim-personnel",
          name_ar: "المستخدمين و ملفات ذات طابع خاص",
          name_fr: "Personnel et dossiers spéciaux",
        },
      ],
    },
    {
      username: "bendaoud.amina",
      name: "بن داود أمينة",
      job_title: "رئيس المفتشين في النظافة و النقاوة العمومية و البيئة",
      services: [
        { slug: "svc-bendaoud-sante", name_ar: "الصحة و السكان", name_fr: "Santé et population" },
        { slug: "svc-bendaoud-commerce", name_ar: "التجارة", name_fr: "Commerce" },
        {
          slug: "svc-bendaoud-solidarite",
          name_ar: "النشاط الاجتماعي و التضامن",
          name_fr: "Action sociale et solidarité",
        },
        {
          slug: "svc-bendaoud-enfance",
          name_ar: "الهيئة الوطنية لحماية و ترقية الطفولة",
          name_fr: "Protection et promotion de l'enfance",
        },
        {
          slug: "svc-bendaoud-ramadan",
          name_ar: "العملية التضامنية لشهر رمضان",
          name_fr: "Opération solidarité Ramadan",
        },
      ],
    },
  ],
};
