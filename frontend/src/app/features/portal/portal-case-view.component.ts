import { Component, OnInit, OnDestroy, HostListener, signal } from '@angular/core';
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
import { Subject, takeUntil, map, Observable } from 'rxjs';
import { CaseInstance, StageInstance, StepInstance, User } from '@core/models';
import { statusLabel } from '@core/utils/status-labels';
import * as CasesActions from '@state/cases/cases.actions';
import * as AssignmentsActions from '@state/assignments/assignments.actions';
import {
  selectSelectedCaseInstance,
  selectCasesLoading,
} from '@state/cases/cases.selectors';
import { selectUser } from '@state/auth/auth.selectors';
import { selectCommentsByCase } from '@state/comments/comments.selectors';
import { StepCardComponent } from '@features/portal/shared/step-card.component';
import { CommentsComponent } from '@features/comments/comments.component';
import { AiSummaryCardComponent } from '@features/ai/summary-card/ai-summary-card.component';
import { RecommendationSidebarComponent } from '@features/ai/recommendation-sidebar/recommendation-sidebar.component';
import { RiskSidebarComponent } from '@features/ai/risk-sidebar/risk-sidebar.component';
import { RoutingSidebarComponent } from '@features/ai/routing-sidebar/routing-sidebar.component';

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
    CommentsComponent,
    AiSummaryCardComponent,
    RecommendationSidebarComponent,
    RiskSidebarComponent,
    RoutingSidebarComponent,
  ],
  template: `
    @if (isLoading) {
      <div class="flex items-center justify-center h-64">
        <mat-spinner diameter="40"></mat-spinner>
      </div>
    } @else if (c) {
      <div class="-m-5 flex gap-0 h-[calc(100vh-108px)]">
        <!-- ========== LEFT SIDEBAR ========== -->
        <div class="flex-shrink-0 border-r border-slate-200 sidebar-gradient overflow-y-auto flex flex-col"
             [style.width.px]="sidebarWidth()">
          <!-- Resize handle -->
          <div class="resize-handle" (mousedown)="startResize($event)"></div>
          <!-- Case Header -->
          <div class="px-5 pt-5 pb-4">
            <div class="flex items-center gap-2 mb-2">
              <div class="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center">
                <mat-icon class="!text-lg text-white/90">folder_open</mat-icon>
              </div>
              <div>
                <span class="text-[10px] font-semibold text-primary-200 uppercase tracking-wider">{{ c.caseTypeName || c.caseTypeId }}</span>
                <p class="text-sm font-bold text-white leading-tight">{{ c.id }}</p>
              </div>
            </div>
            <p class="text-xs text-primary-100 leading-snug mt-1">{{ c.title }}</p>
          </div>

          <!-- Action Buttons -->
          <div class="flex items-center gap-2 px-5 py-3 border-t border-white/10">
            <button class="sidebar-btn flex-1 flex items-center justify-center gap-1 rounded" routerLink="/portal/cases">
              <mat-icon class="!text-sm">arrow_back</mat-icon> Back
            </button>
            <button class="sidebar-btn flex items-center justify-center gap-1 rounded" [matMenuTriggerFor]="actionsMenu">
              Actions <mat-icon class="!text-sm">arrow_drop_down</mat-icon>
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
              } @else {
                <button mat-menu-item disabled>
                  <mat-icon>info</mat-icon> Case {{ statusLabel(c.status) }}
                </button>
              }
            </mat-menu>
          </div>

          <!-- Case Properties -->
          <div class="px-5 py-4 space-y-3.5 border-t border-white/10">
            <div class="flex items-center justify-between">
              <p class="text-[10px] font-semibold text-primary-300 uppercase tracking-wider">Priority</p>
              <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    [ngClass]="priorityBadge(c.priority)">{{ c.priority | titlecase }}</span>
            </div>
            <div class="flex items-center justify-between">
              <p class="text-[10px] font-semibold text-primary-300 uppercase tracking-wider">Status</p>
              <span class="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    [ngClass]="statusBadge(c.status)">{{ statusLabel(c.status) }}</span>
            </div>
            <div>
              <p class="text-[10px] font-semibold text-primary-300 uppercase tracking-wider">Created</p>
              <p class="text-xs text-white font-medium mt-0.5">{{ c.ownerId || 'System' }}</p>
              <p class="text-[10px] text-primary-300">{{ c.createdAt | date:'medium' }}</p>
            </div>
            <div>
              <p class="text-[10px] font-semibold text-primary-300 uppercase tracking-wider">Updated</p>
              <p class="text-[10px] text-primary-300">{{ c.updatedAt | date:'medium' }}</p>
            </div>
            @if (c.slaTargetDate) {
              <div class="p-2.5 rounded-lg" [ngClass]="slaBgClass(c)">
                <p class="text-[10px] font-semibold uppercase tracking-wider mb-0.5"
                   [ngClass]="c.slaDaysRemaining != null && c.slaDaysRemaining < 0 ? 'text-red-300' : 'text-primary-300'">SLA</p>
                <div class="flex items-center gap-1.5">
                  @if (c.slaDaysRemaining != null && c.slaDaysRemaining < 0) {
                    <mat-icon class="!text-sm text-red-400">warning</mat-icon>
                    <span class="text-xs font-bold text-red-300">{{ -c.slaDaysRemaining }}d overdue</span>
                  } @else if (c.slaDaysRemaining != null && c.slaDaysRemaining === 0) {
                    <mat-icon class="!text-sm text-amber-400">schedule</mat-icon>
                    <span class="text-xs font-bold text-amber-300">Due today</span>
                  } @else if (c.slaDaysRemaining != null) {
                    <mat-icon class="!text-sm text-emerald-400">schedule</mat-icon>
                    <span class="text-xs font-medium text-emerald-300">{{ c.slaDaysRemaining }}d remaining</span>
                  } @else {
                    <span class="text-xs text-primary-200">{{ c.slaTargetDate | date:'shortDate' }}</span>
                  }
                  @if (c.escalationLevel > 0) {
                    <span class="text-[9px] px-1.5 py-0.5 rounded bg-red-500/30 text-red-300 font-bold uppercase ml-auto">Esc {{ c.escalationLevel }}</span>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Sidebar Nav Tabs -->
          <div class="px-5 py-2 border-t border-white/10 flex gap-1">
            <button class="flex-1 text-xs font-semibold px-2 py-1.5 rounded-md transition-colors text-center"
                    [ngClass]="sidebarTab === 'details' ? 'bg-white/20 text-white' : 'text-primary-300 hover:bg-white/10 hover:text-white'"
                    (click)="sidebarTab = 'details'">
              Details
            </button>
            <button class="flex-1 text-xs font-semibold px-2 py-1.5 rounded-md transition-colors text-center"
                    [ngClass]="sidebarTab === 'history' ? 'bg-white/20 text-white' : 'text-primary-300 hover:bg-white/10 hover:text-white'"
                    (click)="sidebarTab = 'history'">
              History
            </button>
            <button class="flex-1 text-xs font-semibold px-2 py-1.5 rounded-md transition-colors text-center relative"
                    [ngClass]="sidebarTab === 'comments' ? 'bg-white/20 text-white' : 'text-primary-300 hover:bg-white/10 hover:text-white'"
                    (click)="sidebarTab = 'comments'">
              Comments
              @if ((commentCount$ | async); as count) {
                @if (count > 0) {
                  <span class="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 text-white text-[8px] font-bold flex items-center justify-center">{{ count }}</span>
                }
              }
            </button>
            <button class="flex-1 text-xs font-semibold px-2 py-1.5 rounded-md transition-colors text-center"
                    [ngClass]="sidebarTab === 'audit' ? 'bg-white/20 text-white' : 'text-primary-300 hover:bg-white/10 hover:text-white'"
                    (click)="sidebarTab = 'audit'">
              Audit
            </button>
          </div>

          <!-- Sidebar Content Panel -->
          @if (sidebarTab === 'details') {
            <div class="px-5 py-4 border-t border-white/10 flex-1">
              <h4 class="text-[10px] font-semibold text-primary-300 uppercase tracking-wider mb-3">Case Details</h4>
              <div class="space-y-2.5">
                <div>
                  <p class="text-[10px] text-primary-400">Title</p>
                  <p class="text-xs text-white">{{ c.title }}</p>
                </div>
                <div>
                  <p class="text-[10px] text-primary-400">Description</p>
                  <p class="text-xs text-primary-100">{{ c.description || '—' }}</p>
                </div>
                <div>
                  <p class="text-[10px] text-primary-400">Owner</p>
                  <p class="text-xs text-white">{{ c.ownerId || 'Unassigned' }}</p>
                </div>
                <div>
                  <p class="text-[10px] text-primary-400">Case Type</p>
                  <p class="text-xs text-primary-100">{{ c.caseTypeName || c.caseTypeId }}</p>
                </div>
                @if (c.resolvedAt) {
                  <div>
                    <p class="text-[10px] text-primary-400">Resolved</p>
                    <p class="text-xs text-white">{{ c.resolvedAt | date:'medium' }}</p>
                  </div>
                }
              </div>
              @if (c.data && objectKeys(c.data).length > 0) {
                <div class="h-px bg-white/10 my-3"></div>
                <h4 class="text-[10px] font-semibold text-primary-300 uppercase tracking-wider mb-2">Case Data</h4>
                <div class="space-y-1.5">
                  @for (key of objectKeys(c.data); track key) {
                    <div class="flex justify-between text-xs">
                      <span class="text-primary-300">{{ key }}</span>
                      <span class="text-white font-medium truncate ml-2 max-w-[140px]">{{ c.data[key] }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          }

          @if (sidebarTab === 'audit') {
            <div class="px-5 py-4 border-t border-white/10 flex-1">
              <h4 class="text-[10px] font-semibold text-primary-300 uppercase tracking-wider mb-3">Audit Logs</h4>
              <p class="text-[10px] text-primary-300 mb-4 leading-relaxed">View every action, decision, and state change for this case.</p>
              <a class="sidebar-btn w-full flex items-center justify-center gap-1.5 rounded"
                 [routerLink]="['/admin/audit-logs']"
                 [queryParams]="{ entityId: c.id }">
                <mat-icon class="!text-sm">history</mat-icon>
                Open Audit Logs
              </a>
            </div>
          }

          @if (sidebarTab === 'comments') {
            <div class="py-4 border-t border-white/10 flex-1 overflow-y-auto">
              <div class="comments-sidebar-wrapper">
                <app-comments [caseId]="c.id"></app-comments>
              </div>
            </div>
          }

          @if (sidebarTab === 'history') {
            <div class="px-5 py-4 border-t border-white/10 flex-1">
              <h4 class="text-[10px] font-semibold text-primary-300 uppercase tracking-wider mb-3">Stage History</h4>
              @for (stage of c.stages; track stage.stageDefinitionId; let si = $index) {
                <div class="mb-3">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center"
                          [ngClass]="stage.status === 'completed' ? 'bg-emerald-500 text-white' :
                                     stage.stageDefinitionId === c.currentStageId ? 'bg-white text-primary-800' : 'bg-white/20 text-primary-300'">
                      {{ si + 1 }}
                    </span>
                    <span class="text-xs font-medium" [ngClass]="stage.status === 'completed' ? 'text-emerald-300' :
                          stage.stageDefinitionId === c.currentStageId ? 'text-white' : 'text-primary-300'">{{ stage.name }}</span>
                  </div>
                  @if (stepsForStage(stage); as steps) {
                    <div class="ml-6 space-y-0.5">
                      @for (step of steps; track step.stepDefinitionId) {
                        <div class="flex items-center gap-1.5 text-[10px]">
                          <mat-icon class="!text-xs" [ngClass]="stepIconClassSidebar(step)">{{ stepIcon(step) }}</mat-icon>
                          <span [ngClass]="step.status === 'completed' ? 'text-primary-100' : 'text-primary-400'">{{ step.name }}</span>
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
              <div class="flex items-center gap-2">
                <div class="flex items-center gap-0 overflow-x-auto flex-1 min-w-0">
                @for (stage of c.stages; track stage.stageDefinitionId; let si = $index) {
                  <div class="stage-chevron px-5 py-2.5 min-w-[130px] text-center text-xs font-semibold"
                       [class.stage-chevron-completed]="stage.status === 'completed'"
                       [class.stage-chevron-active]="stage.stageDefinitionId === c.currentStageId && stage.status !== 'completed'"
                       [class.stage-chevron-pending]="stage.status === 'pending'">
                    {{ stage.name }}
                  </div>
                  @if (si < c.stages.length - 1) {
                    <mat-icon class="text-slate-300 !text-lg flex-shrink-0 -mx-1">chevron_right</mat-icon>
                  }
                }
                </div>
                <!-- AI Insights Toggle -->
                <div class="flex-shrink-0">
                  <button class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.97]"
                          [ngClass]="aiPanelOpen()
                            ? 'bg-gradient-to-r from-primary-500 to-sky-500 text-white shadow-md shadow-primary-500/25'
                            : 'bg-white/80 text-primary-600 hover:bg-primary-50 border border-primary-200/60 shadow-sm hover:shadow-md hover:border-primary-300'"
                          (click)="toggleAiPanel()">
                    <mat-icon class="!text-sm !w-4 !h-4">auto_awesome</mat-icon>
                    AI Insights
                    <mat-icon class="!text-sm !w-4 !h-4">{{ aiPanelOpen() ? 'chevron_right' : 'chevron_left' }}</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          }

          <!-- Step Content Area -->
          <div class="flex-1 overflow-y-auto px-6 py-5">
            @if (currentStage(); as stage) {
              <!-- Current step assignment header -->
              @if (currentStepObj(stage); as curStep) {
                <div class="flex items-center gap-3 mb-4">
                  <div class="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center text-sm font-bold">
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

              <!-- Steps list grouped by process -->
              @for (proc of stage.processes || []; track proc.processDefinitionId) {
                @if ((stage.processes || []).length > 1) {
                  <div class="flex items-center gap-2 mt-4 mb-2 first:mt-0">
                    <div class="h-px flex-1 bg-slate-200"></div>
                    <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">
                      {{ proc.name }}
                      @if (proc.status === 'completed') {
                        <mat-icon class="!text-xs align-middle text-emerald-500 ml-0.5">check_circle</mat-icon>
                      } @else if (proc.status === 'in_progress') {
                        <mat-icon class="!text-xs align-middle text-blue-500 ml-0.5">pending</mat-icon>
                      }
                    </span>
                    <div class="h-px flex-1 bg-slate-200"></div>
                  </div>
                }
                <div class="space-y-3">
                  @for (step of proc.steps || []; track step.stepDefinitionId) {
                    <app-step-card
                      [step]="step"
                      [isCurrent]="isCurrentStep(step, stage)"
                      [caseId]="c.id"
                      [currentUser]="currentUser"
                      (onComplete)="onCompleteStep($event)">
                    </app-step-card>
                  }
                </div>
              }

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
                    <div class="mb-4 px-4 py-3 bg-primary-50 border border-primary-200 rounded-lg flex items-start gap-2">
                      <mat-icon class="text-primary-500 !text-xl mt-0.5">autorenew</mat-icon>
                      <div>
                        <p class="text-sm font-semibold text-primary-800">All steps complete</p>
                        <p class="text-xs text-primary-600">Stage will auto-advance when the last step is completed</p>
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
            } @else {
              <div class="text-center py-12 text-slate-400">
                <mat-icon class="!text-5xl mb-2">check_circle_outline</mat-icon>
                <p class="text-lg font-medium">All stages complete</p>
                <p class="text-sm">This case has been processed through all stages</p>
              </div>
            }
          </div>
        </div>

        <!-- ========== AI INSIGHTS RIGHT PANEL ========== -->
        @if (aiPanelOpen()) {
          <div class="w-80 flex-shrink-0 border-l border-slate-200/80 bg-white overflow-y-auto ai-panel-slide">
            <!-- Panel Header -->
            <div class="sticky top-0 z-10">
              <div class="relative px-4 py-3 bg-white/95 backdrop-blur-md border-b border-slate-100">
                <div class="absolute inset-0 bg-gradient-to-r from-primary-500/[0.05] via-sky-500/[0.03] to-transparent"></div>
                <div class="relative flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 via-sky-500 to-violet-500 flex items-center justify-center shadow-md shadow-primary-500/25">
                      <mat-icon class="!text-base text-white">auto_awesome</mat-icon>
                    </div>
                    <div>
                      <h3 class="text-sm font-bold text-slate-800">AI Insights</h3>
                      <p class="text-[10px] text-slate-400 font-medium">Powered by AI analysis</p>
                    </div>
                  </div>
                  <button class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                          (click)="toggleAiPanel()">
                    <mat-icon class="!text-lg">close</mat-icon>
                  </button>
                </div>
              </div>
            </div>

            <!-- AI Components Stack -->
            <div class="px-4 py-3 divide-y divide-slate-100">
              <!-- Case Summary -->
              <div class="pb-4">
                <app-ai-summary-card [caseId]="c.id"></app-ai-summary-card>
              </div>

              <!-- Recommendations -->
              <div class="py-4">
                <app-recommendation-sidebar [caseId]="c.id"></app-recommendation-sidebar>
              </div>

              <!-- Risk Assessment -->
              <div class="py-4">
                <app-risk-sidebar [caseId]="c.id"></app-risk-sidebar>
              </div>

              <!-- Smart Routing -->
              <div class="pt-4">
                <app-routing-sidebar
                  [caseId]="c.id"
                  [stepName]="currentStepName()"
                  [assignmentId]="currentAssignmentId()"
                  (assignUser)="onAssignUser($event)">
                </app-routing-sidebar>
              </div>
            </div>

            <!-- Bottom branding -->
            <div class="text-center py-3 border-t border-slate-100">
              <p class="text-[10px] text-slate-300 flex items-center justify-center gap-1">
                <mat-icon class="!text-xs">auto_awesome</mat-icon>
                AI-powered insights
              </p>
            </div>
          </div>
        }
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
    .sidebar-gradient {
      background: linear-gradient(135deg, var(--wf-primary) 0%, var(--wf-primary-dark) 100%);
      position: relative;
    }
    .resize-handle {
      position: absolute;
      top: 0;
      right: -4px;
      width: 8px;
      height: 100%;
      cursor: col-resize;
      z-index: 10;
      background: transparent;
    }
    .resize-handle:hover, .resize-handle:active {
      background: rgba(255,255,255,0.25);
    }
    .sidebar-btn {
      font-size: 12px;
      height: 32px;
      padding: 0 12px;
      border: 1px solid rgba(255,255,255,0.3);
      color: white;
      background: rgba(255,255,255,0.08);
      cursor: pointer;
    }
    .sidebar-btn:hover {
      background: rgba(255,255,255,0.18);
    }
    .comments-sidebar-wrapper {
      padding: 0 20px;
      color: #1e293b;
      background-color: #f8fafc;
    }
    .comments-sidebar-wrapper :deep(h3) {
      color: #1e293b !important;
    }
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
    .ai-panel-slide {
      animation: slideInRight 200ms ease-out;
    }
    @keyframes slideInRight {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `],
})
export class PortalCaseViewComponent implements OnInit, OnDestroy {
  c: CaseInstance | null = null;
  currentUser: User | null = null;
  isLoading = false;
  sidebarTab: 'details' | 'history' | 'audit' | 'comments' = 'details';
  commentCount$: Observable<number> | null = null;
  sidebarWidth = signal(288); // default ~w-72
  aiPanelOpen = signal(false);
  private isResizing = false;
  private resizeStartX = 0;
  private resizeStartWidth = 288;
  objectKeys = Object.keys;
  statusLabel = statusLabel;

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
      this.commentCount$ = this.store.select(selectCommentsByCase(id)).pipe(map(list => list.length));
    }
    this.store.select(selectCasesLoading).pipe(takeUntil(this.destroy$)).subscribe((v) => (this.isLoading = v));
    this.store.select(selectSelectedCaseInstance).pipe(takeUntil(this.destroy$)).subscribe((v) => (this.c = v));
    this.store.select(selectUser).pipe(takeUntil(this.destroy$)).subscribe((v) => (this.currentUser = v));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  startResize(event: MouseEvent): void {
    this.isResizing = true;
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.sidebarWidth();
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isResizing) return;
    const delta = event.clientX - this.resizeStartX;
    const newWidth = Math.min(600, Math.max(200, this.resizeStartWidth + delta));
    this.sidebarWidth.set(newWidth);
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    this.isResizing = false;
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
    // Flatten steps from ALL processes, preserving process order then step order
    const allSteps: { step: StepInstance; procOrder: number }[] = [];
    for (const proc of stage.processes || []) {
      const procOrder = proc.order ?? 0;
      for (const step of proc.steps || []) {
        allSteps.push({ step, procOrder });
      }
    }
    allSteps.sort((a, b) => a.procOrder - b.procOrder || a.step.order - b.step.order);
    return allSteps.map((s) => s.step);
  }

  currentStepIndex(stage: StageInstance): number {
    const steps = this.stepsForStage(stage);
    // Prefer in_progress or waiting step over pending — handles multi-process stages
    const ipIdx = steps.findIndex((s) => s.status === 'in_progress' || s.status === 'waiting');
    if (ipIdx >= 0) return ipIdx;
    const pendIdx = steps.findIndex((s) => s.status === 'pending');
    return pendIdx >= 0 ? pendIdx : steps.length;
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

  /** Get the current active step's name for AI routing context */
  currentStepName(): string | null {
    const stage = this.currentStage();
    if (!stage) return null;
    const step = this.currentStepObj(stage);
    return step?.name || null;
  }

  /** Get the current active assignment ID (if any) for step-level reassignment */
  currentAssignmentId(): string | null {
    if (!this.c) return null;
    // The current step's definition ID maps to the assignment's step_id
    return this.c.currentStepId || null;
  }

  onCompleteStep(event: { step: StepInstance; formData: Record<string, any> }): void {
    if (!this.c) return;
    // Serialize Date objects to ISO strings for NgRx strict serialization
    const formData: Record<string, any> = {};
    for (const [key, value] of Object.entries(event.formData)) {
      formData[key] = value instanceof Date ? value.toISOString() : value;
    }
    this.store.dispatch(
      CasesActions.completeStep({
        caseId: this.c.id,
        stepId: event.step.stepDefinitionId,
        request: { formData },
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

  toggleAiPanel(): void {
    this.aiPanelOpen.update(v => !v);
  }

  onAssignUser(event: { userId: string; assignmentId: string | null }): void {
    if (!this.c) return;
    if (event.assignmentId) {
      // Step-level reassignment via assignments store
      this.store.dispatch(AssignmentsActions.reassignAssignment({
        id: event.assignmentId,
        request: { assignedTo: event.userId, reason: 'AI-suggested routing' },
      }));
      this.snackBar.open(`Reassigned step to user`, 'OK', { duration: 3000 });
    } else {
      this.snackBar.open(`Suggested assignee: ${event.userId} (no active assignment to reassign)`, 'OK', { duration: 3000 });
    }
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

  slaBgClass(c: CaseInstance): string {
    if (c.slaDaysRemaining != null && c.slaDaysRemaining < 0) return 'bg-red-500/20';
    if (c.slaDaysRemaining != null && c.slaDaysRemaining <= 2) return 'bg-amber-500/15';
    return 'bg-white/5';
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

  stepIconClassSidebar(step: StepInstance): string {
    if (step.status === 'completed') return 'text-emerald-400';
    if (step.status === 'in_progress') return 'text-white';
    if (step.status === 'waiting') return 'text-amber-400';
    return 'text-primary-500';
  }
}
