import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators, ValidatorFn } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';
import * as CasesActions from '../../state/cases/cases.actions';
import { selectCasesLoading, selectCasesError, selectSelectedCase } from '../../state/cases/cases.selectors';
import { CaseType, FormDefinition, FormField, FormSection } from '../../core/models';
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
    MatRadioModule,
    MatSnackBarModule,
    MatStepperModule,
    MatDividerModule,
    MatProgressBarModule,
    MatTooltipModule,
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

            <!-- Step 2: Intake Form / Dynamic Fields -->
            <mat-step [stepControl]="fieldsForm">
              <ng-template matStepLabel>
                {{ intakeFormDef() ? intakeFormDef()!.name : 'Case Details' }}
              </ng-template>
              <form [formGroup]="fieldsForm" class="mt-4 space-y-4">
                @if (loadingForm()) {
                  <div class="flex items-center justify-center py-8">
                    <mat-progress-bar mode="indeterminate" class="w-48"></mat-progress-bar>
                  </div>
                } @else if (intakeFormDef()) {
                  <!-- Intake Form from Form Builder -->
                  <div class="flex items-center gap-2 mb-2">
                    <mat-icon class="text-[#056DAE] !text-lg">dynamic_form</mat-icon>
                    <p class="text-sm text-gray-500">
                      {{ intakeFormDef()!.name }}
                      @if (intakeFormDef()!.description) {
                        â€” {{ intakeFormDef()!.description }}
                      }
                    </p>
                  </div>

                  @for (section of getOrderedSections(); track section.id) {
                    <div class="mb-6">
                      <h3 class="text-md font-semibold mb-3 text-[#003B70]">{{ section.title }}</h3>
                      <mat-divider class="mb-4"></mat-divider>
                      @for (field of getSectionFields(section.id); track field.id) {
                        @if (isFieldVisible(field)) {
                          <ng-container *ngTemplateOutlet="fieldTpl; context: { $implicit: field }"></ng-container>
                        }
                      }
                    </div>
                  }
                  <!-- Unsectioned fields -->
                  @for (field of getUnsectionedFields(); track field.id) {
                    @if (isFieldVisible(field)) {
                      <ng-container *ngTemplateOutlet="fieldTpl; context: { $implicit: field }"></ng-container>
                    }
                  }
                } @else if (selectedCaseType()) {
                  <!-- Fallback: fieldsSchema from CaseType -->
                  <p class="text-sm text-gray-500 mb-4">
                    Fill in the details for <strong>{{ selectedCaseType()!.description }}</strong>
                  </p>
                  @for (entry of getLegacyFieldEntries(); track entry.key) {
                    <div>
                      @switch (entry.def.type) {
                        @case ('text') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ entry.def.label }}</mat-label>
                            <input matInput [formControlName]="entry.key"
                                   [placeholder]="entry.def.placeholder || ''">
                            @if (fieldsForm.get(entry.key)?.hasError('required')) {
                              <mat-error>{{ entry.def.label }} is required</mat-error>
                            }
                          </mat-form-field>
                        }
                        @case ('textarea') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ entry.def.label }}</mat-label>
                            <textarea matInput [formControlName]="entry.key"
                                      [placeholder]="entry.def.placeholder || ''" rows="3"></textarea>
                          </mat-form-field>
                        }
                        @case ('number') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ entry.def.label }}</mat-label>
                            <input matInput type="number" [formControlName]="entry.key"
                                   [placeholder]="entry.def.placeholder || ''">
                            @if (fieldsForm.get(entry.key)?.hasError('required')) {
                              <mat-error>{{ entry.def.label }} is required</mat-error>
                            }
                          </mat-form-field>
                        }
                        @case ('date') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ entry.def.label }}</mat-label>
                            <input matInput type="date" [formControlName]="entry.key">
                          </mat-form-field>
                        }
                        @case ('select') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ entry.def.label }}</mat-label>
                            <mat-select [formControlName]="entry.key">
                              @for (opt of entry.def.options || []; track opt) {
                                <mat-option [value]="opt">{{ opt }}</mat-option>
                              }
                            </mat-select>
                          </mat-form-field>
                        }
                        @case ('checkbox') {
                          <mat-checkbox [formControlName]="entry.key">
                            {{ entry.def.label }}
                          </mat-checkbox>
                        }
                        @default {
                          <mat-form-field class="w-full">
                            <mat-label>{{ entry.def.label }}</mat-label>
                            <input matInput [formControlName]="entry.key"
                                   [placeholder]="entry.def.placeholder || ''">
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
                    <p class="font-medium">{{ selectedCaseType()?.description || caseInfoForm.get('type')?.value }}</p>
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

                @if (intakeFormDef()) {
                  <h4 class="font-semibold text-sm text-[#003B70] flex items-center gap-1">
                    <mat-icon class="!text-base">dynamic_form</mat-icon> {{ intakeFormDef()!.name }}
                  </h4>
                  @for (section of getOrderedSections(); track section.id) {
                    <p class="text-xs font-semibold text-gray-500 uppercase mt-3 mb-1">{{ section.title }}</p>
                    <div class="grid grid-cols-2 gap-4 text-sm">
                      @for (field of getSectionFields(section.id); track field.id) {
                        @if (isFieldVisible(field) && getReviewValue(field.id)) {
                          <div>
                            <span class="text-gray-400">{{ field.label }}</span>
                            <p class="font-medium">{{ getReviewValue(field.id) }}</p>
                          </div>
                        }
                      }
                    </div>
                  }
                  @if (getUnsectionedFields().length) {
                    <div class="grid grid-cols-2 gap-4 text-sm mt-2">
                      @for (field of getUnsectionedFields(); track field.id) {
                        @if (isFieldVisible(field) && getReviewValue(field.id)) {
                          <div>
                            <span class="text-gray-400">{{ field.label }}</span>
                            <p class="font-medium">{{ getReviewValue(field.id) }}</p>
                          </div>
                        }
                      }
                    </div>
                  }
                } @else {
                  <div class="grid grid-cols-2 gap-4 text-sm">
                    @for (entry of getLegacyFieldEntries(); track entry.key) {
                      @if (fieldsForm.get(entry.key)?.value) {
                        <div>
                          <span class="text-gray-400">{{ entry.def.label }}</span>
                          <p class="font-medium">{{ fieldsForm.get(entry.key)?.value }}</p>
                        </div>
                      }
                    }
                  </div>
                }

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

    <!-- Reusable field template for FormDefinition fields -->
    <ng-template #fieldTpl let-field>
      <div class="mb-4">
        @switch (field.type) {
          @case ('text') {
            <mat-form-field class="w-full">
              <mat-label>{{ field.label }}</mat-label>
              <input matInput [formControl]="fc(field.id)"
                     [placeholder]="field.placeholder || ''">
              @if (fieldsForm.get(field.id)?.hasError('required')) {
                <mat-error>{{ field.label }} is required</mat-error>
              }
              @if (fieldsForm.get(field.id)?.hasError('minlength')) {
                <mat-error>Minimum {{ field.validation.minLength }} characters</mat-error>
              }
              @if (fieldsForm.get(field.id)?.hasError('maxlength')) {
                <mat-error>Maximum {{ field.validation.maxLength }} characters</mat-error>
              }
              @if (fieldsForm.get(field.id)?.hasError('pattern')) {
                <mat-error>Invalid format</mat-error>
              }
            </mat-form-field>
          }
          @case ('textarea') {
            <mat-form-field class="w-full">
              <mat-label>{{ field.label }}</mat-label>
              <textarea matInput [formControl]="fc(field.id)"
                        [placeholder]="field.placeholder || ''" rows="3"></textarea>
              @if (fieldsForm.get(field.id)?.hasError('required')) {
                <mat-error>{{ field.label }} is required</mat-error>
              }
            </mat-form-field>
          }
          @case ('number') {
            <mat-form-field class="w-full">
              <mat-label>{{ field.label }}</mat-label>
              <input matInput type="number" [formControl]="fc(field.id)"
                     [placeholder]="field.placeholder || ''">
              @if (fieldsForm.get(field.id)?.hasError('required')) {
                <mat-error>{{ field.label }} is required</mat-error>
              }
              @if (fieldsForm.get(field.id)?.hasError('min')) {
                <mat-error>Minimum value is {{ field.validation.minValue }}</mat-error>
              }
              @if (fieldsForm.get(field.id)?.hasError('max')) {
                <mat-error>Maximum value is {{ field.validation.maxValue }}</mat-error>
              }
            </mat-form-field>
          }
          @case ('date') {
            <mat-form-field class="w-full">
              <mat-label>{{ field.label }}</mat-label>
              <input matInput type="date" [formControl]="fc(field.id)">
              @if (fieldsForm.get(field.id)?.hasError('required')) {
                <mat-error>{{ field.label }} is required</mat-error>
              }
            </mat-form-field>
          }
          @case ('select') {
            <mat-form-field class="w-full">
              <mat-label>{{ field.label }}</mat-label>
              <mat-select [formControl]="fc(field.id)">
                @for (opt of field.validation?.options || []; track opt) {
                  <mat-option [value]="opt">{{ opt }}</mat-option>
                }
              </mat-select>
              @if (fieldsForm.get(field.id)?.hasError('required')) {
                <mat-error>{{ field.label }} is required</mat-error>
              }
            </mat-form-field>
          }
          @case ('checkbox') {
            <mat-checkbox [formControl]="fc(field.id)">
              {{ field.label }}
            </mat-checkbox>
          }
          @case ('radio') {
            <div class="mb-2">
              <label class="block text-sm font-medium text-gray-700 mb-2">{{ field.label }}</label>
              <div class="flex flex-wrap gap-4">
                @for (opt of field.validation?.options || []; track opt) {
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input type="radio" [formControl]="fc(field.id)" [value]="opt"
                           class="text-[#056DAE]">
                    <span class="text-sm">{{ opt }}</span>
                  </label>
                }
              </div>
              @if (fieldsForm.get(field.id)?.hasError('required') && fieldsForm.get(field.id)?.touched) {
                <p class="text-red-500 text-xs mt-1">{{ field.label }} is required</p>
              }
            </div>
          }
          @case ('file') {
            <div class="mb-2">
              <label class="block text-sm font-medium text-gray-700 mb-2">{{ field.label }}</label>
              <input type="file" (change)="onFileSelected(field.id, $event)"
                     class="block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-md file:border-0
                            file:text-sm file:font-semibold
                            file:bg-[#EAF4FB] file:text-[#003B70]
                            hover:file:bg-[#d0e8f7]">
            </div>
          }
          @default {
            <mat-form-field class="w-full">
              <mat-label>{{ field.label }}</mat-label>
              <input matInput [formControl]="fc(field.id)"
                     [placeholder]="field.placeholder || ''">
            </mat-form-field>
          }
        }
      </div>
    </ng-template>
  `,
})
export class CaseCreateComponent implements OnInit, OnDestroy {
  caseInfoForm: FormGroup;
  fieldsForm: FormGroup;

  caseTypes = signal<CaseType[]>([]);
  selectedCaseType = signal<CaseType | null>(null);
  intakeFormDef = signal<FormDefinition | null>(null);
  loadingForm = signal(false);

  isLoading$ = this.store.select(selectCasesLoading);

  private destroy$ = new Subject<void>();
  private submitting = false;
  fileValues: Record<string, File> = {};

  /** Typed helper for template [formControl] bindings */
  fc(fieldId: string): FormControl {
    return this.fieldsForm.get(fieldId) as FormControl;
  }

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
    this.dataService.getCaseTypes().pipe(takeUntil(this.destroy$)).subscribe(types => {
      this.caseTypes.set(types);
    });

    // Navigate to case detail on successful creation
    this.store.select(selectSelectedCase).pipe(takeUntil(this.destroy$)).subscribe(created => {
      if (created && this.submitting) {
        this.submitting = false;

        // Submit intake form record if a form definition was used
        const formDef = this.intakeFormDef();
        if (formDef) {
          this.dataService.submitForm({
            formId: formDef.id,
            caseId: created.id,
            data: this.fieldsForm.getRawValue(),
          }).subscribe();
        }

        this.snackBar.open(`Case ${created.id} created successfully`, 'View', { duration: 4000 })
          .onAction().subscribe(() => this.router.navigate(['/cases', created.id]));
        this.router.navigate(['/cases', created.id]);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onCaseTypeChange(typeSlug: string): void {
    const ct = this.caseTypes().find(t => t.slug === typeSlug);
    this.selectedCaseType.set(ct || null);
    this.intakeFormDef.set(null);
    this.fieldsForm = this.fb.group({});
    this.fileValues = {};

    if (!ct) return;

    // Determine intake stage (first stage in the list)
    const intakeStage = ct.stages?.[0];

    // Strategy 1: Use stageFormMap from workflow (preferred for dynamically created forms)
    const intakeFormId = intakeStage && ct.stageFormMap?.[intakeStage];
    if (intakeFormId) {
      this.loadingForm.set(true);
      this.dataService.getFormDefinitionById(intakeFormId).pipe(takeUntil(this.destroy$)).subscribe({
        next: (form) => {
          if (form) {
            this.intakeFormDef.set(form);
            this.buildFieldsFormFromDefinition(form);
          } else {
            this.buildLegacyFieldsForm(ct);
          }
          this.loadingForm.set(false);
        },
        error: () => {
          this.buildLegacyFieldsForm(ct);
          this.loadingForm.set(false);
        },
      });
      return;
    }

    // Strategy 2: Query by case_type_id + stage (legacy seed data forms)
    this.loadingForm.set(true);
    this.dataService.getFormDefinitions(ct.id, 'intake').pipe(takeUntil(this.destroy$)).subscribe({
      next: (forms) => {
        const intake = forms.find(f => f.isActive !== false);
        if (intake) {
          this.intakeFormDef.set(intake);
          this.buildFieldsFormFromDefinition(intake);
        } else {
          // Fallback to legacy fieldsSchema
          this.buildLegacyFieldsForm(ct);
        }
        this.loadingForm.set(false);
      },
      error: () => {
        // Fallback to legacy fieldsSchema on error
        this.buildLegacyFieldsForm(ct);
        this.loadingForm.set(false);
      },
    });
  }

  // â”€â”€â”€ Form from FormDefinition â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private buildFieldsFormFromDefinition(formDef: FormDefinition): void {
    const group: Record<string, any> = {};
    const sortedFields = [...formDef.fields].sort((a, b) => a.order - b.order);

    for (const field of sortedFields) {
      const validators: ValidatorFn[] = [];
      const v = field.validation || {};

      if (v.required) validators.push(Validators.required);
      if (v.minLength) validators.push(Validators.minLength(v.minLength));
      if (v.maxLength) validators.push(Validators.maxLength(v.maxLength));
      if (v.pattern) validators.push(Validators.pattern(v.pattern));
      if (v.minValue != null) validators.push(Validators.min(v.minValue));
      if (v.maxValue != null) validators.push(Validators.max(v.maxValue));

      const defaultVal = field.defaultValue ?? (field.type === 'checkbox' ? false : '');
      group[field.id] = [defaultVal, validators];
    }

    this.fieldsForm = this.fb.group(group);
  }

  getOrderedSections(): FormSection[] {
    const formDef = this.intakeFormDef();
    if (!formDef) return [];
    return [...formDef.sections].sort((a, b) => a.order - b.order);
  }

  getSectionFields(sectionId: string): FormField[] {
    const formDef = this.intakeFormDef();
    if (!formDef) return [];
    return formDef.fields
      .filter(f => f.section === sectionId)
      .sort((a, b) => a.order - b.order);
  }

  getUnsectionedFields(): FormField[] {
    const formDef = this.intakeFormDef();
    if (!formDef) return [];
    const sectionIds = new Set(formDef.sections.map(s => s.id));
    return formDef.fields
      .filter(f => !sectionIds.has(f.section))
      .sort((a, b) => a.order - b.order);
  }

  isFieldVisible(field: FormField): boolean {
    if (!field.visibleWhen || Object.keys(field.visibleWhen).length === 0) return true;
    const formValues = this.fieldsForm.getRawValue();
    return Object.entries(field.visibleWhen).every(([key, expected]) => {
      const actual = formValues[key];
      if (Array.isArray(expected)) return expected.includes(actual);
      return actual === expected;
    });
  }

  onFileSelected(fieldId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) {
      this.fileValues[fieldId] = input.files[0];
    }
  }

  getReviewValue(fieldId: string): string {
    const val = this.fieldsForm.get(fieldId)?.value;
    if (val === true) return 'Yes';
    if (val === false || val === '' || val == null) return '';
    return String(val);
  }

  // â”€â”€â”€ Legacy fieldsSchema fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private buildLegacyFieldsForm(ct: CaseType): void {
    const group: Record<string, any> = {};
    for (const [key, def] of Object.entries(ct.fieldsSchema)) {
      const validators = def.required ? [Validators.required] : [];
      const defaultVal = def.type === 'checkbox' ? false : '';
      group[key] = [defaultVal, validators];
    }
    this.fieldsForm = this.fb.group(group);
  }

  getLegacyFieldEntries(): { key: string; def: any }[] {
    const ct = this.selectedCaseType();
    if (!ct) return [];
    return Object.entries(ct.fieldsSchema).map(([key, def]) => ({ key, def }));
  }

  // â”€â”€â”€ Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  submitCase(): void {
    if (this.caseInfoForm.invalid || this.fieldsForm.invalid) return;

    this.submitting = true;
    const info = this.caseInfoForm.value;
    const fields = { ...this.fieldsForm.getRawValue() };

    // Replace file fields with file names
    for (const [fieldId, file] of Object.entries(this.fileValues)) {
      fields[fieldId] = file.name;
    }

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
