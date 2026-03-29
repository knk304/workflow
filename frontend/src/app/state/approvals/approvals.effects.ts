import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { of } from 'rxjs';
import { map, catchError, switchMap, mergeMap } from 'rxjs/operators';
import { DataService } from '../../core/services/data.service';
import * as ApprovalsActions from './approvals.actions';
import * as CasesActions from '../cases/cases.actions';

@Injectable()
export class ApprovalsEffects {
  loadApprovals$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApprovalsActions.loadApprovals),
      switchMap(({ caseId }) =>
        this.dataService.getApprovals(caseId).pipe(
          map(approvals => ApprovalsActions.loadApprovalsSuccess({ approvals })),
          catchError(error => of(ApprovalsActions.loadApprovalsFailure({ error: error.message })))
        )
      )
    )
  );

  createApproval$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApprovalsActions.createApproval),
      mergeMap(({ approval }) =>
        this.dataService.createApproval(approval).pipe(
          map(created => ApprovalsActions.createApprovalSuccess({ approval: created })),
          catchError(error => of(ApprovalsActions.createApprovalFailure({ error: error.message })))
        )
      )
    )
  );

  approveChain$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApprovalsActions.approveChain),
      mergeMap(({ id, decision }) =>
        this.dataService.approveChain(id, decision).pipe(
          mergeMap(approval => {
            const actions: any[] = [ApprovalsActions.approveChainSuccess({ approval })];
            if (approval.status === 'approved' || approval.status === 'rejected') {
              actions.push(CasesActions.loadCaseInstance({ id: approval.caseId }));
            }
            return actions;
          }),
          catchError(error => of(ApprovalsActions.approveChainFailure({ error: error.message })))
        )
      )
    )
  );

  rejectChain$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApprovalsActions.rejectChain),
      mergeMap(({ id, decision }) =>
        this.dataService.rejectChain(id, decision).pipe(
          mergeMap(approval => {
            const actions: any[] = [ApprovalsActions.rejectChainSuccess({ approval })];
            actions.push(CasesActions.loadCaseInstance({ id: approval.caseId }));
            return actions;
          }),
          catchError(error => of(ApprovalsActions.rejectChainFailure({ error: error.message })))
        )
      )
    )
  );

  delegateApproval$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApprovalsActions.delegateApproval),
      mergeMap(({ id, delegation }) =>
        this.dataService.delegateApproval(id, delegation).pipe(
          map(approval => ApprovalsActions.delegateApprovalSuccess({ approval })),
          catchError(error => of(ApprovalsActions.delegateApprovalFailure({ error: error.message })))
        )
      )
    )
  );

  claimApproval$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ApprovalsActions.claimApproval),
      mergeMap(({ id }) =>
        this.dataService.claimApproval(id).pipe(
          map(approval => ApprovalsActions.claimApprovalSuccess({ approval })),
          catchError(error => of(ApprovalsActions.claimApprovalFailure({ error: error.message })))
        )
      )
    )
  );

  constructor(private actions$: Actions, private dataService: DataService) {}
}
