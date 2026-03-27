import { Component, Input, Output, EventEmitter, OnChanges, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import {
  StepDefinition,
  StepType,
  CaseTypeDefinition,
  StageDefinition,
  DecisionBranch,
  AutomationAction,
  AutomationRule,
} from '@core/models';
import { RuleBuilderComponent, RuleCondition } from '@shared/rule-builder/rule-builder.component';
import { DataService } from '@core/services/data.service';
import { FormDefinition, FormField, DecisionTable } from '@core/models';

@Component({
  selector: 'app-step-config-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatMenuModule,
    RuleBuilderComponent,
  ],
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .panel-scroll {
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
    }
    .panel-scroll::-webkit-scrollbar { width: 4px; }
    .panel-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
    .section-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
    }
  `],
  template: `
    <!-- Panel body -->
    <div class="flex flex-col flex-1 overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">

      <!-- ── Header ── -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-200"
           [ngClass]="stepHeaderGradient(step.type)">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
             [ngClass]="stepBgColor(step.type)">
          <mat-icon class="!text-[18px] text-white">{{ stepMatIcon(step.type) }}</mat-icon>
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-sm font-bold text-slate-800 leading-tight truncate">{{ step.name || 'Untitled Step' }}</h2>
          <p class="text-[11px] text-slate-500 mt-0.5">{{ stepTypeLabel(step.type) }}</p>
        </div>
        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0"
              [ngClass]="stepBadgeClass(step.type)">
          {{ step.type | uppercase }}
        </span>
      </div>

      <!-- ── Scrollable content ── -->
      <div class="flex-1 overflow-y-auto panel-scroll px-4 divide-y divide-slate-100">

        <!-- ══ SECTION: Basic Information ══ -->
        <div class="py-5">
          <div class="flex items-center gap-2 mb-0.5">
            <mat-icon class="!text-[15px] text-primary-500">drive_file_rename_outline</mat-icon>
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Basic Information</span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Name, type, and classification of this step</p>
          <div class="section-card space-y-3">
            <mat-form-field class="w-full" subscriptSizing="dynamic">
              <mat-label>Step Name</mat-label>
              <input matInput [(ngModel)]="step.name" (ngModelChange)="emitChange()">
            </mat-form-field>

            <mat-form-field class="w-full" subscriptSizing="dynamic">
              <mat-label>Step Type</mat-label>
              <mat-select [(ngModel)]="step.type" (ngModelChange)="onTypeChange()">
                <mat-option value="assignment">
                  <span class="flex items-center gap-2"><mat-icon class="!text-base text-indigo-500">edit_note</mat-icon> Assignment</span>
                </mat-option>
                <mat-option value="approval">
                  <span class="flex items-center gap-2"><mat-icon class="!text-base text-emerald-500">verified</mat-icon> Approval</span>
                </mat-option>
                <mat-option value="attachment">
                  <span class="flex items-center gap-2"><mat-icon class="!text-base text-purple-500">attach_file</mat-icon> Attachment</span>
                </mat-option>
                <mat-option value="decision">
                  <span class="flex items-center gap-2"><mat-icon class="!text-base text-amber-500">alt_route</mat-icon> Decision</span>
                </mat-option>
                <mat-option value="automation">
                  <span class="flex items-center gap-2"><mat-icon class="!text-base text-orange-500">bolt</mat-icon> Automation</span>
                </mat-option>
                <mat-option value="subprocess">
                  <span class="flex items-center gap-2"><mat-icon class="!text-base text-slate-500">account_tree</mat-icon> Subprocess</span>
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <!-- ══ SECTION: Execution Control ══ -->
        <div class="py-5">
          <div class="flex items-center gap-2 mb-0.5">
            <mat-icon class="!text-[15px] text-emerald-500">tune</mat-icon>
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Execution Control</span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Mandate completion and enforce time-based SLAs</p>
          <div class="section-card space-y-3">
            <div class="flex items-center justify-between gap-4">
              <div class="min-w-0">
                <p class="text-xs font-semibold text-slate-700">Required</p>
                <p class="text-[11px] text-slate-400 leading-snug">Block case progress until this step is complete</p>
              </div>
              <mat-slide-toggle [(ngModel)]="step.required" (ngModelChange)="emitChange()" class="flex-shrink-0"></mat-slide-toggle>
            </div>
            <mat-divider></mat-divider>
            <mat-form-field class="w-full">
              <mat-label>SLA (hours)</mat-label>
              <mat-icon matPrefix class="!text-base mr-1 text-slate-400">schedule</mat-icon>
              <input matInput type="number" [(ngModel)]="step.slaHours" (ngModelChange)="emitChange()" min="0" placeholder="e.g. 24">
              <mat-hint>Leave blank for no time limit</mat-hint>
            </mat-form-field>
          </div>
        </div>

        <!-- ══ SECTION: Skip When ══ -->
        <div class="py-5">
          <div class="flex items-center gap-2 mb-0.5">
            <mat-icon class="!text-[15px] text-amber-500">skip_next</mat-icon>
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Skip When</span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Conditions that cause this step to be automatically bypassed at runtime</p>
          <app-rule-builder
            [condition]="skipWhenCondition"
            [fields]="fieldNames"
            (conditionChange)="onSkipWhenChange($event)"
          ></app-rule-builder>
        </div>

        <!-- ══ SECTION: Type-Specific Settings ══ -->
        @switch (step.type) {
          @case ('assignment') {
            <div class="py-5">
              <div class="flex items-center gap-2 mb-0.5">
                <mat-icon class="!text-[15px] text-indigo-500">edit_note</mat-icon>
                <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Assignment Settings</span>
              </div>
              <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Configure task routing, form, and instructions for assignees</p>
              <div class="section-card space-y-3">

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Route To (Role)</mat-label>
                <input matInput [(ngModel)]="step.config.assigneeRole" (ngModelChange)="emitChange()" placeholder="e.g. caseworker">
              </mat-form-field>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Specific User ID</mat-label>
                <input matInput [(ngModel)]="step.config.assigneeUserId" (ngModelChange)="emitChange()" placeholder="Optional">
              </mat-form-field>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Form</mat-label>
                <mat-select [(ngModel)]="step.config.formId" (ngModelChange)="emitChange()">
                  <mat-option [value]="null">— None —</mat-option>
                  @for (form of formDefinitions; track form.id) {
                    <mat-option [value]="form.id">{{ form.name }}</mat-option>
                  }
                </mat-select>
                <mat-hint>Select a saved form, or add inline fields below</mat-hint>
              </mat-form-field>

              <!-- Inline Form Fields Editor -->
              <div class="border border-gray-200 rounded">
                <div class="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded-t border-b border-gray-200 cursor-pointer"
                     (click)="showFormFields = !showFormFields">
                  <span class="text-xs font-semibold text-gray-600 flex items-center gap-1">
                    <mat-icon class="!text-sm">dynamic_form</mat-icon>
                    Inline Form Fields ({{ (step.config.formFields || []).length }})
                  </span>
                  <mat-icon class="!text-base text-gray-400">{{ showFormFields ? 'expand_less' : 'expand_more' }}</mat-icon>
                </div>
                @if (showFormFields) {
                  <div class="p-2 space-y-2">
                    @for (field of step.config.formFields || []; track $index; let fi = $index) {
                      <div class="border border-gray-200 rounded p-2 space-y-1 bg-white">
                        <div class="flex items-center justify-between">
                          <span class="text-xs font-medium text-gray-500">Field {{ fi + 1 }}</span>
                          <button mat-icon-button class="!w-5 !h-5" (click)="removeFormField(fi)">
                            <mat-icon class="!text-sm text-gray-400 hover:text-red-500">close</mat-icon>
                          </button>
                        </div>
                        <div class="grid grid-cols-2 gap-1.5">
                          <mat-form-field class="col-span-2" subscriptSizing="dynamic">
                            <mat-label>Label</mat-label>
                            <input matInput [(ngModel)]="field.label" (ngModelChange)="emitChange()">
                          </mat-form-field>
                          <mat-form-field subscriptSizing="dynamic">
                            <mat-label>Type</mat-label>
                            <mat-select [(ngModel)]="field.type" (ngModelChange)="emitChange()">
                              <mat-option value="text">Text</mat-option>
                              <mat-option value="textarea">Text Area</mat-option>
                              <mat-option value="number">Number</mat-option>
                              <mat-option value="date">Date</mat-option>
                              <mat-option value="select">Dropdown</mat-option>
                              <mat-option value="checkbox">Checkbox</mat-option>
                              <mat-option value="radio">Radio</mat-option>
                              <mat-option value="file">File</mat-option>
                            </mat-select>
                          </mat-form-field>
                          <mat-form-field subscriptSizing="dynamic">
                            <mat-label>Placeholder</mat-label>
                            <input matInput [(ngModel)]="field.placeholder" (ngModelChange)="emitChange()">
                          </mat-form-field>
                        </div>
                        <div class="flex items-center gap-2">
                          <mat-slide-toggle [checked]="field.validation.required" (change)="toggleFieldRequired(fi, $event.checked)">
                            Required
                          </mat-slide-toggle>
                        </div>
                        @if (field.type === 'select' || field.type === 'radio') {
                          <mat-form-field class="w-full" subscriptSizing="dynamic">
                            <mat-label>Options (comma-separated)</mat-label>
                            <input matInput [ngModel]="(field.validation.options || []).join(', ')" (ngModelChange)="updateFieldOptions(fi, $event)">
                          </mat-form-field>
                        }
                        @if (field.type === 'text' || field.type === 'textarea') {
                          <div class="grid grid-cols-2 gap-1.5">
                            <mat-form-field subscriptSizing="dynamic">
                              <mat-label>Min Length</mat-label>
                              <input matInput type="number" [ngModel]="field.validation.minLength" (ngModelChange)="updateFieldValidation(fi, 'minLength', $event)" min="0">
                            </mat-form-field>
                            <mat-form-field subscriptSizing="dynamic">
                              <mat-label>Max Length</mat-label>
                              <input matInput type="number" [ngModel]="field.validation.maxLength" (ngModelChange)="updateFieldValidation(fi, 'maxLength', $event)" min="0">
                            </mat-form-field>
                          </div>
                        }
                        @if (field.type === 'number') {
                          <div class="grid grid-cols-2 gap-1.5">
                            <mat-form-field subscriptSizing="dynamic">
                              <mat-label>Min Value</mat-label>
                              <input matInput type="number" [ngModel]="field.validation.minValue" (ngModelChange)="updateFieldValidation(fi, 'minValue', $event)">
                            </mat-form-field>
                            <mat-form-field subscriptSizing="dynamic">
                              <mat-label>Max Value</mat-label>
                              <input matInput type="number" [ngModel]="field.validation.maxValue" (ngModelChange)="updateFieldValidation(fi, 'maxValue', $event)">
                            </mat-form-field>
                          </div>
                        }
                      </div>
                    }
                    <div class="flex gap-1.5">
                      <button mat-stroked-button class="!text-xs !py-0 !min-h-[28px]" [matMenuTriggerFor]="addFieldMenu">
                        <mat-icon class="!text-sm mr-1">add</mat-icon> Add Field
                      </button>
                      <mat-menu #addFieldMenu="matMenu">
                        <button mat-menu-item (click)="addFormField('text')">
                          <mat-icon>text_fields</mat-icon> Text
                        </button>
                        <button mat-menu-item (click)="addFormField('textarea')">
                          <mat-icon>notes</mat-icon> Text Area
                        </button>
                        <button mat-menu-item (click)="addFormField('number')">
                          <mat-icon>pin</mat-icon> Number
                        </button>
                        <button mat-menu-item (click)="addFormField('date')">
                          <mat-icon>calendar_today</mat-icon> Date
                        </button>
                        <button mat-menu-item (click)="addFormField('select')">
                          <mat-icon>arrow_drop_down_circle</mat-icon> Dropdown
                        </button>
                        <button mat-menu-item (click)="addFormField('checkbox')">
                          <mat-icon>check_box</mat-icon> Checkbox
                        </button>
                        <button mat-menu-item (click)="addFormField('radio')">
                          <mat-icon>radio_button_checked</mat-icon> Radio
                        </button>
                        <button mat-menu-item (click)="addFormField('file')">
                          <mat-icon>attach_file</mat-icon> File Upload
                        </button>
                      </mat-menu>
                    </div>
                  </div>
                }
              </div>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Instructions</mat-label>
                <textarea matInput [(ngModel)]="step.config.instructions" (ngModelChange)="emitChange()" rows="2"></textarea>
              </mat-form-field>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Set Case Status on Entry</mat-label>
                <mat-select [(ngModel)]="step.config.setCaseStatus" (ngModelChange)="emitChange()">
                  <mat-option [value]="null">— None —</mat-option>
                  <mat-option value="open">Open</mat-option>
                  <mat-option value="in_progress">In Progress</mat-option>
                  <mat-option value="pending">Pending</mat-option>
                </mat-select>
              </mat-form-field>
              </div>
            </div>
          }

          @case ('approval') {
            <div class="py-5">
              <div class="flex items-center gap-2 mb-0.5">
                <mat-icon class="!text-[15px] text-emerald-500">verified</mat-icon>
                <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Approval Settings</span>
              </div>
              <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Define approval mode, approver hierarchy, and rejection routing</p>
              <div class="section-card space-y-3">

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Mode</mat-label>
                <mat-select [(ngModel)]="step.config.mode" (ngModelChange)="emitChange()">
                  <mat-option value="sequential">Sequential — approvers act one at a time</mat-option>
                  <mat-option value="parallel">Parallel — all approvers act simultaneously</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Approver Roles (comma-separated)</mat-label>
                <input matInput [ngModel]="approverRolesStr" (ngModelChange)="onApproverRolesChange($event)" placeholder="e.g. manager, director">
                <mat-hint>Roles that can approve this step</mat-hint>
              </mat-form-field>

              <div class="flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-slate-700">Allow Delegation</p>
                  <p class="text-[11px] text-slate-400">Approvers can delegate to another user</p>
                </div>
                <mat-slide-toggle [(ngModel)]="step.config.allowDelegation" (ngModelChange)="emitChange()" class="flex-shrink-0"></mat-slide-toggle>
              </div>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>On Rejection → Alternate Stage</mat-label>
                <mat-icon matPrefix class="!text-base mr-1 text-slate-400">undo</mat-icon>
                <mat-select [(ngModel)]="step.config.rejectionStageId" (ngModelChange)="emitChange()">
                  <mat-option [value]="null">— End case or stay in stage —</mat-option>
                  @for (s of alternateStages; track s.id) {
                    <mat-option [value]="s.id">{{ s.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              </div>
            </div>
          }

          @case ('attachment') {
            <div class="py-5">
              <div class="flex items-center gap-2 mb-0.5">
                <mat-icon class="!text-[15px] text-purple-500">attach_file</mat-icon>
                <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Attachment Settings</span>
              </div>
              <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Specify required document categories, file types, and size limits</p>
              <div class="section-card space-y-3">

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Required Categories (comma-separated)</mat-label>
                <mat-icon matPrefix class="!text-base mr-1 text-slate-400">folder</mat-icon>
                <input matInput [ngModel]="categoriesStr" (ngModelChange)="onCategoriesChange($event)" placeholder="e.g. id_document, proof_of_income">
              </mat-form-field>

              <div class="grid grid-cols-2 gap-3">
                <mat-form-field subscriptSizing="dynamic">
                  <mat-label>Min Files</mat-label>
                  <input matInput type="number" [(ngModel)]="step.config.minFiles" (ngModelChange)="emitChange()" min="0">
                </mat-form-field>
                <mat-form-field subscriptSizing="dynamic">
                  <mat-label>Max Size (MB)</mat-label>
                  <input matInput type="number" [(ngModel)]="step.config.maxFileSizeMb" (ngModelChange)="emitChange()" min="1">
                </mat-form-field>
              </div>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Allowed File Types (comma-separated)</mat-label>
                <mat-icon matPrefix class="!text-base mr-1 text-slate-400">description</mat-icon>
                <input matInput [ngModel]="allowedTypesStr" (ngModelChange)="onAllowedTypesChange($event)" placeholder="e.g. pdf, jpg, png">
              </mat-form-field>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Instructions</mat-label>
                <textarea matInput [(ngModel)]="step.config.instructions" (ngModelChange)="emitChange()" rows="2"></textarea>
              </mat-form-field>
              </div>
            </div>
          }

          @case ('decision') {
            <div class="py-5">
              <div class="flex items-center gap-2 mb-0.5">
                <mat-icon class="!text-[15px] text-amber-500">alt_route</mat-icon>
                <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Decision Settings</span>
              </div>
              <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Branch workflow by evaluating conditions or a decision table</p>
              <div class="section-card space-y-3">

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Evaluation Mode</mat-label>
                <mat-select [(ngModel)]="step.config.mode" (ngModelChange)="emitChange()">
                  <mat-option value="first_match">First Match — evaluate branches in order</mat-option>
                  <mat-option value="decision_table">Decision Table — use a pre-built table</mat-option>
                </mat-select>
              </mat-form-field>

              @if (step.config.mode !== 'decision_table') {
                <div class="space-y-2">
                  @for (branch of step.config.branches || []; track $index; let bi = $index) {
                    <div class="border border-amber-100 bg-amber-50/50 rounded-lg p-3 space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="text-[11px] font-semibold text-amber-700 flex items-center gap-1.5">
                          <mat-icon class="!text-sm">call_split</mat-icon>Branch {{ bi + 1 }}
                        </span>
                        <button mat-icon-button class="!w-6 !h-6" (click)="removeBranch(bi)">
                          <mat-icon class="!text-sm text-slate-400 hover:text-red-500">close</mat-icon>
                        </button>
                      </div>
                      <mat-form-field class="w-full" subscriptSizing="dynamic">
                        <mat-label>Branch Label</mat-label>
                        <input matInput [(ngModel)]="branch.label" (ngModelChange)="emitChange()">
                      </mat-form-field>
                      <div>
                        <p class="text-[11px] text-slate-500 font-medium mb-1">Condition</p>
                        <app-rule-builder
                          [condition]="branchConditions[bi] || null"
                          [fields]="fieldNames"
                          (conditionChange)="onBranchConditionChange(bi, $event)"
                        ></app-rule-builder>
                      </div>
                      <mat-form-field class="w-full" subscriptSizing="dynamic">
                        <mat-label>Route to Step ID</mat-label>
                        <mat-icon matPrefix class="!text-base mr-1 text-slate-400">arrow_forward</mat-icon>
                        <input matInput [(ngModel)]="branch.nextStepId" (ngModelChange)="emitChange()">
                      </mat-form-field>
                    </div>
                  }
                  <button mat-stroked-button class="!text-xs" (click)="addBranch()">
                    <mat-icon class="!text-sm mr-1">add</mat-icon> Add Branch
                  </button>
                </div>

                <mat-form-field class="w-full" subscriptSizing="dynamic">
                  <mat-label>Default (Fallback) Step ID</mat-label>
                  <mat-icon matPrefix class="!text-base mr-1 text-slate-400">last_page</mat-icon>
                  <input matInput [(ngModel)]="step.config.defaultStepId" (ngModelChange)="emitChange()">
                  <mat-hint>Used when no branch condition matches</mat-hint>
                </mat-form-field>
              } @else {
                <mat-form-field class="w-full" subscriptSizing="dynamic">
                  <mat-label>Decision Table</mat-label>
                  <mat-select [(ngModel)]="step.config.decisionTableId" (ngModelChange)="emitChange()">
                    <mat-option [value]="null">— None —</mat-option>
                    @for (dt of decisionTables; track dt.id) {
                      <mat-option [value]="dt.id">{{ dt.name }}</mat-option>
                    }
                  </mat-select>
                  <mat-hint>The table's output determines the next step</mat-hint>
                </mat-form-field>
              }
              </div>
            </div>
          }

          @case ('automation') {
            <div class="py-5">
              <div class="flex items-center gap-2 mb-0.5">
                <mat-icon class="!text-[15px] text-orange-500">bolt</mat-icon>
                <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Automation Settings</span>
              </div>
              <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Configure webhook calls and conditional execution rules</p>

              <!-- Webhook subsection -->
              <div class="mb-4">
                <div class="flex items-center gap-2 mb-2">
                  <mat-icon class="!text-[13px] text-slate-500">webhook</mat-icon>
                  <span class="text-[11px] font-semibold text-slate-600">Webhook</span>
                </div>
                <div class="section-card space-y-3">
                <mat-form-field class="w-full" subscriptSizing="dynamic">
                  <mat-label>URL</mat-label>
                  <mat-icon matPrefix class="!text-base mr-1 text-slate-400">link</mat-icon>
                  <input matInput [(ngModel)]="webhookUrl" (ngModelChange)="updateWebhook()" placeholder="https://api.example.com/endpoint">
                </mat-form-field>
                <mat-form-field class="w-full" subscriptSizing="dynamic">
                  <mat-label>HTTP Method</mat-label>
                  <mat-select [(ngModel)]="webhookMethod" (ngModelChange)="updateWebhook()">
                    <mat-option value="GET">GET</mat-option>
                    <mat-option value="POST">POST</mat-option>
                    <mat-option value="PUT">PUT</mat-option>
                    <mat-option value="PATCH">PATCH</mat-option>
                    <mat-option value="DELETE">DELETE</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field class="w-full" subscriptSizing="dynamic">
                  <mat-label>Headers (JSON)</mat-label>
                  <textarea matInput [(ngModel)]="webhookHeadersStr" (ngModelChange)="updateWebhook()" rows="3" placeholder='{"Authorization":"Bearer ...","Content-Type":"application/json"}'></textarea>
                  <mat-hint>Valid JSON object of header key-value pairs</mat-hint>
                </mat-form-field>
                </div>
              </div>

              <!-- Rules subsection -->
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <mat-icon class="!text-[13px] text-slate-500">rule</mat-icon>
                  <span class="text-[11px] font-semibold text-slate-600">Rules</span>
                </div>
                <div class="space-y-2">
                @for (rule of step.config.rules || []; track $index; let ri = $index) {
                  <div class="border border-orange-100 bg-orange-50/50 rounded-lg p-3 space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] font-semibold text-orange-700 flex items-center gap-1.5">
                        <mat-icon class="!text-sm">rule</mat-icon>Rule {{ ri + 1 }}
                      </span>
                      <button mat-icon-button class="!w-6 !h-6" (click)="removeRule(ri)">
                        <mat-icon class="!text-sm text-slate-400 hover:text-red-500">close</mat-icon>
                      </button>
                    </div>
                    <p class="text-[11px] text-slate-500 font-medium">Condition</p>
                    <app-rule-builder
                      [condition]="ruleConditions[ri] || null"
                      [fields]="fieldNames"
                      (conditionChange)="onRuleConditionChange(ri, $event)"
                    ></app-rule-builder>
                  </div>
                }
                </div>
                <button mat-stroked-button class="!text-xs mt-2" (click)="addRule()">
                  <mat-icon class="!text-sm mr-1">add</mat-icon> Add Rule
                </button>
              </div>
            </div>
          }

          @case ('subprocess') {
            <div class="py-5">
              <div class="flex items-center gap-2 mb-0.5">
                <mat-icon class="!text-[15px] text-slate-500">account_tree</mat-icon>
                <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Subprocess Settings</span>
              </div>
              <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Launch a child case and optionally map fields between parent and child</p>
              <div class="section-card space-y-3">

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Child Case Type ID</mat-label>
                <mat-icon matPrefix class="!text-base mr-1 text-slate-400">account_tree</mat-icon>
                <input matInput [(ngModel)]="step.config.childCaseTypeId" (ngModelChange)="emitChange()" placeholder="e.g. LOAN-APP">
              </mat-form-field>

              <div class="flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-slate-700">Wait for Resolution</p>
                  <p class="text-[11px] text-slate-400">Pause parent case until child case is resolved</p>
                </div>
                <mat-slide-toggle [(ngModel)]="step.config.waitForResolution" (ngModelChange)="emitChange()" class="flex-shrink-0"></mat-slide-toggle>
              </div>
              </div>

              <!-- Field Mapping subsection -->
              <div class="mt-3">
                <div class="flex items-center gap-2 mb-2">
                  <mat-icon class="!text-[13px] text-slate-500">swap_horiz</mat-icon>
                  <span class="text-[11px] font-semibold text-slate-600">Field Mapping (Parent → Child)</span>
                </div>
                <div class="space-y-1.5">
                @for (pair of fieldMappingPairs; track $index; let fi = $index) {
                  <div class="flex gap-2 items-center">
                    <mat-form-field class="flex-1" subscriptSizing="dynamic">
                      <mat-label>Parent field</mat-label>
                      <input matInput [(ngModel)]="pair.key" (ngModelChange)="updateFieldMapping()" placeholder="parent_field">
                    </mat-form-field>
                    <mat-icon class="text-slate-400 !text-base flex-shrink-0">arrow_forward</mat-icon>
                    <mat-form-field class="flex-1" subscriptSizing="dynamic">
                      <mat-label>Child field</mat-label>
                      <input matInput [(ngModel)]="pair.value" (ngModelChange)="updateFieldMapping()" placeholder="child_field">
                    </mat-form-field>
                    <button mat-icon-button class="!w-7 !h-7 flex-shrink-0" (click)="removeFieldMapping(fi)">
                      <mat-icon class="!text-sm text-slate-400 hover:text-red-500">close</mat-icon>
                    </button>
                  </div>
                }
                </div>
                <button mat-stroked-button class="!text-xs mt-1" (click)="addFieldMapping()">
                  <mat-icon class="!text-sm mr-1">add</mat-icon> Add Mapping
                </button>
              </div>

              <!-- Propagate Fields subsection -->
              <div class="mt-3">
                <div class="flex items-center gap-2 mb-2">
                  <mat-icon class="!text-[13px] text-slate-500">swap_horiz</mat-icon>
                  <span class="text-[11px] font-semibold text-slate-600">Propagate on Resolve (Child → Parent)</span>
                </div>
                <div class="space-y-1.5">
                @for (pair of propagatePairs; track $index; let pi = $index) {
                  <div class="flex gap-2 items-center">
                    <mat-form-field class="flex-1" subscriptSizing="dynamic">
                      <mat-label>Child field</mat-label>
                      <input matInput [(ngModel)]="pair.key" (ngModelChange)="updatePropagateFields()" placeholder="child_field">
                    </mat-form-field>
                    <mat-icon class="text-slate-400 !text-base flex-shrink-0">arrow_forward</mat-icon>
                    <mat-form-field class="flex-1" subscriptSizing="dynamic">
                      <mat-label>Parent field</mat-label>
                      <input matInput [(ngModel)]="pair.value" (ngModelChange)="updatePropagateFields()" placeholder="parent_field">
                    </mat-form-field>
                    <button mat-icon-button class="!w-7 !h-7 flex-shrink-0" (click)="removePropagatePair(pi)">
                      <mat-icon class="!text-sm text-slate-400 hover:text-red-500">close</mat-icon>
                    </button>
                  </div>
                }
                </div>
                <button mat-stroked-button class="!text-xs mt-1" (click)="addPropagatePair()">
                  <mat-icon class="!text-sm mr-1">add</mat-icon> Add Mapping
                </button>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,

})
export class StepConfigPanelComponent implements OnChanges, OnInit {
  @Input() step!: StepDefinition;
  @Input() caseType!: CaseTypeDefinition;
  @Output() stepChange = new EventEmitter<StepDefinition>();

  // ── Step type helpers ─────────────────────────────────────────
  stepMatIcon(type: StepType): string {
    const map: Record<StepType, string> = {
      assignment: 'edit_note',
      approval: 'verified',
      attachment: 'attach_file',
      decision: 'alt_route',
      automation: 'bolt',
      subprocess: 'account_tree',
    };
    return map[type] || 'radio_button_unchecked';
  }

  stepBgColor(type: StepType): string {
    const map: Record<StepType, string> = {
      assignment: 'bg-indigo-500',
      approval: 'bg-emerald-500',
      attachment: 'bg-purple-500',
      decision: 'bg-amber-500',
      automation: 'bg-orange-500',
      subprocess: 'bg-slate-500',
    };
    return map[type] || 'bg-primary-500';
  }

  stepBadgeClass(type: StepType): string {
    const map: Record<StepType, string> = {
      assignment: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      approval: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      attachment: 'bg-purple-50 text-purple-700 border-purple-200',
      decision: 'bg-amber-50 text-amber-700 border-amber-200',
      automation: 'bg-orange-50 text-orange-700 border-orange-200',
      subprocess: 'bg-slate-100 text-slate-600 border-slate-300',
    };
    return map[type] || 'bg-primary-50 text-primary-700 border-primary-200';
  }

  stepHeaderGradient(type: StepType): string {
    const map: Record<StepType, string> = {
      assignment: 'bg-gradient-to-r from-indigo-50 to-white',
      approval: 'bg-gradient-to-r from-emerald-50 to-white',
      attachment: 'bg-gradient-to-r from-purple-50 to-white',
      decision: 'bg-gradient-to-r from-amber-50 to-white',
      automation: 'bg-gradient-to-r from-orange-50 to-white',
      subprocess: 'bg-gradient-to-r from-slate-50 to-white',
    };
    return map[type] || 'bg-gradient-to-r from-slate-50 to-white';
  }

  stepTypeLabel(type: StepType): string {
    const map: Record<StepType, string> = {
      assignment: 'Collect information from a user',
      approval: 'Require sign-off from approvers',
      attachment: 'Collect required documents',
      decision: 'Branch workflow by conditions',
      automation: 'Execute automated webhook actions',
      subprocess: 'Launch a child case instance',
    };
    return map[type] || type;
  }

  private dataService = inject(DataService);
  formDefinitions: FormDefinition[] = [];
  decisionTables: DecisionTable[] = [];

  skipWhenCondition: RuleCondition | null = null;
  branchConditions: (RuleCondition | null)[] = [];
  ruleConditions: (RuleCondition | null)[] = [];

  // Derived strings for comma-separated inputs
  approverRolesStr = '';
  categoriesStr = '';
  allowedTypesStr = '';

  // Webhook helpers
  webhookUrl = '';
  webhookMethod = 'POST';
  webhookHeadersStr = '';

  // Key-value pair helpers
  fieldMappingPairs: { key: string; value: string }[] = [];
  propagatePairs: { key: string; value: string }[] = [];

  // Inline form fields editor
  showFormFields = false;

  get fieldNames(): string[] {
    return Object.keys(this.caseType?.fieldSchema || {});
  }

  get alternateStages(): StageDefinition[] {
    return this.caseType?.stages.filter(s => s.stageType === 'alternate') ?? [];
  }

  ngOnInit(): void {
    this.dataService.getFormDefinitions().subscribe(forms => this.formDefinitions = forms);
    this.dataService.getDecisionTables().subscribe(tables => this.decisionTables = tables);
  }

  ngOnChanges(): void {
    this.skipWhenCondition = RuleBuilderComponent.fromApiCondition(this.step.skipWhen as any);
    this.approverRolesStr = (this.step.config.approverRoles || []).join(', ');
    this.categoriesStr = (this.step.config.categories || []).join(', ');
    this.allowedTypesStr = (this.step.config.allowedTypes || []).join(', ');

    // Branches
    this.branchConditions = (this.step.config.branches || []).map(b =>
      RuleBuilderComponent.fromApiCondition(b.condition)
    );

    // Rules
    this.ruleConditions = (this.step.config.rules || []).map(r =>
      RuleBuilderComponent.fromApiCondition(r.condition)
    );

    // Webhook
    const wh = this.step.config.webhook;
    this.webhookUrl = wh?.url || '';
    this.webhookMethod = wh?.method || 'POST';
    this.webhookHeadersStr = wh?.headers ? JSON.stringify(wh.headers) : '';

    // Field mappings
    this.fieldMappingPairs = Object.entries(this.step.config.fieldMapping || {}).map(([key, value]) => ({ key, value }));
    this.propagatePairs = Object.entries(this.step.config.propagateFields || {}).map(([key, value]) => ({ key, value }));
  }

  emitChange(): void {
    this.stepChange.emit({ ...this.step });
  }

  onTypeChange(): void {
    this.step.config = {};
    this.emitChange();
  }

  onSkipWhenChange(cond: RuleCondition | null): void {
    this.skipWhenCondition = cond;
    this.step.skipWhen = RuleBuilderComponent.toApiCondition(cond);
    this.emitChange();
  }

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

  // --- Approval ---
  onApproverRolesChange(val: string): void {
    this.approverRolesStr = val;
    this.step.config.approverRoles = val.split(',').map(s => s.trim()).filter(Boolean);
    this.emitChange();
  }

  // --- Attachment ---
  onCategoriesChange(val: string): void {
    this.categoriesStr = val;
    this.step.config.categories = val.split(',').map(s => s.trim()).filter(Boolean);
    this.emitChange();
  }

  onAllowedTypesChange(val: string): void {
    this.allowedTypesStr = val;
    this.step.config.allowedTypes = val.split(',').map(s => s.trim()).filter(Boolean);
    this.emitChange();
  }

  // --- Decision Branches ---
  addBranch(): void {
    this.step.config.branches = this.step.config.branches || [];
    const branch: DecisionBranch = {
      id: 'br_' + Math.random().toString(36).substring(2, 8),
      label: 'Branch ' + (this.step.config.branches.length + 1),
      condition: {},
      nextStepId: '',
    };
    this.step.config.branches.push(branch);
    this.branchConditions.push(null);
    this.emitChange();
  }

  removeBranch(i: number): void {
    this.step.config.branches?.splice(i, 1);
    this.branchConditions.splice(i, 1);
    this.emitChange();
  }

  onBranchConditionChange(i: number, cond: RuleCondition | null): void {
    this.branchConditions[i] = cond;
    if (this.step.config.branches && this.step.config.branches[i]) {
      this.step.config.branches[i].condition = RuleBuilderComponent.toApiCondition(cond) || {};
    }
    this.emitChange();
  }

  // --- Automation Rules ---
  addRule(): void {
    this.step.config.rules = this.step.config.rules || [];
    const rule: AutomationRule = { condition: {}, actions: [] };
    this.step.config.rules.push(rule);
    this.ruleConditions.push(null);
    this.emitChange();
  }

  removeRule(i: number): void {
    this.step.config.rules?.splice(i, 1);
    this.ruleConditions.splice(i, 1);
    this.emitChange();
  }

  onRuleConditionChange(i: number, cond: RuleCondition | null): void {
    this.ruleConditions[i] = cond;
    if (this.step.config.rules && this.step.config.rules[i]) {
      this.step.config.rules[i].condition = RuleBuilderComponent.toApiCondition(cond) || {};
    }
    this.emitChange();
  }

  // --- Automation Webhook ---
  updateWebhook(): void {
    let headers: Record<string, string> = {};
    try {
      headers = this.webhookHeadersStr ? JSON.parse(this.webhookHeadersStr) : {};
    } catch {
      // invalid JSON, keep empty
    }
    this.step.config.webhook = {
      url: this.webhookUrl,
      method: this.webhookMethod,
      headers,
      bodyTemplate: this.step.config.webhook?.bodyTemplate || {},
      responseMap: this.step.config.webhook?.responseMap || {},
    };
    this.emitChange();
  }

  // --- Subprocess Field Mapping ---
  addFieldMapping(): void {
    this.fieldMappingPairs.push({ key: '', value: '' });
  }

  removeFieldMapping(i: number): void {
    this.fieldMappingPairs.splice(i, 1);
    this.updateFieldMapping();
  }

  updateFieldMapping(): void {
    const map: Record<string, string> = {};
    this.fieldMappingPairs.filter(p => p.key).forEach(p => map[p.key] = p.value);
    this.step.config.fieldMapping = map;
    this.emitChange();
  }

  addPropagatePair(): void {
    this.propagatePairs.push({ key: '', value: '' });
  }

  removePropagatePair(i: number): void {
    this.propagatePairs.splice(i, 1);
    this.updatePropagateFields();
  }

  updatePropagateFields(): void {
    const map: Record<string, string> = {};
    this.propagatePairs.filter(p => p.key).forEach(p => map[p.key] = p.value);
    this.step.config.propagateFields = map;
    this.emitChange();
  }

  // --- Inline Form Fields ---
  addFormField(type: string): void {
    this.step.config.formFields = this.step.config.formFields || [];
    const idx = this.step.config.formFields.length;
    const field: FormField = {
      id: 'ff_' + Math.random().toString(36).substring(2, 8),
      type: type as FormField['type'],
      label: 'Field ' + (idx + 1),
      placeholder: '',
      defaultValue: '',
      validation: {},
      order: idx + 1,
      section: '',
    };
    this.step.config.formFields.push(field);
    this.showFormFields = true;
    this.emitChange();
  }

  removeFormField(i: number): void {
    this.step.config.formFields?.splice(i, 1);
    this.emitChange();
  }

  toggleFieldRequired(i: number, checked: boolean): void {
    const fields = this.step.config.formFields;
    if (!fields || !fields[i]) return;
    fields[i].validation = { ...fields[i].validation, required: checked };
    this.emitChange();
  }

  updateFieldOptions(i: number, val: string): void {
    const fields = this.step.config.formFields;
    if (!fields || !fields[i]) return;
    fields[i].validation = {
      ...fields[i].validation,
      options: val.split(',').map(s => s.trim()).filter(Boolean),
    };
    this.emitChange();
  }

  updateFieldValidation(i: number, key: string, val: any): void {
    const fields = this.step.config.formFields;
    if (!fields || !fields[i]) return;
    fields[i].validation = { ...fields[i].validation, [key]: val ? +val : undefined };
    this.emitChange();
  }
}
