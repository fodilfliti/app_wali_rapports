"use strict";

/**
 * Seed helpers aligned with UUID expand (public uuid + bigint PK dual).
 * Always stamp entity `uuid` and rapport/version/notification `*_uuid` FKs
 * so seeds do not leave null UUID columns that break dual-read APIs.
 */

const crypto = require("crypto");
const {
  User,
  Rapport,
  RapportType,
  RapportVersion,
  Notification,
  UploadedFile,
  Service,
} = require("../../src/db");

function newUuid() {
  return crypto.randomUUID();
}

/** Ensure a plain row object has a uuid (for bulkCreate). */
function withUuid(row = {}) {
  return { ...row, uuid: row.uuid || newUuid() };
}

function withUuidList(rows) {
  return (rows || []).map((r) => withUuid(r));
}

async function uuidOf(Model, id) {
  if (id == null || id === "") return null;
  const row = await Model.findByPk(id);
  return row?.uuid ?? null;
}

/**
 * Create rapport with bigint FKs + matching *_uuid columns.
 */
async function createRapportSeed(attrs) {
  const [
    rapport_type_uuid,
    created_by_user_uuid,
    owner_office_user_uuid,
    service_uuid,
  ] = await Promise.all([
    attrs.rapport_type_uuid ?? uuidOf(RapportType, attrs.rapport_type_id),
    attrs.created_by_user_uuid ?? uuidOf(User, attrs.created_by_user_id),
    attrs.owner_office_user_uuid !== undefined
      ? attrs.owner_office_user_uuid
      : uuidOf(User, attrs.owner_office_user_id),
    attrs.service_id ? uuidOf(Service, attrs.service_id) : null,
  ]);
  void service_uuid; // Service has uuid but rapports table has no service_uuid yet

  return Rapport.create({
    ...attrs,
    uuid: attrs.uuid || newUuid(),
    rapport_type_uuid: rapport_type_uuid ?? null,
    created_by_user_uuid: created_by_user_uuid ?? null,
    owner_office_user_uuid: owner_office_user_uuid ?? null,
  });
}

/**
 * Create version with rapport_uuid + created_by_user_uuid.
 */
async function createVersionSeed(attrs, rapport) {
  const created_by_user_uuid =
    attrs.created_by_user_uuid ?? (await uuidOf(User, attrs.created_by_user_id));
  return RapportVersion.create({
    ...attrs,
    uuid: attrs.uuid || newUuid(),
    rapport_id: attrs.rapport_id ?? rapport?.id,
    rapport_uuid: attrs.rapport_uuid ?? rapport?.uuid ?? null,
    created_by_user_uuid: created_by_user_uuid ?? null,
  });
}

/** Point rapport at current version (bigint + uuid). */
async function setRapportCurrentVersion(rapport, version, extra = {}) {
  await rapport.update({
    current_version_id: version.id,
    current_version_uuid: version.uuid,
    ...extra,
    updated_at: new Date(),
  });
}

async function createNotificationSeed(attrs) {
  const [user_uuid, rapport_uuid] = await Promise.all([
    attrs.user_uuid ?? uuidOf(User, attrs.user_id),
    attrs.rapport_uuid ??
      (attrs.rapport_id
        ? uuidOf(Rapport, attrs.rapport_id)
        : Promise.resolve(null)),
  ]);
  return Notification.create({
    ...attrs,
    uuid: attrs.uuid || newUuid(),
    user_uuid: user_uuid ?? null,
    rapport_uuid: rapport_uuid ?? null,
  });
}

async function createUploadedFileSeed(attrs) {
  const rapport_uuid =
    attrs.rapport_uuid ??
    (attrs.rapport_id ? await uuidOf(Rapport, attrs.rapport_id) : null);
  return UploadedFile.create({
    ...attrs,
    uuid: attrs.uuid || newUuid(),
    rapport_uuid: rapport_uuid ?? null,
  });
}

module.exports = {
  newUuid,
  withUuid,
  withUuidList,
  uuidOf,
  createRapportSeed,
  createVersionSeed,
  setRapportCurrentVersion,
  createNotificationSeed,
  createUploadedFileSeed,
};
