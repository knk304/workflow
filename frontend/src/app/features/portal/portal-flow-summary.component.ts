import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DataService } from '@core/services/data.service';
import { FlowDefinition, FlowExecution, FlowNode, FlowField } from '@core/models';

interface AnswerDisplay {
  questionLabel: string;
  fieldLabel: string;
  value: any;
  displayValue: string;
}

@Component({
  selector: 'app-portal-flow-summary',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatProgressBarModule],
  template: `
    <div class="max-w-3xl mx-auto py-4">
      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      } @else if (execution() && flowDef()) {
        <!-- Header -->
        <div class="mb-4">
          <div class="flex items-center gap-2 mb-1">
            <button mat-icon-button class="no-padding !w-8 !h-8" (click)="goToList()">
              <mat-icon class="!text-lg">arrow_back</mat-icon>
            </button>
            <h1 class="text-lg font-bold text-slate-800">{{ flowDef()!.name }} — Summary</h1>
            <mat-chip-set class="ml-2">
              <mat-chip class="!text-xs"
                        [ngClass]="execution()!.status === 'completed' ? '!bg-green-100 !text-green-800' :
                                   execution()!.status === 'abandoned' ? '!bg-red-100 !text-red-800' :
                                   '!bg-yellow-100 !text-yellow-800'">
                {{ execution()!.status }}
              </mat-chip>
            </mat-chip-set>
          </div>
          <p class="text-xs text-slate-500 ml-10">
            Started {{ execution()!.startedAt | date:'medium' }}
            @if (execution()!.completedAt) {
              · Completed {{ execution()!.completedAt | date:'medium' }}
            }
          </p>
        </div>

        <!-- Answers grouped by question -->
        <div class="space-y-3">
          @for (group of groupedAnswers(); track group.nodeId) {
            <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
              <mat-card-content class="pt-3 pb-2">
                <h3 class="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <mat-icon class="!text-base !w-4 !h-4 text-[#056DAE]">help_outline</mat-icon>
                  {{ group.questionLabel }}
                </h3>
                @for (ans of group.answers; track ans.fieldLabel) {
                  <div class="flex items-start gap-3 py-1.5 border-t border-slate-50">
                    <span class="text-xs text-slate-500 w-40 shrink-0 pt-0.5">{{ ans.fieldLabel }}</span>
                    <span class="text-sm text-slate-800 font-medium">{{ ans.displayValue || '—' }}</span>
                  </div>
                }
              </mat-card-content>
            </mat-card>
          }
          @if (groupedAnswers().length === 0) {
            <div class="text-center py-8 text-slate-400">
              <mat-icon class="!text-4xl mb-2">quiz</mat-icon>
              <p class="text-sm">No answers recorded</p>
            </div>
          }
        </div>

        <div class="flex justify-center mt-6">
          <button mat-raised-button (click)="goToList()">
            <mat-icon>list</mat-icon> Back to Flows
          </button>
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
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
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

  goToList(): void {
    this.router.navigate(['/portal/flows']);
  }
}
