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
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  FormDefinition,
  FormField,
  FormSection,
  FormFieldValidation,
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
          @for (ft of fieldTypes; track ft.type) {
            <div class="flex items-center gap-2 p-2 mb-1 rounded cursor-pointer bg-gray-50 hover:bg-gray-100 text-sm"
                 (click)="addField(ft.type)">
              <mat-icon class="!text-base !w-5 !h-5">{{ ft.icon }}</mat-icon>
              <span>{{ ft.label }}</span>
            </div>
          }
        </div>
      </aside>

      <!-- Main Builder Area -->
      <main class="flex-1 flex flex-col bg-gray-50">
        @if (editingForm()) {
          <!-- Form Settings Bar -->
          <div class="bg-white border-b p-4">
            <div class="grid grid-cols-2 gap-4">
              <mat-form-field>
                <mat-label>Form Name</mat-label>
                <input matInput [(ngModel)]="formName">
              </mat-form-field>
              <div class="flex items-center gap-2">
                <button mat-raised-button color="primary" (click)="saveForm()">
                  <mat-icon>save</mat-icon> Save
                </button>
                @if (editingForm()!.id) {
                  <button mat-icon-button matTooltip="Delete" color="warn" (click)="deleteForm()">
                    <mat-icon>delete</mat-icon>
                  </button>
                }
              </div>
            </div>
          </div>

          <!-- Field List (Drag-to-reorder) -->
          <div class="flex-1 overflow-auto p-6">
            <div cdkDropList (cdkDropListDropped)="reorderField($event)">
              @for (field of editingFields(); track field.id; let i = $index) {
                <mat-card class="mb-3" cdkDrag>
                  <mat-card-content class="p-4">
                    <div class="flex items-start gap-3">
                      <!-- Drag handle -->
                      <mat-icon cdkDragHandle class="cursor-grab text-gray-400 mt-2">drag_indicator</mat-icon>

                      <!-- Field config -->
                      <div class="flex-1">
                        <div class="grid grid-cols-4 gap-3">
                          <mat-form-field>
                            <mat-label>Label</mat-label>
                            <input matInput [(ngModel)]="field.label">
                          </mat-form-field>
                          <mat-form-field>
                            <mat-label>Type</mat-label>
                            <mat-select [(ngModel)]="field.type">
                              @for (ft of fieldTypes; track ft.type) {
                                <mat-option [value]="ft.type">{{ ft.label }}</mat-option>
                              }
                            </mat-select>
                          </mat-form-field>
                          <mat-form-field>
                            <mat-label>Placeholder</mat-label>
                            <input matInput [(ngModel)]="field.placeholder">
                          </mat-form-field>
                          <mat-form-field>
                            <mat-label>Section</mat-label>
                            <input matInput [(ngModel)]="field.section">
                          </mat-form-field>
                        </div>

                        <!-- Validation row -->
                        <div class="flex items-center gap-4 mt-2">
                          <mat-checkbox [(ngModel)]="field.validation.required">Required</mat-checkbox>
                          @if (field.type === 'text' || field.type === 'textarea') {
                            <mat-form-field class="!w-24">
                              <mat-label>Min Len</mat-label>
                              <input matInput type="number" [(ngModel)]="field.validation.minLength">
                            </mat-form-field>
                            <mat-form-field class="!w-24">
                              <mat-label>Max Len</mat-label>
                              <input matInput type="number" [(ngModel)]="field.validation.maxLength">
                            </mat-form-field>
                          }
                          @if (field.type === 'number') {
                            <mat-form-field class="!w-24">
                              <mat-label>Min</mat-label>
                              <input matInput type="number" [(ngModel)]="field.validation.minValue">
                            </mat-form-field>
                            <mat-form-field class="!w-24">
                              <mat-label>Max</mat-label>
                              <input matInput type="number" [(ngModel)]="field.validation.maxValue">
                            </mat-form-field>
                          }
                          @if (field.type === 'select' || field.type === 'radio') {
                            <mat-form-field class="!w-48">
                              <mat-label>Options (comma-separated)</mat-label>
                              <input matInput [value]="field.validation.options?.join(', ') || ''"
                                     (input)="updateOptions(field, $event)">
                            </mat-form-field>
                          }
                        </div>
                      </div>

                      <!-- Remove button -->
                      <button mat-icon-button matTooltip="Remove field" (click)="removeField(i)">
                        <mat-icon class="text-red-400">close</mat-icon>
                      </button>
                    </div>
                  </mat-card-content>
                </mat-card>
              }
            </div>

            @if (editingFields().length === 0) {
              <div class="text-center py-12 text-gray-400">
                <mat-icon class="!text-5xl !w-12 !h-12 mb-3">dynamic_form</mat-icon>
                <p>Add fields from the sidebar to build your form</p>
              </div>
            }

            <!-- Form Preview -->
            @if (editingFields().length > 0) {
              <mat-divider class="my-6"></mat-divider>
              <h3 class="font-semibold mb-4">Form Preview</h3>
              <mat-card>
                <mat-card-content class="p-6">
                  @for (field of editingFields(); track field.id) {
                    <div class="mb-4">
                      @switch (field.type) {
                        @case ('text') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ field.label }}</mat-label>
                            <input matInput [placeholder]="field.placeholder || ''">
                          </mat-form-field>
                        }
                        @case ('textarea') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ field.label }}</mat-label>
                            <textarea matInput [placeholder]="field.placeholder || ''" rows="3"></textarea>
                          </mat-form-field>
                        }
                        @case ('number') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ field.label }}</mat-label>
                            <input matInput type="number" [placeholder]="field.placeholder || ''">
                          </mat-form-field>
                        }
                        @case ('date') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ field.label }}</mat-label>
                            <input matInput type="date">
                          </mat-form-field>
                        }
                        @case ('select') {
                          <mat-form-field class="w-full">
                            <mat-label>{{ field.label }}</mat-label>
                            <mat-select>
                              @for (opt of field.validation.options || []; track opt) {
                                <mat-option [value]="opt">{{ opt }}</mat-option>
                              }
                            </mat-select>
                          </mat-form-field>
                        }
                        @case ('checkbox') {
                          <mat-checkbox>{{ field.label }}</mat-checkbox>
                        }
                        @default {
                          <mat-form-field class="w-full">
                            <mat-label>{{ field.label }}</mat-label>
                            <input matInput [placeholder]="field.placeholder || ''">
                          </mat-form-field>
                        }
                      }
                    </div>
                  }
                </mat-card-content>
              </mat-card>
            }
          </div>
        } @else {
          <div class="flex items-center justify-center h-full text-gray-400">
            <div class="text-center">
              <mat-icon class="!text-6xl !w-16 !h-16 mb-4">dynamic_form</mat-icon>
              <p class="text-lg">Form Builder</p>
              <p class="text-sm">Create or select a form definition from the sidebar</p>
            </div>
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; height: calc(100vh - 64px); }
  `],
})
export class FormBuilderComponent implements OnInit {
  forms = signal<FormDefinition[]>([]);
  selectedFormId = signal<string | null>(null);
  editingForm = signal<FormDefinition | null>(null);
  editingFields = signal<FormField[]>([]);

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
  ];

  constructor(
    private dataService: DataService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.dataService.getFormDefinitions().subscribe(forms => {
      this.forms.set(forms);
    });
  }

  selectForm(form: FormDefinition): void {
    this.selectedFormId.set(form.id);
    this.editingForm.set(form);
    this.editingFields.set(form.fields.map(f => ({ ...f, validation: { ...f.validation } })));
    this.formName = form.name;
    this.formCaseTypeId = form.caseTypeId;
    this.formStage = form.stage || '';
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
    this.editingFields.update(fields => [...fields, field]);
  }

  removeField(index: number): void {
    this.editingFields.update(fields => fields.filter((_, i) => i !== index));
  }

  reorderField(event: CdkDragDrop<FormField[]>): void {
    const fields = [...this.editingFields()];
    moveItemInArray(fields, event.previousIndex, event.currentIndex);
    fields.forEach((f, i) => f.order = i);
    this.editingFields.set(fields);
  }

  updateOptions(field: FormField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    field.validation.options = value.split(',').map(o => o.trim()).filter(o => o);
  }

  saveForm(): void {
    const form = this.editingForm();
    if (!form) return;

    const payload: Partial<FormDefinition> = {
      name: this.formName,
      caseTypeId: this.formCaseTypeId,
      stage: this.formStage || undefined,
      fields: this.editingFields(),
      sections: [],
    };

    if (form.id) {
      this.dataService.updateFormDefinition(form.id, payload).subscribe(updated => {
        this.forms.update(forms => forms.map(f => f.id === updated.id ? updated : f));
        this.snackBar.open('Form updated', 'OK', { duration: 2000 });
      });
    } else {
      this.dataService.createFormDefinition(payload).subscribe(created => {
        this.forms.update(forms => [...forms, created]);
        this.editingForm.set(created);
        this.selectedFormId.set(created.id);
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
