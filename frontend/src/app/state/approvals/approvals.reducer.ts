import { createReducer, on } from '@ngrx/store';
import { ApprovalChain } from '../../core/models';
import * as ApprovalsActions from './approvals.actions';

export const approvalsFeatureKey = 'approvals';

export interface ApprovalsState {
  list: ApprovalChain[];
  isLoading: boolean;
  error: string | null;
}

const initialState: ApprovalsState = {
  list: [],
  isLoading: false,
  error: null,
};

export const approvalsReducer = createReducer(
  initialState,
  on(ApprovalsActions.loadApprovals, (state) => ({ ...state, isLoading: true, error: null })),
  on(ApprovalsActions.loadApprovalsSuccess, (state, { approvals }) => ({ ...state, list: approvals, isLoading: false })),
  on(ApprovalsActions.loadApprovalsFailure, (state, { error }) => ({ ...state, isLoading: false, error })),

  on(ApprovalsActions.createApprovalSuccess, (state, { approval }) => ({
    ...state, list: [...state.list, approval],
  })),

  on(ApprovalsActions.approveChainSuccess, ApprovalsActions.rejectChainSuccess, ApprovalsActions.delegateApprovalSuccess,
    (state, { approval }) => ({
      ...state, list: state.list.map(a => a.id === approval.id ? approval : a),
    })
  ),

  on(
    ApprovalsActions.createApprovalFailure,
    ApprovalsActions.approveChainFailure,
    ApprovalsActions.rejectChainFailure,
    ApprovalsActions.delegateApprovalFailure,
    (state, { error }) => ({ ...state, isLoading: false, error })
  ),

  on(ApprovalsActions.clearError, (state) => ({ ...state, error: null })),
);
