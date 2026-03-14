import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Store } from '@ngrx/store';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SLADashboard, SLACaseInfo, SLARisk } from '../../core/models';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-sla-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTableModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  template: `
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">SLA Dashboard</h1>
          <p class="text-gray-500">Monitor case SLA compliance and escalations</p>
        </div>
        <button mat-raised-button (click)="refresh()">
          <mat-icon>refresh</mat-icon> Refresh
        </button>
      </div>

      <!-- Summary Cards -->
      @if (dashboard()) {
        <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <mat-card>
            <mat-card-content class="p-4 text-center">
              <div class="text-3xl font-bold">{{ dashboard()!.summary.total }}</div>
              <div class="text-sm text-gray-500">Total Tracked</div>
            </mat-card-content>
          </mat-card>
          <mat-card class="!border-l-4 !border-red-600">
            <mat-card-content class="p-4 text-center">
              <div class="text-3xl font-bold text-red-600">{{ dashboard()!.summary.critical }}</div>
              <div class="text-sm text-gray-500">Critical (125%+)</div>
            </mat-card-content>
          </mat-card>
          <mat-card class="!border-l-4 !border-orange-500">
            <mat-card-content class="p-4 text-center">
              <div class="text-3xl font-bold text-orange-500">{{ dashboard()!.summary.breached }}</div>
              <div class="text-sm text-gray-500">Breached (100%+)</div>
            </mat-card-content>
          </mat-card>
          <mat-card class="!border-l-4 !border-yellow-500">
            <mat-card-content class="p-4 text-center">
              <div class="text-3xl font-bold text-yellow-500">{{ dashboard()!.summary.warning }}</div>
              <div class="text-sm text-gray-500">Warning (75%+)</div>
            </mat-card-content>
          </mat-card>
          <mat-card class="!border-l-4 !border-green-500">
            <mat-card-content class="p-4 text-center">
              <div class="text-3xl font-bold text-green-500">{{ dashboard()!.summary.normal }}</div>
              <div class="text-sm text-gray-500">On Track</div>
            </mat-card-content>
          </mat-card>
        </div>
      }

      <!-- SLA Heatmap / Case List -->
      @for (slaCase of dashboard()?.cases || []; track slaCase.id) {
        <mat-card class="mb-3 !border-l-4"
                  [ngClass]="{
                    '!border-red-600': slaCase.risk === 'critical',
                    '!border-orange-500': slaCase.risk === 'breached',
                    '!border-yellow-500': slaCase.risk === 'warning',
                    '!border-green-500': slaCase.risk === 'normal'
                  }">
          <mat-card-content class="p-4">
            <div class="flex items-center gap-4">
              <!-- Risk Indicator -->
              <div class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                   [ngClass]="{
                     'bg-red-600': slaCase.risk === 'critical',
                     'bg-orange-500': slaCase.risk === 'breached',
                     'bg-yellow-500': slaCase.risk === 'warning',
                     'bg-green-500': slaCase.risk === 'normal'
                   }">
                {{ Math.round(slaCase.percentageElapsed) }}%
              </div>

              <!-- Case Info -->
              <div class="flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-semibold">{{ slaCase.id }}</span>
                  <mat-chip class="!text-xs" [ngClass]="{
                    '!bg-red-100 !text-red-800': slaCase.risk === 'critical',
                    '!bg-orange-100 !text-orange-800': slaCase.risk === 'breached',
                    '!bg-yellow-100 !text-yellow-800': slaCase.risk === 'warning',
                    '!bg-green-100 !text-green-800': slaCase.risk === 'normal'
                  }">{{ slaCase.risk | uppercase }}</mat-chip>
                  @if (slaCase.escalated) {
                    <mat-chip class="!bg-red-100 !text-red-800 !text-xs">
                      <mat-icon class="!text-xs !w-4 !h-4 mr-1">warning</mat-icon>
                      Escalated L{{ slaCase.escalationLevel }}
                    </mat-chip>
                  }
                </div>
                <div class="text-sm text-gray-500 mt-1">
                  {{ slaCase.type }} · Stage: {{ slaCase.stage }} · Priority: {{ slaCase.priority }}
                </div>
              </div>

              <!-- Time remaining -->
              <div class="text-right">
                <div class="font-medium" [ngClass]="{
                  'text-red-600': slaCase.remainingHours <= 0,
                  'text-orange-600': slaCase.remainingHours > 0 && slaCase.remainingHours < 24,
                  'text-gray-700': slaCase.remainingHours >= 24
                }">
                  @if (slaCase.remainingHours <= 0) {
                    Overdue by {{ Math.abs(Math.round(slaCase.remainingHours)) }}h
                  } @else {
                    {{ Math.round(slaCase.remainingHours) }}h remaining
                  }
                </div>
                <div class="text-xs text-gray-400">Target: {{ formatDate(slaCase.slaTarget) }}</div>
              </div>

              <!-- Actions -->
              <button mat-icon-button matTooltip="Acknowledge" (click)="acknowledge(slaCase.id)">
                <mat-icon>done_all</mat-icon>
              </button>
            </div>

            <!-- Progress bar -->
            <div class="mt-3">
              <mat-progress-bar
                mode="determinate"
                [value]="Math.min(slaCase.percentageElapsed, 100)"
                [color]="slaCase.risk === 'normal' ? 'primary' : 'warn'"
              ></mat-progress-bar>
            </div>
          </mat-card-content>
        </mat-card>
      }

      @if (!dashboard() || dashboard()!.cases.length === 0) {
        <div class="text-center py-12 text-gray-400">
          <mat-icon class="!text-5xl !w-12 !h-12 mb-3">timer</mat-icon>
          <p>No SLA data available</p>
        </div>
      }
    </div>
  `,
})
export class SLADashboardComponent implements OnInit {
  dashboard = signal<SLADashboard | null>(null);
  Math = Math;

  constructor(
    private dataService: DataService,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.dataService.getSLADashboard().subscribe(data => {
      this.dashboard.set(data);
    });
  }

  acknowledge(caseId: string): void {
    this.dataService.acknowledgeSLA(caseId).subscribe(() => {
      this.snackBar.open('SLA acknowledged', 'OK', { duration: 2000 });
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
}
