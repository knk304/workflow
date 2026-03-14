// state/cases/cases.selectors.ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { CasesState, casesFeatureKey } from './cases.reducer';

export const selectCasesState = createFeatureSelector<CasesState>(casesFeatureKey);

export const selectCasesList = createSelector(selectCasesState, (state) => state.list);

export const selectSelectedCase = createSelector(selectCasesState, (state) => state.selected);

export const selectCasesLoading = createSelector(selectCasesState, (state) => state.isLoading);

export const selectCasesError = createSelector(selectCasesState, (state) => state.error);

export const selectCasesFilters = createSelector(selectCasesState, (state) => state.filters);

export const selectCaseById = (caseId: string) =>
  createSelector(selectCasesList, (cases) => cases.find((c) => c.id === caseId));

export const selectCasesByStatus = (status: string) =>
  createSelector(selectCasesList, (cases) => cases.filter((c) => c.status === status));

export const selectCasesByStage = (stage: string) =>
  createSelector(selectCasesList, (cases) => cases.filter((c) => c.stage === stage));

export const selectCasesByPriority = (priority: string) =>
  createSelector(selectCasesList, (cases) => cases.filter((c) => c.priority === priority));

export const selectOpenCases = createSelector(
  selectCasesList,
  (cases) => cases.filter((c) => c.status === 'open')
);

export const selectCriticalCases = createSelector(
  selectCasesList,
  (cases) => cases.filter((c) => c.priority === 'critical')
);
