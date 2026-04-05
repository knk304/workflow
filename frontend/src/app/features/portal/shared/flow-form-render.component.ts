import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FlowNode, FlowField, FormDefinition, FormField } from '@core/models';

export interface FieldAnswerChange {
  fieldId: string;
  value: unknown;
}

/**
 * Renders the fields list + completion bar for a single question node.
 * Handles both "linked form" mode (FormDefinition fields) and
 * "custom fields" mode (FlowField array on the node itself).
 *
 * Parent is responsible for loading linkedFormDef and for storing answers.
 * All answer mutations are communicated upward via (answerChange).
 */
@Component({
  selector: 'app-flow-form-render',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <!-- Fields List -->
    <div>
      @if (formSource === 'linked') {
        <!-- ── LINKED FORM MODE ── -->
        @if (linkedFormLoading) {
          <div class="px-6 py-10 text-center">
            <p class="text-xs text-slate-400">Loading form fields…</p>
          </div>
        } @else if (linkedFormDef) {
          @for (field of linkedFields(); track field.id; let fi = $index) {
            @if (isLinkedVisible(field)) {
              <div class="px-6 py-4 border-b border-slate-50 last:border-0 transition-colors"
                   [ngClass]="focusedField() === field.id ? 'bg-slate-50' : ''">

                <!-- Label row -->
                <div class="flex items-baseline justify-between mb-2">
                  <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    <span class="w-4 h-4 rounded bg-slate-100 text-slate-400 text-[9px] font-bold flex items-center justify-center">{{ fi + 1 }}</span>
                    {{ field.label }}
                    @if (field.validation.required) {
                      <span class="text-red-500 font-bold">*</span>
                    }
                  </label>
                  @if (hasAnswer(field.id)) {
                    <span class="text-[10px] text-green-600 flex items-center gap-0.5 font-medium">
                      <mat-icon class="!text-[10px] !w-3 !h-3">check_circle</mat-icon> Answered
                    </span>
                  }
                </div>

                <!-- Controls — FormField uses validation.options: string[] -->
                @switch (field.type) {
                  @case ('text') {
                    <div class="runner-input-wrap" [class.focused]="focusedField() === field.id">
                      <input class="runner-input"
                             [placeholder]="field.placeholder || 'Enter ' + field.label"
                             [value]="getAnswer(field.id) ?? ''"
                             (focus)="focusedField.set(field.id)"
                             (blur)="focusedField.set(null)"
                             (input)="emitEvent(field.id, $event)">
                    </div>
                  }
                  @case ('textarea') {
                    <div class="runner-input-wrap" [class.focused]="focusedField() === field.id">
                      <textarea class="runner-input runner-textarea" rows="3"
                                [placeholder]="field.placeholder || 'Enter ' + field.label"
                                [value]="getAnswer(field.id) ?? ''"
                                (focus)="focusedField.set(field.id)"
                                (blur)="focusedField.set(null)"
                                (input)="emitEvent(field.id, $event)"></textarea>
                    </div>
                  }
                  @case ('number') {
                    <div class="runner-input-wrap max-w-xs" [class.focused]="focusedField() === field.id">
                      <input class="runner-input" type="number"
                             [placeholder]="field.placeholder || '0'"
                             [value]="getAnswer(field.id) ?? ''"
                             (focus)="focusedField.set(field.id)"
                             (blur)="focusedField.set(null)"
                             (input)="emitEvent(field.id, $event)">
                    </div>
                  }
                  @case ('date') {
                    <div class="runner-input-wrap max-w-xs" [class.focused]="focusedField() === field.id">
                      <input class="runner-input" type="date"
                             [value]="getAnswer(field.id) ?? ''"
                             (focus)="focusedField.set(field.id)"
                             (blur)="focusedField.set(null)"
                             (input)="emitEvent(field.id, $event)">
                    </div>
                  }
                  @case ('select') {
                    <div class="runner-input-wrap runner-select-wrap" [class.focused]="focusedField() === field.id">
                      <select class="runner-input runner-select"
                              [value]="getAnswer(field.id) ?? ''"
                              (focus)="focusedField.set(field.id)"
                              (blur)="focusedField.set(null)"
                              (change)="emit(field.id, $any($event.target).value)">
                        <option value="" disabled>Select an option…</option>
                        @for (opt of field.validation.options || []; track opt) {
                          <option [value]="opt">{{ opt }}</option>
                        }
                      </select>
                      <mat-icon class="runner-select-icon">expand_more</mat-icon>
                    </div>
                  }
                  @case ('radio') {
                    <div class="flex flex-wrap gap-2">
                      @for (opt of field.validation.options || []; track opt) {
                        <button type="button"
                                class="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all"
                                [ngClass]="getAnswer(field.id) === opt
                                  ? 'border-[#056DAE] bg-[#EAF4FB] text-[#056DAE] shadow-sm'
                                  : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'"
                                (click)="emit(field.id, opt)">
                          <div class="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
                               [ngClass]="getAnswer(field.id) === opt ? 'border-[#056DAE]' : 'border-slate-300'">
                            @if (getAnswer(field.id) === opt) {
                              <div class="w-1.5 h-1.5 rounded-full bg-[#056DAE]"></div>
                            }
                          </div>
                          {{ opt }}
                        </button>
                      }
                    </div>
                  }
                  @case ('checkbox') {
                    <button type="button"
                            class="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all"
                            [ngClass]="isChecked(field.id)
                              ? 'border-[#056DAE] bg-[#EAF4FB] text-[#056DAE]'
                              : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'"
                            (click)="emit(field.id, !isChecked(field.id))">
                      <div class="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0"
                           [ngClass]="isChecked(field.id) ? 'border-[#056DAE] bg-[#056DAE]' : 'border-slate-300'">
                        @if (isChecked(field.id)) {
                          <mat-icon class="!text-[10px] !w-3 !h-3 text-white">check</mat-icon>
                        }
                      </div>
                      {{ field.label }}
                    </button>
                  }
                  @case ('file') {
                    <div class="runner-input-wrap">
                      <span class="runner-input text-slate-400 select-none flex-1">
                        {{ getAnswer(field.id) || 'Choose file…' }}
                      </span>
                      <label class="mr-2 px-2 py-1 rounded bg-slate-100 text-slate-500 text-xs cursor-pointer hover:bg-slate-200">
                        Browse
                        <input type="file" class="hidden"
                               (change)="emit(field.id, $any($event.target).files?.[0]?.name)">
                      </label>
                    </div>
                  }
                  @case ('grid') {
                    <div class="grid gap-3"
                         [style.grid-template-columns]="'repeat(' + (field.gridConfig?.columns || 2) + ', 1fr)'">
                      @for (cell of (field.gridConfig?.cells || []); track $index) {
                        @if (cell) {
                          <div>
                            <p class="text-[10px] font-semibold text-slate-500 mb-1">{{ cell.label }}</p>
                            @if (cell.type === 'select') {
                              <div class="runner-input-wrap runner-select-wrap">
                                <select class="runner-input runner-select"
                                        [value]="getAnswer(cell.id) ?? ''"
                                        (change)="emit(cell.id, $any($event.target).value)">
                                  <option value="" disabled>Select…</option>
                                  @for (opt of cell.validation.options || []; track opt) {
                                    <option [value]="opt">{{ opt }}</option>
                                  }
                                </select>
                                <mat-icon class="runner-select-icon">expand_more</mat-icon>
                              </div>
                            } @else if (cell.type === 'checkbox') {
                              <button type="button"
                                      class="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all"
                                      [ngClass]="isChecked(cell.id)
                                        ? 'border-[#056DAE] bg-[#EAF4FB] text-[#056DAE]'
                                        : 'border-slate-200 text-slate-600 bg-white'"
                                      (click)="emit(cell.id, !isChecked(cell.id))">
                                <div class="w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0"
                                     [ngClass]="isChecked(cell.id) ? 'border-[#056DAE] bg-[#056DAE]' : 'border-slate-300'">
                                  @if (isChecked(cell.id)) {
                                    <mat-icon class="!text-[9px] !w-2.5 !h-2.5 text-white">check</mat-icon>
                                  }
                                </div>
                                {{ cell.label }}
                              </button>
                            } @else {
                              <div class="runner-input-wrap">
                                <input class="runner-input"
                                       [type]="cell.type === 'number' ? 'number' : cell.type === 'date' ? 'date' : 'text'"
                                       [placeholder]="cell.placeholder || ''"
                                       [value]="getAnswer(cell.id) ?? ''"
                                       (input)="emitEvent(cell.id, $event)">
                              </div>
                            }
                          </div>
                        }
                      }
                    </div>
                  }
                  @default {
                    <div class="runner-input-wrap" [class.focused]="focusedField() === field.id">
                      <input class="runner-input"
                             [placeholder]="field.placeholder || ''"
                             [value]="getAnswer(field.id) ?? ''"
                             (focus)="focusedField.set(field.id)"
                             (blur)="focusedField.set(null)"
                             (input)="emitEvent(field.id, $event)">
                    </div>
                  }
                }

              </div>
            }
          }
        } @else {
          <div class="px-6 py-10 text-center">
            <p class="text-xs text-red-400">No form linked. Configure a form in the Workflow Designer.</p>
          </div>
        }
      } @else {
        <!-- ── CUSTOM FIELDS MODE ── -->
        @for (field of node.fields; track field.id; let fi = $index) {
          @if (field.type === 'alert') {
            <div class="px-6 py-3 border-b border-slate-50 last:border-0">
              <div class="rounded-xl px-4 py-3 flex items-start gap-3"
                   [ngClass]="alertBoxClass(field.placeholder || 'info')">
                <mat-icon class="!text-base !w-5 !h-5 shrink-0 mt-0.5"
                          [ngClass]="alertIconClass(field.placeholder || 'info')">
                  {{ alertIcon(field.placeholder || 'info') }}
                </mat-icon>
                <div>
                  <p class="text-sm font-semibold mb-0.5">{{ field.label }}</p>
                  <p class="text-xs opacity-90">{{ field.defaultValue || '' }}</p>
                </div>
              </div>
            </div>
          } @else {
            <div class="px-6 py-4 border-b border-slate-50 last:border-0 transition-colors"
                 [ngClass]="focusedField() === field.id ? 'bg-slate-50' : ''">

              <!-- Label row -->
              <div class="flex items-baseline justify-between mb-2">
                <label class="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  <span class="w-4 h-4 rounded bg-slate-100 text-slate-400 text-[9px] font-bold flex items-center justify-center">{{ fi + 1 }}</span>
                  {{ field.label }}
                  @if (field.validation.required) {
                    <span class="text-red-500 font-bold">*</span>
                  }
                </label>
                @if (hasAnswer(field.id)) {
                  <span class="text-[10px] text-green-600 flex items-center gap-0.5 font-medium">
                    <mat-icon class="!text-[10px] !w-3 !h-3">check_circle</mat-icon> Answered
                  </span>
                }
              </div>

              @if (field.helpText) {
                <p class="text-xs text-slate-400 mb-2 leading-relaxed">{{ field.helpText }}</p>
              }

              <!-- Controls — FlowField uses options: FlowFieldOption[] with .value/.label -->
              @switch (field.type) {
                @case ('text') {
                  <div class="runner-input-wrap" [class.focused]="focusedField() === field.id">
                    <input class="runner-input"
                           [placeholder]="field.placeholder || 'Enter ' + field.label"
                           [value]="getAnswer(field.id) ?? field.defaultValue ?? ''"
                           (focus)="focusedField.set(field.id)"
                           (blur)="focusedField.set(null)"
                           (input)="emitEvent(field.id, $event)">
                  </div>
                }
                @case ('textarea') {
                  <div class="runner-input-wrap" [class.focused]="focusedField() === field.id">
                    <textarea class="runner-input runner-textarea" rows="3"
                              [placeholder]="field.placeholder || 'Enter ' + field.label"
                              [value]="getAnswer(field.id) ?? field.defaultValue ?? ''"
                              (focus)="focusedField.set(field.id)"
                              (blur)="focusedField.set(null)"
                              (input)="emitEvent(field.id, $event)"></textarea>
                  </div>
                }
                @case ('number') {
                  <div class="runner-input-wrap max-w-xs" [class.focused]="focusedField() === field.id">
                    <input class="runner-input" type="number"
                           [placeholder]="field.placeholder || '0'"
                           [value]="getAnswer(field.id) ?? field.defaultValue ?? ''"
                           (focus)="focusedField.set(field.id)"
                           (blur)="focusedField.set(null)"
                           (input)="emitEvent(field.id, $event)">
                  </div>
                }
                @case ('date') {
                  <div class="runner-input-wrap max-w-xs" [class.focused]="focusedField() === field.id">
                    <input class="runner-input" type="date"
                           [value]="getAnswer(field.id) ?? field.defaultValue ?? ''"
                           (focus)="focusedField.set(field.id)"
                           (blur)="focusedField.set(null)"
                           (input)="emitEvent(field.id, $event)">
                  </div>
                }
                @case ('select') {
                  <div class="runner-input-wrap runner-select-wrap" [class.focused]="focusedField() === field.id">
                    <select class="runner-input runner-select"
                            [value]="getAnswer(field.id) ?? field.defaultValue ?? ''"
                            (focus)="focusedField.set(field.id)"
                            (blur)="focusedField.set(null)"
                            (change)="emit(field.id, $any($event.target).value)">
                      <option value="" disabled>Select an option…</option>
                      @for (opt of field.options; track opt.value) {
                        <option [value]="opt.value">{{ opt.label }}</option>
                      }
                    </select>
                    <mat-icon class="runner-select-icon">expand_more</mat-icon>
                  </div>
                }
                @case ('radio') {
                  <div class="flex flex-wrap gap-2">
                    @for (opt of field.options; track opt.value) {
                      <button type="button"
                              class="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all"
                              [ngClass]="getAnswer(field.id) === opt.value
                                ? 'border-[#056DAE] bg-[#EAF4FB] text-[#056DAE] shadow-sm'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'"
                              (click)="emit(field.id, opt.value)">
                        <div class="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0"
                             [ngClass]="getAnswer(field.id) === opt.value ? 'border-[#056DAE]' : 'border-slate-300'">
                          @if (getAnswer(field.id) === opt.value) {
                            <div class="w-1.5 h-1.5 rounded-full bg-[#056DAE]"></div>
                          }
                        </div>
                        {{ opt.label }}
                      </button>
                    }
                  </div>
                }
                @case ('checkbox') {
                  <button type="button"
                          class="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all"
                          [ngClass]="isChecked(field.id)
                            ? 'border-[#056DAE] bg-[#EAF4FB] text-[#056DAE]'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'"
                          (click)="emit(field.id, !isChecked(field.id))">
                    <div class="w-4 h-4 rounded border-2 flex items-center justify-center shrink-0"
                         [ngClass]="isChecked(field.id) ? 'border-[#056DAE] bg-[#056DAE]' : 'border-slate-300'">
                      @if (isChecked(field.id)) {
                        <mat-icon class="!text-[10px] !w-3 !h-3 text-white">check</mat-icon>
                      }
                    </div>
                    {{ field.label }}
                  </button>
                }
                @case ('multi_select') {
                  <div class="flex flex-wrap gap-2">
                    @for (opt of field.options; track opt.value) {
                      <button type="button"
                              class="flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all"
                              [ngClass]="isMultiSelected(field.id, opt.value)
                                ? 'border-[#056DAE] bg-[#EAF4FB] text-[#056DAE] shadow-sm'
                                : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'"
                              (click)="toggleMultiSelect(field.id, opt.value)">
                        <div class="w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0"
                             [ngClass]="isMultiSelected(field.id, opt.value) ? 'border-[#056DAE] bg-[#056DAE]' : 'border-slate-300'">
                          @if (isMultiSelected(field.id, opt.value)) {
                            <mat-icon class="!text-[9px] !w-2.5 !h-2.5 text-white">check</mat-icon>
                          }
                        </div>
                        {{ opt.label }}
                      </button>
                    }
                  </div>
                }
                @default {
                  <div class="runner-input-wrap" [class.focused]="focusedField() === field.id">
                    <input class="runner-input"
                           [placeholder]="field.placeholder || ''"
                           [value]="getAnswer(field.id) ?? ''"
                           (focus)="focusedField.set(field.id)"
                           (blur)="focusedField.set(null)"
                           (input)="emitEvent(field.id, $event)">
                  </div>
                }
              }
            </div>
          }
        }
      }
    </div>

    <!-- Completion bar -->
    @if (effectiveFieldCount > 1) {
      <div class="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center gap-3">
        <div class="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
          <div class="h-full bg-[#056DAE] rounded-full transition-all duration-300"
               [style.width]="(effectiveAnsweredCount / effectiveFieldCount * 100) + '%'"></div>
        </div>
        <span class="text-[10px] font-medium text-slate-400 shrink-0">
          {{ effectiveAnsweredCount }}/{{ effectiveFieldCount }}
        </span>
      </div>
    }
  `,
  styles: [`
    .runner-input-wrap {
      display: flex;
      align-items: center;
      background: #fff;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      transition: border-color 150ms, box-shadow 150ms;
      position: relative;
    }
    .runner-input-wrap:hover { border-color: #cbd5e1; }
    .runner-input-wrap.focused {
      border-color: #056DAE;
      box-shadow: 0 0 0 3px rgba(5,109,174,0.08);
    }
    .runner-input {
      flex: 1;
      min-width: 0;
      padding: 10px 12px;
      font-size: 14px;
      color: #1e293b;
      background: transparent;
      border: none;
      outline: none;
    }
    .runner-input::placeholder { color: #94a3b8; }
    .runner-textarea { resize: vertical; min-height: 80px; }
    .runner-select-wrap { cursor: pointer; }
    .runner-select {
      appearance: none;
      -webkit-appearance: none;
      padding-right: 32px !important;
      cursor: pointer;
    }
    .runner-select-icon {
      position: absolute;
      right: 8px;
      font-size: 18px !important;
      width: 18px !important;
      height: 18px !important;
      color: #94a3b8;
      pointer-events: none;
    }
  `],
})
export class FlowFormRenderComponent {
  @Input({ required: true }) node!: FlowNode;
  @Input() linkedFormDef: FormDefinition | null = null;
  @Input() linkedFormLoading = false;
  /** Full answer map from the runner, keyed "nodeId::fieldId". */
  @Input() answers: Map<string, unknown> = new Map();

  @Output() answerChange = new EventEmitter<FieldAnswerChange>();

  focusedField = signal<string | null>(null);

  // ── Derived properties ──────────────────────────────────────────────

  get formSource(): string {
    return (this.node.config?.['formSource'] as string) || 'custom';
  }

  linkedFields(): FormField[] {
    const def = this.linkedFormDef;
    if (!def) return [];
    const sectionOrder = new Map(def.sections.map(s => [s.id, s.order]));
    return [...def.fields].sort((a, b) => {
      const so = (sectionOrder.get(a.section) ?? 0) - (sectionOrder.get(b.section) ?? 0);
      return so !== 0 ? so : a.order - b.order;
    });
  }

  isLinkedVisible(field: FormField): boolean {
    if (!field.visibleWhen || Object.keys(field.visibleWhen).length === 0) return true;
    return Object.entries(field.visibleWhen).every(
      ([fid, expected]) => this.getAnswer(fid) === expected,
    );
  }

  get effectiveFieldCount(): number {
    if (this.formSource === 'linked') return this.linkedFields().length;
    return this.node.fields.length;
  }

  get effectiveAnsweredCount(): number {
    if (this.formSource === 'linked') {
      return this.linkedFields().filter(f => this.hasAnswer(f.id)).length;
    }
    return this.node.fields.filter(f => this.hasAnswer(f.id)).length;
  }

  // ── Answer helpers ──────────────────────────────────────────────────

  getAnswer(fieldId: string): unknown {
    return this.answers.get(`${this.node.id}::${fieldId}`);
  }

  hasAnswer(fieldId: string): boolean {
    const v = this.getAnswer(fieldId);
    return v !== undefined && v !== null && v !== '';
  }

  isChecked(fieldId: string): boolean {
    const v = this.getAnswer(fieldId);
    return v === true || v === 'true';
  }

  isMultiSelected(fieldId: string, value: string): boolean {
    const v = this.getAnswer(fieldId);
    return Array.isArray(v) && v.includes(value);
  }

  toggleMultiSelect(fieldId: string, value: string): void {
    const v = this.getAnswer(fieldId);
    let arr: string[] = Array.isArray(v) ? [...v] : [];
    arr = arr.includes(value) ? arr.filter(x => x !== value) : [...arr, value];
    this.emit(fieldId, arr);
  }

  // ── Emitters ────────────────────────────────────────────────────────

  emit(fieldId: string, value: unknown): void {
    this.answerChange.emit({ fieldId, value });
  }

  emitEvent(fieldId: string, event: Event): void {
    this.emit(fieldId, (event.target as HTMLInputElement).value);
  }

  // ── Alert styling ───────────────────────────────────────────────────

  alertBoxClass(style: string): string {
    return ({
      info: 'bg-blue-50 text-blue-800',
      success: 'bg-green-50 text-green-800',
      warning: 'bg-amber-50 text-amber-800',
      error: 'bg-red-50 text-red-800',
    } as Record<string, string>)[style] ?? 'bg-blue-50 text-blue-800';
  }

  alertIconClass(style: string): string {
    return ({
      info: 'text-blue-600',
      success: 'text-green-600',
      warning: 'text-amber-600',
      error: 'text-red-600',
    } as Record<string, string>)[style] ?? 'text-blue-600';
  }

  alertIcon(style: string): string {
    return ({ info: 'info', success: 'check_circle', warning: 'warning', error: 'error' } as Record<string, string>)[style] ?? 'info';
  }
}
