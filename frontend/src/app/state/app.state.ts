// state/app.state.ts
import { AuthState, authFeatureKey, authReducer } from './auth/auth.reducer';
import { CasesState, casesFeatureKey, casesReducer } from './cases/cases.reducer';
import {
  NotificationsState,
  notificationsFeatureKey,
  notificationsReducer,
} from './notifications/notifications.reducer';
import {
  CommentsState,
  commentsFeatureKey,
  commentsReducer,
} from './comments/comments.reducer';
import {
  WorkflowsState,
  workflowsFeatureKey,
  workflowsReducer,
} from './workflows/workflows.reducer';
import {
  ApprovalsState,
  approvalsFeatureKey,
  approvalsReducer,
} from './approvals/approvals.reducer';
import {
  DocumentsState,
  documentsFeatureKey,
  documentsReducer,
} from './documents/documents.reducer';
import {
  AssignmentsState,
  assignmentsFeatureKey,
  assignmentsReducer,
} from './assignments/assignments.reducer';
import {
  CaseTypesState,
  caseTypesFeatureKey,
  caseTypesReducer,
} from './case-types/case-types.reducer';
import {
  DecisionTablesState,
  decisionTablesFeatureKey,
  decisionTablesReducer,
} from './decision-tables/decision-tables.reducer';

export interface AppState {
  [authFeatureKey]: AuthState;
  [casesFeatureKey]: CasesState;
  [notificationsFeatureKey]: NotificationsState;
  [commentsFeatureKey]: CommentsState;
  [workflowsFeatureKey]: WorkflowsState;
  [approvalsFeatureKey]: ApprovalsState;
  [documentsFeatureKey]: DocumentsState;
  [assignmentsFeatureKey]: AssignmentsState;
  [caseTypesFeatureKey]: CaseTypesState;
  [decisionTablesFeatureKey]: DecisionTablesState;
}

export const appReducers = {
  [authFeatureKey]: authReducer,
  [casesFeatureKey]: casesReducer,
  [notificationsFeatureKey]: notificationsReducer,
  [commentsFeatureKey]: commentsReducer,
  [workflowsFeatureKey]: workflowsReducer,
  [approvalsFeatureKey]: approvalsReducer,
  [documentsFeatureKey]: documentsReducer,
  [assignmentsFeatureKey]: assignmentsReducer,
  [caseTypesFeatureKey]: caseTypesReducer,
  [decisionTablesFeatureKey]: decisionTablesReducer,
};
