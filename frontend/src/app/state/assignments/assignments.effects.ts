// state/assignments/assignments.effects.ts
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap, mergeMap } from 'rxjs/operators';
import { DataService } from '../../core/services/data.service';
import * as AssignmentsActions from './assignments.actions';

@Injectable()
export class AssignmentsEffects {
  loadAssignments$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AssignmentsActions.loadAssignments),
      switchMap(({ filters }) =>
        this.dataService.getAssignments(filters).pipe(
          map((assignments) => AssignmentsActions.loadAssignmentsSuccess({ assignments })),
          catchError((error) =>
            of(AssignmentsActions.loadAssignmentsFailure({ error: error.message }))
          )
        )
      )
    )
  );

  loadMyAssignments$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AssignmentsActions.loadMyAssignments),
      switchMap(() =>
        this.dataService.getMyAssignments().pipe(
          map((assignments) => AssignmentsActions.loadMyAssignmentsSuccess({ assignments })),
          catchError((error) =>
            of(AssignmentsActions.loadMyAssignmentsFailure({ error: error.message }))
          )
        )
      )
    )
  );

  loadAssignment$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AssignmentsActions.loadAssignment),
      switchMap(({ id }) =>
        this.dataService.getAssignmentById(id).pipe(
          map((assignment) => AssignmentsActions.loadAssignmentSuccess({ assignment })),
          catchError((error) =>
            of(AssignmentsActions.loadAssignmentFailure({ error: error.message }))
          )
        )
      )
    )
  );

  completeAssignment$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AssignmentsActions.completeAssignment),
      mergeMap(({ id, request }) =>
        this.dataService.completeAssignment(id, request).pipe(
          map((assignment) => AssignmentsActions.completeAssignmentSuccess({ assignment })),
          catchError((error) =>
            of(AssignmentsActions.completeAssignmentFailure({ error: error.message }))
          )
        )
      )
    )
  );

  reassignAssignment$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AssignmentsActions.reassignAssignment),
      mergeMap(({ id, request }) =>
        this.dataService.reassignAssignment(id, request).pipe(
          map((assignment) => AssignmentsActions.reassignAssignmentSuccess({ assignment })),
          catchError((error) =>
            of(AssignmentsActions.reassignAssignmentFailure({ error: error.message }))
          )
        )
      )
    )
  );

  holdAssignment$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AssignmentsActions.holdAssignment),
      mergeMap(({ id }) =>
        this.dataService.holdAssignment(id).pipe(
          map((assignment) => AssignmentsActions.holdAssignmentSuccess({ assignment })),
          catchError((error) =>
            of(AssignmentsActions.holdAssignmentFailure({ error: error.message }))
          )
        )
      )
    )
  );

  resumeAssignment$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AssignmentsActions.resumeAssignment),
      mergeMap(({ id }) =>
        this.dataService.resumeAssignment(id).pipe(
          map((assignment) => AssignmentsActions.resumeAssignmentSuccess({ assignment })),
          catchError((error) =>
            of(AssignmentsActions.resumeAssignmentFailure({ error: error.message }))
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
