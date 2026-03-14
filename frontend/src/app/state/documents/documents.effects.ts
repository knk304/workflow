import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap, mergeMap } from 'rxjs/operators';
import { DataService } from '../../core/services/data.service';
import * as DocumentsActions from './documents.actions';

@Injectable()
export class DocumentsEffects {
  loadDocuments$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.loadDocuments),
      switchMap(({ caseId }) =>
        this.dataService.getDocuments(caseId).pipe(
          map(documents => DocumentsActions.loadDocumentsSuccess({ documents })),
          catchError(error => of(DocumentsActions.loadDocumentsFailure({ error: error.message })))
        )
      )
    )
  );

  uploadDocument$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.uploadDocument),
      mergeMap(({ caseId, file, description, tags }) =>
        this.dataService.uploadDocument(caseId, file, description, tags).pipe(
          map(document => DocumentsActions.uploadDocumentSuccess({ document })),
          catchError(error => of(DocumentsActions.uploadDocumentFailure({ error: error.message })))
        )
      )
    )
  );

  deleteDocument$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.deleteDocument),
      mergeMap(({ id }) =>
        this.dataService.deleteDocument(id).pipe(
          map(() => DocumentsActions.deleteDocumentSuccess({ id })),
          catchError(error => of(DocumentsActions.deleteDocumentFailure({ error: error.message })))
        )
      )
    )
  );

  loadVersions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DocumentsActions.loadVersions),
      switchMap(({ id }) =>
        this.dataService.getDocumentVersions(id).pipe(
          map(versions => DocumentsActions.loadVersionsSuccess({ id, versions })),
          catchError(error => of(DocumentsActions.loadVersionsFailure({ error: error.message })))
        )
      )
    )
  );

  constructor(private actions$: Actions, private dataService: DataService) {}
}
