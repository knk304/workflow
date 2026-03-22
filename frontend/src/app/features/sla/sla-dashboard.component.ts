import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { SLADashboard, SLACaseInfo, SLARisk, SLADefinition } from '../../core/models';
import { DataService } from '../../core/services/data.service';

type RiskFilter = 'all' | SLARisk;

@Component({
  selector: 'app-sla-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatDividerModule,
    MatBadgeModule,
  ],
  template: `
    <div class="space-y-6 animate-fade-in">

      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-900 tracking-tight">SLA Dashboard</h1>
          <p class="text-sm text-slate-500 mt-0.5">Monitor case SLA compliance and escalations across all active cases</p>
        </div>
        <div class="flex items-center gap-2">
          <button mat-stroked-button (click)="toggleDefinitions()">
            <mat-icon>rule</mat-icon>
            {{ showDefinitions() ? 'Hide' : 'Show' }} SLA Rules
          </button>
          <button mat-raised-button color="primary" (click)="refresh()" [disabled]="loading()">
            <mat-icon [class.animate-spin]="loading()">refresh</mat-icon>
            Refresh
          </button>
        </div>
      </div>

      <!-- Loading state -->
      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <!-- SLA Definitions Panel -->
      @if (showDefinitions() && definitions().length > 0) {
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center gap-2">
            <mat-icon class="text-slate-500 text-base">rule</mat-icon>
            <span class="text-sm font-semibold text-slate-700 uppercase tracking-wider">SLA Definitions</span>
            <span class="ml-auto text-xs text-slate-400">{{ definitions().length }} rule{{ definitions().length !== 1 ? 's' : '' }}</span>
          </div>
          <div class="divide-y divide-slate-100">
            @for (def of definitions(); track def.id) {
              <div class="flex items-center gap-4 px-5 py-3">
                <mat-icon class="text-indigo-500 shrink-0">timer</mat-icon>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-slate-800">
                    Stage: <span class="font-semibold capitalize">{{ def.stage }}</span>
                  </div>
                  <div class="text-xs text-slate-500 truncate">Case Type ID: {{ def.caseTypeId }}</div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-sm font-semibold text-slate-800">{{ def.hoursTarget }}h target</div>
                  @if (def.escalationEnabled) {
                    <div class="text-xs text-amber-600 flex items-center justify-end gap-0.5">
                      <mat-icon class="text-xs !w-3.5 !h-3.5">arrow_upward</mat-icon>
                      Escalate to {{ def.escalateToRole }}
                    </div>
                  } @else {
                    <div class="text-xs text-slate-400">No escalation</div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Summary Cards -->
      @if (dashboard()) {
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <!-- Total -->
          <button
            class="bg-white rounded-xl border p-4 text-center transition-all hover:shadow-md cursor-pointer"
            [class.border-indigo-400]="riskFilter() === 'all'"
            [class.border-slate-200]="riskFilter() !== 'all'"
            [class.ring-2]="riskFilter() === 'all'"
            [class.ring-indigo-200]="riskFilter() === 'all'"
            (click)="setFilter('all')"
          >
            <div class="text-3xl font-bold text-slate-800">{{ dashboard()!.summary.total }}</div>
            <div class="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">Total</div>
          </button>
          <!-- Critical -->
          <button
            class="bg-white rounded-xl border-l-4 border border-red-500 p-4 text-center transition-all hover:shadow-md cursor-pointer"
            [class.ring-2]="riskFilter() === 'critical'"
            [class.ring-red-200]="riskFilter() === 'critical'"
            (click)="setFilter('critical')"
          >
            <div class="text-3xl font-bold text-red-600">{{ dashboard()!.summary.critical }}</div>
            <div class="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">Critical</div>
            <div class="text-xs text-red-400 mt-0.5">≥ 125%</div>
          </button>
          <!-- Breached -->
          <button
            class="bg-white rounded-xl border-l-4 border border-orange-400 p-4 text-center transition-all hover:shadow-md cursor-pointer"
            [class.ring-2]="riskFilter() === 'breached'"
            [class.ring-orange-200]="riskFilter() === 'breached'"
            (click)="setFilter('breached')"
          >
            <div class="text-3xl font-bold text-orange-500">{{ dashboard()!.summary.breached }}</div>
            <div class="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">Breached</div>
            <div class="text-xs text-orange-400 mt-0.5">≥ 100%</div>
          </button>
          <!-- Warning -->
          <button
            class="bg-white rounded-xl border-l-4 border border-amber-400 p-4 text-center transition-all hover:shadow-md cursor-pointer"
            [class.ring-2]="riskFilter() === 'warning'"
            [class.ring-amber-200]="riskFilter() === 'warning'"
            (click)="setFilter('warning')"
          >
            <div class="text-3xl font-bold text-amber-500">{{ dashboard()!.summary.warning }}</div>
            <div class="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">Warning</div>
            <div class="text-xs text-amber-400 mt-0.5">≥ 75%</div>
          </button>
          <!-- On Track -->
          <button
            class="bg-white rounded-xl border-l-4 border border-emerald-400 p-4 text-center transition-all hover:shadow-md cursor-pointer"
            [class.ring-2]="riskFilter() === 'normal'"
            [class.ring-emerald-200]="riskFilter() === 'normal'"
            (click)="setFilter('normal')"
          >
            <div class="text-3xl font-bold text-emerald-600">{{ dashboard()!.summary.normal }}</div>
            <div class="text-xs text-slate-500 mt-1 font-medium uppercase tracking-wider">On Track</div>
            <div class="text-xs text-emerald-500 mt-0.5">< 75%</div>
          </button>
        </div>

        <!-- Compliance Rate -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4 flex items-center gap-4">
          <mat-icon class="text-indigo-500 shrink-0">insights</mat-icon>
          <div class="flex-1">
            <div class="flex items-center justify-between mb-1.5">
              <span class="text-sm font-semibold text-slate-700">Compliance Rate</span>
              <span class="text-sm font-bold" [ngClass]="complianceRateColor()">{{ complianceRate() }}%</span>
            </div>
            <mat-progress-bar
              mode="determinate"
              [value]="complianceRate()"
              [color]="complianceRate() >= 80 ? 'primary' : 'warn'"
            ></mat-progress-bar>
          </div>
          <div class="text-xs text-slate-400 shrink-0 text-right">
            {{ dashboard()!.summary.normal }} / {{ dashboard()!.summary.total }} on track
          </div>
        </div>
      }

      <!-- Filter bar -->
      @if (dashboard() && dashboard()!.cases.length > 0) {
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filter:</span>
          @for (f of riskFilters; track f.value) {
            <button
              class="px-3 py-1 rounded-full text-xs font-semibold border transition-all"
              [ngClass]="riskFilter() === f.value ? f.activeClass : 'border-slate-200 text-slate-500 bg-white hover:bg-slate-50'"
              (click)="setFilter(f.value)"
            >
              {{ f.label }}
              @if (f.value !== 'all' && dashboard()) {
                ({{ riskCount(f.value) }})
              }
            </button>
          }
          <span class="ml-auto text-xs text-slate-400">
            Showing {{ filteredCases().length }} of {{ dashboard()!.cases.length }} case{{ dashboard()!.cases.length !== 1 ? 's' : '' }}
          </span>
        </div>
      }

      <!-- Case List -->
      <div class="space-y-3">
        @for (slaCase of filteredCases(); track slaCase.id) {
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-shadow hover:shadow-md border-l-4"
               [ngClass]="riskBorderClass(slaCase.risk)">
            <div class="p-4">
              <div class="flex items-center gap-4">
                <!-- Risk % circle -->
                <div class="w-12 h-12 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                     [ngClass]="riskBgClass(slaCase.risk)">
                  {{ Math.round(slaCase.percentageElapsed) }}%
                </div>

                <!-- Case Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <a [routerLink]="['/portal/cases', slaCase.id]"
                       class="font-semibold text-slate-800 hover:text-indigo-600 transition-colors">
                      {{ slaCase.id }}
                    </a>
                    <span class="wf-badge" [ngClass]="riskBadgeClass(slaCase.risk)">
                      {{ slaCase.risk }}
                    </span>
                    @if (slaCase.escalated) {
                      <span class="wf-badge wf-badge--danger flex items-center gap-0.5">
                        <mat-icon class="!text-xs !w-3.5 !h-3.5">warning</mat-icon>
                        Escalated L{{ slaCase.escalationLevel }}
                      </span>
                    }
                    <span class="wf-badge wf-badge--neutral capitalize">{{ slaCase.priority }}</span>
                  </div>
                  <div class="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                    <span class="flex items-center gap-0.5">
                      <mat-icon class="!text-xs !w-3.5 !h-3.5">category</mat-icon>
                      {{ slaCase.type | titlecase }}
                    </span>
                    <span class="text-slate-300">·</span>
                    <span class="flex items-center gap-0.5">
                      <mat-icon class="!text-xs !w-3.5 !h-3.5">layers</mat-icon>
                      Stage: <span class="font-medium text-slate-700 ml-0.5 capitalize">{{ slaCase.stage }}</span>
                    </span>
                  </div>
                </div>

                <!-- Time remaining -->
                <div class="text-right shrink-0">
                  <div class="font-semibold text-sm"
                       [ngClass]="{
                         'text-red-600': slaCase.remainingHours <= 0,
                         'text-orange-500': slaCase.remainingHours > 0 && slaCase.remainingHours < 24,
                         'text-amber-600': slaCase.remainingHours >= 24 && slaCase.risk === 'warning',
                         'text-slate-700': slaCase.remainingHours >= 24 && slaCase.risk === 'normal'
                       }">
                    @if (slaCase.remainingHours <= 0) {
                      <mat-icon class="!text-sm !w-4 !h-4 align-middle mr-0.5">alarm_off</mat-icon>
                      Overdue {{ Math.abs(Math.round(slaCase.remainingHours)) }}h
                    } @else {
                      <mat-icon class="!text-sm !w-4 !h-4 align-middle mr-0.5">schedule</mat-icon>
                      {{ Math.round(slaCase.remainingHours) }}h left
                    }
                  </div>
                  <div class="text-xs text-slate-400 mt-0.5">Due {{ formatDate(slaCase.slaTarget) }}</div>
                </div>

                <!-- Acknowledge action -->
                <button mat-icon-button
                        matTooltip="Acknowledge SLA"
                        class="shrink-0"
                        (click)="acknowledge(slaCase.id)">
                  <mat-icon class="text-slate-400 hover:text-indigo-600">done_all</mat-icon>
                </button>
              </div>

              <!-- Progress bar -->
              <div class="mt-3">
                <div class="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>SLA elapsed</span>
                  <span>{{ slaCase.percentageElapsed }}%</span>
                </div>
                <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div class="h-1.5 rounded-full transition-all"
                       [ngClass]="riskProgressClass(slaCase.risk)"
                       [style.width.%]="Math.min(slaCase.percentageElapsed, 100)">
                  </div>
                </div>
              </div>
            </div>
          </div>
        }

        @if (filteredCases().length === 0) {
          <div class="text-center py-16 text-slate-400">
            @if (riskFilter() !== 'all') {
              <mat-icon class="!text-5xl !w-12 !h-12 mb-3 text-slate-200">filter_alt</mat-icon>
              <p class="text-lg font-medium text-slate-500">No {{ riskFilter() }} cases</p>
              <p class="text-sm mt-1">There are no cases matching this risk level right now.</p>
              <button mat-stroked-button class="mt-4" (click)="setFilter('all')">Show all cases</button>
            } @else {
              <mat-icon class="!text-5xl !w-12 !h-12 mb-3 text-slate-200">timer</mat-icon>
              <p class="text-lg font-medium text-slate-500">No SLA data available</p>
              <p class="text-sm mt-1">Cases with active SLA targets will appear here.</p>
            }
          </div>
        }
      </div>

    </div>
  `,
})
export class SLADashboardComponent implements OnInit, OnDestroy {
  dashboard = signal<SLADashboard | null>(null);
  definitions = signal<SLADefinition[]>([]);
  loading = signal(false);
  showDefinitions = signal(false);
  riskFilter = signal<RiskFilter>('all');

  readonly Math = Math;

  readonly riskFilters: { value: RiskFilter; label: string; activeClass: string }[] = [
    { value: 'all',      label: 'All',      activeClass: 'border-indigo-500 text-indigo-700 bg-indigo-50' },
    { value: 'critical', label: 'Critical', activeClass: 'border-red-500 text-red-700 bg-red-50' },
    { value: 'breached', label: 'Breached', activeClass: 'border-orange-500 text-orange-700 bg-orange-50' },
    { value: 'warning',  label: 'Warning',  activeClass: 'border-amber-500 text-amber-700 bg-amber-50' },
    { value: 'normal',   label: 'On Track', activeClass: 'border-emerald-500 text-emerald-700 bg-emerald-50' },
  ];

  filteredCases = computed<SLACaseInfo[]>(() => {
    const d = this.dashboard();
    if (!d) return [];
    const f = this.riskFilter();
    return f === 'all' ? d.cases : d.cases.filter(c => c.risk === f);
  });

  complianceRate = computed<number>(() => {
    const d = this.dashboard();
    if (!d || d.summary.total === 0) return 100;
    return Math.round((d.summary.normal / d.summary.total) * 100);
  });

  complianceRateColor = computed<string>(() => {
    const r = this.complianceRate();
    if (r >= 80) return 'text-emerald-600';
    if (r >= 60) return 'text-amber-600';
    return 'text-red-600';
  });

  private destroy$ = new Subject<void>();

  constructor(
    private dataService: DataService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.refresh();
    this.dataService.getSLADefinitions().pipe(takeUntil(this.destroy$)).subscribe(defs => {
      this.definitions.set(defs);
    });
    // Auto-refresh every 2 minutes
    interval(120_000).pipe(takeUntil(this.destroy$)).subscribe(() => this.refresh());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  refresh(): void {
    this.loading.set(true);
    this.dataService.getSLADashboard().pipe(takeUntil(this.destroy$)).subscribe({
      next: data => {
        this.dashboard.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load SLA data', 'Dismiss', { duration: 3000 });
      },
    });
  }

  setFilter(f: RiskFilter): void {
    this.riskFilter.set(f);
  }

  toggleDefinitions(): void {
    this.showDefinitions.update(v => !v);
  }

  acknowledge(caseId: string): void {
    this.dataService.acknowledgeSLA(caseId).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.snackBar.open('SLA acknowledged', 'OK', { duration: 2000 });
        this.refresh();
      },
      error: () => this.snackBar.open('Failed to acknowledge SLA', 'Dismiss', { duration: 3000 }),
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  riskBorderClass(risk: SLARisk): string {
    return {
      critical: 'border-l-red-600',
      breached: 'border-l-orange-500',
      warning:  'border-l-amber-400',
      normal:   'border-l-emerald-500',
    }[risk] ?? 'border-l-slate-200';
  }

  riskBgClass(risk: SLARisk): string {
    return {
      critical: 'bg-red-600',
      breached: 'bg-orange-500',
      warning:  'bg-amber-400',
      normal:   'bg-emerald-500',
    }[risk] ?? 'bg-slate-400';
  }

  riskBadgeClass(risk: SLARisk): string {
    return {
      critical: 'wf-badge--danger',
      breached: 'wf-badge--warning',
      warning:  'wf-badge--warning',
      normal:   'wf-badge--success',
    }[risk] ?? 'wf-badge--neutral';
  }

  riskProgressClass(risk: SLARisk): string {
    return {
      critical: 'bg-red-600',
      breached: 'bg-orange-500',
      warning:  'bg-amber-400',
      normal:   'bg-indigo-500',
    }[risk] ?? 'bg-slate-400';
  }

  riskCount(risk: RiskFilter): number {
    const d = this.dashboard();
    if (!d || risk === 'all') return d?.summary.total ?? 0;
    return d.summary[risk as keyof typeof d.summary] as number;
  }
}
