import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';
import { CaseTypeDefinition } from '@core/models';
import * as CaseTypesActions from '@state/case-types/case-types.actions';
import {
  selectAllCaseTypeDefinitions,
  selectCaseTypesLoading,
} from '@state/case-types/case-types.selectors';

@Component({
  selector: 'app-admin-case-type-definitions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Case Type Definitions</h1>
          <p class="text-sm text-gray-500 mt-1">Design case lifecycles with stages, processes, and steps</p>
        </div>
        <button mat-raised-button color="primary" routerLink="/admin/case-types/new/designer">
          <mat-icon>add_circle</mat-icon> New Case Type
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-[#d0e8f7] flex items-center justify-center">
                <mat-icon class="text-[#056DAE]">category</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ definitions.length }}</p>
                <p class="text-xs text-gray-500">Total Definitions</p>
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
                <p class="text-2xl font-bold text-gray-900">{{ activeCount() }}</p>
                <p class="text-xs text-gray-500">Active</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <mat-icon class="text-purple-600">layers</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ totalStages() }}</p>
                <p class="text-xs text-gray-500">Total Stages</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Table -->
      <mat-card class="!shadow-sm">
        <mat-card-header class="!p-4 border-b border-gray-100">
          <mat-card-title class="text-lg">All Case Type Definitions</mat-card-title>
        </mat-card-header>
        <mat-card-content class="!p-0">
          @if (isLoading()) {
            <div class="flex justify-center py-8">
              <mat-spinner diameter="32"></mat-spinner>
            </div>
          } @else if (definitions.length === 0) {
            <div class="text-center py-12 text-gray-500">
              <mat-icon class="!text-5xl !w-12 !h-12 mb-3 text-gray-300">category</mat-icon>
              <p class="font-medium">No case type definitions yet</p>
              <p class="text-sm mt-1">Create your first case type to design its workflow</p>
            </div>
          } @else {
            <table mat-table [dataSource]="definitions" class="w-full">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef class="!pl-4">Case Type</th>
                <td mat-cell *matCellDef="let d" class="!pl-4">
                  <div class="py-2">
                    <a [routerLink]="['/admin/case-types', d.id, 'designer']" class="font-medium text-[#056DAE] hover:underline text-sm">
                      <mat-icon class="!text-base align-middle mr-1">{{ d.icon || 'folder' }}</mat-icon>
                      {{ d.name }}
                    </a>
                    <p class="text-xs text-gray-500">{{ d.description || d.slug }}</p>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="prefix">
                <th mat-header-cell *matHeaderCellDef>Prefix</th>
                <td mat-cell *matCellDef="let d">
                  <span class="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">{{ d.prefix }}-###</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="stages">
                <th mat-header-cell *matHeaderCellDef>Stages</th>
                <td mat-cell *matCellDef="let d">
                  <div class="flex flex-wrap gap-1">
                    @for (stage of d.stages; track stage.id) {
                      <span class="text-xs px-1.5 py-0.5 rounded"
                        [class.bg-blue-100]="stage.stageType === 'primary'"
                        [class.text-blue-700]="stage.stageType === 'primary'"
                        [class.bg-orange-100]="stage.stageType === 'alternate'"
                        [class.text-orange-700]="stage.stageType === 'alternate'">
                        {{ stage.name }}
                      </span>
                    }
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let d">
                  @if (d.isActive) {
                    <span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Active</span>
                  } @else {
                    <span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Inactive</span>
                  }
                </td>
              </ng-container>

              <ng-container matColumnDef="version">
                <th mat-header-cell *matHeaderCellDef>Version</th>
                <td mat-cell *matCellDef="let d">
                  <span class="text-xs text-gray-500">v{{ d.version }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="!text-right !pr-4">Actions</th>
                <td mat-cell *matCellDef="let d" class="!text-right !pr-4">
                  <button mat-icon-button matTooltip="Open Designer" [routerLink]="['/admin/case-types', d.id, 'designer']">
                    <mat-icon class="text-[#056DAE]">edit</mat-icon>
                  </button>
                  <button mat-icon-button matTooltip="Duplicate" (click)="duplicate(d)">
                    <mat-icon class="text-gray-500">content_copy</mat-icon>
                  </button>
                  <button mat-icon-button matTooltip="Delete" (click)="deleteDef(d)">
                    <mat-icon class="text-red-500">delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="hover:bg-gray-50"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class AdminCaseTypeDefinitionsComponent implements OnInit, OnDestroy {
  definitions: CaseTypeDefinition[] = [];
  isLoading = signal(false);
  displayedColumns = ['name', 'prefix', 'stages', 'status', 'version', 'actions'];

  private destroy$ = new Subject<void>();

  constructor(private store: Store, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.store.dispatch(CaseTypesActions.loadCaseTypeDefinitions());

    this.store.select(selectAllCaseTypeDefinitions).pipe(takeUntil(this.destroy$)).subscribe(d => this.definitions = d);
    this.store.select(selectCaseTypesLoading).pipe(takeUntil(this.destroy$)).subscribe(l => this.isLoading.set(l));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  activeCount(): number {
    return this.definitions.filter(d => d.isActive).length;
  }

  totalStages(): number {
    return this.definitions.reduce((sum, d) => sum + d.stages.length, 0);
  }

  duplicate(d: CaseTypeDefinition): void {
    this.store.dispatch(CaseTypesActions.duplicateCaseTypeDefinition({ id: d.id }));
    this.snackBar.open(`Duplicating "${d.name}"...`, '', { duration: 2000 });
  }

  deleteDef(d: CaseTypeDefinition): void {
    if (confirm(`Delete "${d.name}"? This cannot be undone.`)) {
      this.store.dispatch(CaseTypesActions.deleteCaseTypeDefinition({ id: d.id }));
    }
  }
}
