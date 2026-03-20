import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { Store } from '@ngrx/store';
import { CaseTypeDefinition } from '@core/models';
import * as CasesActions from '@state/cases/cases.actions';
import {
  selectCaseTypeDefinitions,
  selectCasesLoading,
  selectCasesError,
  selectSelectedCaseInstance,
} from '@state/cases/cases.selectors';
import { filter, take } from 'rxjs/operators';

@Component({
  selector: 'app-portal-case-create',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatStepperModule,
  ],
  template: `
    <div class="max-w-2xl mx-auto space-y-4">
      <!-- Header -->
      <div class="flex items-center gap-3">
        <button mat-icon-button routerLink="/portal/cases">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Create New Case</h1>
          <p class="text-sm text-slate-500">Select a case type and fill in the details</p>
        </div>
      </div>

      <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
        <mat-card-content class="!pt-6">
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            <!-- Step 1: Select Case Type -->
            <div class="mb-6">
              <h3 class="text-sm font-semibold text-slate-700 mb-3">1. Select Case Type</h3>
              @if (caseTypes.length === 0) {
                <div class="text-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  <mat-icon class="!text-3xl mb-1">category</mat-icon>
                  <p class="text-sm">Loading case types...</p>
                </div>
              } @else {
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  @for (ct of caseTypes; track ct.id) {
                    <div class="border rounded-xl p-4 cursor-pointer transition-all"
                         [class]="selectedCaseType?.id === ct.id
                           ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                           : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'"
                         (click)="selectCaseType(ct)">
                      <div class="flex items-center gap-2 mb-1">
                        <mat-icon class="text-blue-600">{{ ct.icon || 'folder' }}</mat-icon>
                        <span class="font-semibold text-sm text-slate-700">{{ ct.name }}</span>
                      </div>
                      <p class="text-xs text-slate-500">{{ ct.description }}</p>
                      <p class="text-[10px] text-slate-400 mt-1">
                        {{ ct.stages.length || 0 }} stages
                      </p>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Step 2: Case Details -->
            @if (selectedCaseType) {
              <div class="mb-6">
                <h3 class="text-sm font-semibold text-slate-700 mb-3">2. Case Details</h3>
                <div class="space-y-4">
                  <mat-form-field appearance="outline" class="w-full">
                    <mat-label>Case Title</mat-label>
                    <input matInput formControlName="title" placeholder="Enter case title">
                    @if (form.get('title')?.hasError('required') && form.get('title')?.touched) {
                      <mat-error>Title is required</mat-error>
                    }
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="w-full">
                    <mat-label>Description</mat-label>
                    <textarea matInput formControlName="description" rows="3"
                              placeholder="Describe the case..."></textarea>
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="w-full">
                    <mat-label>Priority</mat-label>
                    <mat-select formControlName="priority">
                      <mat-option value="low">Low</mat-option>
                      <mat-option value="medium">Medium</mat-option>
                      <mat-option value="high">High</mat-option>
                      <mat-option value="critical">Critical</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>
              </div>

              <!-- Preview -->
              <div class="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-100">
                <h3 class="text-sm font-semibold text-slate-700 mb-2">Preview</h3>
                <div class="text-xs text-slate-500 space-y-1">
                  <p><strong>Type:</strong> {{ selectedCaseType.name }}</p>
                  <p><strong>Stages:</strong>
                    @for (s of selectedCaseType.stages; track s.order; let i = $index) {
                      {{ s.name }}@if (i < selectedCaseType.stages.length - 1) { → }
                    }
                  </p>
                </div>
              </div>
            }

            <!-- Error -->
            @if (error$ | async; as error) {
              <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {{ error }}
              </div>
            }

            <!-- Actions -->
            <div class="flex justify-end gap-3">
              <button mat-button routerLink="/portal/cases">Cancel</button>
              <button mat-raised-button color="primary"
                      type="submit"
                      [disabled]="form.invalid || !selectedCaseType || (isLoading$ | async)">
                @if (isLoading$ | async) {
                  Creating...
                } @else {
                  Create Case
                }
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class PortalCaseCreateComponent implements OnInit {
  form: FormGroup;
  caseTypes: CaseTypeDefinition[] = [];
  selectedCaseType: CaseTypeDefinition | null = null;
  isLoading$ = this.store.select(selectCasesLoading);
  error$ = this.store.select(selectCasesError);

  constructor(
    private fb: FormBuilder,
    private store: Store,
    private router: Router
  ) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      priority: ['medium', Validators.required],
    });
  }

  ngOnInit(): void {
    this.store.dispatch(CasesActions.loadCaseTypeDefinitions());
    this.store.select(selectCaseTypeDefinitions).subscribe((types) => {
      this.caseTypes = types;
    });
  }

  selectCaseType(ct: CaseTypeDefinition): void {
    this.selectedCaseType = ct;
  }

  onSubmit(): void {
    if (this.form.invalid || !this.selectedCaseType) return;

    const { title, description, priority } = this.form.value;
    this.store.dispatch(
      CasesActions.createCaseInstance({
        request: {
          caseTypeId: this.selectedCaseType.id,
          title,
          description,
          priority,
        },
      })
    );

    // Navigate to the new case on success
    this.store
      .select(selectSelectedCaseInstance)
      .pipe(
        filter((inst) => inst !== null && inst.title === title),
        take(1)
      )
      .subscribe((inst) => {
        if (inst) {
          this.router.navigate(['/portal/cases', inst.id]);
        }
      });
  }
}
