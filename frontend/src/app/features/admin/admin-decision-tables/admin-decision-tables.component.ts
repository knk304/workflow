import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';
import { DecisionTable } from '@core/models';
import * as DTActions from '@state/decision-tables/decision-tables.actions';
import {
  selectAllDecisionTables,
  selectDecisionTablesLoading,
} from '@state/decision-tables/decision-tables.selectors';

@Component({
  selector: 'app-admin-decision-tables',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Decision Tables</h1>
          <p class="text-sm text-gray-500 mt-1">Spreadsheet-style decision logic for routing and automation</p>
        </div>
        <button mat-raised-button color="primary" routerLink="/admin/decision-tables/new">
          <mat-icon>add_circle</mat-icon> New Decision Table
        </button>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <mat-icon class="text-purple-600">table_chart</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ tables.length }}</p>
                <p class="text-xs text-gray-500">Total Tables</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <mat-icon class="text-blue-600">grid_on</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ totalRows() }}</p>
                <p class="text-xs text-gray-500">Total Rows</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Table List -->
      <mat-card class="!shadow-sm">
        <mat-card-header class="!p-4 border-b border-gray-100">
          <mat-card-title class="text-lg">All Decision Tables</mat-card-title>
        </mat-card-header>
        <mat-card-content class="!p-0">
          @if (isLoading()) {
            <div class="flex justify-center py-8">
              <mat-spinner diameter="32"></mat-spinner>
            </div>
          } @else if (tables.length === 0) {
            <div class="text-center py-12 text-gray-500">
              <mat-icon class="!text-5xl !w-12 !h-12 mb-3 text-gray-300">table_chart</mat-icon>
              <p class="font-medium">No decision tables yet</p>
              <p class="text-sm mt-1">Create your first decision table</p>
            </div>
          } @else {
            <table mat-table [dataSource]="tables" class="w-full">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef class="!pl-4">Name</th>
                <td mat-cell *matCellDef="let dt" class="!pl-4">
                  <div class="py-2">
                    <a [routerLink]="['/admin/decision-tables', dt.id]" class="font-medium text-[#056DAE] hover:underline text-sm">{{ dt.name }}</a>
                    <p class="text-xs text-gray-500">{{ dt.description || 'No description' }}</p>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="inputs">
                <th mat-header-cell *matHeaderCellDef>Inputs</th>
                <td mat-cell *matCellDef="let dt">
                  <div class="flex flex-wrap gap-1">
                    @for (inp of dt.inputs; track inp) {
                      <span class="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{{ inp }}</span>
                    }
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="output">
                <th mat-header-cell *matHeaderCellDef>Output</th>
                <td mat-cell *matCellDef="let dt">
                  <span class="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">{{ dt.outputField }}</span>
                </td>
              </ng-container>

              <ng-container matColumnDef="rows">
                <th mat-header-cell *matHeaderCellDef>Rows</th>
                <td mat-cell *matCellDef="let dt">{{ dt.rows.length }}</td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="!text-right !pr-4">Actions</th>
                <td mat-cell *matCellDef="let dt" class="!text-right !pr-4">
                  <button mat-icon-button matTooltip="Edit" [routerLink]="['/admin/decision-tables', dt.id]">
                    <mat-icon class="text-[#056DAE]">edit</mat-icon>
                  </button>
                  <button mat-icon-button matTooltip="Delete" (click)="deleteTable(dt)">
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
export class AdminDecisionTablesComponent implements OnInit, OnDestroy {
  tables: DecisionTable[] = [];
  isLoading = signal(false);
  displayedColumns = ['name', 'inputs', 'output', 'rows', 'actions'];

  private destroy$ = new Subject<void>();

  constructor(private store: Store, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.store.dispatch(DTActions.loadDecisionTables());

    this.store.select(selectAllDecisionTables).pipe(takeUntil(this.destroy$)).subscribe(t => this.tables = t);
    this.store.select(selectDecisionTablesLoading).pipe(takeUntil(this.destroy$)).subscribe(l => this.isLoading.set(l));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  totalRows(): number {
    return this.tables.reduce((sum, t) => sum + t.rows.length, 0);
  }

  deleteTable(dt: DecisionTable): void {
    if (confirm(`Delete "${dt.name}"?`)) {
      this.store.dispatch(DTActions.deleteDecisionTable({ id: dt.id }));
    }
  }
}
