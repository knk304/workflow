import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { StepInstance } from '@core/models';

@Component({
  selector: 'app-step-card',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatExpansionModule,
  ],
  template: `
    <div class="border rounded-xl p-4 transition-all"
         [ngClass]="cardClass()">
      <div class="flex items-start gap-3">
        <!-- Step status icon -->
        <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
             [ngClass]="iconClass()">
          @switch (step.status) {
            @case ('completed') {
              <mat-icon class="!text-base">check</mat-icon>
            }
            @case ('in_progress') {
              <mat-icon class="!text-base">play_arrow</mat-icon>
            }
            @case ('skipped') {
              <mat-icon class="!text-base">skip_next</mat-icon>
            }
            @default {
              <mat-icon class="!text-base">radio_button_unchecked</mat-icon>
            }
          }
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="font-semibold text-sm" [ngClass]="titleClass()">
              {{ step.name }}
            </span>
            @if (step.type) {
              <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase">
                {{ step.type }}
              </span>
            }
          </div>

          @if (step.description) {
            <p class="text-xs text-slate-500 mb-2">{{ step.description }}</p>
          }

          <!-- Form fields preview (if this is a form step) -->
          @if (step.formFields && step.formFields.length > 0 && step.status !== 'completed') {
            <div class="text-xs text-slate-400 mb-2">
              {{ step.formFields.length }} field(s) to complete
            </div>
          }

          <!-- Completed info -->
          @if (step.status === 'completed' && step.completedAt) {
            <p class="text-xs text-slate-400">
              Completed {{ step.completedAt | date:'short' }}
              @if (step.completedBy) {
                by {{ step.completedBy }}
              }
            </p>
          }

          <!-- Action button for current step -->
          @if (step.status === 'in_progress' || step.status === 'pending') {
            @if (isCurrent) {
              <button mat-flat-button color="primary" class="!mt-2 !text-xs !h-8"
                      (click)="onComplete.emit(step)">
                <mat-icon class="!text-sm mr-1">check_circle</mat-icon>
                Complete Step
              </button>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class StepCardComponent {
  @Input() step!: StepInstance;
  @Input() isCurrent = false;
  @Output() onComplete = new EventEmitter<StepInstance>();

  cardClass(): string {
    if (this.step.status === 'completed') return 'border-emerald-200 bg-emerald-50/50';
    if (this.isCurrent) return 'border-blue-300 bg-blue-50/50 shadow-sm';
    if (this.step.status === 'skipped') return 'border-slate-200 bg-slate-50 opacity-60';
    return 'border-slate-200 bg-white';
  }

  iconClass(): string {
    if (this.step.status === 'completed') return 'bg-emerald-500 text-white';
    if (this.isCurrent) return 'bg-blue-600 text-white';
    if (this.step.status === 'skipped') return 'bg-slate-300 text-white';
    return 'bg-slate-200 text-slate-400';
  }

  titleClass(): string {
    if (this.step.status === 'completed') return 'text-emerald-700';
    if (this.isCurrent) return 'text-blue-700';
    return 'text-slate-600';
  }
}
