import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MailService, MailSettings } from './mail.service';

@Component({
  selector: 'app-mail-test-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSnackBarModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title class="flex items-center gap-2">
      <mat-icon class="text-blue-600">send</mat-icon>
      Send Test Email
    </h2>

    <mat-dialog-content class="space-y-4 py-2">
      <!-- SMTP Status -->
      @if (settings()) {
        <div class="p-3 rounded-lg text-sm"
             [class]="settings()!.mail_enabled && settings()!.configured
               ? 'bg-green-50 text-green-700 border border-green-200'
               : 'bg-amber-50 text-amber-700 border border-amber-200'">
          @if (settings()!.mail_enabled && settings()!.configured) {
            <div class="flex items-center gap-2">
              <mat-icon style="font-size: 18px; width: 18px; height: 18px;">check_circle</mat-icon>
              SMTP: {{ settings()!.smtp_host }}:{{ settings()!.smtp_port }} ({{ settings()!.smtp_user }})
            </div>
          } @else if (!settings()!.mail_enabled) {
            <div class="flex items-center gap-2">
              <mat-icon style="font-size: 18px; width: 18px; height: 18px;">warning</mat-icon>
              Mail is disabled. Set MAIL_ENABLED=true in .env
            </div>
          } @else {
            <div class="flex items-center gap-2">
              <mat-icon style="font-size: 18px; width: 18px; height: 18px;">warning</mat-icon>
              SMTP credentials not configured. Set MAIL_SMTP_USER and MAIL_SMTP_PASSWORD in .env
            </div>
          }
        </div>
      }

      <mat-form-field class="w-full">
        <mat-label>Recipient Email</mat-label>
        <input matInput [(ngModel)]="toEmail" type="email" placeholder="user@example.com">
      </mat-form-field>

      <mat-form-field class="w-full">
        <mat-label>Subject</mat-label>
        <input matInput [(ngModel)]="subject">
      </mat-form-field>

      <mat-form-field class="w-full">
        <mat-label>Body</mat-label>
        <textarea matInput [(ngModel)]="body" rows="3"></textarea>
      </mat-form-field>

      @if (resultMessage()) {
        <div class="p-3 rounded-lg text-sm"
             [class]="resultSuccess() ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'">
          {{ resultMessage() }}
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
      <button mat-flat-button color="primary"
              [disabled]="!toEmail || sending()"
              (click)="send()">
        @if (sending()) {
          <mat-spinner diameter="20" class="inline-block mr-2"></mat-spinner>
          Sending...
        } @else {
          <ng-container>
            <mat-icon>send</mat-icon> Send Test
          </ng-container>
        }
      </button>
    </mat-dialog-actions>
  `,
})
export class MailTestDialogComponent {
  toEmail = '';
  subject = 'Test Email from Workflow Platform';
  body = 'This is a test email to verify SMTP configuration is working correctly.';

  sending = signal(false);
  settings = signal<MailSettings | null>(null);
  resultMessage = signal('');
  resultSuccess = signal(false);

  constructor(
    private mailService: MailService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<MailTestDialogComponent>,
  ) {
    this.mailService.getSettings().subscribe(s => this.settings.set(s));
  }

  send(): void {
    this.sending.set(true);
    this.resultMessage.set('');

    this.mailService.sendTestEmail({
      to_email: this.toEmail,
      subject: this.subject,
      body: this.body,
    }).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.resultSuccess.set(true);
        this.resultMessage.set(res.message || 'Test email sent successfully!');
      },
      error: (err) => {
        this.sending.set(false);
        this.resultSuccess.set(false);
        this.resultMessage.set(err.error?.detail || 'Failed to send test email');
      },
    });
  }
}
