import { createAction, props } from '@ngrx/store';
import { ApprovalChain, ApprovalDecision, ApprovalDelegation } from '../../core/models';

export const loadApprovals = createAction('[Approvals] Load', props<{ caseId?: string }>());
export const loadApprovalsSuccess = createAction('[Approvals] Load Success', props<{ approvals: ApprovalChain[] }>());
export const loadApprovalsFailure = createAction('[Approvals] Load Failure', props<{ error: string }>());

export const createApproval = createAction('[Approvals] Create', props<{ approval: Partial<ApprovalChain> }>());
export const createApprovalSuccess = createAction('[Approvals] Create Success', props<{ approval: ApprovalChain }>());
export const createApprovalFailure = createAction('[Approvals] Create Failure', props<{ error: string }>());

export const approveChain = createAction('[Approvals] Approve', props<{ id: string; decision: ApprovalDecision }>());
export const approveChainSuccess = createAction('[Approvals] Approve Success', props<{ approval: ApprovalChain }>());
export const approveChainFailure = createAction('[Approvals] Approve Failure', props<{ error: string }>());

export const rejectChain = createAction('[Approvals] Reject', props<{ id: string; decision: ApprovalDecision }>());
export const rejectChainSuccess = createAction('[Approvals] Reject Success', props<{ approval: ApprovalChain }>());
export const rejectChainFailure = createAction('[Approvals] Reject Failure', props<{ error: string }>());

export const delegateApproval = createAction('[Approvals] Delegate', props<{ id: string; delegation: ApprovalDelegation }>());
export const delegateApprovalSuccess = createAction('[Approvals] Delegate Success', props<{ approval: ApprovalChain }>());
export const delegateApprovalFailure = createAction('[Approvals] Delegate Failure', props<{ error: string }>());

export const clearError = createAction('[Approvals] Clear Error');
