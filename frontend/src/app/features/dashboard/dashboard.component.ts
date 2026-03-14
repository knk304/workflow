import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Store } from '@ngrx/store';
import { selectOpenCases, selectCriticalCases } from '../../state/cases/cases.selectors';
import { selectMyTasks, selectOverdueTasks } from '../../state/tasks/tasks.selectors';

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
        <!-- Open Cases -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">Open Cases</p>
              <p class="text-3xl font-bold text-slate-900 mt-2">{{ openCases.length }}</p>
            </div>
            <div class="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
              <mat-icon class="text-blue-500">folder_open</mat-icon>
            </div>
          </div>
          <div class="mt-3 flex items-center gap-1 text-xs text-slate-400">
            <mat-icon class="text-sm text-blue-400">trending_up</mat-icon>
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

        <!-- My Tasks -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow">
          <div class="flex items-start justify-between">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-slate-400">My Tasks</p>
              <p class="text-3xl font-bold text-slate-900 mt-2">{{ myTasks.length }}</p>
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
              <p class="text-3xl font-bold mt-2" [ngClass]="overdueTasks.length > 0 ? 'text-amber-600' : 'text-slate-900'">{{ overdueTasks.length }}</p>
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
              <mat-icon class="text-base text-indigo-400">folder_open</mat-icon>
              Recent Cases
            </h3>
            <a routerLink="/cases" class="text-xs text-indigo-600 font-semibold hover:text-indigo-800 transition-colors">
              View All
            </a>
          </div>
          @if (openCases.length > 0) {
            <div class="divide-y divide-slate-50">
              @for (case of openCases | slice:0:5; track case.id) {
                <a [routerLink]="['/cases', case.id]" class="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors cursor-pointer">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-800 truncate">{{ case.id }}</p>
                    <p class="text-xs text-slate-400 truncate">{{ case.fields.applicantName }}</p>
                  </div>
                  <mat-icon [ngClass]="priorityColor(case.priority)" class="text-base">
                    {{ priorityIcon(case.priority) }}
                  </mat-icon>
                </a>
              }
            </div>
          } @else {
            <div class="text-center py-10">
              <mat-icon class="text-4xl text-slate-200">inbox</mat-icon>
              <p class="text-slate-400 text-xs mt-2">No open cases</p>
            </div>
          }
        </div>

        <!-- Recent Tasks -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 class="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <mat-icon class="text-base text-emerald-400">task_alt</mat-icon>
              My Recent Tasks
            </h3>
            <a routerLink="/tasks" class="text-xs text-indigo-600 font-semibold hover:text-indigo-800 transition-colors">
              View All
            </a>
          </div>
          @if (myTasks.length > 0) {
            <div class="divide-y divide-slate-50">
              @for (task of myTasks | slice:0:5; track task.id) {
                <div class="flex items-center gap-3 px-5 py-3 hover:bg-slate-50/50 transition-colors">
                  <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                       [ngClass]="statusBgColor(task.status)">
                    <mat-icon class="text-sm" [ngClass]="statusColor(task.status)">
                      {{ statusIcon(task.status) }}
                    </mat-icon>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-800 truncate">{{ task.title }}</p>
                    <p class="text-xs text-slate-400 truncate">{{ task.caseId }}</p>
                  </div>
                  <span class="wf-badge text-[10px]" [ngClass]="statusBadge(task.status)">
                    {{ task.status | uppercase }}
                  </span>
                </div>
              }
            </div>
          } @else {
            <div class="text-center py-10">
              <mat-icon class="text-4xl text-slate-200">check_circle</mat-icon>
              <p class="text-slate-400 text-xs mt-2">No tasks assigned</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  openCases: any[] = [];
  criticalCases: any[] = [];
  myTasks: any[] = [];
  overdueTasks: any[] = [];

  constructor(private store: Store) {}

  ngOnInit(): void {
    this.store.select(selectOpenCases).subscribe(cases => {
      this.openCases = cases;
    });
    this.store.select(selectCriticalCases).subscribe(cases => {
      this.criticalCases = cases;
    });
    this.store.select(selectMyTasks('user-1')).subscribe(tasks => {
      this.myTasks = tasks;
    });
    this.store.select(selectOverdueTasks).subscribe(tasks => {
      this.overdueTasks = tasks;
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
      in_progress: 'text-blue-600',
      completed: 'text-emerald-600',
      blocked: 'text-red-600',
      cancelled: 'text-slate-400',
    };
    return colors[status] || '';
  }

  statusBgColor(status: string): string {
    return {
      pending: 'bg-slate-100',
      in_progress: 'bg-blue-50',
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
