import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { StageDefinition, CaseTypeDefinition } from '@core/models';
import { RuleBuilderComponent, RuleCondition } from '@shared/rule-builder/rule-builder.component';

@Component({
  selector: 'app-stage-config-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatSlideToggleModule,
    MatCardModule,
    MatTabsModule,
    RuleBuilderComponent,
  ],
  template: `
    <mat-card class="!shadow-sm">
      <mat-card-header class="!px-4 !py-3 border-b border-gray-100">
        <mat-card-title class="!text-sm !font-semibold flex items-center gap-2">
          <mat-icon class="!text-lg text-[#056DAE]">layers</mat-icon>
          Stage Configuration
        </mat-card-title>
      </mat-card-header>
      <mat-card-content class="!p-4">
        <mat-tab-group class="dense-tabs">
          <!-- General Tab -->
          <mat-tab label="General">
            <div class="space-y-4 pt-4">
              <mat-form-field class="w-full" appearance="outline">
                <mat-label>Stage Name</mat-label>
                <input matInput [(ngModel)]="stage.name" (ngModelChange)="emitChange()">
              </mat-form-field>

              <div>
                <label class="text-xs font-medium text-gray-600 mb-1 block">Stage Type</label>
                <span class="text-sm px-2 py-1 rounded"
                  [class.bg-blue-100]="stage.stageType === 'primary'"
                  [class.text-blue-700]="stage.stageType === 'primary'"
                  [class.bg-orange-100]="stage.stageType === 'alternate'"
                  [class.text-orange-700]="stage.stageType === 'alternate'">
                  {{ stage.stageType | titlecase }}
                </span>
              </div>

              <div>
                <label class="text-xs font-medium text-gray-600 mb-2 block">On Complete</label>
                <mat-radio-group [(ngModel)]="stage.onComplete" (ngModelChange)="emitChange()" class="flex flex-col gap-1">
                  <mat-radio-button value="auto_advance" class="!text-sm">Auto advance</mat-radio-button>
                  <mat-radio-button value="wait_for_user" class="!text-sm">Wait for user</mat-radio-button>
                  <mat-radio-button value="resolve_case" class="!text-sm">Resolve case</mat-radio-button>
                </mat-radio-group>
              </div>

              @if (stage.onComplete === 'resolve_case') {
                <mat-form-field class="w-full" appearance="outline">
                  <mat-label>Resolution Status</mat-label>
                  <mat-select [(ngModel)]="stage.resolutionStatus" (ngModelChange)="emitChange()">
                    <mat-option value="resolved_completed">Completed</mat-option>
                    <mat-option value="resolved_cancelled">Cancelled</mat-option>
                    <mat-option value="resolved_rejected">Rejected</mat-option>
                    <mat-option value="withdrawn">Withdrawn</mat-option>
                  </mat-select>
                </mat-form-field>
              }

              <mat-form-field class="w-full" appearance="outline">
                <mat-label>SLA (hours)</mat-label>
                <input matInput type="number" [(ngModel)]="stage.slaHours" (ngModelChange)="emitChange()" min="0">
              </mat-form-field>
            </div>
          </mat-tab>

          <!-- Validation Tab -->
          <mat-tab label="Validation">
            <div class="space-y-4 pt-4">
              <div>
                <label class="text-xs font-medium text-gray-600 mb-2 block">Skip Stage When</label>
                <app-rule-builder
                  [condition]="skipWhenCondition"
                  [fields]="fieldNames"
                  (conditionChange)="onSkipWhenChange($event)"
                ></app-rule-builder>
              </div>

              <div>
                <label class="text-xs font-medium text-gray-600 mb-2 block">Entry Criteria</label>
                <app-rule-builder
                  [condition]="entryCriteriaCondition"
                  [fields]="fieldNames"
                  (conditionChange)="onEntryCriteriaChange($event)"
                ></app-rule-builder>
              </div>
            </div>
          </mat-tab>
        </mat-tab-group>

        <!-- Delete Button -->
        <div class="mt-4 pt-4 border-t border-gray-100">
          <button mat-stroked-button color="warn" class="w-full" (click)="deleteStage.emit(stage)">
            <mat-icon class="mr-1">delete</mat-icon> Delete Stage
          </button>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    :host ::ng-deep .dense-tabs .mat-mdc-tab-header {
      --mdc-secondary-navigation-tab-container-height: 36px;
    }
  `],
})
export class StageConfigPanelComponent implements OnChanges {
  @Input() stage!: StageDefinition;
  @Input() caseType!: CaseTypeDefinition;
  @Output() stageChange = new EventEmitter<StageDefinition>();
  @Output() deleteStage = new EventEmitter<StageDefinition>();

  skipWhenCondition: RuleCondition | null = null;
  entryCriteriaCondition: RuleCondition | null = null;

  get fieldNames(): string[] {
    return Object.keys(this.caseType?.fieldSchema || {});
  }

  ngOnChanges(): void {
    this.skipWhenCondition = RuleBuilderComponent.fromApiCondition(this.stage.skipWhen as any);
    this.entryCriteriaCondition = RuleBuilderComponent.fromApiCondition(this.stage.entryCriteria as any);
  }

  emitChange(): void {
    this.stageChange.emit({ ...this.stage });
  }

  onSkipWhenChange(cond: RuleCondition | null): void {
    this.skipWhenCondition = cond;
    this.stage.skipWhen = RuleBuilderComponent.toApiCondition(cond);
    this.emitChange();
  }

  onEntryCriteriaChange(cond: RuleCondition | null): void {
    this.entryCriteriaCondition = cond;
    this.stage.entryCriteria = RuleBuilderComponent.toApiCondition(cond);
    this.emitChange();
  }
}
