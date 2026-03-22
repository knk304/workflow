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
    <div>
      <!-- Header -->
      <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center shadow-sm shadow-red-500/20">
                <mat-icon class="!text-sm text-white">shield</mat-icon>
              </div>
              <h4 class="text-[13px] font-semibold text-slate-800">Risk Assessment</h4>
            </div>
          <button mat-icon-button class="!w-7 !h-7" matTooltip="Refresh" (click)="load()" [disabled]="loading">
            <mat-icon class="!text-[18px] text-slate-400 hover:text-red-500 transition-colors">refresh</mat-icon>
          </button>
      </div>

      <!-- Content -->
      <div>
          @if (loading) {
            <div class="flex flex-col items-center justify-center py-6 gap-3">
              <div class="relative">
                <div class="w-10 h-10 rounded-full border-2 border-red-100 border-t-red-500 animate-spin"></div>
                <div class="absolute inset-0 flex items-center justify-center">
                  <mat-icon class="!text-sm text-red-400">shield</mat-icon>
                </div>
              </div>
              <p class="text-xs font-medium text-slate-500">Scanning for risks...</p>
            </div>
          } @else if (error) {
            <div class="flex items-center gap-2.5 p-3 rounded-xl bg-red-50/50 border border-red-100">
              <mat-icon class="!text-lg text-red-400">error_outline</mat-icon>
              <p class="text-xs text-red-600 leading-relaxed">{{ error }}</p>
            </div>
          } @else {
            <!-- Overall Risk Badge -->
            <div class="flex items-center gap-2.5 mb-3 py-2 px-2.5 rounded-lg" [class]="riskBg(overallRisk)">
              <div class="w-7 h-7 rounded-lg flex items-center justify-center" [class]="riskIconBg(overallRisk)">
                <mat-icon class="!text-sm text-white">{{ riskIcon(overallRisk) }}</mat-icon>
              </div>
              <div>
                <p class="text-[10px] font-medium text-slate-500 uppercase tracking-wider leading-tight">Overall Risk</p>
                <p class="text-[13px] font-bold leading-tight" [class]="riskColor(overallRisk)">{{ overallRisk | titlecase }}</p>
              </div>
            </div>

            @if (riskFlags.length === 0) {
              <div class="text-center py-3">
                <mat-icon class="!text-2xl text-emerald-300">verified_user</mat-icon>
                <p class="text-xs font-medium text-slate-500 mt-1">No risks detected</p>
                <p class="text-[10px] text-slate-400 mt-0.5">Case appears to be low-risk</p>
              </div>
            } @else {
              <div class="space-y-2.5">
                @for (flag of riskFlags; track flag.category) {
                  <div class="relative pl-3">
                    <!-- Left severity stripe -->
                    <div class="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
                         [class]="severityAccent(flag.severity)"></div>

                    <div class="flex items-start gap-2.5">
                      <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                           [class]="severityBg(flag.severity)">
                        <mat-icon class="!text-xs" [class]="severityColor(flag.severity)">
                          {{ severityIcon(flag.severity) }}
                        </mat-icon>
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <p class="text-[13px] font-semibold text-slate-800 leading-tight">{{ flag.category }}</p>
                          <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full tracking-wide"
                                [class]="severityBadge(flag.severity)">
                            {{ flag.severity }}
                          </span>
                        </div>
                        <p class="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{{ flag.description }}</p>
                        @if (flag.source) {
                          <p class="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                            <mat-icon class="!text-xs !w-3 !h-3">source</mat-icon>
                            {{ flag.source }}
                          </p>
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
    return ({ critical: 'bg-red-50 border border-red-100', high: 'bg-orange-50 border border-orange-100', medium: 'bg-yellow-50 border border-yellow-100', low: 'bg-green-50 border border-green-100' })[risk] || 'bg-slate-50 border border-slate-100';
  }

  riskColor(risk: string): string {
    return ({ critical: 'text-red-600', high: 'text-orange-600', medium: 'text-yellow-600', low: 'text-green-600' })[risk] || 'text-slate-500';
  }

  riskIcon(risk: string): string {
    return ({ critical: 'dangerous', high: 'warning', medium: 'info', low: 'check_circle' })[risk] || 'help';
  }

  riskIconBg(risk: string): string {
    return ({ critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-green-500' })[risk] || 'bg-slate-400';
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

  severityAccent(s: string): string {
    return ({
      critical: 'bg-red-400',
      high: 'bg-orange-400',
      medium: 'bg-yellow-400',
      low: 'bg-green-400',
    })[s] || 'bg-slate-300';
  }
}
