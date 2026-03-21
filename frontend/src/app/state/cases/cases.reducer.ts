// state/cases/cases.reducer.ts
import { createReducer, on } from '@ngrx/store';
import { CaseInstance, CaseTypeDefinition } from '../../core/models';
import * as CasesActions from './cases.actions';

export const casesFeatureKey = 'cases';

export interface CasesState {
  definitions: CaseTypeDefinition[];
  selectedDefinition: CaseTypeDefinition | null;
  instances: CaseInstance[];
  selectedInstance: CaseInstance | null;
  isLoading: boolean;
  error: string | null;
  filters: any;
}

const initialState: CasesState = {
  definitions: [],
  selectedDefinition: null,
  instances: [],
  selectedInstance: null,
  isLoading: false,
  error: null,
  filters: {},
};

export const casesReducer = createReducer(
  initialState,

  on(CasesActions.clearError, (state) => ({
    ...state,
    error: null,
  })),

  // ── Case Type Definitions handlers ──────────────────────
  on(CasesActions.loadCaseTypeDefinitions, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(CasesActions.loadCaseTypeDefinitionsSuccess, (state, { definitions }) => ({
    ...state,
    definitions,
    isLoading: false,
  })),
  on(CasesActions.loadCaseTypeDefinitionsFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),
  on(CasesActions.loadCaseTypeDefinitionById, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(CasesActions.loadCaseTypeDefinitionByIdSuccess, (state, { definition }) => ({
    ...state,
    selectedDefinition: definition,
    isLoading: false,
  })),
  on(CasesActions.loadCaseTypeDefinitionByIdFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),

  // ── Case Instances handlers ─────────────────────────────
  on(CasesActions.loadCaseInstances, (state, { filters }) => ({
    ...state,
    isLoading: true,
    error: null,
    filters: filters || {},
  })),
  on(CasesActions.loadCaseInstancesSuccess, (state, { instances }) => ({
    ...state,
    instances,
    isLoading: false,
  })),
  on(CasesActions.loadCaseInstancesFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),

  on(CasesActions.loadCaseInstance, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(CasesActions.loadCaseInstanceSuccess, (state, { instance }) => ({
    ...state,
    selectedInstance: instance,
    isLoading: false,
  })),
  on(CasesActions.loadCaseInstanceFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),

  on(CasesActions.createCaseInstance, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(CasesActions.createCaseInstanceSuccess, (state, { instance }) => ({
    ...state,
    instances: [instance, ...state.instances],
    selectedInstance: instance,
    isLoading: false,
  })),
  on(CasesActions.createCaseInstanceFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),

  on(CasesActions.updateCaseInstanceSuccess, (state, { instance }) => ({
    ...state,
    instances: state.instances.map((i) => (i.id === instance.id ? instance : i)),
    selectedInstance: state.selectedInstance?.id === instance.id ? instance : state.selectedInstance,
  })),
  on(CasesActions.updateCaseInstanceFailure, (state, { error }) => ({
    ...state,
    error,
  })),

  // completeStep, advanceStage, changeStage, resolve, withdraw all update the instance
  on(
    CasesActions.completeStepSuccess,
    CasesActions.advanceStageSuccess,
    CasesActions.changeStageSuccess,
    CasesActions.resolveCaseInstanceSuccess,
    CasesActions.withdrawCaseInstanceSuccess,
    (state, { instance }) => ({
      ...state,
      instances: state.instances.map((i) => (i.id === instance.id ? instance : i)),
      selectedInstance: state.selectedInstance?.id === instance.id ? instance : state.selectedInstance,
      isLoading: false,
    })
  ),
  on(
    CasesActions.completeStepFailure,
    CasesActions.advanceStageFailure,
    CasesActions.changeStageFailure,
    CasesActions.resolveCaseInstanceFailure,
    CasesActions.withdrawCaseInstanceFailure,
    (state, { error }) => ({
      ...state,
      isLoading: false,
      error,
    })
  ),

  on(CasesActions.selectCaseInstance, (state, { id }) => ({
    ...state,
    selectedInstance: state.instances.find((i) => i.id === id) || null,
  }))
);
