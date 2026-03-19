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
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <h4 class="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <mat-icon class="text-base text-amber-500">lightbulb</mat-icon>
          AI Recommendations
        </h4>
        <button mat-icon-button class="w-7 h-7" matTooltip="Refresh" (click)="load()" [disabled]="loading">
          <mat-icon class="text-base text-slate-400">refresh</mat-icon>
        </button>
      </div>
      <div class="p-4">
        @if (loading) {
          <div class="flex items-center gap-2 text-slate-400 text-sm py-3 justify-center">
            <mat-icon class="animate-spin text-base">autorenew</mat-icon>
            Analyzing case...
          </div>
        } @else if (error) {
          <div class="flex items-center gap-2 text-red-500 text-xs py-2">
            <mat-icon class="text-base">error_outline</mat-icon>
            {{ error }}
          </div>
        } @else if (recommendations.length === 0) {
          <div class="text-center py-4">
            <mat-icon class="text-3xl text-slate-200">check_circle</mat-icon>
            <p class="text-xs text-slate-400 mt-1">No recommendations at this time.</p>
          </div>
        } @else {
          <div class="space-y-3">
            @for (rec of recommendations; track rec.action) {
              <div class="p-3 rounded-lg border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-all">
                <div class="flex items-start gap-2">
                  <mat-icon class="text-amber-500 text-base mt-0.5 flex-shrink-0">{{ actionIcon(rec.action) }}</mat-icon>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-slate-800">{{ rec.label }}</p>
                    <p class="text-xs text-slate-500 mt-0.5">{{ rec.description }}</p>
                    @if (rec.reason) {
                      <p class="text-xs text-blue-600 mt-1 italic">{{ rec.reason }}</p>
                    }
                    <div class="flex items-center gap-2 mt-2">
                      <div class="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all"
                             [class]="confidenceBarClass(rec.confidence)"
                             [style.width.%]="rec.confidence * 100"></div>
                      </div>
                      <span class="text-[10px] font-semibold text-slate-500">{{ rec.confidence | percent:'1.0-0' }}</span>
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
}
