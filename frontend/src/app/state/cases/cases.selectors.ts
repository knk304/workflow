// state/cases/cases.selectors.ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { CasesState, casesFeatureKey } from './cases.reducer';

export const selectCasesState = createFeatureSelector<CasesState>(casesFeatureKey);

// ── Legacy Case selectors ─────────────────────────────────

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

// ── Case Type Definition selectors ────────────────────────

export const selectCaseTypeDefinitions = createSelector(
  selectCasesState,
  (state) => state.definitions
);

export const selectSelectedCaseTypeDefinition = createSelector(
  selectCasesState,
  (state) => state.selectedDefinition
);

export const selectCaseTypeDefinitionById = (id: string) =>
  createSelector(selectCaseTypeDefinitions, (defs) => defs.find((d) => d.id === id));

// ── Case Instance selectors ──────────────────────────────

export const selectCaseInstances = createSelector(
  selectCasesState,
  (state) => state.instances
);

export const selectSelectedCaseInstance = createSelector(
  selectCasesState,
  (state) => state.selectedInstance
);

export const selectCaseInstanceById = (id: string) =>
  createSelector(selectCaseInstances, (instances) => instances.find((i) => i.id === id));

export const selectCaseInstancesByStatus = (status: string) =>
  createSelector(selectCaseInstances, (instances) =>
    instances.filter((i) => i.status === status)
  );

export const selectCaseInstancesByPriority = (priority: string) =>
  createSelector(selectCaseInstances, (instances) =>
    instances.filter((i) => i.priority === priority)
  );

export const selectActiveCaseInstances = createSelector(
  selectCaseInstances,
  (instances) => instances.filter((i) =>
    i.status === 'open' || i.status === 'in_progress'
  )
);

export const selectResolvedCaseInstances = createSelector(
  selectCaseInstances,
  (instances) => instances.filter((i) =>
    i.status === 'resolved_completed' || i.status === 'resolved_cancelled' || i.status === 'resolved_rejected'
  )
);

export const selectCriticalCaseInstances = createSelector(
  selectCaseInstances,
  (instances) => instances.filter((i) => i.priority === 'critical')
);

export const selectCaseInstanceCount = createSelector(
  selectCaseInstances,
  (instances) => instances.length
);
