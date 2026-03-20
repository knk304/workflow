// state/cases/cases.effects.ts
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap, mergeMap } from 'rxjs/operators';
import { DataService } from '../../core/services/data.service';
import * as CasesActions from './cases.actions';

@Injectable()
export class CasesEffects {

  // ── Legacy Case effects ─────────────────────────────────

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

  // ── Case Type Definitions effects ───────────────────────

  loadCaseTypeDefinitions$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.loadCaseTypeDefinitions),
      switchMap(() =>
        this.dataService.getCaseTypeDefinitions().pipe(
          map((definitions) => CasesActions.loadCaseTypeDefinitionsSuccess({ definitions })),
          catchError((error) =>
            of(CasesActions.loadCaseTypeDefinitionsFailure({ error: error.message }))
          )
        )
      )
    )
  );

  loadCaseTypeDefinitionById$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.loadCaseTypeDefinitionById),
      switchMap(({ id }) =>
        this.dataService.getCaseTypeDefinitionById(id).pipe(
          map((definition) => CasesActions.loadCaseTypeDefinitionByIdSuccess({ definition })),
          catchError((error) =>
            of(CasesActions.loadCaseTypeDefinitionByIdFailure({ error: error.message }))
          )
        )
      )
    )
  );

  // ── Case Instance effects ──────────────────────────────

  loadCaseInstances$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.loadCaseInstances),
      switchMap(({ filters }) =>
        this.dataService.getCaseInstances(filters).pipe(
          map((instances) => CasesActions.loadCaseInstancesSuccess({ instances })),
          catchError((error) =>
            of(CasesActions.loadCaseInstancesFailure({ error: error.message }))
          )
        )
      )
    )
  );

  loadCaseInstance$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.loadCaseInstance),
      switchMap(({ id }) =>
        this.dataService.getCaseInstanceById(id).pipe(
          map((instance) => CasesActions.loadCaseInstanceSuccess({ instance })),
          catchError((error) =>
            of(CasesActions.loadCaseInstanceFailure({ error: error.message }))
          )
        )
      )
    )
  );

  createCaseInstance$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.createCaseInstance),
      mergeMap(({ request }) =>
        this.dataService.createCaseInstance(request).pipe(
          map((instance) => CasesActions.createCaseInstanceSuccess({ instance })),
          catchError((error) =>
            of(CasesActions.createCaseInstanceFailure({ error: error.message }))
          )
        )
      )
    )
  );

  updateCaseInstance$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.updateCaseInstance),
      mergeMap(({ id, request }) =>
        this.dataService.updateCaseInstance(id, request).pipe(
          map((instance) => CasesActions.updateCaseInstanceSuccess({ instance })),
          catchError((error) =>
            of(CasesActions.updateCaseInstanceFailure({ error: error.message }))
          )
        )
      )
    )
  );

  completeStep$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.completeStep),
      mergeMap(({ caseId, stepId, request }) =>
        this.dataService.completeStep(caseId, stepId, request).pipe(
          map((instance) => CasesActions.completeStepSuccess({ instance })),
          catchError((error) =>
            of(CasesActions.completeStepFailure({ error: error.message }))
          )
        )
      )
    )
  );

  advanceStage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.advanceStage),
      mergeMap(({ caseId, request }) =>
        this.dataService.advanceStage(caseId, request).pipe(
          map((instance) => CasesActions.advanceStageSuccess({ instance })),
          catchError((error) =>
            of(CasesActions.advanceStageFailure({ error: error.message }))
          )
        )
      )
    )
  );

  changeStage$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.changeStage),
      mergeMap(({ caseId, request }) =>
        this.dataService.changeStage(caseId, request).pipe(
          map((instance) => CasesActions.changeStageSuccess({ instance })),
          catchError((error) =>
            of(CasesActions.changeStageFailure({ error: error.message }))
          )
        )
      )
    )
  );

  resolveCaseInstance$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.resolveCaseInstance),
      mergeMap(({ caseId }) =>
        this.dataService.resolveCase(caseId).pipe(
          map((instance) => CasesActions.resolveCaseInstanceSuccess({ instance })),
          catchError((error) =>
            of(CasesActions.resolveCaseInstanceFailure({ error: error.message }))
          )
        )
      )
    )
  );

  withdrawCaseInstance$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CasesActions.withdrawCaseInstance),
      mergeMap(({ caseId }) =>
        this.dataService.withdrawCase(caseId).pipe(
          map((instance) => CasesActions.withdrawCaseInstanceSuccess({ instance })),
          catchError((error) =>
            of(CasesActions.withdrawCaseInstanceFailure({ error: error.message }))
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
