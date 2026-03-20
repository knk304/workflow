// state/assignments/assignments.selectors.ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { AssignmentsState, assignmentsFeatureKey } from './assignments.reducer';

export const selectAssignmentsState =
  createFeatureSelector<AssignmentsState>(assignmentsFeatureKey);

export const selectAllAssignments = createSelector(
  selectAssignmentsState,
  (state) => state.list
);

export const selectMyAssignments = createSelector(
  selectAssignmentsState,
  (state) => state.myAssignments
);

export const selectSelectedAssignment = createSelector(
  selectAssignmentsState,
  (state) => state.selected
);

export const selectAssignmentsLoading = createSelector(
  selectAssignmentsState,
  (state) => state.isLoading
);

export const selectAssignmentsError = createSelector(
  selectAssignmentsState,
  (state) => state.error
);

export const selectAssignmentById = (id: string) =>
  createSelector(selectAllAssignments, (assignments) =>
    assignments.find((a) => a.id === id)
  );

export const selectAssignmentsByStatus = (status: string) =>
  createSelector(selectAllAssignments, (assignments) =>
    assignments.filter((a) => a.status === status)
  );

export const selectOpenAssignments = createSelector(
  selectMyAssignments,
  (assignments) => assignments.filter((a) => a.status === 'open')
);

export const selectMyAssignmentCount = createSelector(
  selectMyAssignments,
  (assignments) => assignments.length
);

export const selectMyOpenAssignmentCount = createSelector(
  selectOpenAssignments,
  (assignments) => assignments.length
);
