// state/assignments/assignments.actions.ts
import { createAction, props } from '@ngrx/store';
import { Assignment, AssignmentCompleteRequest, AssignmentReassignRequest } from '../../core/models';

export const loadAssignments = createAction(
  '[Assignments] Load',
  props<{ filters?: Record<string, string> }>()
);
export const loadAssignmentsSuccess = createAction(
  '[Assignments] Load Success',
  props<{ assignments: Assignment[] }>()
);
export const loadAssignmentsFailure = createAction(
  '[Assignments] Load Failure',
  props<{ error: string }>()
);

export const loadMyAssignments = createAction('[Assignments] Load My');
export const loadMyAssignmentsSuccess = createAction(
  '[Assignments] Load My Success',
  props<{ assignments: Assignment[] }>()
);
export const loadMyAssignmentsFailure = createAction(
  '[Assignments] Load My Failure',
  props<{ error: string }>()
);

export const loadAssignment = createAction(
  '[Assignments] Load One',
  props<{ id: string }>()
);
export const loadAssignmentSuccess = createAction(
  '[Assignments] Load One Success',
  props<{ assignment: Assignment }>()
);
export const loadAssignmentFailure = createAction(
  '[Assignments] Load One Failure',
  props<{ error: string }>()
);

export const completeAssignment = createAction(
  '[Assignments] Complete',
  props<{ id: string; request: AssignmentCompleteRequest }>()
);
export const completeAssignmentSuccess = createAction(
  '[Assignments] Complete Success',
  props<{ assignment: Assignment }>()
);
export const completeAssignmentFailure = createAction(
  '[Assignments] Complete Failure',
  props<{ error: string }>()
);

export const reassignAssignment = createAction(
  '[Assignments] Reassign',
  props<{ id: string; request: AssignmentReassignRequest }>()
);
export const reassignAssignmentSuccess = createAction(
  '[Assignments] Reassign Success',
  props<{ assignment: Assignment }>()
);
export const reassignAssignmentFailure = createAction(
  '[Assignments] Reassign Failure',
  props<{ error: string }>()
);

export const holdAssignment = createAction(
  '[Assignments] Hold',
  props<{ id: string }>()
);
export const holdAssignmentSuccess = createAction(
  '[Assignments] Hold Success',
  props<{ assignment: Assignment }>()
);
export const holdAssignmentFailure = createAction(
  '[Assignments] Hold Failure',
  props<{ error: string }>()
);

export const resumeAssignment = createAction(
  '[Assignments] Resume',
  props<{ id: string }>()
);
export const resumeAssignmentSuccess = createAction(
  '[Assignments] Resume Success',
  props<{ assignment: Assignment }>()
);
export const resumeAssignmentFailure = createAction(
  '[Assignments] Resume Failure',
  props<{ error: string }>()
);

export const selectAssignment = createAction(
  '[Assignments] Select',
  props<{ id: string }>()
);

export const clearAssignmentsError = createAction('[Assignments] Clear Error');
