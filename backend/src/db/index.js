const sequelizeConfig = require("../../config/config");
const { getEnv } = require("../config/env");

const env = getEnv();
const config = sequelizeConfig[env.nodeEnv];
const sequelize = sequelizeConfig.createSequelize(config);

const Daira = require("./models/Daira")(sequelize);
const Direction = require("./models/Direction")(sequelize);
const Municipality = require("./models/Municipality")(sequelize);
const User = require("./models/User")(sequelize);
const AuditLog = require("./models/AuditLog")(sequelize);
const Department = require("./models/Department")(sequelize);
const AccessRoleTemplate = require("./models/AccessRoleTemplate")(sequelize);
const AccessRoleTemplatePermission = require("./models/AccessRoleTemplatePermission")(sequelize);
const UserPermissionOverride = require("./models/UserPermissionOverride")(sequelize);
const Service = require("./models/Service")(sequelize);
const RapportType = require("./models/RapportType")(sequelize);
const Rapport = require("./models/Rapport")(sequelize);
const RapportVersion = require("./models/RapportVersion")(sequelize);
const WaliResponse = require("./models/WaliResponse")(sequelize);
const ChefResponse = require("./models/ChefResponse")(sequelize);
const RapportTableSchema = require("./models/RapportTableSchema")(sequelize);
const RapportDocumentTemplate = require("./models/RapportDocumentTemplate")(sequelize);
const Notification = require("./models/Notification")(sequelize);
const UserServiceGrant = require("./models/UserServiceGrant")(sequelize);
const UploadedFile = require("./models/UploadedFile")(sequelize);
const RapportCalendarEvent = require("./models/RapportCalendarEvent")(sequelize);
const RapportView = require("./models/RapportView")(sequelize);
const WaliBroadcast = require("./models/WaliBroadcast")(sequelize);
const WaliBroadcastRecipient = require("./models/WaliBroadcastRecipient")(sequelize);
const WaliBroadcastComment = require("./models/WaliBroadcastComment")(sequelize);
const WaliInstruction = require("./models/WaliInstruction")(sequelize);
const WaliInstructionFile = require("./models/WaliInstructionFile")(sequelize);
const WaliInstructionRecipient = require("./models/WaliInstructionRecipient")(sequelize);
const RapportComment = require("./models/RapportComment")(sequelize);
const GuideVideo = require("./models/GuideVideo")(sequelize);
const RefreshToken = require("./models/RefreshToken")(sequelize);
const UserNotificationPreference = require("./models/UserNotificationPreference")(sequelize);
const WebPushSubscription = require("./models/WebPushSubscription")(sequelize);

Daira.hasMany(Municipality, { foreignKey: "daira_id", as: "municipalities" });
Municipality.belongsTo(Daira, { foreignKey: "daira_id", as: "daira" });

Department.hasMany(User, { foreignKey: "department_id", as: "users" });
User.belongsTo(Department, { foreignKey: "department_id", as: "department" });

User.hasMany(RefreshToken, { foreignKey: "user_id", as: "refreshTokens" });
RefreshToken.belongsTo(User, { foreignKey: "user_id", as: "user" });

User.hasOne(UserNotificationPreference, { foreignKey: "user_id", as: "notificationPreferences" });
UserNotificationPreference.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(WebPushSubscription, { foreignKey: "user_id", as: "pushSubscriptions" });
WebPushSubscription.belongsTo(User, { foreignKey: "user_id", as: "user" });

AccessRoleTemplate.hasMany(AccessRoleTemplatePermission, { foreignKey: "role_template_id", as: "permissions" });
AccessRoleTemplatePermission.belongsTo(AccessRoleTemplate, { foreignKey: "role_template_id" });

AccessRoleTemplate.hasMany(User, { foreignKey: "access_role_template_id", as: "users" });
User.belongsTo(AccessRoleTemplate, { foreignKey: "access_role_template_id", as: "accessRoleTemplate" });

User.hasMany(UserPermissionOverride, { foreignKey: "user_id", as: "permissionOverrides" });
UserPermissionOverride.belongsTo(User, { foreignKey: "user_id" });

User.hasMany(AuditLog, { foreignKey: "actor_id" });
AuditLog.belongsTo(User, { foreignKey: "actor_id" });

Department.hasMany(Service, { foreignKey: "department_id", as: "services" });
Service.belongsTo(Department, { foreignKey: "department_id", as: "department" });

Service.hasMany(Service, { foreignKey: "parent_service_id", as: "children" });
Service.belongsTo(Service, { foreignKey: "parent_service_id", as: "parent" });

Service.hasMany(RapportTableSchema, { foreignKey: "service_id", as: "tableSchemas" });
RapportTableSchema.belongsTo(Service, { foreignKey: "service_id", as: "service" });

Service.hasMany(RapportDocumentTemplate, { foreignKey: "service_id", as: "documentTemplates" });
RapportDocumentTemplate.belongsTo(Service, { foreignKey: "service_id", as: "service" });
RapportType.hasMany(RapportDocumentTemplate, { foreignKey: "rapport_type_id", as: "documentTemplates" });
RapportDocumentTemplate.belongsTo(RapportType, { foreignKey: "rapport_type_id", as: "rapportType" });

Service.hasMany(RapportType, { foreignKey: "service_id", as: "rapportTypes" });
RapportType.belongsTo(Service, { foreignKey: "service_id", as: "service" });

Service.hasMany(Rapport, { foreignKey: "service_id", as: "rapports" });
Rapport.belongsTo(Service, { foreignKey: "service_id", as: "service" });

RapportType.hasMany(Rapport, { foreignKey: "rapport_type_id", as: "rapports" });
Rapport.belongsTo(RapportType, { foreignKey: "rapport_type_id", as: "rapportType" });

User.hasMany(Rapport, { foreignKey: "created_by_user_id", as: "createdRapports" });
Rapport.belongsTo(User, { foreignKey: "created_by_user_id", as: "createdByUser" });

User.hasMany(Rapport, { foreignKey: "owner_office_user_id", as: "ownedRapports" });
Rapport.belongsTo(User, { foreignKey: "owner_office_user_id", as: "ownerOfficeUser" });

Rapport.hasMany(RapportVersion, { foreignKey: "rapport_id", as: "versions" });
RapportVersion.belongsTo(Rapport, { foreignKey: "rapport_id", as: "rapport" });

Rapport.belongsTo(RapportVersion, { foreignKey: "current_version_id", as: "currentVersion" });

User.hasMany(RapportVersion, { foreignKey: "created_by_user_id", as: "rapportVersions" });
RapportVersion.belongsTo(User, { foreignKey: "created_by_user_id", as: "createdByUser" });

Rapport.hasMany(WaliResponse, { foreignKey: "rapport_id", as: "waliResponses" });
WaliResponse.belongsTo(Rapport, { foreignKey: "rapport_id", as: "rapport" });

RapportVersion.hasMany(WaliResponse, { foreignKey: "rapport_version_id", as: "waliResponses" });
WaliResponse.belongsTo(RapportVersion, { foreignKey: "rapport_version_id", as: "rapportVersion" });

User.hasMany(WaliResponse, { foreignKey: "created_by_user_id", as: "waliResponses" });
WaliResponse.belongsTo(User, { foreignKey: "created_by_user_id", as: "createdByUser" });

Rapport.hasMany(ChefResponse, { foreignKey: "rapport_id", as: "chefResponses" });
ChefResponse.belongsTo(Rapport, { foreignKey: "rapport_id", as: "rapport" });
RapportVersion.hasMany(ChefResponse, { foreignKey: "rapport_version_id", as: "chefResponses" });
ChefResponse.belongsTo(RapportVersion, { foreignKey: "rapport_version_id", as: "rapportVersion" });
User.hasMany(ChefResponse, { foreignKey: "created_by_user_id", as: "chefResponses" });
ChefResponse.belongsTo(User, { foreignKey: "created_by_user_id", as: "createdByUser" });

User.hasMany(Notification, { foreignKey: "user_id", as: "notifications" });
Notification.belongsTo(User, { foreignKey: "user_id", as: "user" });
Rapport.hasMany(Notification, { foreignKey: "rapport_id", as: "notifications" });
Notification.belongsTo(Rapport, { foreignKey: "rapport_id", as: "rapport" });
WaliResponse.hasMany(Notification, { foreignKey: "wali_response_id", as: "notifications" });
Notification.belongsTo(WaliResponse, { foreignKey: "wali_response_id", as: "waliResponse" });
ChefResponse.hasMany(Notification, { foreignKey: "chef_response_id", as: "notifications" });
Notification.belongsTo(ChefResponse, { foreignKey: "chef_response_id", as: "chefResponse" });

WaliBroadcast.hasMany(Notification, { foreignKey: "broadcast_id", as: "notifications" });
Notification.belongsTo(WaliBroadcast, { foreignKey: "broadcast_id", as: "broadcast" });
WaliInstruction.hasMany(Notification, { foreignKey: "instruction_id", as: "notifications" });
Notification.belongsTo(WaliInstruction, { foreignKey: "instruction_id", as: "instruction" });

Rapport.hasMany(UploadedFile, { foreignKey: "rapport_id", as: "uploadedFiles" });
UploadedFile.belongsTo(Rapport, { foreignKey: "rapport_id", as: "rapport" });
User.hasMany(UploadedFile, { foreignKey: "uploaded_by_user_id", as: "uploadedFiles" });
UploadedFile.belongsTo(User, { foreignKey: "uploaded_by_user_id", as: "uploadedByUser" });

Rapport.hasMany(RapportCalendarEvent, { foreignKey: "rapport_id", as: "calendarEvents" });
RapportCalendarEvent.belongsTo(Rapport, { foreignKey: "rapport_id", as: "rapport" });
User.hasMany(RapportCalendarEvent, { foreignKey: "created_by_user_id", as: "calendarEventsCreated" });
RapportCalendarEvent.belongsTo(User, { foreignKey: "created_by_user_id", as: "createdByUser" });

Rapport.hasMany(RapportView, { foreignKey: "rapport_id", as: "views" });
RapportView.belongsTo(Rapport, { foreignKey: "rapport_id", as: "rapport" });
User.hasMany(RapportView, { foreignKey: "user_id", as: "rapportViews" });
RapportView.belongsTo(User, { foreignKey: "user_id", as: "user" });

WaliBroadcast.belongsTo(UploadedFile, { foreignKey: "uploaded_file_id", as: "file" });
UploadedFile.hasMany(WaliBroadcast, { foreignKey: "uploaded_file_id", as: "broadcasts" });
User.hasMany(WaliBroadcast, { foreignKey: "created_by_user_id", as: "waliBroadcasts" });
WaliBroadcast.belongsTo(User, { foreignKey: "created_by_user_id", as: "createdByUser" });

WaliBroadcast.hasMany(WaliBroadcastRecipient, { foreignKey: "broadcast_id", as: "recipients" });
WaliBroadcastRecipient.belongsTo(WaliBroadcast, { foreignKey: "broadcast_id", as: "broadcast" });
User.hasMany(WaliBroadcastRecipient, { foreignKey: "user_id", as: "broadcastRecipients" });
WaliBroadcastRecipient.belongsTo(User, { foreignKey: "user_id", as: "user" });

WaliBroadcast.hasMany(WaliBroadcastComment, { foreignKey: "broadcast_id", as: "comments" });
WaliBroadcastComment.belongsTo(WaliBroadcast, { foreignKey: "broadcast_id", as: "broadcast" });
User.hasMany(WaliBroadcastComment, { foreignKey: "user_id", as: "broadcastComments" });
WaliBroadcastComment.belongsTo(User, { foreignKey: "user_id", as: "user" });

User.hasMany(WaliInstruction, { foreignKey: "created_by_user_id", as: "waliInstructions" });
WaliInstruction.belongsTo(User, { foreignKey: "created_by_user_id", as: "createdByUser" });
WaliInstruction.hasMany(WaliInstructionFile, { foreignKey: "instruction_id", as: "files" });
WaliInstructionFile.belongsTo(WaliInstruction, { foreignKey: "instruction_id", as: "instruction" });
WaliInstructionFile.belongsTo(UploadedFile, { foreignKey: "uploaded_file_id", as: "file" });
UploadedFile.hasMany(WaliInstructionFile, { foreignKey: "uploaded_file_id", as: "instructionFiles" });
WaliInstruction.hasMany(WaliInstructionRecipient, { foreignKey: "instruction_id", as: "recipients" });
WaliInstructionRecipient.belongsTo(WaliInstruction, { foreignKey: "instruction_id", as: "instruction" });
User.hasMany(WaliInstructionRecipient, { foreignKey: "user_id", as: "instructionRecipients" });
WaliInstructionRecipient.belongsTo(User, { foreignKey: "user_id", as: "user" });

Rapport.hasMany(RapportComment, { foreignKey: "rapport_id", as: "comments" });
RapportComment.belongsTo(Rapport, { foreignKey: "rapport_id", as: "rapport" });
User.hasMany(RapportComment, { foreignKey: "author_user_id", as: "rapportComments" });
RapportComment.belongsTo(User, { foreignKey: "author_user_id", as: "author" });
RapportVersion.hasMany(RapportComment, { foreignKey: "rapport_version_id", as: "comments" });
RapportComment.belongsTo(RapportVersion, { foreignKey: "rapport_version_id", as: "rapportVersion" });
RapportComment.hasMany(Notification, { foreignKey: "comment_id", as: "notifications" });
Notification.belongsTo(RapportComment, { foreignKey: "comment_id", as: "comment" });
RapportCalendarEvent.hasMany(Notification, { foreignKey: "calendar_event_id", as: "notifications" });
Notification.belongsTo(RapportCalendarEvent, { foreignKey: "calendar_event_id", as: "calendarEvent" });

GuideVideo.belongsTo(UploadedFile, { foreignKey: "uploaded_file_id", as: "file" });
UploadedFile.hasMany(GuideVideo, { foreignKey: "uploaded_file_id", as: "guideVideos" });
User.hasMany(GuideVideo, { foreignKey: "created_by_user_id", as: "guideVideosCreated" });
GuideVideo.belongsTo(User, { foreignKey: "created_by_user_id", as: "createdByUser" });

User.hasMany(UserServiceGrant, { foreignKey: "user_id", as: "serviceGrants" });
UserServiceGrant.belongsTo(User, { foreignKey: "user_id", as: "user" });
Service.hasMany(UserServiceGrant, { foreignKey: "service_id", as: "userGrants" });
UserServiceGrant.belongsTo(Service, { foreignKey: "service_id", as: "service" });

module.exports = {
  sequelize,
  Daira,
  Direction,
  Municipality,
  User,
  AuditLog,
  Department,
  AccessRoleTemplate,
  AccessRoleTemplatePermission,
  UserPermissionOverride,
  Service,
  RapportType,
  Rapport,
  RapportVersion,
  WaliResponse,
  ChefResponse,
  RapportTableSchema,
  RapportDocumentTemplate,
  Notification,
  UserServiceGrant,
  UploadedFile,
  RapportCalendarEvent,
  RapportView,
  WaliBroadcast,
  WaliBroadcastRecipient,
  WaliBroadcastComment,
  WaliInstruction,
  WaliInstructionFile,
  WaliInstructionRecipient,
  RapportComment,
  GuideVideo,
  RefreshToken,
  UserNotificationPreference,
  WebPushSubscription
};
