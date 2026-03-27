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
import { MatTabsModule } from '@angular/material/tabs';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  FlowNode, FlowField, FlowFieldType, FlowFieldOption, FlowFieldValidation,
} from '@core/models';

export interface FormEditorDialogData {
  node: FlowNode;
  allNodes: FlowNode[];
}

@Component({
  selector: 'app-flow-node-form-editor',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatDividerModule, MatTooltipModule,
    MatTabsModule, DragDropModule,
  ],
  template: `
    <div class="flex flex-col h-full" style="width:900px;max-width:95vw;height:80vh;">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-3 border-b bg-white shrink-0">
        <div>
          <h2 class="text-base font-semibold text-gray-800 flex items-center gap-2">
            <mat-icon class="text-[#056DAE]">dynamic_form</mat-icon>
            Form Editor - {{ data.node.label }}
          </h2>
          <p class="text-xs text-gray-400 mt-0.5">Design the form fields for this node</p>
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

        <!-- Left: field editor -->
        <div class="flex-1 overflow-y-auto border-r bg-gray-50 p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-gray-700">Fields</h3>
            <button mat-raised-button color="primary" class="!h-8 !text-xs" (click)="addField()">
              <mat-icon class="!text-sm !w-4 !h-4 mr-1">add</mat-icon> Add Field
            </button>
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
                        <mat-select [(ngModel)]="field.type">
                          @for (ft of fieldTypes; track ft.type) {
                            <mat-option [value]="ft.type">{{ ft.label }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>
                    </div>

                    @if (field.type === 'alert') {
                      <!-- Alert-specific editor -->
                      <mat-form-field class="dense-field w-full" subscriptSizing="dynamic">
                        <mat-label>Alert Style</mat-label>
                        <mat-select [(ngModel)]="field.placeholder">
                          <mat-option value="info">Info</mat-option>
                          <mat-option value="success">Success</mat-option>
                          <mat-option value="warning">Warning</mat-option>
                          <mat-option value="error">Error / Danger</mat-option>
                        </mat-select>
                      </mat-form-field>
                      <mat-form-field class="dense-field w-full" subscriptSizing="dynamic">
                        <mat-label>Alert Message</mat-label>
                        <textarea matInput rows="3" [(ngModel)]="field.defaultValue"
                                  placeholder="Enter alert text shown to the worker..."></textarea>
                      </mat-form-field>
                      <!-- Alert preview -->
                      <div class="rounded-lg border px-4 py-3 text-sm flex items-start gap-3"
                           [ngClass]="alertBoxClass(field.placeholder || 'info')">
                        <mat-icon class="!text-lg !w-5 !h-5 shrink-0 mt-0.5"
                                  [ngClass]="alertIconClass(field.placeholder || 'info')">
                          {{ alertIcon(field.placeholder || 'info') }}
                        </mat-icon>
                        <div>
                          <div class="font-semibold text-sm mb-0.5">{{ field.label || 'Alert' }}</div>
                          <div class="text-xs opacity-90">{{ field.defaultValue || 'Alert message...' }}</div>
                        </div>
                      </div>
                    } @else {
                      <!-- Normal field editor -->
                      <div class="grid grid-cols-2 gap-2">
                        <mat-form-field class="dense-field" subscriptSizing="dynamic">
                          <mat-label>Placeholder</mat-label>
                          <input matInput [(ngModel)]="field.placeholder">
                        </mat-form-field>
                        <mat-form-field class="dense-field" subscriptSizing="dynamic">
                          <mat-label>Help Text</mat-label>
                          <input matInput [(ngModel)]="field.helpText">
                        </mat-form-field>
                      </div>
                      <mat-form-field class="dense-field w-full" subscriptSizing="dynamic">
                        <mat-label>Default Value</mat-label>
                        <input matInput [(ngModel)]="field.defaultValue">
                      </mat-form-field>
                    }

                    <!-- Options for select/radio/multi_select -->
                    @if (field.type === 'select' || field.type === 'radio' || field.type === 'multi_select') {
                      <div class="border rounded p-2 bg-white">
                        <div class="flex items-center justify-between mb-1.5">
                          <span class="text-[10px] font-semibold text-gray-500">OPTIONS</span>
                          <button mat-icon-button class="!w-5 !h-5" (click)="addOption(field)">
                            <mat-icon class="!text-xs">add</mat-icon>
                          </button>
                        </div>
                        @for (opt of field.options; track opt.value; let oi = $index) {
                          <div class="flex items-center gap-1 mb-1">
                            <mat-form-field class="flex-1 dense-field" subscriptSizing="dynamic">
                              <mat-label>Label</mat-label>
                              <input matInput [(ngModel)]="opt.label">
                            </mat-form-field>
                            <mat-form-field class="flex-1 dense-field" subscriptSizing="dynamic">
                              <mat-label>Value</mat-label>
                              <input matInput [(ngModel)]="opt.value">
                            </mat-form-field>
                            <button mat-icon-button class="!w-5 !h-5 shrink-0" (click)="removeOption(field, oi)">
                              <mat-icon class="!text-xs text-red-400">close</mat-icon>
                            </button>
                          </div>
                        }
                        @if (!field.options.length) {
                          <p class="text-[10px] text-gray-400 text-center py-1">No options - click + to add</p>
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
                            <input matInput type="number" [(ngModel)]="field.validation.minLength">
                          </mat-form-field>
                          <mat-form-field class="dense-field" subscriptSizing="dynamic">
                            <mat-label>Max Length</mat-label>
                            <input matInput type="number" [(ngModel)]="field.validation.maxLength">
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
              @if (field.helpText) {
                <p class="text-[10px] text-gray-400 mb-1">{{ field.helpText }}</p>
              }

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
                    @for (opt of field.options; track opt.value) {
                      <option>{{ opt.label }}</option>
                    }
                  </select>
                }
                @case ('radio') {
                  <div class="space-y-1">
                    @for (opt of field.options; track opt.value) {
                      <label class="flex items-center gap-1.5 text-xs text-gray-600">
                        <input type="radio" disabled [name]="field.id"> {{ opt.label }}
                      </label>
                    }
                    @if (!field.options.length) {
                      <span class="text-[10px] text-gray-400">No options defined</span>
                    }
                  </div>
                }
                @case ('checkbox') {
                  <label class="flex items-center gap-1.5 text-xs text-gray-600">
                    <input type="checkbox" disabled> {{ field.label }}
                  </label>
                }
                @case ('multi_select') {
                  <div class="border rounded p-1.5 bg-gray-50 min-h-[28px]">
                    @for (opt of field.options; track opt.value) {
                      <span class="inline-block text-[10px] bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 mr-1 mb-0.5">{{ opt.label }}</span>
                    }
                    @if (!field.options.length) {
                      <span class="text-[10px] text-gray-400">No options defined</span>
                    }
                  </div>
                }
                @case ('file') {
                  <div class="border rounded p-2 bg-gray-50 flex items-center gap-2 text-xs text-gray-400">
                    <mat-icon class="!text-sm">attach_file</mat-icon> Choose file...
                  </div>
                }
                @case ('alert') {
                  <div class="rounded-lg border px-4 py-3 text-sm flex items-start gap-3"
                       [ngClass]="alertBoxClass(field.placeholder || 'info')">
                    <mat-icon class="!text-lg !w-5 !h-5 shrink-0 mt-0.5"
                              [ngClass]="alertIconClass(field.placeholder || 'info')">
                      {{ alertIcon(field.placeholder || 'info') }}
                    </mat-icon>
                    <div>
                      <div class="font-semibold text-sm mb-0.5">{{ field.label || 'Alert' }}</div>
                      <div class="text-xs opacity-90">{{ field.defaultValue || 'Alert message...' }}</div>
                    </div>
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
          <mat-icon class="!text-sm !w-4 !h-4 mr-1">save</mat-icon> Apply Changes
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
export class FlowNodeFormEditorComponent {

  fields: FlowField[];
  expandedFieldId: string | null = null;

  fieldTypes: { type: FlowFieldType; label: string }[] = [
    { type: 'text', label: 'Text' },
    { type: 'textarea', label: 'Textarea' },
    { type: 'number', label: 'Number' },
    { type: 'date', label: 'Date' },
    { type: 'select', label: 'Select (dropdown)' },
    { type: 'radio', label: 'Radio buttons' },
    { type: 'checkbox', label: 'Checkbox' },
    { type: 'multi_select', label: 'Multi-select' },
    { type: 'file', label: 'File upload' },
    { type: 'alert', label: 'Alert / Info Box' },
  ];

  constructor(
    public dialogRef: MatDialogRef<FlowNodeFormEditorComponent>,
    @Inject(MAT_DIALOG_DATA) public data: FormEditorDialogData,
  ) {
    this.fields = structuredClone(data.node.fields || []);
  }

  fieldIcon(type: FlowFieldType): string {
    const map: Record<string, string> = {
      text: 'short_text', textarea: 'notes', number: 'pin',
      date: 'calendar_today', select: 'arrow_drop_down_circle',
      radio: 'radio_button_checked', checkbox: 'check_box',
      multi_select: 'checklist', file: 'attach_file',
      alert: 'info',
    };
    return map[type] || 'text_fields';
  }

  // Alert box style helpers (Bootstrap-like)
  alertIcon(style: string): string {
    return { info: 'info', success: 'check_circle', warning: 'warning', error: 'error' }[style] || 'info';
  }
  alertBoxClass(style: string): string {
    return {
      info: 'bg-blue-50 border-blue-300 text-blue-900',
      success: 'bg-green-50 border-green-300 text-green-900',
      warning: 'bg-amber-50 border-amber-300 text-amber-900',
      error: 'bg-red-50 border-red-300 text-red-900',
    }[style] || 'bg-blue-50 border-blue-300 text-blue-900';
  }
  alertIconClass(style: string): string {
    return {
      info: 'text-blue-600',
      success: 'text-green-600',
      warning: 'text-amber-600',
      error: 'text-red-600',
    }[style] || 'text-blue-600';
  }

  toggleField(id: string): void {
    this.expandedFieldId = this.expandedFieldId === id ? null : id;
  }

  addField(): void {
    const field: FlowField = {
      id: `f-${Date.now()}`, type: 'text', label: 'New Field',
      options: [], validation: {}, order: this.fields.length,
    };
    this.fields.push(field);
    this.expandedFieldId = field.id;
  }

  removeField(index: number): void {
    this.fields.splice(index, 1);
    this.expandedFieldId = null;
  }

  reorderField(event: CdkDragDrop<FlowField[]>): void {
    moveItemInArray(this.fields, event.previousIndex, event.currentIndex);
    this.fields.forEach((f, i) => f.order = i);
  }

  addOption(field: FlowField): void {
    field.options.push({ label: `Option ${field.options.length + 1}`, value: `opt-${Date.now()}` });
  }

  removeOption(field: FlowField, index: number): void {
    field.options.splice(index, 1);
  }

  save(): void {
    this.fields.forEach((f, i) => f.order = i);
    this.dialogRef.close(this.fields);
  }
}
