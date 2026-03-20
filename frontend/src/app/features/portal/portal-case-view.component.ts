import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { CaseInstance, StageInstance, StepInstance } from '@core/models';
import * as CasesActions from '@state/cases/cases.actions';
import {
  selectSelectedCaseInstance,
  selectCasesLoading,
} from '@state/cases/cases.selectors';
import { StageProgressBarComponent } from '@features/portal/shared/stage-progress-bar.component';
import { StepCardComponent } from '@features/portal/shared/step-card.component';

@Component({
  selector: 'app-portal-case-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatChipsModule,
    MatDividerModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    StageProgressBarComponent,
    StepCardComponent,
  ],
  template: `
    @if (isLoading) {
      <div class="flex items-center justify-center h-64">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
    } @else if (c) {
      <div class="space-y-4">
        <!-- Header -->
        <div class="flex items-start gap-3">
          <button mat-icon-button routerLink="/portal/cases">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <div class="flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-2xl font-bold text-slate-800">{{ c.title }}</h1>
              <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                    [ngClass]="statusBadge(c.status)">{{ c.status }}</span>
              <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                    [ngClass]="priorityBadge(c.priority)">{{ c.priority }}</span>
            </div>
            <p class="text-sm text-slate-500 mt-1">{{ c.caseTypeId }} · {{ c.id }}</p>
          </div>

          <!-- Actions Menu -->
          <button mat-icon-button [matMenuTriggerFor]="actionsMenu">
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #actionsMenu="matMenu">
            @if (c.status !== 'resolved_completed' && c.status !== 'withdrawn') {
              <button mat-menu-item (click)="onAdvanceStage()">
                <mat-icon>skip_next</mat-icon> Advance Stage
              </button>
              <button mat-menu-item (click)="onResolve()">
                <mat-icon>check_circle</mat-icon> Resolve Case
              </button>
              <mat-divider></mat-divider>
              <button mat-menu-item class="!text-red-600" (click)="onWithdraw()">
                <mat-icon>cancel</mat-icon> Withdraw Case
              </button>
            }
          </mat-menu>
        </div>

        <!-- Stage Progress Bar -->
        @if (c.stages && c.stages.length > 0) {
          <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
            <mat-card-content class="!py-5 !px-6">
              <app-stage-progress-bar
                [stages]="c.stages"
                [currentIndex]="c.currentStageIndex">
              </app-stage-progress-bar>
            </mat-card-content>
          </mat-card>
        }

        <!-- Content Tabs -->
        <mat-tab-group animationDuration="200ms">
          <!-- Work Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2">assignment</mat-icon> Work
            </ng-template>
            <div class="py-4 space-y-4">
              @if (currentStage(); as stage) {
                <div class="flex items-center justify-between mb-2">
                  <h2 class="text-lg font-semibold text-slate-700">
                    {{ stage.name }}
                  </h2>
                  <span class="text-xs text-slate-400">
                    Step {{ currentStepIndex(stage) + 1 }} of {{ (stage.processes[0].steps || []).length }}
                  </span>
                </div>

                <!-- Steps list -->
                @if (stepsForStage(stage); as steps) {
                  <div class="space-y-3">
                    @for (step of steps; track step.stepDefinitionId; let i = $index) {
                      <app-step-card
                        [step]="step"
                        [isCurrent]="isCurrentStep(step, stage)"
                        (onComplete)="onCompleteStep($event)">
                      </app-step-card>
                    }
                  </div>
                }
              } @else {
                <div class="text-center py-8 text-slate-400">
                  <mat-icon class="!text-4xl mb-2">check_circle_outline</mat-icon>
                  <p>All stages complete</p>
                </div>
              }
            </div>
          </mat-tab>

          <!-- Details Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2">info</mat-icon> Details
            </ng-template>
            <div class="py-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="space-y-3">
                  <div>
                    <p class="text-xs text-slate-400 uppercase tracking-wide">Description</p>
                    <p class="text-sm text-slate-700 mt-1">{{ c.description || 'No description' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-slate-400 uppercase tracking-wide">Created</p>
                    <p class="text-sm text-slate-700 mt-1">{{ c.createdAt | date:'medium' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-slate-400 uppercase tracking-wide">Last Updated</p>
                    <p class="text-sm text-slate-700 mt-1">{{ c.updatedAt | date:'medium' }}</p>
                  </div>
                </div>
                <div class="space-y-3">
                  <div>
                    <p class="text-xs text-slate-400 uppercase tracking-wide">Owner</p>
                    <p class="text-sm text-slate-700 mt-1">{{ c.ownerId || 'Unassigned' }}</p>
                  </div>
                  <div>
                    <p class="text-xs text-slate-400 uppercase tracking-wide">Case Type</p>
                    <p class="text-sm text-slate-700 mt-1">{{ c.caseTypeId }}</p>
                  </div>
                  @if (c.resolvedAt) {
                    <div>
                      <p class="text-xs text-slate-400 uppercase tracking-wide">Resolved At</p>
                      <p class="text-sm text-slate-700 mt-1">{{ c.resolvedAt | date:'medium' }}</p>
                    </div>
                  }
                </div>
              </div>

              <!-- Case Data -->
              @if (c.data && objectKeys(c.data).length > 0) {
                <mat-divider class="!my-4"></mat-divider>
                <h3 class="text-sm font-semibold text-slate-700 mb-3">Case Data</h3>
                <div class="bg-slate-50 rounded-lg p-4 font-mono text-xs text-slate-600 overflow-x-auto">
                  <pre>{{ c.data | json }}</pre>
                </div>
              }
            </div>
          </mat-tab>

          <!-- History Tab -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon class="mr-2">history</mat-icon> History
            </ng-template>
            <div class="py-4">
              @if (c.stages && c.stages.length > 0) {
                <div class="space-y-4">
                  @for (stage of c.stages; track stage.stageDefinitionId; let si = $index) {
                    <div class="border rounded-lg p-4"
                         [ngClass]="si === c.currentStageIndex ? 'border-blue-200 bg-blue-50/30' : 'border-slate-100'">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
                              [ngClass]="stage.status === 'completed' ? 'bg-emerald-500 text-white' :
                                         si === c.currentStageIndex ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'">
                          {{ si + 1 }}
                        </span>
                        <span class="font-medium text-sm text-slate-700">{{ stage.name }}</span>
                        <span class="text-xs px-2 py-0.5 rounded-full"
                              [ngClass]="stageStatusBadge(stage.status)">{{ stage.status }}</span>
                      </div>
                      @if (stepsForStage(stage); as steps) {
                        <div class="ml-8 space-y-1">
                          @for (step of steps; track step.stepDefinitionId) {
                            <div class="flex items-center gap-2 text-xs">
                              <mat-icon class="!text-sm" [ngClass]="stepIconClass(step)">
                                {{ stepIcon(step) }}
                              </mat-icon>
                              <span [ngClass]="step.status === 'completed' ? 'text-slate-600' : 'text-slate-400'">
                                {{ step.name }}
                              </span>
                            </div>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              } @else {
                <div class="text-center py-8 text-slate-400">No history</div>
              }
            </div>
          </mat-tab>
        </mat-tab-group>
      </div>
    } @else {
      <div class="text-center py-16 text-slate-400">
        <mat-icon class="!text-5xl mb-2">error_outline</mat-icon>
        <p class="text-lg">Case not found</p>
        <a mat-button color="primary" routerLink="/portal/cases" class="mt-4">Back to Cases</a>
      </div>
    }
  `,
})
export class PortalCaseViewComponent implements OnInit {
  c: CaseInstance | null = null;
  isLoading = false;

  objectKeys = Object.keys;

  constructor(
    private store: Store,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.store.dispatch(CasesActions.loadCaseInstance({ id }));
    }
    this.store.select(selectCasesLoading).subscribe((v) => (this.isLoading = v));
    this.store.select(selectSelectedCaseInstance).subscribe((v) => (this.c = v));
  }

  currentStage(): StageInstance | null {
    return this.c?.stages?.[this.c.currentStageIndex] || null;
  }

  stepsForStage(stage: StageInstance): StepInstance[] {
    return stage.processes?.[0]?.steps || [];
  }

  currentStepIndex(stage: StageInstance): number {
    const steps = this.stepsForStage(stage);
    const idx = steps.findIndex((s) => s.status === 'in_progress' || s.status === 'pending');
    return idx >= 0 ? idx : steps.length;
  }

  isCurrentStep(step: StepInstance, stage: StageInstance): boolean {
    const steps = this.stepsForStage(stage);
    const idx = this.currentStepIndex(stage);
    return steps[idx] === step;
  }

  onCompleteStep(step: StepInstance): void {
    if (!this.c) return;
    this.store.dispatch(
      CasesActions.completeStep({
        caseId: this.c.id,
        stepId: step.stepDefinitionId,
        request: { formData: {} },
      })
    );
  }

  onAdvanceStage(): void {
    if (!this.c) return;
    this.store.dispatch(CasesActions.advanceStage({ caseId: this.c.id }));
  }

  onResolve(): void {
    if (!this.c) return;
    this.store.dispatch(CasesActions.resolveCaseInstance({ caseId: this.c.id }));
  }

  onWithdraw(): void {
    if (!this.c) return;
    this.store.dispatch(CasesActions.withdrawCaseInstance({ caseId: this.c.id }));
  }

  statusBadge(status: string): string {
    return {
      open: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-amber-100 text-amber-700',
      resolved: 'bg-green-100 text-green-700',
      closed: 'bg-slate-100 text-slate-600',
      withdrawn: 'bg-red-100 text-red-600',
    }[status] || 'bg-slate-100 text-slate-600';
  }

  priorityBadge(priority: string): string {
    return {
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-green-100 text-green-700',
    }[priority] || 'bg-slate-100 text-slate-600';
  }

  stageStatusBadge(status: string): string {
    return {
      completed: 'bg-emerald-100 text-emerald-700',
      active: 'bg-blue-100 text-blue-700',
      pending: 'bg-slate-100 text-slate-500',
    }[status] || 'bg-slate-100 text-slate-500';
  }

  stepIcon(step: StepInstance): string {
    if (step.status === 'completed') return 'check_circle';
    if (step.status === 'in_progress') return 'play_circle';
    if (step.status === 'skipped') return 'skip_next';
    return 'radio_button_unchecked';
  }

  stepIconClass(step: StepInstance): string {
    if (step.status === 'completed') return 'text-emerald-500';
    if (step.status === 'in_progress') return 'text-blue-500';
    return 'text-slate-300';
  }
}
