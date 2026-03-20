import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, exhaustMap, catchError } from 'rxjs/operators';
import { DataService } from '@core/services/data.service';
import * as DTActions from './decision-tables.actions';

@Injectable()
export class DecisionTablesEffects {
  constructor(private actions$: Actions, private dataService: DataService) {}

  loadAll$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DTActions.loadDecisionTables),
      exhaustMap(() =>
        this.dataService.getDecisionTables().pipe(
          map(tables => DTActions.loadDecisionTablesSuccess({ tables })),
          catchError(err => of(DTActions.loadDecisionTablesFailure({ error: err.message || 'Failed to load decision tables' })))
        )
      )
    )
  );

  loadOne$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DTActions.loadDecisionTable),
      exhaustMap(({ id }) =>
        this.dataService.getDecisionTableById(id).pipe(
          map(table => DTActions.loadDecisionTableSuccess({ table })),
          catchError(err => of(DTActions.loadDecisionTableFailure({ error: err.message || 'Failed to load decision table' })))
        )
      )
    )
  );

  create$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DTActions.createDecisionTable),
      exhaustMap(({ request }) =>
        this.dataService.createDecisionTable(request).pipe(
          map(table => DTActions.createDecisionTableSuccess({ table })),
          catchError(err => of(DTActions.createDecisionTableFailure({ error: err.message || 'Failed to create decision table' })))
        )
      )
    )
  );

  update$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DTActions.updateDecisionTable),
      exhaustMap(({ id, request }) =>
        this.dataService.updateDecisionTable(id, request).pipe(
          map(table => DTActions.updateDecisionTableSuccess({ table })),
          catchError(err => of(DTActions.updateDecisionTableFailure({ error: err.message || 'Failed to update decision table' })))
        )
      )
    )
  );

  delete$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DTActions.deleteDecisionTable),
      exhaustMap(({ id }) =>
        this.dataService.deleteDecisionTable(id).pipe(
          map(() => DTActions.deleteDecisionTableSuccess({ id })),
          catchError(err => of(DTActions.deleteDecisionTableFailure({ error: err.message || 'Failed to delete decision table' })))
        )
      )
    )
  );

  evaluate$ = createEffect(() =>
    this.actions$.pipe(
      ofType(DTActions.evaluateDecisionTable),
      exhaustMap(({ id, request }) =>
        this.dataService.evaluateDecisionTable(id, request).pipe(
          map(result => DTActions.evaluateDecisionTableSuccess({ result })),
          catchError(err => of(DTActions.evaluateDecisionTableFailure({ error: err.message || 'Evaluation failed' })))
        )
      )
    )
  );
}
