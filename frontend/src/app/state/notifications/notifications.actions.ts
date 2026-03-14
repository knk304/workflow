// state/notifications/notifications.actions.ts
import { createAction, props } from '@ngrx/store';
import { Notification } from '../../core/models';

export const loadNotifications = createAction(
  '[Notifications] Load',
  props<{ userId: string }>()
);

export const loadNotificationsSuccess = createAction(
  '[Notifications] Load Success',
  props<{ notifications: Notification[] }>()
);

export const loadNotificationsFailure = createAction(
  '[Notifications] Load Failure',
  props<{ error: string }>()
);

export const addNotification = createAction(
  '[Notifications] Add',
  props<{ notification: Omit<Notification, 'id' | 'createdAt'> }>()
);

export const addNotificationSuccess = createAction(
  '[Notifications] Add Success',
  props<{ notification: Notification }>()
);

export const markAsRead = createAction(
  '[Notifications] Mark As Read',
  props<{ notificationId: string }>()
);

export const markAsReadSuccess = createAction(
  '[Notifications] Mark As Read Success',
  props<{ notification: Notification }>()
);

export const markAllAsRead = createAction('[Notifications] Mark All As Read');

export const dismissNotification = createAction(
  '[Notifications] Dismiss',
  props<{ notificationId: string }>()
);

export const clearError = createAction('[Notifications] Clear Error');
