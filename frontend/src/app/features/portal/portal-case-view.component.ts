import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';
import { CaseInstance, StageInstance, StepInstance } from '@core/models';
import * as CasesActions from '@state/cases/cases.actions';
import {
  selectSelectedCaseInstance,
  selectCasesLoading,
} from '@state/cases/cases.selectors';
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
    MatDividerModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    StepCardComponent,
  ],
  template: `
    @if (isLoading) {
      <div class="flex items-center justify-center h-64">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
    } @else if (c) {
      <div class="flex gap-0 h-full min-h-[calc(100vh-120px)]">
        <!-- ========== LEFT SIDEBAR ========== -->
        <div class="w-64 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
          <!-- Case Header -->
          <div class="px-4 py-4 bg-slate-700 text-white">
            <div class="flex items-center gap-2 mb-1">
              <mat-icon class="!text-lg">folder_open</mat-icon>
              <span class="text-xs font-medium opacity-80">{{ c.id }}</span>
            </div>
            <h2 class="text-base font-bold leading-tight">{{ c.caseTypeId }}</h2>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
            <button mat-stroked-button class="!text-xs !h-8 flex-1" routerLink="/portal/cases">
              <mat-icon class="!text-sm mr-1">arrow_back</mat-icon> Back
            </button>
            <button mat-stroked-button class="!text-xs !h-8" [matMenuTriggerFor]="actionsMenu">
              Actions <mat-icon class="!text-sm ml-0.5">arrow_drop_down</mat-icon>
            </button>
            <mat-menu #actionsMenu="matMenu">
              @if (c.status !== 'resolved_completed' && c.status !== 'withdrawn') {
                @if (currentStage()?.onComplete === 'wait_for_user') {
                  <button mat-menu-item (click)="onAdvanceStage()">
                    <mat-icon>skip_next</mat-icon> Advance Stage
                  </button>
                }
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

          <!-- Case Properties -->
          <div class="px-4 py-3 space-y-3 border-b border-slate-200">
            <div>
              <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Priority</p>
              <span class="text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 inline-block"
                    [ngClass]="priorityBadge(c.priority)">{{ c.priority }}</span>
            </div>
            <div>
              <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</p>
              <span class="text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 inline-block"
                    [ngClass]="statusBadge(c.status)">{{ c.status }}</span>
            </div>
            <div>
              <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Created</p>
              <p class="text-xs text-blue-600 mt-0.5">{{ c.ownerId || 'System' }}</p>
              <p class="text-[10px] text-slate-400">{{ c.createdAt | date:'medium' }}</p>
            </div>
            <div>
              <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Updated</p>
              <p class="text-[10px] text-slate-400">{{ c.updatedAt | date:'medium' }}</p>
            </div>
            @if (c.slaTargetDate) {
              <div>
                <p class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">SLA</p>
                <div class="flex items-center gap-1 mt-0.5">
                  <span class="text-xs font-medium" [ngClass]="slaTextClass(c)">
                    @if (c.slaDaysRemaining != null && c.slaDaysRemaining < 0) {
                      {{ -c.slaDaysRemaining }}d overdue
                    } @else if (c.slaDaysRemaining != null && c.slaDaysRemaining === 0) {
                      Due today
                    } @else if (c.slaDaysRemaining != null) {
                      {{ c.slaDaysRemaining }}d remaining
                    } @else {
                      {{ c.slaTargetDate | date:'shortDate' }}
                    }
                  </span>
                  @if (c.escalationLevel > 0) {
                    <mat-icon class="!text-xs text-red-500">warning</mat-icon>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Sidebar Nav -->
          <div class="px-4 py-3 space-y-1">
            <button class="w-full text-left text-xs font-semibold px-2 py-1.5 rounded transition-colors"
                    [ngClass]="sidebarTab === 'details' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'"
                    (click)="sidebarTab = 'details'">
              Details
            </button>
            <button class="w-full text-left text-xs font-semibold px-2 py-1.5 rounded transition-colors"
                    [ngClass]="sidebarTab === 'history' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'"
                    (click)="sidebarTab = 'history'">
              History
            </button>
          </div>

          <!-- Sidebar Content Panel -->
          @if (sidebarTab === 'details') {
            <div class="px-4 py-3 border-t border-slate-200">
              <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Case Details</h4>
              <div class="space-y-2">
                <div>
                  <p class="text-[10px] text-slate-400">Title</p>
                  <p class="text-xs text-slate-700">{{ c.title }}</p>
                </div>
                <div>
                  <p class="text-[10px] text-slate-400">Description</p>
                  <p class="text-xs text-slate-700">{{ c.description || '—' }}</p>
                </div>
                <div>
                  <p class="text-[10px] text-slate-400">Owner</p>
                  <p class="text-xs text-slate-700">{{ c.ownerId || 'Unassigned' }}</p>
                </div>
                <div>
                  <p class="text-[10px] text-slate-400">Case Type</p>
                  <p class="text-xs text-slate-700">{{ c.caseTypeId }}</p>
                </div>
                @if (c.resolvedAt) {
                  <div>
                    <p class="text-[10px] text-slate-400">Resolved</p>
                    <p class="text-xs text-slate-700">{{ c.resolvedAt | date:'medium' }}</p>
                  </div>
                }
              </div>
              @if (c.data && objectKeys(c.data).length > 0) {
                <mat-divider class="!my-3"></mat-divider>
                <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Case Data</h4>
                <div class="space-y-1">
                  @for (key of objectKeys(c.data); track key) {
                    <div class="flex justify-between text-xs">
                      <span class="text-slate-500">{{ key }}</span>
                      <span class="text-slate-700 font-medium truncate ml-2 max-w-[120px]">{{ c.data[key] }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          }

          @if (sidebarTab === 'history') {
            <div class="px-4 py-3 border-t border-slate-200">
              <h4 class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Stage History</h4>
              @for (stage of c.stages; track stage.stageDefinitionId; let si = $index) {
                <div class="mb-3">
                  <div class="flex items-center gap-1.5 mb-1">
                    <span class="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                          [ngClass]="stage.status === 'completed' ? 'bg-emerald-500 text-white' :
                                     stage.stageDefinitionId === c.currentStageId ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'">
                      {{ si + 1 }}
                    </span>
                    <span class="text-xs font-medium text-slate-700">{{ stage.name }}</span>
                  </div>
                  @if (stepsForStage(stage); as steps) {
                    <div class="ml-5 space-y-0.5">
                      @for (step of steps; track step.stepDefinitionId) {
                        <div class="flex items-center gap-1.5 text-[10px]">
                          <mat-icon class="!text-xs" [ngClass]="stepIconClass(step)">{{ stepIcon(step) }}</mat-icon>
                          <span [ngClass]="step.status === 'completed' ? 'text-slate-600' : 'text-slate-400'">{{ step.name }}</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- ========== MAIN CONTENT ========== -->
        <div class="flex-1 min-w-0 flex flex-col bg-slate-50">
          <!-- Stage Chevron Bar -->
          @if (c.stages && c.stages.length > 0) {
            <div class="bg-white border-b border-slate-200 px-6 py-3">
              <div class="flex items-center gap-0 overflow-x-auto">
                @for (stage of c.stages; track stage.stageDefinitionId; let si = $index) {
                  <div class="stage-chevron px-5 py-2.5 min-w-[130px] text-center text-xs font-semibold"
                       [class.stage-chevron-completed]="stage.status === 'completed'"
                       [class.stage-chevron-active]="stage.stageDefinitionId === c.currentStageId && stage.status !== 'completed'"
                       [class.stage-chevron-pending]="stage.status === 'pending'">>
                    {{ stage.name }}
                  </div>
                  @if (si < c.stages.length - 1) {
                    <mat-icon class="text-slate-300 !text-lg flex-shrink-0 -mx-1">chevron_right</mat-icon>
                  }
                }
              </div>
            </div>
          }

          <!-- Step Content Area -->
          <div class="flex-1 overflow-y-auto px-6 py-5">
            @if (currentStage(); as stage) {
              <!-- Current step assignment header -->
              @if (currentStepObj(stage); as curStep) {
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                    {{ (c.ownerId || 'U')[0].toUpperCase() }}
                  </div>
                  <div>
                    <h2 class="text-lg font-bold text-slate-800">{{ curStep.name }}</h2>
                    @if (curStep.slaTarget) {
                      <p class="text-xs text-slate-500">Due {{ curStep.slaTarget | date:'medium' }}</p>
                    }
                  </div>
                </div>
              }

              <!-- SLA warning banner -->
              @if (c.slaDaysRemaining != null && c.slaDaysRemaining < 0) {
                <div class="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <mat-icon class="text-red-500 !text-xl mt-0.5">warning</mat-icon>
                  <div>
                    <p class="text-sm font-semibold text-red-700">This case is overdue</p>
                    <p class="text-xs text-red-600">Target date was {{ c.slaTargetDate | date:'medium' }}</p>
                  </div>
                </div>
              }

              <!-- Steps list -->
              @if (stepsForStage(stage); as steps) {
                <div class="space-y-3">
                  @for (step of steps; track step.stepDefinitionId; let i = $index) {
                    <app-step-card
                      [step]="step"
                      [isCurrent]="isCurrentStep(step, stage)"
                      [caseId]="c.id"
                      (onComplete)="onCompleteStep($event)">
                    </app-step-card>
                  }
                </div>

                <!-- Stage advancement prompt -->
                @if (allStepsComplete(stage)) {
                  @if (stage.onComplete === 'wait_for_user') {
                    <div class="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                      <mat-icon class="text-emerald-600">check_circle</mat-icon>
                      <div class="flex-1">
                        <p class="text-sm font-semibold text-emerald-800">All steps complete</p>
                        <p class="text-xs text-emerald-600">Ready to advance to the next stage</p>
                      </div>
                      <button mat-flat-button color="primary" (click)="onAdvanceStage()">
                        <mat-icon class="mr-1">skip_next</mat-icon> Advance Stage
                      </button>
                    </div>
                  } @else if (stage.onComplete === 'auto_advance') {
                    <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
                      <mat-icon class="text-blue-600">autorenew</mat-icon>
                      <div class="flex-1">
                        <p class="text-sm font-semibold text-blue-800">All steps complete</p>
                        <p class="text-xs text-blue-600">Stage will auto-advance when the last step is completed</p>
                      </div>
                    </div>
                  } @else if (stage.onComplete === 'resolve_case') {
                    <div class="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
                      <mat-icon class="text-emerald-600">check_circle</mat-icon>
                      <div class="flex-1">
                        <p class="text-sm font-semibold text-emerald-800">All steps complete — Case resolved</p>
                        <p class="text-xs text-emerald-600">This was the final stage of the case</p>
                      </div>
                    </div>
                  }
                }
              }
            } @else {
              <div class="text-center py-12 text-slate-400">
                <mat-icon class="!text-5xl mb-2">check_circle_outline</mat-icon>
                <p class="text-lg font-medium">All stages complete</p>
                <p class="text-sm">This case has been processed through all stages</p>
              </div>
            }
          </div>
        </div>
      </div>
    } @else {
      <div class="text-center py-16 text-slate-400">
        <mat-icon class="!text-5xl mb-2">error_outline</mat-icon>
        <p class="text-lg">Case not found</p>
        <a mat-button color="primary" routerLink="/portal/cases" class="mt-4">Back to Cases</a>
      </div>
    }
  `,
  styles: [`
    .stage-chevron {
      clip-path: polygon(0% 0%, 88% 0%, 100% 50%, 88% 100%, 0% 100%, 12% 50%);
    }
    .stage-chevron:first-child {
      clip-path: polygon(0% 0%, 88% 0%, 100% 50%, 88% 100%, 0% 100%);
    }
    .stage-chevron-completed {
      background-color: #4b9e4b;
      color: white;
    }
    .stage-chevron-active {
      background-color: #056DAE;
      color: white;
    }
    .stage-chevron-pending {
      background-color: #e2e8f0;
      color: #64748b;
    }
  `],
})
export class PortalCaseViewComponent implements OnInit, OnDestroy {
  c: CaseInstance | null = null;
  isLoading = false;
  sidebarTab: 'details' | 'history' = 'details';

  objectKeys = Object.keys;

  private destroy$ = new Subject<void>();

  constructor(
    private store: Store,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.store.dispatch(CasesActions.loadCaseInstance({ id }));
    }
    this.store.select(selectCasesLoading).pipe(takeUntil(this.destroy$)).subscribe((v) => (this.isLoading = v));
    this.store.select(selectSelectedCaseInstance).pipe(takeUntil(this.destroy$)).subscribe((v) => (this.c = v));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  currentStage(): StageInstance | null {
    if (!this.c) return null;
    // Match by currentStageId for reliability, fallback to index
    if (this.c.currentStageId) {
      return this.c.stages.find(s => s.stageDefinitionId === this.c!.currentStageId) || null;
    }
    return this.c.stages?.[this.c.currentStageIndex] || null;
  }

  stepsForStage(stage: StageInstance): StepInstance[] {
    // Flatten steps from ALL processes in the stage (not just first)
    const allSteps: StepInstance[] = [];
    for (const proc of stage.processes || []) {
      allSteps.push(...(proc.steps || []));
    }
    return allSteps.sort((a, b) => a.order - b.order);
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

  allStepsComplete(stage: StageInstance): boolean {
    const steps = this.stepsForStage(stage);
    return steps.length > 0 && steps.every(s => s.status === 'completed' || s.status === 'skipped');
  }

  currentStepObj(stage: StageInstance): StepInstance | null {
    const steps = this.stepsForStage(stage);
    const idx = this.currentStepIndex(stage);
    return steps[idx] || null;
  }

  onCompleteStep(event: { step: StepInstance; formData: Record<string, any> }): void {
    debugger;
    if (!this.c) return;
    this.store.dispatch(
      CasesActions.completeStep({
        caseId: this.c.id,
        stepId: event.step.stepDefinitionId,
        request: { formData: event.formData },
      })
    );
    this.snackBar.open(`Step "${event.step.name}" completed`, 'OK', { duration: 3000 });
  }

  onAdvanceStage(): void {
    if (!this.c) return;
    this.store.dispatch(CasesActions.advanceStage({ caseId: this.c.id }));
    this.snackBar.open('Stage advanced', 'OK', { duration: 3000 });
  }

  onResolve(): void {
    if (!this.c) return;
    this.store.dispatch(CasesActions.resolveCaseInstance({ caseId: this.c.id }));
    this.snackBar.open('Case resolved', 'OK', { duration: 3000 });
  }

  onWithdraw(): void {
    if (!this.c) return;
    this.store.dispatch(CasesActions.withdrawCaseInstance({ caseId: this.c.id }));
    this.snackBar.open('Case withdrawn', 'OK', { duration: 3000 });
  }

  slaClass(c: CaseInstance): string {
    if (c.slaDaysRemaining != null && c.slaDaysRemaining < 0) return 'border-red-300 bg-red-50 text-red-700';
    if (c.slaDaysRemaining != null && c.slaDaysRemaining <= 2) return 'border-amber-300 bg-amber-50 text-amber-700';
    return 'border-slate-200 bg-slate-50 text-slate-600';
  }

  slaTextClass(c: CaseInstance): string {
    if (c.slaDaysRemaining != null && c.slaDaysRemaining < 0) return 'text-red-600';
    if (c.slaDaysRemaining != null && c.slaDaysRemaining <= 2) return 'text-amber-600';
    return 'text-slate-600';
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
