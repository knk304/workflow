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
import { MatDividerModule } from '@angular/material/divider';
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
    MatDividerModule,
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
    .on-complete-option {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .on-complete-option.selected {
      border-color: #4f46e5;
      background: #eef2ff;
    }
    .on-complete-option:hover:not(.selected) {
      border-color: #c7d2fe;
      background: #f5f7ff;
    }
    .panel-scroll > div {
      padding: 12px;
      margin: 10px 0;
      border: 1px solid #f1f5f9;
    }
  `],
  template: `
    @if (stage) {
    <div class="flex flex-col flex-1 overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">

      <!-- ── Header ── -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-200"
           [ngClass]="stage.stageType === 'primary' ? 'bg-gradient-to-r from-primary-50 to-white' : 'bg-gradient-to-r from-orange-50 to-white'">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
             [ngClass]="stage.stageType === 'primary' ? 'bg-primary-500' : 'bg-orange-500'">
          <mat-icon class="!text-[18px] text-white">{{ stage.stageType === 'primary' ? 'layers' : 'alt_route' }}</mat-icon>
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-sm font-bold text-slate-800 leading-tight truncate">{{ stage.name || 'Untitled Stage' }}</h2>
          <p class="text-[11px] text-slate-500 mt-0.5">{{ stage.stageType === 'primary' ? 'Primary stage in the main workflow' : 'Alternate path (exception / rejection)' }}</p>
        </div>
        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0"
              [ngClass]="stage.stageType === 'primary' ? 'bg-primary-50 text-primary-700 border-primary-200' : 'bg-orange-50 text-orange-700 border-orange-200'">
          {{ stage.stageType | uppercase }}
        </span>
      </div>

      <!-- ── Scrollable content ── -->
      <div class="flex-1 overflow-y-auto panel-scroll p-4 space-y-5">

        <!-- ══ SECTION: Basic Information ══ -->
        <div>
          <div class="flex items-center gap-2 mb-0.5">
            <mat-icon class="!text-[15px] text-primary-500">drive_file_rename_outline</mat-icon>
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Basic Information</span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Name and classification of this stage</p>
          <div class="section-card space-y-3">
            <mat-form-field class="w-full" subscriptSizing="dynamic">
              <mat-label>Stage Name</mat-label>
              <input matInput [(ngModel)]="stage.name" (ngModelChange)="emitChange()">
            </mat-form-field>
            <div class="flex items-center gap-2">
              <span class="text-[11px] text-slate-500 font-medium">Stage Type:</span>
              <span class="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                    [ngClass]="stage.stageType === 'primary' ? 'bg-primary-100 text-primary-700' : 'bg-orange-100 text-orange-700'">
                <mat-icon class="!text-sm align-middle mr-0.5">{{ stage.stageType === 'primary' ? 'layers' : 'alt_route' }}</mat-icon>
                {{ stage.stageType | titlecase }}
              </span>
              <span class="text-[10px] text-slate-400">— set at creation, cannot be changed</span>
            </div>
          </div>
        </div>

        <!-- ══ SECTION: On Complete Behavior ══ -->
        <div>
          <div class="flex items-center gap-2 mb-0.5">
            <mat-icon class="!text-[15px] text-emerald-500">check_circle</mat-icon>
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">On Complete Behavior</span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2.5 pl-6">What happens when all processes in this stage finish</p>
          <div class="space-y-2">
            <div class="on-complete-option" [class.selected]="stage.onComplete === 'auto_advance'"
                 (click)="stage.onComplete = 'auto_advance'; emitChange()">
              <div class="flex items-start gap-2.5">
                <mat-icon class="!text-[18px] mt-0.5" [ngClass]="stage.onComplete === 'auto_advance' ? 'text-indigo-600' : 'text-slate-400'">fast_forward</mat-icon>
                <div>
                  <p class="text-xs font-semibold" [ngClass]="stage.onComplete === 'auto_advance' ? 'text-indigo-800' : 'text-slate-700'">Auto Advance</p>
                  <p class="text-[11px] text-slate-400 leading-snug">Move to the next stage automatically without user intervention</p>
                </div>
                @if (stage.onComplete === 'auto_advance') {
                  <mat-icon class="!text-base text-indigo-500 ml-auto flex-shrink-0">check_circle</mat-icon>
                }
              </div>
            </div>

            <div class="on-complete-option" [class.selected]="stage.onComplete === 'wait_for_user'"
                 (click)="stage.onComplete = 'wait_for_user'; emitChange()">
              <div class="flex items-start gap-2.5">
                <mat-icon class="!text-[18px] mt-0.5" [ngClass]="stage.onComplete === 'wait_for_user' ? 'text-indigo-600' : 'text-slate-400'">pause_circle</mat-icon>
                <div>
                  <p class="text-xs font-semibold" [ngClass]="stage.onComplete === 'wait_for_user' ? 'text-indigo-800' : 'text-slate-700'">Wait for User</p>
                  <p class="text-[11px] text-slate-400 leading-snug">Pause and surface a action button before moving to the next stage</p>
                </div>
                @if (stage.onComplete === 'wait_for_user') {
                  <mat-icon class="!text-base text-indigo-500 ml-auto flex-shrink-0">check_circle</mat-icon>
                }
              </div>
            </div>

            <div class="on-complete-option" [class.selected]="stage.onComplete === 'resolve_case'"
                 (click)="stage.onComplete = 'resolve_case'; emitChange()">
              <div class="flex items-start gap-2.5">
                <mat-icon class="!text-[18px] mt-0.5" [ngClass]="stage.onComplete === 'resolve_case' ? 'text-indigo-600' : 'text-slate-400'">verified</mat-icon>
                <div>
                  <p class="text-xs font-semibold" [ngClass]="stage.onComplete === 'resolve_case' ? 'text-indigo-800' : 'text-slate-700'">Resolve Case</p>
                  <p class="text-[11px] text-slate-400 leading-snug">Close the case with a final resolution status when this stage completes</p>
                </div>
                @if (stage.onComplete === 'resolve_case') {
                  <mat-icon class="!text-base text-indigo-500 ml-auto flex-shrink-0">check_circle</mat-icon>
                }
              </div>
            </div>

            @if (stage.onComplete === 'resolve_case') {
              <div class="pl-2">
                <mat-form-field class="w-full" subscriptSizing="dynamic">
                  <mat-label>Resolution Status</mat-label>
                  <mat-icon matPrefix class="!text-base mr-1 text-slate-400">flag</mat-icon>
                  <mat-select [(ngModel)]="stage.resolutionStatus" (ngModelChange)="emitChange()">
                    <mat-option value="resolved_completed">
                      <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Completed</span>
                    </mat-option>
                    <mat-option value="resolved_cancelled">
                      <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-slate-400 inline-block"></span> Cancelled</span>
                    </mat-option>
                    <mat-option value="resolved_rejected">
                      <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-red-500 inline-block"></span> Rejected</span>
                    </mat-option>
                    <mat-option value="withdrawn">
                      <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Withdrawn</span>
                    </mat-option>
                  </mat-select>
                </mat-form-field>
              </div>
            }
          </div>
        </div>

        <!-- ══ SECTION: Execution Control ══ -->
        <div>
          <div class="flex items-center gap-2 mb-0.5">
            <mat-icon class="!text-[15px] text-amber-500">schedule</mat-icon>
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Execution Control</span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Time-based SLA target for completing this entire stage</p>
          <div class="section-card">
            <mat-form-field class="w-full" subscriptSizing="dynamic">
              <mat-label>SLA (hours)</mat-label>
              <mat-icon matPrefix class="!text-base mr-1 text-slate-400">schedule</mat-icon>
              <input matInput type="number" [(ngModel)]="stage.slaHours" (ngModelChange)="emitChange()" min="0" placeholder="e.g. 72">
              <mat-hint>Leave blank for no SLA</mat-hint>
            </mat-form-field>
          </div>
        </div>

        <!-- ══ SECTION: Skip When ══ -->
        <div>
          <div class="flex items-center gap-2 mb-0.5">
            <mat-icon class="!text-[15px] text-amber-500">skip_next</mat-icon>
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Skip Stage When</span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2.5 pl-6">If these conditions are met, this entire stage is bypassed at runtime</p>
          <app-rule-builder
            [condition]="skipWhenCondition"
            [fields]="fieldNames"
            (conditionChange)="onSkipWhenChange($event)"
          ></app-rule-builder>
        </div>

        <!-- ══ SECTION: Entry Criteria ══ -->
        <div>
          <div class="flex items-center gap-2 mb-0.5">
            <mat-icon class="!text-[15px] text-indigo-500">login</mat-icon>
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Entry Criteria</span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Conditions that must hold true before this stage can begin — used as a gate check</p>
          <app-rule-builder
            [condition]="entryCriteriaCondition"
            [fields]="fieldNames"
            (conditionChange)="onEntryCriteriaChange($event)"
          ></app-rule-builder>
        </div>

        <!-- ══ Danger Zone ══ -->
        <div class="pt-1">
          <mat-divider></mat-divider>
          <div class="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <div class="flex items-start gap-2 mb-2">
              <mat-icon class="!text-[15px] text-red-500 mt-0.5">warning</mat-icon>
              <div>
                <p class="text-[11px] font-bold text-red-700 uppercase tracking-wider">Danger Zone</p>
                <p class="text-[11px] text-red-500">Deleting a stage removes all its processes and steps. This cannot be undone.</p>
              </div>
            </div>
            <button mat-stroked-button class="w-full !border-red-300 !text-red-600 hover:!bg-red-100" (click)="deleteStage.emit(stage)">
              <mat-icon class="mr-1 !text-base">delete</mat-icon> Delete Stage
            </button>
          </div>
        </div>

      </div>
    </div>
    }
  `,
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
    if (!this.stage) return;
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
