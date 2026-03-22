import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, ValidatorFn } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface DynamicField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'radio' | 'file' | 'grid';
  label: string;
  placeholder?: string;
  defaultValue?: string;
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    minValue?: number;
    maxValue?: number;
    options?: string[];
  };
  gridConfig?: {
    columns: number;
    rows: number;
    cells: (DynamicField | null)[];
  };
  order: number;
  section?: string;
}

@Component({
  selector: 'app-dynamic-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatRadioModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
  ],
  styles: [`
    :host {
      font-size: 13px;
    }
    :host ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      height: 14px;
    }
    :host ::ng-deep .mat-mdc-form-field-bottom-align::before {
      height: 10px;
    }
    :host ::ng-deep textarea.mat-mdc-input-element {
      min-height: 28px;
      font-size: 13px;
    }
  `],
  template: `
    <form [formGroup]="form" class="space-y-1" (ngSubmit)="onSubmit()">
      @for (field of sortedFields; track field.id) {
        @switch (field.type) {
          @case ('text') {
            <mat-form-field class="w-full" subscriptSizing="dynamic">
              <mat-label>{{ field.label }}</mat-label>
              <input matInput [formControlName]="field.id"
                     [placeholder]="field.placeholder || ''">
              @if (form.get(field.id)?.hasError('required') && form.get(field.id)?.touched) {
                <mat-error>{{ field.label }} is required</mat-error>
              }
            </mat-form-field>
          }

          @case ('textarea') {
            <mat-form-field class="w-full" subscriptSizing="dynamic">
              <mat-label>{{ field.label }}</mat-label>
              <textarea matInput [formControlName]="field.id"
                        [placeholder]="field.placeholder || ''"
                        rows="2"></textarea>
              @if (form.get(field.id)?.hasError('required') && form.get(field.id)?.touched) {
                <mat-error>{{ field.label }} is required</mat-error>
              }
            </mat-form-field>
          }

          @case ('number') {
            <mat-form-field class="w-full" subscriptSizing="dynamic">
              <mat-label>{{ field.label }}</mat-label>
              <input matInput type="number" [formControlName]="field.id"
                     [placeholder]="field.placeholder || ''">
              @if (form.get(field.id)?.hasError('required') && form.get(field.id)?.touched) {
                <mat-error>{{ field.label }} is required</mat-error>
              }
              @if (form.get(field.id)?.hasError('min')) {
                <mat-error>Minimum value is {{ field.validation?.minValue }}</mat-error>
              }
              @if (form.get(field.id)?.hasError('max')) {
                <mat-error>Maximum value is {{ field.validation?.maxValue }}</mat-error>
              }
            </mat-form-field>
          }

          @case ('date') {
            <mat-form-field class="w-full" subscriptSizing="dynamic">
              <mat-label>{{ field.label }}</mat-label>
              <input matInput [matDatepicker]="picker" [formControlName]="field.id">
              <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
              @if (form.get(field.id)?.hasError('required') && form.get(field.id)?.touched) {
                <mat-error>{{ field.label }} is required</mat-error>
              }
            </mat-form-field>
          }

          @case ('select') {
            <mat-form-field class="w-full" subscriptSizing="dynamic">
              <mat-label>{{ field.label }}</mat-label>
              <mat-select [formControlName]="field.id">
                @for (opt of field.validation?.options || []; track opt) {
                  <mat-option [value]="opt">{{ opt }}</mat-option>
                }
              </mat-select>
              @if (form.get(field.id)?.hasError('required') && form.get(field.id)?.touched) {
                <mat-error>{{ field.label }} is required</mat-error>
              }
            </mat-form-field>
          }

          @case ('checkbox') {
            <div class="py-1">
              <mat-checkbox [formControlName]="field.id">{{ field.label }}</mat-checkbox>
            </div>
          }

          @case ('radio') {
            <div class="py-1">
              <label class="text-sm text-slate-600 block mb-2">{{ field.label }}</label>
              <mat-radio-group [formControlName]="field.id" class="flex flex-col gap-1">
                @for (opt of field.validation?.options || []; track opt) {
                  <mat-radio-button [value]="opt">{{ opt }}</mat-radio-button>
                }
              </mat-radio-group>
            </div>
          }

          @case ('grid') {
            @if (field.gridConfig) {
              <div class="py-1">
                <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">{{ field.label }}</label>
                <div class="grid gap-2" [style.grid-template-columns]="'repeat(' + field.gridConfig.columns + ', 1fr)'">
                  @for (cell of field.gridConfig.cells; track $index) {
                    <div>
                      @if (cell) {
                        @switch (cell.type) {
                          @case ('textarea') {
                            <mat-form-field class="w-full">
                              <mat-label>{{ cell.label }}</mat-label>
                              <textarea matInput [formControlName]="cell.id" [placeholder]="cell.placeholder || ''" rows="2"></textarea>
                            </mat-form-field>
                          }
                          @case ('number') {
                            <mat-form-field class="w-full">
                              <mat-label>{{ cell.label }}</mat-label>
                              <input matInput type="number" [formControlName]="cell.id" [placeholder]="cell.placeholder || ''">
                            </mat-form-field>
                          }
                          @case ('date') {
                            <mat-form-field class="w-full">
                              <mat-label>{{ cell.label }}</mat-label>
                              <input matInput [matDatepicker]="cellPicker" [formControlName]="cell.id">
                              <mat-datepicker-toggle matIconSuffix [for]="cellPicker"></mat-datepicker-toggle>
                              <mat-datepicker #cellPicker></mat-datepicker>
                            </mat-form-field>
                          }
                          @case ('select') {
                            <mat-form-field class="w-full">
                              <mat-label>{{ cell.label }}</mat-label>
                              <mat-select [formControlName]="cell.id">
                                @for (opt of cell.validation?.options || []; track opt) {
                                  <mat-option [value]="opt">{{ opt }}</mat-option>
                                }
                              </mat-select>
                            </mat-form-field>
                          }
                          @case ('checkbox') {
                            <mat-checkbox [formControlName]="cell.id">{{ cell.label }}</mat-checkbox>
                          }
                          @default {
                            <mat-form-field class="w-full">
                              <mat-label>{{ cell.label }}</mat-label>
                              <input matInput [formControlName]="cell.id" [placeholder]="cell.placeholder || ''">
                            </mat-form-field>
                          }
                        }
                      }
                    </div>
                  }
                </div>
              </div>
            }
          }
        }
      }

      @if (!hideSubmit) {
        <button mat-flat-button color="primary" type="submit"
                [disabled]="!form.valid" class="!text-sm">
          <mat-icon class="!text-sm mr-1">check_circle</mat-icon>
          {{ submitLabel }}
        </button>
      }
    </form>
  `,
})
export class DynamicFormComponent implements OnInit, OnChanges {
  @Input() fields: DynamicField[] = [];
  @Input() initialData: Record<string, any> = {};
  @Input() submitLabel = 'Submit';
  @Input() hideSubmit = false;
  @Output() formSubmit = new EventEmitter<Record<string, any>>();
  @Output() formValid = new EventEmitter<boolean>();

  form!: FormGroup;
  sortedFields: DynamicField[] = [];

  private lastFieldsJson = '';

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.buildForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['fields']) {
      const json = JSON.stringify(this.fields);
      if (json !== this.lastFieldsJson) {
        this.buildForm();
      }
    }
  }

  private buildForm(): void {
    this.sortedFields = [...this.fields].sort((a, b) => a.order - b.order);

    const controls: Record<string, any> = {};
    for (const field of this.sortedFields) {
      if (field.type === 'grid' && field.gridConfig) {
        for (const cell of field.gridConfig.cells) {
          if (cell) {
            const cellValidators: ValidatorFn[] = [];
            const cv = cell.validation;
            if (cv?.required) cellValidators.push(Validators.required);
            if (cv?.minLength) cellValidators.push(Validators.minLength(cv.minLength));
            if (cv?.maxLength) cellValidators.push(Validators.maxLength(cv.maxLength));
            if (cv?.pattern) cellValidators.push(Validators.pattern(cv.pattern));
            if (cv?.minValue != null) cellValidators.push(Validators.min(cv.minValue));
            if (cv?.maxValue != null) cellValidators.push(Validators.max(cv.maxValue));
            const cellDefault = this.initialData[cell.id] ?? cell.defaultValue ?? (cell.type === 'checkbox' ? false : '');
            controls[cell.id] = [cellDefault, cellValidators];
          }
        }
        continue;
      }

      const validators: ValidatorFn[] = [];
      const v = field.validation;
      if (v?.required) validators.push(Validators.required);
      if (v?.minLength) validators.push(Validators.minLength(v.minLength));
      if (v?.maxLength) validators.push(Validators.maxLength(v.maxLength));
      if (v?.pattern) validators.push(Validators.pattern(v.pattern));
      if (v?.minValue != null) validators.push(Validators.min(v.minValue));
      if (v?.maxValue != null) validators.push(Validators.max(v.maxValue));

      const defaultVal = this.initialData[field.id] ?? field.defaultValue ?? (field.type === 'checkbox' ? false : '');
      controls[field.id] = [defaultVal, validators];
    }

    this.form = this.fb.group(controls);
    this.form.statusChanges.subscribe(() => this.formValid.emit(this.form.valid));
    this.formValid.emit(this.form.valid);
  }

  onSubmit(): void {
    if (this.form.valid) {
      this.formSubmit.emit(this.form.value);
    } else {
      this.form.markAllAsTouched();
    }
  }

  getValue(): Record<string, any> {
    return this.form.value;
  }

  isValid(): boolean {
    return this.form.valid;
  }
}
