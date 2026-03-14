// state/tasks/tasks.selectors.ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { TasksState, tasksFeatureKey } from './tasks.reducer';

export const selectTasksState = createFeatureSelector<TasksState>(tasksFeatureKey);

export const selectTasksList = createSelector(selectTasksState, (state) => state.list);

export const selectSelectedTask = createSelector(selectTasksState, (state) => state.selected);

export const selectKanbanBoard = createSelector(selectTasksState, (state) => state.kanbanBoard);

export const selectTasksLoading = createSelector(selectTasksState, (state) => state.isLoading);

export const selectTasksError = createSelector(selectTasksState, (state) => state.error);

export const selectTaskById = (taskId: string) =>
  createSelector(selectTasksList, (tasks) => tasks.find((t) => t.id === taskId));

export const selectTasksByStatus = (status: string) =>
  createSelector(selectTasksList, (tasks) => tasks.filter((t) => t.status === status));

export const selectMyTasks = (userId: string) =>
  createSelector(selectTasksList, (tasks) =>
    tasks.filter((t) => t.assigneeId === userId && t.status !== 'completed')
  );

export const selectPendingTasks = createSelector(
  selectTasksList,
  (tasks) => tasks.filter((t) => t.status === 'pending')
);

export const selectInProgressTasks = createSelector(
  selectTasksList,
  (tasks) => tasks.filter((t) => t.status === 'in_progress')
);

export const selectOverdueTasks = createSelector(selectTasksList, (tasks) => {
  const now = new Date();
  return tasks.filter(
    (t) => t.dueDate && t.dueDate < now && t.status !== 'completed' && t.status !== 'cancelled'
  );
});
