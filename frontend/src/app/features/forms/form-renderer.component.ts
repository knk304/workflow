import { Component, Input, OnInit, OnChanges, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidatorFn } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormDefinition, FormField, FormSection } from '../../core/models';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-form-renderer',
  standalone: true,
  imports: [
    CommonModule,
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
    MatDividerModule,
    MatProgressBarModule,
  ],
  template: `
    @if (formDefinition) {
      <mat-card>
        <mat-card-header>
          <mat-card-title>{{ formDefinition.name }}</mat-card-title>
          @if (formDefinition.description) {
            <mat-card-subtitle>{{ formDefinition.description }}</mat-card-subtitle>
          }
        </mat-card-header>
        <mat-card-content class="p-6">
          <form [formGroup]="form" (ngSubmit)="onSubmit()">
            @for (section of orderedSections(); track section.id) {
              <div class="mb-6">
                <h3 class="text-lg font-semibold mb-3 text-gray-700">{{ section.title }}</h3>
                <mat-divider class="mb-4"></mat-divider>
                @for (field of getSectionFields(section.id); track field.id) {
                  @if (isFieldVisible(field)) {
                    <div class="mb-4">
                      @switch (field.type) {
                        @case ('text') {
                          <mat-form-field appearance="outline" class="w-full">
                            <mat-label>{{ field.label }}</mat-label>
                            <input matInput [formControlName]="field.id"
                                   [placeholder]="field.placeholder || ''">
                            @if (form.get(field.id)?.hasError('required')) {
                              <mat-error>{{ field.label }} is required</mat-error>
                            }
                            @if (form.get(field.id)?.hasError('minlength')) {
                              <mat-error>Minimum {{ field.validation.minLength }} characters</mat-error>
                            }
                            @if (form.get(field.id)?.hasError('maxlength')) {
                              <mat-error>Maximum {{ field.validation.maxLength }} characters</mat-error>
                            }
                            @if (form.get(field.id)?.hasError('pattern')) {
                              <mat-error>Invalid format</mat-error>
                            }
                          </mat-form-field>
                        }
                        @case ('textarea') {
                          <mat-form-field appearance="outline" class="w-full">
                            <mat-label>{{ field.label }}</mat-label>
                            <textarea matInput [formControlName]="field.id"
                                      [placeholder]="field.placeholder || ''" rows="3"></textarea>
                            @if (form.get(field.id)?.hasError('required')) {
                              <mat-error>{{ field.label }} is required</mat-error>
                            }
                          </mat-form-field>
                        }
                        @case ('number') {
                          <mat-form-field appearance="outline" class="w-full">
                            <mat-label>{{ field.label }}</mat-label>
                            <input matInput type="number" [formControlName]="field.id"
                                   [placeholder]="field.placeholder || ''">
                            @if (form.get(field.id)?.hasError('required')) {
                              <mat-error>{{ field.label }} is required</mat-error>
                            }
                            @if (form.get(field.id)?.hasError('min')) {
                              <mat-error>Minimum value is {{ field.validation.minValue }}</mat-error>
                            }
                            @if (form.get(field.id)?.hasError('max')) {
                              <mat-error>Maximum value is {{ field.validation.maxValue }}</mat-error>
                            }
                          </mat-form-field>
                        }
                        @case ('date') {
                          <mat-form-field appearance="outline" class="w-full">
                            <mat-label>{{ field.label }}</mat-label>
                            <input matInput type="date" [formControlName]="field.id">
                            @if (form.get(field.id)?.hasError('required')) {
                              <mat-error>{{ field.label }} is required</mat-error>
                            }
                          </mat-form-field>
                        }
                        @case ('select') {
                          <mat-form-field appearance="outline" class="w-full">
                            <mat-label>{{ field.label }}</mat-label>
                            <mat-select [formControlName]="field.id">
                              @for (opt of field.validation.options || []; track opt) {
                                <mat-option [value]="opt">{{ opt }}</mat-option>
                              }
                            </mat-select>
                            @if (form.get(field.id)?.hasError('required')) {
                              <mat-error>{{ field.label }} is required</mat-error>
                            }
                          </mat-form-field>
                        }
                        @case ('checkbox') {
                          <mat-checkbox [formControlName]="field.id">
                            {{ field.label }}
                          </mat-checkbox>
                        }
                        @case ('radio') {
                          <div class="mb-2">
                            <label class="block text-sm font-medium text-gray-700 mb-2">{{ field.label }}</label>
                            <div class="flex flex-wrap gap-4">
                              @for (opt of field.validation.options || []; track opt) {
                                <label class="flex items-center gap-2 cursor-pointer">
                                  <input type="radio" [formControlName]="field.id" [value]="opt"
                                         class="text-blue-600">
                                  <span class="text-sm">{{ opt }}</span>
                                </label>
                              }
                            </div>
                            @if (form.get(field.id)?.hasError('required') && form.get(field.id)?.touched) {
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
                                          file:bg-blue-50 file:text-blue-700
                                          hover:file:bg-blue-100">
                          </div>
                        }
                      }
                    </div>
                  }
                }
              </div>
            }

            <!-- Fields without a section -->
            @for (field of getUnsectionedFields(); track field.id) {
              @if (isFieldVisible(field)) {
                <div class="mb-4">
                  @switch (field.type) {
                    @case ('text') {
                      <mat-form-field appearance="outline" class="w-full">
                        <mat-label>{{ field.label }}</mat-label>
                        <input matInput [formControlName]="field.id"
                               [placeholder]="field.placeholder || ''">
                        @if (form.get(field.id)?.hasError('required')) {
                          <mat-error>{{ field.label }} is required</mat-error>
                        }
                      </mat-form-field>
                    }
                    @case ('textarea') {
                      <mat-form-field appearance="outline" class="w-full">
                        <mat-label>{{ field.label }}</mat-label>
                        <textarea matInput [formControlName]="field.id"
                                  [placeholder]="field.placeholder || ''" rows="3"></textarea>
                      </mat-form-field>
                    }
                    @case ('number') {
                      <mat-form-field appearance="outline" class="w-full">
                        <mat-label>{{ field.label }}</mat-label>
                        <input matInput type="number" [formControlName]="field.id"
                               [placeholder]="field.placeholder || ''">
                      </mat-form-field>
                    }
                    @case ('date') {
                      <mat-form-field appearance="outline" class="w-full">
                        <mat-label>{{ field.label }}</mat-label>
                        <input matInput type="date" [formControlName]="field.id">
                      </mat-form-field>
                    }
                    @case ('select') {
                      <mat-form-field appearance="outline" class="w-full">
                        <mat-label>{{ field.label }}</mat-label>
                        <mat-select [formControlName]="field.id">
                          @for (opt of field.validation.options || []; track opt) {
                            <mat-option [value]="opt">{{ opt }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    }
                    @case ('checkbox') {
                      <mat-checkbox [formControlName]="field.id">{{ field.label }}</mat-checkbox>
                    }
                    @case ('radio') {
                      <div class="mb-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">{{ field.label }}</label>
                        <div class="flex flex-wrap gap-4">
                          @for (opt of field.validation.options || []; track opt) {
                            <label class="flex items-center gap-2 cursor-pointer">
                              <input type="radio" [formControlName]="field.id" [value]="opt">
                              <span class="text-sm">{{ opt }}</span>
                            </label>
                          }
                        </div>
                      </div>
                    }
                    @case ('file') {
                      <div class="mb-2">
                        <label class="block text-sm font-medium text-gray-700 mb-2">{{ field.label }}</label>
                        <input type="file" (change)="onFileSelected(field.id, $event)"
                               class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700">
                      </div>
                    }
                  }
                </div>
              }
            }

            @if (submitting()) {
              <mat-progress-bar mode="indeterminate" class="mb-4"></mat-progress-bar>
            }

            <div class="flex justify-end gap-3 mt-6">
              <button mat-raised-button color="primary" type="submit"
                      [disabled]="submitting()">
                <mat-icon>send</mat-icon> Submit
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    } @else {
      <div class="text-center py-12 text-gray-400">
        <mat-icon class="!text-5xl !w-12 !h-12 mb-3">dynamic_form</mat-icon>
        <p>No form definition provided</p>
      </div>
    }
  `,
})
export class FormRendererComponent implements OnInit, OnChanges {
  @Input() formDefinition: FormDefinition | null = null;
  @Input() caseId = '';
  @Input() initialData: Record<string, any> = {};
  @Input() userRole = '';

  form: FormGroup = this.fb.group({});
  submitting = signal(false);
  fileValues: Record<string, File> = {};

  orderedSections = computed(() => {
    if (!this.formDefinition) return [];
    return [...this.formDefinition.sections].sort((a, b) => a.order - b.order);
  });

  constructor(
    private fb: FormBuilder,
    private dataService: DataService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.buildForm();
  }

  ngOnChanges(): void {
    this.buildForm();
  }

  private buildForm(): void {
    if (!this.formDefinition) return;

    const group: Record<string, any> = {};
    const sortedFields = [...this.formDefinition.fields].sort((a, b) => a.order - b.order);

    for (const field of sortedFields) {
      const validators: ValidatorFn[] = [];
      const v = field.validation;

      if (v.required) validators.push(Validators.required);
      if (v.minLength) validators.push(Validators.minLength(v.minLength));
      if (v.maxLength) validators.push(Validators.maxLength(v.maxLength));
      if (v.pattern) validators.push(Validators.pattern(v.pattern));
      if (v.minValue != null) validators.push(Validators.min(v.minValue));
      if (v.maxValue != null) validators.push(Validators.max(v.maxValue));

      const defaultVal = this.initialData[field.id] ?? field.defaultValue ?? (field.type === 'checkbox' ? false : '');
      group[field.id] = [defaultVal, validators];

      // Field role-based disabling is handled below
    }

    this.form = this.fb.group(group);

    // Disable role-restricted fields
    for (const field of sortedFields) {
      if (field.editableRoles?.length && !field.editableRoles.includes(this.userRole)) {
        this.form.get(field.id)?.disable();
      }
    }
  }

  getSectionFields(sectionId: string): FormField[] {
    if (!this.formDefinition) return [];
    return this.formDefinition.fields
      .filter(f => f.section === sectionId)
      .sort((a, b) => a.order - b.order);
  }

  getUnsectionedFields(): FormField[] {
    if (!this.formDefinition) return [];
    const sectionIds = new Set(this.formDefinition.sections.map(s => s.id));
    return this.formDefinition.fields
      .filter(f => !sectionIds.has(f.section))
      .sort((a, b) => a.order - b.order);
  }

  isFieldVisible(field: FormField): boolean {
    if (!field.visibleWhen || Object.keys(field.visibleWhen).length === 0) return true;
    const formValues = this.form.getRawValue();
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

  onSubmit(): void {
    if (!this.formDefinition) return;

    // Check visibility-aware validation
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.snackBar.open('Please fix validation errors before submitting', 'OK', { duration: 3000 });
      return;
    }

    this.submitting.set(true);
    const data = { ...this.form.getRawValue() };

    // Replace file fields with file names
    for (const [fieldId, file] of Object.entries(this.fileValues)) {
      data[fieldId] = file.name;
    }

    this.dataService.submitForm({
      formId: this.formDefinition.id,
      caseId: this.caseId,
      data,
    }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.snackBar.open('Form submitted successfully', 'OK', { duration: 3000 });
      },
      error: () => {
        this.submitting.set(false);
        this.snackBar.open('Failed to submit form', 'OK', { duration: 3000 });
      },
    });
  }
}
