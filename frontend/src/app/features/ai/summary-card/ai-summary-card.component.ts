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
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <!-- Header -->
      <div class="bg-gradient-to-r from-indigo-50 to-purple-50 px-5 py-3 border-b border-slate-200">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <mat-icon class="text-base text-indigo-500">auto_awesome</mat-icon>
            AI Summary
          </h4>
          <div class="flex items-center gap-1">
            @if (summary()) {
              <span class="text-[10px] text-slate-400 font-medium">
                via {{ summary()!.generated_by }}
              </span>
            }
            <button mat-icon-button
                    class="w-7 h-7"
                    [matTooltip]="summary() ? 'Refresh summary' : 'Generate summary'"
                    (click)="generateSummary()"
                    [disabled]="loading()">
              <mat-icon class="text-base text-indigo-500"
                        [class.animate-spin]="loading()">
                {{ loading() ? 'sync' : 'refresh' }}
              </mat-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="p-5">
        @if (loading()) {
          <div class="flex items-center justify-center py-8">
            <mat-spinner diameter="28"></mat-spinner>
            <span class="text-sm text-slate-500 ml-3">Generating summary...</span>
          </div>
        } @else if (error()) {
          <div class="text-center py-6">
            <mat-icon class="text-3xl text-amber-400 mb-2">warning</mat-icon>
            <p class="text-sm text-slate-500">{{ error() }}</p>
            <button mat-stroked-button class="mt-3 text-xs" (click)="generateSummary()">
              <mat-icon class="text-sm">refresh</mat-icon>
              Retry
            </button>
          </div>
        } @else if (summary()) {
          <!-- Summary Text -->
          <p class="text-sm text-slate-700 leading-relaxed mb-4">{{ summary()!.summary }}</p>

          <!-- Key Decisions -->
          @if (summary()!.key_decisions.length > 0) {
            <div class="mb-3">
              <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                Key Decisions
              </p>
              @for (decision of summary()!.key_decisions; track decision) {
                <div class="flex items-start gap-2 mb-1">
                  <mat-icon class="text-sm text-emerald-500 mt-0.5 shrink-0">check_circle</mat-icon>
                  <span class="text-xs text-slate-600">{{ decision }}</span>
                </div>
              }
            </div>
          }

          <!-- Pending Actions -->
          @if (summary()!.pending_actions.length > 0) {
            <div class="mb-3">
              <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                Pending Actions
              </p>
              @for (action of summary()!.pending_actions; track action) {
                <div class="flex items-start gap-2 mb-1">
                  <mat-icon class="text-sm text-amber-500 mt-0.5 shrink-0">pending</mat-icon>
                  <span class="text-xs text-slate-600">{{ action }}</span>
                </div>
              }
            </div>
          }

          <!-- Risk Flags -->
          @if (summary()!.risk_flags.length > 0) {
            <div>
              <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">
                Risk Flags
              </p>
              @for (flag of summary()!.risk_flags; track flag) {
                <div class="flex items-start gap-2 mb-1">
                  <mat-icon class="text-sm text-red-500 mt-0.5 shrink-0">flag</mat-icon>
                  <span class="text-xs text-slate-600">{{ flag }}</span>
                </div>
              }
            </div>
          }
        } @else {
          <!-- Empty State -->
          <div class="text-center py-6">
            <div class="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto mb-3">
              <mat-icon class="text-2xl text-indigo-400">psychology</mat-icon>
            </div>
            <p class="text-sm text-slate-500 mb-1">No summary yet</p>
            <p class="text-xs text-slate-400 mb-3">Click generate to create an AI-powered case summary</p>
            <button mat-raised-button
                    class="bg-indigo-500 text-white hover:bg-indigo-600 text-xs"
                    (click)="generateSummary()">
              <mat-icon class="text-sm">auto_awesome</mat-icon>
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
