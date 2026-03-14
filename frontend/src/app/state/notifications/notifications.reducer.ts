// state/notifications/notifications.reducer.ts
import { createReducer, on } from '@ngrx/store';
import { Notification } from '../../core/models';
import * as NotificationsActions from './notifications.actions';

export const notificationsFeatureKey = 'notifications';

export interface NotificationsState {
  items: Notification[];
  isLoading: boolean;
  error: string | null;
}

const initialState: NotificationsState = {
  items: [],
  isLoading: false,
  error: null,
};

export const notificationsReducer = createReducer(
  initialState,
  on(NotificationsActions.loadNotifications, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(NotificationsActions.loadNotificationsSuccess, (state, { notifications }) => ({
    ...state,
    items: notifications,
    isLoading: false,
  })),
  on(NotificationsActions.loadNotificationsFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),
  on(NotificationsActions.addNotificationSuccess, (state, { notification }) => ({
    ...state,
    items: [notification, ...state.items],
  })),
  on(NotificationsActions.markAsReadSuccess, (state, { notification }) => ({
    ...state,
    items: state.items.map((n) => (n.id === notification.id ? notification : n)),
  })),
  on(NotificationsActions.markAllAsRead, (state) => ({
    ...state,
    items: state.items.map((n) => ({
      ...n,
      isRead: true,
      readAt: new Date().toISOString(),
    })),
  })),
  on(NotificationsActions.dismissNotification, (state, { notificationId }) => ({
    ...state,
    items: state.items.filter((n) => n.id !== notificationId),
  })),
  on(NotificationsActions.clearError, (state) => ({
    ...state,
    error: null,
  }))
);
