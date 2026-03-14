import { createReducer, on } from '@ngrx/store';
import { Document, DocumentVersion } from '../../core/models';
import * as DocumentsActions from './documents.actions';

export const documentsFeatureKey = 'documents';

export interface DocumentsState {
  list: Document[];
  versions: Record<string, DocumentVersion[]>;
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
}

const initialState: DocumentsState = {
  list: [],
  versions: {},
  isLoading: false,
  isUploading: false,
  error: null,
};

export const documentsReducer = createReducer(
  initialState,
  on(DocumentsActions.loadDocuments, (state) => ({ ...state, isLoading: true, error: null })),
  on(DocumentsActions.loadDocumentsSuccess, (state, { documents }) => ({ ...state, list: documents, isLoading: false })),
  on(DocumentsActions.loadDocumentsFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  on(DocumentsActions.uploadDocument, (state) => ({ ...state, isUploading: true })),
  on(DocumentsActions.uploadDocumentSuccess, (state, { document }) => ({
    ...state, list: [...state.list, document], isUploading: false,
  })),
  on(DocumentsActions.uploadDocumentFailure, (state, { error }) => ({ ...state, isUploading: false, error })),

  on(DocumentsActions.deleteDocumentSuccess, (state, { id }) => ({
    ...state, list: state.list.filter(d => d.id !== id),
  })),

  on(DocumentsActions.loadVersionsSuccess, (state, { id, versions }) => ({
    ...state, versions: { ...state.versions, [id]: versions },
  })),

  on(DocumentsActions.clearError, (state) => ({ ...state, error: null })),

  on(DocumentsActions.deleteDocumentFailure, DocumentsActions.loadVersionsFailure,
    (state, { error }) => ({ ...state, error })
  ),
);
