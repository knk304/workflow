import { Component, Inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { COMMA, ENTER } from '@angular/cdk/keycodes';
import {
  MailService, MailConfig, MailConfigCreate,
  MailEvent, RecipientType,
  MAIL_EVENT_LABELS, RECIPIENT_TYPE_LABELS,
} from './mail.service';
import { CaseTypeDefinition } from '../../../core/models';

export interface MailConfigDialogData {
  mode: 'create' | 'edit';
  config?: MailConfig;
  caseTypes: CaseTypeDefinition[];
  preselectedCaseTypeId?: string;
}

@Component({
  selector: 'app-mail-config-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatSlideToggleModule, MatChipsModule, MatSnackBarModule,
  ],
  template: `
    <h2 mat-dialog-title class="flex items-center gap-2">
      <mat-icon class="text-blue-600">{{ data.mode === 'create' ? 'add_circle' : 'edit' }}</mat-icon>
      {{ data.mode === 'create' ? 'Add Email Configuration' : 'Edit Email Configuration' }}
    </h2>

    <mat-dialog-content class="space-y-4 py-2">
      <!-- Case Type -->
      <mat-form-field class="w-full">
        <mat-label>Case Type</mat-label>
        <mat-select [(ngModel)]="form.case_type_id" [disabled]="data.mode === 'edit'">
          @for (ct of data.caseTypes; track ct.id) {
            <mat-option [value]="ct.id">{{ ct.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <!-- Event -->
      <mat-form-field class="w-full">
        <mat-label>Trigger Event</mat-label>
        <mat-select [(ngModel)]="form.event" [disabled]="data.mode === 'edit'">
          @for (evt of eventOptions; track evt.value) {
            <mat-option [value]="evt.value">{{ evt.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <!-- Recipient Type -->
      <mat-form-field class="w-full">
        <mat-label>Recipient Type</mat-label>
        <mat-select [(ngModel)]="form.recipient_type">
          @for (rt of recipientOptions; track rt.value) {
            <mat-option [value]="rt.value">{{ rt.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <!-- Custom Emails (shown when recipient_type === 'custom') -->
      @if (form.recipient_type === 'custom') {
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Custom Email Addresses</label>
          <div class="flex flex-wrap gap-2 mb-2">
            @for (email of form.custom_emails; track email; let i = $index) {
              <span class="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-sm">
                {{ email }}
                <button (click)="removeEmail(i)" class="hover:text-red-500 ml-1">
                  <mat-icon style="font-size: 16px; width: 16px; height: 16px;">close</mat-icon>
                </button>
              </span>
            }
          </div>
          <mat-form-field class="w-full">
            <mat-label>Add email (press Enter)</mat-label>
            <input matInput [(ngModel)]="newEmail"
                   (keydown.enter)="addEmail($event)"
                   placeholder="user@example.com">
          </mat-form-field>
        </div>
      }

      <!-- Subject Template -->
      <mat-form-field class="w-full">
        <mat-label>Subject Template</mat-label>
        <input matInput [(ngModel)]="form.subject_template"
               placeholder="[case_id] event_label — case_title">
        <mat-hint>Variables: case_id, case_title, event_label, status, step_name (use double curly braces)</mat-hint>
      </mat-form-field>

      <!-- Enabled Toggle -->
      <div class="flex items-center gap-3 pt-2">
        <mat-slide-toggle [(ngModel)]="form.enabled" color="primary">
          Enabled
        </mat-slide-toggle>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary"
              [disabled]="!isValid() || saving()"
              (click)="save()">
        {{ saving() ? 'Saving...' : (data.mode === 'create' ? 'Create' : 'Save') }}
      </button>
    </mat-dialog-actions>
  `,
})
export class MailConfigDialogComponent {
  saving = signal(false);
  newEmail = '';

  form = {
    case_type_id: '',
    event: 'case_created' as MailEvent,
    recipient_type: 'owner' as RecipientType,
    custom_emails: [] as string[],
    subject_template: '[{{case_id}}] {{event_label}} — {{case_title}}',
    enabled: true,
  };

  eventOptions = Object.entries(MAIL_EVENT_LABELS).map(([value, label]) => ({ value, label }));
  recipientOptions = Object.entries(RECIPIENT_TYPE_LABELS).map(([value, label]) => ({ value, label }));

  constructor(
    private mailService: MailService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<MailConfigDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: MailConfigDialogData,
  ) {
    if (data.mode === 'edit' && data.config) {
      this.form = {
        case_type_id: data.config.case_type_id,
        event: data.config.event,
        recipient_type: data.config.recipient_type,
        custom_emails: [...(data.config.custom_emails || [])],
        subject_template: data.config.subject_template,
        enabled: data.config.enabled,
      };
    }
    if (data.preselectedCaseTypeId) {
      this.form.case_type_id = data.preselectedCaseTypeId;
    }
  }

  addEmail(event: Event): void {
    event.preventDefault();
    const email = this.newEmail.trim();
    if (email && email.includes('@') && !this.form.custom_emails.includes(email)) {
      this.form.custom_emails.push(email);
      this.newEmail = '';
    }
  }

  removeEmail(index: number): void {
    this.form.custom_emails.splice(index, 1);
  }

  isValid(): boolean {
    if (!this.form.case_type_id || !this.form.event || !this.form.recipient_type) return false;
    if (this.form.recipient_type === 'custom' && this.form.custom_emails.length === 0) return false;
    return true;
  }

  save(): void {
    this.saving.set(true);

    if (this.data.mode === 'create') {
      const payload: MailConfigCreate = {
        case_type_id: this.form.case_type_id,
        event: this.form.event,
        enabled: this.form.enabled,
        recipient_type: this.form.recipient_type,
        custom_emails: this.form.custom_emails,
        subject_template: this.form.subject_template,
      };
      this.mailService.createConfig(payload).subscribe({
        next: () => {
          this.snackBar.open('Email configuration created', 'OK', { duration: 2000 });
          this.dialogRef.close(true);
        },
        error: () => {
          this.saving.set(false);
          this.snackBar.open('Failed to create configuration', 'OK', { duration: 3000 });
        },
      });
    } else if (this.data.config) {
      this.mailService.updateConfig(this.data.config.id, {
        enabled: this.form.enabled,
        recipient_type: this.form.recipient_type,
        custom_emails: this.form.custom_emails,
        subject_template: this.form.subject_template,
      }).subscribe({
        next: () => {
          this.snackBar.open('Email configuration updated', 'OK', { duration: 2000 });
          this.dialogRef.close(true);
        },
        error: () => {
          this.saving.set(false);
          this.snackBar.open('Failed to update configuration', 'OK', { duration: 3000 });
        },
      });
    }
  }
}
