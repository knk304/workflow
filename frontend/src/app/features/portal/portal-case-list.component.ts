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
import { CaseInstance } from '@core/models';
import * as CasesActions from '@state/cases/cases.actions';
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
          <p class="text-sm text-slate-500">{{ (caseCount$ | async) || 0 }} total cases</p>
        </div>
        <button mat-raised-button color="primary" routerLink="/portal/cases/new">
          <mat-icon>add</mat-icon> New Case
        </button>
      </div>

      <!-- Filters -->
      <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
        <mat-card-content class="!pt-4">
          <div class="flex flex-wrap gap-3 items-end">
            <mat-form-field class="flex-1 min-w-[200px]">
              <mat-label>Search</mat-label>
              <input matInput [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()" placeholder="Search cases...">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>
            <mat-form-field class="w-40">
              <mat-label>Status</mat-label>
              <mat-select [(ngModel)]="statusFilter" (ngModelChange)="applyFilters()">
                <mat-option value="">All</mat-option>
                <mat-option value="open">Open</mat-option>
                <mat-option value="in_progress">In Progress</mat-option>
                <mat-option value="resolved">Resolved</mat-option>
                <mat-option value="closed">Closed</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field class="w-40">
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
          <table mat-table [dataSource]="filteredCases" class="w-full">
            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600">Title</th>
              <td mat-cell *matCellDef="let c">
                <a [routerLink]="['/portal/cases', c.id]"
                   class="text-blue-600 hover:text-blue-800 font-medium">{{ c.title }}</a>
              </td>
            </ng-container>

            <ng-container matColumnDef="caseType">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600">Type</th>
              <td mat-cell *matCellDef="let c">
                <span class="text-sm text-slate-600">{{ c.caseTypeId }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600">Status</th>
              <td mat-cell *matCellDef="let c">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                      [ngClass]="statusBadge(c.status)">
                  {{ c.status }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="priority">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600">Priority</th>
              <td mat-cell *matCellDef="let c">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                      [ngClass]="priorityBadge(c.priority)">
                  {{ c.priority }}
                </span>
              </td>
            </ng-container>

            <ng-container matColumnDef="stage">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600">Stage</th>
              <td mat-cell *matCellDef="let c">
                <span class="text-sm text-slate-600">
                  {{ c.stages[c.currentStageIndex]?.name || 'N/A' }}
                </span>
              </td>
            </ng-container>

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
                  <span class="text-xs text-slate-300">—</span>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="created">
              <th mat-header-cell *matHeaderCellDef class="!font-semibold !text-slate-600">Created</th>
              <td mat-cell *matCellDef="let c">
                <span class="text-sm text-slate-500">{{ c.createdAt | date:'shortDate' }}</span>
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
  displayedColumns = ['title', 'caseType', 'status', 'priority', 'stage', 'sla', 'created'];
  searchTerm = '';
  statusFilter = '';
  priorityFilter = '';
  pageSize = 25;
  caseCount$: Observable<number> = this.store.select(selectCaseInstanceCount);

  constructor(private store: Store) {}

  ngOnInit(): void {
    this.store.dispatch(CasesActions.loadCaseInstances({}));
    this.store.select(selectCaseInstances).subscribe((cases) => {
      this.allCases = cases;
      this.applyFilters();
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
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
  }

  statusBadge(status: string): string {
    return {
      open: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-amber-100 text-amber-700',
      resolved: 'bg-green-100 text-green-700',
      closed: 'bg-slate-100 text-slate-600',
      withdrawn: 'bg-red-100 text-red-600',
    }[status] || 'bg-slate-100 text-slate-600';
  }

  priorityBadge(priority: string): string {
    return {
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-green-100 text-green-700',
    }[priority] || 'bg-slate-100 text-slate-600';
  }

  slaBadge(c: CaseInstance): string {
    if (c.slaDaysRemaining != null && c.slaDaysRemaining < 0) return 'bg-red-100 text-red-700';
    if (c.slaDaysRemaining != null && c.slaDaysRemaining <= 2) return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  }
}
