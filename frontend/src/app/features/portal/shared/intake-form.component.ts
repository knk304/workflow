import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { StepDefinition } from '@core/models';

@Component({
  selector: 'app-intake-form',
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
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div>
      <div class="flex items-center gap-2 mb-3">
        <h3 class="text-sm font-semibold text-slate-700">2. {{ stageName }}</h3>
        <span class="text-[10px] px-2 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full font-semibold">INTAKE</span>
      </div>

      @if (loading) {
        <div class="flex items-center justify-center py-10">
          <mat-spinner diameter="32"></mat-spinner>
          <span class="ml-3 text-sm text-slate-500">Loading form...</span>
        </div>
      } @else if (steps.length === 0) {
        <div class="text-center py-6 border-2 border-dashed border-slate-200 rounded-lg">
          <mat-icon class="!text-3xl text-slate-300">warning</mat-icon>
          <p class="text-xs text-slate-400 mt-2">No intake forms configured for Stage 1</p>
          <p class="text-[11px] text-slate-300">Ask an admin to add assignment steps with forms</p>
        </div>
      } @else {
        @for (step of steps; track step.id) {
          <div class="mb-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div class="flex items-center gap-2 mb-3">
              <mat-icon class="!text-base text-primary-500">assignment</mat-icon>
              <span class="text-xs font-semibold text-slate-700">{{ step.name }}</span>
            </div>
            @if (step.config['instructions']) {
              <p class="text-[11px] text-slate-400 mb-3">{{ step.config['instructions'] }}</p>
            }

            <div class="space-y-3" [formGroup]="form">
              @for (field of getStepFormFields(step); track field.label) {
                @switch (field.type) {
                  @case ('text') {
                    <mat-form-field class="w-full" subscriptSizing="dynamic">
                      <mat-label>{{ field.label }}</mat-label>
                      <input matInput [formControlName]="fieldKey(step, field)" [placeholder]="field.placeholder || ''">
                      @if (form.get(fieldKey(step, field))?.hasError('required') && form.get(fieldKey(step, field))?.touched) {
                        <mat-error>{{ field.label }} is required</mat-error>
                      }
                    </mat-form-field>
                  }
                  @case ('email') {
                    <mat-form-field class="w-full" subscriptSizing="dynamic">
                      <mat-label>{{ field.label }}</mat-label>
                      <input matInput type="email" [formControlName]="fieldKey(step, field)" [placeholder]="field.placeholder || ''">
                    </mat-form-field>
                  }
                  @case ('phone') {
                    <mat-form-field class="w-full" subscriptSizing="dynamic">
                      <mat-label>{{ field.label }}</mat-label>
                      <input matInput type="tel" [formControlName]="fieldKey(step, field)" [placeholder]="field.placeholder || ''">
                    </mat-form-field>
                  }
                  @case ('textarea') {
                    <mat-form-field class="w-full" subscriptSizing="dynamic">
                      <mat-label>{{ field.label }}</mat-label>
                      <textarea matInput [formControlName]="fieldKey(step, field)" rows="3" [placeholder]="field.placeholder || ''"></textarea>
                    </mat-form-field>
                  }
                  @case ('number') {
                    <mat-form-field class="w-full" subscriptSizing="dynamic">
                      <mat-label>{{ field.label }}</mat-label>
                      <input matInput type="number" [formControlName]="fieldKey(step, field)" [placeholder]="field.placeholder || ''">
                    </mat-form-field>
                  }
                  @case ('currency') {
                    <mat-form-field class="w-full" subscriptSizing="dynamic">
                      <mat-label>{{ field.label }}</mat-label>
                      <span matPrefix class="text-slate-400 mr-1">$&nbsp;</span>
                      <input matInput type="number" [formControlName]="fieldKey(step, field)" [placeholder]="field.placeholder || ''">
                    </mat-form-field>
                  }
                  @case ('date') {
                    <mat-form-field class="w-full" subscriptSizing="dynamic">
                      <mat-label>{{ field.label }}</mat-label>
                      <input matInput [matDatepicker]="dp" [formControlName]="fieldKey(step, field)">
                      <mat-datepicker-toggle matSuffix [for]="dp"></mat-datepicker-toggle>
                      <mat-datepicker #dp></mat-datepicker>
                    </mat-form-field>
                  }
                  @case ('select') {
                    <mat-form-field class="w-full" subscriptSizing="dynamic">
                      <mat-label>{{ field.label }}</mat-label>
                      <mat-select [formControlName]="fieldKey(step, field)">
                        @for (opt of (field.options || field.validation?.options || []); track opt) {
                          <mat-option [value]="opt">{{ opt }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  }
                  @case ('radio') {
                    <div class="py-1">
                      <label class="text-xs font-medium text-slate-600 block mb-1.5">{{ field.label }}</label>
                      <mat-radio-group [formControlName]="fieldKey(step, field)" class="flex flex-wrap gap-3">
                        @for (opt of (field.options || field.validation?.options || []); track opt) {
                          <mat-radio-button [value]="opt" class="!text-xs">{{ opt }}</mat-radio-button>
                        }
                      </mat-radio-group>
                    </div>
                  }
                  @case ('checkbox') {
                    <mat-checkbox [formControlName]="fieldKey(step, field)" class="!text-xs">
                      {{ field.label }}
                    </mat-checkbox>
                  }
                  @case ('boolean') {
                    <mat-checkbox [formControlName]="fieldKey(step, field)" class="!text-xs">
                      {{ field.label }}
                    </mat-checkbox>
                  }
                  @default {
                    <mat-form-field class="w-full" subscriptSizing="dynamic">
                      <mat-label>{{ field.label }}</mat-label>
                      <input matInput [formControlName]="fieldKey(step, field)" [placeholder]="field.placeholder || ''">
                    </mat-form-field>
                  }
                }
              }
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class IntakeFormComponent {
  @Input() steps: StepDefinition[] = [];
  @Input() stepFieldsMap: Record<string, any[]> = {};
  @Input() form!: FormGroup;
  @Input() stageName: string = 'Intake';
  @Input() loading: boolean = false;

  getStepFormFields(step: StepDefinition): any[] {
    return this.stepFieldsMap[step.id] || step.config?.['formFields'] || [];
  }

  fieldKey(step: StepDefinition, field: any): string {
    return step.id + '__' + (field.label || '').replace(/\s+/g, '_').toLowerCase();
  }
}
