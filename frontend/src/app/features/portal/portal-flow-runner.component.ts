import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
import { MatStepperModule } from '@angular/material/stepper';
import { DataService } from '@core/services/data.service';
import {
  FlowDefinition, FlowExecution, FlowNode, FlowField,
  FlowAnswer, FlowNodeType,
} from '@core/models';

@Component({
  selector: 'app-portal-flow-runner',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatRadioModule, MatCheckboxModule, MatProgressBarModule,
    MatProgressSpinnerModule, MatSnackBarModule, MatStepperModule,
  ],
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
            <h1 class="text-lg font-bold text-slate-800">{{ flowDef()!.name }}</h1>
          </div>
          @if (flowDef()!.description) {
            <p class="text-xs text-slate-500 ml-10">{{ flowDef()!.description }}</p>
          }
        </div>

        <!-- Progress -->
        <div class="mb-4 px-2">
          <div class="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Progress</span>
            <span>{{ progressPercent() }}%</span>
          </div>
          <mat-progress-bar mode="determinate" [value]="progressPercent()"></mat-progress-bar>
          <!-- Visited nodes breadcrumb -->
          <div class="flex items-center gap-1 mt-2 flex-wrap">
            @for (nid of execution()!.visitedNodes; track nid; let i = $index) {
              @if (getNodeById(nid); as vNode) {
                @if (vNode.type !== 'start' && vNode.type !== 'decision') {
                  <span class="text-[10px] px-1.5 py-0.5 rounded"
                        [ngClass]="nid === execution()!.currentNodeId ? 'bg-[#056DAE] text-white' : 'bg-slate-100 text-slate-500'">
                    {{ vNode.label }}
                  </span>
                  @if (i < execution()!.visitedNodes.length - 1) {
                    <mat-icon class="!text-[10px] !w-3 !h-3 text-slate-300">chevron_right</mat-icon>
                  }
                }
              }
            }
          </div>
        </div>

        <!-- Current Node Content -->
        @if (currentNode(); as node) {
          @if (execution()!.status === 'completed') {
            <!-- Completed state -->
            <mat-card class="!rounded-xl !shadow-sm border border-green-200 bg-green-50">
              <mat-card-content class="pt-6 pb-4 text-center">
                <div class="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <mat-icon class="!text-4xl !w-10 !h-10 text-green-600">check_circle</mat-icon>
                </div>
                <h2 class="text-lg font-bold text-green-800 mb-1">Flow Completed</h2>
                <p class="text-sm text-green-600 mb-4">Thank you for completing this flow.</p>
                <div class="flex justify-center gap-3">
                  <button mat-raised-button (click)="goToList()">
                    <mat-icon>list</mat-icon> Back to Flows
                  </button>
                  <button mat-raised-button color="primary" (click)="viewSummary()">
                    <mat-icon>summarize</mat-icon> View Summary
                  </button>
                </div>
              </mat-card-content>
            </mat-card>
          } @else if (node.type === 'question') {
            <!-- Question Node -->
            <mat-card class="!rounded-xl !shadow-sm border border-slate-100">
              <mat-card-content class="pt-4">
                <h2 class="text-base font-semibold text-slate-800 mb-3">{{ node.label }}</h2>
                @if (node.content) {
                  <p class="text-xs text-slate-500 mb-4">{{ node.content }}</p>
                }
                <div class="space-y-3">
                  @for (field of node.fields; track field.id) {
                    <div>
                      @switch (field.type) {
                        @case ('text') {
                          <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                            <mat-label>{{ field.label }}</mat-label>
                            <input matInput
                                   [placeholder]="field.placeholder || ''"
                                   [value]="getAnswer(node.id, field.id) ?? field.defaultValue ?? ''"
                                   (input)="setAnswer(node.id, field.id, $event)">
                            @if (field.helpText) {
                              <mat-hint>{{ field.helpText }}</mat-hint>
                            }
                          </mat-form-field>
                        }
                        @case ('textarea') {
                          <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                            <mat-label>{{ field.label }}</mat-label>
                            <textarea matInput rows="3"
                                      [placeholder]="field.placeholder || ''"
                                      [value]="getAnswer(node.id, field.id) ?? field.defaultValue ?? ''"
                                      (input)="setAnswer(node.id, field.id, $event)"></textarea>
                            @if (field.helpText) {
                              <mat-hint>{{ field.helpText }}</mat-hint>
                            }
                          </mat-form-field>
                        }
                        @case ('number') {
                          <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                            <mat-label>{{ field.label }}</mat-label>
                            <input matInput type="number"
                                   [placeholder]="field.placeholder || ''"
                                   [value]="getAnswer(node.id, field.id) ?? field.defaultValue ?? ''"
                                   (input)="setAnswer(node.id, field.id, $event)">
                            @if (field.helpText) {
                              <mat-hint>{{ field.helpText }}</mat-hint>
                            }
                          </mat-form-field>
                        }
                        @case ('date') {
                          <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                            <mat-label>{{ field.label }}</mat-label>
                            <input matInput type="date"
                                   [value]="getAnswer(node.id, field.id) ?? field.defaultValue ?? ''"
                                   (input)="setAnswer(node.id, field.id, $event)">
                            @if (field.helpText) {
                              <mat-hint>{{ field.helpText }}</mat-hint>
                            }
                          </mat-form-field>
                        }
                        @case ('select') {
                          <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                            <mat-label>{{ field.label }}</mat-label>
                            <mat-select [value]="getAnswer(node.id, field.id) ?? field.defaultValue ?? ''"
                                        (selectionChange)="setAnswerDirect(node.id, field.id, $event.value)">
                              @for (opt of field.options; track opt.value) {
                                <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
                              }
                            </mat-select>
                            @if (field.helpText) {
                              <mat-hint>{{ field.helpText }}</mat-hint>
                            }
                          </mat-form-field>
                        }
                        @case ('radio') {
                          <div class="mb-2">
                            <label class="text-xs font-medium text-slate-700 mb-1 block">{{ field.label }}</label>
                            @if (field.helpText) {
                              <p class="text-[10px] text-slate-400 mb-1">{{ field.helpText }}</p>
                            }
                            <div class="space-y-1">
                              @for (opt of field.options; track opt.value) {
                                <label class="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm"
                                       [class.border-[#056DAE]]="getAnswer(node.id, field.id) === opt.value"
                                       [class.bg-[#EAF4FB]]="getAnswer(node.id, field.id) === opt.value"
                                       [class.border-slate-200]="getAnswer(node.id, field.id) !== opt.value"
                                       (click)="setAnswerDirect(node.id, field.id, opt.value)">
                                  <div class="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                                       [class.border-[#056DAE]]="getAnswer(node.id, field.id) === opt.value"
                                       [class.border-slate-300]="getAnswer(node.id, field.id) !== opt.value">
                                    @if (getAnswer(node.id, field.id) === opt.value) {
                                      <div class="w-2 h-2 rounded-full bg-[#056DAE]"></div>
                                    }
                                  </div>
                                  {{ opt.label }}
                                </label>
                              }
                            </div>
                          </div>
                        }
                        @case ('checkbox') {
                          <div class="mb-2">
                            <label class="flex items-center gap-2 text-sm cursor-pointer">
                              <input type="checkbox"
                                     [checked]="getAnswer(node.id, field.id) === true || getAnswer(node.id, field.id) === 'true'"
                                     (change)="setAnswerDirect(node.id, field.id, $any($event.target).checked)"
                                     class="w-4 h-4 rounded border-slate-300">
                              {{ field.label }}
                            </label>
                            @if (field.helpText) {
                              <p class="text-[10px] text-slate-400 ml-6">{{ field.helpText }}</p>
                            }
                          </div>
                        }
                        @case ('multi_select') {
                          <div class="mb-2">
                            <label class="text-xs font-medium text-slate-700 mb-1 block">{{ field.label }}</label>
                            @if (field.helpText) {
                              <p class="text-[10px] text-slate-400 mb-1">{{ field.helpText }}</p>
                            }
                            <div class="space-y-1">
                              @for (opt of field.options; track opt.value) {
                                <label class="flex items-center gap-2 px-3 py-1.5 rounded border cursor-pointer text-sm"
                                       [class.border-[#056DAE]]="isMultiSelected(node.id, field.id, opt.value)"
                                       [class.bg-[#EAF4FB]]="isMultiSelected(node.id, field.id, opt.value)"
                                       [class.border-slate-200]="!isMultiSelected(node.id, field.id, opt.value)">
                                  <input type="checkbox"
                                         [checked]="isMultiSelected(node.id, field.id, opt.value)"
                                         (change)="toggleMultiSelect(node.id, field.id, opt.value)"
                                         class="w-3.5 h-3.5">
                                  {{ opt.label }}
                                </label>
                              }
                            </div>
                          </div>
                        }
                        @default {
                          @if (field.type === 'alert') {
                            <div class=\"rounded-lg border px-4 py-3 text-sm flex items-start gap-3 mb-2\"\n                                 [ngClass]=\"alertBoxClass(field.placeholder || 'info')\">\n                              <mat-icon class=\"!text-lg !w-5 !h-5 shrink-0 mt-0.5\"\n                                        [ngClass]=\"alertIconClass(field.placeholder || 'info')\">\n                                {{ alertIcon(field.placeholder || 'info') }}\n                              </mat-icon>\n                              <div>\n                                <div class=\"font-semibold text-sm mb-0.5\">{{ field.label }}</div>\n                                <div class=\"text-xs opacity-90\">{{ field.defaultValue || '' }}</div>\n                              </div>\n                            </div>
                          } @else {
                            <mat-form-field class=\"w-full dense-field\" subscriptSizing=\"dynamic\">
                              <mat-label>{{ field.label }}</mat-label>
                              <input matInput [value]=\"getAnswer(node.id, field.id) ?? ''\" (input)=\"setAnswer(node.id, field.id, $event)\">
                            </mat-form-field>
                          }
                        }
                      }
                    </div>
                  }
                </div>
              </mat-card-content>
            </mat-card>
          } @else if (node.type === 'display') {
            <!-- Display Node (info/instructions) -->
            <mat-card class="!rounded-xl !shadow-sm border border-blue-100 bg-blue-50">
              <mat-card-content class="pt-4">
                <div class="flex items-start gap-3">
                  <mat-icon class="text-blue-600 mt-0.5">info</mat-icon>
                  <div>
                    <h2 class="text-base font-semibold text-blue-800 mb-1">{{ node.label }}</h2>
                    <p class="text-sm text-blue-700 whitespace-pre-wrap">{{ node.content }}</p>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          } @else if (node.type === 'task') {
            <!-- Task Node (process work item) -->
            <mat-card class="!rounded-xl !shadow-sm border border-amber-100 bg-amber-50">
              <mat-card-content class="pt-4">
                <div class="flex items-start gap-3">
                  <mat-icon class="text-amber-600 mt-0.5">assignment</mat-icon>
                  <div class="flex-1">
                    <h2 class="text-base font-semibold text-amber-800 mb-1">{{ node.label }}</h2>
                    @if (node.content) {
                      <p class="text-sm text-amber-700 whitespace-pre-wrap mb-3">{{ node.content }}</p>
                    }
                    @if (node.config?.['assigneeRole']) {
                      <div class="flex items-center gap-1 text-xs text-amber-600">
                        <mat-icon class="!text-xs !w-3.5 !h-3.5">person</mat-icon>
                        Assigned to: <span class="font-medium ml-1">{{ node.config!['assigneeRole'] }}</span>
                      </div>
                    }
                    <p class="text-xs text-amber-500 mt-2">Complete this task and click Next to proceed.</p>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          } @else if (node.type === 'parallel') {
            <!-- Parallel Gateway -->
            <mat-card class="!rounded-xl !shadow-sm border border-purple-100 bg-purple-50">
              <mat-card-content class="pt-4">
                <div class="flex items-start gap-3">
                  <mat-icon class="text-purple-600 mt-0.5">fork_right</mat-icon>
                  <div>
                    <h2 class="text-base font-semibold text-purple-800 mb-1">{{ node.label }}</h2>
                    <p class="text-sm text-purple-700">This is a parallel gateway. Click Next to continue.</p>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          } @else if (node.type === 'approval') {
            <!-- Approval Node -->
            <mat-card class="!rounded-xl !shadow-sm border border-emerald-100 bg-emerald-50">
              <mat-card-content class="pt-4">
                <div class="flex items-start gap-3">
                  <mat-icon class="text-emerald-600 mt-0.5">verified</mat-icon>
                  <div class="flex-1">
                    <h2 class="text-base font-semibold text-emerald-800 mb-1">{{ node.label }}</h2>
                    @if (node.content) {
                      <p class="text-sm text-emerald-700 whitespace-pre-wrap mb-3">{{ node.content }}</p>
                    }
                    @if (node.config?.['assigneeRole']) {
                      <div class="flex items-center gap-1 text-xs text-emerald-600">
                        <mat-icon class="!text-xs !w-3.5 !h-3.5">person</mat-icon>
                        Approver: <span class="font-medium ml-1">{{ node.config!['assigneeRole'] }}</span>
                      </div>
                    }
                    <p class="text-xs text-emerald-500 mt-2">Review and approve to proceed.</p>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          } @else if (node.type === 'notification') {
            <!-- Notification Node -->
            <mat-card class="!rounded-xl !shadow-sm border border-orange-100 bg-orange-50">
              <mat-card-content class="pt-4">
                <div class="flex items-start gap-3">
                  <mat-icon class="text-orange-600 mt-0.5">notifications</mat-icon>
                  <div>
                    <h2 class="text-base font-semibold text-orange-800 mb-1">{{ node.label }}</h2>
                    @if (node.content) {
                      <p class="text-sm text-orange-700 whitespace-pre-wrap">{{ node.content }}</p>
                    }
                    <p class="text-xs text-orange-500 mt-2">A notification will be sent. Click Next to continue.</p>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          } @else if (node.type === 'timer') {
            <!-- Timer Node -->
            <mat-card class="!rounded-xl !shadow-sm border border-cyan-100 bg-cyan-50">
              <mat-card-content class="pt-4">
                <div class="flex items-start gap-3">
                  <mat-icon class="text-cyan-600 mt-0.5">schedule</mat-icon>
                  <div>
                    <h2 class="text-base font-semibold text-cyan-800 mb-1">{{ node.label }}</h2>
                    @if (node.config?.['durationMinutes']) {
                      <p class="text-sm text-cyan-700">Wait: {{ node.config!['durationMinutes'] }} minutes</p>
                    }
                    <p class="text-xs text-cyan-500 mt-2">Click Next to continue after the wait period.</p>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          } @else if (node.type === 'api_call') {
            <!-- External API Call Node -->
            <mat-card class="!rounded-xl !shadow-sm border border-teal-100 bg-teal-50">
              <mat-card-content class="pt-4">
                <div class="flex items-start gap-3">
                  <mat-icon class="text-teal-600 mt-0.5">cloud</mat-icon>
                  <div class="flex-1">
                    <h2 class="text-base font-semibold text-teal-800 mb-1">{{ node.label }}</h2>
                    @if (node.content) {
                      <p class="text-sm text-teal-700 whitespace-pre-wrap mb-3">{{ node.content }}</p>
                    }
                    <!-- API request info -->
                    <div class="rounded border border-teal-200 bg-white p-3 text-xs space-y-2">
                      @if (node.config?.['apiMethod'] && node.config?.['apiUrl']) {
                        <div class="flex items-center gap-2">
                          <span class="px-1.5 py-0.5 rounded bg-teal-600 text-white font-mono font-bold text-[10px]">{{ node.config!['apiMethod'] }}</span>
                          <span class="font-mono text-slate-600 truncate">{{ node.config!['apiUrl'] }}</span>
                        </div>
                      }
                      @if (node.config?.['apiHeaders']?.length) {
                        <div>
                          <span class="text-[10px] font-semibold text-slate-500 uppercase">Headers</span>
                          @for (h of node.config!['apiHeaders']; track $index) {
                            <div class="font-mono text-[11px] text-slate-500">{{ h.key }}: {{ h.value }}</div>
                          }
                        </div>
                      }
                      @if (node.config?.['apiResponseMappings']?.length) {
                        <div>
                          <span class="text-[10px] font-semibold text-slate-500 uppercase">Response Capture</span>
                          @for (m of node.config!['apiResponseMappings']; track $index) {
                            <div class="font-mono text-[11px] text-slate-500">
                              <span class="text-teal-700">{{ m.expression }}</span>
                              <mat-icon class="!text-[10px] !w-3 !h-3 align-middle mx-1">arrow_forward</mat-icon>
                              <span class="text-indigo-600">{{ m.variableName }}</span>
                            </div>
                          }
                        </div>
                      }
                    </div>
                    <!-- Loading / result state -->
                    @if (apiCallLoading()) {
                      <div class="flex items-center gap-3 mt-3 p-3 rounded bg-teal-100 border border-teal-200">
                        <mat-spinner diameter="20" color="primary"></mat-spinner>
                        <span class="text-sm text-teal-800 font-medium">Executing API call…</span>
                      </div>
                    } @else if (apiCallError()) {
                      <div class="flex items-center gap-2 mt-3 p-3 rounded bg-red-50 border border-red-200 text-sm text-red-700">
                        <mat-icon class="!text-lg text-red-500">error</mat-icon>
                        <span>{{ apiCallError() }}</span>
                      </div>
                    } @else if (apiCallDone()) {
                      <div class="flex items-center gap-2 mt-3 p-3 rounded bg-green-50 border border-green-200 text-sm text-green-700">
                        <mat-icon class="!text-lg text-green-500">check_circle</mat-icon>
                        <span>API call completed successfully</span>
                      </div>
                    }
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          } @else if (node.type === 'end') {
            <!-- Should be caught by completed state above, but fallback -->
            <mat-card class="!rounded-xl !shadow-sm border border-green-200 bg-green-50 text-center p-6">
              <mat-icon class="!text-4xl text-green-600 mb-2">check_circle</mat-icon>
              <h2 class="text-lg font-bold text-green-800">Complete</h2>
            </mat-card>
          }

          <!-- Navigation -->
          @if (execution()!.status !== 'completed') {
            <div class="flex items-center justify-between mt-4">
              <button mat-button (click)="goBack()" [disabled]="!canGoBack()">
                <mat-icon>arrow_back</mat-icon> Back
              </button>
              <button mat-raised-button color="primary" (click)="submitAndAdvance()" [disabled]="!canAdvance()">
                {{ isLastQuestionNode() ? 'Submit' : 'Next' }}
                <mat-icon>{{ isLastQuestionNode() ? 'send' : 'arrow_forward' }}</mat-icon>
              </button>
            </div>
          }
        }
      } @else {
        <div class="text-center py-12 text-slate-400">
          <mat-icon class="!text-5xl mb-2">error_outline</mat-icon>
          <p class="text-sm">Flow not found</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .dense-field { font-size: 13px; }
    .dense-field .mat-mdc-form-field-infix { min-height: 36px !important; padding-top: 8px !important; padding-bottom: 8px !important; }
  `],
})
export class PortalFlowRunnerComponent implements OnInit {
  loading = signal(true);
  execution = signal<FlowExecution | null>(null);
  flowDef = signal<FlowDefinition | null>(null);
  localAnswers = signal<Map<string, any>>(new Map());
  apiCallLoading = signal(false);
  apiCallDone = signal(false);
  apiCallError = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dataService: DataService,
    private snackBar: MatSnackBar,
  ) {}

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

  isMultiSelected(nodeId: string, fieldId: string, value: string): boolean {
    const current = this.getAnswer(nodeId, fieldId);
    if (Array.isArray(current)) return current.includes(value);
    return false;
  }

  toggleMultiSelect(nodeId: string, fieldId: string, value: string): void {
    const current = this.getAnswer(nodeId, fieldId);
    let arr: string[] = Array.isArray(current) ? [...current] : [];
    if (arr.includes(value)) {
      arr = arr.filter(v => v !== value);
    } else {
      arr.push(value);
    }
    this.setAnswerDirect(nodeId, fieldId, arr);
  }

  canGoBack(): boolean {
    const exec = this.execution();
    if (!exec) return false;
    return exec.visitedNodes.length > 2; // start + first node
  }

  canAdvance(): boolean {
    const node = this.currentNode();
    if (!node) return false;
    // These node types need no form input — always allow advance
    if (node.type === 'display' || node.type === 'task' || node.type === 'parallel'
        || node.type === 'approval' || node.type === 'notification' || node.type === 'timer'
        || node.type === 'api_call') return true;
    if (node.type === 'question') {
      // Check required fields
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
    if (node.type === 'question') {
      for (const field of node.fields) {
        const val = this.getAnswer(node.id, field.id);
        if (val !== undefined && val !== null) {
          answers.push({ nodeId: node.id, fieldId: field.id, value: val });
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
        // Update local answers
        for (const a of updated.answers) {
          this.localAnswers.update(map => {
            const newMap = new Map(map);
            newMap.set(`${a.nodeId}::${a.fieldId}`, a.value);
            return newMap;
          });
        }
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
    // Decision nodes should never be displayed — auto-advance through them
    if (node.type === 'decision') {
      setTimeout(() => this.submitAndAdvance(), 100);
      return;
    }
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
    });
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

  alertIcon(style: string): string {
    return ({ info: 'info', success: 'check_circle', warning: 'warning', error: 'error' } as Record<string, string>)[style] || 'info';
  }

  alertBoxClass(style: string): string {
    return ({ info: 'bg-blue-50 border-blue-300 text-blue-900', success: 'bg-green-50 border-green-300 text-green-900', warning: 'bg-amber-50 border-amber-300 text-amber-900', error: 'bg-red-50 border-red-300 text-red-900' } as Record<string, string>)[style] || 'bg-blue-50 border-blue-300 text-blue-900';
  }

  alertIconClass(style: string): string {
    return ({ info: 'text-blue-600', success: 'text-green-600', warning: 'text-amber-600', error: 'text-red-600' } as Record<string, string>)[style] || 'text-blue-600';
  }
}
