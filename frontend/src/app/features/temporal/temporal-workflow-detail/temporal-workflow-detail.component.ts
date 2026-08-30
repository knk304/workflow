import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TemporalService, WorkflowDetail, HistoryEvent } from '../services/temporal.service';

@Component({
  selector: 'app-temporal-workflow-detail',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule,
  ],
  template: `
    <div class="p-6 space-y-6">

      <!-- Header -->
      <div class="flex items-center gap-3">
        <a mat-icon-button routerLink="/temporal/workflows">
          <mat-icon>arrow_back</mat-icon>
        </a>
        <div class="flex-1 min-w-0">
          <h1 class="text-xl font-bold text-slate-800 truncate font-mono">{{ workflowId }}</h1>
          @if (detail()) {
            <p class="text-xs text-slate-400 mt-0.5">
              {{ detail()!.workflow_type }} &bull; run {{ detail()!.run_id | slice:0:8 }}…
            </p>
          }
        </div>
        @if (detail()) {
          <span class="wf-badge" [ngClass]="statusBadge(detail()!.status)">{{ detail()!.status }}</span>
          <a mat-stroked-button
             [href]="'http://localhost:8088/namespaces/default/workflows/' + workflowId"
             target="_blank" rel="noopener">
            <mat-icon>open_in_new</mat-icon>
            Temporal UI
          </a>
        }
      </div>

      @if (loading()) {
        <div class="flex justify-center py-16"><mat-spinner diameter="36"></mat-spinner></div>
      } @else if (!detail()) {
        <div class="text-center py-16 text-slate-400">
          <mat-icon class="text-5xl">error_outline</mat-icon>
          <p class="mt-2">Workflow not found</p>
        </div>
      } @else {

        <!-- Meta cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          @for (m of meta(); track m.label) {
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <p class="text-xs text-slate-400 uppercase font-semibold">{{ m.label }}</p>
              <p class="text-sm font-medium text-slate-700 mt-1 truncate" [matTooltip]="m.value">{{ m.value }}</p>
            </div>
          }
        </div>

        <!-- Event history timeline -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 class="font-semibold text-slate-700 mb-4">
            Event History
            <span class="text-xs text-slate-400 font-normal ml-2">({{ detail()!.history_length }} total)</span>
          </h2>

          <div class="relative">
            <!-- vertical line -->
            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200"></div>

            <div class="space-y-3">
              @for (event of detail()!.history_events; track event.event_id) {
                <div class="flex items-start gap-4 pl-2">
                  <!-- dot -->
                  <div class="relative z-10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                       [ngClass]="eventDotClass(event)">
                    <mat-icon class="!text-xs !w-3 !h-3">{{ eventIcon(event) }}</mat-icon>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-700">{{ event.event_type }}</p>
                    <p class="text-xs text-slate-400">
                      #{{ event.event_id }}
                      @if (event.event_time) { &bull; {{ event.event_time | date:'medium' }} }
                    </p>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>

      }
    </div>
  `,
})
export class TemporalWorkflowDetailComponent implements OnInit {
  workflowId = '';
  loading = signal(true);
  detail = signal<WorkflowDetail | null>(null);
  meta = signal<{ label: string; value: string }[]>([]);

  constructor(
    private temporalService: TemporalService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.workflowId = this.route.snapshot.paramMap.get('id') ?? '';
    this.temporalService.getWorkflow(this.workflowId).subscribe({
      next: d => {
        this.detail.set(d);
        this.meta.set([
          { label: 'Task Queue',  value: d.task_queue },
          { label: 'Started',     value: d.start_time ? new Date(d.start_time).toLocaleString() : '—' },
          { label: 'Closed',      value: d.close_time ? new Date(d.close_time).toLocaleString() : '—' },
          { label: 'History Len', value: String(d.history_length) },
        ]);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  statusBadge(status: string): string {
    return ({
      running:   'wf-badge--info',
      completed: 'wf-badge--success',
      failed:    'wf-badge--danger',
      cancelled: 'wf-badge--neutral',
      timed_out: 'wf-badge--warning',
    } as Record<string, string>)[status] ?? 'wf-badge--neutral';
  }

  eventDotClass(event: HistoryEvent): string {
    const t = event.event_type.toLowerCase();
    if (t.includes('started'))   return 'bg-indigo-100 text-indigo-600';
    if (t.includes('completed')) return 'bg-emerald-100 text-emerald-600';
    if (t.includes('failed') || t.includes('timed_out')) return 'bg-red-100 text-red-600';
    if (t.includes('signal'))    return 'bg-amber-100 text-amber-600';
    return 'bg-slate-100 text-slate-500';
  }

  eventIcon(event: HistoryEvent): string {
    const t = event.event_type.toLowerCase();
    if (t.includes('started'))   return 'play_arrow';
    if (t.includes('completed')) return 'check';
    if (t.includes('failed') || t.includes('timed_out')) return 'close';
    if (t.includes('signal'))    return 'notifications';
    if (t.includes('activity'))  return 'bolt';
    return 'fiber_manual_record';
  }
}
