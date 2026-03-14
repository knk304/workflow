import { createFeatureSelector, createSelector } from '@ngrx/store';
import { WorkflowsState, workflowsFeatureKey } from './workflows.reducer';

export const selectWorkflowsState = createFeatureSelector<WorkflowsState>(workflowsFeatureKey);

export const selectWorkflowsList = createSelector(selectWorkflowsState, state => state.list);
export const selectSelectedWorkflow = createSelector(selectWorkflowsState, state => state.selected);
export const selectWorkflowValidation = createSelector(selectWorkflowsState, state => state.validation);
export const selectWorkflowsLoading = createSelector(selectWorkflowsState, state => state.isLoading);
export const selectWorkflowsError = createSelector(selectWorkflowsState, state => state.error);

export const selectWorkflowById = (id: string) =>
  createSelector(selectWorkflowsList, workflows => workflows.find(w => w.id === id));

export const selectActiveWorkflows = createSelector(
  selectWorkflowsList,
  workflows => workflows.filter(w => w.isActive)
);
