import { createFeatureSelector, createSelector } from '@ngrx/store';
import { DocumentsState, documentsFeatureKey } from './documents.reducer';

export const selectDocumentsState = createFeatureSelector<DocumentsState>(documentsFeatureKey);

export const selectDocumentsList = createSelector(selectDocumentsState, state => state.list);
export const selectDocumentsLoading = createSelector(selectDocumentsState, state => state.isLoading);
export const selectDocumentsUploading = createSelector(selectDocumentsState, state => state.isUploading);
export const selectDocumentsError = createSelector(selectDocumentsState, state => state.error);

export const selectDocumentsByCaseId = (caseId: string) =>
  createSelector(selectDocumentsList, docs => docs.filter(d => d.caseId === caseId));

export const selectDocumentVersions = (id: string) =>
  createSelector(selectDocumentsState, state => state.versions[id] || []);
