import { createAction, props } from '@ngrx/store';
import { CaseTypeDefinition, CaseTypeCreateRequest, CaseTypeUpdateRequest } from '@core/models';

// Load all
export const loadCaseTypeDefinitions = createAction('[CaseTypes] Load All');
export const loadCaseTypeDefinitionsSuccess = createAction('[CaseTypes] Load All Success', props<{ definitions: CaseTypeDefinition[] }>());
export const loadCaseTypeDefinitionsFailure = createAction('[CaseTypes] Load All Failure', props<{ error: string }>());

// Load one
export const loadCaseTypeDefinition = createAction('[CaseTypes] Load One', props<{ id: string }>());
export const loadCaseTypeDefinitionSuccess = createAction('[CaseTypes] Load One Success', props<{ definition: CaseTypeDefinition }>());
export const loadCaseTypeDefinitionFailure = createAction('[CaseTypes] Load One Failure', props<{ error: string }>());

// Create
export const createCaseTypeDefinition = createAction('[CaseTypes] Create', props<{ request: CaseTypeCreateRequest }>());
export const createCaseTypeDefinitionSuccess = createAction('[CaseTypes] Create Success', props<{ definition: CaseTypeDefinition }>());
export const createCaseTypeDefinitionFailure = createAction('[CaseTypes] Create Failure', props<{ error: string }>());

// Update
export const updateCaseTypeDefinition = createAction('[CaseTypes] Update', props<{ id: string; request: CaseTypeUpdateRequest }>());
export const updateCaseTypeDefinitionSuccess = createAction('[CaseTypes] Update Success', props<{ definition: CaseTypeDefinition }>());
export const updateCaseTypeDefinitionFailure = createAction('[CaseTypes] Update Failure', props<{ error: string }>());

// Delete
export const deleteCaseTypeDefinition = createAction('[CaseTypes] Delete', props<{ id: string }>());
export const deleteCaseTypeDefinitionSuccess = createAction('[CaseTypes] Delete Success', props<{ id: string }>());
export const deleteCaseTypeDefinitionFailure = createAction('[CaseTypes] Delete Failure', props<{ error: string }>());

// Duplicate
export const duplicateCaseTypeDefinition = createAction('[CaseTypes] Duplicate', props<{ id: string }>());
export const duplicateCaseTypeDefinitionSuccess = createAction('[CaseTypes] Duplicate Success', props<{ definition: CaseTypeDefinition }>());
export const duplicateCaseTypeDefinitionFailure = createAction('[CaseTypes] Duplicate Failure', props<{ error: string }>());

// Validate
export const validateCaseTypeDefinition = createAction('[CaseTypes] Validate', props<{ id: string }>());
export const validateCaseTypeDefinitionSuccess = createAction('[CaseTypes] Validate Success', props<{ valid: boolean; errors: string[] }>());
export const validateCaseTypeDefinitionFailure = createAction('[CaseTypes] Validate Failure', props<{ error: string }>());

// Select
export const selectCaseTypeDefinition = createAction('[CaseTypes] Select', props<{ definition: CaseTypeDefinition | null }>());
export const clearCaseTypesError = createAction('[CaseTypes] Clear Error');
