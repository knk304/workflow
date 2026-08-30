import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { TemporalService, WorkflowExecution } from '../services/temporal.service';

@Component({
  selector: 'app-temporal-workflow-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatTableModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatChipsModule,
  ],
  template: `
    <div class="p-6 space-y-4">

      <!-- Header -->
      <div class="flex items-center gap-3">
        <a mat-icon-button routerLink="/temporal">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <div>
          <h1 class="text-xl font-bold text-slate-800">Workflow Executions</h1>
          <p class="text-slate-500 text-xs">{{ total() }} executions</p>
        </div>
        <span class="flex-1"></span>
        <button mat-stroked-button (click)="load()">
          <mat-icon>refresh</mat-icon>
        </button>
      </div>

      <!-- Filters -->
      <div class="flex gap-3 flex-wrap">
        <mat-form-field class="w-48">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="statusFilter" (ngModelChange)="load()">
            <mat-option value="">All</mat-option>
            <mat-option value="running">Running</mat-option>
            <mat-option value="completed">Completed</mat-option>
            <mat-option value="failed">Failed</mat-option>
            <mat-option value="timed_out">Timed Out</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field class="w-64">
          <mat-label>Search Workflow ID</mat-label>
          <mat-icon matPrefix>search</mat-icon>
          <input matInput [(ngModel)]="search" placeholder="case-CASE-001…" />
        </mat-form-field>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-16"><mat-spinner diameter="36"></mat-spinner></div>
      } @else if (filtered().length === 0) {
        <div class="text-center py-16 text-slate-400">
          <mat-icon class="text-5xl">schema</mat-icon>
          <p class="mt-2">No workflows found</p>
        </div>
      } @else {

        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table mat-table [dataSource]="filtered()" class="w-full">

            <ng-container matColumnDef="workflow_id">
              <th mat-header-cell *matHeaderCellDef class="text-xs font-semibold text-slate-500 uppercase">Workflow ID</th>
              <td mat-cell *matCellDef="let row">
                <a [routerLink]="['/temporal/workflows', row.workflow_id]"
                   class="text-indigo-600 hover:underline font-mono text-sm">
                  {{ row.workflow_id }}
                </a>
              </td>
            </ng-container>

            <ng-container matColumnDef="workflow_type">
              <th mat-header-cell *matHeaderCellDef class="text-xs font-semibold text-slate-500 uppercase">Type</th>
              <td mat-cell *matCellDef="let row">
                <span class="text-sm text-slate-600">{{ row.workflow_type }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef class="text-xs font-semibold text-slate-500 uppercase">Status</th>
              <td mat-cell *matCellDef="let row">
                <span class="wf-badge" [ngClass]="statusBadge(row.status)">{{ row.status }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="start_time">
              <th mat-header-cell *matHeaderCellDef class="text-xs font-semibold text-slate-500 uppercase">Started</th>
              <td mat-cell *matCellDef="let row" class="text-sm text-slate-500">
                {{ row.start_time ? (row.start_time | date:'short') : '—' }}
              </td>
            </ng-container>

            <ng-container matColumnDef="close_time">
              <th mat-header-cell *matHeaderCellDef class="text-xs font-semibold text-slate-500 uppercase">Closed</th>
              <td mat-cell *matCellDef="let row" class="text-sm text-slate-500">
                {{ row.close_time ? (row.close_time | date:'short') : '—' }}
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns" class="bg-slate-50"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;"
                class="hover:bg-slate-50 transition-colors cursor-pointer"
                [routerLink]="['/temporal/workflows', row.workflow_id]"></tr>
          </table>
        </div>
      }
    </div>
  `,
})
export class TemporalWorkflowListComponent implements OnInit {
  columns = ['workflow_id', 'workflow_type', 'status', 'start_time', 'close_time'];
  loading = signal(true);
  workflows = signal<WorkflowExecution[]>([]);
  filtered = signal<WorkflowExecution[]>([]);
  total = signal(0);

  statusFilter = '';
  search = '';

  constructor(
    private temporalService: TemporalService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['status']) this.statusFilter = params['status'];
      this.load();
    });
  }

  load(): void {
    this.loading.set(true);
    this.temporalService.listWorkflows(this.statusFilter || undefined, 100).subscribe({
      next: res => {
        this.workflows.set(res.workflows);
        this.total.set(res.count);
        this.applySearch();
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applySearch(): void {
    const q = this.search.toLowerCase();
    this.filtered.set(
      q ? this.workflows().filter(w => w.workflow_id.toLowerCase().includes(q)) : this.workflows()
    );
  }

  statusBadge(status: string): string {
    return ({
      running:   'wf-badge--info',
      completed: 'wf-badge--success',
      failed:    'wf-badge--danger',
      cancelled: 'wf-badge--neutral',
      timed_out: 'wf-badge--warning',
    } as Record<string, string>)[status] ?? 'wf-badge--neutral';
  }
}
