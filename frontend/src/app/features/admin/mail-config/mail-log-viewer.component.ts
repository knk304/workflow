import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MailService, MailLog, MAIL_EVENT_LABELS } from './mail.service';

@Component({
  selector: 'app-mail-log-viewer',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatButtonModule, MatIconModule, MatTableModule,
    MatSelectModule, MatFormFieldModule, MatInputModule,
    MatChipsModule, MatTooltipModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="p-6 max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <mat-icon class="text-blue-600">history</mat-icon>
            Email Delivery Log
          </h1>
          <p class="text-sm text-gray-500 mt-1">Audit trail of all sent email notifications</p>
        </div>
        <div class="flex items-center gap-3">
          <button mat-stroked-button routerLink="/admin/mail-config">
            <mat-icon>settings</mat-icon> Configurations
          </button>
          <button mat-stroked-button (click)="loadLogs()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex items-center gap-4 mb-4">
        <mat-form-field class="w-48">
          <mat-label>Status</mat-label>
          <mat-select [(ngModel)]="filterStatus" (selectionChange)="loadLogs()">
            <mat-option value="">All</mat-option>
            <mat-option value="sent">Sent</mat-option>
            <mat-option value="failed">Failed</mat-option>
            <mat-option value="skipped">Skipped</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field class="w-48">
          <mat-label>Event</mat-label>
          <mat-select [(ngModel)]="filterEvent" (selectionChange)="loadLogs()">
            <mat-option value="">All Events</mat-option>
            @for (evt of eventOptions; track evt.value) {
              <mat-option [value]="evt.value">{{ evt.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field class="w-48">
          <mat-label>Case ID</mat-label>
          <input matInput [(ngModel)]="filterCaseId" (keydown.enter)="loadLogs()"
                 placeholder="e.g. LOAN-001">
        </mat-form-field>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="flex justify-center py-12">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else {
        @if (logs().length === 0) {
          <div class="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <mat-icon class="text-gray-400" style="font-size: 48px; width: 48px; height: 48px;">inbox</mat-icon>
            <p class="text-gray-500 text-lg mt-3">No email logs found</p>
            <p class="text-gray-400 text-sm mt-1">Logs will appear here once emails are triggered</p>
          </div>
        } @else {
          <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
            <table mat-table [dataSource]="logs()" class="w-full">
              <!-- Sent At -->
              <ng-container matColumnDef="sent_at">
                <th mat-header-cell *matHeaderCellDef class="font-semibold">Date</th>
                <td mat-cell *matCellDef="let row">
                  <span class="text-sm text-gray-700">{{ formatDate(row.sent_at) }}</span>
                </td>
              </ng-container>

              <!-- Case ID -->
              <ng-container matColumnDef="case_id">
                <th mat-header-cell *matHeaderCellDef class="font-semibold">Case ID</th>
                <td mat-cell *matCellDef="let row">
                  <span class="font-mono text-sm font-medium text-blue-700">{{ row.case_id }}</span>
                </td>
              </ng-container>

              <!-- Event -->
              <ng-container matColumnDef="event">
                <th mat-header-cell *matHeaderCellDef class="font-semibold">Event</th>
                <td mat-cell *matCellDef="let row">
                  <span class="text-sm text-gray-700">{{ eventLabel(row.event) }}</span>
                </td>
              </ng-container>

              <!-- Recipients -->
              <ng-container matColumnDef="recipients">
                <th mat-header-cell *matHeaderCellDef class="font-semibold">Recipients</th>
                <td mat-cell *matCellDef="let row">
                  <div class="flex flex-wrap gap-1">
                    @for (email of row.recipients; track email) {
                      <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{{ email }}</span>
                    }
                  </div>
                </td>
              </ng-container>

              <!-- Subject -->
              <ng-container matColumnDef="subject">
                <th mat-header-cell *matHeaderCellDef class="font-semibold">Subject</th>
                <td mat-cell *matCellDef="let row">
                  <span class="text-sm text-gray-600">{{ row.subject }}</span>
                </td>
              </ng-container>

              <!-- Status -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef class="font-semibold">Status</th>
                <td mat-cell *matCellDef="let row">
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                        [class]="statusBadgeClass(row.status)">
                    <mat-icon style="font-size: 14px; width: 14px; height: 14px;">{{ statusIcon(row.status) }}</mat-icon>
                    {{ row.status | titlecase }}
                  </span>
                  @if (row.error) {
                    <div class="text-xs text-red-500 mt-1" [matTooltip]="row.error">
                      {{ row.error | slice:0:60 }}{{ row.error.length > 60 ? '...' : '' }}
                    </div>
                  }
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                  class="hover:bg-gray-50 transition-colors"></tr>
            </table>
          </div>
        }
      }
    </div>
  `,
})
export class MailLogViewerComponent implements OnInit {
  logs = signal<MailLog[]>([]);
  loading = signal(true);

  filterStatus = '';
  filterEvent = '';
  filterCaseId = '';

  displayedColumns = ['sent_at', 'case_id', 'event', 'recipients', 'subject', 'status'];
  eventOptions = Object.entries(MAIL_EVENT_LABELS).map(([value, label]) => ({ value, label }));

  constructor(private mailService: MailService) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading.set(true);
    this.mailService.getLogs({
      status: this.filterStatus || undefined,
      event: this.filterEvent || undefined,
      case_id: this.filterCaseId || undefined,
      limit: 200,
    }).subscribe({
      next: (logs) => { this.logs.set(logs); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  eventLabel(event: string): string {
    return MAIL_EVENT_LABELS[event as keyof typeof MAIL_EVENT_LABELS] || event;
  }

  statusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      sent: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      skipped: 'bg-gray-100 text-gray-500',
    };
    return classes[status] || 'bg-gray-100 text-gray-500';
  }

  statusIcon(status: string): string {
    const icons: Record<string, string> = {
      sent: 'check_circle',
      failed: 'error',
      skipped: 'skip_next',
    };
    return icons[status] || 'help';
  }

  formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
}
