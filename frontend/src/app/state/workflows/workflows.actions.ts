import { createAction, props } from '@ngrx/store';
import { Workflow, WorkflowValidationResult } from '../../core/models';

export const loadWorkflows = createAction('[Workflows] Load');
export const loadWorkflowsSuccess = createAction('[Workflows] Load Success', props<{ workflows: Workflow[] }>());
export const loadWorkflowsFailure = createAction('[Workflows] Load Failure', props<{ error: string }>());

export const loadWorkflowById = createAction('[Workflows] Load By Id', props<{ id: string }>());
export const loadWorkflowByIdSuccess = createAction('[Workflows] Load By Id Success', props<{ workflow: Workflow }>());
export const loadWorkflowByIdFailure = createAction('[Workflows] Load By Id Failure', props<{ error: string }>());

export const createWorkflow = createAction('[Workflows] Create', props<{ workflow: Partial<Workflow> }>());
export const createWorkflowSuccess = createAction('[Workflows] Create Success', props<{ workflow: Workflow }>());
export const createWorkflowFailure = createAction('[Workflows] Create Failure', props<{ error: string }>());

export const updateWorkflow = createAction('[Workflows] Update', props<{ id: string; updates: Partial<Workflow> }>());
export const updateWorkflowSuccess = createAction('[Workflows] Update Success', props<{ workflow: Workflow }>());
export const updateWorkflowFailure = createAction('[Workflows] Update Failure', props<{ error: string }>());

export const deleteWorkflow = createAction('[Workflows] Delete', props<{ id: string }>());
export const deleteWorkflowSuccess = createAction('[Workflows] Delete Success', props<{ id: string }>());
export const deleteWorkflowFailure = createAction('[Workflows] Delete Failure', props<{ error: string }>());

export const validateWorkflow = createAction('[Workflows] Validate', props<{ id: string }>());
export const validateWorkflowSuccess = createAction('[Workflows] Validate Success', props<{ result: WorkflowValidationResult }>());
export const validateWorkflowFailure = createAction('[Workflows] Validate Failure', props<{ error: string }>());

export const selectWorkflow = createAction('[Workflows] Select', props<{ id: string }>());
export const clearError = createAction('[Workflows] Clear Error');
