import { Component, OnInit, ViewChild, AfterViewInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { DataService } from '@core/services/data.service';
import { FlowExecution } from '@core/models';

@Component({
  selector: 'app-portal-flow-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatChipsModule,
    MatTableModule, MatSortModule, MatPaginatorModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatTooltipModule, MatProgressBarModule, MatMenuModule,
  ],
  template: `
    <div class="space-y-5">
      <!-- Page Header -->
      <div class="bg-gradient-to-r from-[#056DAE] to-[#0891b2] rounded-2xl p-6 text-white shadow-lg">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <mat-icon>list_alt</mat-icon>
            </div>
            <div>
              <h1 class="text-xl font-bold text-white">All Requests</h1>
              <p class="text-sm text-white/80">Track and manage all your submitted flow requests</p>
            </div>
          </div>
          <button mat-raised-button class="!bg-white !text-[#056DAE] !font-semibold !rounded-lg !shadow-md"
                  (click)="goToCreate()">
            <mat-icon>add</mat-icon> New Request
          </button>
        </div>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" class="rounded-full"></mat-progress-bar>
      }

      <!-- Stats Row -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <mat-icon class="!text-lg text-blue-600">inbox</mat-icon>
            </div>
            <div>
              <p class="text-xl font-bold text-slate-800">{{ totalCount() }}</p>
              <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Total</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center">
              <mat-icon class="!text-lg text-yellow-600">hourglass_empty</mat-icon>
            </div>
            <div>
              <p class="text-xl font-bold text-yellow-600">{{ inProgressCount() }}</p>
              <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium">In Progress</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center">
              <mat-icon class="!text-lg text-green-600">check_circle</mat-icon>
            </div>
            <div>
              <p class="text-xl font-bold text-green-600">{{ completedCount() }}</p>
              <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Completed</p>
            </div>
          </div>
        </div>
        <div class="bg-white rounded-xl border border-slate-100 p-4 shadow-sm">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
              <mat-icon class="!text-lg text-red-600">cancel</mat-icon>
            </div>
            <div>
              <p class="text-xl font-bold text-red-600">{{ abandonedCount() }}</p>
              <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Abandoned</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters Bar -->
      <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
        <mat-card-content class="!py-3">
          <div class="flex flex-wrap items-center gap-3">
            <mat-form-field class="flex-1 min-w-[200px] dense-field" subscriptSizing="dynamic">
              <mat-icon matPrefix class="text-slate-400 mr-2">search</mat-icon>
              <mat-label>Search by flow name or ID...</mat-label>
              <input matInput [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()">
            </mat-form-field>
            <mat-form-field class="w-44 dense-field" subscriptSizing="dynamic">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="statusFilter" (ngModelChange)="applyFilters()">
                <mat-option value="">All Statuses</mat-option>
                <mat-option value="in_progress">In Progress</mat-option>
                <mat-option value="completed">Completed</mat-option>
                <mat-option value="abandoned">Abandoned</mat-option>
              </mat-select>
            </mat-form-field>
            @if (searchTerm || statusFilter) {
              <button mat-button class="!text-xs !text-slate-500" (click)="clearFilters()">
                <mat-icon class="!text-sm !w-4 !h-4">clear</mat-icon> Clear
              </button>
            }
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Data Table -->
      <mat-card class="!rounded-xl !shadow-sm border border-slate-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table mat-table [dataSource]="dataSource" matSort class="w-full requests-table">
            <!-- ID Column -->
            <ng-container matColumnDef="id">
              <th mat-header-cell *matHeaderCellDef mat-sort-header class="!text-xs !font-semibold !text-slate-500 !uppercase !tracking-wider">
                Request ID
              </th>
              <td mat-cell *matCellDef="let row" class="!text-xs">
                <span class="font-mono text-[#056DAE] font-medium cursor-pointer hover:underline"
                      (click)="viewExecution(row)">
                  {{ row.requestNumber || (row.id | slice:0:8) + '...' }}
                </span>
              </td>
            </ng-container>

            <!-- Flow Name Column -->
            <ng-container matColumnDef="flowName">
              <th mat-header-cell *matHeaderCellDef mat-sort-header class="!text-xs !font-semibold !text-slate-500 !uppercase !tracking-wider">
                Flow Name
              </th>
              <td mat-cell *matCellDef="let row">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg bg-[#EAF4FB] flex items-center justify-center shrink-0">
                    <mat-icon class="!text-sm !w-4 !h-4 text-[#056DAE]">account_tree</mat-icon>
                  </div>
                  <span class="text-sm font-medium text-slate-800">{{ row.flowName }}</span>
                </div>
              </td>
            </ng-container>

            <!-- Status Column -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef mat-sort-header class="!text-xs !font-semibold !text-slate-500 !uppercase !tracking-wider">
                Status
              </th>
              <td mat-cell *matCellDef="let row">
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                      [ngClass]="statusClass(row.status)">
                  <span class="w-1.5 h-1.5 rounded-full" [ngClass]="statusDotClass(row.status)"></span>
                  {{ statusLabel(row.status) }}
                </span>
              </td>
            </ng-container>

            <!-- Started Column -->
            <ng-container matColumnDef="startedAt">
              <th mat-header-cell *matHeaderCellDef mat-sort-header class="!text-xs !font-semibold !text-slate-500 !uppercase !tracking-wider">
                Started
              </th>
              <td mat-cell *matCellDef="let row" class="!text-xs text-slate-500">
                <div class="flex items-center gap-1">
                  <mat-icon class="!text-[11px] !w-3 !h-3 text-slate-400">schedule</mat-icon>
                  {{ row.startedAt | date:'MMM d, y h:mm a' }}
                </div>
              </td>
            </ng-container>

            <!-- Completed Column -->
            <ng-container matColumnDef="completedAt">
              <th mat-header-cell *matHeaderCellDef mat-sort-header class="!text-xs !font-semibold !text-slate-500 !uppercase !tracking-wider">
                Completed
              </th>
              <td mat-cell *matCellDef="let row" class="!text-xs text-slate-500">
                @if (row.completedAt) {
                  <div class="flex items-center gap-1">
                    <mat-icon class="!text-[11px] !w-3 !h-3 text-green-500">check</mat-icon>
                    {{ row.completedAt | date:'MMM d, y h:mm a' }}
                  </div>
                } @else {
                  <span class="text-slate-300">—</span>
                }
              </td>
            </ng-container>

            <!-- Progress Column -->
            <ng-container matColumnDef="progress">
              <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-slate-500 !uppercase !tracking-wider">
                Progress
              </th>
              <td mat-cell *matCellDef="let row">
                <div class="flex items-center gap-2 min-w-[100px]">
                  <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all"
                         [ngClass]="row.status === 'completed' ? 'bg-green-500' : row.status === 'abandoned' ? 'bg-red-400' : 'bg-[#056DAE]'"
                         [style.width.%]="row.status === 'completed' ? 100 : row.status === 'abandoned' ? 100 : progressPercent(row)">
                    </div>
                  </div>
                  <span class="text-[10px] font-medium text-slate-400 w-8 text-right">
                    {{ row.status === 'completed' ? '100' : row.status === 'abandoned' ? '—' : progressPercent(row) }}%
                  </span>
                </div>
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-slate-500 !uppercase !tracking-wider !w-16">
              </th>
              <td mat-cell *matCellDef="let row" class="!text-right">
                <button mat-icon-button [matMenuTriggerFor]="rowMenu" class="!w-8 !h-8"
                        matTooltip="Actions">
                  <mat-icon class="!text-lg text-slate-400">more_vert</mat-icon>
                </button>
                <mat-menu #rowMenu="matMenu">
                  @if (row.status === 'in_progress') {
                    <button mat-menu-item (click)="viewExecution(row)">
                      <mat-icon>play_arrow</mat-icon> Continue
                    </button>
                  }
                  <button mat-menu-item (click)="viewSummary(row)">
                    <mat-icon>summarize</mat-icon> View Summary
                  </button>
                </mat-menu>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns" class="!bg-slate-50/80"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                class="hover:!bg-slate-50/60 cursor-pointer transition-colors"
                (click)="viewExecution(row)">
            </tr>

            <!-- No Data Row -->
            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell text-center py-12 text-slate-400" [colSpan]="displayedColumns.length">
                <div class="flex flex-col items-center gap-2">
                  <mat-icon class="!text-4xl !w-10 !h-10 text-slate-300">inbox</mat-icon>
                  <p class="text-sm font-medium text-slate-500">No requests found</p>
                  <p class="text-xs text-slate-400">Submit a new request to get started</p>
                </div>
              </td>
            </tr>
          </table>
        </div>
        <mat-paginator [pageSizeOptions]="[10, 25, 50]" [pageSize]="10"
                       showFirstLastButtons class="border-t border-slate-100">
        </mat-paginator>
      </mat-card>
    </div>
  `,
  styles: [`
    .dense-field { font-size: 13px; }
    .dense-field .mat-mdc-form-field-infix { min-height: 36px !important; padding-top: 8px !important; padding-bottom: 8px !important; }
    .requests-table .mat-mdc-header-cell { border-bottom: 2px solid #e2e8f0; }
    .requests-table .mat-mdc-row { border-bottom: 1px solid #f1f5f9; }
    .requests-table .mat-mdc-row:last-child { border-bottom: none; }
    .requests-table .mat-mdc-cell { padding-top: 12px; padding-bottom: 12px; }
  `],
})
export class PortalFlowListComponent implements OnInit, AfterViewInit {
  loading = signal(true);
  allExecutions = signal<FlowExecution[]>([]);
  totalCount = signal(0);
  inProgressCount = signal(0);
  completedCount = signal(0);
  abandonedCount = signal(0);

  displayedColumns = ['id', 'flowName', 'status', 'startedAt', 'completedAt', 'progress', 'actions'];
  dataSource = new MatTableDataSource<FlowExecution>();

  searchTerm = '';
  statusFilter = '';

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(private dataService: DataService, private router: Router) {}

  ngOnInit(): void {
    this.dataService.getFlowExecutions().subscribe({
      next: execs => {
        this.allExecutions.set(execs);
        this.dataSource.data = execs;
        this.updateCounts(execs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
  }

  private updateCounts(execs: FlowExecution[]): void {
    this.totalCount.set(execs.length);
    this.inProgressCount.set(execs.filter(e => e.status === 'in_progress').length);
    this.completedCount.set(execs.filter(e => e.status === 'completed').length);
    this.abandonedCount.set(execs.filter(e => e.status === 'abandoned').length);
  }

  applyFilters(): void {
    let filtered = this.allExecutions();
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(e =>
        e.flowName.toLowerCase().includes(term) || e.id.toLowerCase().includes(term) || (e.requestNumber || '').toLowerCase().includes(term)
      );
    }
    if (this.statusFilter) {
      filtered = filtered.filter(e => e.status === this.statusFilter);
    }
    this.dataSource.data = filtered;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.dataSource.data = this.allExecutions();
  }

  progressPercent(exec: FlowExecution): number {
    if (!exec.visitedNodes?.length) return 0;
    // Rough estimate: visited nodes out of a reasonable max
    return Math.min(Math.round((exec.visitedNodes.length / Math.max(exec.visitedNodes.length + 2, 5)) * 100), 95);
  }

  statusClass(status: string): string {
    return {
      in_progress: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
      completed: 'bg-green-50 text-green-700 border border-green-200',
      abandoned: 'bg-red-50 text-red-700 border border-red-200',
    }[status] || 'bg-slate-50 text-slate-700';
  }

  statusDotClass(status: string): string {
    return {
      in_progress: 'bg-yellow-500',
      completed: 'bg-green-500',
      abandoned: 'bg-red-500',
    }[status] || 'bg-slate-500';
  }

  statusLabel(status: string): string {
    return {
      in_progress: 'In Progress',
      completed: 'Completed',
      abandoned: 'Abandoned',
    }[status] || status;
  }

  viewExecution(exec: FlowExecution): void {
    if (exec.status === 'in_progress') {
      this.router.navigate(['/portal/flows', exec.id, 'run']);
    } else {
      this.router.navigate(['/portal/flows', exec.id, 'summary']);
    }
  }

  viewSummary(exec: FlowExecution): void {
    this.router.navigate(['/portal/flows', exec.id, 'summary']);
  }

  goToCreate(): void {
    this.router.navigate(['/portal/flows/new']);
  }
}
