import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, exhaustMap, catchError } from 'rxjs/operators';
import { DataService } from '@core/services/data.service';
import * as CaseTypesActions from './case-types.actions';

@Injectable()
export class CaseTypesEffects {
  constructor(private actions$: Actions, private dataService: DataService) {}

  loadAll$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CaseTypesActions.loadCaseTypeDefinitions),
      exhaustMap(() =>
        this.dataService.getCaseTypeDefinitions().pipe(
          map(definitions => CaseTypesActions.loadCaseTypeDefinitionsSuccess({ definitions })),
          catchError(err => of(CaseTypesActions.loadCaseTypeDefinitionsFailure({ error: err.message || 'Failed to load case types' })))
        )
      )
    )
  );

  loadOne$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CaseTypesActions.loadCaseTypeDefinition),
      exhaustMap(({ id }) =>
        this.dataService.getCaseTypeDefinitionById(id).pipe(
          map(definition => CaseTypesActions.loadCaseTypeDefinitionSuccess({ definition })),
          catchError(err => of(CaseTypesActions.loadCaseTypeDefinitionFailure({ error: err.message || 'Failed to load case type' })))
        )
      )
    )
  );

  create$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CaseTypesActions.createCaseTypeDefinition),
      exhaustMap(({ request }) =>
        this.dataService.createCaseTypeDefinition(request).pipe(
          map(definition => CaseTypesActions.createCaseTypeDefinitionSuccess({ definition })),
          catchError(err => of(CaseTypesActions.createCaseTypeDefinitionFailure({ error: err.message || 'Failed to create case type' })))
        )
      )
    )
  );

  update$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CaseTypesActions.updateCaseTypeDefinition),
      exhaustMap(({ id, request }) =>
        this.dataService.updateCaseTypeDefinition(id, request).pipe(
          map(definition => CaseTypesActions.updateCaseTypeDefinitionSuccess({ definition })),
          catchError(err => of(CaseTypesActions.updateCaseTypeDefinitionFailure({ error: err.message || 'Failed to update case type' })))
        )
      )
    )
  );

  delete$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CaseTypesActions.deleteCaseTypeDefinition),
      exhaustMap(({ id }) =>
        this.dataService.deleteCaseTypeDefinition(id).pipe(
          map(() => CaseTypesActions.deleteCaseTypeDefinitionSuccess({ id })),
          catchError(err => of(CaseTypesActions.deleteCaseTypeDefinitionFailure({ error: err.message || 'Failed to delete case type' })))
        )
      )
    )
  );

  duplicate$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CaseTypesActions.duplicateCaseTypeDefinition),
      exhaustMap(({ id }) =>
        this.dataService.duplicateCaseTypeDefinition(id).pipe(
          map(definition => CaseTypesActions.duplicateCaseTypeDefinitionSuccess({ definition })),
          catchError(err => of(CaseTypesActions.duplicateCaseTypeDefinitionFailure({ error: err.message || 'Failed to duplicate case type' })))
        )
      )
    )
  );

  validate$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CaseTypesActions.validateCaseTypeDefinition),
      exhaustMap(({ id }) =>
        this.dataService.validateCaseTypeDefinition(id).pipe(
          map(result => CaseTypesActions.validateCaseTypeDefinitionSuccess(result)),
          catchError(err => of(CaseTypesActions.validateCaseTypeDefinitionFailure({ error: err.message || 'Validation failed' })))
        )
      )
    )
  );
}
