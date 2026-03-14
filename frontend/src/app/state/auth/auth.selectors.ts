// state/auth/auth.selectors.ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AuthState, authFeatureKey } from './auth.reducer';

export const selectAuthState = createFeatureSelector<AuthState>(authFeatureKey);

export const selectUser = createSelector(selectAuthState, (state) => state.user);

export const selectToken = createSelector(selectAuthState, (state) => state.token);

export const selectIsLoading = createSelector(selectAuthState, (state) => state.isLoading);

export const selectError = createSelector(selectAuthState, (state) => state.error);

export const selectIsAuthenticated = createSelector(selectUser, (user) => !!user);

export const selectUserRole = createSelector(selectUser, (user) => user?.role);
