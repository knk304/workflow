import { Component, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FlowFormRenderComponent, FieldAnswerChange } from './shared/flow-form-render.component';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { DataService } from '@core/services/data.service';
import { selectUserRole } from '@state/auth/auth.selectors';
import {
  FlowDefinition, FlowExecution, FlowNode, FlowField,
  FlowAnswer, FlowNodeType, FormDefinition, FormField,
} from '@core/models';

@Component({
  selector: 'app-portal-flow-runner',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatRadioModule, MatCheckboxModule, MatProgressBarModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatTooltipModule,
    FlowFormRenderComponent,
  ],
  template: `
    @if (loading()) {
      <div class="flex flex-col items-center justify-center h-64 gap-3">
        <mat-progress-bar mode="indeterminate" class="w-64 rounded-full"></mat-progress-bar>
        <p class="text-sm text-slate-400">Loading flow...</p>
      </div>
    } @else if (execution() && flowDef()) {

      <!-- â”€â”€ Top Header Bar â”€â”€ -->
      <div class="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30 -mx-5 px-5">
        <div class="max-w-6xl mx-auto flex items-center gap-3 h-14">
          <button mat-icon-button class="!w-8 !h-8 shrink-0" (click)="goToList()"
                  matTooltip="Back to All Requests">
            <mat-icon class="!text-lg text-slate-500">arrow_back</mat-icon>
          </button>
          <div class="w-px h-5 bg-slate-200 shrink-0"></div>
          <div class="flex items-center gap-2.5 flex-1 min-w-0">
            <div class="w-8 h-8 rounded-lg bg-[#EAF4FB] flex items-center justify-center shrink-0">
              <mat-icon class="!text-base text-[#056DAE]">account_tree</mat-icon>
            </div>
            <div class="min-w-0">
              <p class="text-sm font-bold text-slate-800 truncate">{{ flowDef()!.name }}</p>
              <p class="text-[10px] text-slate-400 leading-none">
                @if (execution()!.requestNumber) {
                  <span class="font-mono font-semibold text-[#056DAE]">{{ execution()!.requestNumber }}</span>
                }
                @if (flowDef()!.category) {
                  @if (execution()!.requestNumber) { <span class="mx-1">Â·</span> }
                  {{ flowDef()!.category }}
                }
              </p>
            </div>
          </div>
          <!-- Progress pill -->
          <div class="hidden sm:flex items-center gap-2 shrink-0">
            <div class="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full bg-[#056DAE] rounded-full transition-all duration-500"
                   [style.width]="progressPercent() + '%'"></div>
            </div>
            <span class="text-xs font-semibold text-[#056DAE]">{{ progressPercent() }}%</span>
          </div>
        </div>
      </div>

      <!-- â”€â”€ Main 2-column Layout â”€â”€ -->
      <div class="max-w-6xl mx-auto flex gap-6 pt-5">

        <!-- â”€â”€ LEFT: Step Tracker Sidebar â”€â”€ -->
        <aside class="hidden lg:block w-56 shrink-0">
          <div class="sticky top-20">
            <p class="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-3 pl-1">Steps</p>
            <div class="relative">
              <!-- vertical line -->
              <div class="absolute left-3.5 top-4 bottom-4 w-0.5 bg-slate-100"></div>
              <div class="space-y-1">
                @for (nid of visibleStepNodes(); track nid; let si = $index) {
                  @if (getNodeById(nid); as sNode) {
                    <div class="flex items-center gap-2.5 relative rounded-lg px-2 py-1.5 transition-all"
                         [ngClass]="nid === execution()!.currentNodeId
                           ? 'bg-[#EAF4FB]'
                           : isNodeVisited(nid) ? 'bg-transparent' : 'bg-transparent'">
                      <!-- dot -->
                      <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 relative z-10 transition-all"
                           [ngClass]="nid === execution()!.currentNodeId
                             ? 'bg-[#056DAE] shadow-md'
                             : isNodeVisited(nid) ? 'bg-green-500' : 'bg-slate-200'">
                        @if (isNodeVisited(nid) && nid !== execution()!.currentNodeId) {
                          <mat-icon class="!text-[11px] !w-3 !h-3 text-white">check</mat-icon>
                        } @else if (nid === execution()!.currentNodeId) {
                          <mat-icon class="!text-[11px] !w-3 !h-3 text-white">edit</mat-icon>
                        } @else {
                          <span class="text-[9px] font-bold text-slate-400">{{ si + 1 }}</span>
                        }
                      </div>
                      <!-- label -->
                      <div class="min-w-0 flex-1">
                        <p class="text-xs truncate leading-tight"
                           [ngClass]="nid === execution()!.currentNodeId
                             ? 'font-semibold text-[#056DAE]'
                             : isNodeVisited(nid) ? 'text-green-700 font-medium' : 'text-slate-400'">
                          {{ sNode.label }}
                        </p>
                        <p class="text-[9px] uppercase tracking-wide"
                           [ngClass]="nid === execution()!.currentNodeId ? 'text-[#056DAE]' : 'text-slate-300'">
                          {{ sNode.type }}
                        </p>
                      </div>
                    </div>
                  }
                }
              </div>
            </div>
          </div>
        </aside>

        <!-- â”€â”€ RIGHT: Main Content â”€â”€ -->
        <main class="flex-1 min-w-0 pb-28">

          @if (currentNode(); as node) {

            <!-- â•â•â• COMPLETED STATE â•â•â• -->
            @if (execution()!.status === 'completed') {
              <div class="flex flex-col items-center justify-center py-16 text-center">
                <div class="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4 shadow-inner">
                  <mat-icon class="!text-4xl !w-10 !h-10 text-green-600">check_circle</mat-icon>
                </div>
                <h2 class="text-2xl font-bold text-slate-800 mb-2">All Done!</h2>
                <p class="text-sm text-slate-500 max-w-sm mb-6">Your request has been submitted successfully. You can view the full summary of your answers.</p>
                <div class="flex gap-3">
                  <button mat-stroked-button (click)="goBack()" [disabled]="!canGoBack()">
                    <mat-icon>arrow_back</mat-icon> Go Back
                  </button>
                  <button mat-stroked-button (click)="goToList()">
                    <mat-icon>list</mat-icon> All Requests
                  </button>
                  <button mat-raised-button color="primary" (click)="viewSummary()">
                    <mat-icon>summarize</mat-icon> View Summary
                  </button>
                </div>
              </div>

            <!-- ═══ FORM NODE ═══ -->
            } @else if (node.type === 'form') {
              <!-- Section identifier row -->
              <div class="flex items-center gap-2 mb-3">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Section {{ currentSectionIndex() }} of {{ totalSections() }}
                </span>
                <div class="flex-1 h-px bg-slate-100"></div>
                @if (getEffectiveFieldCount(node) > 0) {
                  <span class="text-[10px] text-slate-400">{{ getEffectiveAnsweredCount(node) }}/{{ getEffectiveFieldCount(node) }} answered</span>
                }
              </div>

              <!-- Section card -->
              <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">

                <!-- Section Header -->
                <div class="flex items-start gap-4 px-6 pt-5 pb-4 border-b border-slate-100">
                  <div class="w-10 h-10 rounded-xl bg-[#056DAE] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    <span class="text-sm font-bold text-white">{{ currentSectionIndex() }}</span>
                  </div>
                  <div class="flex-1 min-w-0">
                    <h2 class="text-lg font-bold text-slate-800 leading-tight">{{ node.label }}</h2>
                    @if (node.content) {
                      <p class="text-sm text-slate-500 mt-1 leading-relaxed">{{ node.content }}</p>
                    }
                  </div>
                </div>

                <!-- Form fields rendered by FlowFormRenderComponent -->
                <app-flow-form-render
                  [node]="node"
                  [linkedFormDef]="linkedFormDef()"
                  [linkedFormLoading]="linkedFormLoading()"
                  [answers]="localAnswers()"
                  (answerChange)="onFieldAnswer(node.id, $event)">
                </app-flow-form-render>

              </div>

            <!-- â•â•â• DISPLAY NODE â•â•â• -->
            } @else if (node.type === 'display') {
              <div class="bg-blue-50 border-l-4 border-blue-400 rounded-r-2xl rounded-bl-2xl p-5 flex items-start gap-4">
                <div class="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <mat-icon class="text-blue-600">info</mat-icon>
                </div>
                <div>
                  <h2 class="text-base font-bold text-blue-800 mb-1">{{ node.label }}</h2>
                  <p class="text-sm text-blue-700 leading-relaxed whitespace-pre-wrap">{{ node.content }}</p>
                </div>
              </div>

            <!-- â•â•â• TASK NODE â•â•â• -->
            } @else if (node.type === 'task') {
              <div class="bg-white border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
                <div class="bg-amber-50 border-b border-amber-100 px-5 py-3 flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <mat-icon class="text-amber-600 !text-lg">assignment</mat-icon>
                  </div>
                  <div>
                    <p class="text-xs text-amber-500 uppercase tracking-wider font-semibold">Task</p>
                    <h2 class="text-sm font-bold text-amber-800">{{ node.label }}</h2>
                  </div>
                </div>
                <div class="px-5 py-4">
                  @if (node.content) {
                    <p class="text-sm text-slate-600 leading-relaxed mb-3">{{ node.content }}</p>
                  }
                  @if (node.config?.['assigneeRole']) {
                    <div class="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                      <mat-icon class="!text-sm !w-4 !h-4">person</mat-icon>
                      Assigned to: <span class="font-semibold">{{ node.config!['assigneeRole'] }}</span>
                    </div>
                  }
                  <p class="text-xs text-slate-400 mt-3">Complete this task and click Next to proceed.</p>
                </div>
              </div>

            <!-- â•â•â• APPROVAL NODE â•â•â• -->
            } @else if (node.type === 'approval') {
              <div class="bg-white border border-emerald-200 rounded-2xl shadow-sm overflow-hidden">
                <div class="bg-emerald-50 border-b border-emerald-100 px-5 py-3 flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <mat-icon class="text-emerald-600 !text-lg">verified</mat-icon>
                  </div>
                  <div>
                    <p class="text-xs text-emerald-500 uppercase tracking-wider font-semibold">Approval Required</p>
                    <h2 class="text-sm font-bold text-emerald-800">{{ node.label }}</h2>
                  </div>
                </div>
                <div class="px-5 py-4">
                  @if (node.content) {
                    <p class="text-sm text-slate-600 leading-relaxed mb-3">{{ node.content }}</p>
                  }
                  @if (node.config?.['assigneeRole']) {
                    <div class="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                      <mat-icon class="!text-sm !w-4 !h-4">person</mat-icon>
                      Approver: <span class="font-semibold">{{ node.config!['assigneeRole'] }}</span>
                    </div>
                  }

                  <!-- Summary of answers so far -->
                  @if (execution()!.answers.length) {
                    <div class="mt-4 border rounded-xl overflow-hidden">
                      <div class="bg-slate-50 px-4 py-2 border-b">
                        <span class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Submitted Data</span>
                      </div>
                      <div class="divide-y">
                        @for (ans of execution()!.answers; track ans.fieldId) {
                          @if (getFieldLabel(ans.nodeId, ans.fieldId); as label) {
                            <div class="flex justify-between px-4 py-2 text-xs">
                              <span class="text-slate-500">{{ label }}</span>
                              <span class="font-medium text-slate-800">{{ ans.value }}</span>
                            </div>
                          }
                        }
                      </div>
                    </div>
                  }

                  <!-- Approve / Reject buttons (role-gated) -->
                  @if (userRole() === node.config?.['assigneeRole'] || userRole() === 'ADMIN') {
                    <div class="flex items-center gap-3 mt-5">
                      <button mat-raised-button color="primary"
                              class="!h-10 !text-sm !font-semibold !px-6 !rounded-xl flex-1"
                              (click)="approveNode()">
                        <mat-icon class="mr-1">check_circle</mat-icon> Approve
                      </button>
                      <button mat-stroked-button color="warn"
                              class="!h-10 !text-sm !font-semibold !px-6 !rounded-xl flex-1"
                              (click)="rejectNode()">
                        <mat-icon class="mr-1">cancel</mat-icon> Reject
                      </button>
                    </div>
                  } @else {
                    <div class="mt-5 text-center py-4 bg-slate-50 rounded-xl border border-slate-200">
                      <mat-icon class="text-slate-400 !text-2xl">hourglass_empty</mat-icon>
                      <p class="text-sm text-slate-500 mt-1">Pending approval from <span class="font-semibold">{{ node.config?.['assigneeRole'] || 'assigned approver' }}</span></p>
                    </div>
                  }
                </div>
              </div>

            <!-- â•â•â• NOTIFICATION NODE â•â•â• -->
            } @else if (node.type === 'notification') {
              <div class="bg-orange-50 border-l-4 border-orange-400 rounded-r-2xl rounded-bl-2xl p-5 flex items-start gap-4">
                <div class="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <mat-icon class="text-orange-600">notifications</mat-icon>
                </div>
                <div>
                  <h2 class="text-base font-bold text-orange-800 mb-1">{{ node.label }}</h2>
                  @if (node.content) {
                    <p class="text-sm text-orange-700 leading-relaxed mb-2">{{ node.content }}</p>
                  }
                  <p class="text-xs text-orange-400">A notification will be sent. Click Next to continue.</p>
                </div>
              </div>

            <!-- â•â•â• TIMER NODE â•â•â• -->
            } @else if (node.type === 'timer') {
              <div class="bg-cyan-50 border-l-4 border-cyan-400 rounded-r-2xl rounded-bl-2xl p-5 flex items-start gap-4">
                <div class="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center shrink-0">
                  <mat-icon class="text-cyan-600">schedule</mat-icon>
                </div>
                <div>
                  <h2 class="text-base font-bold text-cyan-800 mb-1">{{ node.label }}</h2>
                  @if (node.config?.['durationMinutes']) {
                    <p class="text-sm text-cyan-700">Wait period: <span class="font-semibold">{{ node.config!['durationMinutes'] }} minutes</span></p>
                  }
                  <p class="text-xs text-cyan-400 mt-2">Click Next to continue after the wait period.</p>
                </div>
              </div>

            <!-- â•â•â• API CALL NODE â•â•â• -->
            } @else if (node.type === 'api_call') {
              <div class="bg-white border border-teal-200 rounded-2xl shadow-sm overflow-hidden">
                <div class="bg-teal-50 border-b border-teal-100 px-5 py-3 flex items-center gap-3">
                  <div class="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                    <mat-icon class="text-teal-600 !text-lg">cloud</mat-icon>
                  </div>
                  <div>
                    <p class="text-xs text-teal-500 uppercase tracking-wider font-semibold">API Integration</p>
                    <h2 class="text-sm font-bold text-teal-800">{{ node.label }}</h2>
                  </div>
                </div>
                <div class="px-5 py-4">
                  @if (node.config?.['apiMethod'] && node.config?.['apiUrl']) {
                    <div class="flex items-center gap-2 mb-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <span class="px-2 py-0.5 rounded bg-teal-600 text-white font-mono font-bold text-[10px]">{{ node.config!['apiMethod'] }}</span>
                      <span class="font-mono text-xs text-slate-600 truncate">{{ node.config!['apiUrl'] }}</span>
                    </div>
                  }
                  @if (apiCallLoading()) {
                    <div class="flex items-center gap-3 p-3 rounded-lg bg-teal-50 border border-teal-200">
                      <mat-spinner diameter="18"></mat-spinner>
                      <span class="text-sm text-teal-800 font-medium">Executing API callâ€¦</span>
                    </div>
                  } @else if (apiCallError()) {
                    <div class="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                      <mat-icon class="!text-lg text-red-500">error</mat-icon>
                      <span>{{ apiCallError() }}</span>
                    </div>
                  } @else if (apiCallDone()) {
                    <div class="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
                      <mat-icon class="!text-lg text-green-500">check_circle</mat-icon>
                      <span>API call completed successfully</span>
                    </div>
                  }
                </div>
              </div>

            <!-- â•â•â• PARALLEL / END â•â•â• -->
            } @else if (node.type === 'parallel') {
              <div class="bg-purple-50 border-l-4 border-purple-400 rounded-r-2xl rounded-bl-2xl p-5 flex items-center gap-4">
                <mat-icon class="text-purple-600">fork_right</mat-icon>
                <div>
                  <h2 class="text-base font-bold text-purple-800">{{ node.label }}</h2>
                  <p class="text-sm text-purple-600 mt-0.5">Parallel gateway â€” click Next to continue.</p>
                </div>
              </div>
            } @else if (node.type === 'end') {
              <div class="flex flex-col items-center justify-center py-12 text-center">
                <mat-icon class="!text-5xl text-green-500 mb-3">check_circle</mat-icon>
                <h2 class="text-xl font-bold text-slate-800">Flow Complete</h2>
              </div>
            }

            <!-- â”€â”€ Sticky Bottom Navigation â”€â”€ -->
            @if (execution()!.status !== 'completed' && currentNode()?.type !== 'approval') {
              <div class="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
                <div class="max-w-6xl mx-auto flex items-center justify-between px-5 h-16">
                  <!-- Left: back + step info -->
                  <div class="flex items-center gap-3">
                    <button mat-stroked-button class="!h-9 !text-xs"
                            (click)="goBack()" [disabled]="!canGoBack()">
                      <mat-icon>arrow_back</mat-icon> Back
                    </button>
                    <span class="text-xs text-slate-400 hidden sm:block">
                      Step {{ currentStepNumber() }} of {{ totalSteps() }}
                    </span>
                  </div>
                  <!-- Center: mini progress bar (mobile) -->
                  <div class="flex-1 mx-6 hidden md:block">
                    <div class="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div class="h-full bg-[#056DAE] rounded-full transition-all duration-500"
                           [style.width]="progressPercent() + '%'"></div>
                    </div>
                  </div>
                  <!-- Right: next/submit -->
                  @if (isLastQuestionNode()) {
                    <button mat-raised-button color="primary"
                            class="!h-9 !text-sm !font-semibold !px-6 !rounded-xl"
                            (click)="submitAndAdvance()" [disabled]="!canAdvance()">
                      Submit <mat-icon iconPositionEnd>send</mat-icon>
                    </button>
                  } @else {
                    <button mat-raised-button color="primary"
                            class="!h-9 !text-sm !font-semibold !px-6 !rounded-xl"
                            (click)="submitAndAdvance()" [disabled]="!canAdvance()">
                      Next <mat-icon iconPositionEnd>arrow_forward</mat-icon>
                    </button>
                  }
                </div>
              </div>
            }

          }
        </main>
      </div>

    } @else {
      <div class="flex flex-col items-center justify-center py-16 text-slate-400">
        <mat-icon class="!text-5xl !w-12 !h-12 mb-3 text-slate-300">error_outline</mat-icon>
        <p class="text-sm">Flow not found</p>
        <button mat-button class="mt-3 text-[#056DAE]" (click)="goToList()">Back to All Requests</button>
      </div>
    }
  `,
  styles: [],
})
export class PortalFlowRunnerComponent implements OnInit {
  loading = signal(true);
  execution = signal<FlowExecution | null>(null);
  flowDef = signal<FlowDefinition | null>(null);
  localAnswers = signal<Map<string, any>>(new Map());
  apiCallLoading = signal(false);
  apiCallDone = signal(false);
  apiCallError = signal<string | null>(null);
  userRole = signal<string | undefined>(undefined);
  private _lastAutoAdvancedDecision: string | null = null;
  linkedFormDef = signal<FormDefinition | null>(null);
  linkedFormLoading = signal(false);
  private _lastLoadedFormId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dataService: DataService,
    private snackBar: MatSnackBar,
    private store: Store,
  ) {
    this.store.select(selectUserRole).subscribe(r => this.userRole.set(r));
    // Whenever the current node changes to a linked form node, load the form def
    effect(() => {
      const node = this.currentNode();
      if (node?.type === 'form' && node.config?.['formSource'] === 'linked') {
        const formId = node.config['formId'] as string | undefined;
        if (formId && formId !== this._lastLoadedFormId) {
          this._lastLoadedFormId = formId;
          this.linkedFormLoading.set(true);
          this.linkedFormDef.set(null);
          this.dataService.getFormDefinitionById(formId).subscribe({
            next: def => { this.linkedFormDef.set(def); this.linkedFormLoading.set(false); },
            error: () => this.linkedFormLoading.set(false),
          });
        }
      } else {
        this._lastLoadedFormId = null;
        this.linkedFormDef.set(null);
      }
    });
  }

  ngOnInit(): void {
    const execId = this.route.snapshot.paramMap.get('execId');
    if (!execId) { this.loading.set(false); return; }

    this.dataService.getFlowExecutionById(execId).subscribe({
      next: exec => {
        this.execution.set(exec);
        // Load flow definition
        this.dataService.getFlowDefinitionById(exec.flowDefinitionId).subscribe({
          next: def => {
            this.flowDef.set(def);
            // Populate local answers from execution
            const map = new Map<string, any>();
            for (const a of exec.answers) {
              map.set(`${a.nodeId}::${a.fieldId}`, a.value);
            }
            this.localAnswers.set(map);
            this.loading.set(false);
            this._autoExecuteIfApiCall();
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => this.loading.set(false),
    });
  }

  currentNode(): FlowNode | undefined {
    const exec = this.execution();
    const def = this.flowDef();
    if (!exec || !def) return undefined;
    return def.definition.nodes.find(n => n.id === exec.currentNodeId);
  }

  getNodeById(id: string): FlowNode | undefined {
    return this.flowDef()?.definition.nodes.find(n => n.id === id);
  }

  progressPercent(): number {
    const exec = this.execution();
    const def = this.flowDef();
    if (!exec || !def) return 0;
    const total = def.definition.nodes.filter(n => n.type !== 'start' && n.type !== 'decision').length;
    const visited = exec.visitedNodes.filter(id => {
      const n = def.definition.nodes.find(nd => nd.id === id);
      return n && n.type !== 'start' && n.type !== 'decision';
    }).length;
    return total > 0 ? Math.round((visited / total) * 100) : 0;
  }

  getAnswer(nodeId: string, fieldId: string): any {
    return this.localAnswers().get(`${nodeId}::${fieldId}`);
  }

  setAnswer(nodeId: string, fieldId: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.localAnswers.update(map => {
      const newMap = new Map(map);
      newMap.set(`${nodeId}::${fieldId}`, value);
      return newMap;
    });
  }

  setAnswerDirect(nodeId: string, fieldId: string, value: any): void {
    this.localAnswers.update(map => {
      const newMap = new Map(map);
      newMap.set(`${nodeId}::${fieldId}`, value);
      return newMap;
    });
  }

  /** Called by FlowFormRenderComponent (answerChange) output. */
  onFieldAnswer(nodeId: string, change: FieldAnswerChange): void {
    this.setAnswerDirect(nodeId, change.fieldId, change.value);
  }

  canGoBack(): boolean {
    const exec = this.execution();
    if (!exec) return false;
    return exec.visitedNodes.length > 2; // start + first node
  }

  canAdvance(): boolean {
    const node = this.currentNode();
    if (!node) return false;
    // These node types need no form input â€” always allow advance
    if (node.type === 'display' || node.type === 'task' || node.type === 'parallel'
        || node.type === 'approval' || node.type === 'notification' || node.type === 'timer'
        || node.type === 'api_call') return true;
    if (node.type === 'form') {
      if (node.config?.['formSource'] === 'linked') {
        for (const field of this.getLinkedFormFields()) {
          if (field.validation?.required) {
            const val = this.getAnswer(node.id, field.id);
            if (val === undefined || val === null || val === '') return false;
          }
        }
        return true;
      }
      // Custom fields mode
      for (const field of node.fields) {
        if (field.validation?.required) {
          const val = this.getAnswer(node.id, field.id);
          if (val === undefined || val === null || val === '') return false;
        }
      }
      return true;
    }
    return true;
  }

  isLastQuestionNode(): boolean {
    const node = this.currentNode();
    const def = this.flowDef();
    if (!node || !def) return false;
    // Check if next connected node is end
    const edges = def.definition.edges.filter(e => e.source === node.id);
    if (edges.length === 1) {
      const target = def.definition.nodes.find(n => n.id === edges[0].target);
      if (target?.type === 'end') return true;
      // Also check if target is a decision that leads to end
      if (target?.type === 'decision') {
        const decisionEdges = def.definition.edges.filter(e => e.source === target.id);
        return decisionEdges.every(de => {
          const t = def.definition.nodes.find(n => n.id === de.target);
          return t?.type === 'end';
        });
      }
    }
    return false;
  }

  submitAndAdvance(): void {
    const exec = this.execution();
    const node = this.currentNode();
    if (!exec || !node) return;

    // Collect answers for current node
    const answers: FlowAnswer[] = [];
    if (node.type === 'form') {
      const fieldsToCollect = node.config?.['formSource'] === 'linked'
        ? this.getLinkedFormFields().map(f => f.id)
        : node.fields.map(f => f.id);
      for (const fieldId of fieldsToCollect) {
        const val = this.getAnswer(node.id, fieldId);
        if (val !== undefined && val !== null) {
          answers.push({ nodeId: node.id, fieldId, value: val });
        }
      }
    }

    // Show loading for api_call nodes
    const isApiCall = node.type === 'api_call';
    if (isApiCall) {
      this.apiCallLoading.set(true);
      this.apiCallError.set(null);
      this.apiCallDone.set(false);
    }

    this.dataService.submitFlowAnswer(exec.id, answers, exec.currentNodeId).subscribe({
      next: updated => {
        if (isApiCall) {
          this.apiCallLoading.set(false);
          this.apiCallDone.set(true);
        }
        this.execution.set(updated);
        // Rebuild local answers from server state (handles pruning on path change)
        const newMap = new Map<string, unknown>();
        for (const a of updated.answers) {
          newMap.set(`${a.nodeId}::${a.fieldId}`, a.value);
        }
        this.localAnswers.set(newMap);
        if (updated.status === 'completed') {
          this.snackBar.open('Flow completed successfully!', 'OK', { duration: 3000 });
        } else {
          this._autoExecuteIfApiCall();
        }
      },
      error: err => {
        if (isApiCall) {
          this.apiCallLoading.set(false);
          this.apiCallError.set(err.error?.detail || 'API call failed');
        }
        this.snackBar.open(err.error?.detail || 'Failed to advance', 'OK', { duration: 3000 });
      },
    });
  }

  /** If the current node is an api_call or decision (shouldn't be shown), auto-trigger advance. */
  private _autoExecuteIfApiCall(): void {
    const node = this.currentNode();
    if (!node) return;
    // Decision nodes should never be displayed â€” auto-advance through them
    // But guard against infinite loops: if we've already tried this decision, stop
    if (node.type === 'decision') {
      const exec = this.execution();
      const lastNodeId = this._lastAutoAdvancedDecision;
      if (lastNodeId === node.id) {
        // Already tried this decision and it came back to itself â€” stop looping
        this._lastAutoAdvancedDecision = null;
        this.snackBar.open('Decision node has no matching condition or default route. Please check the flow design.', 'OK', { duration: 5000 });
        return;
      }
      this._lastAutoAdvancedDecision = node.id;
      setTimeout(() => this.submitAndAdvance(), 100);
      return;
    }
    this._lastAutoAdvancedDecision = null;
    if (node.type !== 'api_call') return;
    // Reset state and auto-fire
    this.apiCallLoading.set(true);
    this.apiCallDone.set(false);
    this.apiCallError.set(null);
    // Small delay so the user sees the loading card render first
    setTimeout(() => this.submitAndAdvance(), 400);
  }

  goBack(): void {
    const exec = this.execution();
    if (!exec) return;
    this.dataService.goBackFlowExecution(exec.id).subscribe(updated => {
      this.execution.set(updated);
      // Sync local answers from server state (answers are preserved on back)
      const newMap = new Map<string, unknown>();
      for (const a of updated.answers) {
        newMap.set(`${a.nodeId}::${a.fieldId}`, a.value);
      }
      this.localAnswers.set(newMap);
    });
  }

  approveNode(): void {
    const exec = this.execution();
    const node = this.currentNode();
    if (!exec || !node) return;
    const answers: FlowAnswer[] = [{
      nodeId: node.id, fieldId: '__approval__', value: 'approved',
    }];
    this.dataService.submitFlowAnswer(exec.id, answers, exec.currentNodeId).subscribe({
      next: updated => {
        this.execution.set(updated);
        const newMap = new Map<string, unknown>();
        for (const a of updated.answers) {
          newMap.set(`${a.nodeId}::${a.fieldId}`, a.value);
        }
        this.localAnswers.set(newMap);
        if (updated.status === 'completed') {
          this.snackBar.open('Flow completed!', 'OK', { duration: 3000 });
        } else {
          this._autoExecuteIfApiCall();
        }
      },
      error: () => this.snackBar.open('Failed to approve', 'OK', { duration: 3000 }),
    });
  }

  rejectNode(): void {
    const exec = this.execution();
    const node = this.currentNode();
    if (!exec || !node) return;
    const answers: FlowAnswer[] = [{
      nodeId: node.id, fieldId: '__approval__', value: 'rejected',
    }];
    this.dataService.submitFlowAnswer(exec.id, answers, exec.currentNodeId).subscribe({
      next: updated => {
        this.execution.set(updated);
        const newMap = new Map<string, unknown>();
        for (const a of updated.answers) {
          newMap.set(`${a.nodeId}::${a.fieldId}`, a.value);
        }
        this.localAnswers.set(newMap);
        this.snackBar.open('Approval rejected. Flow has been sent back.', 'OK', { duration: 3000 });
      },
      error: () => this.snackBar.open('Failed to reject', 'OK', { duration: 3000 }),
    });
  }

  /** Get a human-readable label for a field by node+field ID */
  getFieldLabel(nodeId: string, fieldId: string): string | null {
    if (fieldId.startsWith('__')) return null; // skip internal fields
    const def = this.flowDef();
    if (!def) return null;
    const node = def.definition.nodes.find(n => n.id === nodeId);
    if (!node) return null;
    const field = node.fields.find(f => f.id === fieldId);
    return field?.label || null;
  }

  goToList(): void {
    this.router.navigate(['/portal/flows']);
  }

  viewSummary(): void {
    const exec = this.execution();
    if (exec) {
      this.router.navigate(['/portal/flows', exec.id, 'summary']);
    }
  }

  hasFieldAnswer(nodeId: string, fieldId: string): boolean {
    const val = this.getAnswer(nodeId, fieldId);
    return val !== undefined && val !== null && val !== '';
  }

  answeredFieldCount(node: FlowNode): number {
    return node.fields.filter(f => this.hasFieldAnswer(node.id, f.id)).length;
  }

  /** Returns sorted FormField list from the linked form def (flattened across sections). */
  getLinkedFormFields(): FormField[] {
    const def = this.linkedFormDef();
    if (!def) return [];
    // Sort sections, then sort fields within each section by order
    const sectionOrder = new Map(def.sections.map(s => [s.id, s.order]));
    return [...def.fields].sort((a, b) => {
      const so = (sectionOrder.get(a.section) ?? 0) - (sectionOrder.get(b.section) ?? 0);
      return so !== 0 ? so : a.order - b.order;
    });
  }

  /** Whether a linked FormField should be visible based on its visibleWhen condition. */
  isLinkedFieldVisible(field: FormField, nodeId: string): boolean {
    if (!field.visibleWhen || Object.keys(field.visibleWhen).length === 0) return true;
    return Object.entries(field.visibleWhen).every(([triggerFieldId, expectedValue]) =>
      this.getAnswer(nodeId, triggerFieldId) === expectedValue
    );
  }

  /** Total effective field count for progress bar: linked form fields OR node.fields. */
  getEffectiveFieldCount(node: FlowNode): number {
    if (node.config?.['formSource'] === 'linked') {
      return this.getLinkedFormFields().length;
    }
    return node.fields.length;
  }

  /** Answered count for progress bar, respecting linked vs custom mode. */
  getEffectiveAnsweredCount(node: FlowNode): number {
    if (node.config?.['formSource'] === 'linked') {
      return this.getLinkedFormFields().filter(f => this.hasFieldAnswer(node.id, f.id)).length;
    }
    return node.fields.filter(f => this.hasFieldAnswer(node.id, f.id)).length;
  }

  /** Walk the edge graph from the start node to get nodes in execution order */
  private _graphOrderedNodes(): FlowNode[] {
    const def = this.flowDef();
    const exec = this.execution();
    if (!def) return [];
    const { nodes, edges } = def.definition;
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const skipTypes = new Set(['start', 'decision']);

    const ordered: FlowNode[] = [];
    const seen = new Set<string>();

    // 1. Add visited nodes in their actual execution order
    if (exec) {
      for (const nid of exec.visitedNodes) {
        const node = nodeMap.get(nid);
        if (node && !seen.has(nid)) {
          ordered.push(node);
          seen.add(nid);
        }
      }
    }

    // 2. BFS forward from current node for unvisited nodes
    const edgeMap = new Map<string, string[]>();
    for (const e of edges) {
      const targets = edgeMap.get(e.source) || [];
      targets.push(e.target);
      edgeMap.set(e.source, targets);
    }
    const startId = exec?.currentNodeId || nodes.find(n => n.type === 'start')?.id;
    if (startId) {
      const queue = [startId];
      const bfsVisited = new Set(seen);
      while (queue.length) {
        const id = queue.shift()!;
        for (const target of edgeMap.get(id) || []) {
          if (!bfsVisited.has(target)) {
            bfsVisited.add(target);
            const node = nodeMap.get(target);
            if (node && !seen.has(target)) {
              ordered.push(node);
              seen.add(target);
            }
            queue.push(target);
          }
        }
      }
    }

    // 3. Append any remaining unconnected nodes
    for (const n of nodes) {
      if (!seen.has(n.id)) {
        ordered.push(n);
        seen.add(n.id);
      }
    }
    return ordered;
  }

  /** Nodes to show in the left step tracker (exclude start/decision) */
  visibleStepNodes(): string[] {
    return this._graphOrderedNodes()
      .filter(n => n.type !== 'start' && n.type !== 'decision')
      .map(n => n.id);
  }

  isNodeVisited(nodeId: string): boolean {
    return this.execution()?.visitedNodes.includes(nodeId) ?? false;
  }

  /** Which section index is the current form node (1-based, counting only form nodes) */
  currentSectionIndex(): number {
    const exec = this.execution();
    if (!exec) return 1;
    const questionNodes = this._graphOrderedNodes().filter(n => n.type === 'form');
    const idx = questionNodes.findIndex(n => n.id === exec.currentNodeId);
    return idx >= 0 ? idx + 1 : 1;
  }

  totalSections(): number {
    return this._graphOrderedNodes().filter(n => n.type === 'form').length || 1;
  }

  currentStepNumber(): number {
    const exec = this.execution();
    if (!exec) return 1;
    const steps = this._graphOrderedNodes().filter(n => n.type !== 'start' && n.type !== 'decision');
    const idx = steps.findIndex(n => n.id === exec.currentNodeId);
    return idx >= 0 ? idx + 1 : 1;
  }

  totalSteps(): number {
    return this._graphOrderedNodes().filter(n => n.type !== 'start' && n.type !== 'decision').length || 1;
  }
}
