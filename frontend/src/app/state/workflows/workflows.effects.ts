import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap, mergeMap } from 'rxjs/operators';
import { DataService } from '../../core/services/data.service';
import * as WorkflowsActions from './workflows.actions';

@Injectable()
export class WorkflowsEffects {
  loadWorkflows$ = createEffect(() =>
    this.actions$.pipe(
      ofType(WorkflowsActions.loadWorkflows),
      switchMap(() =>
        this.dataService.getWorkflows().pipe(
          map(workflows => WorkflowsActions.loadWorkflowsSuccess({ workflows })),
          catchError(error => of(WorkflowsActions.loadWorkflowsFailure({ error: error.message })))
        )
      )
    )
  );

  loadWorkflowById$ = createEffect(() =>
    this.actions$.pipe(
      ofType(WorkflowsActions.loadWorkflowById),
      switchMap(({ id }) =>
        this.dataService.getWorkflowById(id).pipe(
          map(workflow => WorkflowsActions.loadWorkflowByIdSuccess({ workflow })),
          catchError(error => of(WorkflowsActions.loadWorkflowByIdFailure({ error: error.message })))
        )
      )
    )
  );

  createWorkflow$ = createEffect(() =>
    this.actions$.pipe(
      ofType(WorkflowsActions.createWorkflow),
      mergeMap(({ workflow }) =>
        this.dataService.createWorkflow(workflow).pipe(
          map(created => WorkflowsActions.createWorkflowSuccess({ workflow: created })),
          catchError(error => of(WorkflowsActions.createWorkflowFailure({ error: error.message })))
        )
      )
    )
  );

  updateWorkflow$ = createEffect(() =>
    this.actions$.pipe(
      ofType(WorkflowsActions.updateWorkflow),
      mergeMap(({ id, updates }) =>
        this.dataService.updateWorkflow(id, updates).pipe(
          map(workflow => WorkflowsActions.updateWorkflowSuccess({ workflow })),
          catchError(error => of(WorkflowsActions.updateWorkflowFailure({ error: error.message })))
        )
      )
    )
  );

  deleteWorkflow$ = createEffect(() =>
    this.actions$.pipe(
      ofType(WorkflowsActions.deleteWorkflow),
      mergeMap(({ id }) =>
        this.dataService.deleteWorkflow(id).pipe(
          map(() => WorkflowsActions.deleteWorkflowSuccess({ id })),
          catchError(error => of(WorkflowsActions.deleteWorkflowFailure({ error: error.message })))
        )
      )
    )
  );

  validateWorkflow$ = createEffect(() =>
    this.actions$.pipe(
      ofType(WorkflowsActions.validateWorkflow),
      switchMap(({ id }) =>
        this.dataService.validateWorkflow(id).pipe(
          map(result => WorkflowsActions.validateWorkflowSuccess({ result })),
          catchError(error => of(WorkflowsActions.validateWorkflowFailure({ error: error.message })))
        )
      )
    )
  );

  constructor(private actions$: Actions, private dataService: DataService) {}
}
