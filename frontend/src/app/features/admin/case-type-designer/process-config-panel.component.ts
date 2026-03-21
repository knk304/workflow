import { Component, Input, Output, EventEmitter, OnChanges, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
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
    RuleBuilderComponent,
  ],
  template: `
    <mat-card class="!shadow-sm">
      <mat-card-header class="!px-4 !py-3 border-b border-gray-100">
        <mat-card-title class="!text-sm !font-semibold flex items-center gap-2">
          <mat-icon class="!text-lg text-[#056DAE]">{{ process.isParallel ? 'call_split' : 'format_list_numbered' }}</mat-icon>
          Process Configuration
        </mat-card-title>
      </mat-card-header>
      <mat-card-content class="!p-4">
        <div class="space-y-4">
          <mat-form-field class="w-full" >
            <mat-label>Process Name</mat-label>
            <input matInput [(ngModel)]="process.name" (ngModelChange)="emitChange()">
          </mat-form-field>

          <mat-form-field class="w-full" >
            <mat-label>Type</mat-label>
            <mat-select [(ngModel)]="process.type" (ngModelChange)="onTypeChange()">
              <mat-option value="sequential">Sequential</mat-option>
              <mat-option value="parallel">Parallel</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field class="w-full" >
            <mat-label>SLA (hours)</mat-label>
            <input matInput type="number" [(ngModel)]="process.slaHours" (ngModelChange)="emitChange()" min="0">
          </mat-form-field>

          <mat-form-field class="w-full" >
            <mat-label>Linked Flow</mat-label>
            <mat-select [(ngModel)]="process.flowId" (ngModelChange)="emitChange()">
              <mat-option [value]="null">— None —</mat-option>
              @for (flow of workflows; track flow.id) {
                <mat-option [value]="flow.id">{{ flow.name }}</mat-option>
              }
            </mat-select>
            <mat-hint>Optionally link a flow diagram to this process</mat-hint>
          </mat-form-field>

          <div>
            <label class="text-xs font-medium text-gray-600 mb-2 block">Start When</label>
            <app-rule-builder
              [condition]="startWhenCondition"
              [fields]="[]"
              (conditionChange)="onStartWhenChange($event)"
            ></app-rule-builder>
          </div>
        </div>

        <!-- Delete Button -->
        <div class="mt-4 pt-4 border-t border-gray-100">
          <button mat-stroked-button color="warn" class="w-full" (click)="deleteProcess.emit(process)">
            <mat-icon class="mr-1">delete</mat-icon> Delete Process
          </button>
        </div>
      </mat-card-content>
    </mat-card>
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
