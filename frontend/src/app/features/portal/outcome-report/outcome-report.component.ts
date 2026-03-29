import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { Store } from '@ngrx/store';
import { Subject, takeUntil } from 'rxjs';
import { CaseInstance, StageInstance, StepInstance, Comment } from '@core/models';
import { statusLabel } from '@core/utils/status-labels';
import { selectCommentsByCase } from '@state/comments/comments.selectors';
import * as CommentsActions from '@state/comments/comments.actions';
import {
  OutcomeReportLayoutService,
  OutcomeReportLayout,
  SummarySectionConfig,
} from './outcome-report-layout.service';

interface ApprovalRecord {
  stepName: string;
  stageName: string;
  approvedBy: string | null;
  completedAt: string | null;
  status: string;
}

@Component({
  selector: 'app-outcome-report',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <!-- ═══ HERO HEADER ═══ -->
    <div class="summary-hero">
      <!-- Top accent bar -->
      <div class="hero-accent"></div>
      <div class="px-6 pt-5 pb-6">
        <div class="flex items-center gap-4 mb-5">
          <div class="w-12 h-12 rounded-lg bg-[#056dae]/10 border border-[#056dae]/20 flex items-center justify-center">
            <mat-icon class="!text-2xl !w-6 !h-6 text-[#056dae]">task_alt</mat-icon>
          </div>
          <div>
            <h2 class="text-xl font-bold text-slate-900 tracking-tight">{{ layout?.headerTitle || 'Outcome Report' }}</h2>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xs font-medium text-slate-500">{{ c.caseTypeName || c.caseTypeId }}</span>
              <span class="w-1 h-1 rounded-full bg-slate-300"></span>
              <span class="text-xs text-slate-400 font-mono">{{ c.id }}</span>
            </div>
          </div>
        </div>
        <!-- KPI row -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="kpi-card">
            <p class="kpi-label">Status</p>
            <p class="kpi-value">{{ statusLabel(c.status) }}</p>
          </div>
          <div class="kpi-card">
            <p class="kpi-label">Priority</p>
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full" [ngClass]="priorityDot(c.priority)"></span>
              <p class="kpi-value">{{ c.priority | titlecase }}</p>
            </div>
          </div>
          <div class="kpi-card">
            <p class="kpi-label">Created</p>
            <p class="kpi-value">{{ c.createdAt | date:'mediumDate' }}</p>
          </div>
          <div class="kpi-card">
            <p class="kpi-label">Resolved</p>
            <p class="kpi-value">{{ c.resolvedAt ? (c.resolvedAt | date:'mediumDate') : '—' }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ SECTIONS (layout-ordered) ═══ -->
    @for (section of visibleSections; track section.id) {

      <!-- ── OVERVIEW ── -->
      @if (section.id === 'overview') {
        <div class="summary-section">
          <div class="summary-section-header">
            <mat-icon>info_outline</mat-icon>
            <h3>{{ section.label }}</h3>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 p-5">
            <div>
              <p class="field-label">Title</p>
              <p class="field-value">{{ c.title }}</p>
            </div>
            <div>
              <p class="field-label">Owner</p>
              <p class="field-value">{{ c.ownerId || 'Unassigned' }}</p>
            </div>
            @if (c.description) {
              <div class="sm:col-span-2">
                <p class="field-label">Description</p>
                <p class="field-value leading-relaxed">{{ c.description }}</p>
              </div>
            }
            @if (c.teamId) {
              <div>
                <p class="field-label">Team</p>
                <p class="field-value">{{ c.teamId }}</p>
              </div>
            }
            @if (c.slaTargetDate) {
              <div>
                <p class="field-label">SLA Target</p>
                <p class="field-value">{{ c.slaTargetDate | date:'medium' }}</p>
              </div>
            }
            @if (c.resolutionStatus) {
              <div>
                <p class="field-label">Resolution</p>
                <span class="inline-block text-xs font-semibold px-2.5 py-1 rounded bg-[#003B70]/10 text-[#003B70]">{{ c.resolutionStatus }}</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- ── APPROVAL TRAIL ── -->
      @if (section.id === 'approvals' && approvalRecords.length > 0) {
        <div class="summary-section">
          <div class="summary-section-header">
            <mat-icon>verified</mat-icon>
            <h3>{{ section.label }}</h3>
          </div>
          <div class="p-5 space-y-3">
            @for (rec of approvalRecords; track $index) {
              <div class="flex items-start gap-3 p-3.5 rounded-lg border"
                   [ngClass]="rec.status === 'completed' ? 'bg-emerald-50/50 border-emerald-200/60' : 'bg-amber-50/50 border-amber-200/60'">
                <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                     [ngClass]="rec.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'">
                  <mat-icon class="!text-lg">{{ rec.status === 'completed' ? 'check_circle' : 'hourglass_top' }}</mat-icon>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-semibold text-slate-800">{{ rec.stepName }}</p>
                  <p class="text-xs text-slate-500">Stage: {{ rec.stageName }}</p>
                  @if (rec.approvedBy) {
                    <p class="text-xs mt-1 text-[#003B70] font-medium">
                      <mat-icon class="!text-xs !w-3 !h-3 align-middle mr-0.5">person</mat-icon>
                      Approved by <span class="font-bold">{{ rec.approvedBy }}</span>
                    </p>
                  }
                  @if (rec.completedAt) {
                    <p class="text-[10px] text-slate-400 mt-0.5">{{ rec.completedAt | date:'medium' }}</p>
                  }
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-1"
                      [ngClass]="rec.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'">
                  {{ rec.status === 'completed' ? 'APPROVED' : 'PENDING' }}
                </span>
              </div>
            }
          </div>
        </div>
      }

      <!-- ── PARTICIPANTS ── -->
      @if (section.id === 'participants') {
        <div class="summary-section">
          <div class="summary-section-header">
            <mat-icon>group</mat-icon>
            <h3>{{ section.label }}</h3>
          </div>
          <div class="p-5">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              @for (p of participantList; track p.userId) {
                <div class="flex items-center gap-3 p-3.5 bg-slate-50/80 rounded-lg border border-slate-100 hover:border-[#056DAE]/30 transition-colors">
                  <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                       [style.background]="avatarColor(p.userId)"
                       style="color: white">
                    {{ p.userId[0].toUpperCase() }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-slate-800 truncate">{{ p.userId }}</p>
                    <div class="flex flex-wrap gap-1 mt-1">
                      @for (role of p.roles; track role) {
                        <span class="role-badge">{{ role }}</span>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- ── STAGE TIMELINE ── -->
      @if (section.id === 'stages') {
        <div class="summary-section">
          <div class="summary-section-header">
            <mat-icon>timeline</mat-icon>
            <h3>{{ section.label }}</h3>
          </div>
          <div class="p-5">
            <!-- Horizontal stage progress -->
            <div class="flex items-center gap-0 mb-5 overflow-x-auto pb-2">
              @for (stage of c.stages; track stage.stageDefinitionId; let si = $index; let last = $last) {
                <div class="flex items-center shrink-0">
                  <div class="stage-pip"
                       [ngClass]="stage.status === 'completed' ? 'stage-pip-done' : stage.status === 'in_progress' ? 'stage-pip-active' : 'stage-pip-pending'">
                    @if (stage.status === 'completed') {
                      <mat-icon class="!text-sm">check</mat-icon>
                    } @else {
                      {{ si + 1 }}
                    }
                  </div>
                  <span class="text-[10px] font-semibold ml-1.5 mr-1"
                        [ngClass]="stage.status === 'completed' ? 'text-emerald-600' : stage.status === 'in_progress' ? 'text-[#003B70]' : 'text-slate-400'">{{ stage.name }}</span>
                </div>
                @if (!last) {
                  <div class="w-8 h-0.5 mx-1 shrink-0"
                       [ngClass]="stage.status === 'completed' ? 'bg-emerald-400' : 'bg-slate-200'"></div>
                }
              }
            </div>
            <!-- Detail cards -->
            <div class="space-y-3">
              @for (stage of c.stages; track stage.stageDefinitionId; let si = $index) {
                <div class="border rounded-lg overflow-hidden"
                     [ngClass]="stage.status === 'completed' ? 'border-emerald-200' : 'border-slate-200'">
                  <div class="flex items-center gap-3 px-4 py-3"
                       [ngClass]="stage.status === 'completed' ? 'bg-emerald-50/60' : 'bg-white'">
                    <span class="w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center"
                          [ngClass]="stage.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'">
                      @if (stage.status === 'completed') {
                        <mat-icon class="!text-sm">check</mat-icon>
                      } @else {
                        {{ si + 1 }}
                      }
                    </span>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-slate-800">{{ stage.name }}</p>
                      <div class="flex items-center gap-3 text-[10px] text-slate-500 mt-0.5">
                        @if (stage.enteredAt) {
                          <span>Started: {{ stage.enteredAt | date:'short' }}</span>
                        }
                        @if (stage.completedAt) {
                          <span>Completed: {{ stage.completedAt | date:'short' }}</span>
                        }
                        @if (stage.completedBy) {
                          <span class="font-medium text-[#003B70]">By: {{ stage.completedBy }}</span>
                        }
                      </div>
                    </div>
                    <span class="text-[10px] px-2 py-0.5 rounded font-bold"
                          [ngClass]="stageStatusBadge(stage.status)">{{ stage.status | titlecase }}</span>
                  </div>
                  <div class="divide-y divide-slate-100">
                    @for (proc of stage.processes || []; track proc.processDefinitionId) {
                      @for (step of proc.steps || []; track step.stepDefinitionId) {
                        <div class="flex items-center gap-3 px-4 py-2.5 pl-14 text-sm">
                          <mat-icon class="!text-base" [ngClass]="stepIconClass(step)">{{ stepIcon(step) }}</mat-icon>
                          <div class="flex-1 min-w-0">
                            <span class="text-slate-700 font-medium">{{ step.name }}</span>
                            <span class="text-[10px] text-slate-400 ml-1.5">({{ step.type }})</span>
                          </div>
                          <div class="text-[10px] text-slate-500 text-right shrink-0">
                            @if (step.completedBy) {
                              <span class="font-medium text-[#003B70]">{{ step.completedBy }}</span>
                            }
                            @if (step.completedAt) {
                              <span class="ml-1">{{ step.completedAt | date:'short' }}</span>
                            }
                          </div>
                        </div>
                      }
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- ── CASE DATA ── -->
      @if (section.id === 'data' && dataKeys.length > 0) {
        <div class="summary-section">
          <div class="summary-section-header">
            <mat-icon>description</mat-icon>
            <h3>{{ section.label }}</h3>
          </div>
          <div class="p-5">
            @if (highlightedData.length > 0) {
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
                @for (item of highlightedData; track item.key) {
                  <div class="p-3.5 rounded-lg border border-[#056DAE]/15 bg-[#056DAE]/[0.03]">
                    <p class="text-[10px] text-[#056DAE] font-semibold uppercase tracking-wider">{{ item.key }}</p>
                    <p class="text-sm font-semibold text-slate-800 mt-1">{{ item.value }}</p>
                  </div>
                }
              </div>
            }
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-0">
              @for (item of regularData; track item.key) {
                <div class="flex justify-between py-2.5 border-b border-slate-100 last:border-b-0">
                  <span class="text-xs text-slate-500">{{ item.key }}</span>
                  <span class="text-xs font-medium text-slate-800 truncate ml-3 max-w-[200px]">{{ item.value }}</span>
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- ── COMMENTS HISTORY ── -->
      @if (section.id === 'comments') {
        <div class="summary-section">
          <div class="summary-section-header">
            <mat-icon>chat_bubble_outline</mat-icon>
            <h3>{{ section.label }}</h3>
            @if (comments.length > 0) {
              <span class="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#003B70]/10 text-[#003B70]">{{ comments.length }}</span>
            }
          </div>
          @if (comments.length > 0) {
            <div class="p-5 space-y-4">
              @for (comment of comments; track comment.id) {
                <div class="flex gap-3">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                       [style.background]="avatarColor(comment.userName || comment.userId || '?')"
                       style="color: white">
                    {{ (comment.userName || comment.userId || '?')[0].toUpperCase() }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-2">
                      <span class="text-sm font-semibold text-slate-800">{{ comment.userName || comment.userId }}</span>
                      <span class="text-[10px] text-slate-400">{{ comment.createdAt | date:'medium' }}</span>
                    </div>
                    <p class="text-sm text-slate-600 mt-1 whitespace-pre-wrap leading-relaxed">{{ comment.text }}</p>
                  </div>
                </div>
              }
            </div>
          } @else {
            <div class="p-5 flex items-center gap-3 text-slate-400">
              <mat-icon class="!text-lg">chat_bubble_outline</mat-icon>
              <span class="text-sm">No comments were recorded for this case.</span>
            </div>
          }
        </div>
      }
    }

    <!-- Footer -->
    <div class="text-center py-3">
      <p class="text-[10px] text-slate-300 tracking-wide">Outcome Report &bull; {{ c.caseTypeName || c.caseTypeId }}</p>
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* ── Hero ── */
    .summary-hero {
      background: #ffffff;
      border-radius: 10px;
      margin-bottom: 16px;
      color: #0f172a;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    }
    .hero-accent {
      height: 5px;
      background: #056dae;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .kpi-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
      color: #94a3b8;
      margin-bottom: 2px;
    }
    .kpi-value {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin: 0;
    }

    /* ── Section cards ── */
    .summary-section {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      margin-bottom: 14px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .summary-section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 13px 20px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      border-left: 3px solid #003B70;
    }
    .summary-section-header mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #003B70;
    }
    .summary-section-header h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    /* ── Fields ── */
    .field-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #94a3b8;
      margin-bottom: 3px;
    }
    .field-value {
      font-size: 13px;
      font-weight: 500;
      color: #1e293b;
    }

    /* ── Stage progress pips ── */
    .stage-pip {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .stage-pip-done {
      background: #059669;
      color: white;
    }
    .stage-pip-active {
      background: #003B70;
      color: white;
      box-shadow: 0 0 0 3px rgba(0,59,112,0.2);
    }
    .stage-pip-pending {
      background: #e2e8f0;
      color: #94a3b8;
    }

    /* ── Role badges ── */
    .role-badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 1px 6px;
      border-radius: 4px;
      background: #003B70;
      color: white;
    }
  `],
})
export class OutcomeReportComponent implements OnInit, OnDestroy {
  @Input() c!: CaseInstance;

  visibleSections: SummarySectionConfig[] = [];
  layout: OutcomeReportLayout | null = null;
  comments: Comment[] = [];
  approvalRecords: ApprovalRecord[] = [];
  participantList: { userId: string; roles: string[] }[] = [];
  dataKeys: string[] = [];
  highlightedData: { key: string; value: any }[] = [];
  regularData: { key: string; value: any }[] = [];

  statusLabel = statusLabel;

  private destroy$ = new Subject<void>();

  constructor(
    private store: Store,
    private layoutService: OutcomeReportLayoutService,
  ) {}

  ngOnInit(): void {
    const layout = this.layoutService.getLayout(this.c.caseTypeId);
    this.layout = layout;
    this.visibleSections = this.layoutService.getVisibleSections(this.c.caseTypeId);

    // Dispatch load so the store is populated regardless of sidebar state
    this.store.dispatch(CommentsActions.loadComments({ caseId: this.c.id }));

    this.store.select(selectCommentsByCase(this.c.id))
      .pipe(takeUntil(this.destroy$))
      .subscribe(comments => this.comments = comments);

    this.approvalRecords = this.extractApprovals();
    this.participantList = this.extractParticipants();
    this.processDataFields(layout);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Data extraction helpers ──────────────────────────────────

  private extractApprovals(): ApprovalRecord[] {
    const records: ApprovalRecord[] = [];
    for (const stage of this.c.stages) {
      for (const proc of stage.processes || []) {
        for (const step of proc.steps || []) {
          if (step.type === 'approval') {
            records.push({
              stepName: step.name,
              stageName: stage.name,
              approvedBy: step.completedBy || null,
              completedAt: step.completedAt || null,
              status: step.status,
            });
          }
        }
      }
    }
    return records;
  }

  private extractParticipants(): { userId: string; roles: string[] }[] {
    const map = new Map<string, Set<string>>();

    const addUser = (userId: string | null | undefined, role: string) => {
      if (!userId) return;
      if (!map.has(userId)) map.set(userId, new Set());
      map.get(userId)!.add(role);
    };

    addUser(this.c.ownerId, 'Owner');
    addUser(this.c.createdBy, 'Creator');

    for (const stage of this.c.stages) {
      addUser(stage.completedBy, 'Stage Completer');
      for (const proc of stage.processes || []) {
        for (const step of proc.steps || []) {
          addUser(step.assignedTo, 'Assignee');
          addUser(step.completedBy, step.type === 'approval' ? 'Approver' : 'Completer');
        }
      }
    }

    return Array.from(map.entries()).map(([userId, roles]) => ({
      userId,
      roles: Array.from(roles),
    }));
  }

  private processDataFields(layout: OutcomeReportLayout): void {
    if (!this.c.data) return;
    const hideSet = new Set(layout.hideFields || []);
    const highlightSet = new Set(layout.highlightFields || []);

    this.dataKeys = Object.keys(this.c.data).filter(k => !hideSet.has(k));
    this.highlightedData = this.dataKeys
      .filter(k => highlightSet.has(k))
      .map(k => ({ key: k, value: this.c.data[k] }));
    this.regularData = this.dataKeys
      .filter(k => !highlightSet.has(k))
      .map(k => ({ key: k, value: this.c.data[k] }));
  }

  // ── Template helpers ─────────────────────────────────────────

  stageStatusBadge(status: string): string {
    return {
      completed: 'bg-emerald-100 text-emerald-700',
      in_progress: 'bg-[#003B70]/10 text-[#003B70]',
      pending: 'bg-slate-100 text-slate-500',
      skipped: 'bg-slate-100 text-slate-400',
    }[status] || 'bg-slate-100 text-slate-500';
  }

  stepIcon(step: StepInstance): string {
    if (step.status === 'completed') return 'check_circle';
    if (step.status === 'skipped') return 'skip_next';
    if (step.status === 'cancelled') return 'cancel';
    return 'radio_button_unchecked';
  }

  stepIconClass(step: StepInstance): string {
    if (step.status === 'completed') return 'text-emerald-500';
    if (step.status === 'skipped') return 'text-slate-400';
    if (step.status === 'cancelled') return 'text-red-400';
    return 'text-slate-300';
  }

  priorityDot(priority: string): string {
    return {
      critical: 'bg-[#E31837]',
      high: 'bg-orange-400',
      medium: 'bg-amber-400',
      low: 'bg-emerald-400',
    }[priority] || 'bg-slate-400';
  }

  avatarColor(name: string): string {
    // Deterministic color from a Citi-friendly palette
    const palette = ['#003B70', '#056DAE', '#0891b2', '#4f46e5', '#7c3aed', '#0d9488'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
  }
}
