// state/cases/cases.reducer.ts
import { createReducer, on } from '@ngrx/store';
import { Case } from '../../core/models';
import * as CasesActions from './cases.actions';

export const casesFeatureKey = 'cases';

export interface CasesState {
  list: Case[];
  selected: Case | null;
  isLoading: boolean;
  error: string | null;
  filters: any;
}

const initialState: CasesState = {
  list: [],
  selected: null,
  isLoading: false,
  error: null,
  filters: {},
};

export const casesReducer = createReducer(
  initialState,
  on(CasesActions.loadCases, (state, { filters }) => ({
    ...state,
    isLoading: true,
    error: null,
    filters: filters || {},
  })),
  on(CasesActions.loadCasesSuccess, (state, { cases }) => ({
    ...state,
    list: cases,
    isLoading: false,
  })),
  on(CasesActions.loadCasesFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),
  on(CasesActions.loadCaseById, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(CasesActions.loadCaseByIdSuccess, (state, { case: caseData }) => ({
    ...state,
    selected: caseData,
    isLoading: false,
  })),
  on(CasesActions.loadCaseByIdFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),
  on(CasesActions.selectCase, (state, { caseId }) => ({
    ...state,
    selected: state.list.find((c) => c.id === caseId) || null,
  })),
  on(CasesActions.updateCaseSuccess, (state, { case: updatedCase }) => ({
    ...state,
    list: state.list.map((c) => (c.id === updatedCase.id ? updatedCase : c)),
    selected: state.selected?.id === updatedCase.id ? updatedCase : state.selected,
  })),
  on(CasesActions.updateCaseFailure, (state, { error }) => ({
    ...state,
    error,
  })),
  on(CasesActions.transitionCaseSuccess, (state, { case: transitionedCase }) => ({
    ...state,
    list: state.list.map((c) => (c.id === transitionedCase.id ? transitionedCase : c)),
    selected: state.selected?.id === transitionedCase.id ? transitionedCase : state.selected,
  })),
  on(CasesActions.transitionCaseFailure, (state, { error }) => ({
    ...state,
    error,
  })),
  on(CasesActions.clearError, (state) => ({
    ...state,
    error: null,
  })),
  on(CasesActions.createCase, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(CasesActions.createCaseSuccess, (state, { case: newCase }) => ({
    ...state,
    list: [newCase, ...state.list],
    selected: newCase,
    isLoading: false,
  })),
  on(CasesActions.createCaseFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  }))
);
