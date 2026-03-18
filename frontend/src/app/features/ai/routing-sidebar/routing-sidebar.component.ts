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
    <div class="bg-white rounded-xl border border-slate-200 p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <mat-icon class="text-indigo-600">psychology</mat-icon>
          <h3 class="text-sm font-semibold text-slate-700">Suggested Assignees</h3>
        </div>
        <button mat-icon-button matTooltip="Refresh suggestions" (click)="loadSuggestions()" [disabled]="loading()">
          <mat-icon class="text-sm text-slate-400">refresh</mat-icon>
        </button>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-6">
          <mat-spinner diameter="28"></mat-spinner>
        </div>
      }

      @if (!loading() && suggestions().length === 0 && loaded()) {
        <p class="text-xs text-slate-400 text-center py-4">No suggestions available for this case.</p>
      }

      @if (!loading() && suggestions().length > 0) {
        <div class="space-y-3">
          @for (s of suggestions(); track s.user_id) {
            <div class="border border-slate-100 rounded-lg p-3 hover:bg-slate-50 transition-colors">
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium text-slate-800">{{ s.user_name }}</span>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full"
                  [ngClass]="scoreClass(s.score)">
                  {{ (s.score * 100).toFixed(0) }}%
                </span>
              </div>
              <!-- Score bar -->
              <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div class="h-full rounded-full transition-all"
                  [ngClass]="scoreBarClass(s.score)"
                  [style.width.%]="s.score * 100"></div>
              </div>
              <!-- Reasons -->
              @if (s.reasons.length > 0) {
                <ul class="space-y-0.5">
                  @for (r of s.reasons; track $index) {
                    <li class="text-[11px] text-slate-500 flex items-start gap-1">
                      <mat-icon class="text-[10px] mt-0.5 text-slate-400" style="font-size: 10px; width: 10px; height: 10px;">check_circle</mat-icon>
                      {{ r }}
                    </li>
                  }
                </ul>
              }
              <button
                mat-stroked-button
                class="w-full mt-2 text-xs"
                (click)="assignUser.emit(s.user_id)"
              >
                <mat-icon class="text-sm mr-1">person_add</mat-icon>
                Assign
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class RoutingSidebarComponent implements OnChanges {
  @Input() caseId: string | null = null;
  @Output() assignUser = new EventEmitter<string>();

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
}
