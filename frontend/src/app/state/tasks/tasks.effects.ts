// state/tasks/tasks.effects.ts
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap, mergeMap } from 'rxjs/operators';
import { DataService } from '../../core/services/data.service';
import * as TasksActions from './tasks.actions';

@Injectable()
export class TasksEffects {
  loadTasks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TasksActions.loadTasks),
      switchMap(({ filters }) =>
        this.dataService.getTasks(filters).pipe(
          map((tasks) => TasksActions.loadTasksSuccess({ tasks })),
          catchError((error) => of(TasksActions.loadTasksFailure({ error: error.message })))
        )
      )
    )
  );

  loadKanbanBoard$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TasksActions.loadKanbanBoard),
      switchMap(({ caseId }) =>
        this.dataService.getKanbanBoard(caseId).pipe(
          map((board) => TasksActions.loadKanbanBoardSuccess({ board })),
          catchError((error) => of(TasksActions.loadTasksFailure({ error: error.message })))
        )
      )
    )
  );

  loadTaskById$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TasksActions.loadTaskById),
      switchMap(({ id }) =>
        this.dataService.getTaskById(id).pipe(
          map((task) => {
            if (task) {
              return TasksActions.loadTaskByIdSuccess({ task });
            } else {
              return TasksActions.loadTasksFailure({ error: 'Task not found' });
            }
          }),
          catchError((error) => of(TasksActions.loadTasksFailure({ error: error.message })))
        )
      )
    )
  );

  updateTask$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TasksActions.updateTask),
      mergeMap(({ taskId, updates }) =>
        this.dataService.updateTask(taskId, updates).pipe(
          map((task) => TasksActions.updateTaskSuccess({ task })),
          catchError((error) => of(TasksActions.updateTaskFailure({ error: error.message })))
        )
      )
    )
  );

  updateTaskStatus$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TasksActions.updateTaskStatus),
      mergeMap(({ taskId, status }) => {
        // Ensure status is a valid Task.status value
        const validStatus = status as any;
        return this.dataService.updateTask(taskId, { status: validStatus }).pipe(
          map((task) => TasksActions.updateTaskSuccess({ task })),
          catchError((error) => of(TasksActions.updateTaskFailure({ error: error.message })))
        );
      })
    )
  );

  updateTaskAssignee$ = createEffect(() =>
    this.actions$.pipe(
      ofType(TasksActions.updateTaskAssignee),
      mergeMap(({ taskId, assigneeId }) =>
        this.dataService.updateTask(taskId, { assigneeId }).pipe(
          map((task) => TasksActions.updateTaskSuccess({ task })),
          catchError((error) => of(TasksActions.updateTaskFailure({ error: error.message })))
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private dataService: DataService
  ) {}
}
