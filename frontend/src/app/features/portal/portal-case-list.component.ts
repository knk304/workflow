import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { CaseInstance, Team, User } from '@core/models';
import { statusLabel } from '@core/utils/status-labels';
import { DataService } from '@core/services/data.service';
import * as CasesActions from '@state/cases/cases.actions';
import { selectUser } from '@state/auth/auth.selectors';
import {
  selectCaseInstances,
  selectCasesLoading,
  selectCaseInstanceCount,
} from '@state/cases/cases.selectors';

@Component({
  selector: 'app-portal-case-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatChipsModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTooltipModule,
  ],
  template: `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Case Instances</h1>
          <p class="text-sm text-slate-500">{{ totalCount }} case{{ totalCount !== 1 ? 's' : '' }}</p>
        </div>
        <button mat-raised-button color="primary" routerLink="/portal/cases/new">
          <mat-icon>add</mat-icon> New Case
        </button>
      </div>

      <!-- Manager read-only notice -->
      @if (isManager) {
        <div class="flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <mat-icon class="!text-base text-amber-500">visibility</mat-icon>
          You have read-only access to cases outside your team. You can view all cases but can only edit cases assigned to your team.
        </div>
      }

      <!-- Filters -->
      <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
        <mat-card-content class="!pt-4">
          <div class="flex flex-wrap gap-3 items-end">
            <mat-form-field class="flex-1 min-w-[200px]" subscriptSizing="dynamic">
              <mat-label>Search</mat-label>
              <input matInput [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()" placeholder="Search by title, case numberâ€¦">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <mat-form-field class="w-44" subscriptSizing="dynamic">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="statusFilter" (ngModelChange)="applyFilters()">
                <mat-option value="">All</mat-option>
                <mat-option value="open">Open</mat-option>
                <mat-option value="in_progress">In Progress</mat-option>
                <mat-option value="pending">Pending</mat-option>
                <mat-option value="resolved_completed">Resolved</mat-option>
                <mat-option value="resolved_rejected">Rejected</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field class="w-40" subscriptSizing="dynamic">
              <mat-label>Priority</mat-label>
              <mat-select [(ngModel)]="priorityFilter" (ngModelChange)="applyFilters()">
                <mat-option value="">All</mat-option>
                <mat-option value="critical">Critical</mat-option>
                <mat-option value="high">High</mat-option>
                <mat-option value="medium">Medium</mat-option>
                <mat-option value="low">Low</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Case Table -->
      <mat-card class="!rounded-xl !shadow-sm border border-slate-100 overflow-hidden">
        <div class="overflow-x-auto">
          <table mat-table [dataSource]="pagedCases" class="w-full">

            <!-- Case Number -->
            <ng-container matColumnDef="caseNumber">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600 !w-36">Case #</th>
              <td mat-cell *matCellDef="let c">
                <a [routerLink]="['/portal/cases', c.id]"
                   class="font-mono text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-2 py-0.5 rounded">
                  {{ c.id }}
                </a>
              </td>
            </ng-container>

            <!-- Title -->
            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600">Title</th>
              <td mat-cell *matCellDef="let c">
                <div class="flex items-center gap-2 min-w-0">
                  <a [routerLink]="['/portal/cases', c.id]"
                     class="text-slate-800 hover:text-primary-700 font-medium truncate">
                    {{ c.title }}
                  </a>
                  @if (isManager && c.teamId && !currentUserTeamIds.includes(c.teamId)) {
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-600 font-semibold shrink-0"
                          matTooltip="View only â€” outside your team">
                      VIEW
                    </span>
                  }
                </div>
              </td>
            </ng-container>

            <!-- Case Type -->
            <ng-container matColumnDef="caseType">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600">Type</th>
              <td mat-cell *matCellDef="let c">
                <span class="text-xs text-slate-500 font-mono">{{ c.caseTypeName || c.caseTypeId }}</span>
              </td>
            </ng-container>

            <!-- Team -->
            <ng-container matColumnDef="team">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600">Team</th>
              <td mat-cell *matCellDef="let c">
                @if (c.teamId && teamMap[c.teamId]) {
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                        [ngClass]="currentUserTeamIds.includes(c.teamId) ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'">
                    {{ teamMap[c.teamId] }}
                  </span>
                } @else {
                  <span class="text-xs text-slate-300">â€”</span>
                }
              </td>
            </ng-container>

            <!-- Status -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600">Status</th>
              <td mat-cell *matCellDef="let c">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                      [ngClass]="statusBadge(c.status)">
                  {{ statusLabel(c.status) }}
                </span>
              </td>
            </ng-container>

            <!-- Priority -->
            <ng-container matColumnDef="priority">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600">Priority</th>
              <td mat-cell *matCellDef="let c">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                      [ngClass]="priorityBadge(c.priority)">
                  {{ c.priority }}
                </span>
              </td>
            </ng-container>

            <!-- Stage -->
            <ng-container matColumnDef="stage">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600">Stage</th>
              <td mat-cell *matCellDef="let c">
                <span class="text-sm text-slate-600">
                  {{ c.stages[c.currentStageIndex]?.name || 'N/A' }}
                </span>
              </td>
            </ng-container>

            <!-- SLA -->
            <ng-container matColumnDef="sla">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600">SLA</th>
              <td mat-cell *matCellDef="let c">
                @if (c.slaTargetDate) {
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1"
                        [ngClass]="slaBadge(c)"
                        [matTooltip]="'Due: ' + (c.slaTargetDate | date:'medium')">
                    @if (c.slaDaysRemaining != null && c.slaDaysRemaining < 0) {
                      {{ -c.slaDaysRemaining }}d overdue
                    } @else if (c.slaDaysRemaining != null && c.slaDaysRemaining === 0) {
                      Due today
                    } @else if (c.slaDaysRemaining != null) {
                      {{ c.slaDaysRemaining }}d left
                    } @else {
                      {{ c.slaTargetDate | date:'shortDate' }}
                    }
                  </span>
                } @else {
                  <span class="text-xs text-slate-300">â€”</span>
                }
              </td>
            </ng-container>

            <!-- Created -->
            <ng-container matColumnDef="created">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600">Created</th>
              <td mat-cell *matCellDef="let c">
                <span class="text-sm text-slate-500">{{ c.createdAt | date:'MMM d, y' }}</span>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns"
                class="hover:bg-slate-50 cursor-pointer"
                [routerLink]="['/portal/cases', row.id]"></tr>
          </table>
        </div>

        @if (filteredCases.length === 0) {
          <div class="text-center py-12 text-slate-400">
            <mat-icon class="!text-5xl mb-2">search_off</mat-icon>
            <p>No cases match your filters</p>
          </div>
        }

        <mat-paginator
          [length]="filteredCases.length"
          [pageSize]="pageSize"
          [pageSizeOptions]="[10, 25, 50]"
          showFirstLastButtons
          (page)="onPageChange($event)"
        ></mat-paginator>
      </mat-card>
    </div>
  `,
})
export class PortalCaseListComponent implements OnInit {
  allCases: CaseInstance[] = [];
  filteredCases: CaseInstance[] = [];
  pagedCases: CaseInstance[] = [];
  displayedColumns = ['caseNumber', 'title', 'caseType', 'team', 'status', 'priority', 'stage', 'sla', 'created'];
  searchTerm = '';
  statusFilter = '';
  statusLabel = statusLabel;
  priorityFilter = '';
  pageSize = 25;
  pageIndex = 0;
  teamMap: Record<string, string> = {};
  isManager = false;
  currentUserTeamIds: string[] = [];

  get totalCount(): number { return this.filteredCases.length; }
  caseCount$: Observable<number> = this.store.select(selectCaseInstanceCount);

  constructor(private store: Store, private dataService: DataService) {}

  ngOnInit(): void {
    this.store.dispatch(CasesActions.loadCaseInstances({}));
    this.store.select(selectCaseInstances).subscribe((cases) => {
      this.allCases = cases;
      this.applyFilters();
    });
    this.dataService.getTeams().subscribe(teams => {
      this.teamMap = {};
      teams.forEach(t => this.teamMap[t.id] = t.name);
    });
    this.store.select(selectUser).subscribe(user => {
      if (user) {
        this.isManager = user.role === 'MANAGER';
        this.currentUserTeamIds = user.teamIds || [];
      }
    });
  }

  applyFilters(): void {
    let result = [...this.allCases];
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(
        (c) => c.title.toLowerCase().includes(term) || c.id.toLowerCase().includes(term)
      );
    }
    if (this.statusFilter) {
      result = result.filter((c) => c.status === this.statusFilter);
    }
    if (this.priorityFilter) {
      result = result.filter((c) => c.priority === this.priorityFilter);
    }
    this.filteredCases = result;
    this.pageIndex = 0;
    this.updatePage();
  }

  updatePage(): void {
    const start = this.pageIndex * this.pageSize;
    this.pagedCases = this.filteredCases.slice(start, start + this.pageSize);
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.updatePage();
  }

  statusBadge(status: string): string {
    return ({
      open: 'bg-primary-100 text-primary-700',
      in_progress: 'bg-amber-100 text-amber-700',
      pending: 'bg-blue-100 text-blue-700',
      resolved_completed: 'bg-green-100 text-green-700',
      resolved_cancelled: 'bg-slate-100 text-slate-600',
      resolved_rejected: 'bg-red-100 text-red-700',
      withdrawn: 'bg-red-100 text-red-600',
    } as Record<string,string>)[status] || 'bg-slate-100 text-slate-600';
  }

  priorityBadge(priority: string): string {
    return ({
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-green-100 text-green-700',
    } as Record<string,string>)[priority] || 'bg-slate-100 text-slate-600';
  }

  slaBadge(c: CaseInstance): string {
    if (c.slaDaysRemaining != null && c.slaDaysRemaining < 0) return 'bg-red-100 text-red-700';
    if (c.slaDaysRemaining != null && c.slaDaysRemaining <= 2) return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  }
}
