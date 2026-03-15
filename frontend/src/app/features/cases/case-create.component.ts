import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Store } from '@ngrx/store';
import * as CasesActions from '../../state/cases/cases.actions';
import { selectCasesLoading, selectCasesError, selectSelectedCase } from '../../state/cases/cases.selectors';
import { CaseType } from '../../core/models';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-case-create',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSnackBarModule,
    MatStepperModule,
    MatDividerModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="p-6 max-w-4xl mx-auto">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-6">
        <button mat-icon-button routerLink="/cases">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div>
          <h1 class="text-2xl font-bold text-gray-800">Create New Case</h1>
          <p class="text-gray-500 text-sm">Fill in the details to start a new workflow case</p>
        </div>
      </div>

      @if (isLoading$ | async) {
        <mat-progress-bar mode="indeterminate" class="mb-4"></mat-progress-bar>
      }

      <mat-card>
        <mat-card-content class="p-6">
          <mat-stepper [linear]="true" #stepper>
            <!-- Step 1: Case Type & Priority -->
            <mat-step [stepControl]="caseInfoForm">
              <ng-template matStepLabel>Case Information</ng-template>
              <form [formGroup]="caseInfoForm" class="mt-4 space-y-4">
                <mat-form-field class="w-full">
                  <mat-label>Case Type</mat-label>
                  <mat-select formControlName="type" (selectionChange)="onCaseTypeChange($event.value)">
                    @for (ct of caseTypes(); track ct.id) {
                      <mat-option [value]="ct.slug">{{ ct.description }}</mat-option>
                    }
                  </mat-select>
                  @if (caseInfoForm.get('type')?.hasError('required')) {
                    <mat-error>Case type is required</mat-error>
                  }
                </mat-form-field>

                <mat-form-field class="w-full">
                  <mat-label>Priority</mat-label>
                  <mat-select formControlName="priority">
                    <mat-option value="low">Low</mat-option>
                    <mat-option value="medium">Medium</mat-option>
                    <mat-option value="high">High</mat-option>
                    <mat-option value="critical">Critical</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field class="w-full">
                  <mat-label>Notes (optional)</mat-label>
                  <textarea matInput formControlName="notes" rows="3"
                            placeholder="Add any initial notes or context"></textarea>
                </mat-form-field>

                <div class="flex justify-end mt-4">
                  <button mat-raised-button color="primary" matStepperNext
                          [disabled]="caseInfoForm.invalid">
                    Next <mat-icon>arrow_forward</mat-icon>
                  </button>
                </div>
              </form>
            </mat-step>

            <!-- Step 2: Dynamic Fields -->
            <mat-step [stepControl]="fieldsForm">
              <ng-template matStepLabel>Case Details</ng-template>
              <form [formGroup]="fieldsForm" class="mt-4 space-y-4">
                @if (selectedCaseType()) {
                  <p class="text-sm text-gray-500 mb-4">
                    Fill in the details for <strong>{{ selectedCaseType()!.description }}</strong>
                  </p>
                  @for (field of getFieldEntries(); track field.key) {
                    <div>
                      @switch (field.def.type) {
                        @case ('text') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ field.def.label }}</mat-label>
                            <input matInput [formControlName]="field.key"
                                   [placeholder]="field.def.placeholder || ''">
                            @if (fieldsForm.get(field.key)?.hasError('required')) {
                              <mat-error>{{ field.def.label }} is required</mat-error>
                            }
                          </mat-form-field>
                        }
                        @case ('textarea') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ field.def.label }}</mat-label>
                            <textarea matInput [formControlName]="field.key"
                                      [placeholder]="field.def.placeholder || ''" rows="3"></textarea>
                          </mat-form-field>
                        }
                        @case ('number') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ field.def.label }}</mat-label>
                            <input matInput type="number" [formControlName]="field.key"
                                   [placeholder]="field.def.placeholder || ''">
                            @if (fieldsForm.get(field.key)?.hasError('required')) {
                              <mat-error>{{ field.def.label }} is required</mat-error>
                            }
                          </mat-form-field>
                        }
                        @case ('date') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ field.def.label }}</mat-label>
                            <input matInput type="date" [formControlName]="field.key">
                          </mat-form-field>
                        }
                        @case ('select') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ field.def.label }}</mat-label>
                            <mat-select [formControlName]="field.key">
                              @for (opt of field.def.options || []; track opt) {
                                <mat-option [value]="opt">{{ opt }}</mat-option>
                              }
                            </mat-select>
                          </mat-form-field>
                        }
                        @case ('checkbox') {
                          <mat-checkbox [formControlName]="field.key">
                            {{ field.def.label }}
                          </mat-checkbox>
                        }
                        @default {
                          <mat-form-field class="w-full">
                            <mat-label>{{ field.def.label }}</mat-label>
                            <input matInput [formControlName]="field.key"
                                   [placeholder]="field.def.placeholder || ''">
                          </mat-form-field>
                        }
                      }
                    </div>
                  }
                } @else {
                  <p class="text-gray-400 text-center py-6">Select a case type first</p>
                }

                <div class="flex justify-between mt-4">
                  <button mat-stroked-button matStepperPrevious>
                    <mat-icon>arrow_back</mat-icon> Back
                  </button>
                  <button mat-raised-button color="primary" matStepperNext
                          [disabled]="fieldsForm.invalid">
                    Next <mat-icon>arrow_forward</mat-icon>
                  </button>
                </div>
              </form>
            </mat-step>

            <!-- Step 3: Review & Submit -->
            <mat-step>
              <ng-template matStepLabel>Review & Submit</ng-template>
              <div class="mt-4 space-y-4">
                <h3 class="font-semibold text-gray-700">Review Case Details</h3>
                <mat-divider></mat-divider>

                <div class="grid grid-cols-2 gap-4 text-sm mt-4">
                  <div>
                    <span class="text-gray-400">Type</span>
                    <p class="font-medium">{{ caseInfoForm.get('type')?.value }}</p>
                  </div>
                  <div>
                    <span class="text-gray-400">Priority</span>
                    <p class="font-medium capitalize">{{ caseInfoForm.get('priority')?.value }}</p>
                  </div>
                  @if (caseInfoForm.get('notes')?.value) {
                    <div class="col-span-2">
                      <span class="text-gray-400">Notes</span>
                      <p class="font-medium">{{ caseInfoForm.get('notes')?.value }}</p>
                    </div>
                  }
                </div>

                <mat-divider></mat-divider>

                <div class="grid grid-cols-2 gap-4 text-sm">
                  @for (field of getFieldEntries(); track field.key) {
                    @if (fieldsForm.get(field.key)?.value) {
                      <div>
                        <span class="text-gray-400">{{ field.def.label }}</span>
                        <p class="font-medium">{{ fieldsForm.get(field.key)?.value }}</p>
                      </div>
                    }
                  }
                </div>

                <div class="flex justify-between mt-6">
                  <button mat-stroked-button matStepperPrevious>
                    <mat-icon>arrow_back</mat-icon> Back
                  </button>
                  <button mat-raised-button color="primary" (click)="submitCase()"
                          [disabled]="(isLoading$ | async)">
                    <mat-icon>check</mat-icon> Create Case
                  </button>
                </div>
              </div>
            </mat-step>
          </mat-stepper>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class CaseCreateComponent implements OnInit {
  caseInfoForm: FormGroup;
  fieldsForm: FormGroup;

  caseTypes = signal<CaseType[]>([]);
  selectedCaseType = signal<CaseType | null>(null);

  isLoading$ = this.store.select(selectCasesLoading);

  constructor(
    private fb: FormBuilder,
    private store: Store,
    private dataService: DataService,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {
    this.caseInfoForm = this.fb.group({
      type: ['', Validators.required],
      priority: ['medium', Validators.required],
      notes: [''],
    });
    this.fieldsForm = this.fb.group({});
  }

  ngOnInit(): void {
    this.dataService.getCaseTypes().subscribe(types => {
      this.caseTypes.set(types);
    });

    // Navigate to case detail on successful creation
    this.store.select(selectSelectedCase).subscribe(created => {
      if (created && this.submitting) {
        this.submitting = false;
        this.snackBar.open(`Case ${created.id} created successfully`, 'View', { duration: 4000 })
          .onAction().subscribe(() => this.router.navigate(['/cases', created.id]));
        this.router.navigate(['/cases', created.id]);
      }
    });
  }

  private submitting = false;

  onCaseTypeChange(typeSlug: string): void {
    const ct = this.caseTypes().find(t => t.slug === typeSlug);
    this.selectedCaseType.set(ct || null);
    this.buildFieldsForm(ct);
  }

  private buildFieldsForm(ct: CaseType | undefined): void {
    const group: Record<string, any> = {};
    if (ct) {
      for (const [key, def] of Object.entries(ct.fieldsSchema)) {
        const validators = def.required ? [Validators.required] : [];
        const defaultVal = def.type === 'checkbox' ? false : '';
        group[key] = [defaultVal, validators];
      }
    }
    this.fieldsForm = this.fb.group(group);
  }

  getFieldEntries(): { key: string; def: any }[] {
    const ct = this.selectedCaseType();
    if (!ct) return [];
    return Object.entries(ct.fieldsSchema).map(([key, def]) => ({ key, def }));
  }

  submitCase(): void {
    if (this.caseInfoForm.invalid || this.fieldsForm.invalid) return;

    this.submitting = true;
    const info = this.caseInfoForm.value;
    const fields = this.fieldsForm.value;

    this.store.dispatch(CasesActions.createCase({
      caseData: {
        type: info.type,
        priority: info.priority,
        notes: info.notes || undefined,
        fields,
      },
    }));
  }
}
