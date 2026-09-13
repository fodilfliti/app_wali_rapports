const { resolveSharedDist } = require("../../lib/resolveShared");
const {
  CREATOR_ROLES,
  CREATOR_KEYS,
  CREATOR_KEY_TO_ROLE,
  isCreatorRole,
  hidesCommuneListContentKind,
  hidesFicheLectureContentKind,
  blocksOrgHeadReturnToDraft,
  roleFromCreatorKey,
  creatorKeyFromRole,
} = require(resolveSharedDist("access-policy"));

const CREATOR_ROLE_LIST = [...CREATOR_ROLES];

/** Body flags → role for instruction/broadcast “select all of role”. */
const ALL_ROLE_FLAGS = {
  all_office: "OFFICE_USER",
  all_daira: "PRESIDENT_DAIRA",
  all_commune: "PRESIDENT_COMMUNE",
  all_direction: "DIRECTEUR_DIRECTION",
  all_wali: "WALI",
};

function truthyFlag(v) {
  return v === true || v === "1" || v === "true" || v === "on";
}

/**
 * Resolve recipient user ids from body:
 * - all_office / all_daira / all_commune / all_direction / all_wali
 * - all_roles: string[] of UserRole or CreatorKey
 * - recipient_ids / recipient_user_ids
 */
async function resolveCreatorRecipientIds(body, { User, Op, resolveNumericId }) {
  const roleSet = new Set();

  for (const [flag, role] of Object.entries(ALL_ROLE_FLAGS)) {
    if (truthyFlag(body[flag])) roleSet.add(role);
  }

  let allRoles = body.all_roles;
  if (typeof allRoles === "string") {
    try {
      allRoles = JSON.parse(allRoles);
    } catch {
      allRoles = allRoles.split(",").map((s) => s.trim());
    }
  }
  if (Array.isArray(allRoles)) {
    for (const r of allRoles) {
      const asRole = roleFromCreatorKey(String(r)) || (isCreatorRole(r) ? r : null);
      if (asRole) roleSet.add(asRole);
    }
  }

  const ids = new Set();

  if (roleSet.size > 0) {
    const users = await User.findAll({
      where: {
        role: { [Op.in]: [...roleSet] },
        is_blocked: false,
        deleted_at: null,
      },
      attributes: ["id"],
    });
    for (const u of users) ids.add(u.id);
  }

  const raw =
    body.recipient_ids ?? body.recipient_user_ids ?? null;
  if (raw) {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(arr)) {
      for (const id of arr) {
        const nid = await resolveNumericId(User, id);
        if (nid) ids.add(nid);
      }
    }
  }

  return [...ids];
}

module.exports = {
  CREATOR_ROLES: CREATOR_ROLE_LIST,
  CREATOR_KEYS,
  CREATOR_KEY_TO_ROLE,
  ALL_ROLE_FLAGS,
  isCreatorRole,
  hidesCommuneListContentKind,
  hidesFicheLectureContentKind,
  blocksOrgHeadReturnToDraft,
  roleFromCreatorKey,
  creatorKeyFromRole,
  resolveCreatorRecipientIds,
  truthyFlag,
};
