import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiService, CaseSummary } from '../../../core/services/ai.service';

@Component({
  selector: 'app-ai-summary-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <div>
      <!-- Header -->
      <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-sky-500 flex items-center justify-center shadow-sm shadow-primary-500/20">
                <mat-icon class="!text-sm text-white">auto_awesome</mat-icon>
              </div>
              <div>
                <h4 class="text-[13px] font-semibold text-slate-800 leading-tight">Case Summary</h4>
                @if (summary()) {
                  <span class="text-[10px] text-slate-400 leading-tight">via {{ summary()!.generated_by }}</span>
                }
              </div>
            </div>
          <button mat-icon-button
                  class="!w-7 !h-7"
                  [matTooltip]="summary() ? 'Refresh summary' : 'Generate summary'"
                  (click)="generateSummary()"
                  [disabled]="loading()">
            <mat-icon class="!text-[18px] text-slate-400 hover:text-primary-500 transition-colors"
                      [class.animate-spin]="loading()">
              {{ loading() ? 'sync' : 'refresh' }}
            </mat-icon>
          </button>
      </div>

      <!-- Content -->
      <div>
          @if (loading()) {
            <div class="flex flex-col items-center justify-center py-8 gap-3">
              <div class="relative">
                <div class="w-10 h-10 rounded-full border-2 border-primary-100 border-t-primary-500 animate-spin"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                  <mat-icon class="!text-sm text-primary-400">auto_awesome</mat-icon>
                </div>
              </div>
              <div class="text-center">
                <p class="text-xs font-medium text-slate-500">Analyzing case data...</p>
                <p class="text-[10px] text-slate-400 mt-0.5">Reviewing stages, steps & history</p>
              </div>
            </div>
          } @else if (error()) {
            <div class="text-center py-5">
              <div class="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-2.5">
                <mat-icon class="!text-xl text-amber-400">warning_amber</mat-icon>
              </div>
              <p class="text-xs text-slate-500 mb-3 max-w-[200px] mx-auto leading-relaxed">{{ error() }}</p>
              <button class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 transition-colors border border-primary-100"
                      (click)="generateSummary()">
                <mat-icon class="!text-sm">refresh</mat-icon>
                Try Again
              </button>
            </div>
          } @else if (summary()) {
            <!-- Summary Text -->
            <p class="text-[13px] text-slate-600 leading-relaxed mb-4">{{ summary()!.summary }}</p>

            <!-- Key Decisions -->
            @if (summary()!.key_decisions.length > 0) {
              <div class="mb-3">
                <div class="flex items-center gap-1.5 mb-2">
                  <div class="w-1 h-3.5 rounded-full bg-emerald-400"></div>
                  <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Key Decisions</p>
                </div>
                <div class="space-y-1.5 pl-3">
                  @for (decision of summary()!.key_decisions; track decision) {
                    <div class="flex items-start gap-2 py-1 px-2 rounded-md hover:bg-emerald-50/50 transition-colors">
                      <mat-icon class="!text-sm text-emerald-500 mt-0.5 shrink-0">check_circle</mat-icon>
                      <span class="text-xs text-slate-600 leading-relaxed">{{ decision }}</span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Pending Actions -->
            @if (summary()!.pending_actions.length > 0) {
              <div class="mb-3">
                <div class="flex items-center gap-1.5 mb-2">
                  <div class="w-1 h-3.5 rounded-full bg-amber-400"></div>
                  <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Pending Actions</p>
                </div>
                <div class="space-y-1.5 pl-3">
                  @for (action of summary()!.pending_actions; track action) {
                    <div class="flex items-start gap-2 py-1 px-2 rounded-md hover:bg-amber-50/50 transition-colors">
                      <mat-icon class="!text-sm text-amber-500 mt-0.5 shrink-0">schedule</mat-icon>
                      <span class="text-xs text-slate-600 leading-relaxed">{{ action }}</span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Risk Flags -->
            @if (summary()!.risk_flags.length > 0) {
              <div>
                <div class="flex items-center gap-1.5 mb-2">
                  <div class="w-1 h-3.5 rounded-full bg-red-400"></div>
                  <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Risk Flags</p>
                </div>
                <div class="space-y-1.5 pl-3">
                  @for (flag of summary()!.risk_flags; track flag) {
                    <div class="flex items-start gap-2 py-1 px-2 rounded-md hover:bg-red-50/50 transition-colors">
                      <mat-icon class="!text-sm text-red-500 mt-0.5 shrink-0">flag</mat-icon>
                      <span class="text-xs text-slate-600 leading-relaxed">{{ flag }}</span>
                    </div>
                  }
                </div>
              </div>
            }
          } @else {
            <!-- Empty State -->
            <div class="text-center py-4">
              <mat-icon class="!text-2xl text-primary-300">psychology</mat-icon>
              <p class="text-xs font-medium text-slate-500 mt-1">No summary yet</p>
              <p class="text-[10px] text-slate-400 mt-0.5 mb-3">AI will analyze stages, steps & case history</p>
              <button class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-primary-500 to-sky-500 hover:from-primary-600 hover:to-sky-600 transition-all active:scale-[0.98]"
                      (click)="generateSummary()">
                <mat-icon class="!text-sm">auto_awesome</mat-icon>
                Generate Summary
              </button>
            </div>
          }
      </div>
    </div>
  `,
})
export class AiSummaryCardComponent {
  @Input({ required: true }) caseId!: string;

  summary = signal<CaseSummary | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private aiService: AiService) {}

  generateSummary(): void {
    this.loading.set(true);
    this.error.set(null);

    this.aiService.summarizeCase(this.caseId).subscribe({
      next: (result: CaseSummary) => {
        this.summary.set(result);
        this.loading.set(false);
      },
      error: (err: any) => {
        const detail = err.error?.detail || err.message || 'Failed to generate summary';
        this.error.set(detail);
        this.loading.set(false);
      },
    });
  }
}
