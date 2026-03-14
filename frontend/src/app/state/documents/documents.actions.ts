import { createAction, props } from '@ngrx/store';
import { Document, DocumentVersion } from '../../core/models';

export const loadDocuments = createAction('[Documents] Load', props<{ caseId?: string }>());
export const loadDocumentsSuccess = createAction('[Documents] Load Success', props<{ documents: Document[] }>());
export const loadDocumentsFailure = createAction('[Documents] Load Failure', props<{ error: string }>());

export const uploadDocument = createAction('[Documents] Upload', props<{ caseId: string; file: File; description?: string; tags?: string[] }>());
export const uploadDocumentSuccess = createAction('[Documents] Upload Success', props<{ document: Document }>());
export const uploadDocumentFailure = createAction('[Documents] Upload Failure', props<{ error: string }>());

export const deleteDocument = createAction('[Documents] Delete', props<{ id: string }>());
export const deleteDocumentSuccess = createAction('[Documents] Delete Success', props<{ id: string }>());
export const deleteDocumentFailure = createAction('[Documents] Delete Failure', props<{ error: string }>());

export const loadVersions = createAction('[Documents] Load Versions', props<{ id: string }>());
export const loadVersionsSuccess = createAction('[Documents] Load Versions Success', props<{ id: string; versions: DocumentVersion[] }>());
export const loadVersionsFailure = createAction('[Documents] Load Versions Failure', props<{ error: string }>());

export const clearError = createAction('[Documents] Clear Error');
