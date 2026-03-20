import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { Assignment } from '@core/models';
import * as AssignmentsActions from '@state/assignments/assignments.actions';
import {
  selectMyAssignments,
  selectAllAssignments,
  selectAssignmentsLoading,
  selectOpenAssignments,
} from '@state/assignments/assignments.selectors';

@Component({
  selector: 'app-portal-worklist',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTabsModule,
    MatMenuModule,
    MatDividerModule,
  ],
  template: `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Worklist</h1>
          <p class="text-sm text-slate-500">Your assignments and tasks</p>
        </div>
        <button mat-raised-button color="primary" (click)="refreshAll()">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      <mat-tab-group animationDuration="200ms">
        <!-- My Assignments -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="mr-2">person</mat-icon> My Work
          </ng-template>
          <div class="py-4">
            @if (myAssignments$ | async; as assignments) {
              @if (assignments.length === 0) {
                <div class="text-center py-12 text-slate-400">
                  <mat-icon class="!text-5xl mb-2">inbox</mat-icon>
                  <p class="text-lg">No assignments</p>
                  <p class="text-sm">Check back later or refresh</p>
                </div>
              } @else {
                <!-- Group by status -->
                @if (filterByStatus(assignments, 'open'); as open) {
                  @if (open.length > 0) {
                    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Open ({{ open.length }})
                    </h3>
                    <div class="space-y-2 mb-6">
                      @for (a of open; track a.id) {
                        <ng-container *ngTemplateOutlet="assignmentCard; context: { $implicit: a }"></ng-container>
                      }
                    </div>
                  }
                }

                @if (filterByStatus(assignments, 'in_progress'); as inProgress) {
                  @if (inProgress.length > 0) {
                    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      In Progress ({{ inProgress.length }})
                    </h3>
                    <div class="space-y-2 mb-6">
                      @for (a of inProgress; track a.id) {
                        <ng-container *ngTemplateOutlet="assignmentCard; context: { $implicit: a }"></ng-container>
                      }
                    </div>
                  }
                }

                @if (filterByStatus(assignments, 'on_hold'); as held) {
                  @if (held.length > 0) {
                    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      On Hold ({{ held.length }})
                    </h3>
                    <div class="space-y-2 mb-6">
                      @for (a of held; track a.id) {
                        <ng-container *ngTemplateOutlet="assignmentCard; context: { $implicit: a }"></ng-container>
                      }
                    </div>
                  }
                }

                @if (filterByStatus(assignments, 'completed'); as completed) {
                  @if (completed.length > 0) {
                    <h3 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                      Completed ({{ completed.length }})
                    </h3>
                    <div class="space-y-2 mb-6">
                      @for (a of completed; track a.id) {
                        <ng-container *ngTemplateOutlet="assignmentCard; context: { $implicit: a }"></ng-container>
                      }
                    </div>
                  }
                }
              }
            }
          </div>
        </mat-tab>

        <!-- All Assignments -->
        <mat-tab>
          <ng-template mat-tab-label>
            <mat-icon class="mr-2">groups</mat-icon> All Assignments
          </ng-template>
          <div class="py-4">
            @if (allAssignments$ | async; as assignments) {
              @if (assignments.length === 0) {
                <div class="text-center py-12 text-slate-400">
                  <mat-icon class="!text-5xl mb-2">assignment</mat-icon>
                  <p>No assignments found</p>
                </div>
              } @else {
                <div class="space-y-2">
                  @for (a of assignments; track a.id) {
                    <ng-container *ngTemplateOutlet="assignmentCard; context: { $implicit: a }"></ng-container>
                  }
                </div>
              }
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>

    <!-- Assignment Card Template -->
    <ng-template #assignmentCard let-a>
      <mat-card class="!rounded-xl !shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
        <mat-card-content class="!pt-4 !pb-3">
          <div class="flex items-start gap-3">
            <!-- Priority indicator -->
            <div class="w-1.5 h-12 rounded-full shrink-0 mt-0.5" [ngClass]="priorityBar(a.priority)"></div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <a [routerLink]="['/portal/cases', a.caseId]"
                   class="font-semibold text-sm text-blue-600 hover:text-blue-800 truncate">
                  {{ a.stepName || a.name }}
                </a>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                      [ngClass]="statusBadge(a.status)">
                  {{ a.status }}
                </span>
              </div>
              <p class="text-xs text-slate-500 truncate">
                {{ a.caseTitle }} · {{ a.assignmentType || 'task' }}
              </p>
              @if (a.assignedTo) {
                <p class="text-[10px] text-slate-400 mt-1">Assigned to: {{ a.assignedTo }}</p>
              }
            </div>

            <!-- Actions -->
            <button mat-icon-button [matMenuTriggerFor]="itemMenu" class="shrink-0">
              <mat-icon>more_vert</mat-icon>
            </button>
            <mat-menu #itemMenu="matMenu">
              <a mat-menu-item [routerLink]="['/portal/cases', a.caseId]">
                <mat-icon>open_in_new</mat-icon> Open Case
              </a>
              @if (a.status === 'open' || a.status === 'in_progress') {
                <button mat-menu-item (click)="onComplete(a)">
                  <mat-icon>check_circle</mat-icon> Complete
                </button>
                <button mat-menu-item (click)="onHold(a)">
                  <mat-icon>pause_circle</mat-icon> Hold
                </button>
              }
              @if (a.status === 'on_hold') {
                <button mat-menu-item (click)="onResume(a)">
                  <mat-icon>play_circle</mat-icon> Resume
                </button>
              }
            </mat-menu>
          </div>
        </mat-card-content>
      </mat-card>
    </ng-template>
  `,
})
export class PortalWorklistComponent implements OnInit {
  myAssignments$: Observable<Assignment[]> = this.store.select(selectMyAssignments);
  allAssignments$: Observable<Assignment[]> = this.store.select(selectAllAssignments);
  isLoading$: Observable<boolean> = this.store.select(selectAssignmentsLoading);

  constructor(private store: Store) {}

  ngOnInit(): void {
    this.refreshAll();
  }

  refreshAll(): void {
    this.store.dispatch(AssignmentsActions.loadMyAssignments());
    this.store.dispatch(AssignmentsActions.loadAssignments({}));
  }

  filterByStatus(assignments: Assignment[], status: string): Assignment[] {
    return assignments.filter((a) => a.status === status);
  }

  onComplete(a: Assignment): void {
    this.store.dispatch(
      AssignmentsActions.completeAssignment({ id: a.id, request: { formData: {} } })
    );
  }

  onHold(a: Assignment): void {
    this.store.dispatch(AssignmentsActions.holdAssignment({ id: a.id }));
  }

  onResume(a: Assignment): void {
    this.store.dispatch(AssignmentsActions.resumeAssignment({ id: a.id }));
  }

  priorityBar(priority: string): string {
    return {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-green-500',
    }[priority] || 'bg-slate-300';
  }

  statusBadge(status: string): string {
    return {
      open: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-amber-100 text-amber-700',
      completed: 'bg-green-100 text-green-700',
      on_hold: 'bg-slate-100 text-slate-600',
    }[status] || 'bg-slate-100 text-slate-600';
  }
}
