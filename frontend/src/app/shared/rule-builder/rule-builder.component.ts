import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface RuleCondition {
  type: 'simple' | 'group';
  // simple
  field?: string;
  operator?: string;
  value?: any;
  // group
  logic?: 'all' | 'any';
  children?: RuleCondition[];
}

const OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'ne', label: 'not equals' },
  { value: 'gt', label: 'is greater than' },
  { value: 'ge', label: 'is greater or equal' },
  { value: 'lt', label: 'is less than' },
  { value: 'le', label: 'is less or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'not_contains', label: 'does not contain' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'in', label: 'is one of' },
  { value: 'not_in', label: 'is not one of' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

@Component({
  selector: 'app-rule-builder',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <div class="rule-builder">
      @if (condition) {
        <ng-container *ngTemplateOutlet="conditionTpl; context: { $implicit: condition, depth: 0, parent: null, index: 0 }"></ng-container>
      } @else {
        <div class="text-center py-4 text-slate-400 text-sm border border-dashed border-slate-200 rounded-lg">
          No condition defined
          <div class="mt-2 flex gap-2 justify-center">
            <button mat-stroked-button (click)="addSimple()">
              <mat-icon class="mr-1">add</mat-icon> Add condition
            </button>
            <button mat-stroked-button (click)="addGroup()">
              <mat-icon class="mr-1">playlist_add</mat-icon> Add group
            </button>
          </div>
        </div>
      }
    </div>

    <ng-template #conditionTpl let-cond let-depth="depth" let-parent="parent" let-index="index">
      @if (cond.type === 'group') {
        <div class="border rounded-lg p-3 bg-slate-50/50"
             [class.ml-4]="depth > 0"
             [class.border-blue-200]="cond.logic === 'all'"
             [class.border-amber-200]="cond.logic === 'any'">
          <div class="flex items-center gap-2 mb-2">
            <mat-form-field appearance="outline" class="!w-28 dense-field">
              <mat-select [(ngModel)]="cond.logic" (ngModelChange)="emitChange()">
                <mat-option value="all">ALL of</mat-option>
                <mat-option value="any">ANY of</mat-option>
              </mat-select>
            </mat-form-field>
            <span class="text-xs text-slate-400">the following</span>
            <span class="flex-1"></span>
            @if (parent) {
              <button mat-icon-button class="!w-7 !h-7" (click)="removeChild(parent, index)">
                <mat-icon class="!text-base text-slate-400">close</mat-icon>
              </button>
            } @else {
              <button mat-icon-button class="!w-7 !h-7" (click)="clearAll()">
                <mat-icon class="!text-base text-red-400">delete</mat-icon>
              </button>
            }
          </div>

          <div class="space-y-2">
            @for (child of cond.children; track $index; let i = $index) {
              <ng-container *ngTemplateOutlet="conditionTpl; context: { $implicit: child, depth: depth + 1, parent: cond, index: i }"></ng-container>
            }
          </div>

          <div class="flex gap-2 mt-2">
            <button mat-stroked-button class="!text-xs" (click)="addChildSimple(cond)">
              <mat-icon class="!text-sm mr-1">add</mat-icon> Condition
            </button>
            <button mat-stroked-button class="!text-xs" (click)="addChildGroup(cond)">
              <mat-icon class="!text-sm mr-1">playlist_add</mat-icon> Group
            </button>
          </div>
        </div>
      } @else {
        <!-- Simple condition row -->
        <div class="flex items-center gap-2" [class.ml-4]="depth > 0">
          <mat-form-field appearance="outline" class="flex-1 dense-field">
            <mat-label>Field</mat-label>
            @if (fields.length > 0) {
              <mat-select [(ngModel)]="cond.field" (ngModelChange)="emitChange()">
                @for (f of fields; track f) {
                  <mat-option [value]="f">{{ f }}</mat-option>
                }
              </mat-select>
            } @else {
              <input matInput [(ngModel)]="cond.field" (ngModelChange)="emitChange()" placeholder="field_name">
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="!w-44 dense-field">
            <mat-select [(ngModel)]="cond.operator" (ngModelChange)="emitChange()">
              @for (op of operators; track op.value) {
                <mat-option [value]="op.value">{{ op.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (cond.operator !== 'is_empty' && cond.operator !== 'is_not_empty') {
            <mat-form-field appearance="outline" class="flex-1 dense-field">
              <mat-label>Value</mat-label>
              <input matInput [(ngModel)]="cond.value" (ngModelChange)="emitChange()" placeholder="value">
            </mat-form-field>
          }

          <button mat-icon-button class="!w-7 !h-7" (click)="removeChild(parent, index)">
            <mat-icon class="!text-base text-slate-400">close</mat-icon>
          </button>
        </div>
      }
    </ng-template>
  `,
  styles: [`
    :host ::ng-deep .dense-field .mat-mdc-form-field-infix {
      min-height: 36px !important;
      padding-top: 6px !important;
      padding-bottom: 6px !important;
    }
    :host ::ng-deep .dense-field .mat-mdc-text-field-wrapper {
      padding: 0 8px !important;
    }
    :host ::ng-deep .dense-field .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }
  `],
})
export class RuleBuilderComponent implements OnInit {
  @Input() condition: RuleCondition | null = null;
  @Input() fields: string[] = [];
  @Output() conditionChange = new EventEmitter<RuleCondition | null>();

  operators = OPERATORS;

  ngOnInit(): void {}

  emitChange(): void {
    this.conditionChange.emit(this.condition);
  }

  addSimple(): void {
    this.condition = { type: 'group', logic: 'all', children: [
      { type: 'simple', field: '', operator: 'eq', value: '' },
    ]};
    this.emitChange();
  }

  addGroup(): void {
    this.condition = { type: 'group', logic: 'all', children: [] };
    this.emitChange();
  }

  addChildSimple(group: RuleCondition): void {
    group.children = group.children || [];
    group.children.push({ type: 'simple', field: '', operator: 'eq', value: '' });
    this.emitChange();
  }

  addChildGroup(group: RuleCondition): void {
    group.children = group.children || [];
    group.children.push({ type: 'group', logic: 'any', children: [] });
    this.emitChange();
  }

  removeChild(parent: RuleCondition | null, index: number): void {
    if (parent && parent.children) {
      parent.children.splice(index, 1);
      if (parent.children.length === 0 && parent === this.condition) {
        this.condition = null;
      }
      this.emitChange();
    }
  }

  clearAll(): void {
    this.condition = null;
    this.emitChange();
  }

  // Convert UI model → API-compatible condition (CompoundCondition / SimpleCondition)
  static toApiCondition(rc: RuleCondition | null): Record<string, any> | null {
    if (!rc) return null;
    if (rc.type === 'simple') {
      return { field: rc.field, operator: rc.operator, value: rc.value };
    }
    const children = (rc.children || []).map(c => RuleBuilderComponent.toApiCondition(c)).filter(Boolean);
    if (children.length === 0) return null;
    return rc.logic === 'all' ? { all: children } : { any: children };
  }

  // Convert API condition → UI model
  static fromApiCondition(cond: Record<string, any> | null | undefined): RuleCondition | null {
    if (!cond) return null;
    if (cond['all']) {
      return {
        type: 'group', logic: 'all',
        children: (cond['all'] as any[]).map(c => RuleBuilderComponent.fromApiCondition(c)).filter(Boolean) as RuleCondition[],
      };
    }
    if (cond['any']) {
      return {
        type: 'group', logic: 'any',
        children: (cond['any'] as any[]).map(c => RuleBuilderComponent.fromApiCondition(c)).filter(Boolean) as RuleCondition[],
      };
    }
    if (cond['field']) {
      return { type: 'simple', field: cond['field'], operator: cond['operator'], value: cond['value'] };
    }
    return null;
  }
}
