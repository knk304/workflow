import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { StageInstance } from '@core/models';

@Component({
  selector: 'app-stage-progress-bar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="flex items-center gap-1 w-full">
      @for (stage of stages; track stage.stageDefinitionId; let i = $index) {
        <div class="flex items-center" [class]="i < stages.length - 1 ? 'flex-1' : ''">
          <!-- Stage Dot + Label -->
          <div class="flex flex-col items-center min-w-[60px]">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                 [ngClass]="stageClass(i)">
              @if (stage.status === 'completed') {
                <mat-icon class="!text-base">check</mat-icon>
              } @else {
                {{ i + 1 }}
              }
            </div>
            <span class="text-[10px] mt-1 text-center leading-tight max-w-[80px] truncate"
                  [ngClass]="stageLabelClass(i)">
              {{ stage.name }}
            </span>
          </div>

          <!-- Connector Line -->
          @if (i < stages.length - 1) {
            <div class="flex-1 h-0.5 mx-1 transition-all"
                 [ngClass]="connectorClass(i)">
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class StageProgressBarComponent {
  @Input() stages: StageInstance[] = [];
  @Input() currentIndex: number = 0;

  stageClass(index: number): string {
    const stage = this.stages[index];
    if (stage.status === 'completed') {
      return 'bg-emerald-500 text-white';
    }
    if (index === this.currentIndex) {
      return 'bg-blue-600 text-white ring-4 ring-blue-100';
    }
    return 'bg-slate-200 text-slate-500';
  }

  stageLabelClass(index: number): string {
    const stage = this.stages[index];
    if (stage.status === 'completed') return 'text-emerald-600 font-medium';
    if (index === this.currentIndex) return 'text-blue-600 font-semibold';
    return 'text-slate-400';
  }

  connectorClass(index: number): string {
    if (this.stages[index].status === 'completed') return 'bg-emerald-400';
    return 'bg-slate-200';
  }
}
