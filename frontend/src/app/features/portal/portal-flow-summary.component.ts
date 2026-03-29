import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DataService } from '@core/services/data.service';
import { FlowDefinition, FlowExecution, FlowNode, FlowField } from '@core/models';

interface AnswerDisplay {
  questionLabel: string;
  fieldLabel: string;
  fieldType: string;
  value: any;
  displayValue: string;
}

@Component({
  selector: 'app-portal-flow-summary',
  standalone: true,
  imports: [
    CommonModule, MatCardModule, MatButtonModule, MatIconModule,
    MatChipsModule, MatProgressBarModule, MatDividerModule, MatTooltipModule,
  ],
  template: `
    <div class="max-w-4xl mx-auto py-4">
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" class="rounded-full"></mat-progress-bar>
      } @else if (execution() && flowDef()) {
        <!-- Hero Header -->
        <div class="bg-gradient-to-r from-[#056DAE] to-[#0891b2] rounded-2xl p-6 mb-6 text-white shadow-lg relative overflow-hidden">
          <div class="absolute inset-0 opacity-10">
            <div class="absolute -right-10 -top-10 w-40 h-40 rounded-full border-[20px] border-white/30"></div>
            <div class="absolute -left-5 -bottom-5 w-24 h-24 rounded-full border-[12px] border-white/20"></div>
          </div>
          <div class="relative">
            <div class="flex items-center gap-2 mb-4">
              <button mat-icon-button class="!w-8 !h-8 !bg-white/10 hover:!bg-white/20" (click)="goToList()">
                <mat-icon class="!text-lg text-white">arrow_back</mat-icon>
              </button>
              <span class="text-xs text-white/60 font-mono">{{ execution()!.id | slice:0:8 }}...</span>
            </div>
            <h1 class="text-2xl font-bold mb-1">{{ flowDef()!.name }}</h1>
            @if (flowDef()!.description) {
              <p class="text-sm text-white/80 mb-4">{{ flowDef()!.description }}</p>
            }
            <div class="flex flex-wrap items-center gap-3">
              <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                    [ngClass]="execution()!.status === 'completed' ? 'bg-green-400/20 text-green-100' :
                               execution()!.status === 'abandoned' ? 'bg-red-400/20 text-red-100' :
                               'bg-yellow-400/20 text-yellow-100'">
                <mat-icon class="!text-sm !w-4 !h-4">
                  {{ execution()!.status === 'completed' ? 'check_circle' : execution()!.status === 'abandoned' ? 'cancel' : 'hourglass_empty' }}
                </mat-icon>
                {{ statusLabel(execution()!.status) }}
              </span>
              @if (flowDef()!.category) {
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-xs text-white/90">
                  <mat-icon class="!text-xs !w-3 !h-3">category</mat-icon>
                  {{ flowDef()!.category }}
                </span>
              }
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-xs text-white/90">
                <mat-icon class="!text-xs !w-3 !h-3">layers</mat-icon>
                v{{ flowDef()!.version }}
              </span>
            </div>
          </div>
        </div>

        <!-- Info Cards Row -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
            <mat-card-content class="!py-3.5 !px-4">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <mat-icon class="!text-lg text-blue-600">schedule</mat-icon>
                </div>
                <div>
                  <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Started</p>
                  <p class="text-xs font-semibold text-slate-700 mt-0.5">{{ execution()!.startedAt | date:'MMM d, y' }}</p>
                  <p class="text-[10px] text-slate-400">{{ execution()!.startedAt | date:'h:mm a' }}</p>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
            <mat-card-content class="!py-3.5 !px-4">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center"
                     [ngClass]="execution()!.completedAt ? 'bg-green-50' : 'bg-slate-50'">
                  <mat-icon class="!text-lg" [ngClass]="execution()!.completedAt ? 'text-green-600' : 'text-slate-400'">
                    {{ execution()!.completedAt ? 'event_available' : 'pending' }}
                  </mat-icon>
                </div>
                <div>
                  <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Completed</p>
                  @if (execution()!.completedAt) {
                    <p class="text-xs font-semibold text-slate-700 mt-0.5">{{ execution()!.completedAt | date:'MMM d, y' }}</p>
                    <p class="text-[10px] text-slate-400">{{ execution()!.completedAt | date:'h:mm a' }}</p>
                  } @else {
                    <p class="text-xs font-medium text-slate-400 mt-0.5">Pending</p>
                  }
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
            <mat-card-content class="!py-3.5 !px-4">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
                  <mat-icon class="!text-lg text-purple-600">route</mat-icon>
                </div>
                <div>
                  <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Steps Visited</p>
                  <p class="text-xs font-semibold text-slate-700 mt-0.5">{{ execution()!.visitedNodes.length }} steps</p>
                  <p class="text-[10px] text-slate-400">of {{ flowDef()!.definition.nodes.length }} total</p>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
            <mat-card-content class="!py-3.5 !px-4">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <mat-icon class="!text-lg text-amber-600">quiz</mat-icon>
                </div>
                <div>
                  <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Answers</p>
                  <p class="text-xs font-semibold text-slate-700 mt-0.5">{{ execution()!.answers.length }} responses</p>
                  <p class="text-[10px] text-slate-400">{{ groupedAnswers().length }} sections</p>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        @if (duration()) {
          <mat-card class="!rounded-xl !shadow-sm border border-slate-100 mb-6">
            <mat-card-content class="!py-3 !px-5">
              <div class="flex items-center gap-3">
                <mat-icon class="text-slate-400 !text-lg">timer</mat-icon>
                <span class="text-sm text-slate-600">Total duration: <strong class="text-slate-800">{{ duration() }}</strong></span>
              </div>
            </mat-card-content>
          </mat-card>
        }

        <!-- Flow Path / Timeline -->
        <mat-card class="!rounded-xl !shadow-sm border border-slate-100 mb-6">
          <mat-card-content class="!py-4 !px-5">
            <h3 class="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <mat-icon class="!text-base !w-4 !h-4 text-[#056DAE]">timeline</mat-icon>
              Flow Path
            </h3>
            <div class="flex items-center gap-1.5 flex-wrap">
              @for (nid of execution()!.visitedNodes; track nid; let i = $index; let isLast = $last) {
                @if (getNodeById(nid); as vNode) {
                  <div class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                       [ngClass]="nodeTypeClass(vNode.type)">
                    <mat-icon class="!text-[11px] !w-3 !h-3">{{ nodeTypeIcon(vNode.type) }}</mat-icon>
                    {{ vNode.label }}
                  </div>
                  @if (!isLast) {
                    <mat-icon class="!text-xs !w-3 !h-3 text-slate-300">chevron_right</mat-icon>
                  }
                }
              }
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Answers Section -->
        <div class="mb-4">
          <h2 class="text-base font-bold text-slate-800 flex items-center gap-2 mb-4">
            <mat-icon class="!text-lg text-[#056DAE]">fact_check</mat-icon>
            Submitted Responses
          </h2>
        </div>

        <div class="space-y-4">
          @for (group of groupedAnswers(); track group.nodeId; let gi = $index) {
            <mat-card class="!rounded-2xl !shadow-sm border border-slate-100 overflow-hidden">
              <!-- Group Header -->
              <div class="bg-slate-50 px-5 py-3 border-b border-slate-100">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-[#056DAE] flex items-center justify-center">
                    <span class="text-xs font-bold text-white">{{ gi + 1 }}</span>
                  </div>
                  <div>
                    <h3 class="text-sm font-semibold text-slate-800">{{ group.questionLabel }}</h3>
                    <p class="text-[10px] text-slate-400">{{ group.answers.length }} field(s)</p>
                  </div>
                </div>
              </div>

              <!-- Answers -->
              <mat-card-content class="!p-0">
                <div class="divide-y divide-slate-50">
                  @for (ans of group.answers; track ans.fieldLabel) {
                    <div class="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors">
                      <div class="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                           [ngClass]="fieldTypeIconBg(ans.fieldType)">
                        <mat-icon class="!text-xs !w-3 !h-3" [ngClass]="fieldTypeIconColor(ans.fieldType)">
                          {{ fieldTypeIcon(ans.fieldType) }}
                        </mat-icon>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium mb-0.5">{{ ans.fieldLabel }}</p>
                        <p class="text-sm text-slate-800 font-medium break-words">{{ ans.displayValue || '—' }}</p>
                      </div>
                    </div>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          }

          @if (groupedAnswers().length === 0) {
            <div class="text-center py-16 text-slate-400">
              <div class="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <mat-icon class="!text-4xl !w-10 !h-10 text-slate-300">quiz</mat-icon>
              </div>
              <p class="text-base font-medium text-slate-500 mb-1">No answers recorded</p>
              <p class="text-sm text-slate-400">This flow has no submitted responses yet</p>
            </div>
          }
        </div>

        <!-- Footer Actions -->
        <div class="flex items-center justify-between mt-8 pt-4 border-t border-slate-200">
          <button mat-button class="!text-slate-500" (click)="goToList()">
            <mat-icon>arrow_back</mat-icon> Back to All Requests
          </button>
          @if (execution()!.status === 'in_progress') {
            <button mat-raised-button color="primary" (click)="continueFlow()">
              <mat-icon>play_arrow</mat-icon> Continue Flow
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class PortalFlowSummaryComponent implements OnInit {
  loading = signal(true);
  execution = signal<FlowExecution | null>(null);
  flowDef = signal<FlowDefinition | null>(null);
  groupedAnswers = signal<{ nodeId: string; questionLabel: string; answers: AnswerDisplay[] }[]>([]);
  duration = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dataService: DataService,
  ) {}

  ngOnInit(): void {
    const execId = this.route.snapshot.paramMap.get('execId');
    if (!execId) { this.loading.set(false); return; }

    this.dataService.getFlowExecutionById(execId).subscribe({
      next: exec => {
        this.execution.set(exec);
        this.dataService.getFlowDefinitionById(exec.flowDefinitionId).subscribe({
          next: def => {
            this.flowDef.set(def);
            this.buildGroupedAnswers(exec, def);
            this.computeDuration(exec);
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  private computeDuration(exec: FlowExecution): void {
    if (!exec.startedAt) return;
    const end = exec.completedAt ? new Date(exec.completedAt) : new Date();
    const start = new Date(exec.startedAt);
    const diffMs = end.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) {
      this.duration.set(`${days}d ${hours % 24}h ${minutes % 60}m`);
    } else if (hours > 0) {
      this.duration.set(`${hours}h ${minutes % 60}m`);
    } else {
      this.duration.set(`${minutes}m`);
    }
  }

  private buildGroupedAnswers(exec: FlowExecution, def: FlowDefinition): void {
    const nodeMap = new Map<string, FlowNode>();
    for (const n of def.definition.nodes) {
      nodeMap.set(n.id, n);
    }

    const groups = new Map<string, { questionLabel: string; answers: AnswerDisplay[] }>();

    for (const a of exec.answers) {
      const node = nodeMap.get(a.nodeId);
      if (!node) continue;

      if (!groups.has(a.nodeId)) {
        groups.set(a.nodeId, { questionLabel: node.label, answers: [] });
      }

      const field = node.fields.find(f => f.id === a.fieldId);
      let displayValue = String(a.value ?? '');

      // If field has options, map value to label
      if (field?.options?.length) {
        if (Array.isArray(a.value)) {
          displayValue = a.value
            .map(v => field.options.find(o => o.value === v)?.label || v)
            .join(', ');
        } else {
          const opt = field.options.find(o => o.value === String(a.value));
          if (opt) displayValue = opt.label;
        }
      }

      groups.get(a.nodeId)!.answers.push({
        questionLabel: node.label,
        fieldLabel: field?.label || a.fieldId,
        fieldType: field?.type || 'text',
        value: a.value,
        displayValue,
      });
    }

    // Order groups by visited nodes order
    const ordered: { nodeId: string; questionLabel: string; answers: AnswerDisplay[] }[] = [];
    for (const nid of exec.visitedNodes) {
      if (groups.has(nid)) {
        ordered.push({ nodeId: nid, ...groups.get(nid)! });
      }
    }
    this.groupedAnswers.set(ordered);
  }

  getNodeById(id: string): FlowNode | undefined {
    return this.flowDef()?.definition.nodes.find(n => n.id === id);
  }

  statusLabel(status: string): string {
    return { in_progress: 'In Progress', completed: 'Completed', abandoned: 'Abandoned' }[status] || status;
  }

  nodeTypeIcon(type: string): string {
    return {
      start: 'play_circle', end: 'stop_circle', question: 'edit_note', decision: 'call_split',
      display: 'info', subprocess: 'mediation', task: 'assignment', parallel: 'fork_right',
      approval: 'verified', notification: 'notifications', timer: 'schedule', api_call: 'cloud',
    }[type] || 'circle';
  }

  nodeTypeClass(type: string): string {
    return {
      start: 'bg-slate-100 text-slate-600',
      end: 'bg-green-50 text-green-700',
      question: 'bg-blue-50 text-blue-700',
      decision: 'bg-indigo-50 text-indigo-700',
      display: 'bg-cyan-50 text-cyan-700',
      task: 'bg-amber-50 text-amber-700',
      approval: 'bg-emerald-50 text-emerald-700',
      notification: 'bg-orange-50 text-orange-700',
      timer: 'bg-cyan-50 text-cyan-700',
      api_call: 'bg-teal-50 text-teal-700',
      parallel: 'bg-purple-50 text-purple-700',
      subprocess: 'bg-violet-50 text-violet-700',
    }[type] || 'bg-slate-100 text-slate-600';
  }

  fieldTypeIcon(type: string): string {
    return {
      text: 'short_text', textarea: 'notes', number: 'pin', date: 'event',
      select: 'list', radio: 'radio_button_checked', checkbox: 'check_box',
      multi_select: 'checklist', file: 'attach_file', alert: 'info',
    }[type] || 'edit';
  }

  fieldTypeIconBg(type: string): string {
    return {
      text: 'bg-blue-50', textarea: 'bg-indigo-50', number: 'bg-green-50', date: 'bg-amber-50',
      select: 'bg-purple-50', radio: 'bg-cyan-50', checkbox: 'bg-emerald-50',
      multi_select: 'bg-violet-50', file: 'bg-slate-100', alert: 'bg-orange-50',
    }[type] || 'bg-slate-50';
  }

  fieldTypeIconColor(type: string): string {
    return {
      text: 'text-blue-500', textarea: 'text-indigo-500', number: 'text-green-500', date: 'text-amber-500',
      select: 'text-purple-500', radio: 'text-cyan-500', checkbox: 'text-emerald-500',
      multi_select: 'text-violet-500', file: 'text-slate-500', alert: 'text-orange-500',
    }[type] || 'text-slate-400';
  }

  goToList(): void {
    this.router.navigate(['/portal/flows']);
  }

  continueFlow(): void {
    const exec = this.execution();
    if (exec) {
      this.router.navigate(['/portal/flows', exec.id, 'run']);
    }
  }
}
