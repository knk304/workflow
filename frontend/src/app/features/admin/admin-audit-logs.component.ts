import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { ActivatedRoute } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { AuditLog, AuditCategory } from '../../core/models';

interface CategoryFilter {
  key: AuditCategory | 'all';
  label: string;
  icon: string;
  count: number;
}

@Component({
  selector: 'app-admin-audit-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatPaginatorModule,
  ],
  template: `
    <div class="space-y-5">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <mat-icon class="text-[#056DAE]">history</mat-icon>
            Audit Logs
          </h1>
          <p class="text-sm text-gray-500 mt-1">View system-wide audit trail — every action, decision, and state change</p>
        </div>
        <button mat-stroked-button (click)="loadLogs()" class="!border-gray-300">
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>
      </div>

      <!-- Search & Filters -->
      <mat-card class="!shadow-sm">
        <mat-card-content class="!p-4">
          <div class="flex flex-wrap gap-4 items-center">
            <mat-form-field class="flex-1 min-w-[200px] !text-sm">
              <mat-label>Search by Entity ID</mat-label>
              <input matInput [(ngModel)]="searchEntityId" placeholder="e.g. LOAN-001" (keyup.enter)="loadLogs()">
              <mat-icon matSuffix class="text-gray-400">search</mat-icon>
            </mat-form-field>
            <mat-form-field class="min-w-[160px] !text-sm">
              <mat-label>Entity Type</mat-label>
              <mat-select [(ngModel)]="searchEntityType" (selectionChange)="loadLogs()">
                <mat-option value="">All</mat-option>
                <mat-option value="case">Case</mat-option>
                <mat-option value="approval">Approval</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field class="min-w-[160px] !text-sm">
              <mat-label>Action</mat-label>
              <input matInput [(ngModel)]="searchAction" placeholder="e.g. decision_evaluated" (keyup.enter)="loadLogs()">
            </mat-form-field>
            <button mat-flat-button color="primary" (click)="loadLogs()" class="!h-[40px]">
              <mat-icon>filter_list</mat-icon>
              Filter
            </button>
            @if (hasActiveFilters()) {
              <button mat-stroked-button (click)="clearFilters()" class="!h-[40px] !border-gray-300">
                <mat-icon>clear</mat-icon>
                Clear
              </button>
            }
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Category Filter Chips -->
      @if (allLogs.length > 0) {
        <div class="flex flex-wrap gap-2">
          @for (cat of categories; track cat.key) {
            @if (cat.count > 0 || cat.key === 'all') {
              <button
                (click)="setCategory(cat.key)"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border"
                [ngClass]="activeCategory() === cat.key
                  ? 'bg-[#056DAE] text-white border-[#056DAE] shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'">
                <mat-icon class="!text-sm !w-4 !h-4">{{ cat.icon }}</mat-icon>
                {{ cat.label }}
                @if (cat.count > 0) {
                  <span class="ml-1 px-1.5 py-0 rounded-full text-[10px]"
                    [ngClass]="activeCategory() === cat.key
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-gray-500'">
                    {{ cat.count }}
                  </span>
                }
              </button>
            }
          }
        </div>
      }

      <!-- Loading -->
      @if (isLoading) {
        <div class="flex justify-center py-12">
          <mat-spinner diameter="36"></mat-spinner>
        </div>
      } @else if (filteredLogs().length === 0) {
        <mat-card class="!shadow-sm">
          <mat-card-content class="!py-12 text-center">
            <mat-icon class="!text-5xl text-gray-300">history</mat-icon>
            <p class="text-gray-500 mt-3 text-sm">
              @if (hasActiveFilters()) {
                No audit logs match your filters.
              } @else {
                No audit logs found.
              }
            </p>
          </mat-card-content>
        </mat-card>
      } @else {
        <!-- Results -->
        <div class="space-y-2">
          @for (log of paginatedLogs(); track log.id) {
            <div class="bg-white rounded-lg border border-gray-100 overflow-hidden transition-all"
                 [ngClass]="expandedId() === log.id ? 'ring-1 ring-[#056DAE]/30 shadow-sm' : 'hover:shadow-sm'">
              <!-- Main Row -->
              <div class="flex items-start gap-3 p-3 cursor-pointer hover:bg-gray-50/50"
                   (click)="toggleExpand(log.id)">
                <!-- Category Icon -->
                <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                     [ngClass]="categoryBg(log.category)">
                  <mat-icon class="!text-base" [ngClass]="categoryFg(log.category)">
                    {{ categoryIcon(log.category) }}
                  </mat-icon>
                </div>

                <!-- Summary -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-sm text-gray-900">{{ log.actorName || 'System' }}</span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                      [ngClass]="actionChipClass(log.action)">
                      {{ formatAction(log.action) }}
                    </span>
                    @if (log.category) {
                      <span class="text-[10px] text-gray-400 font-medium uppercase">{{ log.category }}</span>
                    }
                    <span class="text-[10px] font-mono text-gray-400">{{ log.entityId }}</span>
                  </div>
                  <p class="text-xs text-gray-600 mt-0.5 truncate">{{ getLogSummary(log) }}</p>
                  <p class="text-[10px] text-gray-400 mt-0.5">{{ getRelativeTime(log.timestamp) }} · {{ log.timestamp | date:'medium' }}</p>
                </div>

                <!-- Expand -->
                <mat-icon class="!text-sm text-gray-400 flex-shrink-0 transition-transform"
                  [ngClass]="expandedId() === log.id ? 'rotate-180' : ''">
                  expand_more
                </mat-icon>
              </div>

              <!-- Expanded Details -->
              @if (expandedId() === log.id) {
                <div class="border-t border-gray-100 bg-gray-50/50 px-4 py-3 space-y-3">
                  <!-- Changes -->
                  @if (hasChanges(log)) {
                    <div>
                      <div class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Changes</div>
                      <div class="bg-white rounded border border-gray-100 divide-y divide-gray-50">
                        @for (key of changeKeys(log); track key) {
                          <div class="flex items-center gap-3 px-3 py-1.5 text-xs">
                            <span class="text-gray-500 font-medium min-w-[100px]">{{ key }}</span>
                            @if (log.changes.before && log.changes.before[key] !== undefined) {
                              <span class="text-red-500 line-through bg-red-50 px-1.5 py-0.5 rounded">{{ formatValue(log.changes.before[key]) }}</span>
                              <mat-icon class="!text-xs !w-3 !h-3 text-gray-300">arrow_forward</mat-icon>
                            }
                            @if (log.changes.after && log.changes.after[key] !== undefined) {
                              <span class="text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{{ formatValue(log.changes.after[key]) }}</span>
                            }
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Decision Details -->
                  @if (log.category === 'decision' && log.details) {
                    <div>
                      <div class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Decision Evaluation</div>
                      <div class="bg-white rounded border border-gray-100 p-3 space-y-2">
                        @if (log.details['mode']) {
                          <div class="flex gap-2 text-xs"><span class="text-gray-500 font-medium">Mode:</span><span>{{ log.details['mode'] }}</span></div>
                        }
                        @if (log.details['input']) {
                          <div>
                            <span class="text-[10px] text-gray-500 font-medium">Input:</span>
                            <div class="mt-1 bg-gray-50 rounded p-2 font-mono text-[11px] overflow-x-auto">
                              @for (entry of objectEntries(log.details['input']); track entry[0]) {
                                <div><span class="text-blue-600">{{ entry[0] }}</span>: {{ formatValue(entry[1]) }}</div>
                              }
                            </div>
                          </div>
                        }
                        @if (log.details['branch_taken']) {
                          <div class="flex gap-2 text-xs">
                            <span class="text-gray-500 font-medium">Branch Taken:</span>
                            <span class="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">{{ log.details['branch_taken'] }}</span>
                          </div>
                        }
                        @if (log.details['branches_available']?.length) {
                          <div class="flex gap-2 text-xs flex-wrap">
                            <span class="text-gray-500 font-medium">All Branches:</span>
                            @for (b of log.details['branches_available']; track b) {
                              <span class="px-1.5 py-0.5 rounded text-[10px]"
                                [ngClass]="b === log.details['branch_taken'] ? 'bg-green-50 text-green-700 font-semibold' : 'bg-gray-100 text-gray-500'">{{ b }}</span>
                            }
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Rule Details -->
                  @if (log.category === 'rule' && log.details) {
                    <div>
                      <div class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Rule Evaluation</div>
                      <div class="bg-white rounded border border-gray-100 p-3 space-y-2">
                        @if (log.details['context']) {
                          <div class="text-xs">Context: <span class="font-medium">{{ log.details['context'] }}</span></div>
                        }
                        @if (log.details['result'] !== undefined) {
                          <div class="flex items-center gap-2 text-xs">
                            <span class="text-gray-500">Result:</span>
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium"
                              [ngClass]="log.details['result'] ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'">
                              <mat-icon class="!text-sm !w-4 !h-4">{{ log.details['result'] ? 'check_circle' : 'cancel' }}</mat-icon>
                              {{ log.details['result'] ? 'TRUE' : 'FALSE' }}
                            </span>
                          </div>
                        }
                        @if (log.details['condition']) {
                          <pre class="bg-gray-50 rounded p-2 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">{{ log.details['condition'] | json }}</pre>
                        }
                      </div>
                    </div>
                  }

                  <!-- Automation Details -->
                  @if (log.category === 'automation' && log.details) {
                    <div>
                      <div class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Automation Actions</div>
                      <div class="bg-white rounded border border-gray-100 divide-y divide-gray-50">
                        @for (action of log.details['actions'] || []; track $index) {
                          <div class="px-3 py-2 text-xs flex items-center gap-2">
                            <mat-icon class="!text-sm text-amber-500">{{ getAutomationIcon(action['type']) }}</mat-icon>
                            <span class="font-medium">{{ action['type'] }}</span>
                            @if (action['field']) {
                              <span class="text-gray-500">→ {{ action['field'] }} = {{ formatValue(action['value']) }}</span>
                            }
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Approval Details -->
                  @if (log.category === 'approval' && log.details) {
                    <div>
                      <div class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Approval</div>
                      <div class="bg-white rounded border border-gray-100 p-3 space-y-2 text-xs">
                        @if (log.details['decision']) {
                          <div class="flex items-center gap-2">
                            <span class="text-gray-500">Decision:</span>
                            <span class="px-2 py-0.5 rounded font-medium"
                              [ngClass]="log.details['decision'] === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'">
                              {{ log.details['decision'] }}
                            </span>
                          </div>
                        }
                        @if (log.details['notes']) {
                          <div><span class="text-gray-500">Notes:</span> <span class="italic">{{ log.details['notes'] }}</span></div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Subprocess Details -->
                  @if (log.category === 'subprocess' && log.details) {
                    <div>
                      <div class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Subprocess</div>
                      <div class="bg-white rounded border border-gray-100 p-3 space-y-1 text-xs">
                        @if (log.details['child_case_id']) {
                          <div><span class="text-gray-500">Child Case:</span> <span class="font-medium text-[#056DAE]">{{ log.details['child_case_id'] }}</span></div>
                        }
                        @if (log.details['resolution_status']) {
                          <div><span class="text-gray-500">Resolution:</span> <span class="font-medium">{{ log.details['resolution_status'] }}</span></div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Evaluation Trace -->
                  @if (getTraceEntries(log).length > 0) {
                    <div>
                      <div class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Evaluation Trace</div>
                      <div class="bg-gray-900 rounded p-3 font-mono text-[11px] text-green-400 space-y-0.5 overflow-x-auto max-h-48 overflow-y-auto">
                        @for (line of getTraceEntries(log); track $index) {
                          <div class="flex gap-2">
                            <span class="text-gray-600 select-none">{{ $index + 1 }}.</span>
                            <span [ngClass]="getTraceLineClass(line)">{{ line }}</span>
                          </div>
                        }
                      </div>
                    </div>
                  }

                  <!-- Generic Details -->
                  @if (!['decision','rule','automation','approval','subprocess'].includes(log.category) && hasDetails(log)) {
                    <div>
                      <div class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Details</div>
                      <div class="bg-white rounded border border-gray-100 p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        @for (entry of objectEntries(log.details); track entry[0]) {
                          @if (!isObject(entry[1])) {
                            <div class="text-gray-500">{{ entry[0] }}</div>
                            <div class="text-gray-800 font-medium">{{ formatValue(entry[1]) }}</div>
                          }
                        }
                      </div>
                    </div>
                  }

                  <!-- Metadata -->
                  <div class="flex items-center gap-4 text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                    <span>{{ log.timestamp | date:'medium' }}</span>
                    <span>{{ log.entityType }} · {{ log.entityId }}</span>
                    @if (log.correlationId) {
                      <span matTooltip="Correlation ID" class="font-mono">{{ log.correlationId | slice:0:8 }}…</span>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Paginator -->
        <mat-paginator
          [length]="filteredLogs().length"
          [pageSize]="pageSize"
          [pageSizeOptions]="[25, 50, 100]"
          (page)="onPageChange($event)"
          showFirstLastButtons>
        </mat-paginator>
      }
    </div>
  `,
  styles: [`
    :host ::ng-deep .dense-field .mat-mdc-form-field-infix {
      min-height: 40px !important;
      padding-top: 8px !important;
      padding-bottom: 8px !important;
    }
    :host ::ng-deep .dense-field .mat-mdc-text-field-wrapper {
      height: 40px;
    }
    :host ::ng-deep .dense-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }
  `],
})
export class AdminAuditLogsComponent implements OnInit {
  allLogs: AuditLog[] = [];
  isLoading = false;
  searchEntityId = '';
  searchEntityType = '';
  searchAction = '';
  activeCategory = signal<AuditCategory | 'all'>('all');
  expandedId = signal<string | null>(null);
  pageIndex = 0;
  pageSize = 50;

  categories: CategoryFilter[] = [
    { key: 'all', label: 'All', icon: 'list', count: 0 },
    { key: 'case', label: 'Case', icon: 'folder', count: 0 },
    { key: 'stage', label: 'Stage', icon: 'flag', count: 0 },
    { key: 'process', label: 'Process', icon: 'account_tree', count: 0 },
    { key: 'step', label: 'Step', icon: 'task_alt', count: 0 },
    { key: 'decision', label: 'Decision', icon: 'call_split', count: 0 },
    { key: 'rule', label: 'Rule', icon: 'gavel', count: 0 },
    { key: 'approval', label: 'Approval', icon: 'how_to_reg', count: 0 },
    { key: 'assignment', label: 'Assignment', icon: 'assignment_ind', count: 0 },
    { key: 'automation', label: 'Automation', icon: 'smart_toy', count: 0 },
    { key: 'subprocess', label: 'Subprocess', icon: 'mediation', count: 0 },
    { key: 'field', label: 'Field', icon: 'edit_note', count: 0 },
  ];

  constructor(private dataService: DataService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const entityId = this.route.snapshot.queryParamMap.get('entityId');
    if (entityId) {
      this.searchEntityId = entityId;
    }
    this.loadLogs();
  }

  loadLogs(): void {
    this.isLoading = true;
    this.pageIndex = 0;
    // Use entityId filter if provided, otherwise load recent logs without entityId filter
    const entityId = this.searchEntityId.trim();
    const category = this.activeCategory() === 'all' ? undefined : this.activeCategory();
    this.dataService.getAuditLogs(entityId || '', category).subscribe({
      next: (logs) => {
        this.allLogs = logs;
        this.updateCategoryCounts();
        this.isLoading = false;
      },
      error: () => {
        this.allLogs = [];
        this.isLoading = false;
      },
    });
  }

  private updateCategoryCounts(): void {
    const counts: Record<string, number> = {};
    for (const log of this.allLogs) {
      const cat = log.category || 'case';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    for (const cat of this.categories) {
      cat.count = cat.key === 'all' ? this.allLogs.length : (counts[cat.key] || 0);
    }
  }

  setCategory(key: AuditCategory | 'all'): void {
    this.activeCategory.set(key);
    this.expandedId.set(null);
    this.pageIndex = 0;
  }

  filteredLogs(): AuditLog[] {
    let logs = this.allLogs;
    const cat = this.activeCategory();
    if (cat !== 'all') {
      logs = logs.filter(l => (l.category || 'case') === cat);
    }
    if (this.searchAction.trim()) {
      const q = this.searchAction.trim().toLowerCase();
      logs = logs.filter(l => l.action.toLowerCase().includes(q));
    }
    return logs;
  }

  paginatedLogs(): AuditLog[] {
    const start = this.pageIndex * this.pageSize;
    return this.filteredLogs().slice(start, start + this.pageSize);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  hasActiveFilters(): boolean {
    return !!(this.searchEntityId.trim() || this.searchEntityType || this.searchAction.trim());
  }

  clearFilters(): void {
    this.searchEntityId = '';
    this.searchEntityType = '';
    this.searchAction = '';
    this.activeCategory.set('all');
    this.loadLogs();
  }

  hasChanges(log: AuditLog): boolean {
    const b = log.changes?.before || {};
    const a = log.changes?.after || {};
    return Object.keys(b).length > 0 || Object.keys(a).length > 0;
  }

  changeKeys(log: AuditLog): string[] {
    return [...new Set([
      ...Object.keys(log.changes?.before || {}),
      ...Object.keys(log.changes?.after || {}),
    ])];
  }

  hasDetails(log: AuditLog): boolean {
    return !!log.details && Object.keys(log.details).length > 0;
  }

  objectEntries(obj: Record<string, any> | undefined): [string, any][] {
    return obj ? Object.entries(obj) : [];
  }

  isObject(val: any): boolean {
    return val !== null && typeof val === 'object';
  }

  formatValue(val: any): string {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  formatAction(action: string): string {
    return action.replace(/_/g, ' ').replace(/:/g, ': ');
  }

  getLogSummary(log: AuditLog): string {
    const d = log.details || {};
    switch (log.category) {
      case 'case': return d['title'] ? `${d['case_type'] || ''} — ${d['title']}` : (d['resolution_status'] || log.action);
      case 'stage': return d['stage_name'] || d['stage_id'] || log.action;
      case 'process': return d['process_name'] || d['process_id'] || log.action;
      case 'step': return `${d['step_name'] || ''} (${d['step_type'] || ''})`;
      case 'decision': return `${d['step_name'] || 'Decision'} → ${d['branch_taken'] || d['output'] || '?'}`;
      case 'rule': return `${d['context'] || 'Rule'} → ${d['result'] ? 'TRUE' : 'FALSE'}`;
      case 'approval': return `${d['step_name'] || ''} ${d['decision'] || d['mode'] || ''}`.trim();
      case 'assignment': return `${d['step_name'] || ''} → ${d['assigned_to'] || d['assigned_role'] || 'unassigned'}`;
      case 'automation': return `${d['step_name'] || 'Automation'} — ${(d['actions'] || []).length} actions`;
      case 'subprocess': return `${d['child_case_id'] || ''} ${d['resolution_status'] || ''}`.trim();
      case 'field': return (d['updated_fields'] || []).length > 0 ? `Updated: ${d['updated_fields'].join(', ')}` : log.action;
      default: return log.action;
    }
  }

  getTraceEntries(log: AuditLog): string[] {
    return log.details?.['evaluation_trace'] || [];
  }

  getTraceLineClass(line: string): string {
    if (line.includes('→ True') || line.includes('matched')) return 'text-green-400';
    if (line.includes('→ False') || line.includes('NOT match')) return 'text-red-400';
    if (line.includes('AND') || line.includes('OR')) return 'text-yellow-300';
    return 'text-gray-300';
  }

  getAutomationIcon(actionType: string): string {
    return ({ set_field: 'edit', send_notification: 'notifications', change_stage: 'swap_horiz', call_webhook: 'webhook' } as Record<string, string>)[actionType] || 'settings';
  }

  categoryIcon(cat: string): string {
    return this.categories.find(c => c.key === cat)?.icon || 'info';
  }

  categoryBg(cat: string): string {
    return ({ case: 'bg-blue-100', stage: 'bg-indigo-100', process: 'bg-purple-100', step: 'bg-teal-100', decision: 'bg-amber-100', rule: 'bg-orange-100', approval: 'bg-green-100', assignment: 'bg-cyan-100', automation: 'bg-yellow-100', subprocess: 'bg-pink-100', field: 'bg-gray-100', sla: 'bg-red-100' } as Record<string, string>)[cat] || 'bg-gray-100';
  }

  categoryFg(cat: string): string {
    return ({ case: 'text-blue-600', stage: 'text-indigo-600', process: 'text-purple-600', step: 'text-teal-600', decision: 'text-amber-600', rule: 'text-orange-600', approval: 'text-green-600', assignment: 'text-cyan-600', automation: 'text-yellow-700', subprocess: 'text-pink-600', field: 'text-gray-600', sla: 'text-red-600' } as Record<string, string>)[cat] || 'text-gray-600';
  }

  actionChipClass(action: string): string {
    if (action.includes('created') || action.includes('entered')) return 'bg-green-50 text-green-700';
    if (action.includes('completed') || action.includes('resolved') || action.includes('approved')) return 'bg-blue-50 text-blue-700';
    if (action.includes('skipped') || action.includes('cancelled')) return 'bg-gray-100 text-gray-600';
    if (action.includes('rejected')) return 'bg-red-50 text-red-700';
    if (action.includes('evaluated') || action.includes('decision')) return 'bg-amber-50 text-amber-700';
    if (action.includes('changed') || action.includes('updated')) return 'bg-orange-50 text-orange-700';
    return 'bg-gray-50 text-gray-600';
  }

  getRelativeTime(dateStr: string): string {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }
}
