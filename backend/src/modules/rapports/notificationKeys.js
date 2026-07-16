/** Keys owned by dedicated hub counters (instructions / shared files). */
const DEDICATED_NOTIFICATION_KEYS = [
  "waliInstruction",
  "waliBroadcast",
  "waliBroadcastReminder",
];

/** Preference type for each message_key (see DEVICE_NOTIFICATIONS.md). */
const MESSAGE_KEY_PREF = {
  rapportPendingChef: "rapport_inbox",
  rapportPendingWali: "rapport_inbox",
  rapportResubmittedBypass: "rapport_inbox",
  waliAccepted: "rapport_feedback",
  waliAcceptedPending: "rapport_feedback",
  waliAcceptedCompleted: "rapport_feedback",
  waliChangesRequested: "rapport_feedback",
  waliFeedback: "rapport_feedback",
  chefAccepted: "rapport_feedback",
  chefChangesRequested: "rapport_feedback",
  chefFeedback: "rapport_feedback",
  rapportComment: "discussion",
  waliInstruction: "instructions",
  waliBroadcast: "broadcasts",
  waliBroadcastReminder: "broadcasts",
  calendarToday: "calendar",
  calendarTomorrow: "calendar",
};

const PREF_DEFAULTS = {
  enabled: true,
  push_enabled: true,
  rapport_inbox: true,
  rapport_feedback: true,
  discussion: true,
  instructions: true,
  broadcasts: true,
  calendar: true,
};

function prefTypeForMessageKey(messageKey) {
  return MESSAGE_KEY_PREF[messageKey] || "rapport_feedback";
}

/** Message keys allowed for a prefs object (master + type). */
function allowedMessageKeys(prefs) {
  if (!prefs?.enabled) return [];
  return Object.keys(MESSAGE_KEY_PREF).filter((key) => {
    const type = MESSAGE_KEY_PREF[key];
    return prefs[type] !== false;
  });
}

/** Keys to exclude from lists/counts when a type is off. */
function disabledMessageKeys(prefs) {
  if (!prefs?.enabled) return Object.keys(MESSAGE_KEY_PREF);
  return Object.keys(MESSAGE_KEY_PREF).filter((key) => {
    const type = MESSAGE_KEY_PREF[key];
    return prefs[type] === false;
  });
}

module.exports = {
  DEDICATED_NOTIFICATION_KEYS,
  MESSAGE_KEY_PREF,
  PREF_DEFAULTS,
  prefTypeForMessageKey,
  allowedMessageKeys,
  disabledMessageKeys,
};
