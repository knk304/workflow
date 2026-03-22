import { Component, Input, Output, EventEmitter, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  AiService,
  RoutingSuggestion,
} from '../../../core/services/ai.service';

@Component({
  selector: 'app-routing-sidebar',
  standalone: true,
  imports: [
    CommonModule,
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
              <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-violet-500 flex items-center justify-center shadow-sm shadow-primary-500/20">
                <mat-icon class="!text-sm text-white">psychology</mat-icon>
              </div>
              <div>
                <h4 class="text-[13px] font-semibold text-slate-800 leading-tight">Smart Routing</h4>
                @if (stepName) {
                  <p class="text-[10px] text-slate-400 leading-tight">For: {{ stepName }}</p>
                }
              </div>
            </div>
          <button mat-icon-button class="!w-7 !h-7" matTooltip="Refresh suggestions" (click)="loadSuggestions()" [disabled]="loading()">
            <mat-icon class="!text-[18px] text-slate-400 hover:text-primary-500 transition-colors">refresh</mat-icon>
          </button>
      </div>

      <!-- Content -->
      <div>
          @if (loading()) {
            <div class="flex flex-col items-center justify-center py-6 gap-3">
              <div class="relative">
                <div class="w-10 h-10 rounded-full border-2 border-primary-100 border-t-primary-500 animate-spin"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                  <mat-icon class="!text-sm text-primary-400">group</mat-icon>
                </div>
              </div>
              <p class="text-xs font-medium text-slate-500">Finding best matches...</p>
            </div>
          }

          @if (!loading() && suggestions().length === 0 && loaded()) {
            <div class="text-center py-3">
              <mat-icon class="!text-2xl text-primary-300">person_search</mat-icon>
              <p class="text-xs font-medium text-slate-500 mt-1">No suggestions available</p>
              <p class="text-[10px] text-slate-400 mt-0.5">Try after more case data is available</p>
            </div>
          }

          @if (!loading() && suggestions().length > 0) {
            <div class="space-y-3">
              @for (s of suggestions(); track s.user_id; let i = $index) {
                <div class="relative">
                  <!-- Top pick badge -->
                  @if (i === 0) {
                    <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md bg-primary-500 text-white tracking-wide mb-1.5 inline-block">
                      Best Match
                    </span>
                  }

                  <div class="flex items-start gap-3">
                    <!-- Avatar with score ring -->
                    <div class="relative flex-shrink-0">
                      <svg class="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="16" fill="none" stroke-width="2"
                                class="stroke-slate-100"></circle>
                        <circle cx="18" cy="18" r="16" fill="none" stroke-width="2"
                                stroke-linecap="round"
                                [attr.stroke-dasharray]="100.53"
                                [attr.stroke-dashoffset]="100.53 - (100.53 * s.score)"
                                [class]="scoreStrokeClass(s.score)"></circle>
                      </svg>
                      <div class="absolute inset-0 flex items-center justify-center">
                        <div class="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                             [class]="i === 0 ? 'bg-gradient-to-br from-primary-500 to-sky-500' : 'bg-slate-400'">
                          {{ s.user_name[0].toUpperCase() }}
                        </div>
                      </div>
                    </div>

                    <div class="flex-1 min-w-0 pt-0.5">
                      <div class="flex items-center justify-between">
                        <p class="text-[13px] font-semibold text-slate-800 leading-tight truncate">{{ s.user_name }}</p>
                        <span class="text-xs font-bold tabular-nums ml-2"
                              [class]="scoreTextClass(s.score)">
                          {{ (s.score * 100).toFixed(0) }}%
                        </span>
                      </div>

                      <!-- Reasons -->
                      @if (s.reasons.length > 0) {
                        <ul class="mt-1.5 space-y-0.5">
                          @for (r of s.reasons; track $index) {
                            <li class="text-[10px] text-slate-500 flex items-start gap-1.5 leading-relaxed">
                              <span class="w-1 h-1 rounded-full mt-1.5 flex-shrink-0"
                                    [class]="i === 0 ? 'bg-primary-400' : 'bg-slate-300'"></span>
                              {{ r }}
                            </li>
                          }
                        </ul>
                      }

                      <button class="mt-2.5 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98]"
                              [class]="i === 0 ? 'bg-gradient-to-r from-primary-500 to-sky-500 text-white shadow-sm shadow-primary-500/20 hover:shadow-md hover:shadow-primary-500/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
                              (click)="onAssign(s.user_id)">
                        <mat-icon class="!text-sm">person_add</mat-icon>
                        Assign
                      </button>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
      </div>
    </div>
  `,
})
export class RoutingSidebarComponent implements OnChanges {
  @Input() caseId: string | null = null;
  /** Current active step name for display context */
  @Input() stepName: string | null = null;
  /** Active assignment ID for step-level reassignment */
  @Input() assignmentId: string | null = null;
  @Output() assignUser = new EventEmitter<{ userId: string; assignmentId: string | null }>();

  suggestions = signal<RoutingSuggestion[]>([]);
  loading = signal(false);
  loaded = signal(false);

  constructor(private aiService: AiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['caseId'] && this.caseId) {
      this.loadSuggestions();
    }
  }

  loadSuggestions(): void {
    if (!this.caseId) return;
    this.loading.set(true);
    this.aiService.suggestRouting(this.caseId).subscribe({
      next: (res) => {
        this.suggestions.set(res.suggestions);
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: () => {
        this.suggestions.set([]);
        this.loading.set(false);
        this.loaded.set(true);
      },
    });
  }

  scoreClass(score: number): string {
    if (score >= 0.8) return 'bg-emerald-100 text-emerald-700';
    if (score >= 0.5) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  }

  scoreBarClass(score: number): string {
    if (score >= 0.8) return 'bg-emerald-500';
    if (score >= 0.5) return 'bg-amber-500';
    return 'bg-red-500';
  }

  scoreStrokeClass(score: number): string {
    if (score >= 0.8) return 'stroke-emerald-500';
    if (score >= 0.5) return 'stroke-amber-500';
    return 'stroke-red-500';
  }

  scoreTextClass(score: number): string {
    if (score >= 0.8) return 'text-emerald-600';
    if (score >= 0.5) return 'text-amber-600';
    return 'text-red-500';
  }

  onAssign(userId: string): void {
    this.assignUser.emit({ userId, assignmentId: this.assignmentId });
  }
}
