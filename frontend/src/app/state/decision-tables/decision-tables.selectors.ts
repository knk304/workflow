import { createFeatureSelector, createSelector } from '@ngrx/store';
import { DecisionTablesState, decisionTablesFeatureKey } from './decision-tables.reducer';

const selectDTState = createFeatureSelector<DecisionTablesState>(decisionTablesFeatureKey);

export const selectAllDecisionTables = createSelector(selectDTState, s => s.list);
export const selectSelectedDecisionTable = createSelector(selectDTState, s => s.selected);
export const selectDecisionTablesLoading = createSelector(selectDTState, s => s.isLoading);
export const selectDecisionTablesError = createSelector(selectDTState, s => s.error);
export const selectDecisionTableTestResult = createSelector(selectDTState, s => s.testResult);
export const selectDecisionTableById = (id: string) =>
  createSelector(selectAllDecisionTables, list => list.find(t => t.id === id) || null);
export const selectDecisionTableCount = createSelector(selectAllDecisionTables, list => list.length);
