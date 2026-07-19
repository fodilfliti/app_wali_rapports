const { Op } = require("sequelize");
const {
  sequelize,
  Service,
  Department,
  RapportType,
  Rapport,
  RapportVersion,
  WaliResponse,
  ChefResponse,
  Notification,
  User,
  WaliBroadcast,
  RapportView,
  RapportComment,
} = require("../../db");
const { audit } = require("../../services/audit");
const { loadSchemaBySlug } = require("./tableGridService");
const {
  DEDICATED_NOTIFICATION_KEYS,
  disabledMessageKeys,
} = require("./notificationKeys");
const { notifyUsers, notifyActiveRole } = require("../notifications/notifyService");
const { getPreferences } = require("../notifications/preferenceService");

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(query.pageSize, 10) || 20),
  );
  return { page, pageSize, offset: (page - 1) * pageSize, limit: pageSize };
}

async function listServices() {
  return Service.findAll({
    where: { is_active: true },
    order: [
      ["sort_order", "ASC"],
      ["id", "ASC"],
    ],
    include: [
      {
        model: Department,
        as: "department",
        attributes: ["id", "name_ar", "name_fr"],
      },
      {
        model: RapportType,
        as: "rapportTypes",
        attributes: [
          "id",
          "slug",
          "name_ar",
          "name_fr",
          "layout_kind",
          "versioning_mode",
          "content_kind",
        ],
      },
    ],
  });
}

async function unreadDiscussionRapportIds(userId) {
  if (!userId) return [];
  const rows = await Notification.findAll({
    where: {
      user_id: userId,
      message_key: "rapportComment",
      read_at: null,
      rapport_id: { [Op.ne]: null },
    },
    attributes: ["rapport_id"],
    group: ["rapport_id"],
    raw: true,
  });
  return rows.map((r) => Number(r.rapport_id)).filter(Boolean);
}

/** Statuses visible in Wali discussion / inbox lists (never pending_chef / draft). */
const WALI_INBOX_STATUSES = [
  "submitted",
  "under_review",
  "changes_requested",
  "acknowledged",
];

/** Default Chef inbox list (never draft / archived). */
const CHEF_INBOX_STATUSES = [
  "pending_chef",
  "submitted",
  "under_review",
  "changes_requested",
  "acknowledged",
];

const OFFICE_IN_PROGRESS_STATUSES = [
  "draft",
  "pending_chef",
  "submitted",
  "under_review",
];

function normalizeStatusGroup(query) {
  const g = String(query?.status_group || "")
    .trim()
    .toLowerCase();
  if (!g || g === "all") return null;
  if (["in_progress", "needs_edit", "done", "new"].includes(g)) return g;
  return null;
}

/** List sort field: default created_at (DESC). */
function normalizeListSort(query) {
  const s = String(query?.sort || "")
    .trim()
    .toLowerCase();
  if (s === "updated_at") return "updated_at";
  return "created_at";
}

async function viewedRapportIdsForUser(userId) {
  if (!userId) return [];
  const rows = await RapportView.findAll({
    where: { user_id: userId },
    attributes: ["rapport_id"],
    raw: true,
  });
  return rows.map((r) => Number(r.rapport_id)).filter(Boolean);
}

/**
 * Apply status_group (preferred) or raw status onto `where`.
 * Role comes from opts: inboxOnly (Wali), chefInbox (Chef), else Office/Admin.
 */
async function applyStatusListFilter(where, query, opts = {}) {
  const group = normalizeStatusGroup(query);

  if (group) {
    if (opts.inboxOnly) {
      // Wali
      if (group === "new") {
        const viewedIds = await viewedRapportIdsForUser(opts.enrichForWaliUserId);
        where.status = "submitted";
        if (viewedIds.length) {
          where.id = where.id
            ? { [Op.and]: [where.id, { [Op.notIn]: viewedIds }] }
            : { [Op.notIn]: viewedIds };
        }
        return;
      }
      if (group === "in_progress") {
        const viewedIds = await viewedRapportIdsForUser(opts.enrichForWaliUserId);
        delete where.status;
        if (viewedIds.length) {
          where[Op.or] = [
            { status: "under_review" },
            { status: "submitted", id: { [Op.in]: viewedIds } },
          ];
        } else {
          where.status = "under_review";
        }
        return;
      }
      if (group === "needs_edit") {
        where.status = "changes_requested";
        return;
      }
      if (group === "done") {
        where.status = "acknowledged";
        return;
      }
      return;
    }

    if (opts.chefInbox) {
      if (group === "new") {
        where.status = "pending_chef";
        return;
      }
      if (group === "in_progress") {
        where.status = { [Op.in]: ["submitted", "under_review"] };
        return;
      }
      if (group === "needs_edit") {
        where.status = "changes_requested";
        return;
      }
      if (group === "done") {
        where.status = "acknowledged";
        return;
      }
      return;
    }

    // Office / Admin — no `new` chip; ignore if sent
    if (group === "new") return;
    if (group === "in_progress") {
      where.status = { [Op.in]: OFFICE_IN_PROGRESS_STATUSES };
      return;
    }
    if (group === "needs_edit") {
      where.status = "changes_requested";
      return;
    }
    if (group === "done") {
      where.status = "acknowledged";
    }
    return;
  }

  if (query.status) {
    where.status = query.status;
  }
}

/**
 * Rapports that have ≥1 comment, ordered by latest comment time DESC.
 * Returns { ids, lastCommentById, total } after visibility + optional search filters.
 */
async function officeDiscussionScopeIds(userId) {
  if (!userId) return new Set();
  const { getAccessMapForUser } = require("./serviceAccessService");
  const accessMap = await getAccessMapForUser(userId);
  const serviceIds = Object.keys(accessMap)
    .map(Number)
    .filter(Boolean);

  const [ownedRows, commentRows, serviceRows] = await Promise.all([
    Rapport.findAll({
      where: {
        [Op.or]: [
          { owner_office_user_id: userId },
          { created_by_user_id: userId },
        ],
      },
      attributes: ["id"],
      raw: true,
    }),
    RapportComment.findAll({
      where: { author_user_id: userId },
      attributes: ["rapport_id"],
      group: ["rapport_id"],
      raw: true,
    }),
    serviceIds.length
      ? Rapport.findAll({
          where: {
            service_id: { [Op.in]: serviceIds },
            hidden_at: null,
            status: { [Op.ne]: "draft" },
          },
          attributes: ["id"],
          raw: true,
        })
      : Promise.resolve([]),
  ]);
  const ids = new Set();
  for (const row of ownedRows) {
    const id = Number(row.id);
    if (id) ids.add(id);
  }
  for (const row of commentRows) {
    const id = Number(row.rapport_id);
    if (id) ids.add(id);
  }
  for (const row of serviceRows) {
    const id = Number(row.id);
    if (id) ids.add(id);
  }
  return ids;
}

async function discussedRapportsOrdered(query, opts = {}) {
  const commentRows = await RapportComment.findAll({
    attributes: [
      "rapport_id",
      [sequelize.fn("MAX", sequelize.col("RapportComment.created_at")), "last_comment_at"],
    ],
    group: ["rapport_id"],
    raw: true,
  });
  if (!commentRows.length) {
    return { ids: [], lastCommentById: new Map(), total: 0 };
  }

  const lastCommentById = new Map();
  for (const row of commentRows) {
    const id = Number(row.rapport_id);
    if (!id) continue;
    lastCommentById.set(id, row.last_comment_at);
  }
  let candidateIds = [...lastCommentById.keys()];

  if (opts.forOfficeUserId) {
    const scope = await officeDiscussionScopeIds(opts.forOfficeUserId);
    candidateIds = candidateIds.filter((id) => scope.has(id));
    if (!candidateIds.length) {
      return { ids: [], lastCommentById: new Map(), total: 0 };
    }
  }

  const where = {
    id: { [Op.in]: candidateIds },
    hidden_at: null,
  };
  if (opts.inboxOnly) {
    where.status = { [Op.in]: WALI_INBOX_STATUSES };
  } else {
    where.status = { [Op.ne]: "draft" };
  }
  if (query.status) where.status = query.status;
  if (query.service_id) where.service_id = query.service_id;
  if (query.rapport_type_id) where.rapport_type_id = query.rapport_type_id;
  if (query.search) {
    where.title = { [Op.iLike]: `%${String(query.search).trim()}%` };
  }

  const visible = await Rapport.findAll({
    where,
    attributes: ["id"],
    raw: true,
  });
  const visibleIds = new Set(visible.map((r) => Number(r.id)));

  const sorted = [...lastCommentById.entries()]
    .filter(([id]) => visibleIds.has(id))
    .sort((a, b) => {
      const ta = a[1] ? new Date(a[1]).getTime() : 0;
      const tb = b[1] ? new Date(b[1]).getTime() : 0;
      return tb - ta;
    });

  return {
    ids: sorted.map(([id]) => id),
    lastCommentById,
    total: sorted.length,
  };
}

async function lastCommentAtByRapportIds(rapportIds) {
  const map = new Map();
  if (!rapportIds?.length) return map;
  const rows = await RapportComment.findAll({
    where: { rapport_id: { [Op.in]: rapportIds } },
    attributes: [
      "rapport_id",
      [sequelize.fn("MAX", sequelize.col("RapportComment.created_at")), "last_comment_at"],
    ],
    group: ["rapport_id"],
    raw: true,
  });
  for (const row of rows) {
    map.set(Number(row.rapport_id), row.last_comment_at);
  }
  return map;
}

async function unreadDiscussionSetForUser(userId, rapportIds) {
  const set = new Set();
  if (!userId || !rapportIds?.length) return set;
  const rows = await Notification.findAll({
    where: {
      user_id: userId,
      message_key: "rapportComment",
      read_at: null,
      rapport_id: { [Op.in]: rapportIds },
    },
    attributes: ["rapport_id"],
    group: ["rapport_id"],
    raw: true,
  });
  for (const row of rows) set.add(Number(row.rapport_id));
  return set;
}

async function attachDiscussionListMeta(rapports, userId, lastCommentById) {
  if (!rapports?.length) return rapports;
  const ids = rapports.map((r) => Number(r.id)).filter(Boolean);
  let commentMap = lastCommentById;
  if (!commentMap || !(commentMap instanceof Map)) {
    commentMap = await lastCommentAtByRapportIds(ids);
  }
  const unreadSet = await unreadDiscussionSetForUser(userId, ids);
  return rapports.map((r) => {
    const rid = Number(r.id);
    return {
      ...r,
      last_comment_at: commentMap.get(rid) || null,
      has_unread_discussion: unreadSet.has(rid),
    };
  });
}

async function listRapports(query, opts = {}) {
  const { page, pageSize, offset, limit } = parsePagination(query);
  const where = {};
  const statusGroup = normalizeStatusGroup(query);
  if (query.service_id) where.service_id = query.service_id;
  if (query.rapport_type_id) where.rapport_type_id = query.rapport_type_id;
  const ownerUserId = Number(
    query.owner_user_id || query.office_user_id || query.owner_office_user_id,
  );
  if (Number.isFinite(ownerUserId) && ownerUserId > 0) {
    where[Op.and] = [
      ...(Array.isArray(where[Op.and]) ? where[Op.and] : []),
      {
        [Op.or]: [
          { owner_office_user_id: ownerUserId },
          { created_by_user_id: ownerUserId },
        ],
      },
    ];
  }
  if (query.search) {
    where.title = { [Op.iLike]: `%${String(query.search).trim()}%` };
  }
  if (query.has_version === "1" || query.has_version === "true") {
    where.current_version_id = { [Op.ne]: null };
  }

  const discussionOnly =
    query.unread_discussion === "1" || query.unread_discussion === "true";
  const hasDiscussion =
    query.has_discussion === "1" || query.has_discussion === "true";
  const discussionUserId =
    opts.enrichForWaliUserId ||
    opts.discussionUserId ||
    opts.enrichForOfficeUserId ||
    null;

  let orderByLastComment = false;
  let lastCommentById = null;
  let forcedTotal = null;

  if (hasDiscussion && !discussionOnly) {
    const discussed = await discussedRapportsOrdered(query, opts);
    if (!discussed.ids.length) {
      return { rapports: [], total: 0, page, pageSize };
    }
    const pageIds = discussed.ids.slice(offset, offset + limit);
    if (!pageIds.length) {
      return { rapports: [], total: discussed.total, page, pageSize };
    }
    where.id = { [Op.in]: pageIds };
    where.hidden_at = null;
    orderByLastComment = true;
    lastCommentById = discussed.lastCommentById;
    forcedTotal = discussed.total;
    // Visibility already applied in discussedRapportsOrdered; avoid double-filtering status
    // unless caller passed an explicit status / status_group.
    if (!query.status && !statusGroup && opts.inboxOnly) {
      where.status = { [Op.in]: WALI_INBOX_STATUSES };
    }
  } else if (discussionOnly) {
    let ids = await unreadDiscussionRapportIds(discussionUserId);
    if (opts.forOfficeUserId) {
      const scope = await officeDiscussionScopeIds(opts.forOfficeUserId);
      ids = ids.filter((id) => scope.has(id));
    }
    if (!ids.length) {
      return { rapports: [], total: 0, page, pageSize };
    }
    where.id = { [Op.in]: ids };
    where.hidden_at = null;
    // Discussion can span statuses; Wali still never sees pending_chef
    if (opts.inboxOnly) {
      where.status = {
        [Op.in]: WALI_INBOX_STATUSES,
      };
    }
  } else if (opts.inboxOnly) {
    // Wali inbox / badges: never include pending_chef (Chef has not accepted yet).
    // Default set when no status_group / status; group filter narrows below.
    if (!statusGroup && !query.status) {
      where.status = { [Op.in]: WALI_INBOX_STATUSES };
    } else if (!statusGroup && query.status) {
      if (WALI_INBOX_STATUSES.includes(String(query.status))) {
        where.status = query.status;
      } else {
        where.status = { [Op.in]: [] };
      }
    }
    where.hidden_at = null;
  } else if (opts.chefInbox && !statusGroup && !query.status) {
    where.status = { [Op.in]: CHEF_INBOX_STATUSES };
    where.hidden_at = null;
  }

  // Prefer status_group over raw status (skip when raw status already applied for Wali above).
  if (!(opts.inboxOnly && !statusGroup && query.status)) {
    await applyStatusListFilter(where, query, opts);
  }

  // Office: only rapports in services the user is granted.
  if (opts.restrictToOfficeUserId) {
    const { getAccessMapForUser } = require("./serviceAccessService");
    const accessMap = await getAccessMapForUser(opts.restrictToOfficeUserId);
    const grantedIds = Object.keys(accessMap).map(Number).filter(Boolean);
    if (!grantedIds.length) {
      return { rapports: [], total: 0, page, pageSize };
    }
    if (where.service_id != null) {
      const requested = Number(where.service_id);
      if (!grantedIds.includes(requested)) {
        return { rapports: [], total: 0, page, pageSize };
      }
    } else {
      where.service_id = { [Op.in]: grantedIds };
    }
  }

  if (query.hidden_only === "1" || query.hidden_only === "true") {
    where.hidden_at = { [Op.ne]: null };
  } else if (query.include_hidden !== "1" && query.include_hidden !== "true") {
    if (where.hidden_at === undefined) {
      where.hidden_at = null;
    }
  }

  const rapportTypeInclude = {
    model: RapportType,
    as: "rapportType",
    attributes: [
      "id",
      "slug",
      "name_ar",
      "name_fr",
      "layout_kind",
      "versioning_mode",
      "content_kind",
    ],
  };
  const importable = query.importable === "1" || query.importable === "true";
  if (importable && !query.content_kind) {
    query.content_kind = "table_grid";
  }
  if (importable) {
    rapportTypeInclude.attributes = [
      "id",
      "slug",
      "name_ar",
      "name_fr",
      "layout_kind",
      "versioning_mode",
      "content_kind",
      "schema_json",
    ];
  }
  if (query.content_kind) {
    rapportTypeInclude.where = { content_kind: query.content_kind };
    rapportTypeInclude.required = true;
  }

  const includes = [
    {
      model: Service,
      as: "service",
      attributes: ["id", "slug", "name_ar", "name_fr"],
    },
    rapportTypeInclude,
    {
      model: User,
      as: "createdByUser",
      attributes: ["id", "name", "username"],
    },
  ];
  if (importable) {
    includes.push({
      model: RapportVersion,
      as: "currentVersion",
      attributes: ["id", "data_json"],
      required: false,
    });
  }

  // When ordering by last comment, we already sliced ids for this page — no offset/limit here.
  const sortField = normalizeListSort(query);
  const findOpts = {
    where,
    order: [[sortField, "DESC"]],
    include: includes,
    distinct: true,
    col: "id",
  };
  if (!orderByLastComment) {
    findOpts.offset = offset;
    findOpts.limit = limit;
  }

  const { rows, count } = await Rapport.findAndCountAll(findOpts);

  let rapports = rows;
  if (importable) {
    const schemaCache = new Map();
    const enriched = [];
    for (const r of rows) {
      const plain = r.toJSON ? r.toJSON() : r;
      if (plain.rapportType?.content_kind !== "table_grid") continue;
      const table = plain.currentVersion?.data_json?.tables?.[0];
      if (!table?.rows?.length) continue;

      const slug = plain.rapportType?.schema_json?.table_schema_slug;
      let schema_name_ar = null;
      let schema_name_fr = null;
      let column_count = 0;
      const column_labels_ar = [];
      const column_labels_fr = [];
      if (slug) {
        if (!schemaCache.has(slug)) {
          try {
            schemaCache.set(slug, await loadSchemaBySlug(slug));
          } catch {
            schemaCache.set(slug, null);
          }
        }
        const sch = schemaCache.get(slug);
        if (sch) {
          schema_name_ar = sch.name_ar;
          schema_name_fr = sch.name_fr;
          const cols = sch.columns_json || [];
          column_count = cols.length;
          for (const col of cols.slice(0, 10)) {
            column_labels_ar.push(col.label_ar);
            column_labels_fr.push(col.label_fr);
          }
        }
      }

      const { currentVersion, ...rest } = plain;
      enriched.push({
        ...rest,
        import_summary: {
          schema_name_ar,
          schema_name_fr,
          rapport_type_name_ar: plain.rapportType?.name_ar,
          rapport_type_name_fr: plain.rapportType?.name_fr,
          table_title_ar: table.title_ar,
          table_title_fr: table.title_fr,
          row_count: table.rows.length,
          column_count,
          column_labels_ar,
          column_labels_fr,
        },
      });
    }
    rapports = enriched;
  } else {
    rapports = rows.map((r) => (r.toJSON ? r.toJSON() : r));
  }

  if (orderByLastComment && lastCommentById && Array.isArray(where.id?.[Op.in])) {
    const orderIndex = new Map(
      where.id[Op.in].map((id, i) => [Number(id), i]),
    );
    rapports.sort(
      (a, b) =>
        (orderIndex.get(Number(a.id)) ?? 0) - (orderIndex.get(Number(b.id)) ?? 0),
    );
  }

  if (opts.enrichForOfficeUserId) {
    rapports = await enrichOfficeRapportList(
      rapports,
      opts.enrichForOfficeUserId,
    );
  }

  if (opts.enrichForWaliUserId) {
    rapports = await enrichWaliRapportList(rapports, opts.enrichForWaliUserId);
  }

  if (discussionOnly || hasDiscussion) {
    if (!lastCommentById) {
      lastCommentById = await lastCommentAtByRapportIds(
        rapports.map((r) => Number(r.id)),
      );
    }
    rapports = await attachDiscussionListMeta(
      rapports,
      discussionUserId,
      lastCommentById,
    );
  }

  return {
    rapports,
    total: importable
      ? rapports.length
      : forcedTotal != null
        ? forcedTotal
        : count,
    page,
    pageSize,
  };
}

function latestResponseMap(rows) {
  const latestByRapport = new Map();
  for (const row of rows) {
    const rid = Number(row.rapport_id);
    if (!latestByRapport.has(rid)) {
      latestByRapport.set(rid, {
        decision: row.decision,
        follow_up_status: row.follow_up_status,
        body_text: row.body_text,
        created_at: row.created_at,
      });
    }
  }
  return latestByRapport;
}

const RESPONSE_LIST_ATTRS = [
  "rapport_id",
  "decision",
  "follow_up_status",
  "body_text",
  "created_at",
];

async function enrichWaliRapportList(rapports, waliUserId) {
  if (!rapports?.length || !waliUserId) return rapports;
  const ids = rapports.map((r) => Number(r.id)).filter(Boolean);
  if (!ids.length) return rapports;

  const [views, responses, chefResponses] = await Promise.all([
    RapportView.findAll({
      where: { rapport_id: ids, user_id: waliUserId },
      attributes: ["rapport_id"],
    }),
    WaliResponse.findAll({
      where: { rapport_id: ids },
      order: [["created_at", "DESC"]],
      attributes: RESPONSE_LIST_ATTRS,
    }),
    ChefResponse.findAll({
      where: { rapport_id: ids },
      order: [["created_at", "DESC"]],
      attributes: RESPONSE_LIST_ATTRS,
    }),
  ]);

  const viewedSet = new Set(views.map((v) => Number(v.rapport_id)));
  const latestByRapport = latestResponseMap(responses);
  const latestChefByRapport = latestResponseMap(chefResponses);

  return rapports.map((r) => {
    const rid = Number(r.id);
    const wali_viewed = viewedSet.has(rid);
    return {
      ...r,
      wali_viewed,
      is_inbox_new: r.status === "submitted" && !wali_viewed,
      latest_wali_response: latestByRapport.get(rid) || null,
      latest_chef_response: latestChefByRapport.get(rid) || null,
    };
  });
}

async function enrichOfficeRapportList(rapports, userId) {
  if (!rapports?.length || !userId) return rapports;
  const ids = rapports.map((r) => Number(r.id)).filter(Boolean);
  if (!ids.length) return rapports;

  const [responses, chefResponses, unreadNotes] = await Promise.all([
    WaliResponse.findAll({
      where: { rapport_id: ids },
      order: [["created_at", "DESC"]],
      attributes: RESPONSE_LIST_ATTRS,
    }),
    ChefResponse.findAll({
      where: { rapport_id: ids },
      order: [["created_at", "DESC"]],
      attributes: RESPONSE_LIST_ATTRS,
    }),
    Notification.findAll({
      where: { user_id: userId, rapport_id: ids, read_at: null },
      attributes: ["rapport_id"],
    }),
  ]);

  const latestByRapport = latestResponseMap(responses);
  const latestChefByRapport = latestResponseMap(chefResponses);
  const unreadSet = new Set(unreadNotes.map((n) => Number(n.rapport_id)));

  return rapports.map((r) => ({
    ...r,
    latest_wali_response: latestByRapport.get(Number(r.id)) || null,
    latest_chef_response: latestChefByRapport.get(Number(r.id)) || null,
    has_unread_notification: unreadSet.has(Number(r.id)),
  }));
}

async function assertVisibleToWali(rapportOrId) {
  const rapport =
    typeof rapportOrId === "object" && rapportOrId?.status != null
      ? rapportOrId
      : await Rapport.findByPk(rapportOrId, {
          attributes: ["id", "status", "hidden_at"],
        });
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (
    rapport.status === "pending_chef" ||
    rapport.status === "draft" ||
    rapport.hidden_at
  ) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return rapport;
}

/** Statuses Chef may open outside a hard IDOR (includes pending_chef; never drafts). */
const CHEF_VISIBLE_STATUSES = [
  "pending_chef",
  "submitted",
  "under_review",
  "changes_requested",
  "acknowledged",
];

async function assertVisibleToChef(rapportOrId) {
  const rapport =
    typeof rapportOrId === "object" && rapportOrId?.status != null
      ? rapportOrId
      : await Rapport.findByPk(rapportOrId, {
          attributes: ["id", "status", "hidden_at"],
        });
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (rapport.hidden_at || rapport.status === "draft") {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!CHEF_VISIBLE_STATUSES.includes(rapport.status)) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return rapport;
}

async function getRapportDetail(id, versionId = null) {
  const rapport = await Rapport.findByPk(id, {
    include: [
      { model: Service, as: "service" },
      { model: RapportType, as: "rapportType" },
      { model: RapportVersion, as: "currentVersion" },
      { model: RapportVersion, as: "versions" },
      {
        model: WaliResponse,
        as: "waliResponses",
        separate: true,
        order: [["created_at", "DESC"]],
        include: [
          { model: User, as: "createdByUser", attributes: ["id", "name"] },
        ],
      },
      {
        model: ChefResponse,
        as: "chefResponses",
        separate: true,
        order: [["created_at", "DESC"]],
        include: [
          { model: User, as: "createdByUser", attributes: ["id", "name"] },
        ],
      },
      { model: User, as: "createdByUser", attributes: ["id", "name"] },
    ],
  });
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const plain = rapport.toJSON ? rapport.toJSON() : rapport;

  if (versionId) {
    const requestedVersion = await RapportVersion.findOne({
      where: { id: versionId, rapport_id: id },
    });
    if (requestedVersion) {
      plain.currentVersion = requestedVersion.toJSON
        ? requestedVersion.toJSON()
        : requestedVersion;
    }
  } else if (
    !plain.currentVersion &&
    plain.current_version_id &&
    plain.versions?.length
  ) {
    plain.currentVersion =
      plain.versions.find((v) => v.id === plain.current_version_id) ||
      plain.versions[0];
  }

  return plain;
}

async function createRapport(data, actor, req) {
  const rapportType = await RapportType.findByPk(data.rapport_type_id);
  if (
    !rapportType ||
    Number(rapportType.service_id) !== Number(data.service_id)
  ) {
    const err = new Error("Invalid rapport type");
    err.status = 400;
    throw err;
  }

  let data_json = data.data_json || {};
  if (rapportType.content_kind === "commune_list") {
    const { getIncludedEntityKeys } = require("./entityKeys");
    if (!getIncludedEntityKeys(data_json)) {
      const prevFinished = await Rapport.findOne({
        where: {
          service_id: data.service_id,
          rapport_type_id: rapportType.id,
          hidden_at: { [Op.ne]: null },
        },
        order: [["updated_at", "DESC"]],
        include: [{ model: RapportVersion, as: "currentVersion" }],
      });
      const inherited = getIncludedEntityKeys(
        prevFinished?.currentVersion?.data_json || {},
      );
      if (inherited) {
        data_json = { ...data_json, included_entity_keys: inherited };
      }
    }
    if (!data_json.communes) data_json = { ...data_json, communes: {} };
    if (!data_json.entities) data_json = { ...data_json, entities: {} };
  }

  const rapport = await Rapport.create({
    service_id: data.service_id,
    rapport_type_id: data.rapport_type_id,
    title: data.title,
    reference_date: data.reference_date || null,
    status: "draft",
    chef_gate: "required",
    created_by_user_id: actor.id,
    owner_office_user_id:
      rapportType.content_kind === "fiche_lecture"
        ? null
        : actor.role === "OFFICE_USER"
          ? actor.id
          : data.owner_office_user_id || actor.id,
  });
  const version = await RapportVersion.create({
    rapport_id: rapport.id,
    version_number: 1,
    data_json,
    created_by_user_id: actor.id,
  });
  await rapport.update({ current_version_id: version.id });
  await audit(actor.id, "RAPPORT_CREATE", { rapport_id: rapport.id }, { req });
  return getRapportDetail(rapport.id);
}

async function updateRapportDraft(id, data, actor, req) {
  let rapport = await Rapport.findByPk(id, {
    include: [
      { model: RapportVersion, as: "currentVersion" },
      { model: RapportType, as: "rapportType" },
    ],
  });
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!["draft", "changes_requested"].includes(rapport.status)) {
    const err = new Error("Rapport not editable");
    err.status = 409;
    throw err;
  }
  if (rapport.currentVersion?.submitted_at) {
    await reopenDraftAfterSubmit(rapport, actor);
    rapport = await Rapport.findByPk(id, {
      include: [{ model: RapportVersion, as: "currentVersion" }],
    });
    if (!rapport) {
      const err = new Error("Not found");
      err.status = 404;
      throw err;
    }
  }
  await rapport.update({
    ...(data.title != null ? { title: data.title } : {}),
    ...(data.reference_date !== undefined
      ? { reference_date: data.reference_date }
      : {}),
    updated_at: new Date(),
  });
  if (data.data_json && rapport.current_version_id) {
    await RapportVersion.update(
      { data_json: data.data_json },
      { where: { id: rapport.current_version_id } },
    );
  }
  await audit(actor.id, "RAPPORT_UPDATE", { rapport_id: rapport.id }, { req });
  return getRapportDetail(rapport.id);
}

function cloneVersionData(dataJson) {
  return JSON.parse(JSON.stringify(dataJson || {}));
}

async function createNextRapportVersion(rapportId, dataJson, actorId) {
  const last = await RapportVersion.findOne({
    where: { rapport_id: rapportId },
    order: [["version_number", "DESC"]],
  });
  const nextNum = (last?.version_number || 0) + 1;
  return RapportVersion.create({
    rapport_id: rapportId,
    version_number: nextNum,
    data_json: cloneVersionData(dataJson),
    created_by_user_id: actorId,
  });
}

function draftAuthorId(rapport, actor) {
  return rapport.owner_office_user_id || rapport.created_by_user_id || actor.id;
}

/** After Wali requests changes, fork an editable draft so submitted snapshots stay immutable. */
async function forkDraftIfSubmitted(rapport, actor) {
  const current = await RapportVersion.findByPk(rapport.current_version_id);
  if (!current?.submitted_at) return null;
  const draft = await createNextRapportVersion(
    rapport.id,
    current.data_json,
    draftAuthorId(rapport, actor),
  );
  await rapport.update({
    current_version_id: draft.id,
    updated_at: new Date(),
  });
  return draft;
}

/** Allow editing again after a submission without corrupting submitted snapshots. */
async function reopenDraftAfterSubmit(rapport, actor) {
  const current = await RapportVersion.findByPk(rapport.current_version_id);
  if (!current?.submitted_at) return null;
  if (rapport.rapportType?.versioning_mode === "versioned") {
    return forkDraftIfSubmitted(rapport, actor);
  }
  await RapportVersion.update(
    { submitted_at: null },
    { where: { id: current.id } },
  );
  return current;
}

async function submitRapport(id, actor, req) {
  const rapport = await Rapport.findByPk(id, {
    include: [{ model: RapportType, as: "rapportType" }],
  });
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!["draft", "changes_requested"].includes(rapport.status)) {
    const err = new Error("Cannot submit");
    err.status = 409;
    throw err;
  }

  let versionId = rapport.current_version_id;
  let version = versionId ? await RapportVersion.findByPk(versionId) : null;
  if (!version) {
    const err = new Error("No version");
    err.status = 409;
    throw err;
  }

  const isVersioned = rapport.rapportType?.versioning_mode === "versioned";
  if (isVersioned && version.submitted_at) {
    version = await createNextRapportVersion(
      rapport.id,
      version.data_json,
      actor.id,
    );
    versionId = version.id;
  }

  if (version.submitted_at) {
    const err = new Error("Cannot submit");
    err.status = 409;
    throw err;
  }

  if (rapport.rapportType?.content_kind === "table_grid" && versionId) {
    const slug = rapport.rapportType?.schema_json?.table_schema_slug;
    if (slug) {
      const { loadSchemaBySlug } = require("./tableGridService");
      const schema = await loadSchemaBySlug(slug);
      const version = await RapportVersion.findByPk(versionId);
      if (version) {
        await RapportVersion.update(
          {
            data_json: {
              ...(version.data_json || {}),
              schema_snapshot: {
                columns: schema.columns_json || [],
                layout_json: schema.layout_json || null,
              },
            },
          },
          { where: { id: versionId } },
        );
      }
    }
  }

  if (rapport.rapportType?.content_kind === "commune_list" && versionId) {
    const {
      getEntitiesMap,
      parseEntityKey,
    } = require("./entityKeys");
    const version = await RapportVersion.findByPk(versionId);
    const prevVersion = await RapportVersion.findOne({
      where: {
        rapport_id: rapport.id,
        submitted_at: { [Op.ne]: null },
        id: { [Op.ne]: versionId },
      },
      order: [["version_number", "DESC"]],
    });

    const currentEntities = getEntitiesMap(version.data_json || {});
    const prevEntities = getEntitiesMap(prevVersion?.data_json || {});
    const prevEntityVersions = {
      ...(prevVersion?.entity_versions || {}),
      ...(prevVersion?.commune_versions || {}),
    };

    const changedEntityKeys = [];
    const changedCodes = [];
    const nextEntityVersions = { ...prevEntityVersions };
    const nextCommuneVersions = { ...(prevVersion?.commune_versions || {}) };

    const allKeys = new Set([
      ...Object.keys(currentEntities),
      ...Object.keys(prevEntities),
    ]);

    for (const key of allKeys) {
      const curr = JSON.stringify(currentEntities[key] ?? null);
      const prev = JSON.stringify(prevEntities[key] ?? null);
      if (curr === prev) continue;

      changedEntityKeys.push(key);
      nextEntityVersions[key] = versionId;

      const parsed = parseEntityKey(key);
      if (parsed?.kind === "commune") {
        changedCodes.push(parsed.code);
        nextCommuneVersions[parsed.code] = versionId;
      }
    }

    // Dual-write legacy bare codes into changed_commune_codes when only entities changed
    if (!changedCodes.length && changedEntityKeys.length) {
      for (const key of changedEntityKeys) {
        const parsed = parseEntityKey(key);
        if (parsed) changedCodes.push(parsed.code);
      }
    }

    await RapportVersion.update(
      {
        changed_entity_keys: changedEntityKeys,
        entity_versions: nextEntityVersions,
        changed_commune_codes: changedCodes,
        commune_versions: nextCommuneVersions,
      },
      { where: { id: versionId } },
    );
  }

  const now = new Date();
  await RapportVersion.update(
    { submitted_at: now },
    { where: { id: versionId } },
  );

  const chefGate = rapport.chef_gate || "required";
  const needsChef = chefGate === "required";
  const nextStatus = needsChef ? "pending_chef" : "submitted";

  await rapport.update({
    status: nextStatus,
    current_version_id: versionId,
    updated_at: now,
    owner_office_user_id: actor.id,
  });

  if (needsChef) {
    await notifyActiveRole("CHEF_CABINET", {
      message_key: "rapportPendingChef",
      rapport_id: rapport.id,
    });
  } else {
    await notifyActiveRole("CHEF_CABINET", {
      message_key: "rapportResubmittedBypass",
      rapport_id: rapport.id,
    });
  }

  await audit(
    actor.id,
    needsChef ? "RAPPORT_SUBMIT_PENDING_CHEF" : "RAPPORT_SUBMIT",
    { rapport_id: rapport.id, version_id: versionId, chef_gate: chefGate },
    { req },
  );
  return getRapportDetail(rapport.id);
}

/** Office recall: undo send on the current version (no fork). Wipe current-version remarks/chat only. */
async function returnRapportToDraft(id, actor, req) {
  const rapport = await Rapport.findByPk(id, {
    include: [{ model: RapportType, as: "rapportType" }],
  });
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }

  const allowed = ["pending_chef", "submitted", "under_review"];
  if (!allowed.includes(rapport.status)) {
    const err = new Error("Cannot return to draft");
    err.status = 409;
    throw err;
  }

  if (!rapport.current_version_id) {
    const err = new Error("No version");
    err.status = 409;
    throw err;
  }

  const lockingResponse = await WaliResponse.findOne({
    where: {
      rapport_id: rapport.id,
      rapport_version_id: rapport.current_version_id,
      decision: { [Op.in]: ["accepted", "viewed"] },
    },
  });
  if (lockingResponse) {
    const err = new Error("Cannot return to draft: wali accepted");
    err.status = 409;
    throw err;
  }

  const current = await RapportVersion.findByPk(rapport.current_version_id);
  if (!current) {
    const err = new Error("No version");
    err.status = 409;
    throw err;
  }

  const previousStatus = rapport.status;
  const versionId = current.id;
  const versionWhere = { rapport_version_id: versionId };

  let wipeCounts = {
    chef_responses: 0,
    wali_responses: 0,
    comments: 0,
    notifications: 0,
  };

  await sequelize.transaction(async (transaction) => {
    const [chefRows, waliRows, commentRows] = await Promise.all([
      ChefResponse.findAll({
        where: versionWhere,
        attributes: ["id"],
        transaction,
      }),
      WaliResponse.findAll({
        where: versionWhere,
        attributes: ["id"],
        transaction,
      }),
      RapportComment.findAll({
        where: versionWhere,
        attributes: ["id"],
        transaction,
      }),
    ]);

    const chefIds = chefRows.map((r) => r.id);
    const waliIds = waliRows.map((r) => r.id);
    const commentIds = commentRows.map((r) => r.id);

    const notifOr = [];
    if (chefIds.length) notifOr.push({ chef_response_id: { [Op.in]: chefIds } });
    if (waliIds.length) notifOr.push({ wali_response_id: { [Op.in]: waliIds } });
    if (commentIds.length) notifOr.push({ comment_id: { [Op.in]: commentIds } });

    if (notifOr.length) {
      wipeCounts.notifications = await Notification.destroy({
        where: { [Op.or]: notifOr },
        transaction,
      });
    }

    if (commentIds.length) {
      wipeCounts.comments = await RapportComment.destroy({
        where: { id: { [Op.in]: commentIds } },
        transaction,
      });
    }
    if (chefIds.length) {
      wipeCounts.chef_responses = await ChefResponse.destroy({
        where: { id: { [Op.in]: chefIds } },
        transaction,
      });
    }
    if (waliIds.length) {
      wipeCounts.wali_responses = await WaliResponse.destroy({
        where: { id: { [Op.in]: waliIds } },
        transaction,
      });
    }

    if (current.submitted_at) {
      await RapportVersion.update(
        { submitted_at: null },
        { where: { id: versionId }, transaction },
      );
    }

    const now = new Date();
    await rapport.update(
      { status: "draft", chef_gate: "required", updated_at: now },
      { transaction },
    );
  });

  await audit(
    actor.id,
    "RAPPORT_RETURN_TO_DRAFT",
    {
      rapport_id: rapport.id,
      version_id: versionId,
      previous_status: previousStatus,
      wiped: wipeCounts,
    },
    { req },
  );
  return getRapportDetail(rapport.id);
}

async function markUnderReview(id, actor) {
  const rapport = await Rapport.findByPk(id);
  if (!rapport) return null;
  if (rapport.status === "submitted") {
    await rapport.update({ status: "under_review", updated_at: new Date() });
  }
  return getRapportDetail(id);
}

async function waliRespond(id, data, actor, req) {
  const rapport = await Rapport.findByPk(id, {
    include: [{ model: RapportType, as: "rapportType" }],
  });
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (
    !["submitted", "under_review", "changes_requested"].includes(rapport.status)
  ) {
    const err = new Error("Cannot respond");
    err.status = 409;
    throw err;
  }
  if (!rapport.current_version_id) {
    const err = new Error("No version");
    err.status = 409;
    throw err;
  }
  const bodyText =
    data.decision === "viewed" ? "" : data.body_text?.trim() || "";
  if (data.decision === "changes_requested" && !bodyText) {
    const err = new Error("waliResponseRequired");
    err.status = 400;
    throw err;
  }

  let followUpStatus = "none";
  if (data.decision === "accepted") {
    followUpStatus = data.follow_up_status || "none";
    if (!["none", "pending", "completed"].includes(followUpStatus)) {
      const err = new Error("waliFollowUpInvalid");
      err.status = 400;
      throw err;
    }
  }

  const response = await WaliResponse.create({
    rapport_id: rapport.id,
    rapport_version_id: rapport.current_version_id,
    decision: data.decision,
    follow_up_status: followUpStatus,
    body_text: bodyText,
    scope: data.scope || "whole_rapport",
    scope_id: data.scope_id || null,
    created_by_user_id: actor.id,
  });

  let nextStatus = "acknowledged";
  if (data.decision === "changes_requested") nextStatus = "changes_requested";
  if (data.decision === "viewed") nextStatus = "acknowledged";

  if (data.decision === "changes_requested") {
    await reopenDraftAfterSubmit(rapport, actor);
    await rapport.update({
      status: "changes_requested",
      chef_gate: "bypass",
      updated_at: new Date(),
    });
  } else {
    await rapport.update({ status: nextStatus, updated_at: new Date() });
  }

  const notifyUserId =
    rapport.owner_office_user_id || rapport.created_by_user_id;
  if (notifyUserId && data.decision === "accepted") {
    let messageKey = "waliAccepted";
    if (followUpStatus === "pending") messageKey = "waliAcceptedPending";
    if (followUpStatus === "completed") messageKey = "waliAcceptedCompleted";
    await notifyUsers({
      userIds: [notifyUserId],
      rapport_id: rapport.id,
      wali_response_id: response.id,
      message_key: messageKey,
    });
  } else if (notifyUserId && data.decision === "changes_requested") {
    await notifyUsers({
      userIds: [notifyUserId],
      rapport_id: rapport.id,
      wali_response_id: response.id,
      message_key: "waliChangesRequested",
    });
    await notifyActiveRole("CHEF_CABINET", {
      rapport_id: rapport.id,
      wali_response_id: response.id,
      message_key: "waliChangesRequested",
    });
  } else if (notifyUserId && data.decision === "viewed" && bodyText) {
    await notifyUsers({
      userIds: [notifyUserId],
      rapport_id: rapport.id,
      wali_response_id: response.id,
      message_key: "waliFeedback",
    });
  }

  await audit(
    actor.id,
    "RAPPORT_WALI_RESPONSE",
    { rapport_id: rapport.id, decision: data.decision },
    { req },
  );
  return getRapportDetail(rapport.id);
}

async function chefRespond(id, data, actor, req) {
  const rapport = await Rapport.findByPk(id, {
    include: [{ model: RapportType, as: "rapportType" }],
  });
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (rapport.status !== "pending_chef") {
    const err = new Error("Cannot respond");
    err.status = 409;
    throw err;
  }
  if (!rapport.current_version_id) {
    const err = new Error("No version");
    err.status = 409;
    throw err;
  }
  const bodyText =
    data.decision === "viewed" ? "" : data.body_text?.trim() || "";
  if (data.decision === "changes_requested" && !bodyText) {
    const err = new Error("waliResponseRequired");
    err.status = 400;
    throw err;
  }

  const response = await ChefResponse.create({
    rapport_id: rapport.id,
    rapport_version_id: rapport.current_version_id,
    decision: data.decision,
    follow_up_status: "none",
    body_text: bodyText,
    scope: data.scope || "whole_rapport",
    scope_id: data.scope_id || null,
    created_by_user_id: actor.id,
  });

  const notifyUserId =
    rapport.owner_office_user_id || rapport.created_by_user_id;

  if (data.decision === "accepted") {
    await rapport.update({
      status: "submitted",
      chef_gate: "required",
      updated_at: new Date(),
    });
    if (notifyUserId) {
      await notifyUsers({
        userIds: [notifyUserId],
        rapport_id: rapport.id,
        chef_response_id: response.id,
        message_key: "chefAccepted",
      });
    }
    await notifyActiveRole("WALI", {
      message_key: "rapportPendingWali",
      rapport_id: rapport.id,
    });
  } else if (data.decision === "changes_requested") {
    await reopenDraftAfterSubmit(rapport, actor);
    await rapport.update({
      status: "changes_requested",
      chef_gate: "required",
      updated_at: new Date(),
    });
    if (notifyUserId) {
      await notifyUsers({
        userIds: [notifyUserId],
        rapport_id: rapport.id,
        chef_response_id: response.id,
        message_key: "chefChangesRequested",
      });
    }
  } else {
    await rapport.update({ status: "pending_chef", updated_at: new Date() });
    if (notifyUserId && bodyText) {
      await notifyUsers({
        userIds: [notifyUserId],
        rapport_id: rapport.id,
        chef_response_id: response.id,
        message_key: "chefFeedback",
      });
    }
  }

  await audit(
    actor.id,
    "CHEF_RESPOND",
    { rapport_id: rapport.id, decision: data.decision },
    { req },
  );
  return getRapportDetail(rapport.id);
}

async function listRapportVersions(rapportId) {
  const versions = await RapportVersion.findAll({
    where: { rapport_id: rapportId },
    order: [["version_number", "DESC"]],
    attributes: [
      "id",
      "version_number",
      "submitted_at",
      "created_at",
      "created_by_user_id",
    ],
  });
  return versions;
}

async function getRapportVersion(rapportId, versionId) {
  const version = await RapportVersion.findOne({
    where: { id: versionId, rapport_id: rapportId },
    include: [
      { model: User, as: "createdByUser", attributes: ["id", "name"] },
      {
        model: WaliResponse,
        as: "waliResponses",
        separate: true,
        order: [["created_at", "DESC"]],
        include: [
          { model: User, as: "createdByUser", attributes: ["id", "name"] },
        ],
      },
      {
        model: ChefResponse,
        as: "chefResponses",
        separate: true,
        order: [["created_at", "DESC"]],
        include: [
          { model: User, as: "createdByUser", attributes: ["id", "name"] },
        ],
      },
    ],
  });
  if (!version) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  await audit(null, "RAPPORT_VERSION_OPEN", {
    rapport_id: rapportId,
    version_id: versionId,
  });
  return version;
}

async function listNotifications(userId, unreadOnly = false) {
  const prefs = await getPreferences(userId);
  const hiddenKeys = [
    ...DEDICATED_NOTIFICATION_KEYS,
    ...disabledMessageKeys(prefs),
  ];
  const where = {
    user_id: userId,
    message_key: { [Op.notIn]: [...new Set(hiddenKeys)] },
  };
  if (unreadOnly) where.read_at = null;
  return Notification.findAll({
    where,
    order: [["created_at", "DESC"]],
    limit: 50,
    include: [
      {
        model: Rapport,
        as: "rapport",
        attributes: ["id", "title", "status", "service_id"],
        required: false,
        include: [
          {
            model: RapportType,
            as: "rapportType",
            attributes: ["content_kind"],
          },
          {
            model: Service,
            as: "service",
            attributes: ["id", "slug", "name_ar", "name_fr"],
          },
        ],
      },
      {
        model: WaliResponse,
        as: "waliResponse",
        attributes: ["decision", "follow_up_status", "body_text"],
        required: false,
      },
      {
        model: ChefResponse,
        as: "chefResponse",
        attributes: ["decision", "follow_up_status", "body_text"],
        required: false,
      },
      {
        model: WaliBroadcast,
        as: "broadcast",
        attributes: ["id", "title_ar", "title_fr"],
        required: false,
      },
    ],
  });
}

async function markNotificationRead(id, userId) {
  const n = await Notification.findOne({ where: { id, user_id: userId } });
  if (!n) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!n.read_at) await n.update({ read_at: new Date() });

  const now = new Date();
  if (n.instruction_id) {
    const { WaliInstructionRecipient } = require("../../db");
    await WaliInstructionRecipient.update(
      { read_at: now },
      {
        where: {
          instruction_id: n.instruction_id,
          user_id: userId,
          read_at: null,
        },
      },
    );
  }
  if (n.broadcast_id) {
    const { WaliBroadcastRecipient } = require("../../db");
    await WaliBroadcastRecipient.update(
      { read_at: now },
      {
        where: {
          broadcast_id: n.broadcast_id,
          user_id: userId,
          read_at: null,
        },
      },
    );
  }
  return n;
}

async function markRapportNotificationsRead(rapportId, userId) {
  await Notification.update(
    { read_at: new Date() },
    { where: { user_id: userId, rapport_id: rapportId, read_at: null } },
  );
}

async function hideRapport(id, actor, req) {
  const rapport = await Rapport.findByPk(id);
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (rapport.hidden_at) {
    const err = new Error("Already hidden");
    err.status = 409;
    throw err;
  }
  if (rapport.status === "draft") {
    const err = new Error("Cannot finish draft");
    err.status = 409;
    throw err;
  }
  const now = new Date();
  await rapport.update({ hidden_at: now, updated_at: now });
  await audit(actor.id, "RAPPORT_HIDE", { rapport_id: rapport.id }, { req });
  return getRapportDetail(rapport.id);
}

async function restoreRapport(id, actor, req) {
  const rapport = await Rapport.findByPk(id);
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  if (!rapport.hidden_at) {
    const err = new Error("Not hidden");
    err.status = 409;
    throw err;
  }
  const now = new Date();
  await rapport.update({ hidden_at: null, updated_at: now });
  await audit(actor.id, "RAPPORT_RESTORE", { rapport_id: rapport.id }, { req });
  return getRapportDetail(rapport.id);
}

async function deleteRapportPermanently(id, actor, req) {
  const rapport = await Rapport.findByPk(id);
  if (!rapport) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  await sequelize.transaction(async (transaction) => {
    await rapport.update({ current_version_id: null }, { transaction });
    await Rapport.destroy({ where: { id: rapport.id }, transaction });
  });
  await audit(actor.id, "RAPPORT_DELETE", { rapport_id: Number(id) }, { req });
  return { ok: true };
}

module.exports = {
  listServices,
  listRapports,
  unreadDiscussionRapportIds,
  getRapportDetail,
  assertVisibleToWali,
  assertVisibleToChef,
  createRapport,
  updateRapportDraft,
  submitRapport,
  returnRapportToDraft,
  markUnderReview,
  waliRespond,
  chefRespond,
  listRapportVersions,
  getRapportVersion,
  listNotifications,
  markNotificationRead,
  markRapportNotificationsRead,
  hideRapport,
  restoreRapport,
  deleteRapportPermanently,
  enrichOfficeRapportList,
};
