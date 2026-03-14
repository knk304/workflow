// state/tasks/tasks.reducer.ts
import { createReducer, on } from '@ngrx/store';
import { Task, KanbanBoard } from '../../core/models';
import * as TasksActions from './tasks.actions';

export const tasksFeatureKey = 'tasks';

export interface TasksState {
  list: Task[];
  selected: Task | null;
  kanbanBoard: KanbanBoard | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: TasksState = {
  list: [],
  selected: null,
  kanbanBoard: null,
  isLoading: false,
  error: null,
};

export const tasksReducer = createReducer(
  initialState,
  on(TasksActions.loadTasks, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(TasksActions.loadTasksSuccess, (state, { tasks }) => ({
    ...state,
    list: tasks,
    isLoading: false,
  })),
  on(TasksActions.loadTasksFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),
  on(TasksActions.loadKanbanBoardSuccess, (state, { board }) => ({
    ...state,
    kanbanBoard: board,
  })),
  on(TasksActions.loadTaskByIdSuccess, (state, { task }) => ({
    ...state,
    selected: task,
  })),
  on(TasksActions.selectTask, (state, { taskId }) => ({
    ...state,
    selected: state.list.find((t) => t.id === taskId) || null,
  })),
  on(TasksActions.updateTaskSuccess, (state, { task: updatedTask }) => ({
    ...state,
    list: state.list.map((t) => (t.id === updatedTask.id ? updatedTask : t)),
    selected: state.selected?.id === updatedTask.id ? updatedTask : state.selected,
    kanbanBoard: state.kanbanBoard
      ? {
          pending: state.kanbanBoard.pending.map((t) =>
            t.id === updatedTask.id ? updatedTask : t
          ),
          inProgress: state.kanbanBoard.inProgress.map((t) =>
            t.id === updatedTask.id ? updatedTask : t
          ),
          review: state.kanbanBoard.review.map((t) =>
            t.id === updatedTask.id ? updatedTask : t
          ),
          done: state.kanbanBoard.done.map((t) =>
            t.id === updatedTask.id ? updatedTask : t
          ),
          blocked: state.kanbanBoard.blocked.map((t) =>
            t.id === updatedTask.id ? updatedTask : t
          ),
        }
      : null,
  })),
  on(TasksActions.updateTaskFailure, (state, { error }) => ({
    ...state,
    error,
  })),
  on(TasksActions.clearError, (state) => ({
    ...state,
    error: null,
  }))
);
