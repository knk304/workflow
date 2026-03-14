import { createFeatureSelector, createSelector } from '@ngrx/store';
import { ApprovalsState, approvalsFeatureKey } from './approvals.reducer';

export const selectApprovalsState = createFeatureSelector<ApprovalsState>(approvalsFeatureKey);

export const selectApprovalsList = createSelector(selectApprovalsState, state => state.list);
export const selectApprovalsLoading = createSelector(selectApprovalsState, state => state.isLoading);
export const selectApprovalsError = createSelector(selectApprovalsState, state => state.error);

export const selectApprovalsByCaseId = (caseId: string) =>
  createSelector(selectApprovalsList, approvals => approvals.filter(a => a.caseId === caseId));

export const selectPendingApprovals = createSelector(
  selectApprovalsList,
  approvals => approvals.filter(a => a.status === 'pending')
);
