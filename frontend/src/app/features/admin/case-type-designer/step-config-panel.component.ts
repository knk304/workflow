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
import { FormDefinition, FormField } from '@core/models';

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
  template: `
    <mat-card class="!shadow-sm">
      <mat-card-header class="!px-3 !py-2 border-b border-gray-100">
        <mat-card-title class="!text-xs !font-semibold flex items-center gap-1.5">
          <span class="text-sm">{{ stepIcon(step.type) }}</span>
          Step Configuration
        </mat-card-title>
      </mat-card-header>
      <mat-card-content class="!p-3">
        <!-- Common Fields -->
        <div class="space-y-1.5">
          <mat-form-field class="w-full" subscriptSizing="dynamic">
            <mat-label>Step Name</mat-label>
            <input matInput [(ngModel)]="step.name" (ngModelChange)="emitChange()">
          </mat-form-field>

          <mat-form-field class="w-full" subscriptSizing="dynamic">
            <mat-label>Step Type</mat-label>
            <mat-select [(ngModel)]="step.type" (ngModelChange)="onTypeChange()">
              <mat-option value="assignment">Assignment</mat-option>
              <mat-option value="approval">Approval</mat-option>
              <mat-option value="attachment">Attachment</mat-option>
              <mat-option value="decision">Decision</mat-option>
              <mat-option value="automation">Automation</mat-option>
              <mat-option value="subprocess">Subprocess</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="flex items-center gap-3">
            <mat-slide-toggle [(ngModel)]="step.required" (ngModelChange)="emitChange()">Required</mat-slide-toggle>
          </div>

          <mat-form-field class="w-full" subscriptSizing="dynamic">
            <mat-label>SLA (hours)</mat-label>
            <input matInput type="number" [(ngModel)]="step.slaHours" (ngModelChange)="emitChange()" min="0">
          </mat-form-field>

          <div>
            <label class="text-xs font-medium text-gray-600 mb-1 block">Skip When</label>
            <app-rule-builder
              [condition]="skipWhenCondition"
              [fields]="fieldNames"
              (conditionChange)="onSkipWhenChange($event)"
            ></app-rule-builder>
          </div>
        </div>

        <mat-divider class="!my-2"></mat-divider>

        <!-- Type-Specific Config -->
        @switch (step.type) {
          @case ('assignment') {
            <div class="space-y-1.5">
              <h4 class="text-xs font-semibold text-gray-500 uppercase">Assignment Settings</h4>

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
          }

          @case ('approval') {
            <div class="space-y-1.5">
              <h4 class="text-xs font-semibold text-gray-500 uppercase">Approval Settings</h4>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Mode</mat-label>
                <mat-select [(ngModel)]="step.config.mode" (ngModelChange)="emitChange()">
                  <mat-option value="sequential">Sequential</mat-option>
                  <mat-option value="parallel">Parallel</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Approver Roles (comma-separated)</mat-label>
                <input matInput [ngModel]="approverRolesStr" (ngModelChange)="onApproverRolesChange($event)" placeholder="manager,director">
              </mat-form-field>

              <mat-slide-toggle [(ngModel)]="step.config.allowDelegation" (ngModelChange)="emitChange()">
                Allow Delegation
              </mat-slide-toggle>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>On Rejection → Stage</mat-label>
                <mat-select [(ngModel)]="step.config.rejectionStageId" (ngModelChange)="emitChange()">
                  <mat-option [value]="null">— None —</mat-option>
                  @for (s of alternateStages; track s.id) {
                    <mat-option [value]="s.id">{{ s.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
          }

          @case ('attachment') {
            <div class="space-y-1.5">
              <h4 class="text-xs font-semibold text-gray-500 uppercase">Attachment Settings</h4>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Required Categories (comma-separated)</mat-label>
                <input matInput [ngModel]="categoriesStr" (ngModelChange)="onCategoriesChange($event)" placeholder="id_document,proof_of_income">
              </mat-form-field>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Minimum Files</mat-label>
                <input matInput type="number" [(ngModel)]="step.config.minFiles" (ngModelChange)="emitChange()" min="0">
              </mat-form-field>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Allowed File Types (comma-separated)</mat-label>
                <input matInput [ngModel]="allowedTypesStr" (ngModelChange)="onAllowedTypesChange($event)" placeholder="pdf,jpg,png">
              </mat-form-field>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Max File Size (MB)</mat-label>
                <input matInput type="number" [(ngModel)]="step.config.maxFileSizeMb" (ngModelChange)="emitChange()" min="1">
              </mat-form-field>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Instructions</mat-label>
                <textarea matInput [(ngModel)]="step.config.instructions" (ngModelChange)="emitChange()" rows="2"></textarea>
              </mat-form-field>
            </div>
          }

          @case ('decision') {
            <div class="space-y-1.5">
              <h4 class="text-xs font-semibold text-gray-500 uppercase">Decision Settings</h4>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Mode</mat-label>
                <mat-select [(ngModel)]="step.config.mode" (ngModelChange)="emitChange()">
                  <mat-option value="first_match">First Match (Branches)</mat-option>
                  <mat-option value="decision_table">Decision Table</mat-option>
                </mat-select>
              </mat-form-field>

              @if (step.config.mode !== 'decision_table') {
                <!-- Branches -->
                <div class="space-y-2">
                  @for (branch of step.config.branches || []; track $index; let bi = $index) {
                    <div class="border border-gray-200 rounded p-2 space-y-1">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-medium text-gray-500">Branch {{ bi + 1 }}</span>
                        <button mat-icon-button class="!w-5 !h-5" (click)="removeBranch(bi)">
                          <mat-icon class="!text-sm text-gray-400">close</mat-icon>
                        </button>
                      </div>
                      <mat-form-field class="w-full" subscriptSizing="dynamic">
                        <mat-label>Label</mat-label>
                        <input matInput [(ngModel)]="branch.label" (ngModelChange)="emitChange()">
                      </mat-form-field>
                      <div>
                        <label class="text-xs text-gray-500">Condition</label>
                        <app-rule-builder
                          [condition]="branchConditions[bi] || null"
                          [fields]="fieldNames"
                          (conditionChange)="onBranchConditionChange(bi, $event)"
                        ></app-rule-builder>
                      </div>
                      <mat-form-field class="w-full" subscriptSizing="dynamic">
                        <mat-label>Next Step ID</mat-label>
                        <input matInput [(ngModel)]="branch.nextStepId" (ngModelChange)="emitChange()">
                      </mat-form-field>
                    </div>
                  }
                  <button mat-stroked-button class="!text-xs !py-0 !min-h-[28px]" (click)="addBranch()">
                    <mat-icon class="!text-sm mr-1">add</mat-icon> Add Branch
                  </button>
                </div>

                <mat-form-field class="w-full" subscriptSizing="dynamic">
                  <mat-label>Default Step ID</mat-label>
                  <input matInput [(ngModel)]="step.config.defaultStepId" (ngModelChange)="emitChange()">
                </mat-form-field>
              } @else {
                <mat-form-field class="w-full" subscriptSizing="dynamic">
                  <mat-label>Decision Table ID</mat-label>
                  <input matInput [(ngModel)]="step.config.decisionTableId" (ngModelChange)="emitChange()">
                </mat-form-field>
              }
            </div>
          }

          @case ('automation') {
            <div class="space-y-1.5">
              <h4 class="text-xs font-semibold text-gray-500 uppercase">Automation Settings</h4>

              <!-- Webhook Config -->
              <div class="border border-gray-200 rounded p-2 space-y-1.5">
                <h5 class="text-xs font-medium text-gray-600">Webhook</h5>
                <mat-form-field class="w-full" subscriptSizing="dynamic">
                  <mat-label>URL</mat-label>
                  <input matInput [(ngModel)]="webhookUrl" (ngModelChange)="updateWebhook()">
                </mat-form-field>
                <mat-form-field class="w-full" subscriptSizing="dynamic">
                  <mat-label>Method</mat-label>
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
                  <textarea matInput [(ngModel)]="webhookHeadersStr" (ngModelChange)="updateWebhook()" rows="2" placeholder='{"Authorization":"Bearer ..."}'>
                  </textarea>
                </mat-form-field>
              </div>

              <!-- Rules -->
              <div>
                <h5 class="text-xs font-medium text-gray-600 mb-1">Rules</h5>
                @for (rule of step.config.rules || []; track $index; let ri = $index) {
                  <div class="border border-gray-200 rounded p-2 mb-1.5 space-y-1">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-medium text-gray-500">Rule {{ ri + 1 }}</span>
                      <button mat-icon-button class="!w-5 !h-5" (click)="removeRule(ri)">
                        <mat-icon class="!text-sm text-gray-400">close</mat-icon>
                      </button>
                    </div>
                    <label class="text-xs text-gray-500">Condition</label>
                    <app-rule-builder
                      [condition]="ruleConditions[ri] || null"
                      [fields]="fieldNames"
                      (conditionChange)="onRuleConditionChange(ri, $event)"
                    ></app-rule-builder>
                  </div>
                }
                <button mat-stroked-button class="!text-xs !py-0 !min-h-[28px]" (click)="addRule()">
                  <mat-icon class="!text-sm mr-1">add</mat-icon> Add Rule
                </button>
              </div>
            </div>
          }

          @case ('subprocess') {
            <div class="space-y-1.5">
              <h4 class="text-xs font-semibold text-gray-500 uppercase">Subprocess Settings</h4>

              <mat-form-field class="w-full" subscriptSizing="dynamic">
                <mat-label>Child Case Type ID</mat-label>
                <input matInput [(ngModel)]="step.config.childCaseTypeId" (ngModelChange)="emitChange()">
              </mat-form-field>

              <mat-slide-toggle [(ngModel)]="step.config.waitForResolution" (ngModelChange)="emitChange()">
                Wait for Resolution
              </mat-slide-toggle>

              <!-- Field Mapping -->
              <div>
                <h5 class="text-xs font-medium text-gray-600 mb-1">Field Mapping (Parent → Child)</h5>
                @for (pair of fieldMappingPairs; track $index; let fi = $index) {
                  <div class="flex gap-1.5 mb-1.5 items-center">
                    <mat-form-field class="flex-1" subscriptSizing="dynamic">
                      <input matInput [(ngModel)]="pair.key" (ngModelChange)="updateFieldMapping()" placeholder="parent_field">
                    </mat-form-field>
                    <mat-icon class="text-gray-400 !text-base">arrow_forward</mat-icon>
                    <mat-form-field class="flex-1" subscriptSizing="dynamic">
                      <input matInput [(ngModel)]="pair.value" (ngModelChange)="updateFieldMapping()" placeholder="child_field">
                    </mat-form-field>
                    <button mat-icon-button class="!w-5 !h-5" (click)="removeFieldMapping(fi)">
                      <mat-icon class="!text-sm text-gray-400">close</mat-icon>
                    </button>
                  </div>
                }
                <button mat-stroked-button class="!text-xs !py-0 !min-h-[28px]" (click)="addFieldMapping()">
                  <mat-icon class="!text-sm mr-1">add</mat-icon> Add Mapping
                </button>
              </div>

              <!-- Propagate Fields -->
              <div>
                <h5 class="text-xs font-medium text-gray-600 mb-1">Propagate on Resolve (Child → Parent)</h5>
                @for (pair of propagatePairs; track $index; let pi = $index) {
                  <div class="flex gap-1.5 mb-1.5 items-center">
                    <mat-form-field class="flex-1" subscriptSizing="dynamic">
                      <input matInput [(ngModel)]="pair.key" (ngModelChange)="updatePropagateFields()" placeholder="child_field">
                    </mat-form-field>
                    <mat-icon class="text-gray-400 !text-base">arrow_forward</mat-icon>
                    <mat-form-field class="flex-1" subscriptSizing="dynamic">
                      <input matInput [(ngModel)]="pair.value" (ngModelChange)="updatePropagateFields()" placeholder="parent_field">
                    </mat-form-field>
                    <button mat-icon-button class="!w-5 !h-5" (click)="removePropagatePair(pi)">
                      <mat-icon class="!text-sm text-gray-400">close</mat-icon>
                    </button>
                  </div>
                }
                <button mat-stroked-button class="!text-xs !py-0 !min-h-[28px]" (click)="addPropagatePair()">
                  <mat-icon class="!text-sm mr-1">add</mat-icon> Add Mapping
                </button>
              </div>
            </div>
          }
        }
      </mat-card-content>
    </mat-card>
  `,
})
export class StepConfigPanelComponent implements OnChanges, OnInit {
  @Input() step!: StepDefinition;
  @Input() caseType!: CaseTypeDefinition;
  @Output() stepChange = new EventEmitter<StepDefinition>();

  private dataService = inject(DataService);
  formDefinitions: FormDefinition[] = [];

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
