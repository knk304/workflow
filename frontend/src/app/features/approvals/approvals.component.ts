import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApprovalChain, Approver } from '../../core/models';
import * as ApprovalsActions from '../../state/approvals/approvals.actions';
import {
  selectApprovalsList,
  selectApprovalsLoading,
  selectPendingApprovals,
} from '../../state/approvals/approvals.selectors';

@Component({
  selector: 'app-approvals',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatDividerModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  template: `
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">Approvals</h1>
          <p class="text-gray-500">Manage approval chains and decisions</p>
        </div>
        <div class="flex items-center gap-3">
          <mat-chip-set>
            <mat-chip class="!bg-yellow-100 !text-yellow-800">
              {{ (pendingApprovals$ | async)?.length || 0 }} Pending
            </mat-chip>
          </mat-chip-set>
          <button mat-raised-button color="primary" (click)="showCreatePanel.set(!showCreatePanel())">
            <mat-icon>add</mat-icon> New Approval Chain
          </button>
        </div>
      </div>

      <!-- Create Panel -->
      @if (showCreatePanel()) {
        <mat-card class="mb-6">
          <mat-card-content class="p-4">
            <h3 class="font-semibold mb-3">Create Approval Chain</h3>
            <div class="grid grid-cols-3 gap-4">
              <mat-form-field>
                <mat-label>Case ID</mat-label>
                <input matInput [(ngModel)]="newCaseId" placeholder="CASE-2026-00001">
              </mat-form-field>
              <mat-form-field>
                <mat-label>Mode</mat-label>
                <mat-select [(ngModel)]="newMode">
                  <mat-option value="sequential">Sequential</mat-option>
                  <mat-option value="parallel">Parallel</mat-option>
                </mat-select>
              </mat-form-field>
              <div class="flex items-center">
                <button mat-raised-button color="primary" (click)="createChain()">Create</button>
                <button mat-button class="ml-2" (click)="showCreatePanel.set(false)">Cancel</button>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      }

      <!-- Approval Cards -->
      @for (chain of approvals$ | async; track chain.id) {
        <mat-card class="mb-4">
          <mat-card-content class="p-4">
            <div class="flex items-center justify-between mb-4">
              <div>
                <div class="flex items-center gap-3">
                  <h3 class="font-semibold">Case: {{ chain.caseId }}</h3>
                  <mat-chip [ngClass]="{
                    '!bg-yellow-100 !text-yellow-800': chain.status === 'pending',
                    '!bg-green-100 !text-green-800': chain.status === 'approved',
                    '!bg-red-100 !text-red-800': chain.status === 'rejected',
                    '!bg-blue-100 !text-blue-800': chain.status === 'delegated'
                  }">{{ chain.status | uppercase }}</mat-chip>
                </div>
                <p class="text-sm text-gray-500 mt-1">
                  {{ chain.mode === 'sequential' ? '→ Sequential' : '⫘ Parallel' }} ·
                  Created {{ getRelativeTime(chain.createdAt) }}
                </p>
              </div>
            </div>

            <!-- Approver Timeline -->
            <div class="flex items-center gap-2 flex-wrap">
              @for (approver of chain.approvers; track approver.userId; let i = $index; let last = $last) {
                <div class="flex items-center gap-2 p-3 rounded-lg border min-w-[200px]"
                     [ngClass]="{
                       'border-green-300 bg-green-50': approver.status === 'approved',
                       'border-red-300 bg-red-50': approver.status === 'rejected',
                       'border-yellow-300 bg-yellow-50': approver.status === 'pending',
                       'border-blue-300 bg-blue-50': approver.status === 'delegated'
                     }">
                  <div class="flex-1">
                    <div class="font-medium text-sm">{{ approver.userName || approver.userId }}</div>
                    <div class="flex items-center gap-1 mt-1">
                      <mat-icon class="!text-sm !w-4 !h-4" [ngClass]="{
                        'text-green-600': approver.status === 'approved',
                        'text-red-600': approver.status === 'rejected',
                        'text-yellow-600': approver.status === 'pending',
                        'text-blue-600': approver.status === 'delegated'
                      }">{{ getStatusIcon(approver.status) }}</mat-icon>
                      <span class="text-xs">{{ approver.status }}</span>
                    </div>
                    @if (approver.comment) {
                      <p class="text-xs text-gray-500 mt-1 italic">"{{ approver.comment }}"</p>
                    }
                    @if (approver.decidedAt) {
                      <p class="text-xs text-gray-400 mt-1">{{ getRelativeTime(approver.decidedAt) }}</p>
                    }
                  </div>

                  <!-- Actions for pending -->
                  @if (approver.status === 'pending') {
                    <div class="flex flex-col gap-1">
                      <button mat-icon-button matTooltip="Approve" class="!text-green-600"
                              (click)="approve(chain.id)">
                        <mat-icon>check_circle</mat-icon>
                      </button>
                      <button mat-icon-button matTooltip="Reject" class="!text-red-600"
                              (click)="reject(chain.id)">
                        <mat-icon>cancel</mat-icon>
                      </button>
                      <button mat-icon-button matTooltip="Delegate" class="!text-blue-600"
                              (click)="selectedChainId.set(chain.id)">
                        <mat-icon>forward</mat-icon>
                      </button>
                    </div>
                  }
                </div>

                @if (!last && chain.mode === 'sequential') {
                  <mat-icon class="text-gray-400">arrow_forward</mat-icon>
                }
              }
            </div>

            <!-- Delegation input -->
            @if (selectedChainId() === chain.id) {
              <div class="mt-4 flex items-center gap-3">
                <mat-form-field>
                  <mat-label>Delegate To (User ID)</mat-label>
                  <input matInput [(ngModel)]="delegateToId">
                </mat-form-field>
                <mat-form-field>
                  <mat-label>Comment</mat-label>
                  <input matInput [(ngModel)]="delegateComment">
                </mat-form-field>
                <button mat-raised-button color="primary" (click)="delegate(chain.id)">Delegate</button>
                <button mat-button (click)="selectedChainId.set(null)">Cancel</button>
              </div>
            }

            <!-- Progress bar -->
            <div class="mt-4">
              <mat-progress-bar
                mode="determinate"
                [value]="getApprovalProgress(chain)"
                [color]="chain.status === 'rejected' ? 'warn' : 'primary'"
              ></mat-progress-bar>
              <p class="text-xs text-gray-500 mt-1">
                {{ getApprovedCount(chain) }}/{{ chain.approvers.length }} approved
              </p>
            </div>
          </mat-card-content>
        </mat-card>
      }

      @if ((approvals$ | async)?.length === 0) {
        <div class="text-center py-12 text-gray-400">
          <mat-icon class="!text-5xl !w-12 !h-12 mb-3">verified</mat-icon>
          <p>No approval chains found</p>
        </div>
      }
    </div>
  `,
})
export class ApprovalsComponent implements OnInit {
  approvals$ = this.store.select(selectApprovalsList);
  pendingApprovals$ = this.store.select(selectPendingApprovals);

  showCreatePanel = signal(false);
  selectedChainId = signal<string | null>(null);
  newCaseId = '';
  newMode = 'sequential';
  approveComment = '';
  delegateToId = '';
  delegateComment = '';

  constructor(private store: Store, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.store.dispatch(ApprovalsActions.loadApprovals({}));
  }

  createChain(): void {
    this.store.dispatch(ApprovalsActions.createApproval({
      approval: { caseId: this.newCaseId, mode: this.newMode as any },
    }));
    this.showCreatePanel.set(false);
    this.newCaseId = '';
    this.snackBar.open('Approval chain created', 'OK', { duration: 2000 });
  }

  approve(chainId: string): void {
    this.store.dispatch(ApprovalsActions.approveChain({
      id: chainId,
      decision: { comment: 'Approved' },
    }));
    this.snackBar.open('Approved', 'OK', { duration: 2000 });
  }

  reject(chainId: string): void {
    this.store.dispatch(ApprovalsActions.rejectChain({
      id: chainId,
      decision: { comment: 'Rejected' },
    }));
    this.snackBar.open('Rejected', 'OK', { duration: 2000 });
  }

  delegate(chainId: string): void {
    this.store.dispatch(ApprovalsActions.delegateApproval({
      id: chainId,
      delegation: { delegateTo: this.delegateToId, comment: this.delegateComment },
    }));
    this.selectedChainId.set(null);
    this.delegateToId = '';
    this.delegateComment = '';
    this.snackBar.open('Delegated', 'OK', { duration: 2000 });
  }

  getStatusIcon(status: string): string {
    return { approved: 'check_circle', rejected: 'cancel', pending: 'schedule', delegated: 'forward' }[status] || 'help';
  }

  getApprovalProgress(chain: ApprovalChain): number {
    if (!chain.approvers.length) return 0;
    return (this.getApprovedCount(chain) / chain.approvers.length) * 100;
  }

  getApprovedCount(chain: ApprovalChain): number {
    return chain.approvers.filter(a => a.status === 'approved').length;
  }

  getRelativeTime(date: string): string {
    const now = new Date();
    const d = new Date(date);
    const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }
}
