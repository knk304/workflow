// state/assignments/assignments.reducer.ts
import { createReducer, on } from '@ngrx/store';
import { Assignment } from '../../core/models';
import * as AssignmentsActions from './assignments.actions';

export const assignmentsFeatureKey = 'assignments';

export interface AssignmentsState {
  list: Assignment[];
  myAssignments: Assignment[];
  selected: Assignment | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: AssignmentsState = {
  list: [],
  myAssignments: [],
  selected: null,
  isLoading: false,
  error: null,
};

const updateAssignment = (list: Assignment[], updated: Assignment): Assignment[] =>
  list.map((a) => (a.id === updated.id ? updated : a));

export const assignmentsReducer = createReducer(
  initialState,

  // Load all
  on(AssignmentsActions.loadAssignments, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(AssignmentsActions.loadAssignmentsSuccess, (state, { assignments }) => ({
    ...state,
    list: assignments,
    isLoading: false,
  })),
  on(AssignmentsActions.loadAssignmentsFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),

  // Load my
  on(AssignmentsActions.loadMyAssignments, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(AssignmentsActions.loadMyAssignmentsSuccess, (state, { assignments }) => ({
    ...state,
    myAssignments: assignments,
    isLoading: false,
  })),
  on(AssignmentsActions.loadMyAssignmentsFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),

  // Load one
  on(AssignmentsActions.loadAssignment, (state) => ({
    ...state,
    isLoading: true,
    error: null,
  })),
  on(AssignmentsActions.loadAssignmentSuccess, (state, { assignment }) => ({
    ...state,
    selected: assignment,
    isLoading: false,
  })),
  on(AssignmentsActions.loadAssignmentFailure, (state, { error }) => ({
    ...state,
    isLoading: false,
    error,
  })),

  // Complete / Reassign / Hold / Resume all update the assignment in both lists
  on(
    AssignmentsActions.completeAssignmentSuccess,
    AssignmentsActions.reassignAssignmentSuccess,
    AssignmentsActions.holdAssignmentSuccess,
    AssignmentsActions.resumeAssignmentSuccess,
    (state, { assignment }) => ({
      ...state,
      list: updateAssignment(state.list, assignment),
      myAssignments: updateAssignment(state.myAssignments, assignment),
      selected: state.selected?.id === assignment.id ? assignment : state.selected,
      isLoading: false,
    })
  ),
  on(
    AssignmentsActions.completeAssignmentFailure,
    AssignmentsActions.reassignAssignmentFailure,
    AssignmentsActions.holdAssignmentFailure,
    AssignmentsActions.resumeAssignmentFailure,
    (state, { error }) => ({
      ...state,
      isLoading: false,
      error,
    })
  ),

  on(AssignmentsActions.selectAssignment, (state, { id }) => ({
    ...state,
    selected: state.list.find((a) => a.id === id) ||
              state.myAssignments.find((a) => a.id === id) ||
              null,
  })),

  on(AssignmentsActions.clearAssignmentsError, (state) => ({
    ...state,
    error: null,
  }))
);
