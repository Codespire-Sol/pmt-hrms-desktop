// Components
export { NotificationBell } from './components/NotificationBell';
export { NotificationList } from './components/NotificationList';
export { NotificationPreferences } from './components/NotificationPreferences';

// API
export {
  notificationsApi,
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useGetNotificationTypesQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useGetPreferencesQuery,
  useUpdatePreferenceMutation,
  useUpdatePreferencesMutation,
} from './notificationsApi';

// Types
export type {
  Notification,
  NotificationWithDetails,
  NotificationPreference,
  NotificationType,
  NotificationTypeInfo,
  NotificationsResponse,
  UpdatePreferenceInput,
} from './types';
