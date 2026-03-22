import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, PercentPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AiService } from '../../../core/services/ai.service';
import { Recommendation } from '../../../core/models/ai.models';

@Component({
  selector: 'app-recommendation-sidebar',
  standalone: true,
  imports: [CommonModule, PercentPipe, MatIconModule, MatButtonModule, MatTooltipModule, MatProgressBarModule],
  template: `
    <div>
      <!-- Header -->
      <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm shadow-amber-500/20">
                <mat-icon class="!text-sm text-white">lightbulb</mat-icon>
              </div>
              <h4 class="text-[13px] font-semibold text-slate-800">Recommendations</h4>
            </div>
          <button mat-icon-button class="!w-7 !h-7" matTooltip="Refresh" (click)="load()" [disabled]="loading">
            <mat-icon class="!text-[18px] text-slate-400 hover:text-amber-500 transition-colors">refresh</mat-icon>
          </button>
      </div>

      <!-- Content -->
      <div>
          @if (loading) {
            <div class="flex flex-col items-center justify-center py-6 gap-3">
              <div class="relative">
                <div class="w-10 h-10 rounded-full border-2 border-amber-100 border-t-amber-500 animate-spin"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                  <mat-icon class="!text-sm text-amber-400">lightbulb</mat-icon>
                </div>
              </div>
              <p class="text-xs font-medium text-slate-500">Analyzing case...</p>
            </div>
          } @else if (error) {
            <div class="flex items-center gap-2.5 p-3 rounded-xl bg-red-50/50 border border-red-100">
              <mat-icon class="!text-lg text-red-400">error_outline</mat-icon>
              <p class="text-xs text-red-600 leading-relaxed">{{ error }}</p>
            </div>
          } @else if (recommendations.length === 0) {
            <div class="text-center py-4">
              <mat-icon class="!text-2xl text-amber-300">thumb_up</mat-icon>
              <p class="text-xs font-medium text-slate-500 mt-1">All good for now</p>
              <p class="text-[10px] text-slate-400 mt-0.5">No actions recommended at this stage</p>
            </div>
          } @else {
            <div class="space-y-2.5">
              @for (rec of recommendations; track rec.action) {
                <div class="relative pl-3">
                  <!-- Left accent stripe -->
                  <div class="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
                       [class]="recAccentClass(rec.confidence)"></div>

                  <div class="flex items-start gap-2.5">
                    <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                         [class]="recIconBg(rec.confidence)">
                      <mat-icon class="!text-xs text-white">{{ actionIcon(rec.action) }}</mat-icon>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-[13px] font-semibold text-slate-800 leading-tight">{{ rec.label }}</p>
                      <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{{ rec.description }}</p>
                      @if (rec.reason) {
                        <p class="text-[11px] text-primary-600/80 mt-1.5 italic flex items-start gap-1">
                          <mat-icon class="!text-xs !w-3 !h-3 mt-0.5 shrink-0">tips_and_updates</mat-icon>
                          {{ rec.reason }}
                        </p>
                      }
                      <!-- Confidence meter -->
                      <div class="flex items-center gap-2 mt-2">
                        <div class="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div class="h-full rounded-full transition-all duration-700"
                               [class]="confidenceBarClass(rec.confidence)"
                               [style.width.%]="rec.confidence * 100"></div>
                        </div>
                        <span class="text-[10px] font-bold tabular-nums"
                              [class]="confidenceTextClass(rec.confidence)">
                          {{ rec.confidence | percent:'1.0-0' }}
                        </span>
                      </div>
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
export class RecommendationSidebarComponent implements OnInit {
  @Input() caseId!: string;
  recommendations: Recommendation[] = [];
  loading = false;
  error = '';

  constructor(private ai: AiService) {}

  ngOnInit(): void {
    if (this.caseId) this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.ai.getRecommendations(this.caseId).subscribe({
      next: res => {
        this.recommendations = res.recommendations ?? [];
        this.loading = false;
      },
      error: err => {
        this.error = err?.error?.detail || err.message || 'Failed to load recommendations.';
        this.loading = false;
      }
    });
  }

  actionIcon(action: string): string {
    return ({
      follow_up: 'phone_callback',
      escalate: 'trending_up',
      request_info: 'help_outline',
      assign_task: 'person_add',
      review_docs: 'description',
      close_case: 'check_circle',
    } as Record<string, string>)[action] || 'lightbulb';
  }

  confidenceBarClass(confidence: number): string {
    if (confidence >= 0.8) return 'bg-emerald-500';
    if (confidence >= 0.5) return 'bg-amber-400';
    return 'bg-slate-300';
  }

  confidenceTextClass(confidence: number): string {
    if (confidence >= 0.8) return 'text-emerald-600';
    if (confidence >= 0.5) return 'text-amber-600';
    return 'text-slate-400';
  }

  recBorderClass(confidence: number): string {
    if (confidence >= 0.8) return 'border-emerald-100 hover:border-emerald-200 bg-emerald-50/20';
    if (confidence >= 0.5) return 'border-amber-100 hover:border-amber-200 bg-amber-50/20';
    return 'border-slate-100 hover:border-slate-200 bg-slate-50/20';
  }

  recAccentClass(confidence: number): string {
    if (confidence >= 0.8) return 'bg-emerald-400';
    if (confidence >= 0.5) return 'bg-amber-400';
    return 'bg-slate-300';
  }

  recIconBg(confidence: number): string {
    if (confidence >= 0.8) return 'bg-emerald-500';
    if (confidence >= 0.5) return 'bg-amber-500';
    return 'bg-slate-400';
  }
}
