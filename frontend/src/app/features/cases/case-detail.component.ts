import { Component, OnInit } from '@angular/core';
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
import { Store } from '@ngrx/store';
import { selectCasesList } from '../../state/cases/cases.selectors';
import { Case, Task } from '../../core/models';

@Component({
  selector: 'app-case-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
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
  ],
  template: `
    @if (case$ | async as case) {
      <div class="case-detail-container p-6 max-w-6xl mx-auto">
        <!-- Header -->
        <div class="flex justify-between items-start mb-6">
          <div>
            <h1 class="text-4xl font-bold text-gray-800">{{ case.id }}</h1>
            <p class="text-gray-600 mt-2">{{ case.fields.applicantName }} • {{ case.caseType | uppercase }}</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-gray-600">Status</p>
            <mat-icon [ngClass]="statusColor(case.status)" class="text-3xl">
              {{ statusIcon(case.status) }}
            </mat-icon>
            <p [ngClass]="statusColor(case.status)" class="font-semibold">{{ case.status | uppercase }}</p>
          </div>
        </div>

        <!-- Stage Progression -->
        <mat-card class="mb-6">
          <mat-card-content>
            <h3 class="text-lg font-semibold mb-4">Case Journey</h3>
            <div class="flex items-center gap-4">
              @for (stage of stages; track stage.name) {
                <div class="flex flex-col items-center gap-2">
                  <!-- Stage Circle -->
                  <div
                    class="w-12 h-12 rounded-full flex items-center justify-center font-bold"
                    [ngClass]="stageCircleClass(case.stageHistory, stage.name)"
                  >
                    @if (isStageCompleted(case.stageHistory, stage.name)) {
                      <mat-icon>check</mat-icon>
                    } @else if (isStageActive(case.stage, stage.name)) {
                      <mat-icon class="animate-pulse">radio_button_checked</mat-icon>
                    } @else {
                      <span class="text-xs">{{ stage.order }}</span>
                    }
                  </div>
                  <!-- Stage Label -->
                  <span class="text-xs font-semibold text-center max-w-20">{{ stage.name | uppercase }}</span>
                </div>

                <!-- Connector -->
                @if (!$last) {
                  <div class="flex-1 h-1 bg-gray-300 mb-6"></div>
                }
              }
            </div>

            <!-- Progress Bar -->
            <div class="mt-4">
              <p class="text-sm text-gray-600 mb-2">Overall Progress</p>
              <mat-progress-bar
                mode="determinate"
                [value]="getProgressPercentage(case.stageHistory)"
                class="h-2"
              ></mat-progress-bar>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Main Content -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left: Case Details (2 cols) -->
          <div class="lg:col-span-2 space-y-6">
            <mat-tab-group>
              <!-- Details Tab -->
              <mat-tab label="Details">
                <ng-template mat-tab-label>
                  <mat-icon class="mr-2">description</mat-icon>
                  Details
                </ng-template>
                <mat-card>
                  <mat-card-content class="pt-6">
                    <form [formGroup]="detailsForm" class="space-y-4">
                      <div class="grid grid-cols-2 gap-4">
                        <!-- Field 1 -->
                        <mat-form-field appearance="outline" class="w-full">
                          <mat-label>Applicant Name</mat-label>
                          <input matInput formControlName="applicantName" readonly />
                        </mat-form-field>

                        <!-- Field 2 -->
                        <mat-form-field appearance="outline" class="w-full">
                          <mat-label>Loan Amount</mat-label>
                          <input matInput formControlName="loanAmount" readonly />
                        </mat-form-field>

                        <!-- Field 3 -->
                        <mat-form-field appearance="outline" class="w-full">
                          <mat-label>Interest Rate</mat-label>
                          <input matInput formControlName="interestRate" readonly />
                        </mat-form-field>

                        <!-- Field 4 -->
                        <mat-form-field appearance="outline" class="w-full">
                          <mat-label>Loan Term (months)</mat-label>
                          <input matInput formControlName="loanTerm" readonly />
                        </mat-form-field>

                        <!-- Status (editable) -->
                        <mat-form-field appearance="outline" class="w-full">
                          <mat-label>Status</mat-label>
                          <mat-select formControlName="status">
                            <mat-option value="open">Open</mat-option>
                            <mat-option value="in_progress">In Progress</mat-option>
                            <mat-option value="pending_review">Pending Review</mat-option>
                            <mat-option value="closed">Closed</mat-option>
                          </mat-select>
                        </mat-form-field>

                        <!-- Priority (editable) -->
                        <mat-form-field appearance="outline" class="w-full">
                          <mat-label>Priority</mat-label>
                          <mat-select formControlName="priority">
                            <mat-option value="critical">Critical</mat-option>
                            <mat-option value="high">High</mat-option>
                            <mat-option value="medium">Medium</mat-option>
                            <mat-option value="low">Low</mat-option>
                          </mat-select>
                        </mat-form-field>
                      </div>

                      <!-- Notes -->
                      <mat-form-field appearance="outline" class="w-full">
                        <mat-label>Notes</mat-label>
                        <textarea matInput formControlName="notes" rows="4"></textarea>
                      </mat-form-field>

                      <!-- Buttons -->
                      <div class="flex gap-2 pt-4">
                        <button mat-raised-button color="primary">
                          <mat-icon>save</mat-icon>
                          Save Changes
                        </button>
                        <button mat-stroked-button>
                          <mat-icon>cancel</mat-icon>
                          Cancel
                        </button>
                      </div>
                    </form>
                  </mat-card-content>
                </mat-card>
              </mat-tab>

              <!-- Tasks Tab -->
              <mat-tab label="Tasks">
                <ng-template mat-tab-label>
                  <mat-icon class="mr-2">task</mat-icon>
                  Tasks ({{ tasks.length }})
                </ng-template>
                <mat-card>
                  <mat-card-content class="pt-6">
                    @if (tasks.length > 0) {
                      <mat-list>
                        @for (task of tasks; track task.id) {
                          <mat-list-item class="border-b pb-4 mb-4">
                            <div class="flex gap-3 w-full">
                              <mat-icon [ngClass]="taskStatusColor(task.status)" class="text-lg">
                                {{ taskStatusIcon(task.status) }}
                              </mat-icon>
                              <div class="flex-1">
                                <h4 class="font-semibold">{{ task.title }}</h4>
                                <p class="text-sm text-gray-600">{{ task.description }}</p>
                                <div class="flex gap-2 mt-2 text-xs">
                                  <span class="bg-gray-100 px-2 py-1 rounded">
                                    Due: {{ task.dueDate | date: 'short' }}
                                  </span>
                                  <span [ngClass]="priorityBadgeClass(task.priority)" class="px-2 py-1 rounded">
                                    {{ task.priority | uppercase }}
                                  </span>
                                </div>
                              </div>
                              <button mat-icon-button matTooltip="View Task">
                                <mat-icon>open_in_new</mat-icon>
                              </button>
                            </div>
                          </mat-list-item>
                        }
                      </mat-list>
                    } @else {
                      <p class="text-gray-500 text-center py-6">No tasks for this case yet</p>
                    }
                  </mat-card-content>
                </mat-card>
              </mat-tab>

              <!-- Activity Tab -->
              <mat-tab label="Activity">
                <ng-template mat-tab-label>
                  <mat-icon class="mr-2">history</mat-icon>
                  Activity
                </ng-template>
                <mat-card>
                  <mat-card-content class="pt-6">
                    @if (case.auditLog && case.auditLog.length > 0) {
                      <mat-list>
                        @for (log of case.auditLog | slice:0:10; track log.id) {
                          <mat-list-item class="border-l-4 pl-4 mb-3" [ngClass]="auditLogBorder(log.action)">
                            <div class="flex-1">
                              <p class="font-semibold text-sm">{{ log.description }}</p>
                              <p class="text-xs text-gray-600">
                                {{ log.timestamp | date: 'medium' }} • {{ log.performedBy.name }}
                              </p>
                            </div>
                          </mat-list-item>
                        }
                      </mat-list>
                    } @else {
                      <p class="text-gray-500 text-center py-6">No activity recorded</p>
                    }
                  </mat-card-content>
                </mat-card>
              </mat-tab>
            </mat-tab-group>
          </div>

          <!-- Right: Summary Panel (1 col) -->
          <div class="space-y-6">
            <!-- Case Info Card -->
            <mat-card>
              <mat-card-header>
                <mat-card-title>Case Information</mat-card-title>
              </mat-card-header>
              <mat-card-content class="space-y-4">
                <div>
                  <p class="text-xs text-gray-600 font-semibold">Case ID</p>
                  <p class="text-sm font-mono">{{ case.id }}</p>
                </div>
                <mat-divider></mat-divider>

                <div>
                  <p class="text-xs text-gray-600 font-semibold">Case Type</p>
                  <p class="text-sm">{{ case.caseType | uppercase }}</p>
                </div>
                <mat-divider></mat-divider>

                <div>
                  <p class="text-xs text-gray-600 font-semibold">Current Stage</p>
                  <p class="text-sm font-semibold" [ngClass]="stageColor(case.stage)">
                    {{ case.stage | uppercase }}
                  </p>
                </div>
                <mat-divider></mat-divider>

                <div>
                  <p class="text-xs text-gray-600 font-semibold">Assigned To</p>
                  <p class="text-sm">{{ case.assignedTo?.name || 'Unassigned' }}</p>
                </div>
                <mat-divider></mat-divider>

                <div>
                  <p class="text-xs text-gray-600 font-semibold">Created</p>
                  <p class="text-sm">{{ case.createdAt | date: 'medium' }}</p>
                </div>
                <mat-divider></mat-divider>

                <div>
                  <p class="text-xs text-gray-600 font-semibold">Updated</p>
                  <p class="text-sm">{{ case.updatedAt | date: 'medium' }}</p>
                </div>
              </mat-card-content>
            </mat-card>

            <!-- SLA Card -->
            @if (case.sla) {
              <mat-card>
                <mat-card-header>
                  <mat-card-title>SLA</mat-card-title>
                </mat-card-header>
                <mat-card-content class="space-y-4">
                  <div>
                    <p class="text-xs text-gray-600 font-semibold">Target Resolution</p>
                    <p class="text-sm">{{ case.sla.targetResolutionDate | date: 'short' }}</p>
                  </div>
                  <mat-divider></mat-divider>

                  <div>
                    <p class="text-xs text-gray-600 font-semibold">Days Remaining</p>
                    <p class="text-sm font-semibold" [ngClass]="slaColor(case.sla.daysRemaining)">
                      {{ case.sla.daysRemaining }} days
                    </p>
                  </div>
                </mat-card-content>
              </mat-card>
            }

            <!-- Actions -->
            <mat-card>
              <mat-card-header>
                <mat-card-title>Actions</mat-card-title>
              </mat-card-header>
              <mat-card-content class="space-y-2">
                <button mat-stroked-button class="w-full">
                  <mat-icon>edit</mat-icon>
                  Edit Case
                </button>
                <button mat-stroked-button class="w-full">
                  <mat-icon>forward</mat-icon>
                  Transition Stage
                </button>
                <button mat-stroked-button class="w-full">
                  <mat-icon>comment</mat-icon>
                  Add Comment
                </button>
                <button mat-stroked-button class="w-full">
                  <mat-icon>archive</mat-icon>
                  Close Case
                </button>
              </mat-card-content>
            </mat-card>
          </div>
        </div>
      </div>
    } @else {
      <div class="p-6 text-center">
        <p class="text-gray-500">Case not found</p>
        <button mat-raised-button color="primary" routerLink="/cases" class="mt-4">
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
      background-color: #fafafa;
      min-height: 100vh;
    }

    .animate-pulse {
      animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }

    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }
  `],
})
export class CaseDetailComponent implements OnInit {
  case$: any;
  detailsForm: FormGroup;
  tasks: Task[] = [];

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
    private formBuilder: FormBuilder
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
      // Find the specific case
    );

    // For now, mock the case data retrieval
    this.store.select(selectCasesList).subscribe(cases => {
      const selectedCase = cases.find(c => c.id === caseId);
      if (selectedCase) {
        this.case$ = Promise.resolve(selectedCase);
        this.updateForm(selectedCase);
        // Filter tasks for this case
        this.tasks = selectedCase.tasks || [];
      }
    });
  }

  updateForm(case_: Case): void {
    this.detailsForm.patchValue({
      applicantName: case_.fields.applicantName,
      loanAmount: case_.fields.loanAmount,
      interestRate: case_.fields.interestRate,
      loanTerm: case_.fields.loanTerm,
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
      return 'bg-green-100 text-green-600';
    }
    if (this.isStageActive(stageName, stageName)) {
      return 'bg-blue-100 text-blue-600 border-2 border-blue-600';
    }
    return 'bg-gray-100 text-gray-600';
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
      open: 'text-blue-600',
      in_progress: 'text-purple-600',
      closed: 'text-green-600',
      pending_review: 'text-orange-600',
    }[status] || 'text-gray-600';
  }

  stageColor(stage: string): string {
    const colors: Record<string, string> = {
      intake: 'text-blue-600',
      documents: 'text-purple-600',
      underwriting: 'text-yellow-600',
      approval: 'text-orange-600',
      disbursement: 'text-green-600',
    };
    return colors[stage] || 'text-gray-600';
  }

  taskStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: 'schedule',
      in_progress: 'play_circle_filled',
      completed: 'check_circle',
      blocked: 'block',
    };
    return icons[status] || 'circle';
  }

  taskStatusColor(status: string): string {
    return {
      pending: 'text-gray-600',
      in_progress: 'text-blue-600',
      completed: 'text-green-600',
      blocked: 'text-red-600',
    }[status] || 'text-gray-600';
  }

  priorityBadgeClass(priority: string): string {
    return {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    }[priority] || 'bg-gray-100 text-gray-800';
  }

  auditLogBorder(action: string): string {
    return {
      create: 'border-blue-400',
      update: 'border-yellow-400',
      transition: 'border-purple-400',
      comment: 'border-green-400',
    }[action] || 'border-gray-400';
  }

  slaColor(daysRemaining: number): string {
    if (daysRemaining < 1) return 'text-red-600';
    if (daysRemaining < 3) return 'text-orange-600';
    return 'text-green-600';
  }
}
