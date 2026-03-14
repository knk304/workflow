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
        this.dataService.getCaseById(caseId).pipe(
          map((caseData) => {
            if (caseData) {
              // Mock transition logic
              const updatedCase = { ...caseData };
              const currentStageIndex = updatedCase.stages.length - 1;
              if (currentStageIndex >= 0) {
                updatedCase.stages[currentStageIndex].status = 'completed';
              }
              // Move to next stage (simplified)
              const stages = ['intake', 'documents', 'underwriting', 'approval', 'disbursement'];
              const currentIndex = stages.indexOf(updatedCase.stage);
              if (currentIndex < stages.length - 1) {
                updatedCase.stage = stages[currentIndex + 1];
                updatedCase.stages.push({
                  name: updatedCase.stage,
                  status: 'in_progress',
                  enteredAt: new Date().toISOString(),
                });
              }
              updatedCase.updatedAt = new Date().toISOString();
              return CasesActions.transitionCaseSuccess({ case: updatedCase });
            }
            return CasesActions.transitionCaseSuccess({ case: caseData! });
          }),
          catchError((error) =>
            of(CasesActions.transitionCaseFailure({ error: error.message }))
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
