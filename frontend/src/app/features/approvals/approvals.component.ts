import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Store } from '@ngrx/store';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
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
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatMenuModule,
  ],
  template: `
    <div class="space-y-5 animate-fade-in">

      <!-- Page Header -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Approvals</h1>
          <p class="text-sm text-slate-500 mt-0.5">Review, decide, and delegate approval chains across all cases</p>
        </div>
        <div class="flex items-center gap-2">
          <button mat-stroked-button (click)="showCreatePanel.set(!showCreatePanel())">
            <mat-icon>add</mat-icon>
            New Chain
          </button>
          <button mat-raised-button color="primary" (click)="refresh()" [disabled]="isLoading()">
            <mat-icon [class.animate-spin]="isLoading()">refresh</mat-icon>
            Refresh
          </button>
        </div>
      </div>

      <!-- Loading bar -->
      @if (isLoading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <!-- Error Banner -->
      @if (error(); as err) {
        <div class="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <mat-icon class="shrink-0 text-red-500">error_outline</mat-icon>
          <span class="flex-1">{{ err }}</span>
          <button mat-icon-button class="!w-7 !h-7" (click)="clearError()">
            <mat-icon class="!text-base text-red-400">close</mat-icon>
          </button>
        </div>
      }

      <!-- Stats Row -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        @for (s of statCards; track s.filter) {
          <button
            class="bg-white rounded-xl border p-4 text-left transition-all hover:shadow-md"
            [class.ring-2]="activeFilter === s.filter"
            [ngClass]="activeFilter === s.filter ? s.ringClass : 'border-slate-200'"
            (click)="setFilter(s.filter)"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="w-9 h-9 rounded-lg flex items-center justify-center" [ngClass]="s.iconBg">
                <mat-icon class="!text-base !w-4 !h-4" [ngClass]="s.iconColor">{{ s.icon }}</mat-icon>
              </div>
              <span class="text-2xl font-bold" [ngClass]="s.numColor">{{ statCount(s.filter) }}</span>
            </div>
            <p class="text-xs font-medium text-slate-500">{{ s.label }}</p>
          </button>
        }
      </div>

      <!-- Toolbar: tab filters + search + sort -->
      <div class="flex items-center gap-3 flex-wrap">
        <!-- Filter chips -->
        <div class="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden">
          @for (s of statCards; track s.filter; let i = $index) {
            <button
              class="px-3 py-1.5 text-xs font-semibold transition-colors"
              [class.border-l]="i > 0"
              [class.border-slate-200]="i > 0"
              [ngClass]="activeFilter === s.filter ? s.chipActive : 'text-slate-500 hover:bg-slate-50'"
              (click)="setFilter(s.filter)"
            >
              {{ s.label }}
              <span class="ml-1 opacity-70">({{ statCount(s.filter) }})</span>
            </button>
          }
        </div>

        <!-- Search -->
        <div class="relative flex-1 min-w-48">
          <mat-icon class="absolute left-2.5 top-1/2 -translate-y-1/2 !text-base !w-4 !h-4 text-slate-400">search</mat-icon>
          <input
            type="text"
            placeholder="Search by case ID or chain ID…"
            class="w-full pl-8 pr-8 py-1.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-300 transition"
            [value]="searchTerm"
            (input)="searchTerm = $any($event.target).value; applyFilters()"
          />
          @if (searchTerm) {
            <button class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    (click)="searchTerm = ''; applyFilters()">
              <mat-icon class="!text-base !w-4 !h-4">close</mat-icon>
            </button>
          }
        </div>

        <!-- Sort menu -->
        <button mat-icon-button [matMenuTriggerFor]="sortMenu" matTooltip="Sort" class="shrink-0">
          <mat-icon class="text-slate-500">sort</mat-icon>
        </button>
        <mat-menu #sortMenu="matMenu">
          <button mat-menu-item (click)="setSortField('createdAt')">
            <mat-icon>{{ sortField === 'createdAt' ? 'check' : 'calendar_today' }}</mat-icon>
            Date Created
          </button>
          <button mat-menu-item (click)="setSortField('status')">
            <mat-icon>{{ sortField === 'status' ? 'check' : 'flag' }}</mat-icon>
            Status
          </button>
          <button mat-menu-item (click)="setSortField('caseId')">
            <mat-icon>{{ sortField === 'caseId' ? 'check' : 'folder' }}</mat-icon>
            Case ID
          </button>
          <button mat-menu-item (click)="toggleSortDirection()">
            <mat-icon>{{ sortAsc ? 'arrow_upward' : 'arrow_downward' }}</mat-icon>
            {{ sortAsc ? 'Oldest first' : 'Newest first' }}
          </button>
        </mat-menu>

        <span class="text-xs text-slate-400 shrink-0">
          {{ filteredApprovals().length }} chain{{ filteredApprovals().length !== 1 ? 's' : '' }}
        </span>
      </div>

      <!-- Create Panel -->
      @if (showCreatePanel()) {
        <div class="bg-white rounded-xl border border-indigo-200 shadow-sm overflow-hidden">
          <div class="bg-indigo-50 px-5 py-3 border-b border-indigo-100 flex items-center gap-2">
            <mat-icon class="text-indigo-500 text-base">add_circle_outline</mat-icon>
            <span class="text-sm font-semibold text-indigo-800">New Approval Chain</span>
          </div>
          <div class="p-5">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <mat-form-field subscriptSizing="dynamic">
                <mat-label>Case ID</mat-label>
                <input matInput [(ngModel)]="newCaseId" placeholder="CASE-2026-00001">
              </mat-form-field>
              <mat-form-field subscriptSizing="dynamic">
                <mat-label>Mode</mat-label>
                <mat-select [(ngModel)]="newMode">
                  <mat-option value="sequential">Sequential</mat-option>
                  <mat-option value="parallel">Parallel</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field subscriptSizing="dynamic">
                <mat-label>Approver IDs (comma-separated)</mat-label>
                <input matInput [(ngModel)]="newApproverIds" placeholder="user-1, user-2">
              </mat-form-field>
              <div class="flex items-center gap-2">
                <button mat-raised-button color="primary" [disabled]="!newCaseId.trim()" (click)="createChain()">
                  <mat-icon>check</mat-icon> Create
                </button>
                <button mat-stroked-button (click)="showCreatePanel.set(false)">Cancel</button>
              </div>
            </div>
            <p class="text-xs text-slate-400 mt-3 flex items-center gap-1">
              <mat-icon class="!text-xs !w-3 !h-3">info</mat-icon>
              @if (newMode === 'sequential') {
                Sequential — approvers are notified one at a time in order.
              } @else {
                Parallel — all approvers are notified simultaneously; all must approve.
              }
            </p>
          </div>
        </div>
      }

      <!-- Approval Cards -->
      <div class="space-y-3">
        @for (chain of filteredApprovals(); track chain.id) {
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-shadow hover:shadow-md border-l-4"
               [ngClass]="chainBorderClass(chain.status)">

            <!-- Card Header -->
            <div class="px-5 py-4">
              <div class="flex items-start gap-3">

                <!-- Status icon -->
                <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                     [ngClass]="chainIconBg(chain.status)">
                  <mat-icon class="!text-lg !w-5 !h-5" [ngClass]="chainIconColor(chain.status)">
                    {{ getStatusIcon(chain.status) }}
                  </mat-icon>
                </div>

                <!-- Main info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <a [routerLink]="['/portal/cases', chain.caseId]"
                       class="font-semibold text-slate-800 hover:text-indigo-600 transition-colors text-sm">
                      {{ chain.caseId }}
                    </a>
                    <span class="wf-badge" [ngClass]="chainBadgeClass(chain.status)">
                      {{ chain.status }}
                    </span>
                    <span class="wf-badge wf-badge--neutral flex items-center gap-0.5">
                      <mat-icon class="!text-[10px] !w-3 !h-3">{{ chain.mode === 'sequential' ? 'arrow_forward' : 'call_split' }}</mat-icon>
                      {{ chain.mode }}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 mt-1 text-xs text-slate-400 flex-wrap">
                    <span class="font-mono">{{ chain.id }}</span>
                    <span class="text-slate-200">·</span>
                    <span>Created {{ getRelativeTime(chain.createdAt) }}</span>
                    <span class="text-slate-200">·</span>
                    <span>by {{ chain.createdBy }}</span>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-1 shrink-0">
                  @if (chain.status === 'pending') {
                    <button mat-stroked-button class="!text-xs !h-8 !px-3 !text-emerald-700 !border-emerald-300 hover:!bg-emerald-50"
                            (click)="openDecisionDialog(chain.id, 'approve')">
                      <mat-icon class="!text-sm mr-1">thumb_up</mat-icon> Approve
                    </button>
                    <button mat-stroked-button class="!text-xs !h-8 !px-3 !text-red-600 !border-red-300 hover:!bg-red-50"
                            (click)="openDecisionDialog(chain.id, 'reject')">
                      <mat-icon class="!text-sm mr-1">thumb_down</mat-icon> Reject
                    </button>
                    <button mat-icon-button class="!w-8 !h-8" matTooltip="Delegate"
                            (click)="selectedChainId.set(chain.id); decisionAction.set(null)">
                      <mat-icon class="!text-base text-slate-400">forward</mat-icon>
                    </button>
                  }
                  <button mat-icon-button class="!w-8 !h-8" matTooltip="Toggle details"
                          (click)="toggleExpand(chain.id)">
                    <mat-icon class="!text-base text-slate-400">
                      {{ expandedChainId() === chain.id ? 'expand_less' : 'expand_more' }}
                    </mat-icon>
                  </button>
                </div>
              </div>

              <!-- Progress bar -->
              <div class="mt-4">
                <div class="flex items-center justify-between mb-1.5 text-xs text-slate-400">
                  <span>
                    {{ getApprovedCount(chain) }}/{{ chain.approvers.length }} approved
                    @if (getRejectedCount(chain) > 0) { · <span class="text-red-500">{{ getRejectedCount(chain) }} rejected</span> }
                    @if (getDelegatedCount(chain) > 0) { · {{ getDelegatedCount(chain) }} delegated }
                  </span>
                  <span class="font-medium" [ngClass]="chainIconColor(chain.status)">
                    {{ getApprovalProgress(chain) | number:'1.0-0' }}%
                  </span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div class="h-1.5 rounded-full transition-all"
                       [ngClass]="chain.status === 'rejected' ? 'bg-red-500' : chain.status === 'approved' ? 'bg-emerald-500' : 'bg-indigo-500'"
                       [style.width.%]="getApprovalProgress(chain)">
                  </div>
                </div>
              </div>
            </div>

            <!-- Approver Row -->
            <div class="px-5 pb-4">
              <div class="flex items-center gap-2 flex-wrap">
                @for (approver of chain.approvers; track approver.userId; let i = $index; let last = $last) {

                  @if (!last && chain.mode === 'sequential') {
                    <mat-icon class="text-slate-200 shrink-0 !text-base">chevron_right</mat-icon>
                  }
                  @if (!last && chain.mode === 'parallel') {
                    <mat-icon class="text-slate-200 shrink-0 !text-base">add</mat-icon>
                  }

                  <div class="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs shrink-0"
                       [ngClass]="approverRowClass(approver.status)">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                         [ngClass]="approverAvatarBg(approver.status)">
                      {{ getInitials(approver.userName || approver.userId) }}
                    </div>
                    <span class="font-medium text-slate-700">{{ approver.userName || approver.userId }}</span>
                    <mat-icon class="!text-sm !w-3.5 !h-3.5 shrink-0" [ngClass]="chainIconColor(approver.status)">
                      {{ getStatusIcon(approver.status) }}
                    </mat-icon>
                    @if (approver.decidedAt) {
                      <span class="text-slate-400">{{ approver.decidedAt | date:'MMM d' }}</span>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Decision form -->
            @if (decisionAction() && selectedChainId() === chain.id) {
              <div class="mx-5 mb-4 p-4 rounded-xl border"
                   [ngClass]="decisionAction() === 'approve' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'">
                <div class="flex items-center gap-2 mb-3">
                  <mat-icon [ngClass]="decisionAction() === 'approve' ? 'text-emerald-600' : 'text-red-600'">
                    {{ decisionAction() === 'approve' ? 'thumb_up' : 'thumb_down' }}
                  </mat-icon>
                  <h4 class="font-semibold text-sm text-slate-800">
                    {{ decisionAction() === 'approve' ? 'Confirm Approval' : 'Confirm Rejection' }}
                  </h4>
                </div>
                <mat-form-field class="w-full" subscriptSizing="dynamic">
                  <mat-label>Comment (optional)</mat-label>
                  <textarea matInput [(ngModel)]="decisionComment" rows="2"
                            [placeholder]="decisionAction() === 'approve' ? 'Reason for approval…' : 'Reason for rejection…'"></textarea>
                </mat-form-field>
                <div class="flex items-center gap-2 mt-3">
                  <button mat-raised-button
                          [color]="decisionAction() === 'approve' ? 'primary' : 'warn'"
                          class="!text-xs !h-8 !px-4"
                          (click)="confirmDecision(chain.id)">
                    <mat-icon class="!text-sm mr-1">{{ decisionAction() === 'approve' ? 'check' : 'block' }}</mat-icon>
                    {{ decisionAction() === 'approve' ? 'Approve' : 'Reject' }}
                  </button>
                  <button mat-stroked-button class="!text-xs !h-8 !px-3" (click)="cancelDecision()">Cancel</button>
                </div>
              </div>
            }

            <!-- Delegation form -->
            @if (!decisionAction() && selectedChainId() === chain.id) {
              <div class="mx-5 mb-4 p-4 rounded-xl border bg-indigo-50 border-indigo-200">
                <div class="flex items-center gap-2 mb-3">
                  <mat-icon class="text-indigo-600">forward</mat-icon>
                  <h4 class="font-semibold text-sm text-slate-800">Delegate Approval</h4>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <mat-form-field subscriptSizing="dynamic">
                    <mat-label>Delegate to (User ID)</mat-label>
                    <input matInput [(ngModel)]="delegateToId" placeholder="user-2">
                  </mat-form-field>
                  <mat-form-field subscriptSizing="dynamic">
                    <mat-label>Reason</mat-label>
                    <input matInput [(ngModel)]="delegateComment" placeholder="Delegating because…">
                  </mat-form-field>
                </div>
                <div class="flex items-center gap-2 mt-3">
                  <button mat-raised-button color="primary" class="!text-xs !h-8 !px-4"
                          [disabled]="!delegateToId.trim()" (click)="delegate(chain.id)">
                    <mat-icon class="!text-sm mr-1">send</mat-icon> Delegate
                  </button>
                  <button mat-stroked-button class="!text-xs !h-8 !px-3"
                          (click)="selectedChainId.set(null)">Cancel</button>
                </div>
              </div>
            }

            <!-- Expanded history -->
            @if (expandedChainId() === chain.id) {
              <div class="border-t border-slate-100 px-5 py-4">
                <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Decision History</p>
                @if (getDecidedApprovers(chain).length === 0) {
                  <p class="text-xs text-slate-400 italic">No decisions recorded yet.</p>
                } @else {
                  <div class="space-y-2">
                    @for (approver of getDecidedApprovers(chain); track approver.userId) {
                      <div class="flex items-center gap-3 text-xs">
                        <div class="w-1.5 h-1.5 rounded-full shrink-0"
                             [ngClass]="approver.status === 'approved' ? 'bg-emerald-500' : approver.status === 'rejected' ? 'bg-red-500' : 'bg-indigo-400'">
                        </div>
                        <span class="font-medium text-slate-700">{{ approver.userName || approver.userId }}</span>
                        <span [ngClass]="chainIconColor(approver.status)" class="capitalize">{{ approver.status }}</span>
                        @if (approver.comment) {
                          <span class="text-slate-400 italic truncate">"{{ approver.comment }}"</span>
                        }
                        @if (approver.decidedAt) {
                          <span class="text-slate-400 ml-auto shrink-0">{{ formatDate(approver.decidedAt) }}</span>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }

          </div>
        }

        <!-- Empty state -->
        @if (!filteredApprovals().length && !isLoading()) {
          <div class="text-center py-16 text-slate-400">
            <mat-icon class="!text-5xl !w-12 !h-12 mb-3 text-slate-200">verified</mat-icon>
            @if (searchTerm || activeFilter !== 'all') {
              <p class="text-lg font-medium text-slate-500">No matching chains</p>
              <p class="text-sm mt-1">Try adjusting filters or search.</p>
              <button mat-stroked-button class="mt-4" (click)="clearFilters()">Clear Filters</button>
            } @else {
              <p class="text-lg font-medium text-slate-500">No approval chains yet</p>
              <p class="text-sm mt-1">Create one to get started.</p>
              <button mat-raised-button color="primary" class="mt-4" (click)="showCreatePanel.set(true)">
                <mat-icon>add</mat-icon> New Chain
              </button>
            }
          </div>
        }
      </div>

    </div>
  `,
})
export class ApprovalsComponent implements OnInit, OnDestroy {
  private allApprovals = signal<ApprovalChain[]>([]);
  private destroy$ = new Subject<void>();

  isLoading = signal(false);
  error = signal<string | null>(null);

  showCreatePanel = signal(false);
  selectedChainId = signal<string | null>(null);
  expandedChainId = signal<string | null>(null);
  decisionAction = signal<'approve' | 'reject' | null>(null);

  activeFilter: FilterTab = 'all';
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

  readonly statCards = [
    { filter: 'all' as FilterTab, label: 'Total Chains', icon: 'list_alt', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600', numColor: 'text-slate-900', ringClass: 'ring-indigo-400', chipActive: 'bg-indigo-600 text-white' },
    { filter: 'pending' as FilterTab, label: 'Pending', icon: 'hourglass_empty', iconBg: 'bg-amber-100', iconColor: 'text-amber-600', numColor: 'text-amber-600', ringClass: 'ring-amber-400', chipActive: 'bg-amber-500 text-white' },
    { filter: 'approved' as FilterTab, label: 'Approved', icon: 'check_circle', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', numColor: 'text-emerald-600', ringClass: 'ring-emerald-400', chipActive: 'bg-emerald-600 text-white' },
    { filter: 'rejected' as FilterTab, label: 'Rejected', icon: 'cancel', iconBg: 'bg-red-100', iconColor: 'text-red-600', numColor: 'text-red-600', ringClass: 'ring-red-400', chipActive: 'bg-red-600 text-white' },
  ];

  constructor(private store: Store, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.store.dispatch(ApprovalsActions.loadApprovals({}));
    this.store.select(selectApprovalsList)
      .pipe(takeUntil(this.destroy$))
      .subscribe(list => this.allApprovals.set(list));
    this.store.select(selectApprovalsLoading)
      .pipe(takeUntil(this.destroy$))
      .subscribe(v => this.isLoading.set(v));
    this.store.select(selectApprovalsError)
      .pipe(takeUntil(this.destroy$))
      .subscribe(e => this.error.set(e ?? null));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
  // ─── Style Helpers ───────────────────────────────
  statCount(filter: FilterTab): number {
    const s = this.stats();
    return filter === 'all' ? s.total : (s[filter as keyof typeof s] as number);
  }

  chainBorderClass(status: string): string {
    return { pending: '!border-l-amber-400', approved: '!border-l-emerald-500', rejected: '!border-l-red-500', delegated: '!border-l-indigo-400' }[status] || '!border-l-slate-300';
  }

  chainIconBg(status: string): string {
    return { pending: 'bg-amber-100', approved: 'bg-emerald-100', rejected: 'bg-red-100', delegated: 'bg-indigo-100' }[status] || 'bg-slate-100';
  }

  chainIconColor(status: string): string {
    return { pending: 'text-amber-600', approved: 'text-emerald-600', rejected: 'text-red-600', delegated: 'text-indigo-500' }[status] || 'text-slate-400';
  }

  chainBadgeClass(status: string): string {
    return { pending: 'wf-badge--warning', approved: 'wf-badge--success', rejected: 'wf-badge--danger', delegated: 'wf-badge--info' }[status] || 'wf-badge--neutral';
  }

  approverRowClass(status: string): string {
    return { approved: 'border-emerald-200 bg-emerald-50', rejected: 'border-red-200 bg-red-50', pending: 'border-slate-200 bg-slate-50', delegated: 'border-indigo-200 bg-indigo-50' }[status] || 'border-slate-200';
  }

  approverAvatarBg(status: string): string {
    return { approved: 'bg-emerald-500', rejected: 'bg-red-500', pending: 'bg-slate-400', delegated: 'bg-indigo-500' }[status] || 'bg-slate-400';
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