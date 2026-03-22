import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  FormDefinition,
  FormField,
  FormSection,
  FormFieldValidation,
  GridConfig,
} from '../../core/models';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-form-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDividerModule,
    MatTooltipModule,
    MatTabsModule,
    DragDropModule,
  ],
  template: `
    <div class="flex h-full">
      <!-- Left: Form List + Field Palette -->
      <aside class="w-72 bg-white border-r flex flex-col">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold mb-3">Form Definitions</h3>
          <button mat-raised-button color="primary" class="w-full" (click)="newForm()">
            <mat-icon>add</mat-icon> New Form
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          @for (form of forms(); track form.id) {
            <div class="p-3 mb-2 rounded cursor-pointer transition-colors"
                 [class.bg-[#EAF4FB]]="selectedFormId() === form.id"
                 [class.border-l-4]="selectedFormId() === form.id"
                 [class.border-[#056DAE]]="selectedFormId() === form.id"
                 [class.hover:bg-gray-50]="selectedFormId() !== form.id"
                 (click)="selectForm(form)">
              <div class="font-medium text-sm">{{ form.name }}</div>
              <div class="text-xs text-gray-500">
                v{{ form.version }} · {{ form.fields.length }} fields
              </div>
            </div>
          }
        </div>

        <!-- Field Type Palette -->
        <div class="p-4 border-t">
          <h4 class="text-sm font-semibold mb-2 text-gray-600">ADD FIELD</h4>
          <p class="text-xs text-gray-400 mb-2">Click to add · Drag into grid cells</p>
          <div cdkDropList id="wf-palette" cdkDropListSortingDisabled [cdkDropListData]="fieldTypes"
               [cdkDropListConnectedTo]="allDropListIds">
            @for (ft of fieldTypes; track ft.type) {
              <div cdkDrag [cdkDragData]="ft"
                   class="flex items-center gap-2 p-2 mb-1 rounded cursor-grab bg-gray-50 hover:bg-gray-100 text-sm"
                   (click)="addField(ft.type)">
                <mat-icon class="!text-base !w-5 !h-5">{{ ft.icon }}</mat-icon>
                <span class="flex-1">{{ ft.label }}</span>
                <mat-icon class="!text-sm !w-4 !h-4 text-gray-300">drag_indicator</mat-icon>
                <!-- Preview shown while dragging -->
                <div *cdkDragPreview
                     class="flex items-center gap-2 px-3 py-2 bg-white border border-indigo-400 rounded-lg shadow-xl text-sm font-medium text-indigo-700">
                  <mat-icon class="!text-base">{{ ft.icon }}</mat-icon>
                  {{ ft.label }}
                </div>
                <!-- Faded placeholder in palette while dragging -->
                <div *cdkDragPlaceholder
                     class="flex items-center gap-2 p-2 mb-1 rounded bg-indigo-50 border border-dashed border-indigo-200 text-indigo-200 text-sm">
                  <mat-icon class="!text-base !w-5 !h-5">{{ ft.icon }}</mat-icon>
                  <span>{{ ft.label }}</span>
                </div>
              </div>
            }
          </div>
        </div>
      </aside>

      <!-- Main Builder Area -->
      <main class="flex-1 flex flex-col bg-gray-50">
        @if (editingForm()) {
          <!-- Form Settings Bar -->
          <div class="bg-white border-b px-4 py-2">
            <div class="flex items-center gap-3">
              <mat-form-field subscriptSizing="dynamic" class="flex-1">
                <mat-label>Form Name</mat-label>
                <input matInput [(ngModel)]="formName">
              </mat-form-field>
              <button mat-raised-button color="primary" class="shrink-0" (click)="saveForm()">
                <mat-icon>save</mat-icon> Save
              </button>
              @if (editingForm()!.id) {
                <button mat-icon-button matTooltip="Delete" color="warn" (click)="deleteForm()">
                  <mat-icon>delete</mat-icon>
                </button>
              }
            </div>
          </div>

          <!-- Builder / Preview Tabs -->
          <mat-tab-group class="flex-1 flex flex-col" [(selectedIndex)]="activeTab"
                         animationDuration="150ms"
                         [class.hidden]="false"
                         style="display:flex;flex-direction:column;flex:1;min-height:0">

            <!-- ── Builder Tab ── -->
            <mat-tab label="Builder">
              <ng-template mat-tab-label>
                <mat-icon class="!text-base mr-1">construction</mat-icon> Builder
              </ng-template>
              <div class="flex-1 overflow-auto p-3" style="height:calc(100vh - 168px)">
                <div cdkDropList id="wf-field-list" (cdkDropListDropped)="onFieldListDrop($event)" class="space-y-1.5">
                  @for (field of editingFields(); track field.id; let i = $index) {
                    <div class="bg-white rounded-lg border border-slate-200 shadow-sm" cdkDrag>
                      <div class="flex items-start gap-2 px-3 py-2">
                        <!-- Drag handle -->
                        <mat-icon cdkDragHandle class="cursor-grab text-slate-300 mt-1 shrink-0 !text-base">drag_indicator</mat-icon>

                        <!-- Field config -->
                        <div class="flex-1 min-w-0">
                          <div class="grid grid-cols-4 gap-2">
                            <mat-form-field subscriptSizing="dynamic">
                              <mat-label>Label</mat-label>
                              <input matInput [(ngModel)]="field.label">
                            </mat-form-field>
                            <mat-form-field subscriptSizing="dynamic">
                              <mat-label>Type</mat-label>
                              <mat-select [(ngModel)]="field.type" (ngModelChange)="onFieldTypeChange(field)">
                                @for (ft of fieldTypes; track ft.type) {
                                  <mat-option [value]="ft.type">{{ ft.label }}</mat-option>
                                }
                              </mat-select>
                            </mat-form-field>
                            <mat-form-field subscriptSizing="dynamic">
                              <mat-label>Placeholder</mat-label>
                              <input matInput [(ngModel)]="field.placeholder">
                            </mat-form-field>
                            <mat-form-field subscriptSizing="dynamic">
                              <mat-label>Section</mat-label>
                              <input matInput [(ngModel)]="field.section">
                            </mat-form-field>
                          </div>

                          <!-- Validation row -->
                          <div class="flex items-center gap-3 mt-1">
                            <mat-checkbox class="scale-90 origin-left" [(ngModel)]="field.validation.required">Required</mat-checkbox>
                            @if (field.type === 'text' || field.type === 'textarea') {
                              <mat-form-field class="!w-20" subscriptSizing="dynamic">
                                <mat-label>Min Len</mat-label>
                                <input matInput type="number" [(ngModel)]="field.validation.minLength">
                              </mat-form-field>
                              <mat-form-field class="!w-20" subscriptSizing="dynamic">
                                <mat-label>Max Len</mat-label>
                                <input matInput type="number" [(ngModel)]="field.validation.maxLength">
                              </mat-form-field>
                            }
                            @if (field.type === 'number') {
                              <mat-form-field class="!w-20" subscriptSizing="dynamic">
                                <mat-label>Min</mat-label>
                                <input matInput type="number" [(ngModel)]="field.validation.minValue">
                              </mat-form-field>
                              <mat-form-field class="!w-20" subscriptSizing="dynamic">
                                <mat-label>Max</mat-label>
                                <input matInput type="number" [(ngModel)]="field.validation.maxValue">
                              </mat-form-field>
                            }
                            @if (field.type === 'select' || field.type === 'radio') {
                              <mat-form-field class="!w-52" subscriptSizing="dynamic">
                                <mat-label>Options (comma-separated)</mat-label>
                                <input matInput [value]="field.validation.options?.join(', ') || ''"
                                       (input)="updateOptions(field, $event)">
                              </mat-form-field>
                            }
                          </div>

                          <!-- Grid drag-and-drop layout -->
                          @if (field.type === 'grid' && field.gridConfig) {
                            <div class="mt-2 rounded-lg border border-slate-200 overflow-hidden">
                              <div class="flex items-center justify-between px-3 py-1.5 bg-slate-100 border-b border-slate-200">
                                <span class="text-xs font-semibold text-slate-600 uppercase tracking-wide flex items-center gap-1">
                                  <mat-icon class="!text-sm !w-4 !h-4">grid_on</mat-icon>
                                  Grid Layout
                                </span>
                                <div class="flex items-center gap-4 text-xs text-slate-500">
                                  <div class="flex items-center gap-1">
                                    <span>Cols:</span>
                                    <button mat-icon-button class="!w-5 !h-5" [disabled]="field.gridConfig!.columns <= 1" (click)="removeGridCol(field)"><mat-icon class="!text-xs">remove</mat-icon></button>
                                    <span class="w-4 text-center font-bold text-slate-700">{{ field.gridConfig.columns }}</span>
                                    <button mat-icon-button class="!w-5 !h-5" (click)="addGridCol(field)"><mat-icon class="!text-xs">add</mat-icon></button>
                                  </div>
                                  <div class="flex items-center gap-1">
                                    <span>Rows:</span>
                                    <button mat-icon-button class="!w-5 !h-5" [disabled]="field.gridConfig!.rows <= 1" (click)="removeGridRow(field)"><mat-icon class="!text-xs">remove</mat-icon></button>
                                    <span class="w-4 text-center font-bold text-slate-700">{{ field.gridConfig.rows }}</span>
                                    <button mat-icon-button class="!w-5 !h-5" (click)="addGridRow(field)"><mat-icon class="!text-xs">add</mat-icon></button>
                                  </div>
                                </div>
                              </div>
                              <div class="p-2 bg-slate-50">
                                <p class="text-[10px] text-slate-400 mb-1.5 flex items-center gap-1">
                                  <mat-icon class="!text-[10px] !w-3 !h-3">drag_indicator</mat-icon>
                                  Drag field types from the palette into cells
                                </p>
                                <div class="grid gap-1.5"
                                     [style.grid-template-columns]="'repeat(' + field.gridConfig.columns + ', 1fr)'">
                                  @for (cell of field.gridConfig.cells; track $index; let ci = $index) {
                                    <div cdkDropList
                                         [id]="'cell-' + field.id + '-' + ci"
                                         (cdkDropListDropped)="dropIntoCell($event, field, ci)"
                                         class="min-h-[76px] rounded-lg border-2 border-dashed transition-all"
                                         [ngClass]="cell ? 'border-indigo-200 bg-white' : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50'">
                                      @if (cell) {
                                        <div class="p-1.5">
                                          <div class="flex items-center gap-1 mb-1">
                                            <div class="w-4 h-4 rounded bg-indigo-100 flex items-center justify-center shrink-0">
                                              <mat-icon class="!text-[9px] !w-2.5 !h-2.5 text-indigo-600">{{ getFieldTypeIcon(cell.type) }}</mat-icon>
                                            </div>
                                            <span class="text-[9px] font-semibold text-indigo-600 uppercase tracking-wide flex-1">{{ cell.type }}</span>
                                            <button mat-icon-button class="!w-4 !h-4 shrink-0" (click)="clearGridCell(field, ci)">
                                              <mat-icon class="!text-[10px] text-red-400">close</mat-icon>
                                            </button>
                                          </div>
                                          <input class="w-full text-[11px] border border-slate-200 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
                                                 [value]="cell.label"
                                                 (input)="cell.label = $any($event.target).value; updateEditingFields()"
                                                 placeholder="Field label">
                                          <mat-checkbox class="scale-75 origin-left"
                                                        [checked]="cell.validation.required"
                                                        (change)="cell.validation.required = $event.checked; updateEditingFields()">
                                            Required
                                          </mat-checkbox>
                                        </div>
                                      } @else {
                                        <div class="flex flex-col items-center justify-center h-full min-h-[76px] text-slate-300 gap-0.5">
                                          <mat-icon class="!text-xl !w-5 !h-5">add_box</mat-icon>
                                          <span class="text-[9px]">Drop field here</span>
                                        </div>
                                      }
                                    </div>
                                  }
                                </div>
                              </div>
                            </div>
                          }
                        </div>

                        <!-- Remove -->
                        <button mat-icon-button class="!w-7 !h-7 shrink-0" matTooltip="Remove" (click)="removeField(i)">
                          <mat-icon class="!text-base text-red-400">close</mat-icon>
                        </button>
                      </div>
                    </div>
                  }
                </div>

                @if (editingFields().length === 0) {
                  <div class="text-center py-12 text-gray-400">
                    <mat-icon class="!text-5xl !w-12 !h-12 mb-3">dynamic_form</mat-icon>
                    <p>Add fields from the sidebar to build your form</p>
                  </div>
                }
              </div>
            </mat-tab>

            <!-- ── Preview Tab ── -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="!text-base mr-1">preview</mat-icon> Preview
              </ng-template>
              <div class="overflow-auto p-4" style="height:calc(100vh - 168px)">
                @if (editingFields().length === 0) {
                  <div class="text-center py-12 text-slate-400">
                    <mat-icon class="!text-5xl !w-12 !h-12 mb-2">dynamic_form</mat-icon>
                    <p class="text-sm">No fields yet — add some in the Builder tab</p>
                  </div>
                } @else {
                  <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5 max-w-3xl mx-auto">
                    <h3 class="text-base font-semibold text-slate-800 mb-3 pb-2 border-b">{{ formName }}</h3>
                    <div class="grid grid-cols-1 gap-1">
                      @for (field of editingFields(); track field.id) {
                        @switch (field.type) {
                          @case ('text') {
                            <mat-form-field class="w-full" subscriptSizing="dynamic">
                              <mat-label>{{ field.label }}</mat-label>
                              <input matInput [placeholder]="field.placeholder || ''">
                            </mat-form-field>
                          }
                          @case ('textarea') {
                            <mat-form-field class="w-full" subscriptSizing="dynamic">
                              <mat-label>{{ field.label }}</mat-label>
                              <textarea matInput [placeholder]="field.placeholder || ''" rows="2"></textarea>
                            </mat-form-field>
                          }
                          @case ('number') {
                            <mat-form-field class="w-full" subscriptSizing="dynamic">
                              <mat-label>{{ field.label }}</mat-label>
                              <input matInput type="number" [placeholder]="field.placeholder || ''">
                            </mat-form-field>
                          }
                          @case ('date') {
                            <mat-form-field class="w-full" subscriptSizing="dynamic">
                              <mat-label>{{ field.label }}</mat-label>
                              <input matInput type="date">
                            </mat-form-field>
                          }
                          @case ('select') {
                            <mat-form-field class="w-full" subscriptSizing="dynamic">
                              <mat-label>{{ field.label }}</mat-label>
                              <mat-select>
                                @for (opt of field.validation.options || []; track opt) {
                                  <mat-option [value]="opt">{{ opt }}</mat-option>
                                }
                              </mat-select>
                            </mat-form-field>
                          }
                          @case ('checkbox') {
                            <div class="py-1">
                              <mat-checkbox>{{ field.label }}</mat-checkbox>
                            </div>
                          }
                          @case ('grid') {
                            <div class="py-1">
                              <label class="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">{{ field.label }}</label>
                              <div class="grid gap-2"
                                   [style.grid-template-columns]="'repeat(' + (field.gridConfig?.columns || 2) + ', 1fr)'">
                                @for (cell of (field.gridConfig?.cells || []); track $index) {
                                  <div>
                                    @if (cell) {
                                      @switch (cell.type) {
                                        @case ('textarea') {
                                          <mat-form-field class="w-full" subscriptSizing="dynamic">
                                            <mat-label>{{ cell.label }}</mat-label>
                                            <textarea matInput rows="2"></textarea>
                                          </mat-form-field>
                                        }
                                        @case ('number') {
                                          <mat-form-field class="w-full" subscriptSizing="dynamic">
                                            <mat-label>{{ cell.label }}</mat-label>
                                            <input matInput type="number">
                                          </mat-form-field>
                                        }
                                        @case ('date') {
                                          <mat-form-field class="w-full" subscriptSizing="dynamic">
                                            <mat-label>{{ cell.label }}</mat-label>
                                            <input matInput type="date">
                                          </mat-form-field>
                                        }
                                        @case ('select') {
                                          <mat-form-field class="w-full" subscriptSizing="dynamic">
                                            <mat-label>{{ cell.label }}</mat-label>
                                            <mat-select>
                                              @for (opt of cell.validation.options || []; track opt) {
                                                <mat-option [value]="opt">{{ opt }}</mat-option>
                                              }
                                            </mat-select>
                                          </mat-form-field>
                                        }
                                        @case ('checkbox') {
                                          <div class="py-1"><mat-checkbox>{{ cell.label }}</mat-checkbox></div>
                                        }
                                        @default {
                                          <mat-form-field class="w-full" subscriptSizing="dynamic">
                                            <mat-label>{{ cell.label }}</mat-label>
                                            <input matInput [placeholder]="cell.placeholder || ''">
                                          </mat-form-field>
                                        }
                                      }
                                    } @else {
                                      <div class="h-12 border border-dashed border-slate-200 rounded-lg flex items-center justify-center">
                                        <span class="text-xs text-slate-300">Empty</span>
                                      </div>
                                    }
                                  </div>
                                }
                              </div>
                            </div>
                          }
                          @default {
                            <mat-form-field class="w-full" subscriptSizing="dynamic">
                              <mat-label>{{ field.label }}</mat-label>
                              <input matInput [placeholder]="field.placeholder || ''">
                            </mat-form-field>
                          }
                        }
                      }
                    </div>
                  </div>
                }
              </div>
            </mat-tab>

          </mat-tab-group>
        } @else {
          <div class="flex items-center justify-center h-full text-gray-400">
            <div class="text-center">
              <mat-icon class="!text-6xl !w-16 !h-16 mb-4">dynamic_form</mat-icon>
              <p class="text-lg mb-1">Form Builder</p>
              <p class="text-sm mb-4">Select a form from the sidebar or create a new one</p>
              <button mat-raised-button color="primary" (click)="newForm()">
                <mat-icon>add</mat-icon> Create New Form
              </button>
            </div>
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; height: calc(100vh - 64px); }
    mat-tab-group { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    mat-tab-group ::ng-deep .mat-mdc-tab-body-wrapper { flex: 1; min-height: 0; }
    mat-tab-group ::ng-deep .mat-mdc-tab-body-content { height: 100%; overflow: hidden; }
  `],
})
export class FormBuilderComponent implements OnInit {
  forms = signal<FormDefinition[]>([]);
  selectedFormId = signal<string | null>(null);
  editingForm = signal<FormDefinition | null>(null);
  editingFields = signal<FormField[]>([]);
  activeTab = 0;

  formName = '';
  formCaseTypeId = '';
  formStage = '';

  fieldTypes = [
    { type: 'text', label: 'Text', icon: 'text_fields' },
    { type: 'textarea', label: 'Text Area', icon: 'notes' },
    { type: 'number', label: 'Number', icon: 'pin' },
    { type: 'date', label: 'Date', icon: 'calendar_today' },
    { type: 'select', label: 'Dropdown', icon: 'arrow_drop_down_circle' },
    { type: 'checkbox', label: 'Checkbox', icon: 'check_box' },
    { type: 'radio', label: 'Radio', icon: 'radio_button_checked' },
    { type: 'file', label: 'File Upload', icon: 'attach_file' },
    { type: 'grid', label: 'Grid / Table', icon: 'grid_on' },
  ];

  constructor(
    private dataService: DataService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.dataService.getFormDefinitions().subscribe(forms => {
      this.forms.set(forms);
      if (forms.length === 0) {
        this.newForm();
      }
    });
  }

  selectForm(form: FormDefinition): void {
    this.selectedFormId.set(form.id);
    this.editingForm.set(form);
    this.editingFields.set(form.fields.map(f => this.cloneField(f)));
    this.formName = form.name;
    this.formCaseTypeId = form.caseTypeId;
    this.formStage = form.stage || '';
    this.activeTab = 0;
  }

  newForm(): void {
    const emptyForm: FormDefinition = {
      id: '',
      name: 'New Form',
      caseTypeId: '',
      sections: [],
      fields: [],
      description: '',
      version: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.editingForm.set(emptyForm);
    this.editingFields.set([]);
    this.formName = 'New Form';
    this.formCaseTypeId = '';
    this.formStage = '';
    this.selectedFormId.set(null);
    this.activeTab = 0;
  }

  addField(type: string): void {
    if (!this.editingForm()) return;
    const field: FormField = {
      id: `field-${Date.now()}`,
      type: type as any,
      label: this.fieldTypes.find(ft => ft.type === type)?.label || type,
      placeholder: '',
      order: this.editingFields().length,
      section: 'default',
      validation: {},
    };
    if (type === 'grid') {
      field.gridConfig = { columns: 2, rows: 2, cells: [null, null, null, null] };
    }
    this.editingFields.update(fields => [...fields, field]);
  }

  removeField(index: number): void {
    this.editingFields.update(fields => fields.filter((_, i) => i !== index));
  }

  onFieldListDrop(event: CdkDragDrop<FormField[]>): void {
    const fields = [...this.editingFields()];
    moveItemInArray(fields, event.previousIndex, event.currentIndex);
    fields.forEach((f, i) => f.order = i);
    this.editingFields.set(fields);
  }

  private cloneField(f: FormField): FormField {
    const field: FormField = {
      ...f,
      validation: {
        ...(f.validation || {}),
        options: f.validation?.options ? [...f.validation.options] : undefined,
      },
    };
    if (f.type === 'grid') {
      const gc = f.gridConfig || { columns: 2, rows: 2, cells: [null, null, null, null] };
      field.gridConfig = {
        columns: gc.columns,
        rows: gc.rows,
        cells: gc.cells.map(cell => cell ? this.cloneField(cell) : null),
      };
    }
    return field;
  }

  updateOptions(field: FormField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    field.validation.options = value.split(',').map(o => o.trim()).filter(o => o);
  }

  onFieldTypeChange(field: FormField): void {
    if (field.type === 'grid' && !field.gridConfig) {
      field.gridConfig = { columns: 2, rows: 2, cells: [null, null, null, null] };
      this.editingFields.update(fields => [...fields]);
    }
  }

  get allDropListIds(): string[] {
    return this.editingFields()
      .filter(f => f.type === 'grid' && f.gridConfig)
      .flatMap(f => f.gridConfig!.cells.map((_, i) => `cell-${f.id}-${i}`));
  }

  dropIntoCell(event: CdkDragDrop<any>, parentField: FormField, cellIndex: number): void {
    const ft: { type: string; label: string; icon: string } = event.item.data;
    if (!ft || !parentField.gridConfig) return;
    const newCell: FormField = {
      id: `field-${Date.now()}-c${cellIndex}`,
      type: ft.type as FormField['type'],
      label: ft.label,
      placeholder: '',
      order: cellIndex,
      section: 'grid',
      validation: {},
    };
    const cells = [...parentField.gridConfig.cells];
    cells[cellIndex] = newCell;
    parentField.gridConfig = { ...parentField.gridConfig, cells };
    this.editingFields.update(f => [...f]);
  }

  clearGridCell(field: FormField, cellIndex: number): void {
    if (!field.gridConfig) return;
    const cells = [...field.gridConfig.cells];
    cells[cellIndex] = null;
    field.gridConfig = { ...field.gridConfig, cells };
    this.editingFields.update(f => [...f]);
  }

  addGridCol(field: FormField): void {
    if (!field.gridConfig) return;
    const { columns, rows, cells } = field.gridConfig;
    const newCols = columns + 1;
    const newCells: (FormField | null)[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < newCols; c++) {
        newCells.push(c < columns ? cells[r * columns + c] : null);
      }
    }
    field.gridConfig = { columns: newCols, rows, cells: newCells };
    this.editingFields.update(f => [...f]);
  }

  removeGridCol(field: FormField): void {
    if (!field.gridConfig || field.gridConfig.columns <= 1) return;
    const { columns, rows, cells } = field.gridConfig;
    const newCols = columns - 1;
    const newCells: (FormField | null)[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < newCols; c++) {
        newCells.push(cells[r * columns + c]);
      }
    }
    field.gridConfig = { columns: newCols, rows, cells: newCells };
    this.editingFields.update(f => [...f]);
  }

  addGridRow(field: FormField): void {
    if (!field.gridConfig) return;
    const newCells = Array(field.gridConfig.columns).fill(null);
    field.gridConfig = {
      ...field.gridConfig,
      rows: field.gridConfig.rows + 1,
      cells: [...field.gridConfig.cells, ...newCells],
    };
    this.editingFields.update(f => [...f]);
  }

  removeGridRow(field: FormField): void {
    if (!field.gridConfig || field.gridConfig.rows <= 1) return;
    const { columns, rows, cells } = field.gridConfig;
    field.gridConfig = {
      columns, rows: rows - 1,
      cells: cells.slice(0, (rows - 1) * columns),
    };
    this.editingFields.update(f => [...f]);
  }

  getFieldTypeIcon(type: string): string {
    return this.fieldTypes.find(ft => ft.type === type)?.icon || 'text_fields';
  }

  updateEditingFields(): void {
    this.editingFields.update(f => [...f]);
  }

  saveForm(): void {
    const form = this.editingForm();
    if (!form) return;

    const payload: Partial<FormDefinition> = {
      name: this.formName,
      caseTypeId: this.formCaseTypeId,
      stage: this.formStage || undefined,
      fields: this.editingFields().map(f => this.cloneField(f)),
      sections: [],
    };

    if (form.id) {
      this.dataService.updateFormDefinition(form.id, payload).subscribe(updated => {
        this.forms.update(forms => forms.map(f => f.id === updated.id ? updated : f));
        this.editingForm.set(updated);
        this.editingFields.set(updated.fields.map(f => this.cloneField(f)));
        this.snackBar.open('Form updated', 'OK', { duration: 2000 });
      });
    } else {
      this.dataService.createFormDefinition(payload).subscribe(created => {
        this.forms.update(forms => [...forms, created]);
        this.editingForm.set(created);
        this.selectedFormId.set(created.id);
        this.editingFields.set(created.fields.map(f => this.cloneField(f)));
        this.snackBar.open('Form created', 'OK', { duration: 2000 });
      });
    }
  }

  deleteForm(): void {
    const form = this.editingForm();
    if (!form?.id) return;
    this.dataService.deleteFormDefinition(form.id).subscribe(() => {
      this.forms.update(forms => forms.filter(f => f.id !== form.id));
      this.editingForm.set(null);
      this.selectedFormId.set(null);
      this.editingFields.set([]);
      this.snackBar.open('Form deleted', 'OK', { duration: 2000 });
    });
  }
}
