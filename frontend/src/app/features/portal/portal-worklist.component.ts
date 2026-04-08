import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Store } from '@ngrx/store';
import { Assignment } from '@core/models';
import { statusLabel } from '@core/utils/status-labels';
import * as AssignmentsActions from '@state/assignments/assignments.actions';
import {
  selectMyAssignments,
  selectAllAssignments,
  selectAssignmentsLoading,
} from '@state/assignments/assignments.selectors';

type ViewMode = 'mine' | 'all';
type StatusFilter = 'all' | 'open' | 'in_progress' | 'on_hold' | 'completed';

@Component({
  selector: 'app-portal-worklist',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    MatDividerModule,
    MatSnackBarModule,
  ],
  template: `
    <div class="space-y-5 animate-fade-in">

      <!-- Header -->
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 tracking-tight">My Work</h1>
          <p class="text-sm text-slate-500 mt-0.5">Assignments queued for action across all active cases</p>
        </div>
        <button mat-raised-button color="primary" (click)="refreshAll()" [disabled]="isLoading()">
          <mat-icon [class.animate-spin]="isLoading()">refresh</mat-icon>
          Refresh
        </button>
      </div>

      <!-- Stat Summary -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        @for (s of statCards; track s.status) {
          <button
            class="bg-white rounded-xl border p-3.5 text-left transition-all hover:shadow-md"
            [class.ring-2]="statusFilter() === s.status"
            [ngClass]="statusFilter() === s.status ? s.ringClass : 'border-slate-200'"
            (click)="setStatus(s.status)"
          >
            <div class="flex items-center justify-between mb-1">
              <mat-icon class="!text-base !w-4 !h-4" [ngClass]="s.iconColor">{{ s.icon }}</mat-icon>
              <span class="text-2xl font-bold" [ngClass]="s.numColor">{{ stat(s.status) }}</span>
            </div>
            <p class="text-xs font-medium text-slate-500">{{ s.label }}</p>
          </button>
        }
      </div>

      <!-- Toolbar: view toggle + search -->
      <div class="flex items-center gap-3 flex-wrap">
        <!-- Mine / All toggle -->
        <div class="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden">
          <button
            class="px-4 py-1.5 text-xs font-semibold transition-colors"
            [class.bg-indigo-600]="viewMode() === 'mine'"
            [class.text-white]="viewMode() === 'mine'"
            [class.text-slate-500]="viewMode() !== 'mine'"
            (click)="viewMode.set('mine')"
          >
            <mat-icon class="!text-sm !w-4 !h-4 mr-1 align-middle">person</mat-icon>
            Mine
          </button>
          <button
            class="px-4 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200"
            [class.bg-indigo-600]="viewMode() === 'all'"
            [class.text-white]="viewMode() === 'all'"
            [class.text-slate-500]="viewMode() !== 'all'"
            (click)="viewMode.set('all')"
          >
            <mat-icon class="!text-sm !w-4 !h-4 mr-1 align-middle">groups</mat-icon>
            All
          </button>
        </div>

        <!-- Search -->
        <div class="flex-1 min-w-48 relative">
          <mat-icon class="absolute left-2.5 top-1/2 -translate-y-1/2 !text-base !w-4 !h-4 text-slate-400">search</mat-icon>
          <input
            type="text"
            placeholder="Search by case, step or assignee…"
            class="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-indigo-300 transition"
            [value]="searchTerm()"
            (input)="searchTerm.set($any($event.target).value)"
          />
        </div>

        <span class="ml-auto text-xs text-slate-400 shrink-0">
          {{ filteredAssignments().length }} item{{ filteredAssignments().length !== 1 ? 's' : '' }}
        </span>
      </div>

      <!-- Status filter chips -->
      <div class="flex items-center gap-2 flex-wrap">
        @for (s of statCards; track s.status) {
          <button
            class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
            [ngClass]="statusFilter() === s.status ? s.chipActive : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-50'"
            (click)="setStatus(s.status)"
          >
            {{ s.label }}
            <span class="ml-1 opacity-70">({{ stat(s.status) }})</span>
          </button>
        }
      </div>

      <!-- Assignment Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        @if (isLoading()) {
          @for (n of [1,2,3,4,5,6]; track n) {
            <div class="bg-white rounded-xl border border-slate-200 h-52 animate-pulse"></div>
          }
        } @else if (filteredAssignments().length === 0) {
          <div class="text-center py-16 text-slate-400">
            <mat-icon class="!text-5xl !w-12 !h-12 mb-3 text-slate-200">inbox</mat-icon>
            <p class="text-lg font-medium text-slate-500">
              {{ searchTerm() ? 'No results found' : 'All caught up!' }}
            </p>
            <p class="text-sm mt-1">
              {{ searchTerm() ? 'Try a different search term.' : 'No assignments matching this filter.' }}
            </p>
            @if (statusFilter() !== 'all') {
              <button mat-stroked-button class="mt-4" (click)="setStatus('all')">Show all</button>
            }
          </div>
        } @else {
          @for (a of filteredAssignments(); track a.id) {
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group flex flex-col">

              <!-- Priority stripe top -->
              <div class="h-1" [ngClass]="priorityColor(a.priority)"></div>

              <div class="p-4 flex flex-col flex-1">
                <!-- Header: type icon + step name + badges -->
                <div class="flex items-start gap-2.5">
                  <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                       [ngClass]="typeIconBg(a.assignmentType)">
                    <mat-icon class="!text-sm !w-4 !h-4" [ngClass]="typeIconColor(a.assignmentType)">
                      {{ typeIcon(a.assignmentType) }}
                    </mat-icon>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="font-semibold text-sm text-slate-800 leading-tight truncate" [matTooltip]="a.stepName || a.name">
                      {{ a.stepName || a.name }}
                    </p>
                    <span class="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                      {{ typeLabel(a.assignmentType) }}
                    </span>
                  </div>
                  <!-- Due date chip -->
                  @if (a.dueAt) {
                    <div class="px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0"
                         [ngClass]="a.isOverdue ? 'bg-red-50 text-red-700' : dueSoonClass(a)">
                      @if (a.isOverdue) { <mat-icon class="!text-[10px] !w-3 !h-3 align-middle">alarm_off</mat-icon> }
                      {{ formatDate(a.dueAt) }}
                    </div>
                  } @else if (a.slaHours) {
                    <div class="px-2 py-0.5 rounded-md bg-slate-50 text-[10px] font-semibold text-slate-500 shrink-0">
                      {{ a.slaHours }}h SLA
                    </div>
                  }
                </div>

                <!-- Badges row -->
                <div class="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span class="wf-badge" [ngClass]="statusBadgeClass(a.status)">
                    {{ statusLabel(a.status) }}
                  </span>
                  <span class="wf-badge" [ngClass]="priorityBadgeClass(a.priority)">
                    {{ a.priority }}
                  </span>
                  @if (a.isOverdue) {
                    <span class="wf-badge wf-badge--danger flex items-center gap-0.5">
                      <mat-icon class="!text-[10px] !w-3 !h-3">warning</mat-icon> Overdue
                    </span>
                  }
                </div>

                <!-- Case info -->
                <div class="mt-2.5 space-y-1">
                  <div class="flex items-center gap-1.5 text-xs">
                    <a [routerLink]="['/portal/cases', a.caseId]"
                       class="font-mono text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded transition-colors shrink-0">
                      {{ a.caseId }}
                    </a>
                    <a [routerLink]="['/portal/cases', a.caseId]"
                       class="text-slate-700 hover:text-indigo-600 font-medium transition-colors truncate">
                      {{ a.caseTitle }}
                    </a>
                  </div>
                  <!-- Breadcrumb -->
                  <div class="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                    <mat-icon class="!text-[11px] !w-3 !h-3 text-slate-300">account_tree</mat-icon>
                    <span class="truncate">{{ a.stageName }}</span>
                    @if (a.processName) {
                      <mat-icon class="!text-[9px] !w-2.5 !h-2.5 text-slate-300">chevron_right</mat-icon>
                      <span class="truncate">{{ a.processName }}</span>
                    }
                  </div>
                </div>

                <!-- Assignment meta -->
                <div class="mt-2 flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                  @if (viewMode() === 'all' && a.assignedToName) {
                    <span class="inline-flex items-center gap-1">
                      <span class="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold">
                        {{ initials(a.assignedToName) }}
                      </span>
                      <span class="font-medium text-slate-600 truncate max-w-[80px]">{{ a.assignedToName }}</span>
                    </span>
                  }
                  @if (a.assignedTeamName) {
                    <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 text-[11px] font-medium truncate max-w-[100px]">
                      <mat-icon class="!text-[10px] !w-3 !h-3">group</mat-icon>
                      {{ a.assignedTeamName }}
                    </span>
                  }
                  @if (a.assignedRole && !a.assignedTeamName) {
                    <span class="inline-flex items-center gap-0.5 text-slate-400 text-[11px]">
                      <mat-icon class="!text-[10px] !w-3 !h-3">badge</mat-icon>
                      {{ a.assignedRole }}
                    </span>
                  }
                  @if (a.instructions) {
                    <span class="text-slate-400 truncate text-[11px]" [matTooltip]="a.instructions">
                      <mat-icon class="!text-[10px] !w-3 !h-3 align-middle">info_outline</mat-icon>
                      {{ truncate(a.instructions, 40) }}
                    </span>
                  }
                </div>

                <!-- Spacer to push action to bottom -->
                <div class="flex-1"></div>

                <mat-divider class="!my-2.5"></mat-divider>

                <!-- Actions row -->
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[10px] text-slate-400">{{ formatDate(a.createdAt) }}</span>
                  <div class="flex items-center gap-1.5">
                    @if (a.assignmentType === 'approval' && (a.status === 'open' || a.status === 'in_progress')) {
                      <button mat-stroked-button class="!h-7 !text-[11px] !px-2.5 text-emerald-600 !border-emerald-300 hover:!bg-emerald-50"
                              matTooltip="Approve" (click)="onApprove(a)">
                        <mat-icon class="!text-sm mr-0.5">check</mat-icon> Approve
                      </button>
                      <button mat-stroked-button class="!h-7 !text-[11px] !px-2.5 text-red-600 !border-red-300 hover:!bg-red-50"
                              matTooltip="Decline" (click)="onDecline(a)">
                        <mat-icon class="!text-sm mr-0.5">close</mat-icon> Decline
                      </button>
                    } @else if (a.status === 'open' || a.status === 'in_progress') {
                      <a mat-raised-button color="primary"
                         class="!h-7 !text-[11px] !px-2.5"
                         [routerLink]="['/portal/cases', a.caseId]"
                         matTooltip="Open case and complete this step">
                        <mat-icon class="!text-sm mr-0.5">open_in_new</mat-icon> Open &amp; Act
                      </a>
                    } @else {
                      <a mat-stroked-button
                         class="!h-7 !text-[11px] !px-2.5"
                         [routerLink]="['/portal/cases', a.caseId]"
                         matTooltip="View case">
                        <mat-icon class="!text-sm mr-0.5">visibility</mat-icon> View
                      </a>
                    }
                  </div>
                </div>
              </div>
            </div>
          }
        }
      </div>

    </div>
  `,
})
export class PortalWorklistComponent implements OnInit, OnDestroy {
  readonly statusLabel = statusLabel;

  viewMode   = signal<ViewMode>('mine');
  statusFilter = signal<StatusFilter>('all');
  searchTerm = signal('');
  isLoading  = signal(false);

  private myAssignments  = signal<Assignment[]>([]);
  private allAssignments = signal<Assignment[]>([]);
  private destroy$ = new Subject<void>();

  readonly statCards = [
    { status: 'all'        as StatusFilter, label: 'All',         icon: 'list',          iconColor: 'text-slate-500',   numColor: 'text-slate-800',   ringClass: 'ring-slate-300',   chipActive: 'border-slate-500 text-slate-700 bg-slate-50' },
    { status: 'open'       as StatusFilter, label: 'Open',        icon: 'radio_button_unchecked', iconColor: 'text-indigo-500', numColor: 'text-indigo-700', ringClass: 'ring-indigo-300', chipActive: 'border-indigo-500 text-indigo-700 bg-indigo-50' },
    { status: 'in_progress'as StatusFilter, label: 'In Progress', icon: 'autorenew',     iconColor: 'text-amber-500',   numColor: 'text-amber-700',   ringClass: 'ring-amber-300',   chipActive: 'border-amber-500 text-amber-700 bg-amber-50' },
    { status: 'on_hold'    as StatusFilter, label: 'On Hold',     icon: 'pause_circle',  iconColor: 'text-slate-400',   numColor: 'text-slate-600',   ringClass: 'ring-slate-300',   chipActive: 'border-slate-400 text-slate-600 bg-slate-50' },
    { status: 'completed'  as StatusFilter, label: 'Completed',   icon: 'check_circle',  iconColor: 'text-emerald-500', numColor: 'text-emerald-700', ringClass: 'ring-emerald-300', chipActive: 'border-emerald-500 text-emerald-700 bg-emerald-50' },
  ];

  filteredAssignments = computed<Assignment[]>(() => {
    const source = this.viewMode() === 'mine' ? this.myAssignments() : this.allAssignments();
    const sf = this.statusFilter();
    const term = this.searchTerm().toLowerCase();

    return source.filter(a => {
      if (sf !== 'all' && a.status !== sf) return false;
      if (term) {
        const searchable = `${a.stepName} ${a.name} ${a.caseTitle} ${a.assignedToName ?? ''} ${a.caseId}`.toLowerCase();
        if (!searchable.includes(term)) return false;
      }
      return true;
    });
  });

  stat(status: StatusFilter): number {
    const source = this.viewMode() === 'mine' ? this.myAssignments() : this.allAssignments();
    if (status === 'all') return source.length;
    return source.filter(a => a.status === status).length;
  }

  constructor(private store: Store, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.store.select(selectAssignmentsLoading).pipe(takeUntil(this.destroy$)).subscribe(l => this.isLoading.set(l));
    this.store.select(selectMyAssignments).pipe(takeUntil(this.destroy$)).subscribe(a => this.myAssignments.set(a));
    this.store.select(selectAllAssignments).pipe(takeUntil(this.destroy$)).subscribe(a => this.allAssignments.set(a));
    this.refreshAll();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refreshAll(): void {
    this.store.dispatch(AssignmentsActions.loadMyAssignments());
    this.store.dispatch(AssignmentsActions.loadAssignments({}));
  }

  setStatus(s: StatusFilter): void {
    this.statusFilter.set(s);
  }

  onApprove(a: Assignment): void {
    this.store.dispatch(AssignmentsActions.completeAssignment({ id: a.id, request: { decision: 'approved' } }));
    this.snackBar.open(`"${a.stepName || a.name}" approved`, 'OK', { duration: 3000 });
  }

  onDecline(a: Assignment): void {
    this.store.dispatch(AssignmentsActions.completeAssignment({ id: a.id, request: { decision: 'rejected' } }));
    this.snackBar.open(`"${a.stepName || a.name}" declined`, 'OK', { duration: 3000 });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  truncate(text: string, max: number): string {
    return text.length > max ? text.substring(0, max) + '…' : text;
  }

  initials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 2);
  }

  dueSoonClass(a: Assignment): string {
    if (!a.dueAt) return 'bg-slate-50 text-slate-600';
    const hours = (new Date(a.dueAt).getTime() - Date.now()) / 3600000;
    if (hours < 24) return 'bg-amber-50 text-amber-700';
    return 'bg-slate-50 text-slate-600';
  }

  typeLabel(t: string): string {
    return { assignment: 'Task', approval: 'Approval', attachment: 'Attachment', decision: 'Decision', automation: 'Automation', subprocess: 'Sub-process' }[t] ?? 'Step';
  }

  priorityColor(p: string): string {
    return { critical: 'bg-red-500', high: 'bg-orange-400', medium: 'bg-amber-400', low: 'bg-emerald-400' }[p] ?? 'bg-slate-300';
  }

  priorityBadgeClass(p: string): string {
    return { critical: 'wf-badge--danger', high: 'wf-badge--warning', medium: 'wf-badge--warning', low: 'wf-badge--success' }[p] ?? 'wf-badge--neutral';
  }

  statusBadgeClass(s: string): string {
    return { open: 'wf-badge--info', in_progress: 'wf-badge--warning', completed: 'wf-badge--success', on_hold: 'wf-badge--neutral' }[s] ?? 'wf-badge--neutral';
  }

  typeIcon(t: string): string {
    return { assignment: 'edit_note', approval: 'how_to_reg', attachment: 'attach_file', decision: 'alt_route', automation: 'bolt', subprocess: 'account_tree' }[t] ?? 'task_alt';
  }

  typeIconBg(t: string): string {
    return { assignment: 'bg-indigo-50', approval: 'bg-emerald-50', attachment: 'bg-slate-100', decision: 'bg-purple-50', automation: 'bg-amber-50', subprocess: 'bg-cyan-50' }[t] ?? 'bg-slate-100';
  }

  typeIconColor(t: string): string {
    return { assignment: 'text-indigo-600', approval: 'text-emerald-600', attachment: 'text-slate-500', decision: 'text-purple-600', automation: 'text-amber-600', subprocess: 'text-cyan-600' }[t] ?? 'text-slate-500';
  }
}
