import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DataService } from '../../core/services/data.service';
import { AuditLog } from '../../core/models';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <mat-icon class="text-gray-400">history</mat-icon>
        <h3 class="text-lg font-semibold text-gray-800">Audit Trail</h3>
      </div>

      @if (isLoading) {
        <div class="flex justify-center py-6">
          <mat-spinner diameter="28"></mat-spinner>
        </div>
      } @else if (auditLogs.length === 0) {
        <div class="text-center py-8">
          <mat-icon class="text-gray-300 text-4xl">history</mat-icon>
          <p class="text-gray-500 mt-2">No audit entries yet.</p>
        </div>
      } @else {
        <div class="space-y-3">
          @for (log of auditLogs; track log.id) {
            <div class="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-100">
              <!-- Action Icon -->
              <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                   [ngClass]="actionBgClass(log.action)">
                <mat-icon class="!text-base" [ngClass]="actionIconClass(log.action)">
                  {{ actionIcon(log.action) }}
                </mat-icon>
              </div>

              <!-- Details -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-medium text-sm text-gray-900">{{ log.actorName }}</span>
                  <mat-chip class="!text-xs">{{ log.action }}</mat-chip>
                  <span class="text-xs text-gray-500">{{ log.entityType }} · {{ log.entityId }}</span>
                </div>

                <!-- Changes -->
                @if (hasChanges(log)) {
                  <div class="mt-2 text-xs">
                    @for (key of changeKeys(log); track key) {
                      <div class="flex items-center gap-2 py-0.5">
                        <span class="text-gray-500 font-medium">{{ key }}:</span>
                        @if (log.changes.before[key] !== undefined) {
                          <span class="text-red-500 line-through">{{ log.changes.before[key] }}</span>
                          <mat-icon class="!text-xs !w-3 !h-3 text-gray-400">arrow_forward</mat-icon>
                        }
                        <span class="text-green-600">{{ log.changes.after[key] }}</span>
                      </div>
                    }
                  </div>
                }

                <p class="text-xs text-gray-400 mt-1">{{ log.timestamp | date:'medium' }}</p>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class AuditLogComponent implements OnInit, OnChanges {
  @Input() entityId: string = '';

  auditLogs: AuditLog[] = [];
  isLoading = false;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['entityId']) {
      this.loadLogs();
    }
  }

  loadLogs(): void {
    if (!this.entityId) return;
    this.isLoading = true;
    this.dataService.getAuditLogs(this.entityId).subscribe((logs) => {
      this.auditLogs = logs;
      this.isLoading = false;
    });
  }

  hasChanges(log: AuditLog): boolean {
    return Object.keys(log.changes.after).length > 0;
  }

  changeKeys(log: AuditLog): string[] {
    return [...new Set([
      ...Object.keys(log.changes.before || {}),
      ...Object.keys(log.changes.after || {}),
    ])];
  }

  actionIcon(action: string): string {
    const icons: Record<string, string> = {
      created: 'add_circle',
      updated: 'edit',
      assigned: 'person_add',
      transitioned: 'swap_horiz',
      deleted: 'delete',
    };
    return icons[action] || 'info';
  }

  actionBgClass(action: string): string {
    const classes: Record<string, string> = {
      created: 'bg-green-100',
      updated: 'bg-[#d0e8f7]',
      assigned: 'bg-purple-100',
      transitioned: 'bg-orange-100',
      deleted: 'bg-red-100',
    };
    return classes[action] || 'bg-gray-100';
  }

  actionIconClass(action: string): string {
    const classes: Record<string, string> = {
      created: 'text-green-600',
      updated: 'text-[#056DAE]',
      assigned: 'text-purple-600',
      transitioned: 'text-orange-600',
      deleted: 'text-red-600',
    };
    return classes[action] || 'text-gray-600';
  }
}
