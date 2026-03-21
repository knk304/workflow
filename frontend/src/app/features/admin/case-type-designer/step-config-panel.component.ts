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
import { FormDefinition } from '@core/models';

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
    RuleBuilderComponent,
  ],
  template: `
    <mat-card class="!shadow-sm">
      <mat-card-header class="!px-4 !py-3 border-b border-gray-100">
        <mat-card-title class="!text-sm !font-semibold flex items-center gap-2">
          <span class="text-base">{{ stepIcon(step.type) }}</span>
          Step Configuration
        </mat-card-title>
      </mat-card-header>
      <mat-card-content class="!p-4">
        <!-- Common Fields -->
        <div class="space-y-4">
          <mat-form-field class="w-full" appearance="outline">
            <mat-label>Step Name</mat-label>
            <input matInput [(ngModel)]="step.name" (ngModelChange)="emitChange()">
          </mat-form-field>

          <mat-form-field class="w-full" appearance="outline">
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

          <div class="flex items-center gap-4">
            <mat-slide-toggle [(ngModel)]="step.required" (ngModelChange)="emitChange()">Required</mat-slide-toggle>
          </div>

          <mat-form-field class="w-full" appearance="outline">
            <mat-label>SLA (hours)</mat-label>
            <input matInput type="number" [(ngModel)]="step.slaHours" (ngModelChange)="emitChange()" min="0">
          </mat-form-field>

          <div>
            <label class="text-xs font-medium text-gray-600 mb-2 block">Skip When</label>
            <app-rule-builder
              [condition]="skipWhenCondition"
              [fields]="fieldNames"
              (conditionChange)="onSkipWhenChange($event)"
            ></app-rule-builder>
          </div>
        </div>

        <mat-divider class="!my-4"></mat-divider>

        <!-- Type-Specific Config -->
        @switch (step.type) {
          @case ('assignment') {
            <div class="space-y-4">
              <h4 class="text-xs font-semibold text-gray-500 uppercase">Assignment Settings</h4>

              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Route To (Role)</mat-label>
                <input matInput [(ngModel)]="step.config.assigneeRole" (ngModelChange)="emitChange()" placeholder="e.g. caseworker">
              </mat-form-field>

              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Specific User ID</mat-label>
                <input matInput [(ngModel)]="step.config.assigneeUserId" (ngModelChange)="emitChange()" placeholder="Optional">
              </mat-form-field>

              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Form</mat-label>
                <mat-select [(ngModel)]="step.config.formId" (ngModelChange)="emitChange()">
                  <mat-option [value]="null">— None —</mat-option>
                  @for (form of formDefinitions; track form.id) {
                    <mat-option [value]="form.id">{{ form.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Instructions</mat-label>
                <textarea matInput [(ngModel)]="step.config.instructions" (ngModelChange)="emitChange()" rows="3"></textarea>
              </mat-form-field>

              <mat-form-field class="w-full" appearance="outline">
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
            <div class="space-y-4">
              <h4 class="text-xs font-semibold text-gray-500 uppercase">Approval Settings</h4>

              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Mode</mat-label>
                <mat-select [(ngModel)]="step.config.mode" (ngModelChange)="emitChange()">
                  <mat-option value="sequential">Sequential</mat-option>
                  <mat-option value="parallel">Parallel</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Approver Roles (comma-separated)</mat-label>
                <input matInput [ngModel]="approverRolesStr" (ngModelChange)="onApproverRolesChange($event)" placeholder="manager,director">
              </mat-form-field>

              <mat-slide-toggle [(ngModel)]="step.config.allowDelegation" (ngModelChange)="emitChange()">
                Allow Delegation
              </mat-slide-toggle>

              <mat-form-field class="w-full" appearance="outline">
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
            <div class="space-y-4">
              <h4 class="text-xs font-semibold text-gray-500 uppercase">Attachment Settings</h4>

              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Required Categories (comma-separated)</mat-label>
                <input matInput [ngModel]="categoriesStr" (ngModelChange)="onCategoriesChange($event)" placeholder="id_document,proof_of_income">
              </mat-form-field>

              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Minimum Files</mat-label>
                <input matInput type="number" [(ngModel)]="step.config.minFiles" (ngModelChange)="emitChange()" min="0">
              </mat-form-field>

              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Allowed File Types (comma-separated)</mat-label>
                <input matInput [ngModel]="allowedTypesStr" (ngModelChange)="onAllowedTypesChange($event)" placeholder="pdf,jpg,png">
              </mat-form-field>

              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Max File Size (MB)</mat-label>
                <input matInput type="number" [(ngModel)]="step.config.maxFileSizeMb" (ngModelChange)="emitChange()" min="1">
              </mat-form-field>

              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Instructions</mat-label>
                <textarea matInput [(ngModel)]="step.config.instructions" (ngModelChange)="emitChange()" rows="2"></textarea>
              </mat-form-field>
            </div>
          }

          @case ('decision') {
            <div class="space-y-4">
              <h4 class="text-xs font-semibold text-gray-500 uppercase">Decision Settings</h4>

              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Mode</mat-label>
                <mat-select [(ngModel)]="step.config.mode" (ngModelChange)="emitChange()">
                  <mat-option value="first_match">First Match (Branches)</mat-option>
                  <mat-option value="decision_table">Decision Table</mat-option>
                </mat-select>
              </mat-form-field>

              @if (step.config.mode !== 'decision_table') {
                <!-- Branches -->
                <div class="space-y-3">
                  @for (branch of step.config.branches || []; track $index; let bi = $index) {
                    <div class="border border-gray-200 rounded-lg p-3 space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="text-xs font-medium text-gray-500">Branch {{ bi + 1 }}</span>
                        <button mat-icon-button class="!w-6 !h-6" (click)="removeBranch(bi)">
                          <mat-icon class="!text-sm text-gray-400">close</mat-icon>
                        </button>
                      </div>
                      <mat-form-field class="w-full" appearance="outline">
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
                      <mat-form-field class="w-full" appearance="outline">
                        <mat-label>Next Step ID</mat-label>
                        <input matInput [(ngModel)]="branch.nextStepId" (ngModelChange)="emitChange()">
                      </mat-form-field>
                    </div>
                  }
                  <button mat-stroked-button class="!text-xs" (click)="addBranch()">
                    <mat-icon class="!text-sm mr-1">add</mat-icon> Add Branch
                  </button>
                </div>

                <mat-form-field class="w-full" appearance="outline">
                  <mat-label>Default Step ID</mat-label>
                  <input matInput [(ngModel)]="step.config.defaultStepId" (ngModelChange)="emitChange()">
                </mat-form-field>
              } @else {
                <mat-form-field class="w-full" appearance="outline">
                  <mat-label>Decision Table ID</mat-label>
                  <input matInput [(ngModel)]="step.config.decisionTableId" (ngModelChange)="emitChange()">
                </mat-form-field>
              }
            </div>
          }

          @case ('automation') {
            <div class="space-y-4">
              <h4 class="text-xs font-semibold text-gray-500 uppercase">Automation Settings</h4>

              <!-- Webhook Config -->
              <div class="border border-gray-200 rounded-lg p-3 space-y-3">
                <h5 class="text-xs font-medium text-gray-600">Webhook</h5>
                <mat-form-field class="w-full" appearance="outline">
                  <mat-label>URL</mat-label>
                  <input matInput [(ngModel)]="webhookUrl" (ngModelChange)="updateWebhook()">
                </mat-form-field>
                <mat-form-field class="w-full" appearance="outline">
                  <mat-label>Method</mat-label>
                  <mat-select [(ngModel)]="webhookMethod" (ngModelChange)="updateWebhook()">
                    <mat-option value="GET">GET</mat-option>
                    <mat-option value="POST">POST</mat-option>
                    <mat-option value="PUT">PUT</mat-option>
                    <mat-option value="PATCH">PATCH</mat-option>
                    <mat-option value="DELETE">DELETE</mat-option>
                  </mat-select>
                </mat-form-field>
                <mat-form-field class="w-full" appearance="outline">
                  <mat-label>Headers (JSON)</mat-label>
                  <textarea matInput [(ngModel)]="webhookHeadersStr" (ngModelChange)="updateWebhook()" rows="2" placeholder='{"Authorization":"Bearer ..."}'>
                  </textarea>
                </mat-form-field>
              </div>

              <!-- Rules -->
              <div>
                <h5 class="text-xs font-medium text-gray-600 mb-2">Rules</h5>
                @for (rule of step.config.rules || []; track $index; let ri = $index) {
                  <div class="border border-gray-200 rounded-lg p-3 mb-2 space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-medium text-gray-500">Rule {{ ri + 1 }}</span>
                      <button mat-icon-button class="!w-6 !h-6" (click)="removeRule(ri)">
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
                <button mat-stroked-button class="!text-xs" (click)="addRule()">
                  <mat-icon class="!text-sm mr-1">add</mat-icon> Add Rule
                </button>
              </div>
            </div>
          }

          @case ('subprocess') {
            <div class="space-y-4">
              <h4 class="text-xs font-semibold text-gray-500 uppercase">Subprocess Settings</h4>

              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Child Case Type ID</mat-label>
                <input matInput [(ngModel)]="step.config.childCaseTypeId" (ngModelChange)="emitChange()">
              </mat-form-field>

              <mat-slide-toggle [(ngModel)]="step.config.waitForResolution" (ngModelChange)="emitChange()">
                Wait for Resolution
              </mat-slide-toggle>

              <!-- Field Mapping -->
              <div>
                <h5 class="text-xs font-medium text-gray-600 mb-2">Field Mapping (Parent → Child)</h5>
                @for (pair of fieldMappingPairs; track $index; let fi = $index) {
                  <div class="flex gap-2 mb-2 items-center">
                    <mat-form-field class="flex-1" appearance="outline">
                      <input matInput [(ngModel)]="pair.key" (ngModelChange)="updateFieldMapping()" placeholder="parent_field">
                    </mat-form-field>
                    <mat-icon class="text-gray-400">arrow_forward</mat-icon>
                    <mat-form-field class="flex-1" appearance="outline">
                      <input matInput [(ngModel)]="pair.value" (ngModelChange)="updateFieldMapping()" placeholder="child_field">
                    </mat-form-field>
                    <button mat-icon-button class="!w-6 !h-6" (click)="removeFieldMapping(fi)">
                      <mat-icon class="!text-sm text-gray-400">close</mat-icon>
                    </button>
                  </div>
                }
                <button mat-stroked-button class="!text-xs" (click)="addFieldMapping()">
                  <mat-icon class="!text-sm mr-1">add</mat-icon> Add Mapping
                </button>
              </div>

              <!-- Propagate Fields -->
              <div>
                <h5 class="text-xs font-medium text-gray-600 mb-2">Propagate on Resolve (Child → Parent)</h5>
                @for (pair of propagatePairs; track $index; let pi = $index) {
                  <div class="flex gap-2 mb-2 items-center">
                    <mat-form-field class="flex-1" appearance="outline">
                      <input matInput [(ngModel)]="pair.key" (ngModelChange)="updatePropagateFields()" placeholder="child_field">
                    </mat-form-field>
                    <mat-icon class="text-gray-400">arrow_forward</mat-icon>
                    <mat-form-field class="flex-1" appearance="outline">
                      <input matInput [(ngModel)]="pair.value" (ngModelChange)="updatePropagateFields()" placeholder="parent_field">
                    </mat-form-field>
                    <button mat-icon-button class="!w-6 !h-6" (click)="removePropagatePair(pi)">
                      <mat-icon class="!text-sm text-gray-400">close</mat-icon>
                    </button>
                  </div>
                }
                <button mat-stroked-button class="!text-xs" (click)="addPropagatePair()">
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
}
