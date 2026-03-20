import { createReducer, on } from '@ngrx/store';
import { CaseTypeDefinition } from '@core/models';
import * as CaseTypesActions from './case-types.actions';

export const caseTypesFeatureKey = 'caseTypes';

export interface CaseTypesState {
  list: CaseTypeDefinition[];
  selected: CaseTypeDefinition | null;
  validation: { valid: boolean; errors: string[] } | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: CaseTypesState = {
  list: [],
  selected: null,
  validation: null,
  isLoading: false,
  error: null,
};

export const caseTypesReducer = createReducer(
  initialState,

  // Load all
  on(CaseTypesActions.loadCaseTypeDefinitions, (state) => ({
    ...state, isLoading: true, error: null,
  })),
  on(CaseTypesActions.loadCaseTypeDefinitionsSuccess, (state, { definitions }) => ({
    ...state, list: definitions, isLoading: false,
  })),
  on(CaseTypesActions.loadCaseTypeDefinitionsFailure, (state, { error }) => ({
    ...state, isLoading: false, error,
  })),

  // Load one
  on(CaseTypesActions.loadCaseTypeDefinition, (state) => ({
    ...state, isLoading: true, error: null,
  })),
  on(CaseTypesActions.loadCaseTypeDefinitionSuccess, (state, { definition }) => ({
    ...state, selected: definition, isLoading: false,
  })),
  on(CaseTypesActions.loadCaseTypeDefinitionFailure, (state, { error }) => ({
    ...state, isLoading: false, error,
  })),

  // Create
  on(CaseTypesActions.createCaseTypeDefinition, (state) => ({
    ...state, isLoading: true, error: null,
  })),
  on(CaseTypesActions.createCaseTypeDefinitionSuccess, (state, { definition }) => ({
    ...state, list: [...state.list, definition], selected: definition, isLoading: false,
  })),
  on(CaseTypesActions.createCaseTypeDefinitionFailure, (state, { error }) => ({
    ...state, isLoading: false, error,
  })),

  // Update
  on(CaseTypesActions.updateCaseTypeDefinition, (state) => ({
    ...state, isLoading: true, error: null,
  })),
  on(CaseTypesActions.updateCaseTypeDefinitionSuccess, (state, { definition }) => ({
    ...state,
    list: state.list.map(d => d.id === definition.id ? definition : d),
    selected: state.selected?.id === definition.id ? definition : state.selected,
    isLoading: false,
  })),
  on(CaseTypesActions.updateCaseTypeDefinitionFailure, (state, { error }) => ({
    ...state, isLoading: false, error,
  })),

  // Delete
  on(CaseTypesActions.deleteCaseTypeDefinition, (state) => ({
    ...state, isLoading: true, error: null,
  })),
  on(CaseTypesActions.deleteCaseTypeDefinitionSuccess, (state, { id }) => ({
    ...state,
    list: state.list.filter(d => d.id !== id),
    selected: state.selected?.id === id ? null : state.selected,
    isLoading: false,
  })),
  on(CaseTypesActions.deleteCaseTypeDefinitionFailure, (state, { error }) => ({
    ...state, isLoading: false, error,
  })),

  // Duplicate
  on(CaseTypesActions.duplicateCaseTypeDefinition, (state) => ({
    ...state, isLoading: true, error: null,
  })),
  on(CaseTypesActions.duplicateCaseTypeDefinitionSuccess, (state, { definition }) => ({
    ...state, list: [...state.list, definition], isLoading: false,
  })),
  on(CaseTypesActions.duplicateCaseTypeDefinitionFailure, (state, { error }) => ({
    ...state, isLoading: false, error,
  })),

  // Validate
  on(CaseTypesActions.validateCaseTypeDefinition, (state) => ({
    ...state, isLoading: true, validation: null,
  })),
  on(CaseTypesActions.validateCaseTypeDefinitionSuccess, (state, { valid, errors }) => ({
    ...state, validation: { valid, errors }, isLoading: false,
  })),
  on(CaseTypesActions.validateCaseTypeDefinitionFailure, (state, { error }) => ({
    ...state, isLoading: false, error,
  })),

  // Select / Clear
  on(CaseTypesActions.selectCaseTypeDefinition, (state, { definition }) => ({
    ...state, selected: definition,
  })),
  on(CaseTypesActions.clearCaseTypesError, (state) => ({
    ...state, error: null,
  })),
);
