// state/cases/cases.actions.ts
import { createAction, props } from '@ngrx/store';
import { Case, CaseInstance, CaseCreateRequest, CaseUpdateRequest, StepCompleteRequest, AdvanceStageRequest, ChangeStageRequest, CaseTypeDefinition } from '../../core/models';

// ── Legacy Case actions (kept for backward compat) ────────

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

export const createCase = createAction(
  '[Cases] Create',
  props<{ caseData: Partial<Case> }>()
);

export const createCaseSuccess = createAction(
  '[Cases] Create Success',
  props<{ case: Case }>()
);

export const createCaseFailure = createAction(
  '[Cases] Create Failure',
  props<{ error: string }>()
);

// ── Pega-Lite Case Type Definitions ───────────────────────

export const loadCaseTypeDefinitions = createAction('[CaseTypes] Load Definitions');
export const loadCaseTypeDefinitionsSuccess = createAction(
  '[CaseTypes] Load Definitions Success',
  props<{ definitions: CaseTypeDefinition[] }>()
);
export const loadCaseTypeDefinitionsFailure = createAction(
  '[CaseTypes] Load Definitions Failure',
  props<{ error: string }>()
);

export const loadCaseTypeDefinitionById = createAction(
  '[CaseTypes] Load Definition By Id',
  props<{ id: string }>()
);
export const loadCaseTypeDefinitionByIdSuccess = createAction(
  '[CaseTypes] Load Definition By Id Success',
  props<{ definition: CaseTypeDefinition }>()
);
export const loadCaseTypeDefinitionByIdFailure = createAction(
  '[CaseTypes] Load Definition By Id Failure',
  props<{ error: string }>()
);

// ── Pega-Lite Case Instances ──────────────────────────────

export const loadCaseInstances = createAction(
  '[Cases] Load Instances',
  props<{ filters?: Record<string, string> }>()
);
export const loadCaseInstancesSuccess = createAction(
  '[Cases] Load Instances Success',
  props<{ instances: CaseInstance[] }>()
);
export const loadCaseInstancesFailure = createAction(
  '[Cases] Load Instances Failure',
  props<{ error: string }>()
);

export const loadCaseInstance = createAction(
  '[Cases] Load Instance',
  props<{ id: string }>()
);
export const loadCaseInstanceSuccess = createAction(
  '[Cases] Load Instance Success',
  props<{ instance: CaseInstance }>()
);
export const loadCaseInstanceFailure = createAction(
  '[Cases] Load Instance Failure',
  props<{ error: string }>()
);

export const createCaseInstance = createAction(
  '[Cases] Create Instance',
  props<{ request: CaseCreateRequest }>()
);
export const createCaseInstanceSuccess = createAction(
  '[Cases] Create Instance Success',
  props<{ instance: CaseInstance }>()
);
export const createCaseInstanceFailure = createAction(
  '[Cases] Create Instance Failure',
  props<{ error: string }>()
);

export const updateCaseInstance = createAction(
  '[Cases] Update Instance',
  props<{ id: string; request: CaseUpdateRequest }>()
);
export const updateCaseInstanceSuccess = createAction(
  '[Cases] Update Instance Success',
  props<{ instance: CaseInstance }>()
);
export const updateCaseInstanceFailure = createAction(
  '[Cases] Update Instance Failure',
  props<{ error: string }>()
);

export const completeStep = createAction(
  '[Cases] Complete Step',
  props<{ caseId: string; stepId: string; request: StepCompleteRequest }>()
);
export const completeStepSuccess = createAction(
  '[Cases] Complete Step Success',
  props<{ instance: CaseInstance }>()
);
export const completeStepFailure = createAction(
  '[Cases] Complete Step Failure',
  props<{ error: string }>()
);

export const advanceStage = createAction(
  '[Cases] Advance Stage',
  props<{ caseId: string; request?: AdvanceStageRequest }>()
);
export const advanceStageSuccess = createAction(
  '[Cases] Advance Stage Success',
  props<{ instance: CaseInstance }>()
);
export const advanceStageFailure = createAction(
  '[Cases] Advance Stage Failure',
  props<{ error: string }>()
);

export const changeStage = createAction(
  '[Cases] Change Stage',
  props<{ caseId: string; request: ChangeStageRequest }>()
);
export const changeStageSuccess = createAction(
  '[Cases] Change Stage Success',
  props<{ instance: CaseInstance }>()
);
export const changeStageFailure = createAction(
  '[Cases] Change Stage Failure',
  props<{ error: string }>()
);

export const resolveCaseInstance = createAction(
  '[Cases] Resolve Instance',
  props<{ caseId: string }>()
);
export const resolveCaseInstanceSuccess = createAction(
  '[Cases] Resolve Instance Success',
  props<{ instance: CaseInstance }>()
);
export const resolveCaseInstanceFailure = createAction(
  '[Cases] Resolve Instance Failure',
  props<{ error: string }>()
);

export const withdrawCaseInstance = createAction(
  '[Cases] Withdraw Instance',
  props<{ caseId: string }>()
);
export const withdrawCaseInstanceSuccess = createAction(
  '[Cases] Withdraw Instance Success',
  props<{ instance: CaseInstance }>()
);
export const withdrawCaseInstanceFailure = createAction(
  '[Cases] Withdraw Instance Failure',
  props<{ error: string }>()
);

export const selectCaseInstance = createAction(
  '[Cases] Select Instance',
  props<{ id: string }>()
);
