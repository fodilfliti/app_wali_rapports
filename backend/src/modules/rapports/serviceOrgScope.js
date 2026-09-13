const ORG_SCOPES = ["diwan", "daira", "commune", "direction"];

const ROLE_BY_ORG_SCOPE = {
  diwan: "OFFICE_USER",
  daira: "PRESIDENT_DAIRA",
  commune: "PRESIDENT_COMMUNE",
  direction: "DIRECTEUR_DIRECTION",
};

const ORG_SCOPE_BY_ROLE = {
  OFFICE_USER: "diwan",
  PRESIDENT_DAIRA: "daira",
  PRESIDENT_COMMUNE: "commune",
  DIRECTEUR_DIRECTION: "direction",
};

const UNIT_FK_BY_SCOPE = {
  daira: "daira_id",
  commune: "municipality_id",
  direction: "direction_id",
};

function isOrgScope(value) {
  return ORG_SCOPES.includes(String(value || ""));
}

function roleForOrgScope(orgScope) {
  return ROLE_BY_ORG_SCOPE[orgScope] || null;
}

function orgScopeForRole(role) {
  return ORG_SCOPE_BY_ROLE[role] || null;
}

function unitFkForOrgScope(orgScope) {
  return UNIT_FK_BY_SCOPE[orgScope] || null;
}

module.exports = {
  ORG_SCOPES,
  ROLE_BY_ORG_SCOPE,
  ORG_SCOPE_BY_ROLE,
  UNIT_FK_BY_SCOPE,
  isOrgScope,
  roleForOrgScope,
  orgScopeForRole,
  unitFkForOrgScope,
};
