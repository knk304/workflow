import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, PageEvent, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { selectCasesList } from '../../state/cases/cases.selectors';
import * as CasesActions from '../../state/cases/cases.actions';
import { Case } from '../../core/models';

@Component({
  selector: 'app-case-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  template: `
    <div class="case-list-container space-y-6 p-6">
      <!-- Header -->
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-4xl font-bold text-gray-800">Cases</h1>
          <p class="text-gray-600 mt-2">Manage and track workflow cases</p>
        </div>
        <button mat-raised-button color="primary">
          <mat-icon>add</mat-icon>
          New Case
        </button>
      </div>

      <!-- Filters -->
      <div class="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <!-- Search -->
          <mat-form-field class="w-full">
            <mat-label>Search</mat-label>
            <input matInput placeholder="Case ID or applicant name" [(ngModel)]="searchTerm" />
            <mat-icon matIconSuffix>search</mat-icon>
          </mat-form-field>

          <!-- Status Filter -->
          <mat-form-field class="w-full">
            <mat-label>Status</mat-label>
            <mat-select [(ngModel)]="statusFilter">
              <mat-option value="">All Statuses</mat-option>
              <mat-option value="open">Open</mat-option>
              <mat-option value="in_progress">In Progress</mat-option>
              <mat-option value="closed">Closed</mat-option>
              <mat-option value="pending_review">Pending Review</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Stage Filter -->
          <mat-form-field class="w-full">
            <mat-label>Stage</mat-label>
            <mat-select [(ngModel)]="stageFilter">
              <mat-option value="">All Stages</mat-option>
              <mat-option value="intake">Intake</mat-option>
              <mat-option value="documents">Documents</mat-option>
              <mat-option value="underwriting">Underwriting</mat-option>
              <mat-option value="approval">Approval</mat-option>
              <mat-option value="disbursement">Disbursement</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Priority Filter -->
          <mat-form-field class="w-full">
            <mat-label>Priority</mat-label>
            <mat-select [(ngModel)]="priorityFilter">
              <mat-option value="">All Priorities</mat-option>
              <mat-option value="critical">Critical</mat-option>
              <mat-option value="high">High</mat-option>
              <mat-option value="medium">Medium</mat-option>
              <mat-option value="low">Low</mat-option>
            </mat-select>
          </mat-form-field>

          <!-- Clear Filters -->
          <div class="flex items-end">
            <button mat-stroked-button class="w-full" (click)="clearFilters()">
              <mat-icon>clear</mat-icon>
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <!-- Active Filters Chips -->
      @if (activeFilterCount > 0) {
        <div class="flex gap-2 flex-wrap">
          @if (statusFilter) {
            <mat-chip-set>
              <mat-chip>
                Status: {{ statusFilter }}
                <button matChipRemove (click)="statusFilter = ''">
                  <mat-icon>close</mat-icon>
                </button>
              </mat-chip>
            </mat-chip-set>
          }
          @if (stageFilter) {
            <mat-chip-set>
              <mat-chip>
                Stage: {{ stageFilter }}
                <button matChipRemove (click)="stageFilter = ''">
                  <mat-icon>close</mat-icon>
                </button>
              </mat-chip>
            </mat-chip-set>
          }
          @if (priorityFilter) {
            <mat-chip-set>
              <mat-chip>
                Priority: {{ priorityFilter }}
                <button matChipRemove (click)="priorityFilter = ''">
                  <mat-icon>close</mat-icon>
                </button>
              </mat-chip>
            </mat-chip-set>
          }
        </div>
      }

      <!-- Cases Table -->
      <div class="bg-white rounded-lg shadow-sm overflow-hidden">
        <table
          mat-table
          [dataSource]="dataSource"
          matSort
          class="w-full"
          (matSortChange)="onSort($event)"
        >
          <!-- ID Column -->
          <ng-container matColumnDef="id">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Case ID</th>
            <td mat-cell *matCellDef="let case">
              <a [routerLink]="['/cases', case.id]" class="text-blue-600 hover:underline">
                {{ case.id }}
              </a>
            </td>
          </ng-container>

          <!-- Type Column -->
          <ng-container matColumnDef="type">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Type</th>
            <td mat-cell *matCellDef="let case">
              {{ case.caseType | uppercase }}
            </td>
          </ng-container>

          <!-- Applicant Column -->
          <ng-container matColumnDef="applicant">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Applicant</th>
            <td mat-cell *matCellDef="let case">
              {{ case.fields['applicantName'] }}
            </td>
          </ng-container>

          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
            <td mat-cell *matCellDef="let case">
              <mat-icon [ngClass]="statusColor(case.status)" class="text-sm">
                {{ statusIcon(case.status) }}
              </mat-icon>
              <span [ngClass]="statusColor(case.status)" class="ml-2 text-xs">
                {{ case.status | uppercase }}
              </span>
            </td>
          </ng-container>

          <!-- Stage Column -->
          <ng-container matColumnDef="stage">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Stage</th>
            <td mat-cell *matCellDef="let case">
              <span class="px-2 py-1 rounded text-xs" [ngClass]="stageClass(case.stage)">
                {{ case.stage | uppercase }}
              </span>
            </td>
          </ng-container>

          <!-- Priority Column -->
          <ng-container matColumnDef="priority">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Priority</th>
            <td mat-cell *matCellDef="let case">
              <mat-icon [ngClass]="priorityColor(case.priority)" class="text-sm">
                {{ priorityIcon(case.priority) }}
              </mat-icon>
              <span [ngClass]="priorityColor(case.priority)" class="ml-1 text-xs">
                {{ case.priority | uppercase }}
              </span>
            </td>
          </ng-container>

          <!-- Owner Column -->
          <ng-container matColumnDef="owner">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Owner</th>
            <td mat-cell *matCellDef="let case">
              {{ case.assignedTo?.name || 'Unassigned' }}
            </td>
          </ng-container>

          <!-- Updated Column -->
          <ng-container matColumnDef="updated">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Updated</th>
            <td mat-cell *matCellDef="let case">
              {{ case.updatedAt | date: 'short' }}
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let case">
              <button mat-icon-button [routerLink]="['/cases', case.id]" matTooltip="View Details">
                <mat-icon>open_in_new</mat-icon>
              </button>
              <button mat-icon-button matTooltip="Edit">
                <mat-icon>edit</mat-icon>
              </button>
            </td>
          </ng-container>

          <!-- Header and Row Defs -->
          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="hover:bg-gray-50 cursor-pointer"></tr>
        </table>

        <!-- Empty State -->
        @if (dataSource.data.length === 0) {
          <div class="p-6 text-center">
            <mat-icon class="text-5xl text-gray-300">cases</mat-icon>
            <p class="text-gray-500 mt-4">No cases found matching your filters</p>
          </div>
        }
      </div>

      <!-- Paginator -->
      <mat-paginator
        #paginator
        [length]="filteredCases.length"
        [pageSize]="pageSize"
        [pageSizeOptions]="[10, 20, 50]"
        (page)="onPageChange($event)"
      ></mat-paginator>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .case-list-container {
      max-width: 1400px;
      margin: 0 auto;
    }

    table {
      width: 100%;
    }

    mat-chip-set {
      display: flex;
      gap: 0.5rem;
    }

    .text-xs {
      font-size: 0.75rem;
    }
  `],
})
export class CaseListComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  displayedColumns = ['id', 'type', 'applicant', 'status', 'stage', 'priority', 'owner', 'updated', 'actions'];
  dataSource = new MatTableDataSource<Case>();
  allCases: Case[] = [];
  filteredCases: Case[] = [];

  searchTerm = '';
  statusFilter = '';
  stageFilter = '';
  priorityFilter = '';
  pageSize = 20;

  get activeFilterCount(): number {
    return [this.statusFilter, this.stageFilter, this.priorityFilter, this.searchTerm].filter(f => f).length;
  }

  constructor(private store: Store) {}

  ngOnInit(): void {
    this.store.select(selectCasesList).subscribe(cases => {
      this.allCases = cases;
      this.applyFilters();
    });
  }

  applyFilters(): void {
    let filtered = this.allCases;

    if (this.searchTerm) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        c =>
          c.id.toLowerCase().includes(search) ||
          c.fields['applicantName'].toLowerCase().includes(search)
      );
    }

    if (this.statusFilter) {
      filtered = filtered.filter(c => c.status === this.statusFilter);
    }

    if (this.stageFilter) {
      filtered = filtered.filter(c => c.stage === this.stageFilter);
    }

    if (this.priorityFilter) {
      filtered = filtered.filter(c => c.priority === this.priorityFilter);
    }

    this.filteredCases = filtered;
    this.dataSource.data = filtered;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.statusFilter = '';
    this.stageFilter = '';
    this.priorityFilter = '';
    this.applyFilters();
  }

  onSort(sort: Sort): void {
    if (!sort.active || sort.direction === '') {
      return;
    }

    this.filteredCases.sort((a: any, b: any) => {
      const aValue = this.getSortValue(a, sort.active);
      const bValue = this.getSortValue(b, sort.active);

      if (aValue < bValue) {
        return sort.direction === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sort.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    this.dataSource.data = this.filteredCases;
  }

  private getSortValue(case_: Case, column: string): any {
    switch (column) {
      case 'id':
        return case_.id;
      case 'type':
        return case_.caseType;
      case 'applicant':
        return case_.fields['applicantName'];
      case 'status':
        return case_.status;
      case 'stage':
        return case_.stage;
      case 'priority':
        return case_.priority;
      case 'owner':
        return case_.assignedTo?.name || '';
      case 'updated':
        return case_.updatedAt;
      default:
        return '';
    }
  }

  onPageChange(event: PageEvent): void {
    const start = event.pageIndex * event.pageSize;
    const end = start + event.pageSize;
    this.dataSource.data = this.filteredCases.slice(start, end);
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
      open: 'folder_open',
      in_progress: 'hourglass_empty',
      closed: 'check_circle',
      pending_review: 'pending_actions',
    };
    return icons[status] || 'circle';
  }

  statusColor(status: string): string {
    const colors: Record<string, string> = {
      open: 'text-blue-600',
      in_progress: 'text-purple-600',
      closed: 'text-green-600',
      pending_review: 'text-orange-600',
    };
    return colors[status] || '';
  }

  stageClass(stage: string): string {
    const classes: Record<string, string> = {
      intake: 'bg-blue-100 text-blue-800',
      documents: 'bg-purple-100 text-purple-800',
      underwriting: 'bg-yellow-100 text-yellow-800',
      approval: 'bg-orange-100 text-orange-800',
      disbursement: 'bg-green-100 text-green-800',
    };
    return classes[stage] || 'bg-gray-100 text-gray-800';
  }
}
