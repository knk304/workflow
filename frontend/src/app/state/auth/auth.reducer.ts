// state/auth/auth.reducer.ts
import { createReducer, on } from '@ngrx/store';
import { User } from '../../core/models';
import * as AuthActions from './auth.actions';

export const authFeatureKey = 'auth';

export interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

function loadInitialState(): AuthState {
  try {
    const token = localStorage.getItem('auth_token');
    const userJson = localStorage.getItem('auth_user');
    if (token && userJson) {
      return {
        user: JSON.parse(userJson),
        token,
        isLoading: false,
        error: null,
      };
    }
  } catch {
    // Corrupted data – fall through to defaults
  }
  return { user: null, token: null, isLoading: false, error: null };
}

const initialState: AuthState = loadInitialState();

export const authReducer = createReducer(
  initialState,
  on(AuthActions.login, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(AuthActions.loginSuccess, (state, { user, token }) => ({
    ...state,
    user,
    token,
    isLoading: false,
    error: null,
  })),
  on(AuthActions.loginFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
    user: null,
    token: null,
  })),
  on(AuthActions.register, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(AuthActions.registerSuccess, (state, { user, token }) => ({
    ...state,
    user,
    token,
    isLoading: false,
    error: null,
  })),
  on(AuthActions.registerFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
    user: null,
    token: null,
  })),
  on(AuthActions.logout, (state) => ({
    ...state,
    isLoading: true,
  })),
  on(AuthActions.logoutSuccess, (state) => ({
    ...state,
    user: null,
    token: null,
    isLoading: false,
    error: null,
  })),
  on(AuthActions.getCurrentUserSuccess, (state, { user }) => ({
    ...state,
    user,
  })),
  on(AuthActions.getCurrentUserFailure, () => ({
    user: null,
    token: null,
    isLoading: false,
    error: null,
  })),
  on(AuthActions.clearError, (state) => ({
    ...state,
    error: null,
  }))
);
