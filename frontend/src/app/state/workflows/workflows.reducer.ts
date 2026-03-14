import { createReducer, on } from '@ngrx/store';
import { Workflow, WorkflowValidationResult } from '../../core/models';
import * as WorkflowsActions from './workflows.actions';

export const workflowsFeatureKey = 'workflows';

export interface WorkflowsState {
  list: Workflow[];
  selected: Workflow | null;
  validation: WorkflowValidationResult | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: WorkflowsState = {
  list: [],
  selected: null,
  validation: null,
  isLoading: false,
  error: null,
};

export const workflowsReducer = createReducer(
  initialState,
  on(WorkflowsActions.loadWorkflows, (state) => ({ ...state, isLoading: true, error: null })),
  on(WorkflowsActions.loadWorkflowsSuccess, (state, { workflows }) => ({ ...state, list: workflows, isLoading: false })),
  on(WorkflowsActions.loadWorkflowsFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  on(WorkflowsActions.loadWorkflowByIdSuccess, (state, { workflow }) => ({ ...state, selected: workflow })),

  on(WorkflowsActions.createWorkflowSuccess, (state, { workflow }) => ({
    ...state, list: [...state.list, workflow],
  })),

  on(WorkflowsActions.updateWorkflowSuccess, (state, { workflow }) => ({
    ...state,
    list: state.list.map(w => w.id === workflow.id ? workflow : w),
    selected: state.selected?.id === workflow.id ? workflow : state.selected,
  })),

  on(WorkflowsActions.deleteWorkflowSuccess, (state, { id }) => ({
    ...state,
    list: state.list.filter(w => w.id !== id),
    selected: state.selected?.id === id ? null : state.selected,
  })),

  on(WorkflowsActions.validateWorkflowSuccess, (state, { result }) => ({ ...state, validation: result })),

  on(WorkflowsActions.selectWorkflow, (state, { id }) => ({
    ...state, selected: state.list.find(w => w.id === id) || null,
  })),

  on(WorkflowsActions.clearError, (state) => ({ ...state, error: null })),

  // Handle all failures
  on(
    WorkflowsActions.loadWorkflowByIdFailure,
    WorkflowsActions.createWorkflowFailure,
    WorkflowsActions.updateWorkflowFailure,
    WorkflowsActions.deleteWorkflowFailure,
    WorkflowsActions.validateWorkflowFailure,
    (state, { error }) => ({ ...state, isLoading: false, error })
  ),
);
