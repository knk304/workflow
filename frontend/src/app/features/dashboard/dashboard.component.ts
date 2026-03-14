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
    <div class="dashboard-container space-y-6">
      <!-- Header -->
      <div>
        <h1 class="text-4xl font-bold text-gray-800">Dashboard</h1>
        <p class="text-gray-600 mt-2">Welcome back! Here's your workflow overview.</p>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Open Cases Card -->
        <mat-card class="shadow-md">
          <mat-card-header>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-gray-600 text-sm">Open Cases</h3>
                <p class="text-3xl font-bold text-blue-600">{{ openCases.length }}</p>
              </div>
              <mat-icon class="text-blue-400 text-4xl">folder_open</mat-icon>
            </div>
          </mat-card-header>
        </mat-card>

        <!-- Critical Cases Card -->
        <mat-card class="shadow-md">
          <mat-card-header>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-gray-600 text-sm">Critical Cases</h3>
                <p class="text-3xl font-bold text-red-600">{{ criticalCases.length }}</p>
              </div>
              <mat-icon class="text-red-400 text-4xl">priority_high</mat-icon>
            </div>
          </mat-card-header>
        </mat-card>

        <!-- My Tasks Card -->
        <mat-card class="shadow-md">
          <mat-card-header>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-gray-600 text-sm">My Tasks</h3>
                <p class="text-3xl font-bold text-green-600">{{ myTasks.length }}</p>
              </div>
              <mat-icon class="text-green-400 text-4xl">task_alt</mat-icon>
            </div>
          </mat-card-header>
        </mat-card>

        <!-- Overdue Tasks Card -->
        <mat-card class="shadow-md">
          <mat-card-header>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-gray-600 text-sm">Overdue</h3>
                <p class="text-3xl font-bold text-orange-600">{{ overdueTasks.length }}</p>
              </div>
              <mat-icon class="text-orange-400 text-4xl">schedule</mat-icon>
            </div>
          </mat-card-header>
        </mat-card>
      </div>

      <!-- Recent Items -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Recent Cases -->
        <mat-card>
          <mat-card-header>
            <mat-card-title>Recent Cases</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (openCases.length > 0) {
              <mat-list>
                @for (case of openCases | slice:0:5; track case.id) {
                  <mat-list-item [routerLink]="['/cases', case.id]">
                    <span matListItemTitle>{{ case.id }}</span>
                    <span matListItemLine>{{ case.fields.applicantName }}</span>
                    <mat-icon matListItemMeta [ngClass]="priorityColor(case.priority)">
                      {{ priorityIcon(case.priority) }}
                    </mat-icon>
                  </mat-list-item>
                }
              </mat-list>
            } @else {
              <p class="text-gray-500 text-center py-4">No open cases</p>
            }
          </mat-card-content>
          <mat-card-actions>
            <button mat-stroked-button color="primary" routerLink="/cases">
              View All Cases
            </button>
          </mat-card-actions>
        </mat-card>

        <!-- Recent Tasks -->
        <mat-card>
          <mat-card-header>
            <mat-card-title>My Recent Tasks</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            @if (myTasks.length > 0) {
              <mat-list>
                @for (task of myTasks | slice:0:5; track task.id) {
                  <mat-list-item>
                    <span matListItemTitle>{{ task.title }}</span>
                    <span matListItemLine>{{ task.caseId }}</span>
                    <div matListItemMeta class="flex gap-2">
                      <mat-icon class="text-xs">{{ statusIcon(task.status) }}</mat-icon>
                      <span class="text-xs" [ngClass]="statusColor(task.status)">
                        {{ task.status | uppercase }}
                      </span>
                    </div>
                  </mat-list-item>
                }
              </mat-list>
            } @else {
              <p class="text-gray-500 text-center py-4">No tasks assigned</p>
            }
          </mat-card-content>
          <mat-card-actions>
            <button mat-stroked-button color="primary" routerLink="/tasks">
              View All Tasks
            </button>
          </mat-card-actions>
        </mat-card>
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
      pending: 'text-gray-600',
      in_progress: 'text-blue-600',
      completed: 'text-green-600',
      blocked: 'text-red-600',
      cancelled: 'text-gray-400',
    };
    return colors[status] || '';
  }
}
