import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
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
      <div class="space-y-2.5">
        @if (isLoading()) {
          @for (n of [1,2,3]; track n) {
            <div class="bg-white rounded-xl border border-slate-200 h-20 animate-pulse"></div>
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
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              <div class="flex items-stretch">

                <!-- Priority stripe -->
                <div class="w-1 shrink-0 rounded-l-xl" [ngClass]="priorityColor(a.priority)"></div>

                <div class="flex-1 flex items-center gap-4 px-4 py-3.5 min-w-0">

                  <!-- Type icon -->
                  <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                       [ngClass]="typeIconBg(a.assignmentType)">
                    <mat-icon class="!text-base !w-4 !h-4" [ngClass]="typeIconColor(a.assignmentType)">
                      {{ typeIcon(a.assignmentType) }}
                    </mat-icon>
                  </div>

                  <!-- Main info -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <a [routerLink]="['/portal/cases', a.caseId]"
                         class="font-semibold text-sm text-slate-800 hover:text-indigo-600 transition-colors truncate">
                        {{ a.stepName || a.name }}
                      </a>
                      <!-- status badge -->
                      <span class="wf-badge shrink-0" [ngClass]="statusBadgeClass(a.status)">
                        {{ statusLabel(a.status) }}
                      </span>
                      <!-- priority badge -->
                      <span class="wf-badge shrink-0" [ngClass]="priorityBadgeClass(a.priority)">
                        {{ a.priority }}
                      </span>
                      @if (a.isOverdue) {
                        <span class="wf-badge wf-badge--danger flex items-center gap-0.5 shrink-0">
                          <mat-icon class="!text-[10px] !w-3 !h-3">alarm_off</mat-icon>
                          Overdue
                        </span>
                      }
                    </div>
                    <div class="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                      <a [routerLink]="['/portal/cases', a.caseId]"
                         class="hover:text-indigo-600 transition-colors font-medium truncate">
                        {{ a.caseTitle }}
                      </a>
                      <span class="text-slate-300">·</span>
                      <span class="flex items-center gap-0.5 text-slate-400">
                        <mat-icon class="!text-[10px] !w-3 !h-3">layers</mat-icon>
                        {{ a.stageName }}
                      </span>
                      @if (a.processName) {
                        <span class="text-slate-300">›</span>
                        <span class="text-slate-400">{{ a.processName }}</span>
                      }
                      @if (viewMode() === 'all' && a.assignedToName) {
                        <span class="text-slate-300">·</span>
                        <span class="flex items-center gap-0.5 text-slate-400">
                          <mat-icon class="!text-[10px] !w-3 !h-3">person</mat-icon>
                          {{ a.assignedToName }}
                        </span>
                      }
                    </div>
                  </div>

                  <!-- Due date / SLA -->
                  <div class="text-right shrink-0 hidden sm:block">
                    @if (a.dueAt) {
                      <div class="text-xs font-medium"
                           [ngClass]="a.isOverdue ? 'text-red-600' : 'text-slate-600'">
                        {{ formatDate(a.dueAt) }}
                      </div>
                      <div class="text-[10px] text-slate-400">Due date</div>
                    } @else if (a.slaHours) {
                      <div class="text-xs font-medium text-slate-600">{{ a.slaHours }}h SLA</div>
                      <div class="text-[10px] text-slate-400">Target</div>
                    } @else {
                      <div class="text-xs text-slate-300">—</div>
                    }
                  </div>

                  <!-- Quick actions -->
                  <div class="flex items-center gap-1 shrink-0">
                    @if (a.status === 'open' || a.status === 'in_progress') {
                      <button mat-icon-button matTooltip="Complete" (click)="onComplete(a)">
                        <mat-icon class="text-emerald-500">check_circle_outline</mat-icon>
                      </button>
                      <button mat-icon-button matTooltip="Put on hold" (click)="onHold(a)">
                        <mat-icon class="text-amber-500">pause_circle_outline</mat-icon>
                      </button>
                    }
                    @if (a.status === 'on_hold') {
                      <button mat-icon-button matTooltip="Resume" (click)="onResume(a)">
                        <mat-icon class="text-indigo-500">play_circle_outline</mat-icon>
                      </button>
                    }
                    <a mat-icon-button [routerLink]="['/portal/cases', a.caseId]" matTooltip="Open case">
                      <mat-icon class="text-slate-400">open_in_new</mat-icon>
                    </a>
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

  onComplete(a: Assignment): void {
    this.store.dispatch(AssignmentsActions.completeAssignment({ id: a.id, request: { formData: {} } }));
    this.snackBar.open(`"${a.stepName || a.name}" completed`, 'OK', { duration: 3000 });
  }

  onHold(a: Assignment): void {
    this.store.dispatch(AssignmentsActions.holdAssignment({ id: a.id }));
    this.snackBar.open(`"${a.stepName || a.name}" put on hold`, 'OK', { duration: 2500 });
  }

  onResume(a: Assignment): void {
    this.store.dispatch(AssignmentsActions.resumeAssignment({ id: a.id }));
    this.snackBar.open(`"${a.stepName || a.name}" resumed`, 'OK', { duration: 2500 });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
