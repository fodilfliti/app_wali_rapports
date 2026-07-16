const ACCESS_LEVELS = ["none", "view", "manage"];

const PERMISSIONS = [
  { key: "hub.dashboard", scope: "both", module: "hub", label_fr: "Tableau de bord", label_ar: "لوحة التحكم" },
  { key: "organization.municipalities.view", scope: "admin", module: "organization", label_fr: "Communes — consulter", label_ar: "البلديات — عرض" },
  { key: "organization.municipalities.manage", scope: "admin", module: "organization", label_fr: "Communes — gérer", label_ar: "البلديات — إدارة" },
  { key: "organization.users.view", scope: "admin", module: "organization", label_fr: "Utilisateurs — consulter", label_ar: "المستخدمون — عرض" },
  { key: "organization.users.manage", scope: "admin", module: "organization", label_fr: "Utilisateurs — gérer", label_ar: "المستخدمون — إدارة" },
  { key: "organization.access_roles.manage", scope: "admin", module: "organization", label_fr: "Profils d'accès — gérer", label_ar: "ملفات الوصول — إدارة" },
  { key: "rapports.investissement.view", scope: "office", module: "rapports", label_fr: "Investissement — consulter", label_ar: "الاستثمار — عرض" },
  { key: "rapports.investissement.manage", scope: "office", module: "rapports", label_fr: "Investissement — gérer", label_ar: "الاستثمار — إدارة" },
  { key: "rapports.investissement.export", scope: "office", module: "rapports", label_fr: "Investissement — exporter", label_ar: "الاستثمار — تصدير" },
  { key: "rapports.finance.view", scope: "office", module: "rapports", label_fr: "Finance — consulter", label_ar: "المالية — عرض" },
  { key: "rapports.finance.manage", scope: "office", module: "rapports", label_fr: "Finance — gérer", label_ar: "المالية — إدارة" },
  { key: "rapports.finance.export", scope: "office", module: "rapports", label_fr: "Finance — exporter", label_ar: "المالية — تصدير" },
  { key: "rapports.hydraulique.view", scope: "office", module: "rapports", label_fr: "Hydraulique — consulter", label_ar: "الموارد المائية — عرض" },
  { key: "rapports.hydraulique.manage", scope: "office", module: "rapports", label_fr: "Hydraulique — gérer", label_ar: "الموارد المائية — إدارة" },
  { key: "rapports.hydraulique.export", scope: "office", module: "rapports", label_fr: "Hydraulique — exporter", label_ar: "الموارد المائية — تصدير" },
  { key: "rapports.inbox.view", scope: "wali", module: "rapports", label_fr: "Boîte de réception — consulter", label_ar: "الوارد — عرض" },
  { key: "rapports.inbox.respond", scope: "wali", module: "rapports", label_fr: "Boîte de réception — répondre", label_ar: "الوارد — الرد" }
];

const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

function levelRank(level) {
  if (level === "manage") return 2;
  if (level === "view") return 1;
  return 0;
}

function permissionAppliesToAccount(perm, accountRole) {
  if (perm.scope === "both") return true;
  if (perm.scope === "admin" && accountRole === "ADMIN") return true;
  if (perm.scope === "office" && accountRole === "OFFICE_USER") return true;
  if (perm.scope === "wali" && (accountRole === "WALI" || accountRole === "CHEF_CABINET")) return true;
  if (perm.scope === "chef" && accountRole === "CHEF_CABINET") return true;
  if (accountRole === "ADMIN") return true;
  return false;
}

module.exports = { ACCESS_LEVELS, PERMISSIONS, PERMISSION_KEYS, levelRank, permissionAppliesToAccount };
