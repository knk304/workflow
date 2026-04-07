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
  ],
  template: `
    <div class="max-w-5xl mx-auto space-y-6 py-2">

      <!-- Header -->
      <div class="flex items-center gap-3">
        <button mat-icon-button routerLink="/portal/cases">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Create New Case</h1>
          <p class="text-sm text-slate-500">Choose a case type to get started</p>
        </div>
      </div>

      <!-- Case Type Widgets -->
      @if (caseTypes.length === 0) {
        <div class="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
          <mat-icon class="!text-4xl text-slate-300 mb-2">category</mat-icon>
          <p class="text-sm text-slate-400">Loading case types...</p>
        </div>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (ct of caseTypes; track ct.id) {
            <div class="group bg-white border border-slate-200 rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary-300 hover:-translate-y-0.5"
                 [class.!border-primary-500.!ring-2.!ring-primary-100.!shadow-md]="selectedCaseType?.id === ct.id"
                 (click)="selectCaseType(ct)">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                     [class]="selectedCaseType?.id === ct.id ? 'bg-primary-500 text-white' : 'bg-primary-50 text-primary-500 group-hover:bg-primary-100'">
                  <mat-icon>{{ ct.icon || 'folder' }}</mat-icon>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <h3 class="text-sm font-bold text-slate-800 truncate">{{ ct.name }}</h3>
                    @if (ct.intakeEnabled) {
                      <span class="shrink-0 text-[9px] px-1.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full font-semibold">INTAKE</span>
                    }
                  </div>
                  <p class="text-xs text-slate-500 mt-1 line-clamp-2">{{ ct.description || 'No description' }}</p>
                </div>
              </div>
              <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span class="text-[10px] text-slate-400 font-medium">{{ ct.stages.length }} stages</span>
                <mat-icon class="!text-sm transition-transform group-hover:translate-x-0.5" [class]="selectedCaseType?.id === ct.id ? 'text-primary-500' : 'text-slate-300'">arrow_forward</mat-icon>
              </div>
            </div>
          }
        </div>
      }

      <!-- Standard Mode: Case Details Form -->
      @if (selectedCaseType) {
        <mat-card class="!rounded-2xl !shadow-sm border border-slate-100">
          <mat-card-content class="!p-6">
            <form [formGroup]="form" (ngSubmit)="onSubmit()">
              <div class="flex items-center gap-2 mb-5">
                <div class="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
                  <mat-icon class="!text-lg text-primary-500">{{ selectedCaseType.icon || 'folder' }}</mat-icon>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-slate-800">{{ selectedCaseType.name }}</h3>
                  <p class="text-[11px] text-slate-400">Fill in case details to create</p>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <mat-form-field class="w-full md:col-span-2">
                  <mat-label>Case Title</mat-label>
                  <input matInput formControlName="title" placeholder="Enter case title">
                  @if (form.get('title')?.hasError('required') && form.get('title')?.touched) {
                    <mat-error>Title is required</mat-error>
                  }
                </mat-form-field>

                <mat-form-field class="w-full md:col-span-2">
                  <mat-label>Description</mat-label>
                  <textarea matInput formControlName="description" rows="3"
                            placeholder="Describe the case..."></textarea>
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
              </div>

              <!-- Error -->
              @if (error$ | async; as error) {
                <div class="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  {{ error }}
                </div>
              }

              <!-- Actions -->
              <div class="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                <button mat-button type="button" (click)="selectedCaseType = null" class="text-slate-500">
                  <mat-icon class="!text-base mr-1">arrow_back</mat-icon> Back
                </button>
                <button mat-raised-button color="primary" type="submit"
                        [disabled]="form.invalid || (isLoading$ | async)">
                  @if (isLoading$ | async) { Creating... } @else { Create Case }
                </button>
              </div>
            </form>
          </mat-card-content>
        </mat-card>
      }
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
    private router: Router,
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
    if (ct.intakeEnabled) {
      this.router.navigate(['/portal/cases/new', ct.id, 'intake']);
      return;
    }
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

    this.store
      .select(selectSelectedCaseInstance)
      .pipe(filter((inst) => inst !== null), take(1))
      .subscribe((inst) => {
        if (inst) this.router.navigate(['/portal/cases', inst.id]);
      });
  }
}