import { Component, OnInit, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { of, Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { selectCasesList } from '../../state/cases/cases.selectors';
import { Case, Task } from '../../core/models';
import { CommentsComponent } from '../comments/comments.component';
import { AuditLogComponent } from '../audit/audit-log.component';
import { WebSocketService } from '../../core/services/websocket.service';
import { selectUser } from '../../state/auth/auth.selectors';

@Component({
  selector: 'app-case-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatListModule,
    MatDividerModule,
    MatExpansionModule,
    MatTooltipModule,
    CommentsComponent,
    AuditLogComponent,
  ],
  template: `
    @let caseData = case$ | async;
    @if (caseData) {
      <div class="case-detail-container animate-fade-in">
        <!-- Breadcrumb & Back -->
        <div class="flex items-center gap-2 mb-6 text-sm text-slate-500">
          <a routerLink="/cases" class="hover:text-[#056DAE] transition-colors flex items-center gap-1">
            <mat-icon class="text-base">arrow_back</mat-icon>
            Cases
          </a>
          <mat-icon class="text-base">chevron_right</mat-icon>
          <span class="text-slate-800 font-medium">{{ caseData.id }}</span>
        </div>

        <!-- Header Card -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div class="flex items-center gap-4">
              <!-- Case icon -->
              <div class="w-14 h-14 rounded-xl flex items-center justify-center"
                   [ngClass]="statusBg(caseData.status)">
                <mat-icon class="text-3xl" [ngClass]="statusColor(caseData.status)">
                  {{ statusIcon(caseData.status) }}
                </mat-icon>
              </div>
              <div>
                <h1 class="text-2xl font-bold text-slate-900 tracking-tight">{{ caseData.id }}</h1>
                <p class="text-slate-500 mt-0.5">
                  {{ caseData.fields['applicantName'] }}
                  <span class="mx-1.5 text-slate-300">|</span>
                  <span class="wf-badge wf-badge--neutral">{{ caseData.caseType | uppercase }}</span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <!-- Presence Indicator -->
              @if (wsService.connected()) {
                <div class="flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded-full">
                  <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span class="text-xs text-green-700 font-medium">Live</span>
                  @for (viewer of wsService.presenceUsers(); track viewer.id) {
                    <div class="w-6 h-6 rounded-full bg-[#056DAE] text-white flex items-center justify-center text-[10px] font-bold -ml-1 ring-2 ring-white"
                         [matTooltip]="viewer.name">
                      {{ viewer.name.charAt(0) }}
                    </div>
                  }
                </div>
              }
              <span class="wf-badge" [ngClass]="statusBadge(caseData.status)">
                <span class="w-2 h-2 rounded-full inline-block" [ngClass]="statusDot(caseData.status)"></span>
                {{ caseData.status | uppercase }}
              </span>
              <span class="wf-badge" [ngClass]="priorityBadgeClass(caseData.priority)">
                {{ caseData.priority | uppercase }}
              </span>
            </div>
          </div>
        </div>

        <!-- Stage Journey -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-base font-semibold text-slate-800 flex items-center gap-2">
              <mat-icon class="text-[#056DAE]">route</mat-icon>
              Case Journey
            </h3>
            <span class="text-xs font-semibold text-[#056DAE] bg-[#EAF4FB] px-3 py-1 rounded-full">
              {{ getProgressPercentage(caseData.stageHistory ?? []) | number:'1.0-0' }}% Complete
            </span>
          </div>

          <!-- Stage Steps -->
          <div class="flex items-start justify-between relative">
            <!-- Connector line behind circles -->
            <div class="absolute top-5 left-[5%] right-[5%] h-0.5 bg-slate-200 z-0"></div>
            <div class="absolute top-5 left-[5%] h-0.5 bg-[#056DAE] z-0 transition-all duration-500"
                 [style.width.%]="getProgressPercentage(caseData.stageHistory ?? []) * 0.9"></div>

            @for (stage of stages; track stage.name) {
              <div class="flex flex-col items-center z-10 flex-1">
                <!-- Circle -->
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ring-4 ring-white"
                     [ngClass]="stageCircleClass(caseData.stageHistory ?? [], stage.name)">
                  @if (isStageCompleted(caseData.stageHistory ?? [], stage.name)) {
                    <mat-icon class="text-lg">check</mat-icon>
                  } @else if (isStageActive(caseData.stage, stage.name)) {
                    <mat-icon class="text-lg animate-pulse">fiber_manual_record</mat-icon>
                  } @else {
                    <span>{{ stage.order }}</span>
                  }
                </div>
                <!-- Label -->
                <span class="text-[11px] font-semibold mt-2 text-center leading-tight"
                      [ngClass]="isStageCompleted(caseData.stageHistory ?? [], stage.name) ? 'text-emerald-700' :
                                 isStageActive(caseData.stage, stage.name) ? 'text-[#003B70]' : 'text-slate-400'">
                  {{ stage.name | uppercase }}
                </span>
              </div>
            }
          </div>

          <!-- Progress Bar -->
          <div class="mt-5">
            <mat-progress-bar
              mode="determinate"
              [value]="getProgressPercentage(caseData.stageHistory ?? [])"
            ></mat-progress-bar>
          </div>
        </div>

        <!-- Main Content Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left: Tabs (2 cols) -->
          <div class="lg:col-span-2">
            <mat-tab-group animationDuration="200ms">
              <!-- Details Tab -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <div class="flex items-center gap-2 py-1">
                    <mat-icon>description</mat-icon>
                    <span>Details</span>
                  </div>
                </ng-template>

                <div class="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                  <form [formGroup]="detailsForm" class="space-y-5">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <mat-form-field class="w-full">
                        <mat-label>Applicant Name</mat-label>
                        <input matInput formControlName="applicantName" readonly />
                        <mat-icon matIconPrefix>person</mat-icon>
                      </mat-form-field>

                      <mat-form-field class="w-full">
                        <mat-label>Loan Amount</mat-label>
                        <input matInput formControlName="loanAmount" readonly />
                        <mat-icon matIconPrefix>payments</mat-icon>
                      </mat-form-field>

                      <mat-form-field class="w-full">
                        <mat-label>Interest Rate</mat-label>
                        <input matInput formControlName="interestRate" readonly />
                        <mat-icon matIconPrefix>percent</mat-icon>
                      </mat-form-field>

                      <mat-form-field class="w-full">
                        <mat-label>Loan Term (months)</mat-label>
                        <input matInput formControlName="loanTerm" readonly />
                        <mat-icon matIconPrefix>date_range</mat-icon>
                      </mat-form-field>

                      <mat-form-field class="w-full">
                        <mat-label>Status</mat-label>
                        <mat-select formControlName="status">
                          <mat-option value="open">Open</mat-option>
                          <mat-option value="in_progress">In Progress</mat-option>
                          <mat-option value="pending_review">Pending Review</mat-option>
                          <mat-option value="closed">Closed</mat-option>
                        </mat-select>
                        <mat-icon matIconPrefix>flag</mat-icon>
                      </mat-form-field>

                      <mat-form-field class="w-full">
                        <mat-label>Priority</mat-label>
                        <mat-select formControlName="priority">
                          <mat-option value="critical">Critical</mat-option>
                          <mat-option value="high">High</mat-option>
                          <mat-option value="medium">Medium</mat-option>
                          <mat-option value="low">Low</mat-option>
                        </mat-select>
                        <mat-icon matIconPrefix>priority_high</mat-icon>
                      </mat-form-field>
                    </div>

                    <mat-form-field class="w-full">
                      <mat-label>Notes</mat-label>
                      <textarea matInput formControlName="notes" rows="4"></textarea>
                      <mat-icon matIconPrefix>notes</mat-icon>
                    </mat-form-field>

                    <div class="flex gap-3 pt-2">
                      <button mat-raised-button color="primary">
                        <mat-icon>save</mat-icon>
                        Save Changes
                      </button>
                      <button mat-stroked-button>
                        <mat-icon>undo</mat-icon>
                        Reset
                      </button>
                    </div>
                  </form>
                </div>
              </mat-tab>

              <!-- Tasks Tab -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <div class="flex items-center gap-2 py-1">
                    <mat-icon>task_alt</mat-icon>
                    <span>Tasks</span>
                    @if (tasks.length > 0) {
                      <span class="ml-1 bg-[#d0e8f7] text-[#003B70] text-[11px] font-bold px-2 py-0.5 rounded-full">
                        {{ tasks.length }}
                      </span>
                    }
                  </div>
                </ng-template>

                <div class="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                  @if (tasks.length > 0) {
                    <div class="space-y-3">
                      @for (task of tasks; track task.id) {
                        <div class="group flex items-start gap-4 p-4 rounded-lg border border-slate-100 hover:border-[#a1d1ef] hover:bg-[#EAF4FB]/30 transition-all duration-200 cursor-pointer">
                          <!-- Status Icon -->
                          <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                               [ngClass]="taskStatusBg(task.status)">
                            <mat-icon class="text-lg" [ngClass]="taskStatusColor(task.status)">
                              {{ taskStatusIcon(task.status) }}
                            </mat-icon>
                          </div>
                          <!-- Content -->
                          <div class="flex-1 min-w-0">
                            <h4 class="font-semibold text-slate-800 text-sm">{{ task.title }}</h4>
                            <p class="text-xs text-slate-500 mt-0.5 truncate">{{ task.description }}</p>
                            <div class="flex items-center gap-2 mt-2">
                              @if (task.dueDate) {
                                <span class="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                                  <mat-icon class="text-xs">schedule</mat-icon>
                                  {{ task.dueDate | date: 'mediumDate' }}
                                </span>
                              }
                              <span class="wf-badge text-[10px]" [ngClass]="priorityBadgeClass(task.priority)">
                                {{ task.priority | uppercase }}
                              </span>
                            </div>
                          </div>
                          <!-- Arrow -->
                          <mat-icon class="text-slate-300 group-hover:text-[#056DAE] transition-colors">
                            chevron_right
                          </mat-icon>
                        </div>
                      }
                    </div>
                  } @else {
                    <div class="text-center py-12">
                      <mat-icon class="text-5xl text-slate-200">task_alt</mat-icon>
                      <p class="text-slate-400 mt-3 text-sm">No tasks for this case yet</p>
                      <button mat-stroked-button color="primary" class="mt-4">
                        <mat-icon>add</mat-icon> Create Task
                      </button>
                    </div>
                  }
                </div>
              </mat-tab>

              <!-- Activity Tab -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <div class="flex items-center gap-2 py-1">
                    <mat-icon>history</mat-icon>
                    <span>Activity</span>
                  </div>
                </ng-template>

                <div class="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                  <app-audit-log [entityId]="caseData.id"></app-audit-log>
                </div>
              </mat-tab>

              <!-- Comments Tab -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <div class="flex items-center gap-2 py-1">
                    <mat-icon>chat_bubble_outline</mat-icon>
                    <span>Comments</span>
                  </div>
                </ng-template>

                <div class="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                  <app-comments [caseId]="caseData.id"></app-comments>
                </div>
              </mat-tab>
            </mat-tab-group>
          </div>

          <!-- Right: Summary Sidebar -->
          <div class="space-y-5">
            <!-- Case Info Card -->
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div class="bg-slate-50 px-5 py-3 border-b border-slate-200">
                <h4 class="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <mat-icon class="text-base text-slate-400">info</mat-icon>
                  Case Information
                </h4>
              </div>
              <div class="divide-y divide-slate-100">
                <div class="px-5 py-3">
                  <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Case ID</p>
                  <p class="text-sm font-mono text-slate-800 mt-0.5">{{ caseData.id }}</p>
                </div>
                <div class="px-5 py-3">
                  <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Type</p>
                  <p class="text-sm text-slate-800 mt-0.5">{{ caseData.caseType | uppercase }}</p>
                </div>
                <div class="px-5 py-3">
                  <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Current Stage</p>
                  <span class="wf-badge mt-1" [ngClass]="stageBadgeClass(caseData.stage)">
                    {{ caseData.stage | uppercase }}
                  </span>
                </div>
                <div class="px-5 py-3">
                  <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Assigned To</p>
                  <div class="flex items-center gap-2 mt-1">
                    <div class="w-6 h-6 rounded-full bg-[#d0e8f7] text-[#056DAE] flex items-center justify-center text-xs font-bold">
                      {{ (caseData.assignedTo?.name || 'U').charAt(0) }}
                    </div>
                    <span class="text-sm text-slate-800">{{ caseData.assignedTo?.name || 'Unassigned' }}</span>
                  </div>
                </div>
                <div class="px-5 py-3">
                  <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Created</p>
                  <p class="text-sm text-slate-800 mt-0.5">{{ caseData.createdAt | date: 'mediumDate' }}</p>
                </div>
                <div class="px-5 py-3">
                  <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Last Updated</p>
                  <p class="text-sm text-slate-800 mt-0.5">{{ caseData.updatedAt | date: 'mediumDate' }}</p>
                </div>
              </div>
            </div>

            <!-- SLA Card -->
            @if (caseData.sla) {
              <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="bg-slate-50 px-5 py-3 border-b border-slate-200">
                  <h4 class="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <mat-icon class="text-base text-slate-400">timer</mat-icon>
                    SLA Tracking
                  </h4>
                </div>
                <div class="p-5 space-y-4">
                  <div>
                    <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Target Resolution</p>
                    <p class="text-sm text-slate-800 mt-0.5">{{ caseData.sla.targetResolutionDate | date: 'mediumDate' }}</p>
                  </div>
                  <div>
                    <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Days Remaining</p>
                    <div class="flex items-center gap-2 mt-1">
                      <div class="text-2xl font-bold" [ngClass]="slaColor(caseData.sla.daysRemaining ?? 0)">
                        {{ caseData.sla.daysRemaining ?? 0 }}
                      </div>
                      <span class="text-xs text-slate-500">days left</span>
                    </div>
                  </div>
                  @if (caseData.sla.escalated) {
                    <div class="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-xs font-semibold">
                      <mat-icon class="text-base">warning</mat-icon>
                      Escalated (Level {{ caseData.sla.escalationLevel }})
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Quick Actions -->
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div class="bg-slate-50 px-5 py-3 border-b border-slate-200">
                <h4 class="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <mat-icon class="text-base text-slate-400">bolt</mat-icon>
                  Quick Actions
                </h4>
              </div>
              <div class="p-4 space-y-2">
                <button mat-stroked-button class="w-full justify-start">
                  <mat-icon class="text-[#056DAE]">edit</mat-icon>
                  <span class="ml-1">Edit Case</span>
                </button>
                <button mat-stroked-button class="w-full justify-start">
                  <mat-icon class="text-purple-500">swap_horiz</mat-icon>
                  <span class="ml-1">Transition Stage</span>
                </button>
                <button mat-stroked-button class="w-full justify-start">
                  <mat-icon class="text-cyan-500">chat_bubble_outline</mat-icon>
                  <span class="ml-1">Add Comment</span>
                </button>
                <button mat-stroked-button class="w-full justify-start text-red-600">
                  <mat-icon>archive</mat-icon>
                  <span class="ml-1">Close Case</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    } @else {
      <!-- Empty State -->
      <div class="flex flex-col items-center justify-center py-24 animate-fade-in">
        <div class="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <mat-icon class="text-4xl text-slate-300">search_off</mat-icon>
        </div>
        <h2 class="text-lg font-semibold text-slate-700">Case Not Found</h2>
        <p class="text-slate-400 text-sm mt-1">The case you're looking for doesn't exist or has been removed.</p>
        <button mat-raised-button color="primary" routerLink="/cases" class="mt-6">
          <mat-icon>arrow_back</mat-icon>
          Back to Cases
        </button>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }
    .case-detail-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }
  `],
})
export class CaseDetailComponent implements OnInit, OnDestroy {
  case$!: Observable<Case | undefined>;
  detailsForm: FormGroup;
  tasks: Task[] = [];
  private destroy$ = new Subject<void>();

  stages = [
    { name: 'intake', order: 1 },
    { name: 'documents', order: 2 },
    { name: 'underwriting', order: 3 },
    { name: 'approval', order: 4 },
    { name: 'disbursement', order: 5 },
  ];

  constructor(
    private route: ActivatedRoute,
    private store: Store,
    private formBuilder: FormBuilder,
    public wsService: WebSocketService,
  ) {
    this.detailsForm = this.formBuilder.group({
      applicantName: [''],
      loanAmount: [''],
      interestRate: [''],
      loanTerm: [''],
      status: [''],
      priority: [''],
      notes: [''],
    });
  }

  ngOnInit(): void {
    const caseId = this.route.snapshot.paramMap.get('id');

    this.case$ = this.store.select(selectCasesList).pipe(
      map(cases => cases.find(c => c.id === caseId))
    );

    // Subscribe to populate form and tasks
    this.case$.pipe(takeUntil(this.destroy$)).subscribe(selectedCase => {
      if (selectedCase) {
        this.updateForm(selectedCase);
        this.tasks = selectedCase.tasks || [];
      }
    });

    // Connect WebSocket for live collaboration
    if (caseId) {
      this.store.select(selectUser).pipe(takeUntil(this.destroy$)).subscribe(user => {
        if (user) {
          // In production the token comes from the auth store; use user id as placeholder for mock
          this.wsService.connect(caseId, user.id);
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wsService.disconnect();
  }

  updateForm(case_: Case): void {
    this.detailsForm.patchValue({
      applicantName: case_.fields['applicantName'],
      loanAmount: case_.fields['loanAmount'],
      interestRate: case_.fields['interestRate'],
      loanTerm: case_.fields['loanTerm'],
      status: case_.status,
      priority: case_.priority,
      notes: case_.notes || '',
    });
  }

  isStageCompleted(stageHistory: any[], stageName: string): boolean {
    return stageHistory.some(s => s.stage === stageName) || this.stages.findIndex(s => s.name === stageName) < this.stages.length;
  }

  isStageActive(currentStage: string, stageName: string): boolean {
    return currentStage === stageName;
  }

  getProgressPercentage(stageHistory: any[]): number {
    const completedCount = stageHistory.length;
    return (completedCount / this.stages.length) * 100;
  }

  stageCircleClass(stageHistory: any[], stageName: string): string {
    if (this.isStageCompleted(stageHistory, stageName)) {
      return 'bg-emerald-500 text-white shadow-sm shadow-emerald-200';
    }
    if (this.isStageActive(stageName, stageName)) {
      return 'bg-[#056DAE] text-white shadow-sm shadow-[#a1d1ef]';
    }
    return 'bg-slate-100 text-slate-400';
  }

  statusIcon(status: string): string {
    const icons: Record<string, string> = {
      open: 'folder_open',
      in_progress: 'hourglass_empty',
      closed: 'check_circle',
      pending_review: 'pending_actions',
    };
    return icons[status] || 'help';
  }

  statusColor(status: string): string {
    return {
      open: 'text-[#056DAE]',
      in_progress: 'text-purple-600',
      closed: 'text-emerald-600',
      pending_review: 'text-amber-600',
    }[status] || 'text-slate-600';
  }

  statusBg(status: string): string {
    return {
      open: 'bg-[#EAF4FB]',
      in_progress: 'bg-purple-50',
      closed: 'bg-emerald-50',
      pending_review: 'bg-amber-50',
    }[status] || 'bg-slate-50';
  }

  statusBadge(status: string): string {
    return {
      open: 'wf-badge--info',
      in_progress: 'wf-badge--purple',
      closed: 'wf-badge--success',
      pending_review: 'wf-badge--warning',
    }[status] || 'wf-badge--neutral';
  }

  statusDot(status: string): string {
    return {
      open: 'bg-[#056DAE]',
      in_progress: 'bg-purple-500',
      closed: 'bg-emerald-500',
      pending_review: 'bg-amber-500',
    }[status] || 'bg-slate-500';
  }

  stageColor(stage: string): string {
    const colors: Record<string, string> = {
      intake: 'text-[#056DAE]',
      documents: 'text-purple-600',
      underwriting: 'text-amber-600',
      approval: 'text-orange-600',
      disbursement: 'text-emerald-600',
    };
    return colors[stage] || 'text-slate-600';
  }

  stageBadgeClass(stage: string): string {
    const classes: Record<string, string> = {
      intake: 'wf-badge--info',
      documents: 'wf-badge--purple',
      underwriting: 'wf-badge--warning',
      approval: 'wf-badge--danger',
      disbursement: 'wf-badge--success',
    };
    return classes[stage] || 'wf-badge--neutral';
  }

  taskStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: 'schedule',
      in_progress: 'play_circle',
      completed: 'check_circle',
      blocked: 'block',
    };
    return icons[status] || 'circle';
  }

  taskStatusColor(status: string): string {
    return {
      pending: 'text-slate-500',
      in_progress: 'text-[#056DAE]',
      completed: 'text-emerald-600',
      blocked: 'text-red-600',
    }[status] || 'text-slate-500';
  }

  taskStatusBg(status: string): string {
    return {
      pending: 'bg-slate-100',
      in_progress: 'bg-[#EAF4FB]',
      completed: 'bg-emerald-50',
      blocked: 'bg-red-50',
    }[status] || 'bg-slate-100';
  }

  priorityBadgeClass(priority: string): string {
    return {
      critical: 'wf-badge--danger',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-amber-100 text-amber-800',
      low: 'wf-badge--success',
    }[priority] || 'wf-badge--neutral';
  }

  auditLogBorder(action: string): string {
    return {
      create: 'border-[#056DAE]',
      update: 'border-amber-400',
      transition: 'border-purple-400',
      comment: 'border-emerald-400',
    }[action] || 'border-slate-400';
  }

  auditDotColor(action: string): string {
    return {
      create: 'bg-[#056DAE] ring-[#d0e8f7]',
      update: 'bg-amber-400 ring-amber-100',
      transition: 'bg-purple-400 ring-purple-100',
      comment: 'bg-emerald-400 ring-emerald-100',
    }[action] || 'bg-slate-400 ring-slate-100';
  }

  slaColor(daysRemaining: number): string {
    if (daysRemaining < 1) return 'text-red-600';
    if (daysRemaining < 3) return 'text-amber-600';
    return 'text-emerald-600';
  }
}
