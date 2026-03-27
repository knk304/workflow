import { Component, Input, Output, EventEmitter, OnChanges, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { ProcessDefinition, Workflow } from '@core/models';
import { RuleBuilderComponent, RuleCondition } from '@shared/rule-builder/rule-builder.component';
import { DataService } from '@core/services/data.service';

@Component({
  selector: 'app-process-config-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatDividerModule,
    RuleBuilderComponent,
  ],
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .panel-scroll {
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
    }
    .panel-scroll::-webkit-scrollbar { width: 4px; }
    .panel-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
    .section-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
    }
  `],
  template: `
    <div class="flex flex-col flex-1 overflow-hidden rounded-xl border border-slate-200 shadow-sm bg-white">

      <!-- ── Header ── -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-slate-200"
           [ngClass]="process.isParallel ? 'bg-gradient-to-r from-violet-50 to-white' : 'bg-gradient-to-r from-sky-50 to-white'">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
             [ngClass]="process.isParallel ? 'bg-violet-500' : 'bg-sky-500'">
          <mat-icon class="!text-[18px] text-white">{{ process.isParallel ? 'call_split' : 'format_list_numbered' }}</mat-icon>
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="text-sm font-bold text-slate-800 leading-tight truncate">{{ process.name || 'Untitled Process' }}</h2>
          <p class="text-[11px] text-slate-500 mt-0.5">{{ process.isParallel ? 'Parallel — steps run simultaneously' : 'Sequential — steps run one after another' }}</p>
        </div>
        <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0"
              [ngClass]="process.isParallel ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-sky-50 text-sky-700 border-sky-200'">
          {{ process.type | uppercase }}
        </span>
      </div>

      <!-- ── Scrollable content ── -->
      <div class="flex-1 overflow-y-auto panel-scroll p-4 space-y-5">

        <!-- ══ SECTION: Basic Information ══ -->
        <div>
          <div class="flex items-center gap-2 mb-0.5">
            <mat-icon class="!text-[15px] text-sky-500">drive_file_rename_outline</mat-icon>
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Basic Information</span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Name and execution mode for this process</p>
          <div class="section-card space-y-3">
            <mat-form-field class="w-full" subscriptSizing="dynamic">
              <mat-label>Process Name</mat-label>
              <input matInput [(ngModel)]="process.name" (ngModelChange)="emitChange()">
            </mat-form-field>

            <mat-form-field class="w-full" subscriptSizing="dynamic">
              <mat-label>Execution Type</mat-label>
              <mat-select [(ngModel)]="process.type" (ngModelChange)="onTypeChange()">
                <mat-option value="sequential">
                  <span class="flex items-center gap-2">
                    <mat-icon class="!text-base text-sky-500">format_list_numbered</mat-icon>
                    Sequential — steps run one after another
                  </span>
                </mat-option>
                <mat-option value="parallel">
                  <span class="flex items-center gap-2">
                    <mat-icon class="!text-base text-violet-500">call_split</mat-icon>
                    Parallel — all steps run simultaneously
                  </span>
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <!-- ══ SECTION: Execution Control ══ -->
        <div>
          <div class="flex items-center gap-2 mb-0.5">
            <mat-icon class="!text-[15px] text-emerald-500">schedule</mat-icon>
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Execution Control</span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Set time-based SLA targets for this process</p>
          <div class="section-card">
            <mat-form-field class="w-full" subscriptSizing="dynamic">
              <mat-label>SLA (hours)</mat-label>
              <mat-icon matPrefix class="!text-base mr-1 text-slate-400">schedule</mat-icon>
              <input matInput type="number" [(ngModel)]="process.slaHours" (ngModelChange)="emitChange()" min="0" placeholder="e.g. 48">
              <mat-hint>Leave blank for no SLA</mat-hint>
            </mat-form-field>
          </div>
        </div>

        <!-- ══ SECTION: Start When ══ -->
        <div>
          <div class="flex items-center gap-2 mb-0.5">
            <mat-icon class="!text-[15px] text-amber-500">play_circle</mat-icon>
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Start When</span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Optional conditions that must be satisfied before this process begins executing</p>
          <app-rule-builder
            [condition]="startWhenCondition"
            [fields]="[]"
            (conditionChange)="onStartWhenChange($event)"
          ></app-rule-builder>
        </div>

        <!-- ══ SECTION: Linked Flow ══ -->
        <div>
          <div class="flex items-center gap-2 mb-0.5">
            <mat-icon class="!text-[15px] text-indigo-500">account_tree</mat-icon>
            <span class="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Linked Flow</span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2.5 pl-6">Attach a visual flow diagram for documentation or runtime orchestration</p>
          <div class="section-card">
            <mat-form-field class="w-full" subscriptSizing="dynamic">
              <mat-label>Flow Diagram</mat-label>
              <mat-icon matPrefix class="!text-base mr-1 text-slate-400">account_tree</mat-icon>
              <mat-select [(ngModel)]="process.flowId" (ngModelChange)="emitChange()">
                <mat-option [value]="null">— No linked flow —</mat-option>
                @for (flow of workflows; track flow.id) {
                  <mat-option [value]="flow.id">{{ flow.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
        </div>

        <!-- ══ Danger Zone ══ -->
        <div class="pt-1">
          <mat-divider></mat-divider>
          <div class="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <div class="flex items-start gap-2 mb-2">
              <mat-icon class="!text-[15px] text-red-500 mt-0.5">warning</mat-icon>
              <div>
                <p class="text-[11px] font-bold text-red-700 uppercase tracking-wider">Danger Zone</p>
                <p class="text-[11px] text-red-500">Deleting a process removes all its steps. This cannot be undone.</p>
              </div>
            </div>
            <button mat-stroked-button class="w-full !border-red-300 !text-red-600 hover:!bg-red-100" (click)="deleteProcess.emit(process)">
              <mat-icon class="mr-1 !text-base">delete</mat-icon> Delete Process
            </button>
          </div>
        </div>

      </div>
    </div>
  `,
})
export class ProcessConfigPanelComponent implements OnChanges, OnInit {
  @Input() process!: ProcessDefinition;
  @Output() processChange = new EventEmitter<ProcessDefinition>();
  @Output() deleteProcess = new EventEmitter<ProcessDefinition>();

  private dataService = inject(DataService);
  workflows: Workflow[] = [];
  startWhenCondition: RuleCondition | null = null;

  ngOnInit(): void {
    this.dataService.getWorkflows().subscribe(wfs => this.workflows = wfs);
  }

  ngOnChanges(): void {
    this.startWhenCondition = RuleBuilderComponent.fromApiCondition(this.process.startWhen as any);
  }

  emitChange(): void {
    this.processChange.emit({ ...this.process });
  }

  onTypeChange(): void {
    this.process.isParallel = this.process.type === 'parallel';
    this.emitChange();
  }

  onStartWhenChange(cond: RuleCondition | null): void {
    this.startWhenCondition = cond;
    this.process.startWhen = RuleBuilderComponent.toApiCondition(cond);
    this.emitChange();
  }
}
