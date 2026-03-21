import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';
import {
  CaseTypeDefinition,
  StageDefinition,
  ProcessDefinition,
  StepDefinition,
  StepType,
  StageType,
  AttachmentCategory,
  FormDefinition,
} from '@core/models';
import * as CaseTypesActions from '@state/case-types/case-types.actions';
import {
  selectSelectedCaseTypeDefinition,
  selectCaseTypesLoading,
  selectCaseTypesError,
} from '@state/case-types/case-types.selectors';
import { StageConfigPanelComponent } from './stage-config-panel.component';
import { ProcessConfigPanelComponent } from './process-config-panel.component';
import { StepConfigPanelComponent } from './step-config-panel.component';
import { DataService } from '@core/services/data.service';

type ConfigPanelMode = 'none' | 'stage' | 'process' | 'step';

@Component({
  selector: 'app-case-type-designer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
    MatChipsModule,
    MatSlideToggleModule,
    StageConfigPanelComponent,
    ProcessConfigPanelComponent,
    StepConfigPanelComponent,
  ],
  template: `
    @if (isLoading()) {
      <div class="flex justify-center items-center h-64">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
    } @else if (!caseType) {
      <div class="text-center py-20 text-gray-500">
        <mat-icon class="!text-6xl !w-16 !h-16 mb-4 text-gray-300">error_outline</mat-icon>
        <p class="text-lg font-medium">Case type not found</p>
        <button mat-stroked-button routerLink="/admin/case-types" class="mt-4">
          <mat-icon class="mr-1">arrow_back</mat-icon> Back to Case Types
        </button>
      </div>
    } @else {
      <!-- Header Bar -->
      <div class="flex items-center gap-3 mb-4 pb-4 border-b border-gray-200">
        <button mat-icon-button matTooltip="Back to Case Types" routerLink="/admin/case-types">
          <mat-icon>arrow_back</mat-icon>
        </button>
        <div class="flex-1 min-w-0">
          <input
            class="text-xl font-bold text-gray-900 bg-transparent border-0 border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none w-full max-w-md transition-colors"
            [(ngModel)]="caseType.name"
            (blur)="markDirty()"
          />
          <p class="text-xs text-gray-500 mt-0.5">{{ caseType.prefix }}-### &middot; v{{ caseType.version }}</p>
        </div>
        <button mat-stroked-button (click)="save()" [disabled]="isSaving()">
          <mat-icon class="mr-1">save</mat-icon> {{ isSaving() ? 'Saving...' : 'Save' }}
        </button>
      </div>

      <!-- Tabs -->
      <mat-tab-group [(selectedIndex)]="selectedTab" class="designer-tabs">
        <mat-tab label="Workflow">
          <div class="flex gap-6 mt-4" style="min-height: 500px;">
            <!-- Left: Main Content -->
            <div class="flex-1 min-w-0">
              <!-- Primary Stage Chevrons -->
              <div class="flex items-center gap-0 mb-6 overflow-x-auto pb-2">
                @for (stage of primaryStages(); track stage.id; let i = $index) {
                  <div
                    class="stage-chevron cursor-pointer px-4 py-3 min-w-[140px] text-center relative transition-all"
                    [class.stage-chevron-active]="selectedStageId() === stage.id"
                    [class.stage-chevron-inactive]="selectedStageId() !== stage.id"
                    (click)="selectStage(stage)"
                  >
                    <p class="text-sm font-medium truncate">{{ stage.name }}</p>
                    <p class="text-xs opacity-70">{{ stage.processes.length }} process{{ stage.processes.length !== 1 ? 'es' : '' }}</p>
                    @if (i === 0) {
                      <span class="absolute top-1 left-2 text-xs">&#9733;</span>
                    }
                  </div>
                  @if (i < primaryStages().length - 1) {
                    <mat-icon class="text-gray-300 !text-2xl flex-shrink-0">chevron_right</mat-icon>
                  }
                }
                <button mat-stroked-button class="ml-2 flex-shrink-0" (click)="addStage('primary')">
                  <mat-icon>add</mat-icon> Stage
                </button>
              </div>

              <!-- Selected Stage Content -->
              @if (selectedStage()) {
                <div class="space-y-4">
                  @for (process of selectedStage()!.processes; track process.id; let pi = $index) {
                    <mat-card class="!shadow-sm border"
                      [class.border-blue-300]="selectedProcessId() === process.id && configPanelMode() === 'process'"
                      (click)="selectProcess(process, $event)">
                      <mat-card-header class="!px-4 !py-3 border-b border-gray-100 cursor-pointer">
                        <mat-card-title class="!text-sm !font-semibold flex items-center gap-2">
                          <mat-icon class="!text-lg text-gray-500">{{ process.isParallel ? 'call_split' : 'format_list_numbered' }}</mat-icon>
                          {{ process.name }}
                          <span class="text-xs font-normal text-gray-400">({{ process.type }})</span>
                        </mat-card-title>
                      </mat-card-header>
                      <mat-card-content class="!p-4">
                        <div class="space-y-2">
                          @for (step of process.steps; track step.id; let si = $index) {
                            <div
                              class="flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all hover:bg-gray-50"
                              [class.border-blue-400]="selectedStepId() === step.id"
                              [class.bg-blue-50]="selectedStepId() === step.id"
                              [class.border-gray-200]="selectedStepId() !== step.id"
                              (click)="selectStep(step, process, $event)"
                            >
                              <span class="text-xs text-gray-400 w-5">{{ si + 1 }}</span>
                              <span class="text-base">{{ stepIcon(step.type) }}</span>
                              <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-gray-800 truncate">{{ step.name }}</p>
                                <p class="text-xs text-gray-400">{{ step.type }}</p>
                              </div>
                              @if (step.required) {
                                <span class="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Required</span>
                              }
                              <button mat-icon-button class="!w-7 !h-7" (click)="removeStep(process, si); $event.stopPropagation()">
                                <mat-icon class="!text-base text-gray-400 hover:text-red-500">close</mat-icon>
                              </button>
                            </div>
                          }
                        </div>

                        <!-- Add Step Menu -->
                        <div class="mt-3">
                          <button mat-stroked-button class="!text-xs" [matMenuTriggerFor]="addStepMenu" (click)="$event.stopPropagation()">
                            <mat-icon class="!text-sm mr-1">add</mat-icon> Add Step
                          </button>
                          <mat-menu #addStepMenu="matMenu">
                            <button mat-menu-item (click)="addStep(process, 'assignment')">
                              <span>&#128221; Collect Information</span>
                            </button>
                            <button mat-menu-item (click)="addStep(process, 'approval')">
                              <span>&#9989; Approve / Reject</span>
                            </button>
                            <button mat-menu-item (click)="addStep(process, 'attachment')">
                              <span>&#128206; Upload Documents</span>
                            </button>
                            <button mat-menu-item (click)="addStep(process, 'decision')">
                              <span>&#128256; Decision</span>
                            </button>
                            <button mat-menu-item (click)="addStep(process, 'automation')">
                              <span>&#9889; Automation</span>
                            </button>
                            <button mat-menu-item (click)="addStep(process, 'subprocess')">
                              <span>&#128230; Subprocess</span>
                            </button>
                          </mat-menu>
                        </div>
                      </mat-card-content>
                    </mat-card>
                  }

                  <!-- Add Process Buttons -->
                  <div class="flex gap-2 mt-2">
                    <button mat-stroked-button (click)="addProcess(false)">
                      <mat-icon>add</mat-icon> Add Process
                    </button>
                    <button mat-stroked-button (click)="addProcess(true)">
                      <mat-icon>call_split</mat-icon> Add Parallel Process
                    </button>
                  </div>
                </div>
              }

              <mat-divider class="!my-6"></mat-divider>

              <!-- Alternate Stages -->
              <div>
                <h3 class="text-sm font-semibold text-gray-700 mb-3">ALTERNATE STAGES</h3>
                <div class="flex flex-wrap gap-3">
                  @for (stage of alternateStages(); track stage.id) {
                    <div
                      class="px-4 py-2 rounded-lg border cursor-pointer transition-all"
                      [class.border-red-400]="selectedStageId() === stage.id"
                      [class.bg-red-50]="selectedStageId() === stage.id"
                      [class.border-gray-200]="selectedStageId() !== stage.id"
                      [class.bg-gray-50]="selectedStageId() !== stage.id"
                      (click)="selectStage(stage)"
                    >
                      <p class="text-sm font-medium">{{ stage.name }}</p>
                    </div>
                  }
                  <button mat-stroked-button (click)="addStage('alternate')">
                    <mat-icon>add</mat-icon> Alternate Stage
                  </button>
                </div>
              </div>
            </div>

            <!-- Right: Config Panel -->
            <div class="w-80 flex-shrink-0">
              @switch (configPanelMode()) {
                @case ('stage') {
                  <app-stage-config-panel
                    [stage]="selectedStage()!"
                    [caseType]="caseType"
                    (stageChange)="onStageConfigChange($event)"
                    (deleteStage)="onDeleteStage($event)"
                  ></app-stage-config-panel>
                }
                @case ('process') {
                  <app-process-config-panel
                    [process]="selectedProcess()!"
                    (processChange)="onProcessConfigChange($event)"
                    (deleteProcess)="onDeleteProcess($event)"
                  ></app-process-config-panel>
                }
                @case ('step') {
                  <app-step-config-panel
                    [step]="selectedStep()!"
                    [caseType]="caseType"
                    (stepChange)="onStepConfigChange($event)"
                  ></app-step-config-panel>
                }
                @default {
                  <div class="text-center text-gray-400 mt-12">
                    <mat-icon class="!text-4xl !w-10 !h-10 mb-2 text-gray-300">touch_app</mat-icon>
                    <p class="text-sm">Select a stage, process, or step to configure</p>
                  </div>
                }
              }
            </div>
          </div>
        </mat-tab>

        <mat-tab label="Data Model">
          <div class="mt-4 space-y-4" style="min-height: 500px;">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-gray-800">Case Data Properties</h2>
                <p class="text-xs text-gray-500">Define the fields that store data on every case instance</p>
              </div>
              <button mat-stroked-button [matMenuTriggerFor]="addPropertyMenu">
                <mat-icon class="mr-1">add</mat-icon> Add Property
              </button>
              <mat-menu #addPropertyMenu="matMenu">
                <button mat-menu-item (click)="addSchemaField('text')">
                  <mat-icon>text_fields</mat-icon> Text (Single Line)
                </button>
                <button mat-menu-item (click)="addSchemaField('textarea')">
                  <mat-icon>notes</mat-icon> Text (Paragraph)
                </button>
                <button mat-menu-item (click)="addSchemaField('number')">
                  <mat-icon>pin</mat-icon> Number
                </button>
                <button mat-menu-item (click)="addSchemaField('date')">
                  <mat-icon>calendar_today</mat-icon> Date
                </button>
                <button mat-menu-item (click)="addSchemaField('boolean')">
                  <mat-icon>check_box</mat-icon> True / False
                </button>
                <button mat-menu-item (click)="addSchemaField('select')">
                  <mat-icon>arrow_drop_down_circle</mat-icon> Picklist
                </button>
                <button mat-menu-item (click)="addSchemaField('currency')">
                  <mat-icon>attach_money</mat-icon> Currency
                </button>
                <button mat-menu-item (click)="addSchemaField('email')">
                  <mat-icon>email</mat-icon> Email
                </button>
                <button mat-menu-item (click)="addSchemaField('phone')">
                  <mat-icon>phone</mat-icon> Phone
                </button>
              </mat-menu>
            </div>

            @if (schemaFields.length === 0) {
              <div class="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                <mat-icon class="!text-5xl !w-12 !h-12 mb-3 text-gray-300">schema</mat-icon>
                <p class="font-medium">No properties defined</p>
                <p class="text-sm mt-1">Add case data properties to build your data model</p>
              </div>
            } @else {
              <!-- Schema Table -->
              <mat-card class="!shadow-sm border border-gray-100 !rounded-xl overflow-hidden">
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="bg-gray-50 border-b border-gray-200">
                        <th class="text-left px-4 py-3 font-semibold text-gray-600 w-1/4">Name</th>
                        <th class="text-left px-4 py-3 font-semibold text-gray-600 w-1/6">Type</th>
                        <th class="text-left px-4 py-3 font-semibold text-gray-600 w-1/5">Default</th>
                        <th class="text-center px-4 py-3 font-semibold text-gray-600 w-20">Required</th>
                        <th class="text-left px-4 py-3 font-semibold text-gray-600">Options / Notes</th>
                        <th class="px-4 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (field of schemaFields; track field.name; let i = $index) {
                        <tr class="border-b border-gray-100 hover:bg-gray-50">
                          <td class="px-4 py-2">
                            <input class="w-full border-0 bg-transparent text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 py-0.5"
                                   [value]="field.name" (change)="renameSchemaField(i, $any($event.target).value)">
                          </td>
                          <td class="px-4 py-2">
                            <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">{{ field.type }}</span>
                          </td>
                          <td class="px-4 py-2">
                            <input class="w-full border border-gray-200 rounded text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                   [value]="field.defaultValue || ''" (change)="updateSchemaDefault(i, $any($event.target).value)" placeholder="—">
                          </td>
                          <td class="px-4 py-2 text-center">
                            <mat-slide-toggle [checked]="field.required" (change)="toggleSchemaRequired(i, $event.checked)"></mat-slide-toggle>
                          </td>
                          <td class="px-4 py-2">
                            @if (field.type === 'select') {
                              <input class="w-full border border-gray-200 rounded text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                     [value]="(field.options || []).join(', ')" (change)="updateSchemaOptions(i, $any($event.target).value)" placeholder="option1, option2, ...">
                            } @else {
                              <span class="text-xs text-gray-400">—</span>
                            }
                          </td>
                          <td class="px-4 py-2">
                            <button mat-icon-button class="!w-7 !h-7" (click)="removeSchemaField(i)">
                              <mat-icon class="!text-base text-gray-400 hover:text-red-500">delete</mat-icon>
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </mat-card>
            }
          </div>
        </mat-tab>

        <mat-tab label="Views">
          <div class="mt-4 space-y-4" style="min-height: 500px;">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="text-lg font-semibold text-gray-800">Forms & Views</h2>
                <p class="text-xs text-gray-500">Manage form definitions associated with this case type</p>
              </div>
              <button mat-raised-button color="primary" routerLink="/admin/forms">
                <mat-icon class="mr-1">open_in_new</mat-icon> Open Form Builder
              </button>
            </div>

            @if (caseTypeForms.length === 0) {
              <div class="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                <mat-icon class="!text-5xl !w-12 !h-12 mb-3 text-gray-300">view_quilt</mat-icon>
                <p class="font-medium">No forms defined</p>
                <p class="text-sm mt-1">Use the Form Builder to create forms, then link them to steps</p>
              </div>
            } @else {
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                @for (form of caseTypeForms; track form.id) {
                  <mat-card class="!shadow-sm border border-gray-100 !rounded-xl">
                    <mat-card-header class="!px-4 !py-3">
                      <mat-icon mat-card-avatar class="!text-blue-500">description</mat-icon>
                      <mat-card-title class="!text-sm !font-semibold">{{ form.name }}</mat-card-title>
                      <mat-card-subtitle class="!text-xs">
                        {{ form.fields.length }} field{{ form.fields.length !== 1 ? 's' : '' }}
                        · v{{ form.version }}
                        @if (form.stage) { · Stage: {{ form.stage }} }
                      </mat-card-subtitle>
                    </mat-card-header>
                    <mat-card-content class="!px-4 !pb-3">
                      @if (form.description) {
                        <p class="text-xs text-gray-500 mb-2">{{ form.description }}</p>
                      }
                      <div class="flex flex-wrap gap-1.5">
                        @for (field of form.fields.slice(0, 6); track field.id) {
                          <span class="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {{ field.label }} ({{ field.type }})
                          </span>
                        }
                        @if (form.fields.length > 6) {
                          <span class="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                            +{{ form.fields.length - 6 }} more
                          </span>
                        }
                      </div>
                      <div class="mt-3 flex items-center gap-2">
                        <span class="text-[10px] text-gray-400">Used by steps:</span>
                        @for (stepName of getStepsUsingForm(form.id); track stepName) {
                          <span class="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{{ stepName }}</span>
                        }
                        @if (getStepsUsingForm(form.id).length === 0) {
                          <span class="text-[10px] text-gray-400 italic">not linked</span>
                        }
                      </div>
                    </mat-card-content>
                  </mat-card>
                }
              </div>
            }
          </div>
        </mat-tab>

        <mat-tab label="Settings">
          <div class="mt-4 space-y-6" style="min-height: 500px;">
            <h2 class="text-lg font-semibold text-gray-800">Case Type Settings</h2>

            <!-- General -->
            <mat-card class="!shadow-sm border border-gray-100 !rounded-xl">
              <mat-card-header class="!px-4 !py-3 border-b border-gray-100">
                <mat-card-title class="!text-sm !font-semibold">General</mat-card-title>
              </mat-card-header>
              <mat-card-content class="!p-4 space-y-4">
                <mat-form-field class="w-full"  >
                  <mat-label>Description</mat-label>
                  <textarea matInput [(ngModel)]="caseType.description" (blur)="markDirty()" rows="3" placeholder="Brief description of this case type"></textarea>
                </mat-form-field>
                <div class="grid grid-cols-2 gap-4">
                  <mat-form-field  >
                    <mat-label>Icon</mat-label>
                    <input matInput [(ngModel)]="caseType.icon" (blur)="markDirty()" placeholder="e.g. folder">
                    <mat-icon matSuffix>{{ caseType.icon || 'folder' }}</mat-icon>
                  </mat-form-field>
                  <mat-form-field  >
                    <mat-label>ID Prefix</mat-label>
                    <input matInput [(ngModel)]="caseType.prefix" (blur)="markDirty()" placeholder="e.g. CLM">
                    <mat-hint>{{ caseType.prefix }}-001, {{ caseType.prefix }}-002, ...</mat-hint>
                  </mat-form-field>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <mat-form-field  >
                    <mat-label>Slug</mat-label>
                    <input matInput [(ngModel)]="caseType.slug" (blur)="markDirty()">
                  </mat-form-field>
                  <div class="flex items-center gap-4 pt-3">
                    <mat-slide-toggle [(ngModel)]="caseType.isActive" (ngModelChange)="markDirty()">
                      Active
                    </mat-slide-toggle>
                    <span class="text-xs text-gray-500">v{{ caseType.version }}</span>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>

            <!-- Attachment Categories -->
            <mat-card class="!shadow-sm border border-gray-100 !rounded-xl">
              <mat-card-header class="!px-4 !py-3 border-b border-gray-100">
                <mat-card-title class="!text-sm !font-semibold flex items-center gap-2">
                  <mat-icon class="!text-base">attach_file</mat-icon> Attachment Categories
                </mat-card-title>
              </mat-card-header>
              <mat-card-content class="!p-4">
                @if (caseType.attachmentCategories.length === 0) {
                  <p class="text-xs text-gray-400 text-center py-4">No attachment categories defined</p>
                } @else {
                  <div class="space-y-2 mb-3">
                    @for (cat of caseType.attachmentCategories; track cat.id; let ci = $index) {
                      <div class="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 bg-white">
                        <div class="flex-1 min-w-0">
                          <input class="text-sm font-medium bg-transparent border-0 w-full focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1"
                                 [(ngModel)]="cat.name" (ngModelChange)="markDirty()">
                        </div>
                        <mat-slide-toggle class="!text-xs" [(ngModel)]="cat.requiredForResolution" (ngModelChange)="markDirty()">
                          Required
                        </mat-slide-toggle>
                        <input class="text-xs border border-gray-200 rounded px-2 py-1 w-32 focus:outline-none focus:ring-1 focus:ring-blue-400"
                               [value]="(cat.allowedTypes || []).join(', ')" (change)="updateCategoryTypes(ci, $any($event.target).value)" placeholder="pdf, jpg, ...">
                        <button mat-icon-button class="!w-7 !h-7" (click)="removeAttachmentCategory(ci)">
                          <mat-icon class="!text-base text-gray-400 hover:text-red-500">close</mat-icon>
                        </button>
                      </div>
                    }
                  </div>
                }
                <button mat-stroked-button class="!text-xs" (click)="addAttachmentCategory()">
                  <mat-icon class="!text-sm mr-1">add</mat-icon> Add Category
                </button>
              </mat-card-content>
            </mat-card>

            <!-- Case-Wide Actions -->
            <mat-card class="!shadow-sm border border-gray-100 !rounded-xl">
              <mat-card-header class="!px-4 !py-3 border-b border-gray-100">
                <mat-card-title class="!text-sm !font-semibold flex items-center gap-2">
                  <mat-icon class="!text-base">bolt</mat-icon> Case-Wide Actions
                </mat-card-title>
              </mat-card-header>
              <mat-card-content class="!p-4">
                <div class="flex flex-wrap gap-2 mb-3">
                  @for (action of caseType.caseWideActions; track action; let ai = $index) {
                    <span class="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full flex items-center gap-1">
                      {{ action }}
                      <mat-icon class="!text-xs cursor-pointer hover:text-red-500" (click)="removeCaseAction(ai)">close</mat-icon>
                    </span>
                  }
                  @if (caseType.caseWideActions.length === 0) {
                    <span class="text-xs text-gray-400">No custom actions defined</span>
                  }
                </div>
                <mat-form-field class="w-full">
                  <mat-label>Add Action</mat-label>
                  <input matInput #actionInput placeholder="e.g. Escalate, Transfer, Flag for Review" (keyup.enter)="addCaseAction(actionInput.value); actionInput.value = ''">
                  <mat-hint>Press Enter to add</mat-hint>
                </mat-form-field>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>
    }
  `,
  styles: [`
    .stage-chevron {
      clip-path: polygon(0% 0%, 90% 0%, 100% 50%, 90% 100%, 0% 100%, 10% 50%);
    }
    .stage-chevron:first-child {
      clip-path: polygon(0% 0%, 90% 0%, 100% 50%, 90% 100%, 0% 100%);
    }
    .stage-chevron-active {
      background-color: #056DAE;
      color: white;
    }
    .stage-chevron-inactive {
      background-color: #e2e8f0;
      color: #334155;
    }
    .stage-chevron-inactive:hover {
      background-color: #cbd5e1;
    }
    :host ::ng-deep .designer-tabs .mat-mdc-tab-header {
      border-bottom: 1px solid #e5e7eb;
    }
  `],
})
export class CaseTypeDesignerComponent implements OnInit, OnDestroy {
  caseType: CaseTypeDefinition | null = null;
  selectedTab = 0;

  isLoading = signal(false);
  isSaving = signal(false);

  selectedStageId = signal<string | null>(null);
  selectedProcessId = signal<string | null>(null);
  selectedStepId = signal<string | null>(null);
  configPanelMode = signal<ConfigPanelMode>('none');

  // Data Model tab — structured view of fieldSchema
  schemaFields: { name: string; type: string; defaultValue: string; required: boolean; options?: string[] }[] = [];

  // Views tab — forms for this case type
  caseTypeForms: FormDefinition[] = [];

  private destroy$ = new Subject<void>();
  private caseTypeId = '';
  private dataService: DataService;

  primaryStages = computed(() =>
    this.caseType?.stages.filter(s => s.stageType === 'primary').sort((a, b) => a.order - b.order) ?? []
  );

  alternateStages = computed(() =>
    this.caseType?.stages.filter(s => s.stageType === 'alternate').sort((a, b) => a.order - b.order) ?? []
  );

  selectedStage = computed(() =>
    this.caseType?.stages.find(s => s.id === this.selectedStageId()) ?? null
  );

  selectedProcess = computed(() => {
    const stage = this.selectedStage();
    if (!stage) return null;
    return stage.processes.find(p => p.id === this.selectedProcessId()) ?? null;
  });

  selectedStep = computed(() => {
    const process = this.selectedProcess();
    if (!process) return null;
    return process.steps.find(s => s.id === this.selectedStepId()) ?? null;
  });

  constructor(
    private store: Store,
    private route: ActivatedRoute,
    private router: Router,
    private snackBar: MatSnackBar,
    dataService: DataService,
  ) {
    this.dataService = dataService;
  }

  ngOnInit(): void {
    this.caseTypeId = this.route.snapshot.paramMap.get('id') || '';

    if (this.caseTypeId && this.caseTypeId !== 'new') {
      this.isLoading.set(true);
      this.store.dispatch(CaseTypesActions.loadCaseTypeDefinition({ id: this.caseTypeId }));
    } else {
      // New case type — scaffold default
      this.caseType = this.scaffoldNewCaseType();
      this.selectStage(this.caseType.stages[0]);
    }

    this.store.select(selectSelectedCaseTypeDefinition).pipe(takeUntil(this.destroy$)).subscribe(def => {
      if (def) {
        // Deep clone to allow local mutations
        this.caseType = JSON.parse(JSON.stringify(def));
        this.isLoading.set(false);
        this.syncSchemaFields();
        this.loadCaseTypeForms();
        if (!this.selectedStageId() && this.caseType!.stages.length > 0) {
          this.selectStage(this.caseType!.stages[0]);
        }
      }
    });

    this.store.select(selectCaseTypesLoading).pipe(takeUntil(this.destroy$)).subscribe(l => this.isLoading.set(l));
    this.store.select(selectCaseTypesError).pipe(takeUntil(this.destroy$)).subscribe(err => {
      if (err) this.snackBar.open(err, 'Close', { duration: 4000 });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Stage Actions ---

  selectStage(stage: StageDefinition): void {
    this.selectedStageId.set(stage.id);
    this.selectedProcessId.set(null);
    this.selectedStepId.set(null);
    this.configPanelMode.set('stage');
  }

  addStage(type: StageType): void {
    if (!this.caseType) return;
    const existing = this.caseType.stages.filter(s => s.stageType === type);
    const stage: StageDefinition = {
      id: this.generateId(),
      name: type === 'primary' ? `Stage ${existing.length + 1}` : `Alternate ${existing.length + 1}`,
      stageType: type,
      order: existing.length + 1,
      onComplete: type === 'primary' ? 'auto_advance' : 'resolve_case',
      resolutionStatus: type === 'alternate' ? 'resolved_cancelled' : null,
      skipWhen: null,
      entryCriteria: null,
      slaHours: null,
      processes: [],
    };
    this.caseType.stages.push(stage);
    this.selectStage(stage);
    this.markDirty();
  }

  onDeleteStage(stage: StageDefinition): void {
    if (!this.caseType) return;
    this.caseType.stages = this.caseType.stages.filter(s => s.id !== stage.id);
    if (this.selectedStageId() === stage.id) {
      this.selectedStageId.set(null);
      this.configPanelMode.set('none');
    }
    this.markDirty();
  }

  onStageConfigChange(stage: StageDefinition): void {
    if (!this.caseType) return;
    const idx = this.caseType.stages.findIndex(s => s.id === stage.id);
    if (idx >= 0) this.caseType.stages[idx] = stage;
    this.markDirty();
  }

  // --- Process Actions ---

  selectProcess(process: ProcessDefinition, event: Event): void {
    event.stopPropagation();
    this.selectedProcessId.set(process.id);
    this.selectedStepId.set(null);
    this.configPanelMode.set('process');
  }

  addProcess(parallel: boolean): void {
    const stage = this.selectedStage();
    if (!stage) return;
    const process: ProcessDefinition = {
      id: this.generateId(),
      name: parallel ? 'Parallel Process' : 'Process ' + (stage.processes.length + 1),
      type: parallel ? 'parallel' : 'sequential',
      order: stage.processes.length + 1,
      isParallel: parallel,
      startWhen: null,
      slaHours: null,
      steps: [],
    };
    stage.processes.push(process);
    this.markDirty();
  }

  onDeleteProcess(process: ProcessDefinition): void {
    const stage = this.selectedStage();
    if (!stage) return;
    stage.processes = stage.processes.filter(p => p.id !== process.id);
    if (this.selectedProcessId() === process.id) {
      this.selectedProcessId.set(null);
      this.configPanelMode.set('stage');
    }
    this.markDirty();
  }

  onProcessConfigChange(process: ProcessDefinition): void {
    const stage = this.selectedStage();
    if (!stage) return;
    const idx = stage.processes.findIndex(p => p.id === process.id);
    if (idx >= 0) stage.processes[idx] = process;
    this.markDirty();
  }

  // --- Step Actions ---

  selectStep(step: StepDefinition, process: ProcessDefinition, event: Event): void {
    event.stopPropagation();
    this.selectedProcessId.set(process.id);
    this.selectedStepId.set(step.id);
    this.configPanelMode.set('step');
  }

  addStep(process: ProcessDefinition, type: StepType): void {
    const nameMap: Record<StepType, string> = {
      assignment: 'Collect Information',
      approval: 'Approve / Reject',
      attachment: 'Upload Documents',
      decision: 'Decision',
      automation: 'Automation',
      subprocess: 'Subprocess',
    };
    const step: StepDefinition = {
      id: this.generateId(),
      name: nameMap[type],
      type,
      order: process.steps.length + 1,
      required: true,
      skipWhen: null,
      visibleWhen: null,
      slaHours: null,
      config: {},
    };
    process.steps.push(step);
    this.markDirty();
  }

  removeStep(process: ProcessDefinition, index: number): void {
    const removed = process.steps[index];
    process.steps.splice(index, 1);
    if (this.selectedStepId() === removed.id) {
      this.selectedStepId.set(null);
      this.configPanelMode.set('process');
    }
    this.markDirty();
  }

  onStepConfigChange(step: StepDefinition): void {
    const process = this.selectedProcess();
    if (!process) return;
    const idx = process.steps.findIndex(s => s.id === step.id);
    if (idx >= 0) process.steps[idx] = step;
    this.markDirty();
  }

  // --- Save ---

  save(): void {
    if (!this.caseType) return;
    this.isSaving.set(true);

    if (this.caseTypeId === 'new' || !this.caseType.id) {
      this.store.dispatch(CaseTypesActions.createCaseTypeDefinition({
        request: {
          name: this.caseType.name,
          slug: this.caseType.slug,
          description: this.caseType.description,
          icon: this.caseType.icon,
          prefix: this.caseType.prefix,
          fieldSchema: this.caseType.fieldSchema,
          stages: this.caseType.stages,
          attachmentCategories: this.caseType.attachmentCategories,
        },
      }));
    } else {
      this.store.dispatch(CaseTypesActions.updateCaseTypeDefinition({
        id: this.caseType.id,
        request: {
          name: this.caseType.name,
          slug: this.caseType.slug,
          description: this.caseType.description,
          icon: this.caseType.icon,
          prefix: this.caseType.prefix,
          fieldSchema: this.caseType.fieldSchema,
          isActive: this.caseType.isActive,
          stages: this.caseType.stages,
          attachmentCategories: this.caseType.attachmentCategories,
        },
      }));
    }

    // The store will update; stop saving spinner after a short delay
    setTimeout(() => this.isSaving.set(false), 1000);
  }

  markDirty(): void {
    // Signal for future unsaved-changes guard
  }

  // --- Utilities ---

  stepIcon(type: StepType): string {
    const icons: Record<StepType, string> = {
      assignment: '\uD83D\uDCDD',
      approval: '\u2705',
      attachment: '\uD83D\uDCCE',
      decision: '\uD83D\uDD00',
      automation: '\u26A1',
      subprocess: '\uD83D\uDCE6',
    };
    return icons[type] || '\u2022';
  }

  // --- Data Model Tab (Schema Fields) ---

  private syncSchemaFields(): void {
    if (!this.caseType) return;
    this.schemaFields = Object.entries(this.caseType.fieldSchema || {}).map(([name, def]) => ({
      name,
      type: (def as any)?.type || 'text',
      defaultValue: (def as any)?.defaultValue || '',
      required: !!(def as any)?.required,
      options: (def as any)?.options,
    }));
  }

  private syncFieldSchemaFromFields(): void {
    if (!this.caseType) return;
    const schema: Record<string, any> = {};
    for (const f of this.schemaFields) {
      schema[f.name] = {
        type: f.type,
        defaultValue: f.defaultValue || undefined,
        required: f.required,
        ...(f.options?.length ? { options: f.options } : {}),
      };
    }
    this.caseType.fieldSchema = schema;
    this.markDirty();
  }

  addSchemaField(type: string): void {
    const name = 'field_' + (this.schemaFields.length + 1);
    this.schemaFields.push({ name, type, defaultValue: '', required: false, options: type === 'select' ? [] : undefined });
    this.syncFieldSchemaFromFields();
  }

  removeSchemaField(i: number): void {
    this.schemaFields.splice(i, 1);
    this.syncFieldSchemaFromFields();
  }

  renameSchemaField(i: number, newName: string): void {
    const cleaned = newName.trim().replace(/\s+/g, '_').toLowerCase();
    if (!cleaned) return;
    this.schemaFields[i].name = cleaned;
    this.syncFieldSchemaFromFields();
  }

  updateSchemaDefault(i: number, val: string): void {
    this.schemaFields[i].defaultValue = val;
    this.syncFieldSchemaFromFields();
  }

  toggleSchemaRequired(i: number, checked: boolean): void {
    this.schemaFields[i].required = checked;
    this.syncFieldSchemaFromFields();
  }

  updateSchemaOptions(i: number, val: string): void {
    this.schemaFields[i].options = val.split(',').map(s => s.trim()).filter(Boolean);
    this.syncFieldSchemaFromFields();
  }

  // --- Views Tab ---

  private loadCaseTypeForms(): void {
    if (!this.caseType) return;
    this.dataService.getFormDefinitions(this.caseType.id).pipe(takeUntil(this.destroy$)).subscribe(forms => {
      this.caseTypeForms = forms;
    });
  }

  getStepsUsingForm(formId: string): string[] {
    if (!this.caseType) return [];
    const names: string[] = [];
    for (const stage of this.caseType.stages) {
      for (const proc of stage.processes) {
        for (const step of proc.steps) {
          if (step.config.formId === formId) {
            names.push(step.name);
          }
        }
      }
    }
    return names;
  }

  // --- Settings Tab ---

  addAttachmentCategory(): void {
    if (!this.caseType) return;
    const cat: AttachmentCategory = {
      id: this.generateId(),
      name: 'New Category',
      requiredForResolution: false,
      allowedTypes: [],
    };
    this.caseType.attachmentCategories.push(cat);
    this.markDirty();
  }

  removeAttachmentCategory(i: number): void {
    if (!this.caseType) return;
    this.caseType.attachmentCategories.splice(i, 1);
    this.markDirty();
  }

  updateCategoryTypes(i: number, val: string): void {
    if (!this.caseType) return;
    this.caseType.attachmentCategories[i].allowedTypes = val.split(',').map(s => s.trim()).filter(Boolean);
    this.markDirty();
  }

  addCaseAction(action: string): void {
    if (!this.caseType || !action.trim()) return;
    this.caseType.caseWideActions.push(action.trim());
    this.markDirty();
  }

  removeCaseAction(i: number): void {
    if (!this.caseType) return;
    this.caseType.caseWideActions.splice(i, 1);
    this.markDirty();
  }

  private generateId(): string {
    return 'tmp_' + Math.random().toString(36).substring(2, 10);
  }

  private scaffoldNewCaseType(): CaseTypeDefinition {
    const createStage: StageDefinition = {
      id: this.generateId(),
      name: 'Create',
      stageType: 'primary',
      order: 1,
      onComplete: 'auto_advance',
      resolutionStatus: null,
      skipWhen: null,
      entryCriteria: null,
      slaHours: null,
      processes: [{
        id: this.generateId(),
        name: 'Collect Information',
        type: 'sequential',
        order: 1,
        isParallel: false,
        startWhen: null,
        slaHours: null,
        steps: [{
          id: this.generateId(),
          name: 'Fill Application Form',
          type: 'assignment',
          order: 1,
          required: true,
          skipWhen: null,
          visibleWhen: null,
          slaHours: null,
          config: {},
        }],
      }],
    };

    return {
      id: '',
      name: 'New Case Type',
      slug: 'new_case_type',
      description: '',
      icon: 'folder',
      prefix: 'NEW',
      fieldSchema: {},
      stages: [createStage],
      attachmentCategories: [],
      caseWideActions: [],
      version: 1,
      isActive: true,
    };
  }
}
