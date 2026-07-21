const { Op } = require("sequelize");
const { Notification, User } = require("../../db");
const {
  prefTypeForMessageKey,
} = require("../rapports/notificationKeys");
const { getPreferencesMap, isTypeAllowed } = require("./preferenceService");
const { sendPushToUsers } = require("./pushService");

const PUSH_COPY = {
  rapportPendingChef: {
    title_ar: "تقرير بانتظار المراجعة",
    title_fr: "Rapport en attente de révision",
    body_ar: "وصل تقرير جديد إلى رئيس الديوان.",
    body_fr: "Un nouveau rapport est arrivé chez le chef de cabinet.",
    url: (p) => (p.rapport_id ? `/chef/rapports/${p.rapport_id}` : "/chef"),
  },
  rapportPendingWali: {
    title_ar: "تقرير بانتظار الوالي",
    title_fr: "Rapport en attente du wali",
    body_ar: "تقرير جاهز للمراجعة بعد موافقة رئيس الديوان.",
    body_fr: "Un rapport est prêt après validation du chef de cabinet.",
    url: (p) => (p.rapport_id ? `/wali/rapports/${p.rapport_id}` : "/wali"),
  },
  rapportResubmittedBypass: {
    title_ar: "إعادة إرسال تقرير",
    title_fr: "Rapport renvoyé",
    body_ar: "أُعيد إرسال تقرير مباشرة إلى الوالي.",
    body_fr: "Un rapport a été renvoyé directement au wali.",
    url: (p) => (p.rapport_id ? `/chef/rapports/${p.rapport_id}` : "/chef"),
  },
  rapportDeleteRequested: {
    title_ar: "طلب حذف تقرير",
    title_fr: "Demande de suppression",
    body_ar: "طلب المكتب حذف تقرير — يحتاج موافقتك.",
    body_fr: "Le bureau demande la suppression d'un rapport.",
    url: (p) =>
      p.rapport_id
        ? `/chef/rapports/${p.rapport_id}/view`
        : "/chef/rapports?status_group=delete_requested",
  },
  rapportDeleteApproved: {
    title_ar: "تم حذف التقرير",
    title_fr: "Rapport supprimé",
    body_ar: "وافق رئيس الديوان على حذف التقرير.",
    body_fr: "Le chef de cabinet a approuvé la suppression.",
    url: () => "/office/rapports",
  },
  rapportDeleteRejected: {
    title_ar: "رفض طلب الحذف",
    title_fr: "Suppression refusée",
    body_ar: "رفض رئيس الديوان طلب حذف التقرير.",
    body_fr: "Le chef de cabinet a refusé la demande de suppression.",
    url: (p) => (p.rapport_id ? officeRapportUrl(p) : "/office/rapports"),
  },
  waliAccepted: {
    title_ar: "رد الوالي",
    title_fr: "Réponse du wali",
    body_ar: "تم قبول التقرير.",
    body_fr: "Le rapport a été accepté.",
    url: (p) => (p.rapport_id ? officeRapportUrl(p) : "/office/notifications"),
  },
  waliAcceptedPending: {
    title_ar: "رد الوالي",
    title_fr: "Réponse du wali",
    body_ar: "تم القبول مع متابعة معلّقة.",
    body_fr: "Accepté avec suivi en attente.",
    url: (p) => (p.rapport_id ? officeRapportUrl(p) : "/office/notifications"),
  },
  waliAcceptedCompleted: {
    title_ar: "رد الوالي",
    title_fr: "Réponse du wali",
    body_ar: "تم القبول والمتابعة مكتملة.",
    body_fr: "Accepté et suivi terminé.",
    url: (p) => (p.rapport_id ? officeRapportUrl(p) : "/office/notifications"),
  },
  waliChangesRequested: {
    title_ar: "طلب تعديلات",
    title_fr: "Modifications demandées",
    body_ar: "طلب الوالي تعديلات على التقرير.",
    body_fr: "Le wali a demandé des modifications.",
    url: (p) => (p.rapport_id ? officeRapportUrl(p) : "/office/notifications"),
  },
  waliFeedback: {
    title_ar: "ملاحظة الوالي",
    title_fr: "Note du wali",
    body_ar: "لديك ملاحظة جديدة على التقرير.",
    body_fr: "Nouvelle note sur le rapport.",
    url: (p) => (p.rapport_id ? officeRapportUrl(p) : "/office/notifications"),
  },
  chefAccepted: {
    title_ar: "موافقة رئيس الديوان",
    title_fr: "Validation du chef de cabinet",
    body_ar: "وافق رئيس الديوان على التقرير.",
    body_fr: "Le chef de cabinet a validé le rapport.",
    url: (p) => (p.rapport_id ? officeRapportUrl(p) : "/office/notifications"),
  },
  chefChangesRequested: {
    title_ar: "تعديلات من رئيس الديوان",
    title_fr: "Modifications du chef de cabinet",
    body_ar: "طلب رئيس الديوان تعديلات.",
    body_fr: "Le chef de cabinet a demandé des modifications.",
    url: (p) => (p.rapport_id ? officeRapportUrl(p) : "/office/notifications"),
  },
  chefFeedback: {
    title_ar: "ملاحظة رئيس الديوان",
    title_fr: "Note du chef de cabinet",
    body_ar: "لديك ملاحظة جديدة.",
    body_fr: "Nouvelle note reçue.",
    url: (p) => (p.rapport_id ? officeRapportUrl(p) : "/office/notifications"),
  },
  rapportComment: {
    title_ar: "مناقشة التقرير",
    title_fr: "Discussion du rapport",
    body_ar: "تعليق جديد في مناقشة التقرير.",
    body_fr: "Nouveau commentaire dans la discussion.",
    url: (p) => (p.rapport_id ? officeRapportUrl(p) : "/office/rapports?view=discussion"),
  },
  waliInstruction: {
    title_ar: "تعليمات الوالي",
    title_fr: "Instructions du wali",
    body_ar: "وصلك تعليم جديد.",
    body_fr: "Nouvelle instruction reçue.",
    url: (p) =>
      p.instruction_id ? `/office/instructions/${p.instruction_id}` : "/office/instructions",
  },
  waliBroadcast: {
    title_ar: "ملف مشترك",
    title_fr: "Fichier partagé",
    body_ar: "شارك الوالي ملفاً جديداً.",
    body_fr: "Le wali a partagé un fichier.",
    url: (p) => (p.broadcast_id ? `/office/shared/${p.broadcast_id}` : "/office/shared"),
  },
  waliBroadcastReminder: {
    title_ar: "تذكير بملف مشترك",
    title_fr: "Rappel fichier partagé",
    body_ar: "تذكير بملف لم يُفتح بعد.",
    body_fr: "Rappel pour un fichier non ouvert.",
    url: (p) => (p.broadcast_id ? `/office/shared/${p.broadcast_id}` : "/office/shared"),
  },
  calendarToday: {
    title_ar: "أحداث اليوم",
    title_fr: "Événements aujourd'hui",
    body_ar: "لديك أحداث في التقويم اليوم.",
    body_fr: "Vous avez des événements au calendrier aujourd'hui.",
    url: () => "/wali/calendar",
  },
  calendarTomorrow: {
    title_ar: "أحداث غداً",
    title_fr: "Événements demain",
    body_ar: "لديك أحداث في التقويم غداً.",
    body_fr: "Vous avez des événements au calendrier demain.",
    url: () => "/wali/calendar",
  },
};

function officeRapportUrl(p) {
  return `/office/rapports/${p.rapport_id}`;
}

function buildPushPayload(messageKey, fields, overrides = {}) {
  const copy = PUSH_COPY[messageKey] || {
    title_ar: "إشعار",
    title_fr: "Notification",
    body_ar: "",
    body_fr: "",
    url: () => "/",
  };
  const urlFn = typeof copy.url === "function" ? copy.url : () => copy.url;
  return {
    title_ar: overrides.title_ar || copy.title_ar,
    title_fr: overrides.title_fr || copy.title_fr,
    body_ar: overrides.body_ar || copy.body_ar,
    body_fr: overrides.body_fr || copy.body_fr,
    url: overrides.url || urlFn(fields),
    tag: overrides.tag || `${messageKey}-${fields.rapport_id || fields.calendar_event_id || fields.broadcast_id || fields.instruction_id || "x"}`,
  };
}

/**
 * Insert notification rows (prefs-filtered) then best-effort Web Push.
 * @param {object} opts
 * @param {number[]} opts.userIds
 * @param {string} opts.message_key
 * @param {number|null} [opts.rapport_id]
 * @param {number|null} [opts.broadcast_id]
 * @param {number|null} [opts.instruction_id]
 * @param {number|null} [opts.wali_response_id]
 * @param {number|null} [opts.chef_response_id]
 * @param {number|null} [opts.comment_id]
 * @param {number|null} [opts.calendar_event_id]
 * @param {object} [opts.push] override title/body/url
 * @param {boolean} [opts.dedupeCalendar] use findOrCreate for calendar keys
 * @param {boolean} [opts.dedupeCalendarDigest] replace prior digest rows (no calendar_event_id) for this key
 */
async function notifyUsers(opts) {
  const message_key = opts.message_key;
  if (!message_key) return [];

  let userIds = [...new Set((opts.userIds || []).map(Number).filter(Boolean))];
  if (!userIds.length) return [];

  const blocked = await User.findAll({
    where: {
      id: userIds,
      [Op.or]: [{ is_blocked: true }, { deleted_at: { [Op.ne]: null } }],
    },
    attributes: ["id"],
  });
  const blockedSet = new Set(blocked.map((u) => Number(u.id)));
  userIds = userIds.filter((id) => !blockedSet.has(id));
  if (!userIds.length) return [];

  const prefsMap = await getPreferencesMap(userIds);
  const prefType = prefTypeForMessageKey(message_key);
  const allowedIds = userIds.filter((id) => isTypeAllowed(prefsMap.get(id), prefType));
  if (!allowedIds.length) return [];

  const base = {
    rapport_id: opts.rapport_id ?? null,
    broadcast_id: opts.broadcast_id ?? null,
    instruction_id: opts.instruction_id ?? null,
    wali_response_id: opts.wali_response_id ?? null,
    chef_response_id: opts.chef_response_id ?? null,
    comment_id: opts.comment_id ?? null,
    calendar_event_id: opts.calendar_event_id ?? null,
    message_key,
    created_at: new Date(),
  };

  const created = [];
  if (opts.dedupeCalendarDigest) {
    // Replace ALL prior calendarToday/Tomorrow rows for these users (legacy per-event
    // rows with calendar_event_id + previous digests with null).
    await Notification.destroy({
      where: {
        user_id: { [Op.in]: allowedIds },
        message_key,
      },
    });
    const rows = await Notification.bulkCreate(
      allowedIds.map((user_id) => ({ ...base, user_id, calendar_event_id: null })),
    );
    created.push(...rows);
  } else if (opts.dedupeCalendar && base.calendar_event_id) {
    for (const user_id of allowedIds) {
      const [row, wasCreated] = await Notification.findOrCreate({
        where: {
          user_id,
          calendar_event_id: base.calendar_event_id,
          message_key,
        },
        defaults: { ...base, user_id },
      });
      if (wasCreated) created.push(row);
    }
  } else {
    const rows = await Notification.bulkCreate(
      allowedIds.map((user_id) => ({ ...base, user_id })),
    );
    created.push(...rows);
  }

  const pushUserIds = created
    .map((r) => Number(r.user_id))
    .filter((id) => {
      const prefs = prefsMap.get(id);
      return prefs?.enabled && prefs?.push_enabled;
    });

  if (pushUserIds.length) {
    const payload = buildPushPayload(message_key, base, opts.push || {});
    setImmediate(() => {
      sendPushToUsers(pushUserIds, payload, {
        message_key,
        rapport_id: base.rapport_id,
        broadcast_id: base.broadcast_id,
        instruction_id: base.instruction_id,
      }).catch(() => {});
    });
  }

  return created;
}

async function notifyActiveRole(role, opts) {
  const users = await User.findAll({
    where: { role, is_blocked: false, deleted_at: null },
    attributes: ["id"],
  });
  return notifyUsers({
    ...opts,
    userIds: users.map((u) => Number(u.id)),
  });
}

module.exports = {
  notifyUsers,
  notifyActiveRole,
  buildPushPayload,
  PUSH_COPY,
};
