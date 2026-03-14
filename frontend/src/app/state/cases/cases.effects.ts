// state/cases/cases.effects.ts
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap, mergeMap } from 'rxjs/operators';
import { DataService } from '../../core/services/data.service';
import * as CasesActions from './cases.actions';

@Injectable()
export class CasesEffects {
  loadCases$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.loadCases),
      switchMap(({ filters }) =>
        this.dataService.getCases(filters).pipe(
          map((cases) => CasesActions.loadCasesSuccess({ cases })),
          catchError((error) => of(CasesActions.loadCasesFailure({ error: error.message })))
        )
      )
    )
  );

  loadCaseById$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.loadCaseById),
      switchMap(({ id }) =>
        this.dataService.getCaseById(id).pipe(
          map((caseData) => {
            if (caseData) {
              return CasesActions.loadCaseByIdSuccess({ case: caseData });
            } else {
              return CasesActions.loadCaseByIdFailure({ error: 'Case not found' });
            }
          }),
          catchError((error) =>
            of(CasesActions.loadCaseByIdFailure({ error: error.message }))
          )
        )
      )
    )
  );

  updateCase$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.updateCase),
      mergeMap(({ caseId, updates }) =>
        this.dataService.updateCase(caseId, updates).pipe(
          map((caseData) => CasesActions.updateCaseSuccess({ case: caseData })),
          catchError((error) => of(CasesActions.updateCaseFailure({ error: error.message })))
        )
      )
    )
  );

  transitionCase$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.transitionCase),
      mergeMap(({ caseId, action, notes }) =>
        this.dataService.transitionCase(caseId, action, notes).pipe(
          map((caseData) => CasesActions.transitionCaseSuccess({ case: caseData })),
          catchError((error) =>
            of(CasesActions.transitionCaseFailure({ error: error.message }))
          )
        )
      )
    )
  );

  createCase$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.createCase),
      mergeMap(({ caseData }) =>
        this.dataService.createCase(caseData).pipe(
          map((newCase) => CasesActions.createCaseSuccess({ case: newCase })),
          catchError((error) =>
            of(CasesActions.createCaseFailure({ error: error.message }))
          )
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private dataService: DataService
  ) {}
}
