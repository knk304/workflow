import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { CaseInstance, Assignment } from '@core/models';
import * as CasesActions from '@state/cases/cases.actions';
import * as AssignmentsActions from '@state/assignments/assignments.actions';
import {
  selectCaseInstances,
  selectCasesLoading,
  selectActiveCaseInstances,
  selectCriticalCaseInstances,
} from '@state/cases/cases.selectors';
import {
  selectMyAssignments,
  selectOpenAssignments,
  selectMyOpenAssignmentCount,
} from '@state/assignments/assignments.selectors';

@Component({
  selector: 'app-portal-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Worker Portal</h1>
          <p class="text-sm text-slate-500 mt-1">Your work at a glance</p>
        </div>
        <button mat-raised-button color="primary" routerLink="/portal/cases/new">
          <mat-icon>add</mat-icon> New Case
        </button>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
          <mat-card-content class="pt-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                <mat-icon class="text-blue-600">assignment</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-slate-800">{{ (myOpenCount$ | async) || 0 }}</p>
                <p class="text-xs text-slate-500">Open Assignments</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
          <mat-card-content class="pt-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                <mat-icon class="text-emerald-600">folder_open</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-slate-800">{{ (activeCases$ | async)?.length || 0 }}</p>
                <p class="text-xs text-slate-500">Active Cases</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
          <mat-card-content class="pt-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                <mat-icon class="text-red-600">priority_high</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-slate-800">{{ (criticalCases$ | async)?.length || 0 }}</p>
                <p class="text-xs text-slate-500">Critical Cases</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
          <mat-card-content class="pt-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                <mat-icon class="text-purple-600">inventory_2</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-slate-800">{{ (allCases$ | async)?.length || 0 }}</p>
                <p class="text-xs text-slate-500">Total Cases</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- My Assignments -->
      <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
        <mat-card-header class="!pb-0">
          <mat-card-title class="!text-base !font-semibold text-slate-800">
            <mat-icon class="align-middle mr-1 text-blue-600">assignment_ind</mat-icon>
            My Assignments
          </mat-card-title>
          <span class="flex-1"></span>
          <a mat-button color="primary" routerLink="/portal/worklist" class="!text-sm">View All</a>
        </mat-card-header>
        <mat-card-content class="mt-4">
          @if (openAssignments$ | async; as assignments) {
            @if (assignments.length === 0) {
              <div class="text-center py-8 text-slate-400">
                <mat-icon class="!text-4xl mb-2">inbox</mat-icon>
                <p>No open assignments</p>
              </div>
            } @else {
              <div class="divide-y divide-slate-100">
                @for (a of assignments.slice(0, 5); track a.id) {
                  <div class="flex items-center gap-3 py-3 px-2 hover:bg-slate-50 rounded-lg cursor-pointer"
                       [routerLink]="['/portal/cases', a.caseId]">
                    <div class="w-2 h-2 rounded-full" [ngClass]="priorityDot(a.priority)"></div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-slate-700 truncate">{{ a.stepName || a.name }}</p>
                      <p class="text-xs text-slate-400">{{ a.caseTitle }}</p>
                    </div>
                    <span class="text-xs px-2 py-0.5 rounded-full"
                          [ngClass]="statusBadge(a.status)">
                      {{ a.status }}
                    </span>
                  </div>
                }
              </div>
            }
          }
        </mat-card-content>
      </mat-card>

      <!-- Recent Cases -->
      <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
        <mat-card-header class="!pb-0">
          <mat-card-title class="!text-base !font-semibold text-slate-800">
            <mat-icon class="align-middle mr-1 text-emerald-600">history</mat-icon>
            Recent Cases
          </mat-card-title>
          <span class="flex-1"></span>
          <a mat-button color="primary" routerLink="/portal/cases" class="!text-sm">View All</a>
        </mat-card-header>
        <mat-card-content class="mt-4">
          @if (allCases$ | async; as cases) {
            @if (cases.length === 0) {
              <div class="text-center py-8 text-slate-400">
                <mat-icon class="!text-4xl mb-2">folder_off</mat-icon>
                <p>No cases yet</p>
              </div>
            } @else {
              <div class="divide-y divide-slate-100">
                @for (c of cases.slice(0, 5); track c.id) {
                  <div class="flex items-center gap-3 py-3 px-2 hover:bg-slate-50 rounded-lg cursor-pointer"
                       [routerLink]="['/portal/cases', c.id]">
                    <mat-icon class="text-slate-400">folder</mat-icon>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-slate-700 truncate">{{ c.title }}</p>
                      <p class="text-xs text-slate-400">{{ c.caseTypeId }} · Stage {{ c.currentStageIndex + 1 }}</p>
                    </div>
                    <span class="text-xs px-2 py-0.5 rounded-full"
                          [ngClass]="caseStatusBadge(c.status)">
                      {{ c.status }}
                    </span>
                  </div>
                }
              </div>
            }
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class PortalDashboardComponent implements OnInit {
  allCases$: Observable<CaseInstance[]> = this.store.select(selectCaseInstances);
  activeCases$: Observable<CaseInstance[]> = this.store.select(selectActiveCaseInstances);
  criticalCases$: Observable<CaseInstance[]> = this.store.select(selectCriticalCaseInstances);
  isLoading$: Observable<boolean> = this.store.select(selectCasesLoading);
  myAssignments$: Observable<Assignment[]> = this.store.select(selectMyAssignments);
  openAssignments$: Observable<Assignment[]> = this.store.select(selectOpenAssignments);
  myOpenCount$: Observable<number> = this.store.select(selectMyOpenAssignmentCount);

  constructor(private store: Store) {}

  ngOnInit(): void {
    this.store.dispatch(CasesActions.loadCaseInstances({}));
    this.store.dispatch(AssignmentsActions.loadMyAssignments());
  }

  priorityDot(priority: string): string {
    return {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-green-500',
    }[priority] || 'bg-slate-400';
  }

  statusBadge(status: string): string {
    return {
      open: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-amber-100 text-amber-700',
      completed: 'bg-green-100 text-green-700',
      on_hold: 'bg-slate-100 text-slate-600',
    }[status] || 'bg-slate-100 text-slate-600';
  }

  caseStatusBadge(status: string): string {
    return {
      open: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-amber-100 text-amber-700',
      resolved: 'bg-green-100 text-green-700',
      closed: 'bg-slate-100 text-slate-600',
      withdrawn: 'bg-red-100 text-red-600',
    }[status] || 'bg-slate-100 text-slate-600';
  }
}
