// state/notifications/notifications.selectors.ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { NotificationsState, notificationsFeatureKey } from './notifications.reducer';

export const selectNotificationsState =
  createFeatureSelector<NotificationsState>(notificationsFeatureKey);

export const selectNotificationsList = createSelector(
  selectNotificationsState,
  (state) => state.items
);

export const selectNotificationsLoading = createSelector(
  selectNotificationsState,
  (state) => state.isLoading
);

export const selectNotificationsError = createSelector(
  selectNotificationsState,
  (state) => state.error
);

export const selectUnreadNotifications = createSelector(
  selectNotificationsList,
  (notifications) => notifications.filter((n) => !n.isRead)
);

export const selectUnreadNotificationCount = createSelector(
  selectUnreadNotifications,
  (unread) => unread.length
);

export const selectNotificationsByType = (type: string) =>
  createSelector(selectNotificationsList, (notifications) =>
    notifications.filter((n) => n.type === type)
  );

export const selectRecentNotifications = (limit: number = 10) =>
  createSelector(selectNotificationsList, (notifications) =>
    notifications.slice(0, limit)
  );
