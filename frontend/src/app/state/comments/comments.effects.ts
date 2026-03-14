// state/comments/comments.effects.ts
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap, mergeMap } from 'rxjs/operators';
import { DataService } from '../../core/services/data.service';
import * as CommentsActions from './comments.actions';

@Injectable()
export class CommentsEffects {
  loadComments$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CommentsActions.loadComments),
      switchMap(({ caseId, taskId }) =>
        this.dataService.getComments(caseId, taskId).pipe(
          map((comments) => CommentsActions.loadCommentsSuccess({ comments })),
          catchError((error) =>
            of(CommentsActions.loadCommentsFailure({ error: error.message }))
          )
        )
      )
    )
  );

  addComment$ = createEffect(() =>
    this.actions$.pipe(
      ofType(CommentsActions.addComment),
      mergeMap(({ comment }) =>
        this.dataService.addComment(comment).pipe(
          map((newComment) => CommentsActions.addCommentSuccess({ comment: newComment })),
          catchError((error) =>
            of(CommentsActions.addCommentFailure({ error: error.message }))
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
