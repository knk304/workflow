import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { FormField, FormFieldValidation } from '@core/models';

export type StepFormFieldType = FormField['type'];

export interface StepFormBuilderDialogData {
  stepName: string;
  fields: FormField[];
}

@Component({
  selector: 'app-step-form-builder-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatDividerModule, MatTooltipModule,
    MatMenuModule, DragDropModule,
  ],
  template: `
    <div class="flex flex-col h-full" style="width:900px;max-width:95vw;height:80vh;">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3 border-b bg-white shrink-0">
        <div>
          <h2 class="text-base font-semibold text-gray-800 flex items-center gap-2">
            <mat-icon class="text-[#056DAE]">dynamic_form</mat-icon>
            Form Builder — {{ data.stepName || 'Step' }}
          </h2>
          <p class="text-xs text-gray-400 mt-0.5">Design the form fields for this step</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">{{ fields.length }} field{{ fields.length === 1 ? '' : 's' }}</span>
          <button mat-icon-button (click)="dialogRef.close(null)" matTooltip="Cancel">
            <mat-icon>close</mat-icon>
          </button>
        </div>
      </div>

      <!-- Body: two columns -->
      <div class="flex flex-1 min-h-0 overflow-hidden">

        <!-- Left: field list / editor -->
        <div class="flex-1 overflow-y-auto border-r bg-gray-50 p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-700">Fields</h3>
            <button mat-raised-button color="primary" class="!h-8 !text-xs" [matMenuTriggerFor]="addMenu">
              <mat-icon class="!text-sm !w-4 !h-4 mr-1">add</mat-icon> Add Field
            </button>
            <mat-menu #addMenu="matMenu" class="text-sm">
              @for (ft of fieldTypes; track ft.type) {
                <button mat-menu-item (click)="addField(ft.type)">
                  <mat-icon class="!text-base">{{ ft.icon }}</mat-icon>
                  <span>{{ ft.label }}</span>
                </button>
              }
            </mat-menu>
          </div>

          @if (!fields.length) {
            <div class="text-center py-12 text-gray-400">
              <mat-icon class="!text-5xl !w-12 !h-12 mb-3 text-gray-300">text_fields</mat-icon>
              <p class="text-sm">No fields yet</p>
              <p class="text-xs mt-1">Click "Add Field" to start building your form</p>
            </div>
          }

          <div cdkDropList (cdkDropListDropped)="reorderField($event)">
            @for (field of fields; track field.id; let i = $index) {
              <div cdkDrag class="bg-white rounded-lg border shadow-sm mb-3 overflow-hidden"
                   [class.ring-2]="expandedFieldId === field.id"
                   [class.ring-[#056DAE]]="expandedFieldId === field.id">

                <!-- Collapsed header -->
                <div class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50"
                     (click)="toggleField(field.id)">
                  <mat-icon class="!text-sm text-gray-400 cursor-move" cdkDragHandle>drag_indicator</mat-icon>
                  <mat-icon class="!text-sm text-[#056DAE]">{{ fieldIcon(field.type) }}</mat-icon>
                  <span class="text-xs font-medium flex-1 truncate">{{ field.label || 'Untitled Field' }}</span>
                  <span class="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{{ field.type }}</span>
                  @if (field.validation.required) {
                    <span class="text-[10px] text-red-500 font-bold">*</span>
                  }
                  <mat-icon class="!text-sm text-gray-400">{{ expandedFieldId === field.id ? 'expand_less' : 'expand_more' }}</mat-icon>
                </div>

                <!-- Expanded editor -->
                @if (expandedFieldId === field.id) {
                  <div class="px-3 pb-3 space-y-2 border-t bg-slate-50/50">
                    <div class="grid grid-cols-2 gap-2 pt-2">
                      <mat-form-field class="dense-field" subscriptSizing="dynamic">
                        <mat-label>Label</mat-label>
                        <input matInput [(ngModel)]="field.label">
                      </mat-form-field>
                      <mat-form-field class="dense-field" subscriptSizing="dynamic">
                        <mat-label>Type</mat-label>
                        <mat-select [(ngModel)]="field.type" (ngModelChange)="onTypeChange(field)">
                          @for (ft of fieldTypes; track ft.type) {
                            <mat-option [value]="ft.type">{{ ft.label }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    </div>

                    <div class="grid grid-cols-2 gap-2">
                      <mat-form-field class="dense-field" subscriptSizing="dynamic">
                        <mat-label>Placeholder</mat-label>
                        <input matInput [(ngModel)]="field.placeholder">
                      </mat-form-field>
                      <mat-form-field class="dense-field" subscriptSizing="dynamic">
                        <mat-label>Default Value</mat-label>
                        <input matInput [(ngModel)]="field.defaultValue">
                      </mat-form-field>
                    </div>

                    <!-- Options for select / radio -->
                    @if (field.type === 'select' || field.type === 'radio') {
                      <div class="border rounded p-2 bg-white">
                        <div class="flex items-center justify-between mb-1.5">
                          <span class="text-[10px] font-semibold text-gray-500">OPTIONS</span>
                          <button mat-icon-button class="!w-5 !h-5" (click)="addOption(field)">
                            <mat-icon class="!text-xs">add</mat-icon>
                          </button>
                        </div>
                        @for (opt of getOptions(field); track $index; let oi = $index) {
                          <div class="flex items-center gap-1 mb-1">
                            <mat-form-field class="flex-1 dense-field" subscriptSizing="dynamic">
                              <mat-label>Option {{ oi + 1 }}</mat-label>
                              <input matInput [ngModel]="opt" (ngModelChange)="updateOption(field, oi, $event)">
                            </mat-form-field>
                            <button mat-icon-button class="!w-5 !h-5 shrink-0" (click)="removeOption(field, oi)">
                              <mat-icon class="!text-xs text-red-400">close</mat-icon>
                            </button>
                          </div>
                        }
                        @if (!getOptions(field).length) {
                          <p class="text-[10px] text-gray-400 text-center py-1">No options — click + to add</p>
                        }
                      </div>
                    }

                    <!-- Validation -->
                    <div class="border rounded p-2 bg-white">
                      <span class="text-[10px] font-semibold text-gray-500">VALIDATION</span>
                      <div class="flex flex-wrap items-center gap-3 mt-1">
                        <mat-checkbox [(ngModel)]="field.validation.required" class="!text-xs">Required</mat-checkbox>
                      </div>
                      @if (field.type === 'text' || field.type === 'textarea') {
                        <div class="grid grid-cols-2 gap-2 mt-1.5">
                          <mat-form-field class="dense-field" subscriptSizing="dynamic">
                            <mat-label>Min Length</mat-label>
                            <input matInput type="number" [(ngModel)]="field.validation.minLength" min="0">
                          </mat-form-field>
                          <mat-form-field class="dense-field" subscriptSizing="dynamic">
                            <mat-label>Max Length</mat-label>
                            <input matInput type="number" [(ngModel)]="field.validation.maxLength" min="0">
                          </mat-form-field>
                        </div>
                      }
                      @if (field.type === 'number') {
                        <div class="grid grid-cols-2 gap-2 mt-1.5">
                          <mat-form-field class="dense-field" subscriptSizing="dynamic">
                            <mat-label>Min Value</mat-label>
                            <input matInput type="number" [(ngModel)]="field.validation.minValue">
                          </mat-form-field>
                          <mat-form-field class="dense-field" subscriptSizing="dynamic">
                            <mat-label>Max Value</mat-label>
                            <input matInput type="number" [(ngModel)]="field.validation.maxValue">
                          </mat-form-field>
                        </div>
                      }
                      @if (field.type === 'text') {
                        <mat-form-field class="dense-field w-full mt-1.5" subscriptSizing="dynamic">
                          <mat-label>Regex Pattern</mat-label>
                          <input matInput [(ngModel)]="field.validation.pattern" placeholder="e.g. ^[A-Z]+$">
                        </mat-form-field>
                      }
                    </div>

                    <!-- Actions -->
                    <div class="flex justify-end pt-1">
                      <button mat-button color="warn" class="!text-xs !h-7" (click)="removeField(i)">
                        <mat-icon class="!text-sm !w-4 !h-4 mr-1">delete</mat-icon> Remove Field
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>

        <!-- Right: live preview -->
        <div class="overflow-y-auto bg-white p-4" style="width:340px;">
          <h3 class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <mat-icon class="!text-sm text-gray-400">preview</mat-icon> Form Preview
          </h3>

          @if (!fields.length) {
            <p class="text-xs text-gray-400 text-center py-8">Fields will preview here</p>
          }

          @for (field of fields; track field.id) {
            <div class="mb-3">
              <label class="text-xs font-medium text-gray-700 mb-0.5 block">
                {{ field.label }}
                @if (field.validation.required) {
                  <span class="text-red-500">*</span>
                }
              </label>
              @switch (field.type) {
                @case ('text') {
                  <input type="text" disabled [placeholder]="field.placeholder || ''"
                         class="w-full border rounded px-2 py-1.5 text-xs bg-gray-50 text-gray-400">
                }
                @case ('textarea') {
                  <textarea disabled [placeholder]="field.placeholder || ''" rows="2"
                            class="w-full border rounded px-2 py-1.5 text-xs bg-gray-50 text-gray-400"></textarea>
                }
                @case ('number') {
                  <input type="number" disabled [placeholder]="field.placeholder || ''"
                         class="w-full border rounded px-2 py-1.5 text-xs bg-gray-50 text-gray-400">
                }
                @case ('date') {
                  <input type="date" disabled
                         class="w-full border rounded px-2 py-1.5 text-xs bg-gray-50 text-gray-400">
                }
                @case ('select') {
                  <select disabled class="w-full border rounded px-2 py-1.5 text-xs bg-gray-50 text-gray-400">
                    <option>{{ field.placeholder || 'Select...' }}</option>
                    @for (opt of getOptions(field); track $index) {
                      <option>{{ opt }}</option>
                    }
                  </select>
                }
                @case ('radio') {
                  <div class="space-y-1">
                    @for (opt of getOptions(field); track $index) {
                      <label class="flex items-center gap-1.5 text-xs text-gray-600">
                        <input type="radio" disabled [name]="field.id"> {{ opt }}
                      </label>
                    }
                    @if (!getOptions(field).length) {
                      <span class="text-[10px] text-gray-400">No options defined</span>
                    }
                  </div>
                }
                @case ('checkbox') {
                  <label class="flex items-center gap-1.5 text-xs text-gray-600">
                    <input type="checkbox" disabled> {{ field.label }}
                  </label>
                }
                @case ('file') {
                  <div class="border rounded p-2 bg-gray-50 flex items-center gap-2 text-xs text-gray-400">
                    <mat-icon class="!text-sm">attach_file</mat-icon> Choose file...
                  </div>
                }
              }
            </div>
          }
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between px-5 py-3 border-t bg-white shrink-0">
        <button mat-button class="!text-xs" (click)="dialogRef.close(null)">Cancel</button>
        <button mat-raised-button color="primary" class="!text-xs" (click)="save()">
          <mat-icon class="!text-sm !w-4 !h-4 mr-1">save</mat-icon> Apply Fields
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dense-field { font-size: 12px; }
    .dense-field .mat-mdc-form-field-infix { min-height: 32px !important; padding-top: 6px !important; padding-bottom: 6px !important; }
    .dense-field .mat-mdc-floating-label { font-size: 12px; }
    .dense-field input.mat-mdc-input-element,
    .dense-field textarea.mat-mdc-input-element { font-size: 12px; }
    .dense-field .mat-mdc-select-trigger { font-size: 12px; }
  `],
})
export class StepFormBuilderDialogComponent {

  fields: FormField[];
  expandedFieldId: string | null = null;

  fieldTypes: { type: StepFormFieldType; label: string; icon: string }[] = [
    { type: 'text',     label: 'Text',        icon: 'short_text' },
    { type: 'textarea', label: 'Text Area',   icon: 'notes' },
    { type: 'number',   label: 'Number',      icon: 'pin' },
    { type: 'date',     label: 'Date',        icon: 'calendar_today' },
    { type: 'select',   label: 'Dropdown',    icon: 'arrow_drop_down_circle' },
    { type: 'radio',    label: 'Radio',       icon: 'radio_button_checked' },
    { type: 'checkbox', label: 'Checkbox',    icon: 'check_box' },
    { type: 'file',     label: 'File Upload', icon: 'attach_file' },
  ];

  constructor(
    public dialogRef: MatDialogRef<StepFormBuilderDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: StepFormBuilderDialogData,
  ) {
    this.fields = structuredClone(data.fields || []);
  }

  fieldIcon(type: string): string {
    return this.fieldTypes.find(ft => ft.type === type)?.icon || 'text_fields';
  }

  toggleField(id: string): void {
    this.expandedFieldId = this.expandedFieldId === id ? null : id;
  }

  addField(type: StepFormFieldType): void {
    const field: FormField = {
      id: 'ff_' + Math.random().toString(36).substring(2, 8),
      type,
      label: 'New Field',
      placeholder: '',
      defaultValue: '',
      validation: {},
      order: this.fields.length,
      section: '',
    };
    this.fields.push(field);
    this.expandedFieldId = field.id;
  }

  removeField(index: number): void {
    this.fields.splice(index, 1);
    this.expandedFieldId = null;
  }

  reorderField(event: CdkDragDrop<FormField[]>): void {
    moveItemInArray(this.fields, event.previousIndex, event.currentIndex);
    this.fields.forEach((f, i) => f.order = i);
  }

  onTypeChange(field: FormField): void {
    if (field.type !== 'select' && field.type !== 'radio') {
      field.validation = { ...field.validation, options: undefined };
    }
  }

  getOptions(field: FormField): string[] {
    return field.validation?.options || [];
  }

  addOption(field: FormField): void {
    field.validation = field.validation || {};
    field.validation.options = field.validation.options || [];
    field.validation.options.push('Option ' + (field.validation.options.length + 1));
  }

  updateOption(field: FormField, index: number, value: string): void {
    if (field.validation?.options) {
      field.validation.options[index] = value;
    }
  }

  removeOption(field: FormField, index: number): void {
    field.validation?.options?.splice(index, 1);
  }

  save(): void {
    this.fields.forEach((f, i) => f.order = i);
    this.dialogRef.close(this.fields);
  }
}
