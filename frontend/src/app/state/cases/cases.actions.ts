// state/cases/cases.actions.ts
import { createAction, props } from '@ngrx/store';
import { Case } from '../../core/models';

export const loadCases = createAction('[Cases] Load', props<{ filters?: any }>());

export const loadCasesSuccess = createAction(
  '[Cases] Load Success',
  props<{ cases: Case[] }>()
);

export const loadCasesFailure = createAction('[Cases] Load Failure', props<{ error: string }>());

export const loadCaseById = createAction('[Cases] Load By Id', props<{ id: string }>());

export const loadCaseByIdSuccess = createAction(
  '[Cases] Load By Id Success',
  props<{ case: Case }>()
);

export const loadCaseByIdFailure = createAction(
  '[Cases] Load By Id Failure',
  props<{ error: string }>()
);

export const selectCase = createAction('[Cases] Select', props<{ caseId: string }>());

export const updateCase = createAction('[Cases] Update', props<{ caseId: string; updates: Partial<Case> }>());

export const updateCaseSuccess = createAction(
  '[Cases] Update Success',
  props<{ case: Case }>()
);

export const updateCaseFailure = createAction('[Cases] Update Failure', props<{ error: string }>());

export const transitionCase = createAction(
  '[Cases] Transition',
  props<{ caseId: string; action: string; notes?: string }>()
);

export const transitionCaseSuccess = createAction(
  '[Cases] Transition Success',
  props<{ case: Case }>()
);

export const transitionCaseFailure = createAction(
  '[Cases] Transition Failure',
  props<{ error: string }>()
);

export const clearError = createAction('[Cases] Clear Error');
