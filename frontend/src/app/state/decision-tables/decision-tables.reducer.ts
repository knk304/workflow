import { createReducer, on } from '@ngrx/store';
import { DecisionTable, DecisionTableEvaluateResponse } from '@core/models';
import * as DTActions from './decision-tables.actions';

export const decisionTablesFeatureKey = 'decisionTables';

export interface DecisionTablesState {
  list: DecisionTable[];
  selected: DecisionTable | null;
  testResult: DecisionTableEvaluateResponse | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: DecisionTablesState = {
  list: [],
  selected: null,
  testResult: null,
  isLoading: false,
  error: null,
};

export const decisionTablesReducer = createReducer(
  initialState,

  // Load all
  on(DTActions.loadDecisionTables, (state) => ({ ...state, isLoading: true, error: null })),
  on(DTActions.loadDecisionTablesSuccess, (state, { tables }) => ({ ...state, list: tables, isLoading: false })),
  on(DTActions.loadDecisionTablesFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  // Load one
  on(DTActions.loadDecisionTable, (state) => ({ ...state, isLoading: true, error: null })),
  on(DTActions.loadDecisionTableSuccess, (state, { table }) => ({ ...state, selected: table, isLoading: false })),
  on(DTActions.loadDecisionTableFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  // Create
  on(DTActions.createDecisionTable, (state) => ({ ...state, isLoading: true, error: null })),
  on(DTActions.createDecisionTableSuccess, (state, { table }) => ({
    ...state, list: [...state.list, table], selected: table, isLoading: false,
  })),
  on(DTActions.createDecisionTableFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  // Update
  on(DTActions.updateDecisionTable, (state) => ({ ...state, isLoading: true, error: null })),
  on(DTActions.updateDecisionTableSuccess, (state, { table }) => ({
    ...state,
    list: state.list.map(t => t.id === table.id ? table : t),
    selected: state.selected?.id === table.id ? table : state.selected,
    isLoading: false,
  })),
  on(DTActions.updateDecisionTableFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  // Delete
  on(DTActions.deleteDecisionTable, (state) => ({ ...state, isLoading: true, error: null })),
  on(DTActions.deleteDecisionTableSuccess, (state, { id }) => ({
    ...state,
    list: state.list.filter(t => t.id !== id),
    selected: state.selected?.id === id ? null : state.selected,
    isLoading: false,
  })),
  on(DTActions.deleteDecisionTableFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  // Evaluate
  on(DTActions.evaluateDecisionTable, (state) => ({ ...state, isLoading: true, testResult: null })),
  on(DTActions.evaluateDecisionTableSuccess, (state, { result }) => ({ ...state, testResult: result, isLoading: false })),
  on(DTActions.evaluateDecisionTableFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  // Select / Clear
  on(DTActions.selectDecisionTable, (state, { table }) => ({ ...state, selected: table })),
  on(DTActions.clearDecisionTablesError, (state) => ({ ...state, error: null })),
);
