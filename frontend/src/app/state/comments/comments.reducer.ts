// state/comments/comments.reducer.ts
import { createReducer, on } from '@ngrx/store';
import { Comment } from '../../core/models';
import * as CommentsActions from './comments.actions';

export const commentsFeatureKey = 'comments';

export interface CommentsState {
  items: Comment[];
  isLoading: boolean;
  error: string | null;
}

const initialState: CommentsState = {
  items: [],
  isLoading: false,
  error: null,
};

export const commentsReducer = createReducer(
  initialState,
  on(CommentsActions.loadComments, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(CommentsActions.loadCommentsSuccess, (state, { comments }) => ({
    ...state,
    items: comments,
    isLoading: false,
  })),
  on(CommentsActions.loadCommentsFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),
  on(CommentsActions.addCommentSuccess, (state, { comment }) => ({
    ...state,
    items: [...state.items, comment],
  })),
  on(CommentsActions.addCommentFailure, (state, { error }) => ({
    ...state,
    error,
  })),
  on(CommentsActions.clearError, (state) => ({
    ...state,
    error: null,
  }))
);
