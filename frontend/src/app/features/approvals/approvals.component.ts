import { Component, OnInit, signal, computed } from '@angular/core';
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
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialogModule } from '@angular/material/dialog';
import { ApprovalChain, ApprovalStatus } from '../../core/models';
import * as ApprovalsActions from '../../state/approvals/approvals.actions';
import {
  selectApprovalsList,
  selectApprovalsLoading,
  selectApprovalsError,
  selectPendingApprovals,
} from '../../state/approvals/approvals.selectors';

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected';
type SortField = 'createdAt' | 'status' | 'caseId';

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
    MatBadgeModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatTabsModule,
    MatDialogModule,
  ],
  template: `
    <div class="p-6 max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Approvals</h1>
          <p class="text-gray-500 mt-1">Manage approval chains, decisions and delegation</p>
        </div>
        <div class="flex items-center gap-3">
          <button mat-raised-button color="primary" (click)="showCreatePanel.set(!showCreatePanel())">
            <mat-icon>add</mat-icon> New Approval Chain
          </button>
          <button mat-icon-button matTooltip="Refresh" (click)="refresh()">
            <mat-icon>refresh</mat-icon>
          </button>
        </div>
      </div>

      <!-- Summary Statistics -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <mat-card class="!shadow-sm cursor-pointer hover:!shadow-md transition-shadow" (click)="setFilter('all')">
          <mat-card-content class="p-4 flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <mat-icon class="text-blue-600">list_alt</mat-icon>
            </div>
            <div>
              <p class="text-2xl font-bold text-gray-900">{{ stats().total }}</p>
              <p class="text-sm text-gray-500">Total Chains</p>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm cursor-pointer hover:!shadow-md transition-shadow" (click)="setFilter('pending')">
          <mat-card-content class="p-4 flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
              <mat-icon class="text-yellow-600">hourglass_empty</mat-icon>
            </div>
            <div>
              <p class="text-2xl font-bold text-yellow-600">{{ stats().pending }}</p>
              <p class="text-sm text-gray-500">Pending</p>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm cursor-pointer hover:!shadow-md transition-shadow" (click)="setFilter('approved')">
          <mat-card-content class="p-4 flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <mat-icon class="text-green-600">check_circle</mat-icon>
            </div>
            <div>
              <p class="text-2xl font-bold text-green-600">{{ stats().approved }}</p>
              <p class="text-sm text-gray-500">Approved</p>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm cursor-pointer hover:!shadow-md transition-shadow" (click)="setFilter('rejected')">
          <mat-card-content class="p-4 flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <mat-icon class="text-red-600">cancel</mat-icon>
            </div>
            <div>
              <p class="text-2xl font-bold text-red-600">{{ stats().rejected }}</p>
              <p class="text-sm text-gray-500">Rejected</p>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Error Banner -->
      @if (error$ | async; as error) {
        <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <div class="flex items-center gap-2">
            <mat-icon class="text-red-600">error</mat-icon>
            <span class="text-red-700">{{ error }}</span>
          </div>
          <button mat-icon-button (click)="clearError()">
            <mat-icon class="text-red-400">close</mat-icon>
          </button>
        </div>
      }

      <!-- Filter & Search Bar -->
      <div class="flex flex-col md:flex-row items-start md:items-center gap-4 mb-6">
        <mat-tab-group class="flex-1" [(selectedIndex)]="activeTabIndex" (selectedIndexChange)="onTabChange($event)">
          <mat-tab>
            <ng-template mat-tab-label>
              <span class="flex items-center gap-1">All <span class="ml-1 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{{ stats().total }}</span></span>
            </ng-template>
          </mat-tab>
          <mat-tab>
            <ng-template mat-tab-label>
              <span class="flex items-center gap-1">Pending <span class="ml-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">{{ stats().pending }}</span></span>
            </ng-template>
          </mat-tab>
          <mat-tab>
            <ng-template mat-tab-label>
              <span class="flex items-center gap-1">Approved <span class="ml-1 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{{ stats().approved }}</span></span>
            </ng-template>
          </mat-tab>
          <mat-tab>
            <ng-template mat-tab-label>
              <span class="flex items-center gap-1">Rejected <span class="ml-1 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">{{ stats().rejected }}</span></span>
            </ng-template>
          </mat-tab>
        </mat-tab-group>
        <div class="flex items-center gap-3">
          <mat-form-field class="!w-56" subscriptSizing="dynamic">
            <mat-label>Search by Case ID</mat-label>
            <mat-icon matPrefix class="mr-1">search</mat-icon>
            <input matInput [(ngModel)]="searchTerm" (ngModelChange)="applyFilters()" placeholder="CASE-2026-...">
            @if (searchTerm) {
              <button matSuffix mat-icon-button (click)="searchTerm = ''; applyFilters()">
                <mat-icon>close</mat-icon>
              </button>
            }
          </mat-form-field>
          <button mat-icon-button [matMenuTriggerFor]="sortMenu" matTooltip="Sort">
            <mat-icon>sort</mat-icon>
          </button>
          <mat-menu #sortMenu="matMenu">
            <button mat-menu-item (click)="setSortField('createdAt')">
              <mat-icon>{{ sortField === 'createdAt' ? 'check' : '' }}</mat-icon>
              Date Created
            </button>
            <button mat-menu-item (click)="setSortField('status')">
              <mat-icon>{{ sortField === 'status' ? 'check' : '' }}</mat-icon>
              Status
            </button>
            <button mat-menu-item (click)="setSortField('caseId')">
              <mat-icon>{{ sortField === 'caseId' ? 'check' : '' }}</mat-icon>
              Case ID
            </button>
            <mat-divider></mat-divider>
            <button mat-menu-item (click)="toggleSortDirection()">
              <mat-icon>{{ sortAsc ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
              {{ sortAsc ? 'Ascending' : 'Descending' }}
            </button>
          </mat-menu>
        </div>
      </div>

      <!-- Create Panel -->
      @if (showCreatePanel()) {
        <mat-card class="mb-6 !border-l-4 !border-l-blue-500">
          <mat-card-content class="p-6">
            <div class="flex items-center gap-2 mb-4">
              <mat-icon class="text-blue-600">add_circle</mat-icon>
              <h3 class="text-lg font-semibold">Create Approval Chain</h3>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <mat-form-field>
                <mat-label>Case ID</mat-label>
                <input matInput [(ngModel)]="newCaseId" placeholder="CASE-2026-00001">
              </mat-form-field>
              <mat-form-field>
                <mat-label>Approval Mode</mat-label>
                <mat-select [(ngModel)]="newMode">
                  <mat-option value="sequential">
                    <div class="flex items-center gap-2">
                      <mat-icon class="!text-base">arrow_forward</mat-icon> Sequential
                    </div>
                  </mat-option>
                  <mat-option value="parallel">
                    <div class="flex items-center gap-2">
                      <mat-icon class="!text-base">call_split</mat-icon> Parallel
                    </div>
                  </mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field>
                <mat-label>Approvers (comma-separated IDs)</mat-label>
                <input matInput [(ngModel)]="newApproverIds" placeholder="user-1, user-2">
                <mat-hint>e.g. user-1, user-4</mat-hint>
              </mat-form-field>
              <div class="flex items-center gap-2">
                <button mat-raised-button color="primary" [disabled]="!newCaseId.trim()" (click)="createChain()">
                  <mat-icon>check</mat-icon> Create
                </button>
                <button mat-stroked-button (click)="showCreatePanel.set(false)">Cancel</button>
              </div>
            </div>
            @if (newMode === 'sequential') {
              <p class="text-xs text-gray-500 mt-2">
                <mat-icon class="!text-xs !w-3 !h-3 align-middle">info</mat-icon>
                Sequential: Approvers are notified one at a time in order. Next approver is notified only after the previous one decides.
              </p>
            } @else {
              <p class="text-xs text-gray-500 mt-2">
                <mat-icon class="!text-xs !w-3 !h-3 align-middle">info</mat-icon>
                Parallel: All approvers are notified simultaneously. All must approve for the chain to be approved.
              </p>
            }
          </mat-card-content>
        </mat-card>
      }

      <!-- Loading State -->
      @if (isLoading$ | async) {
        <div class="flex justify-center py-12">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      }

      <!-- Approval Cards -->
      @for (chain of filteredApprovals(); track chain.id) {
        <mat-card class="mb-4 !shadow-sm hover:!shadow-md transition-shadow"
                  [class.!border-l-4]="true"
                  [class.!border-l-yellow-400]="chain.status === 'pending'"
                  [class.!border-l-green-500]="chain.status === 'approved'"
                  [class.!border-l-red-500]="chain.status === 'rejected'"
                  [class.!border-l-blue-400]="chain.status === 'delegated'">
          <mat-card-content class="p-5">
            <!-- Chain Header -->
            <div class="flex items-start justify-between mb-4">
              <div class="flex-1">
                <div class="flex items-center gap-3 flex-wrap">
                  <h3 class="font-semibold text-gray-900">{{ chain.caseId }}</h3>
                  <mat-chip [ngClass]="{
                    '!bg-yellow-100 !text-yellow-800': chain.status === 'pending',
                    '!bg-green-100 !text-green-800': chain.status === 'approved',
                    '!bg-red-100 !text-red-800': chain.status === 'rejected',
                    '!bg-blue-100 !text-blue-800': chain.status === 'delegated'
                  }">
                    <mat-icon class="!text-sm !w-4 !h-4 mr-1">{{ getStatusIcon(chain.status) }}</mat-icon>
                    {{ chain.status | uppercase }}
                  </mat-chip>
                  <mat-chip class="!bg-gray-100 !text-gray-700">
                    <mat-icon class="!text-sm !w-4 !h-4 mr-1">{{ chain.mode === 'sequential' ? 'arrow_forward' : 'call_split' }}</mat-icon>
                    {{ chain.mode | titlecase }}
                  </mat-chip>
                </div>
                <p class="text-sm text-gray-500 mt-1">
                  Chain ID: {{ chain.id }} · Created {{ getRelativeTime(chain.createdAt) }}
                </p>
              </div>
              <div class="flex items-center gap-1">
                @if (chain.status === 'pending') {
                  <button mat-icon-button [matMenuTriggerFor]="chainMenu" matTooltip="Actions">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #chainMenu="matMenu">
                    <button mat-menu-item (click)="openDecisionDialog(chain.id, 'approve')">
                      <mat-icon class="text-green-600">check_circle</mat-icon> Approve
                    </button>
                    <button mat-menu-item (click)="openDecisionDialog(chain.id, 'reject')">
                      <mat-icon class="text-red-600">cancel</mat-icon> Reject
                    </button>
                    <button mat-menu-item (click)="selectedChainId.set(chain.id); decisionAction.set(null)">
                      <mat-icon class="text-blue-600">forward</mat-icon> Delegate
                    </button>
                  </mat-menu>
                }
                <button mat-icon-button matTooltip="Toggle details"
                        (click)="toggleExpand(chain.id)">
                  <mat-icon>{{ expandedChainId() === chain.id ? 'expand_less' : 'expand_more' }}</mat-icon>
                </button>
              </div>
            </div>

            <!-- Approver Timeline -->
            <div class="flex items-center gap-2 flex-wrap">
              @for (approver of chain.approvers; track approver.userId; let i = $index; let last = $last) {
                <div class="flex items-center gap-2 p-3 rounded-lg border min-w-[200px] transition-all"
                     [ngClass]="{
                       'border-green-300 bg-green-50': approver.status === 'approved',
                       'border-red-300 bg-red-50': approver.status === 'rejected',
                       'border-yellow-300 bg-yellow-50': approver.status === 'pending',
                       'border-blue-300 bg-blue-50': approver.status === 'delegated'
                     }">
                  <!-- Avatar circle -->
                  <div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                       [ngClass]="{
                         'bg-green-500': approver.status === 'approved',
                         'bg-red-500': approver.status === 'rejected',
                         'bg-yellow-500': approver.status === 'pending',
                         'bg-blue-500': approver.status === 'delegated'
                       }">
                    {{ getInitials(approver.userName || approver.userId) }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-sm truncate">{{ approver.userName || approver.userId }}</div>
                    <div class="flex items-center gap-1 mt-0.5">
                      <mat-icon class="!text-sm !w-4 !h-4" [ngClass]="{
                        'text-green-600': approver.status === 'approved',
                        'text-red-600': approver.status === 'rejected',
                        'text-yellow-600': approver.status === 'pending',
                        'text-blue-600': approver.status === 'delegated'
                      }">{{ getStatusIcon(approver.status) }}</mat-icon>
                      <span class="text-xs capitalize">{{ approver.status }}</span>
                    </div>
                    @if (approver.comment && expandedChainId() === chain.id) {
                      <p class="text-xs text-gray-500 mt-1 italic truncate" [matTooltip]="approver.comment">"{{ approver.comment }}"</p>
                    }
                    @if (approver.delegatedTo && expandedChainId() === chain.id) {
                      <p class="text-xs text-blue-600 mt-0.5">
                        <mat-icon class="!text-xs !w-3 !h-3 align-middle">forward</mat-icon>
                        → {{ approver.delegatedTo }}
                      </p>
                    }
                    @if (approver.decidedAt) {
                      <p class="text-xs text-gray-400 mt-0.5">{{ getRelativeTime(approver.decidedAt) }}</p>
                    }
                  </div>

                  <!-- Inline Actions for pending approvers -->
                  @if (approver.status === 'pending' && chain.status === 'pending') {
                    <div class="flex flex-col gap-0.5">
                      <button mat-icon-button matTooltip="Approve" class="!text-green-600 !w-8 !h-8"
                              (click)="openDecisionDialog(chain.id, 'approve')">
                        <mat-icon class="!text-xl">check_circle</mat-icon>
                      </button>
                      <button mat-icon-button matTooltip="Reject" class="!text-red-600 !w-8 !h-8"
                              (click)="openDecisionDialog(chain.id, 'reject')">
                        <mat-icon class="!text-xl">cancel</mat-icon>
                      </button>
                    </div>
                  }
                </div>

                @if (!last && chain.mode === 'sequential') {
                  <mat-icon class="text-gray-300 shrink-0">arrow_forward</mat-icon>
                }
                @if (!last && chain.mode === 'parallel') {
                  <mat-icon class="text-gray-300 shrink-0">add</mat-icon>
                }
              }
            </div>

            <!-- Decision Dialog (inline) -->
            @if (decisionAction() && selectedChainId() === chain.id) {
              <div class="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div class="flex items-center gap-2 mb-3">
                  <mat-icon [ngClass]="{
                    'text-green-600': decisionAction() === 'approve',
                    'text-red-600': decisionAction() === 'reject'
                  }">{{ decisionAction() === 'approve' ? 'check_circle' : 'cancel' }}</mat-icon>
                  <h4 class="font-semibold">{{ decisionAction() === 'approve' ? 'Approve' : 'Reject' }} this chain?</h4>
                </div>
                <mat-form-field class="w-full">
                  <mat-label>Decision Comment</mat-label>
                  <textarea matInput [(ngModel)]="decisionComment" rows="2"
                            [placeholder]="decisionAction() === 'approve' ? 'Reason for approval...' : 'Reason for rejection...'"></textarea>
                </mat-form-field>
                <div class="flex items-center gap-2 mt-2">
                  @if (decisionAction() === 'approve') {
                    <button mat-raised-button color="primary" (click)="confirmDecision(chain.id)">
                      <mat-icon>check</mat-icon> Confirm Approval
                    </button>
                  } @else {
                    <button mat-raised-button color="warn" (click)="confirmDecision(chain.id)">
                      <mat-icon>block</mat-icon> Confirm Rejection
                    </button>
                  }
                  <button mat-stroked-button (click)="cancelDecision()">Cancel</button>
                </div>
              </div>
            }

            <!-- Delegation Panel -->
            @if (!decisionAction() && selectedChainId() === chain.id) {
              <div class="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div class="flex items-center gap-2 mb-3">
                  <mat-icon class="text-blue-600">forward</mat-icon>
                  <h4 class="font-semibold">Delegate Approval</h4>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <mat-form-field>
                    <mat-label>Delegate To (User ID)</mat-label>
                    <input matInput [(ngModel)]="delegateToId" placeholder="user-2">
                    <mat-hint>Enter the user ID to delegate to</mat-hint>
                  </mat-form-field>
                  <mat-form-field>
                    <mat-label>Reason for delegation</mat-label>
                    <input matInput [(ngModel)]="delegateComment" placeholder="Delegating because...">
                  </mat-form-field>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  <button mat-raised-button color="primary" [disabled]="!delegateToId.trim()" (click)="delegate(chain.id)">
                    <mat-icon>send</mat-icon> Delegate
                  </button>
                  <button mat-stroked-button (click)="selectedChainId.set(null)">Cancel</button>
                </div>
              </div>
            }

            <!-- Expanded Details & Progress -->
            @if (expandedChainId() === chain.id) {
              <mat-divider class="!my-4"></mat-divider>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <p class="text-xs text-gray-500 uppercase tracking-wider">Chain ID</p>
                  <p class="text-sm font-mono text-gray-700">{{ chain.id }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 uppercase tracking-wider">Created</p>
                  <p class="text-sm text-gray-700">{{ formatDate(chain.createdAt) }}</p>
                </div>
                <div>
                  <p class="text-xs text-gray-500 uppercase tracking-wider">Created By</p>
                  <p class="text-sm text-gray-700">{{ chain.createdBy }}</p>
                </div>
              </div>

              <!-- Approval History Timeline -->
              <div class="mb-4">
                <p class="text-xs text-gray-500 uppercase tracking-wider mb-2">Approval History</p>
                <div class="space-y-2">
                  @for (approver of getDecidedApprovers(chain); track approver.userId) {
                    <div class="flex items-center gap-3 text-sm">
                      <div class="w-2 h-2 rounded-full shrink-0"
                           [ngClass]="{
                             'bg-green-500': approver.status === 'approved',
                             'bg-red-500': approver.status === 'rejected',
                             'bg-blue-500': approver.status === 'delegated'
                           }"></div>
                      <span class="font-medium">{{ approver.userName || approver.userId }}</span>
                      <span class="capitalize" [ngClass]="{
                        'text-green-600': approver.status === 'approved',
                        'text-red-600': approver.status === 'rejected',
                        'text-blue-600': approver.status === 'delegated'
                      }">{{ approver.status }}</span>
                      @if (approver.comment) {
                        <span class="text-gray-400 italic">"{{ approver.comment }}"</span>
                      }
                      @if (approver.decidedAt) {
                        <span class="text-gray-400 ml-auto text-xs">{{ formatDate(approver.decidedAt) }}</span>
                      }
                    </div>
                  }
                  @if (getDecidedApprovers(chain).length === 0) {
                    <p class="text-sm text-gray-400 italic">No decisions recorded yet</p>
                  }
                </div>
              </div>
            }

            <!-- Progress bar (always visible) -->
            <div class="mt-4">
              <div class="flex items-center justify-between mb-1">
                <p class="text-xs text-gray-500">
                  {{ getApprovedCount(chain) }}/{{ chain.approvers.length }} approved
                  @if (getRejectedCount(chain) > 0) {
                    · {{ getRejectedCount(chain) }} rejected
                  }
                  @if (getDelegatedCount(chain) > 0) {
                    · {{ getDelegatedCount(chain) }} delegated
                  }
                </p>
                <p class="text-xs font-medium" [ngClass]="{
                  'text-yellow-600': chain.status === 'pending',
                  'text-green-600': chain.status === 'approved',
                  'text-red-600': chain.status === 'rejected'
                }">{{ getApprovalProgress(chain) | number:'1.0-0' }}%</p>
              </div>
              <mat-progress-bar
                mode="determinate"
                [value]="getApprovalProgress(chain)"
                [color]="chain.status === 'rejected' ? 'warn' : 'primary'"
              ></mat-progress-bar>
            </div>
          </mat-card-content>
        </mat-card>
      }

      <!-- Empty states -->
      @if (!filteredApprovals().length && !(isLoading$ | async)) {
        <div class="text-center py-16">
          <mat-icon class="!text-6xl !w-16 !h-16 text-gray-300 mb-4">verified</mat-icon>
          @if (searchTerm || activeFilter !== 'all') {
            <p class="text-gray-500 text-lg">No matching approval chains found</p>
            <p class="text-gray-400 text-sm mt-1">Try adjusting your filters or search term</p>
            <button mat-stroked-button class="mt-4" (click)="clearFilters()">
              <mat-icon>filter_list_off</mat-icon> Clear Filters
            </button>
          } @else {
            <p class="text-gray-500 text-lg">No approval chains yet</p>
            <p class="text-gray-400 text-sm mt-1">Create your first approval chain to get started</p>
            <button mat-raised-button color="primary" class="mt-4" (click)="showCreatePanel.set(true)">
              <mat-icon>add</mat-icon> Create Approval Chain
            </button>
          }
        </div>
      }
    </div>
  `,
})
export class ApprovalsComponent implements OnInit {
  private allApprovals = signal<ApprovalChain[]>([]);
  approvals$ = this.store.select(selectApprovalsList);
  pendingApprovals$ = this.store.select(selectPendingApprovals);
  isLoading$ = this.store.select(selectApprovalsLoading);
  error$ = this.store.select(selectApprovalsError);

  showCreatePanel = signal(false);
  selectedChainId = signal<string | null>(null);
  expandedChainId = signal<string | null>(null);
  decisionAction = signal<'approve' | 'reject' | null>(null);

  activeFilter: FilterTab = 'all';
  activeTabIndex = 0;
  searchTerm = '';
  sortField: SortField = 'createdAt';
  sortAsc = false;

  newCaseId = '';
  newMode = 'sequential';
  newApproverIds = '';
  decisionComment = '';
  delegateToId = '';
  delegateComment = '';

  stats = computed(() => {
    const list = this.allApprovals();
    return {
      total: list.length,
      pending: list.filter(a => a.status === 'pending').length,
      approved: list.filter(a => a.status === 'approved').length,
      rejected: list.filter(a => a.status === 'rejected').length,
    };
  });

  filteredApprovals = computed(() => {
    let list = this.allApprovals();

    // Status filter
    if (this.activeFilter !== 'all') {
      list = list.filter(a => a.status === this.activeFilter);
    }

    // Search filter
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      list = list.filter(a =>
        a.caseId.toLowerCase().includes(term) ||
        a.id.toLowerCase().includes(term)
      );
    }

    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (this.sortField === 'createdAt') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (this.sortField === 'status') {
        cmp = a.status.localeCompare(b.status);
      } else if (this.sortField === 'caseId') {
        cmp = a.caseId.localeCompare(b.caseId);
      }
      return this.sortAsc ? cmp : -cmp;
    });

    return list;
  });

  constructor(private store: Store, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.store.dispatch(ApprovalsActions.loadApprovals({}));
    this.approvals$.subscribe(list => this.allApprovals.set(list));
  }

  refresh(): void {
    this.store.dispatch(ApprovalsActions.loadApprovals({}));
  }

  clearError(): void {
    this.store.dispatch(ApprovalsActions.clearError());
  }

  // ─── Filters & Sorting ───────────────────────────
  setFilter(filter: FilterTab): void {
    this.activeFilter = filter;
    this.activeTabIndex = ['all', 'pending', 'approved', 'rejected'].indexOf(filter);
    this.applyFilters();
  }

  onTabChange(index: number): void {
    const tabs: FilterTab[] = ['all', 'pending', 'approved', 'rejected'];
    this.activeFilter = tabs[index];
    this.applyFilters();
  }

  applyFilters(): void {
    // Triggers signal recomputation by re-setting the same list
    this.allApprovals.update(v => [...v]);
  }

  setSortField(field: SortField): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = false;
    }
    this.applyFilters();
  }

  toggleSortDirection(): void {
    this.sortAsc = !this.sortAsc;
    this.applyFilters();
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.activeFilter = 'all';
    this.activeTabIndex = 0;
    this.applyFilters();
  }

  // ─── CRUD ─────────────────────────────────────────
  createChain(): void {
    const approverIds = this.newApproverIds
      .split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const approvers = approverIds.map((id, idx) => ({
      userId: id,
      status: 'pending' as ApprovalStatus,
    }));

    this.store.dispatch(ApprovalsActions.createApproval({
      approval: {
        caseId: this.newCaseId,
        mode: this.newMode as any,
        approvers,
      },
    }));
    this.showCreatePanel.set(false);
    this.newCaseId = '';
    this.newApproverIds = '';
    this.snackBar.open('Approval chain created', 'OK', { duration: 3000 });
  }

  openDecisionDialog(chainId: string, action: 'approve' | 'reject'): void {
    this.selectedChainId.set(chainId);
    this.decisionAction.set(action);
    this.decisionComment = '';
  }

  confirmDecision(chainId: string): void {
    if (this.decisionAction() === 'approve') {
      this.store.dispatch(ApprovalsActions.approveChain({
        id: chainId,
        decision: { comment: this.decisionComment || 'Approved' },
      }));
      this.snackBar.open('Approval submitted', 'OK', { duration: 3000 });
    } else {
      this.store.dispatch(ApprovalsActions.rejectChain({
        id: chainId,
        decision: { comment: this.decisionComment || 'Rejected' },
      }));
      this.snackBar.open('Rejection submitted', 'OK', { duration: 3000 });
    }
    this.cancelDecision();
  }

  cancelDecision(): void {
    this.selectedChainId.set(null);
    this.decisionAction.set(null);
    this.decisionComment = '';
  }

  delegate(chainId: string): void {
    if (!this.delegateToId.trim()) return;
    this.store.dispatch(ApprovalsActions.delegateApproval({
      id: chainId,
      delegation: { delegateTo: this.delegateToId, comment: this.delegateComment },
    }));
    this.selectedChainId.set(null);
    this.delegateToId = '';
    this.delegateComment = '';
    this.snackBar.open('Delegation submitted', 'OK', { duration: 3000 });
  }

  toggleExpand(chainId: string): void {
    this.expandedChainId.set(this.expandedChainId() === chainId ? null : chainId);
  }

  // ─── Helpers ──────────────────────────────────────
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

  getRejectedCount(chain: ApprovalChain): number {
    return chain.approvers.filter(a => a.status === 'rejected').length;
  }

  getDelegatedCount(chain: ApprovalChain): number {
    return chain.approvers.filter(a => a.status === 'delegated').length;
  }

  getDecidedApprovers(chain: ApprovalChain) {
    return chain.approvers.filter(a => a.status !== 'pending');
  }

  getInitials(name: string): string {
    return name.split(/[\s-]+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
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

  formatDate(date: string): string {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
