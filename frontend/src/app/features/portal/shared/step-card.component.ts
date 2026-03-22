import { Component, Input, Output, EventEmitter, ViewChild, OnChanges, OnDestroy, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { forkJoin, Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import * as ApprovalsActions from '@state/approvals/approvals.actions';
import { selectApprovalsByCaseId } from '@state/approvals/approvals.selectors';
import { StepInstance, ApprovalChain, User } from '@core/models';
import { statusLabel } from '@core/utils/status-labels';
import { DataService } from '@core/services/data.service';
import { DynamicFormComponent, DynamicField } from './dynamic-form.component';

@Component({
  selector: 'app-step-card',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
    MatProgressBarModule,
    MatInputModule,
    MatFormFieldModule,
    MatTooltipModule,
    RouterLink,
    DynamicFormComponent,
  ],
  styles: [`
    :host ::ng-deep .dense-field .mat-mdc-form-field-infix {
      min-height: 32px !important;
      padding-top: 4px !important;
      padding-bottom: 4px !important;
    }
    :host ::ng-deep .dense-field .mat-mdc-text-field-wrapper {
      height: 36px;
    }
    :host ::ng-deep .dense-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }
  `],
  template: `
    <div class="border rounded-xl p-4 transition-all"
         [ngClass]="cardClass()">
      <div class="flex items-start gap-3">
        <!-- Step status icon -->
        <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
             [ngClass]="iconClass()">
          @switch (step.status) {
            @case ('completed') {
              <mat-icon class="!text-base">check</mat-icon>
            }
            @case ('in_progress') {
              <mat-icon class="!text-base">play_arrow</mat-icon>
            }
            @case ('waiting') {
              <mat-icon class="!text-base">hourglass_top</mat-icon>
            }
            @case ('skipped') {
              <mat-icon class="!text-base">skip_next</mat-icon>
            }
            @default {
              <mat-icon class="!text-base">radio_button_unchecked</mat-icon>
            }
          }
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-semibold text-sm" [ngClass]="titleClass()">
              {{ step.name }}
            </span>
            @if (step.type) {
              <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase">
                {{ step.type }}
              </span>
            }
          </div>

          @if (step.description) {
            <p class="text-xs text-slate-500 mb-2">{{ step.description }}</p>
          }

          <!-- Instructions from step config -->
          @if (isCurrent && stepInstructions && step.status !== 'completed') {
            <div class="text-xs text-slate-600 mb-2 p-2 bg-slate-50 border border-slate-100 rounded">
              <mat-icon class="!text-xs align-middle mr-1 text-slate-400">info</mat-icon>
              {{ stepInstructions }}
            </div>
          }

          <!-- Step type-specific content for current step -->
          @if (isCurrent && (step.status === 'in_progress' || step.status === 'pending' || step.status === 'waiting')) {
            @switch (step.type) {
              @case ('assignment') {
                <!-- Dynamic form for assignment steps -->
                @if (hasFormFields) {
                  <div class="mt-3 p-3 bg-white rounded-lg border border-slate-200">
                    <h5 class="text-xs font-semibold text-slate-500 uppercase mb-3">
                      <mat-icon class="!text-sm align-middle mr-1">dynamic_form</mat-icon>
                      Complete Form
                    </h5>
                    <app-dynamic-form
                      [fields]="cachedFormFields"
                      [hideSubmit]="true"
                      (formValid)="isFormValid = $event">
                    </app-dynamic-form>
                  </div>
                }
              }
              @case ('approval') {
                <div class="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <h5 class="text-xs font-semibold text-amber-700 uppercase mb-2">
                    <mat-icon class="!text-sm align-middle mr-1">gavel</mat-icon> Approval Required
                  </h5>
                  @if (approvalChain) {
                    <div class="text-xs text-amber-600 mb-2">
                      Mode: <span class="font-semibold">{{ approvalChain.mode }}</span>
                      &bull; Status: <span class="font-semibold">{{ statusLabel(approvalChain.status) }}</span>
                    </div>
                    <div class="space-y-1.5">
                      @for (approver of approvalChain.approvers; track approver.userId) {
                        <div class="flex items-center gap-2 text-xs px-2 py-1.5 rounded border"
                             [ngClass]="approverRowClass(approver.status)">
                          <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                               [ngClass]="approverIconClass(approver.status)">
                            @switch (approver.status) {
                              @case ('approved') { <mat-icon class="!text-xs">check</mat-icon> }
                              @case ('rejected') { <mat-icon class="!text-xs">close</mat-icon> }
                              @case ('delegated') { <mat-icon class="!text-xs">forward</mat-icon> }
                              @default { <mat-icon class="!text-xs">schedule</mat-icon> }
                            }
                          </div>
                          <div class="flex-1 min-w-0">
                            <span class="font-medium">{{ approver.userName || approver.userId }}</span>
                            @if (approver.comment) {
                              <span class="text-slate-500 ml-1">&mdash; {{ approver.comment }}</span>
                            }
                          </div>
                          <span class="text-[10px] px-1.5 py-0.5 rounded-full uppercase font-semibold"
                                [ngClass]="approverBadgeClass(approver.status)">
                            {{ statusLabel(approver.status) }}
                          </span>
                          @if (approver.decidedAt) {
                            <span class="text-[10px] text-slate-400 shrink-0">{{ approver.decidedAt | date:'short' }}</span>
                          }
                        </div>
                      }
                    </div>

                    <!-- Interactive decision area for current pending approver -->
                    @if (approvalChain.status === 'pending' && currentUserPendingApprover()) {
                      @if (approvalAction() === null && !showDelegateForm()) {
                        <div class="flex gap-2 mt-3">
                          <button mat-flat-button color="primary" class="!text-xs !h-7 flex-1"
                                  (click)="approvalAction.set('approve')">
                            <mat-icon class="!text-sm mr-1">thumb_up</mat-icon> Approve
                          </button>
                          <button mat-stroked-button color="warn" class="!text-xs !h-7 flex-1"
                                  (click)="approvalAction.set('reject')">
                            <mat-icon class="!text-sm mr-1">thumb_down</mat-icon> Reject
                          </button>
                          <button mat-icon-button class="!w-7 !h-7" matTooltip="Delegate"
                                  (click)="showDelegateForm.set(true)">
                            <mat-icon class="!text-sm">forward</mat-icon>
                          </button>
                        </div>
                      }
                      @if (approvalAction() !== null) {
                        <div class="mt-3 p-2.5 bg-white rounded border border-amber-200 space-y-2">
                          <p class="text-xs font-semibold text-amber-800 capitalize">{{ approvalAction() }}</p>
                          <mat-form-field class="w-full dense-field">
                            <mat-label>Comment (optional)</mat-label>
                            <input matInput [(ngModel)]="approvalComment" placeholder="Add a comment...">
                          </mat-form-field>
                          <div class="flex gap-2">
                            <button mat-flat-button [color]="approvalAction() === 'approve' ? 'primary' : 'warn'"
                                    class="!text-xs !h-7 flex-1" (click)="confirmApprovalAction()">
                              Confirm {{ approvalAction() }}
                            </button>
                            <button mat-stroked-button class="!text-xs !h-7"
                                    (click)="approvalAction.set(null); approvalComment = ''">
                              Cancel
                            </button>
                          </div>
                        </div>
                      }
                      @if (showDelegateForm()) {
                        <div class="mt-3 p-2.5 bg-white rounded border border-amber-200 space-y-2">
                          <p class="text-xs font-semibold text-amber-800">Delegate approval</p>
                          <mat-form-field class="w-full dense-field">
                            <mat-label>Delegate to (User ID)</mat-label>
                            <input matInput [(ngModel)]="delegateToUserId" placeholder="user-id">
                          </mat-form-field>
                          <mat-form-field class="w-full dense-field">
                            <mat-label>Reason</mat-label>
                            <input matInput [(ngModel)]="delegateReason" placeholder="Reason for delegation">
                          </mat-form-field>
                          <div class="flex gap-2">
                            <button mat-flat-button color="primary" class="!text-xs !h-7 flex-1"
                                    [disabled]="!delegateToUserId.trim()"
                                    (click)="confirmDelegate()">
                              Delegate
                            </button>
                            <button mat-stroked-button class="!text-xs !h-7"
                                    (click)="showDelegateForm.set(false); delegateToUserId = ''; delegateReason = ''">
                              Cancel
                            </button>
                          </div>
                        </div>
                      }
                    }
                    @if (approvalChain.status === 'approved') {
                      <div class="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                        <mat-icon class="!text-sm">check_circle</mat-icon> Fully approved
                      </div>
                    }
                    @if (approvalChain.status === 'rejected') {
                      <div class="mt-2 flex items-center gap-1.5 text-xs text-red-700 font-medium">
                        <mat-icon class="!text-sm">cancel</mat-icon> Rejected
                      </div>
                    }
                  } @else {
                    <p class="text-xs text-amber-600">Review and approve or reject this item.</p>
                  }
                </div>
              }
              @case ('attachment') {
                <div class="mt-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <h5 class="text-xs font-semibold text-indigo-700 uppercase mb-2">
                    <mat-icon class="!text-sm align-middle mr-1">attach_file</mat-icon> Documents Required
                  </h5>
                  <input type="file" #attachFileInput class="hidden" multiple
                         (change)="onFileSelected($event)">
                  <button mat-stroked-button class="!text-xs !h-8 !border-indigo-400 !text-indigo-700"
                          (click)="attachFileInput.click()">
                    <mat-icon class="!text-sm mr-1">upload_file</mat-icon>
                    Choose Files
                  </button>
                  @if (selectedFiles.length > 0) {
                    <div class="mt-2 space-y-1">
                      @for (f of selectedFiles; track f.name) {
                        <div class="flex items-center gap-2 text-xs text-indigo-700 bg-white px-2 py-1 rounded border border-indigo-100">
                          <mat-icon class="!text-sm text-indigo-400">insert_drive_file</mat-icon>
                          <span class="truncate flex-1">{{ f.name }}</span>
                          <span class="text-indigo-400 shrink-0">{{ formatFileSize(f.size) }}</span>
                        </div>
                      }
                    </div>
                  }
                  @if (isUploading()) {
                    <mat-progress-bar mode="indeterminate" class="!mt-2 rounded"></mat-progress-bar>
                  }
                </div>
              }
              @case ('decision') {
                <div class="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <h5 class="text-xs font-semibold text-purple-700 uppercase mb-2">
                    <mat-icon class="!text-sm align-middle mr-1">call_split</mat-icon> Decision
                  </h5>
                  <p class="text-xs text-purple-600">This step evaluates conditions automatically.</p>
                  @if (step.config?.['mode'] === 'decision_table' && step.config?.['decisionTableId']) {
                    <div class="mt-1.5 flex items-center gap-1.5 text-xs text-purple-700 bg-purple-100/60 px-2 py-1 rounded">
                      <mat-icon class="!text-sm">table_chart</mat-icon>
                      Decision Table: <span class="font-semibold">{{ step.config?.['decisionTableId'] }}</span>
                    </div>
                  } @else if (step.config?.['branches']?.length) {
                    <div class="mt-1.5 space-y-1">
                      @for (branch of step.config?.['branches'] || []; track $index) {
                        <div class="flex items-center gap-1.5 text-xs text-purple-700">
                          <mat-icon class="!text-xs">arrow_right</mat-icon>
                          <span class="font-medium">{{ branch.label || 'Branch ' + ($index + 1) }}</span>
                          <span class="text-purple-400">&rarr; {{ branch.nextStepId || 'default' }}</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
              @case ('automation') {
                <div class="mt-2 p-3 bg-teal-50 border border-teal-200 rounded-lg">
                  <h5 class="text-xs font-semibold text-teal-700 uppercase mb-2">
                    <mat-icon class="!text-sm align-middle mr-1">settings_suggest</mat-icon> Automation
                  </h5>
                  <p class="text-xs text-teal-600">This step executes automated actions.</p>
                  @if (step.config?.['webhook']?.['url']) {
                    <div class="mt-2 flex items-center gap-1.5 text-xs text-teal-700 bg-teal-100/60 px-2 py-1 rounded">
                      <mat-icon class="!text-sm">webhook</mat-icon>
                      <span class="font-mono truncate">{{ step.config?.['webhook']?.['method'] || 'POST' }} {{ step.config?.['webhook']?.['url'] }}</span>
                    </div>
                  }
                  @if (step.config?.['actions']?.length) {
                    <div class="mt-2 space-y-1">
                      @for (action of step.config?.['actions'] || []; track $index) {
                        <div class="flex items-center gap-1.5 text-xs text-teal-700">
                          <mat-icon class="!text-xs">play_arrow</mat-icon>
                          <span>{{ action.type }}</span>
                          @if (action.config?.['field']) {
                            <span class="text-teal-500">&rarr; {{ action.config['field'] }}</span>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
              @case ('subprocess') {
                <div class="mt-2 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                  <h5 class="text-xs font-semibold text-cyan-700 uppercase mb-2">
                    <mat-icon class="!text-sm align-middle mr-1">account_tree</mat-icon> Subprocess
                  </h5>
                  @if (step.childCaseId) {
                    <div class="flex items-center gap-2 text-xs text-cyan-700">
                      <mat-icon class="!text-sm">open_in_new</mat-icon>
                      <a [routerLink]="['/portal/cases', step.childCaseId]"
                         class="font-medium underline hover:text-cyan-900">
                        {{ step.childCaseId }}
                      </a>
                      @if (isStepStatus('waiting')) {
                        <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase font-semibold">
                          Waiting for resolution
                        </span>
                      } @else if (isStepStatus('completed')) {
                        <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 uppercase font-semibold">
                          Resolved
                        </span>
                      }
                    </div>
                  } @else if (step.config?.['childCaseTypeId']) {
                    <p class="text-xs text-cyan-600">
                      A child case of type <span class="font-semibold">{{ step.config?.['childCaseTypeId'] }}</span> will be created.
                    </p>
                  } @else {
                    <p class="text-xs text-cyan-600">A child case will be created for this step.</p>
                  }
                  @if (step.config?.['fieldMapping']) {
                    <div class="mt-2 text-[10px] text-cyan-500">
                      <mat-icon class="!text-xs align-middle mr-0.5">sync_alt</mat-icon>
                      {{ objectKeys(step.config?.['fieldMapping'] || {}).length }} field(s) mapped to child case
                    </div>
                  }
                </div>
              }
            }
          } @else if (!isCurrent && cachedFormFields.length > 0 && step.status !== 'completed') {
            <!-- Form fields count preview when not current -->
            <div class="text-xs text-slate-400 mb-2">
              <mat-icon class="!text-sm align-middle mr-0.5">dynamic_form</mat-icon>
              {{ cachedFormFields.length }} field(s) to complete
            </div>
          }

          <!-- Decision branch info (for completed decision steps) -->
          @if (step.type === 'decision' && step.decisionBranchTaken && step.status === 'completed') {
            <p class="text-xs text-purple-500 mb-1">
              <mat-icon class="!text-xs align-middle mr-0.5">call_split</mat-icon>
              Branch: {{ step.decisionBranchTaken }}
            </p>
          }

          <!-- Skipped info -->
          @if (step.status === 'skipped' && step.skippedReason) {
            <p class="text-xs text-slate-400 italic">{{ step.skippedReason }}</p>
          }

          <!-- Completed info -->
          @if (step.status === 'completed' && step.completedAt) {
            <p class="text-xs text-slate-400">
              Completed {{ step.completedAt | date:'short' }}
              @if (step.completedBy) {
                by {{ step.completedBy }}
              }
            </p>
          }

          <!-- Action button for current step -->
          @if (step.status === 'in_progress' || step.status === 'pending') {
            @if (isCurrent && step.type !== 'decision' && step.type !== 'automation' && step.type !== 'subprocess' && step.type !== 'approval') {
              @if (canActOnStep()) {
                <button mat-flat-button color="primary" class="!mt-3 !text-xs !h-8"
                        [disabled]="(step.type === 'assignment' && hasFormFields && !isFormValid) ||
                                    (step.type === 'attachment' && selectedFiles.length === 0)"
                        (click)="completeStep()">
                  <mat-icon class="!text-sm mr-1">check_circle</mat-icon>
                  {{ completeLabel }}
                </button>
              } @else {
                <div class="mt-3 text-xs text-slate-400 flex items-center gap-1">
                  <mat-icon class="!text-sm">lock</mat-icon>
                  {{ assignmentHint }}
                </div>
              }
            }
            @if (isCurrent && (step.type === 'decision' || step.type === 'automation') && step.status === 'in_progress') {
              <button mat-stroked-button color="primary" class="!mt-3 !text-xs !h-8"
                      (click)="completeStep()">
                <mat-icon class="!text-sm mr-1">refresh</mat-icon>
                Retry
              </button>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class StepCardComponent implements OnChanges, OnDestroy {

  @Input() step!: StepInstance;
  @Input() isCurrent = false;
  @Input() caseId = '';
  @Input() currentUser: User | null = null;
  @Output() onComplete = new EventEmitter<{ step: StepInstance; formData: Record<string, any> }>();

  @ViewChild(DynamicFormComponent) dynamicForm?: DynamicFormComponent;

  isFormValid = false;
  selectedFiles: File[] = [];
  isUploading = signal(false);
  cachedFormFields: DynamicField[] = [];
  approvalChain: ApprovalChain | null = null;
  approvalAction = signal<'approve' | 'reject' | null>(null);
  showDelegateForm = signal(false);
  approvalComment = '';
  delegateToUserId = '';
  delegateReason = '';
  objectKeys = Object.keys;
  statusLabel = statusLabel;
  private lastFormFieldsJson = '';
  private chainSub?: Subscription;
  private destroy$ = new Subject<void>();

  constructor(private dataService: DataService, private store: Store) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['step']) {
      this.updateCachedFormFields();
      this.loadApprovalChain();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.chainSub?.unsubscribe();
  }

  private loadApprovalChain(): void {
    this.chainSub?.unsubscribe();
    if (this.step?.type === 'approval' && this.step.approvalChainId) {
      this.dataService.getApprovalById(this.step.approvalChainId).subscribe({
        next: chain => this.approvalChain = chain,
        error: () => this.approvalChain = null,
      });
    } else if (this.step?.type === 'approval' && this.caseId) {
      this.store.dispatch(ApprovalsActions.loadApprovals({ caseId: this.caseId }));
      this.chainSub = this.store.select(selectApprovalsByCaseId(this.caseId))
        .pipe(takeUntil(this.destroy$))
        .subscribe(chains => {
          this.approvalChain = chains.find(c =>
            c.caseId === this.caseId && c.status === 'pending'
          ) || chains[chains.length - 1] || null;
        });
    } else {
      this.approvalChain = null;
    }
  }

  currentUserPendingApprover(): boolean {
    if (!this.currentUser || !this.approvalChain) return false;
    return this.approvalChain.approvers.some(
      a => a.userId === this.currentUser!.id && a.status === 'pending'
    );
  }

  confirmApprovalAction(): void {
    if (!this.approvalChain || !this.approvalAction()) return;
    const decision = { comment: this.approvalComment };
    if (this.approvalAction() === 'approve') {
      this.store.dispatch(ApprovalsActions.approveChain({ id: this.approvalChain.id, decision }));
    } else {
      this.store.dispatch(ApprovalsActions.rejectChain({ id: this.approvalChain.id, decision }));
    }
    this.approvalAction.set(null);
    this.approvalComment = '';
  }

  confirmDelegate(): void {
    if (!this.approvalChain || !this.delegateToUserId.trim()) return;
    this.store.dispatch(ApprovalsActions.delegateApproval({
      id: this.approvalChain.id,
      delegation: { delegateTo: this.delegateToUserId.trim(), comment: this.delegateReason },
    }));
    this.showDelegateForm.set(false);
    this.delegateToUserId = '';
    this.delegateReason = '';
  }

  private updateCachedFormFields(): void {
    const raw = this.step?.formFields || [];
    const json = JSON.stringify(raw);
    if (json !== this.lastFormFieldsJson) {
      this.lastFormFieldsJson = json;
      this.cachedFormFields = raw.map((f: any, i: number) => ({
        id: f.id || f.name || `field_${i}`,
        type: f.type || 'text',
        label: f.label || f.name || `Field ${i + 1}`,
        placeholder: f.placeholder || '',
        defaultValue: f.defaultValue || '',
        validation: f.validation || (f.required ? { required: true } : {}),
        order: f.order ?? i,
        section: f.section,
      }));
    }
  }

  get hasFormFields(): boolean {
    return this.cachedFormFields.length > 0;
  }

  get completeLabel(): string {
    switch (this.step.type) {
      case 'approval': return 'Approve';
      case 'attachment': return 'Submit Documents';
      case 'subprocess': return 'Complete Subprocess';
      default: return 'Complete Step';
    }
  }

  get stepInstructions(): string {
    return this.step.config?.['instructions'] || '';
  }

  canActOnStep(): boolean {
    if (!this.currentUser) return true; // no user info → don't block
    if (this.currentUser.role === 'ADMIN') return true;

    const cfg = this.step.config || {};
    const userId = this.currentUser.id;
    const userRole = this.currentUser.role;

    if (this.step.type === 'approval') {
      const roles: string[] = cfg['approver_roles'] || [];
      const userIds: string[] = cfg['approver_user_ids'] || [];
      if (roles.length || userIds.length) {
        return roles.includes(userRole) || userIds.includes(userId);
      }
    }

    // assignment / attachment / other steps
    if (this.step.assignedTo) {
      return this.step.assignedTo === userId;
    }
    const assigneeRole: string | undefined = cfg['assignee_role'];
    if (assigneeRole) {
      return userRole === assigneeRole;
    }

    return true; // no restrictions configured
  }

  get assignmentHint(): string {
    const cfg = this.step.config || {};
    if (this.step.type === 'approval') {
      const roles: string[] = cfg['approver_roles'] || [];
      if (roles.length) return `Assigned to ${roles.join(', ')} role(s)`;
    }
    if (this.step.assignedTo) return `Assigned to ${this.step.assignedTo}`;
    const role = cfg['assignee_role'];
    if (role) return `Assigned to ${role} role`;
    return 'Not assigned to you';
  }

  completeStep(): void {
    const formData = this.dynamicForm?.getValue() || {};
    if (this.step.type === 'attachment' && this.caseId && this.selectedFiles.length > 0) {
      this.isUploading.set(true);
      const uploads = this.selectedFiles.map(file =>
        this.dataService.uploadDocument(this.caseId, file)
      );
      forkJoin(uploads).subscribe({
        next: () => {
          this.isUploading.set(false);
          this.onComplete.emit({ step: this.step, formData });
        },
        error: () => {
          this.isUploading.set(false);
          this.onComplete.emit({ step: this.step, formData });
        },
      });
      return;
    }
    this.onComplete.emit({ step: this.step, formData });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.selectedFiles = Array.from(input.files);
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  cardClass(): string {
    if (this.step.status === 'completed') return 'border-emerald-200 bg-emerald-50/50';
    if (this.step.status === 'waiting') return 'border-amber-300 bg-amber-50/50 shadow-sm';
    if (this.isCurrent) return 'border-primary-300 bg-primary-50/50 shadow-sm';
    if (this.step.status === 'skipped') return 'border-slate-200 bg-slate-50 opacity-60';
    return 'border-slate-200 bg-white';
  }

  iconClass(): string {
    if (this.step.status === 'completed') return 'bg-emerald-500 text-white';
    if (this.step.status === 'waiting') return 'bg-amber-500 text-white';
    if (this.isCurrent) return 'bg-primary-500 text-white';
    if (this.step.status === 'skipped') return 'bg-slate-300 text-white';
    return 'bg-slate-200 text-slate-400';
  }

  titleClass(): string {
    if (this.step.status === 'completed') return 'text-emerald-700';
    if (this.step.status === 'waiting') return 'text-amber-700';
    if (this.isCurrent) return 'text-primary-700';
    return 'text-slate-600';
  }

  approverRowClass(status: string): string {
    return {
      approved: 'bg-emerald-50 border-emerald-200',
      rejected: 'bg-red-50 border-red-200',
      delegated: 'bg-primary-50 border-primary-200',
    }[status] || 'bg-white border-slate-200';
  }

  approverIconClass(status: string): string {
    return {
      approved: 'bg-emerald-500 text-white',
      rejected: 'bg-red-500 text-white',
      delegated: 'bg-primary-500 text-white',
    }[status] || 'bg-slate-200 text-slate-500';
  }

  approverBadgeClass(status: string): string {
    return {
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-red-100 text-red-700',
      delegated: 'bg-primary-100 text-primary-700',
    }[status] || 'bg-amber-100 text-amber-700';
  }

  isStepStatus(status: string): boolean {
    return this.step?.status === status;
  }
}
