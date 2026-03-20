import { createFeatureSelector, createSelector } from '@ngrx/store';
import { CaseTypesState, caseTypesFeatureKey } from './case-types.reducer';

const selectCaseTypesState = createFeatureSelector<CaseTypesState>(caseTypesFeatureKey);

export const selectAllCaseTypeDefinitions = createSelector(selectCaseTypesState, s => s.list);
export const selectSelectedCaseTypeDefinition = createSelector(selectCaseTypesState, s => s.selected);
export const selectCaseTypesLoading = createSelector(selectCaseTypesState, s => s.isLoading);
export const selectCaseTypesError = createSelector(selectCaseTypesState, s => s.error);
export const selectCaseTypesValidation = createSelector(selectCaseTypesState, s => s.validation);
export const selectActiveCaseTypeDefinitions = createSelector(selectAllCaseTypeDefinitions, list => list.filter(d => d.isActive));
export const selectCaseTypeDefinitionById = (id: string) =>
  createSelector(selectAllCaseTypeDefinitions, list => list.find(d => d.id === id) || null);
export const selectCaseTypeCount = createSelector(selectAllCaseTypeDefinitions, list => list.length);
