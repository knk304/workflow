// state/notifications/notifications.effects.ts
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap, mergeMap } from 'rxjs/operators';
import { MockDataService } from '../../core/services/mock-data.service';
import * as NotificationsActions from './notifications.actions';

@Injectable()
export class NotificationsEffects {
  loadNotifications$ = createEffect(() =>
    this.actions$.pipe(
      ofType(NotificationsActions.loadNotifications),
      switchMap(({ userId }) =>
        this.mockDataService.getNotifications(userId).pipe(
          map((notifications) =>
            NotificationsActions.loadNotificationsSuccess({ notifications })
          ),
          catchError((error) =>
            of(
              NotificationsActions.loadNotificationsFailure({
                error: error.message,
              })
            )
          )
        )
      )
    )
  );

  addNotification$ = createEffect(() =>
    this.actions$.pipe(
      ofType(NotificationsActions.addNotification),
      mergeMap(({ notification }) =>
        this.mockDataService.addNotification(notification).pipe(
          map((newNotification) =>
            NotificationsActions.addNotificationSuccess({
              notification: newNotification,
            })
          ),
          catchError((error) =>
            of(
              NotificationsActions.loadNotificationsFailure({
                error: error.message,
              })
            )
          )
        )
      )
    )
  );

  markAsRead$ = createEffect(() =>
    this.actions$.pipe(
      ofType(NotificationsActions.markAsRead),
      mergeMap(({ notificationId }) =>
        this.mockDataService.markNotificationAsRead(notificationId).pipe(
          map((notification) =>
            NotificationsActions.markAsReadSuccess({ notification })
          ),
          catchError((error) =>
            of(
              NotificationsActions.loadNotificationsFailure({
                error: error.message,
              })
            )
          )
        )
      )
    )
  );

  constructor(
    private actions$: Actions,
    private mockDataService: MockDataService
  ) {}
}
