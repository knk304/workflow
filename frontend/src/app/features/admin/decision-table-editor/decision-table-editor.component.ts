import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';
import {
  DecisionTable,
  DecisionTableRow,
  DecisionTableEvaluateResponse,
} from '@core/models';
import * as DTActions from '@state/decision-tables/decision-tables.actions';
import {
  selectSelectedDecisionTable,
  selectDecisionTablesLoading,
  selectDecisionTablesError,
  selectDecisionTableTestResult,
} from '@state/decision-tables/decision-tables.selectors';

@Component({
  selector: 'app-decision-table-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatChipsModule,
    MatDividerModule,
  ],
  template: `
    @if (isLoading()) {
      <div class="flex justify-center items-center h-64">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
    } @else if (!dt) {
      <div class="text-center py-20 text-gray-500">
        <mat-icon class="!text-6xl !w-16 !h-16 mb-4 text-gray-300">error_outline</mat-icon>
        <p class="text-lg font-medium">Decision table not found</p>
        <button mat-stroked-button routerLink="/admin/decision-tables" class="mt-4">
          <mat-icon class="mr-1">arrow_back</mat-icon> Back
        </button>
      </div>
    } @else {
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
        <button mat-icon-button matTooltip="Back" routerLink="/admin/decision-tables">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="flex-1 min-w-0">
          <input
            class="text-xl font-bold text-gray-900 bg-transparent border-0 border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full max-w-md transition-colors"
            [(ngModel)]="dt.name"
          />
          <p class="text-xs text-gray-500 mt-0.5">v{{ dt.version }}</p>
        </div>
        <button mat-stroked-button (click)="save()" [disabled]="isSaving()">
          <mat-icon class="mr-1">save</mat-icon> {{ isSaving() ? 'Saving...' : 'Save' }}
        </button>
      </div>

      <!-- Description & Metadata -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <mat-form-field class="w-full" appearance="outline">
          <mat-label>Description</mat-label>
          <textarea matInput [(ngModel)]="dt.description" rows="2"></textarea>
        </mat-form-field>
        <div class="space-y-2">
          <mat-form-field class="w-full" appearance="outline">
            <mat-label>Inputs (comma-separated)</mat-label>
            <input matInput [ngModel]="inputsStr" (ngModelChange)="onInputsChange($event)" placeholder="loan_amount, loan_type">
          </mat-form-field>
          <mat-form-field class="w-full" appearance="outline">
            <mat-label>Output Field</mat-label>
            <input matInput [(ngModel)]="dt.outputField" placeholder="approval_tier">
          </mat-form-field>
        </div>
      </div>

      <!-- Spreadsheet Table -->
      <mat-card class="!shadow-sm mb-6">
        <mat-card-header class="!px-4 !py-3 border-b border-gray-100">
          <mat-card-title class="!text-sm !font-semibold">Decision Rows</mat-card-title>
        </mat-card-header>
        <mat-card-content class="!p-0">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="bg-gray-50 border-b bordr-gray-200">
                  <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-10">#</th>
                  @for (inp of dt.inputs; track inp) {
                    <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600">{{ inp }}</th>
                  }
                  <th class="px-3 py-2 text-left text-xs font-semibold text-blue-600">&#8594; {{ dt.outputField }}</th>
                  <th class="px-3 py-2 text-left text-xs font-semibold text-gray-500 w-12">Pri</th>
                  <th class="px-3 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody>
                @for (row of dt.rows; track $index; let ri = $index) {
                  <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="px-3 py-2 text-gray-400 text-xs">{{ ri + 1 }}</td>
                    @for (inp of dt.inputs; track inp) {
                      <td class="px-1 py-1">
                        <input
                          class="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-blue-400 focus:outline-none"
                          [ngModel]="row.conditions[inp] || ''"
                          (ngModelChange)="row.conditions[inp] = $event"
                          placeholder="—"
                        >
                      </td>
                    }
                    <td class="px-1 py-1">
                      <input
                        class="w-full px-2 py-1 text-sm border border-blue-200 rounded bg-blue-50 focus:border-blue-400 focus:outline-none font-medium"
                        [(ngModel)]="row.output"
                        placeholder="output"
                      >
                    </td>
                    <td class="px-1 py-1">
                      <input
                        class="w-12 px-2 py-1 text-sm text-center border border-gray-200 rounded focus:border-blue-400 focus:outline-none"
                        type="number"
                        [(ngModel)]="row.priority"
                        min="1"
                      >
                    </td>
                    <td class="px-1 py-1 text-center">
                      <button mat-icon-button class="!w-7 !h-7" (click)="removeRow(ri)">
                        <mat-icon class="!text-base text-gray-400 hover:text-red-500">close</mat-icon>
                      </button>
                    </td>
                  </tr>
                }
                <!-- Default row -->
                <tr class="bg-amber-50/50 border-t-2 border-amber-200">
                  <td class="px-3 py-2 text-amber-600 text-xs font-medium">Def</td>
                  @for (inp of dt.inputs; track inp) {
                    <td class="px-3 py-2 text-gray-400 text-xs italic">—</td>
                  }
                  <td class="px-1 py-1">
                    <input
                      class="w-full px-2 py-1 text-sm border border-amber-200 rounded bg-amber-50 focus:border-amber-400 focus:outline-none font-medium"
                      [(ngModel)]="dt.defaultOutput"
                      placeholder="default output"
                    >
                  </td>
                  <td colspan="2"></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="p-3 border-t border-gray-100">
            <button mat-stroked-button (click)="addRow()">
              <mat-icon>add</mat-icon> Add Row
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Test Panel -->
      <mat-card class="!shadow-sm">
        <mat-card-header class="!px-4 !py-3 border-b border-gray-100">
          <mat-card-title class="!text-sm !font-semibold flex items-center gap-2">
            <mat-icon class="!text-lg text-green-600">science</mat-icon>
            Test Decision Table
          </mat-card-title>
        </mat-card-header>
        <mat-card-content class="!p-4">
          <div class="flex flex-wrap gap-3 items-end">
            @for (inp of dt.inputs; track inp) {
              <mat-form-field appearance="outline" class="!w-40">
                <mat-label>{{ inp }}</mat-label>
                <input matInput [(ngModel)]="testInputs[inp]" placeholder="value">
              </mat-form-field>
            }
            <button mat-raised-button color="primary" (click)="runTest()" [disabled]="isTesting()">
              <mat-icon class="mr-1">play_arrow</mat-icon> {{ isTesting() ? 'Testing...' : 'Test' }}
            </button>
          </div>
          @if (testResult) {
            <div class="mt-4 p-3 rounded-lg border"
              [class.border-green-300]="testResult.output"
              [class.bg-green-50]="testResult.output"
              [class.border-gray-300]="!testResult.output"
              [class.bg-gray-50]="!testResult.output">
              <p class="text-sm">
                <strong>Result:</strong>
                @if (testResult.output !== undefined && testResult.output !== null) {
                  <span class="text-green-700 font-medium">{{ testResult.output }}</span> &#9989;
                } @else {
                  <span class="text-gray-500 italic">No match</span>
                }
              </p>
            </div>
          }
        </mat-card-content>
      </mat-card>
    }
  `,
})
export class DecisionTableEditorComponent implements OnInit, OnDestroy {
  dt: DecisionTable | null = null;
  isLoading = signal(false);
  isSaving = signal(false);
  isTesting = signal(false);

  inputsStr = '';
  testInputs: Record<string, any> = {};
  testResult: DecisionTableEvaluateResponse | null = null;

  private destroy$ = new Subject<void>();
  private tableId = '';
  private isNew = false;

  constructor(
    private store: Store,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.tableId = this.route.snapshot.paramMap.get('id') || '';
    this.isNew = this.tableId === 'new';

    if (this.isNew) {
      this.dt = {
        id: '',
        name: 'New Decision Table',
        description: '',
        inputs: ['input1'],
        outputField: 'result',
        rows: [{ conditions: {}, output: '', priority: 1 }],
        defaultOutput: '',
        version: 1,
        createdAt: '',
        updatedAt: '',
      };
      this.inputsStr = this.dt.inputs.join(', ');
    } else {
      this.isLoading.set(true);
      this.store.dispatch(DTActions.loadDecisionTable({ id: this.tableId }));
    }

    this.store.select(selectSelectedDecisionTable).pipe(takeUntil(this.destroy$)).subscribe(dt => {
      if (dt) {
        this.dt = JSON.parse(JSON.stringify(dt));
        this.inputsStr = this.dt!.inputs.join(', ');
        this.isLoading.set(false);
      }
    });

    this.store.select(selectDecisionTableTestResult).pipe(takeUntil(this.destroy$)).subscribe(r => {
      if (r) {
        this.testResult = r;
        this.isTesting.set(false);
      }
    });

    this.store.select(selectDecisionTablesLoading).pipe(takeUntil(this.destroy$)).subscribe(l => this.isLoading.set(l));
    this.store.select(selectDecisionTablesError).pipe(takeUntil(this.destroy$)).subscribe(err => {
      if (err) this.snackBar.open(err, 'Close', { duration: 4000 });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onInputsChange(val: string): void {
    this.inputsStr = val;
    if (this.dt) {
      this.dt.inputs = val.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  addRow(): void {
    if (!this.dt) return;
    this.dt.rows.push({
      conditions: {},
      output: '',
      priority: this.dt.rows.length + 1,
    });
  }

  removeRow(i: number): void {
    if (!this.dt) return;
    this.dt.rows.splice(i, 1);
  }

  save(): void {
    if (!this.dt) return;
    this.isSaving.set(true);

    if (this.isNew) {
      this.store.dispatch(DTActions.createDecisionTable({
        request: {
          name: this.dt.name,
          description: this.dt.description,
          inputs: this.dt.inputs,
          outputField: this.dt.outputField,
          rows: this.dt.rows,
          defaultOutput: this.dt.defaultOutput,
        },
      }));
    } else {
      this.store.dispatch(DTActions.updateDecisionTable({
        id: this.dt.id,
        request: {
          name: this.dt.name,
          description: this.dt.description,
          inputs: this.dt.inputs,
          outputField: this.dt.outputField,
          rows: this.dt.rows,
          defaultOutput: this.dt.defaultOutput,
        },
      }));
    }

    setTimeout(() => this.isSaving.set(false), 1000);
  }

  runTest(): void {
    if (!this.dt?.id) {
      this.snackBar.open('Save the decision table first to test', 'OK', { duration: 3000 });
      return;
    }
    this.isTesting.set(true);
    this.store.dispatch(DTActions.evaluateDecisionTable({
      id: this.dt.id,
      request: { data: this.testInputs },
    }));
  }
}
