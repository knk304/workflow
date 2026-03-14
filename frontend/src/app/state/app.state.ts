// state/app.state.ts
import { AuthState, authFeatureKey, authReducer } from './auth/auth.reducer';
import { CasesState, casesFeatureKey, casesReducer } from './cases/cases.reducer';
import { TasksState, tasksFeatureKey, tasksReducer } from './tasks/tasks.reducer';
import {
  NotificationsState,
  notificationsFeatureKey,
  notificationsReducer,
} from './notifications/notifications.reducer';

export interface AppState {
  [authFeatureKey]: AuthState;
  [casesFeatureKey]: CasesState;
  [tasksFeatureKey]: TasksState;
  [notificationsFeatureKey]: NotificationsState;
}

export const appReducers = {
  [authFeatureKey]: authReducer,
  [casesFeatureKey]: casesReducer,
  [tasksFeatureKey]: tasksReducer,
  [notificationsFeatureKey]: notificationsReducer,
};
