import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MailService, MailConfig, MailSettings,
  MAIL_EVENT_LABELS, RECIPIENT_TYPE_LABELS,
} from './mail.service';
import { MailConfigDialogComponent } from './mail-config-dialog.component';
import { MailTestDialogComponent } from './mail-test-dialog.component';
import { DataService } from '../../../core/services/data.service';
import { CaseTypeDefinition } from '../../../core/models';

@Component({
  selector: 'app-mail-config',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatButtonModule, MatIconModule, MatTableModule, MatSlideToggleModule,
    MatSelectModule, MatFormFieldModule, MatChipsModule, MatTooltipModule,
    MatMenuModule, MatDialogModule, MatSnackBarModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="p-6 max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <mat-icon class="text-blue-600">email</mat-icon>
            Email Notification Settings
          </h1>
          <p class="text-sm text-gray-500 mt-1">Configure email notifications for case lifecycle events</p>
        </div>
        <div class="flex items-center gap-3">
          <!-- SMTP Status Badge -->
          @if (mailSettings()) {
            <div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                 [class]="mailSettings()!.mail_enabled && mailSettings()!.configured
                   ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'">
              <div class="w-2 h-2 rounded-full"
                   [class]="mailSettings()!.mail_enabled && mailSettings()!.configured
                     ? 'bg-green-500' : 'bg-amber-500'"></div>
              {{ mailSettings()!.mail_enabled && mailSettings()!.configured ? 'SMTP Connected' : 'SMTP Not Configured' }}
            </div>
          }

          <button mat-stroked-button (click)="openTestDialog()">
            <mat-icon>send</mat-icon> Test Email
          </button>
          <button mat-stroked-button routerLink="/admin/mail-logs">
            <mat-icon>history</mat-icon> View Logs
          </button>
          <button mat-flat-button color="primary" (click)="openAddDialog()">
            <mat-icon>add</mat-icon> Add Configuration
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="flex items-center gap-4 mb-4">
        <mat-form-field class="w-64">
          <mat-label>Filter by Case Type</mat-label>
          <mat-select [(ngModel)]="selectedCaseType" (selectionChange)="loadConfigs()">
            <mat-option value="">All Case Types</mat-option>
            @for (ct of caseTypes(); track ct.id) {
              <mat-option [value]="ct.id">{{ ct.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="flex justify-center py-12">
          <mat-spinner diameter="40"></mat-spinner>
        </div>
      } @else {
        <!-- Configs Table -->
        @if (configs().length === 0) {
          <div class="text-center py-16 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <mat-icon class="text-gray-400 text-5xl mb-3" style="font-size: 48px; width: 48px; height: 48px;">mail_outline</mat-icon>
            <p class="text-gray-500 text-lg">No email configurations yet</p>
            <p class="text-gray-400 text-sm mt-1">Add a configuration to start sending email notifications</p>
            <button mat-flat-button color="primary" class="mt-4" (click)="openAddDialog()">
              <mat-icon>add</mat-icon> Add Configuration
            </button>
          </div>
        } @else {
          <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
            <table mat-table [dataSource]="configs()" class="w-full">
              <!-- Case Type Column -->
              <ng-container matColumnDef="case_type">
                <th mat-header-cell *matHeaderCellDef class="font-semibold">Case Type</th>
                <td mat-cell *matCellDef="let row">
                  <span class="font-medium text-gray-800">{{ row.case_type_name || row.case_type_id }}</span>
                </td>
              </ng-container>

              <!-- Event Column -->
              <ng-container matColumnDef="event">
                <th mat-header-cell *matHeaderCellDef class="font-semibold">Event</th>
                <td mat-cell *matCellDef="let row">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        [class]="eventBadgeClass(row.event)">
                    <mat-icon style="font-size: 14px; width: 14px; height: 14px;">{{ eventIcon(row.event) }}</mat-icon>
                    {{ eventLabel(row.event) }}
                  </span>
                </td>
              </ng-container>

              <!-- Recipient Column -->
              <ng-container matColumnDef="recipient">
                <th mat-header-cell *matHeaderCellDef class="font-semibold">Recipients</th>
                <td mat-cell *matCellDef="let row">
                  <span class="text-sm text-gray-700">{{ recipientLabel(row.recipient_type) }}</span>
                  @if (row.recipient_type === 'custom' && row.custom_emails?.length) {
                    <div class="flex flex-wrap gap-1 mt-1">
                      @for (email of row.custom_emails; track email) {
                        <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{{ email }}</span>
                      }
                    </div>
                  }
                </td>
              </ng-container>

              <!-- Subject Column -->
              <ng-container matColumnDef="subject">
                <th mat-header-cell *matHeaderCellDef class="font-semibold">Subject Template</th>
                <td mat-cell *matCellDef="let row">
                  <span class="text-sm text-gray-600 font-mono">{{ row.subject_template }}</span>
                </td>
              </ng-container>

              <!-- Enabled Column -->
              <ng-container matColumnDef="enabled">
                <th mat-header-cell *matHeaderCellDef class="font-semibold">Enabled</th>
                <td mat-cell *matCellDef="let row">
                  <mat-slide-toggle [checked]="row.enabled"
                                    (change)="toggleEnabled(row, $event.checked)"
                                    color="primary">
                  </mat-slide-toggle>
                </td>
              </ng-container>

              <!-- Actions Column -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="font-semibold w-20">Actions</th>
                <td mat-cell *matCellDef="let row">
                  <button mat-icon-button [matMenuTriggerFor]="actionMenu"
                          matTooltip="Actions">
                    <mat-icon>more_vert</mat-icon>
                  </button>
                  <mat-menu #actionMenu="matMenu">
                    <button mat-menu-item (click)="openEditDialog(row)">
                      <mat-icon>edit</mat-icon> Edit
                    </button>
                    <button mat-menu-item (click)="deleteConfig(row)" class="text-red-600">
                      <mat-icon>delete</mat-icon> Delete
                    </button>
                  </mat-menu>
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
export class MailConfigComponent implements OnInit {
  configs = signal<MailConfig[]>([]);
  caseTypes = signal<CaseTypeDefinition[]>([]);
  mailSettings = signal<MailSettings | null>(null);
  loading = signal(true);
  selectedCaseType = '';

  displayedColumns = ['case_type', 'event', 'recipient', 'subject', 'enabled', 'actions'];

  constructor(
    private mailService: MailService,
    private dataService: DataService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.dataService.getCaseTypeDefinitions().subscribe(cts => this.caseTypes.set(cts));
    this.mailService.getSettings().subscribe(s => this.mailSettings.set(s));
    this.loadConfigs();
  }

  loadConfigs(): void {
    this.loading.set(true);
    const caseTypeId = this.selectedCaseType || undefined;
    this.mailService.getConfigs(caseTypeId).subscribe({
      next: (configs) => { this.configs.set(configs); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  toggleEnabled(config: MailConfig, enabled: boolean): void {
    this.mailService.updateConfig(config.id, { enabled }).subscribe({
      next: () => this.snackBar.open(
        enabled ? 'Email notification enabled' : 'Email notification disabled', 'OK', { duration: 2000 }
      ),
      error: () => this.snackBar.open('Failed to update', 'OK', { duration: 3000 }),
    });
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(MailConfigDialogComponent, {
      width: '560px',
      data: { mode: 'create', caseTypes: this.caseTypes() },
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadConfigs();
    });
  }

  openEditDialog(config: MailConfig): void {
    const dialogRef = this.dialog.open(MailConfigDialogComponent, {
      width: '560px',
      data: { mode: 'edit', config, caseTypes: this.caseTypes() },
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result) this.loadConfigs();
    });
  }

  openTestDialog(): void {
    this.dialog.open(MailTestDialogComponent, { width: '480px' });
  }

  deleteConfig(config: MailConfig): void {
    if (confirm(`Delete email config for "${this.eventLabel(config.event)}" on "${config.case_type_name || config.case_type_id}"?`)) {
      this.mailService.deleteConfig(config.id).subscribe({
        next: () => { this.loadConfigs(); this.snackBar.open('Configuration deleted', 'OK', { duration: 2000 }); },
        error: () => this.snackBar.open('Failed to delete', 'OK', { duration: 3000 }),
      });
    }
  }

  eventLabel(event: string): string {
    return MAIL_EVENT_LABELS[event as keyof typeof MAIL_EVENT_LABELS] || event;
  }

  recipientLabel(type: string): string {
    return RECIPIENT_TYPE_LABELS[type as keyof typeof RECIPIENT_TYPE_LABELS] || type;
  }

  eventIcon(event: string): string {
    const icons: Record<string, string> = {
      case_created: 'add_circle',
      case_status_changed: 'swap_horiz',
      step_assigned: 'person_add',
      step_completed: 'check_circle',
      case_resolved: 'verified',
    };
    return icons[event] || 'email';
  }

  eventBadgeClass(event: string): string {
    const classes: Record<string, string> = {
      case_created: 'bg-blue-100 text-blue-700',
      case_status_changed: 'bg-amber-100 text-amber-700',
      step_assigned: 'bg-purple-100 text-purple-700',
      step_completed: 'bg-green-100 text-green-700',
      case_resolved: 'bg-teal-100 text-teal-700',
    };
    return classes[event] || 'bg-gray-100 text-gray-700';
  }
}
