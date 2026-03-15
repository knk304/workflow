// state/tasks/tasks.actions.ts
import { createAction, props } from '@ngrx/store';
import { Task, KanbanBoard } from '../../core/models';

export const loadTasks = createAction('[Tasks] Load', props<{ filters?: any }>());

export const loadTasksSuccess = createAction('[Tasks] Load Success', props<{ tasks: Task[] }>());

export const loadTasksFailure = createAction('[Tasks] Load Failure', props<{ error: string }>());

export const loadKanbanBoard = createAction(
  '[Tasks] Load Kanban Board',
  props<{ caseId?: string }>()
);

export const loadKanbanBoardSuccess = createAction(
  '[Tasks] Load Kanban Board Success',
  props<{ board: KanbanBoard }>()
);

export const loadTaskById = createAction('[Tasks] Load By Id', props<{ id: string }>());

export const loadTaskByIdSuccess = createAction(
  '[Tasks] Load By Id Success',
  props<{ task: Task }>()
);

export const selectTask = createAction('[Tasks] Select', props<{ taskId: string }>());

export const updateTask = createAction(
  '[Tasks] Update',
  props<{ taskId: string; updates: Partial<Task> }>()
);

export const updateTaskSuccess = createAction('[Tasks] Update Success', props<{ task: Task }>());

export const updateTaskFailure = createAction('[Tasks] Update Failure', props<{ error: string }>());

export const updateTaskStatus = createAction(
  '[Tasks] Update Status',
  props<{ taskId: string; status: string }>()
);

export const updateTaskAssignee = createAction(
  '[Tasks] Update Assignee',
  props<{ taskId: string; assigneeId?: string }>()
);

export const createTask = createAction('[Tasks] Create', props<{ task: Partial<Task> }>());

export const createTaskSuccess = createAction('[Tasks] Create Success', props<{ task: Task }>());

export const createTaskFailure = createAction('[Tasks] Create Failure', props<{ error: string }>());

export const clearError = createAction('[Tasks] Clear Error');
