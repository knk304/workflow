import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { TemporalService, TemporalHealth, WorkflowListResponse, WorkerInfo } from '../services/temporal.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-temporal-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatIconModule, MatButtonModule,
    MatProgressSpinnerModule, MatChipsModule,
  ],
  template: `
    <div class="p-6 space-y-6">

      <!-- Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-slate-800">Temporal Workflows</h1>
          <p class="text-slate-500 text-sm mt-0.5">Durable execution monitor</p>
        </div>
        <div class="flex gap-2">
          <a mat-stroked-button href="http://localhost:8088" target="_blank" rel="noopener">
            <mat-icon>open_in_new</mat-icon>
            Open Temporal UI
          </a>
          <button mat-flat-button color="primary" (click)="load()">
            <mat-icon>refresh</mat-icon>
            Refresh
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-16">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else {

        <!-- Health Card -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div class="flex items-center gap-3 mb-1">
              <mat-icon [class]="health()?.status === 'ok' ? 'text-emerald-500' : 'text-red-500'">
                {{ health()?.status === 'ok' ? 'check_circle' : 'error' }}
              </mat-icon>
              <span class="font-semibold text-slate-700">Cluster</span>
            </div>
            <p class="text-2xl font-bold mt-2" [class]="health()?.status === 'ok' ? 'text-emerald-600' : 'text-red-600'">
              {{ health()?.status === 'ok' ? 'Healthy' : 'Unavailable' }}
            </p>
            <p class="text-xs text-slate-400 mt-1">Namespace: {{ health()?.namespace ?? '—' }}</p>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div class="flex items-center gap-3 mb-1">
              <mat-icon class="text-indigo-500">schema</mat-icon>
              <span class="font-semibold text-slate-700">Running</span>
            </div>
            <p class="text-2xl font-bold mt-2 text-indigo-600">{{ runningCount() }}</p>
            <p class="text-xs text-slate-400 mt-1">Active workflow executions</p>
          </div>

          <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div class="flex items-center gap-3 mb-1">
              <mat-icon [class]="workerCount() > 0 ? 'text-emerald-500' : 'text-amber-500'">
                memory
              </mat-icon>
              <span class="font-semibold text-slate-700">Workers</span>
            </div>
            <p class="text-2xl font-bold mt-2" [class]="workerCount() > 0 ? 'text-emerald-600' : 'text-amber-600'">
              {{ workerCount() }}
            </p>
            <p class="text-xs text-slate-400 mt-1">Active pollers on {{ workers()?.task_queue }}</p>
          </div>
        </div>

        <!-- Status breakdown -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold text-slate-700">Recent Workflows</h2>
            <a mat-button routerLink="workflows" color="primary">View all</a>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            @for (item of statusSummary(); track item.label) {
              <a [routerLink]="['workflows']" [queryParams]="{ status: item.key }"
                 class="rounded-lg border p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer no-underline">
                <p class="text-2xl font-bold" [ngClass]="item.color">{{ item.count }}</p>
                <p class="text-xs text-slate-500 mt-1">{{ item.label }}</p>
              </a>
            }
          </div>
        </div>

      }
    </div>
  `,
})
export class TemporalDashboardComponent implements OnInit {
  loading = signal(true);
  health = signal<TemporalHealth | null>(null);
  workflows = signal<WorkflowListResponse | null>(null);
  workers = signal<WorkerInfo | null>(null);

  runningCount = signal(0);
  workerCount = signal(0);
  statusSummary = signal<{ key: string; label: string; count: number; color: string }[]>([]);

  constructor(private temporalService: TemporalService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({
      health: this.temporalService.getHealth(),
      running: this.temporalService.listWorkflows('running', 100),
      completed: this.temporalService.listWorkflows('completed', 100),
      failed: this.temporalService.listWorkflows('failed', 100),
      timedOut: this.temporalService.listWorkflows('timed_out', 100),
      workers: this.temporalService.getWorkers(),
    }).subscribe({
      next: ({ health, running, completed, failed, timedOut, workers }) => {
        this.health.set(health);
        this.workers.set(workers);
        this.workerCount.set(workers.pollers?.length ?? 0);
        this.runningCount.set(running.count);
        this.statusSummary.set([
          { key: 'running',   label: 'Running',   count: running.count,   color: 'text-indigo-600' },
          { key: 'completed', label: 'Completed', count: completed.count, color: 'text-emerald-600' },
          { key: 'failed',    label: 'Failed',    count: failed.count,    color: 'text-red-600' },
          { key: 'timed_out', label: 'Timed Out', count: timedOut.count,  color: 'text-amber-600' },
        ]);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
