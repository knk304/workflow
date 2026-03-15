import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { Workflow, CaseType } from '../../core/models';

@Component({
  selector: 'app-admin-workflows',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    RouterLink,
  ],
  template: `
    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Workflow Management</h1>
          <p class="text-sm text-gray-500 mt-1">Manage workflow definitions and activation status</p>
        </div>
        <a mat-raised-button color="primary" routerLink="/workflows">
          <mat-icon>add</mat-icon>
          Open Designer
        </a>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-[#d0e8f7] flex items-center justify-center">
                <mat-icon class="text-[#056DAE]">account_tree</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ workflows.length }}</p>
                <p class="text-xs text-gray-500">Total Workflows</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <mat-icon class="text-green-600">check_circle</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ activeCount }}</p>
                <p class="text-xs text-gray-500">Active</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <mat-icon class="text-gray-600">pause_circle</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ workflows.length - activeCount }}</p>
                <p class="text-xs text-gray-500">Inactive</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      @if (isLoading) {
        <div class="flex justify-center py-8">
          <mat-spinner diameter="32"></mat-spinner>
        </div>
      } @else if (workflows.length === 0) {
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-12 text-center">
            <mat-icon class="!text-5xl text-gray-300 mb-3">account_tree</mat-icon>
            <p class="text-gray-500 mb-4">No workflows defined yet</p>
            <a mat-raised-button color="primary" routerLink="/workflows">Create First Workflow</a>
          </mat-card-content>
        </mat-card>
      } @else {
        <!-- Workflows Table -->
        <mat-card class="!shadow-sm">
          <mat-card-header class="!p-4 border-b border-gray-100">
            <mat-card-title class="text-lg">All Workflows</mat-card-title>
          </mat-card-header>
          <mat-card-content class="!p-0">
            <table mat-table [dataSource]="dataSource" matSort class="w-full" data-cy="workflows-table">
              <!-- Name -->
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef mat-sort-header class="!pl-4">Name</th>
                <td mat-cell *matCellDef="let wf" class="!pl-4">
                  <div class="flex items-center gap-3 py-2">
                    <div class="w-9 h-9 rounded-lg flex items-center justify-center"
                         [ngClass]="wf.isActive ? 'bg-green-100' : 'bg-gray-100'">
                      <mat-icon [ngClass]="wf.isActive ? 'text-green-600' : 'text-gray-400'" class="!text-xl">account_tree</mat-icon>
                    </div>
                    <div>
                      <p class="font-medium text-gray-900 text-sm">{{ wf.name }}</p>
                      <p class="text-xs text-gray-500 max-w-xs truncate">{{ wf.description }}</p>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Case Type -->
              <ng-container matColumnDef="caseType">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Case Type</th>
                <td mat-cell *matCellDef="let wf">
                  <span class="text-sm text-gray-700">{{ getCaseTypeName(wf.caseTypeId) }}</span>
                </td>
              </ng-container>

              <!-- Version -->
              <ng-container matColumnDef="version">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Version</th>
                <td mat-cell *matCellDef="let wf">
                  <span class="text-xs bg-[#EAF4FB] text-[#003B70] px-2 py-0.5 rounded-full font-medium">
                    v{{ wf.version }}
                  </span>
                </td>
              </ng-container>

              <!-- Nodes -->
              <ng-container matColumnDef="nodes">
                <th mat-header-cell *matHeaderCellDef>Nodes</th>
                <td mat-cell *matCellDef="let wf">
                  <span class="text-sm text-gray-600">{{ wf.definition.nodes.length }}</span>
                </td>
              </ng-container>

              <!-- Status -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Status</th>
                <td mat-cell *matCellDef="let wf">
                  <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                        [ngClass]="wf.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                    {{ wf.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </td>
              </ng-container>

              <!-- Updated -->
              <ng-container matColumnDef="updatedAt">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Updated</th>
                <td mat-cell *matCellDef="let wf">
                  <span class="text-sm text-gray-600">{{ (wf.updatedAt || wf.createdAt) | date:'mediumDate' }}</span>
                </td>
              </ng-container>

              <!-- Actions -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="!text-right !pr-4">Actions</th>
                <td mat-cell *matCellDef="let wf" class="!text-right !pr-4">
                  <a mat-icon-button matTooltip="Open in Designer" routerLink="/workflows" class="text-gray-400 hover:text-[#056DAE]">
                    <mat-icon>edit</mat-icon>
                  </a>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="hover:bg-gray-50"></tr>
            </table>
            <mat-paginator [pageSizeOptions]="[5, 10, 25]" showFirstLastButtons data-cy="workflows-paginator"></mat-paginator>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
})
export class AdminWorkflowsComponent implements OnInit, AfterViewInit {
  workflows: Workflow[] = [];
  caseTypes: CaseType[] = [];
  isLoading = true;
  activeCount = 0;
  displayedColumns = ['name', 'caseType', 'version', 'nodes', 'status', 'updatedAt', 'actions'];
  dataSource = new MatTableDataSource<Workflow>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getWorkflows().subscribe((wfs) => {
      this.workflows = wfs;
      this.activeCount = wfs.filter((w) => w.isActive).length;
      this.dataSource.data = wfs;
      this.isLoading = false;
    });
    this.dataService.getCaseTypes().subscribe((ct) => {
      this.caseTypes = ct;
    });
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  getCaseTypeName(caseTypeId: string): string {
    return this.caseTypes.find((ct) => ct.id === caseTypeId)?.name || caseTypeId;
  }
}
