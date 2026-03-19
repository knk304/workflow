import { Component, Input, OnInit } from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AiService } from '../../../core/services/ai.service';
import { RiskFlag } from '../../../core/models/ai.models';

@Component({
  selector: 'app-risk-sidebar',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <h4 class="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <mat-icon class="text-base text-red-500">shield</mat-icon>
          Risk Assessment
        </h4>
        <button mat-icon-button class="w-7 h-7" matTooltip="Refresh" (click)="load()" [disabled]="loading">
          <mat-icon class="text-base text-slate-400">refresh</mat-icon>
        </button>
      </div>
      <div class="p-4">
        @if (loading) {
          <div class="flex items-center gap-2 text-slate-400 text-sm py-3 justify-center">
            <mat-icon class="animate-spin text-base">autorenew</mat-icon>
            Scanning for risks...
          </div>
        } @else if (error) {
          <div class="flex items-center gap-2 text-red-500 text-xs py-2">
            <mat-icon class="text-base">error_outline</mat-icon>
            {{ error }}
          </div>
        } @else {
          <!-- Overall Risk Badge -->
          <div class="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg" [class]="riskBg(overallRisk)">
            <mat-icon [class]="riskColor(overallRisk)" class="text-base">{{ riskIcon(overallRisk) }}</mat-icon>
            <span class="text-xs font-semibold" [class]="riskColor(overallRisk)">
              Overall Risk: {{ overallRisk | titlecase }}
            </span>
          </div>

          @if (riskFlags.length === 0) {
            <div class="text-center py-4">
              <mat-icon class="text-3xl text-emerald-200">verified_user</mat-icon>
              <p class="text-xs text-slate-400 mt-1">No risk flags detected.</p>
            </div>
          } @else {
            <div class="space-y-3">
              @for (flag of riskFlags; track flag.category) {
                <div class="p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-all">
                  <div class="flex items-start gap-2">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                         [class]="severityBg(flag.severity)">
                      <mat-icon class="text-xs" [class]="severityColor(flag.severity)">
                        {{ severityIcon(flag.severity) }}
                      </mat-icon>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <p class="text-sm font-semibold text-slate-800">{{ flag.category }}</p>
                        <span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full"
                              [class]="severityBadge(flag.severity)">
                          {{ flag.severity }}
                        </span>
                      </div>
                      <p class="text-xs text-slate-500 mt-0.5">{{ flag.description }}</p>
                      @if (flag.source) {
                        <p class="text-[10px] text-slate-400 mt-1">Source: {{ flag.source }}</p>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class RiskSidebarComponent implements OnInit {
  @Input() caseId!: string;
  riskFlags: RiskFlag[] = [];
  overallRisk = 'low';
  loading = false;
  error = '';

  constructor(private ai: AiService) {}

  ngOnInit(): void {
    if (this.caseId) this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.ai.getRisk(this.caseId).subscribe({
      next: res => {
        this.riskFlags = res.risk_flags ?? [];
        this.overallRisk = res.overall_risk ?? 'low';
        this.loading = false;
      },
      error: err => {
        this.error = err?.error?.detail || err.message || 'Failed to load risk assessment.';
        this.loading = false;
      }
    });
  }

  riskBg(risk: string): string {
    return ({ critical: 'bg-red-50', high: 'bg-orange-50', medium: 'bg-yellow-50', low: 'bg-green-50' })[risk] || 'bg-slate-50';
  }

  riskColor(risk: string): string {
    return ({ critical: 'text-red-600', high: 'text-orange-600', medium: 'text-yellow-600', low: 'text-green-600' })[risk] || 'text-slate-500';
  }

  riskIcon(risk: string): string {
    return ({ critical: 'dangerous', high: 'warning', medium: 'info', low: 'check_circle' })[risk] || 'help';
  }

  severityBg(s: string): string {
    return ({ critical: 'bg-red-100', high: 'bg-orange-100', medium: 'bg-yellow-100', low: 'bg-green-100' })[s] || 'bg-slate-100';
  }

  severityColor(s: string): string {
    return ({ critical: 'text-red-600', high: 'text-orange-600', medium: 'text-yellow-600', low: 'text-green-600' })[s] || 'text-slate-500';
  }

  severityIcon(s: string): string {
    return ({ critical: 'dangerous', high: 'warning', medium: 'info', low: 'check_circle' })[s] || 'help';
  }

  severityBadge(s: string): string {
    return ({
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-yellow-100 text-yellow-700',
      low: 'bg-green-100 text-green-700',
    })[s] || 'bg-slate-100 text-slate-600';
  }
}
