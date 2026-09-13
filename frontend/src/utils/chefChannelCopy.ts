import {
  usesChefNotificationsWording,
  chefChannelNavLabelKey,
} from '@wali/access-policy'

/** Role-aware i18n keys for the Chef→creators channel (تعليمات vs إشعارات). */
export function chefChannelCopy(role?: string | null) {
  const asNotifications = usesChefNotificationsWording(role)
  return {
    nav: chefChannelNavLabelKey(role),
    listHint: asNotifications
      ? 'chefNotificationsListHint'
      : 'chefInstructionsListHint',
    empty: asNotifications ? 'chefNotificationsEmpty' : 'chefInstructionsEmpty',
    listHintOffice: asNotifications
      ? 'chefNotificationsListHintOffice'
      : 'chefInstructionsListHintOffice',
    listHintWali: asNotifications
      ? 'chefNotificationsListHintWali'
      : 'chefInstructionsListHintWali',
    create: asNotifications ? 'createChefNotification' : 'createChefInstruction',
    delete: asNotifications ? 'deleteChefNotification' : 'deleteChefInstruction',
    deleteDone: asNotifications
      ? 'deleteChefNotificationDone'
      : 'deleteChefInstructionDone',
    deleteTitle: asNotifications
      ? 'deleteChefNotificationConfirmTitle'
      : 'deleteChefInstructionConfirmTitle',
    deleteMessage: asNotifications
      ? 'deleteChefNotificationConfirmMessage'
      : 'deleteChefInstructionConfirmMessage',
    /** Preference type display (DB key stays chef_instructions). */
    notifType: asNotifications
      ? 'notifType_chef_notifications'
      : 'notifType_chef_instructions',
    notifTypeDesc: asNotifications
      ? 'notifTypeDesc_chef_notifications'
      : 'notifTypeDesc_chef_instructions',
  }
}
