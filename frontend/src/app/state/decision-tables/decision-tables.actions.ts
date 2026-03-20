import { createAction, props } from '@ngrx/store';
import {
  DecisionTable, DecisionTableCreateRequest, DecisionTableUpdateRequest,
  DecisionTableEvaluateRequest, DecisionTableEvaluateResponse,
} from '@core/models';

// Load all
export const loadDecisionTables = createAction('[DecisionTables] Load All');
export const loadDecisionTablesSuccess = createAction('[DecisionTables] Load All Success', props<{ tables: DecisionTable[] }>());
export const loadDecisionTablesFailure = createAction('[DecisionTables] Load All Failure', props<{ error: string }>());

// Load one
export const loadDecisionTable = createAction('[DecisionTables] Load One', props<{ id: string }>());
export const loadDecisionTableSuccess = createAction('[DecisionTables] Load One Success', props<{ table: DecisionTable }>());
export const loadDecisionTableFailure = createAction('[DecisionTables] Load One Failure', props<{ error: string }>());

// Create
export const createDecisionTable = createAction('[DecisionTables] Create', props<{ request: DecisionTableCreateRequest }>());
export const createDecisionTableSuccess = createAction('[DecisionTables] Create Success', props<{ table: DecisionTable }>());
export const createDecisionTableFailure = createAction('[DecisionTables] Create Failure', props<{ error: string }>());

// Update
export const updateDecisionTable = createAction('[DecisionTables] Update', props<{ id: string; request: DecisionTableUpdateRequest }>());
export const updateDecisionTableSuccess = createAction('[DecisionTables] Update Success', props<{ table: DecisionTable }>());
export const updateDecisionTableFailure = createAction('[DecisionTables] Update Failure', props<{ error: string }>());

// Delete
export const deleteDecisionTable = createAction('[DecisionTables] Delete', props<{ id: string }>());
export const deleteDecisionTableSuccess = createAction('[DecisionTables] Delete Success', props<{ id: string }>());
export const deleteDecisionTableFailure = createAction('[DecisionTables] Delete Failure', props<{ error: string }>());

// Evaluate (test)
export const evaluateDecisionTable = createAction('[DecisionTables] Evaluate', props<{ id: string; request: DecisionTableEvaluateRequest }>());
export const evaluateDecisionTableSuccess = createAction('[DecisionTables] Evaluate Success', props<{ result: DecisionTableEvaluateResponse }>());
export const evaluateDecisionTableFailure = createAction('[DecisionTables] Evaluate Failure', props<{ error: string }>());

// Select / Clear
export const selectDecisionTable = createAction('[DecisionTables] Select', props<{ table: DecisionTable | null }>());
export const clearDecisionTablesError = createAction('[DecisionTables] Clear Error');
