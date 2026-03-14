// state/comments/comments.selectors.ts
import { createFeatureSelector, createSelector } from '@ngrx/store';
import { CommentsState, commentsFeatureKey } from './comments.reducer';

export const selectCommentsState = createFeatureSelector<CommentsState>(commentsFeatureKey);

export const selectComments = createSelector(selectCommentsState, (state) => state.items);

export const selectCommentsLoading = createSelector(selectCommentsState, (state) => state.isLoading);

export const selectCommentsError = createSelector(selectCommentsState, (state) => state.error);

export const selectCommentsByCase = (caseId: string) =>
  createSelector(selectComments, (comments) => comments.filter((c) => c.caseId === caseId));

export const selectCommentsByTask = (taskId: string) =>
  createSelector(selectComments, (comments) => comments.filter((c) => c.taskId === taskId));
