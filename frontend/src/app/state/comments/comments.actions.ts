// state/comments/comments.actions.ts
import { createAction, props } from '@ngrx/store';
import { Comment } from '../../core/models';

export const loadComments = createAction(
  '[Comments] Load',
  props<{ caseId?: string; taskId?: string }>()
);

export const loadCommentsSuccess = createAction(
  '[Comments] Load Success',
  props<{ comments: Comment[] }>()
);

export const loadCommentsFailure = createAction(
  '[Comments] Load Failure',
  props<{ error: string }>()
);

export const addComment = createAction(
  '[Comments] Add',
  props<{ comment: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'> }>()
);

export const addCommentSuccess = createAction(
  '[Comments] Add Success',
  props<{ comment: Comment }>()
);

export const addCommentFailure = createAction(
  '[Comments] Add Failure',
  props<{ error: string }>()
);

export const clearError = createAction('[Comments] Clear Error');
