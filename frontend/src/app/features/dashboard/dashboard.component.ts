import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Store } from '@ngrx/store';
import { selectActiveCaseInstances, selectCriticalCaseInstances } from '../../state/cases/cases.selectors';
import { selectMyAssignments } from '../../state/assignments/assignments.selectors';
import * as CasesActions from '../../state/cases/cases.actions';
import * as AssignmentsActions from '../../state/assignments/assignments.actions';
import { CaseInstance, Assignment } from '@core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatListModule],
  template: `
    <div class="dashboard-container space-y-6 animate-fade-in">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p class="text-slate-500 text-sm mt-1">Welcome back! Here's your workflow overview.</p>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Active Cases -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Cases</p>
              <p class="text-3xl font-bold text-slate-900 mt-2">{{ activeCases.length }}</p>
            </div>
            <div class="w-11 h-11 rounded-xl bg-[#EAF4FB] flex items-center justify-center">
              <mat-icon class="text-[#056DAE]">folder_open</mat-icon>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-1 text-xs text-slate-400">
            <mat-icon class="text-sm text-[#056DAE]">trending_up</mat-icon>
            Active workload
          </div>
        </div>

        <!-- Critical Cases -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Critical</p>
              <p class="text-3xl font-bold text-red-600 mt-2">{{ criticalCases.length }}</p>
            </div>
            <div class="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
              <mat-icon class="text-red-500">priority_high</mat-icon>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-1 text-xs text-slate-400">
            <mat-icon class="text-sm text-red-400">warning</mat-icon>
            Needs attention
          </div>
        </div>

        <!-- My Assignments -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">My Assignments</p>
              <p class="text-3xl font-bold text-slate-900 mt-2">{{ myAssignments.length }}</p>
            </div>
            <div class="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
              <mat-icon class="text-emerald-500">task_alt</mat-icon>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-1 text-xs text-slate-400">
            <mat-icon class="text-sm text-emerald-400">check</mat-icon>
            Assigned to you
          </div>
        </div>

        <!-- Overdue -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Overdue</p>
              <p class="text-3xl font-bold mt-2" [ngClass]="overdueAssignments.length > 0 ? 'text-amber-600' : 'text-slate-900'">{{ overdueAssignments.length }}</p>
            </div>
            <div class="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
              <mat-icon class="text-amber-500">schedule</mat-icon>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-1 text-xs text-slate-400">
            <mat-icon class="text-sm text-amber-400">timer</mat-icon>
            Past due date
          </div>
        </div>
      </div>

      <!-- Recent Items -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Recent Cases -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <mat-icon class="text-base text-[#056DAE]">folder_open</mat-icon>
              Recent Cases
            </h3>
            <a routerLink="/portal/cases" class="text-xs text-[#056DAE] font-semibold hover:text-[#003B70] transition-colors">
              View All
            </a>
          </div>
          @if (activeCases.length > 0) {
            <div class="divide-y divide-slate-50">
              @for (c of activeCases | slice:0:5; track c.id) {
                <a [routerLink]="['/portal/cases', c.id]" class="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors cursor-pointer">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-800 truncate">{{ c.title || c.id }}</p>
                    <p class="text-xs text-slate-400 truncate">{{ c.caseTypeName }}</p>
                  </div>
                  <mat-icon [ngClass]="priorityColor(c.priority)" class="text-base">
                    {{ priorityIcon(c.priority) }}
                  </mat-icon>
                </a>
              }
            </div>
          } @else {
            <div class="text-center py-10">
              <mat-icon class="text-4xl text-slate-200">inbox</mat-icon>
              <p class="text-slate-400 text-xs mt-2">No active cases</p>
            </div>
          }
        </div>

        <!-- My Assignments -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <mat-icon class="text-base text-emerald-400">task_alt</mat-icon>
              My Assignments
            </h3>
            <a routerLink="/portal/worklist" class="text-xs text-[#056DAE] font-semibold hover:text-[#003B70] transition-colors">
              View All
            </a>
          </div>
          @if (myAssignments.length > 0) {
            <div class="divide-y divide-slate-50">
              @for (a of myAssignments | slice:0:5; track a.id) {
                <div class="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                       [ngClass]="statusBgColor(a.status)">
                    <mat-icon class="text-sm" [ngClass]="statusColor(a.status)">
                      {{ statusIcon(a.status) }}
                    </mat-icon>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-800 truncate">{{ a.name }}</p>
                    <p class="text-xs text-slate-400 truncate">{{ a.caseTitle }}</p>
                  </div>
                  <span class="wf-badge text-[10px]" [ngClass]="statusBadge(a.status)">
                    {{ a.status | uppercase }}
                  </span>
                </div>
              }
            </div>
          } @else {
            <div class="text-center py-10">
              <mat-icon class="text-4xl text-slate-200">check_circle</mat-icon>
              <p class="text-slate-400 text-xs mt-2">No assignments</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  activeCases: CaseInstance[] = [];
  criticalCases: CaseInstance[] = [];
  myAssignments: Assignment[] = [];
  overdueAssignments: Assignment[] = [];

  constructor(private store: Store) {}

  ngOnInit(): void {
    this.store.dispatch(CasesActions.loadCaseInstances({}));
    this.store.dispatch(AssignmentsActions.loadMyAssignments());

    this.store.select(selectActiveCaseInstances).subscribe(cases => {
      this.activeCases = cases;
    });
    this.store.select(selectCriticalCaseInstances).subscribe(cases => {
      this.criticalCases = cases;
    });
    this.store.select(selectMyAssignments).subscribe(assignments => {
      this.myAssignments = assignments;
      this.overdueAssignments = assignments.filter(a => a.isOverdue);
    });
  }

  priorityIcon(priority: string): string {
    const icons: Record<string, string> = {
      critical: 'error',
      high: 'warning',
      medium: 'info',
      low: 'check_circle',
    };
    return icons[priority] || 'circle';
  }

  priorityColor(priority: string): string {
    const colors: Record<string, string> = {
      critical: 'text-red-600',
      high: 'text-orange-600',
      medium: 'text-yellow-600',
      low: 'text-green-600',
    };
    return colors[priority] || '';
  }

  statusIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: 'schedule',
      in_progress: 'play_circle_filled',
      completed: 'check_circle',
      blocked: 'block',
      cancelled: 'cancel',
    };
    return icons[status] || 'circle';
  }

  statusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: 'text-slate-500',
      in_progress: 'text-[#056DAE]',
      completed: 'text-emerald-600',
      blocked: 'text-red-600',
      cancelled: 'text-slate-400',
    };
    return colors[status] || '';
  }

  statusBgColor(status: string): string {
    return {
      pending: 'bg-slate-100',
      in_progress: 'bg-[#EAF4FB]',
      completed: 'bg-emerald-50',
      blocked: 'bg-red-50',
      cancelled: 'bg-slate-50',
    }[status] || 'bg-slate-100';
  }

  statusBadge(status: string): string {
    return {
      pending: 'wf-badge--neutral',
      in_progress: 'wf-badge--info',
      completed: 'wf-badge--success',
      blocked: 'wf-badge--danger',
      cancelled: 'wf-badge--neutral',
    }[status] || 'wf-badge--neutral';
  }
}
