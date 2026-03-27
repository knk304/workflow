import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { DataService } from '@core/services/data.service';
import { FlowDefinition, FlowExecution } from '@core/models';

@Component({
  selector: 'app-portal-flow-list',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule, MatChipsModule, MatTabsModule],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-slate-800">Flows</h1>
          <p class="text-xs text-slate-500 mt-0.5">Complete guided flows and process</p>
        </div>
      </div>

      <mat-tab-group>
        <!-- Available Flows -->
        <mat-tab label="Available Flows">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
            @for (flow of flowDefinitions(); track flow.id) {
              <mat-card class="!rounded-xl !shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer"
                        (click)="startFlow(flow)">
                <mat-card-content class="pt-4">
                  <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-lg bg-[#EAF4FB] flex items-center justify-center shrink-0">
                      <mat-icon class="text-[#056DAE]">quiz</mat-icon>
                    </div>
                    <div class="min-w-0 flex-1">
                      <h3 class="font-semibold text-sm text-slate-800">{{ flow.name }}</h3>
                      <p class="text-xs text-slate-500 mt-0.5 line-clamp-2">{{ flow.description }}</p>
                      <div class="flex items-center gap-2 mt-2">
                        @if (flow.category) {
                          <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {{ flow.category }}
                          </span>
                        }
                        <span class="text-[10px] text-slate-400">v{{ flow.version }}</span>
                        <span class="text-[10px] text-slate-400">·</span>
                        <span class="text-[10px] text-slate-400">{{ flow.definition.nodes.length }} nodes</span>
                      </div>
                    </div>
                  </div>
                  <button mat-raised-button color="primary" class="w-full !mt-3 !h-8 !text-xs">
                    <mat-icon class="!text-sm !w-4 !h-4">play_arrow</mat-icon> Start Flow
                  </button>
                </mat-card-content>
              </mat-card>
            }
            @if (flowDefinitions().length === 0) {
              <div class="col-span-3 text-center py-12 text-slate-400">
                <mat-icon class="!text-5xl !w-12 !h-12 mb-2">quiz</mat-icon>
                <p class="text-sm">No flows available</p>
              </div>
            }
          </div>
        </mat-tab>

        <!-- My Submissions -->
        <mat-tab label="My Submissions">
          <div class="pt-4 space-y-2">
            @for (exec of myExecutions(); track exec.id) {
              <mat-card class="!rounded-lg !shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-shadow"
                        (click)="viewExecution(exec)">
                <mat-card-content class="!py-3">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                         [ngClass]="exec.status === 'completed' ? 'bg-green-100' : exec.status === 'abandoned' ? 'bg-red-100' : 'bg-yellow-100'">
                      <mat-icon class="!text-base !w-4 !h-4"
                                [ngClass]="exec.status === 'completed' ? 'text-green-600' : exec.status === 'abandoned' ? 'text-red-600' : 'text-yellow-600'">
                        {{ exec.status === 'completed' ? 'check_circle' : exec.status === 'abandoned' ? 'cancel' : 'hourglass_empty' }}
                      </mat-icon>
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-slate-800">{{ exec.flowName }}</p>
                      <p class="text-xs text-slate-500">
                        Started {{ exec.startedAt | date:'short' }}
                        @if (exec.completedAt) {
                          · Completed {{ exec.completedAt | date:'short' }}
                        }
                      </p>
                    </div>
                    <mat-chip-set>
                      <mat-chip class="!text-xs"
                                [ngClass]="exec.status === 'completed' ? '!bg-green-100 !text-green-800' :
                                           exec.status === 'abandoned' ? '!bg-red-100 !text-red-800' :
                                           '!bg-yellow-100 !text-yellow-800'">
                        {{ exec.status }}
                      </mat-chip>
                    </mat-chip-set>
                  </div>
                </mat-card-content>
              </mat-card>
            }
            @if (myExecutions().length === 0) {
              <div class="text-center py-12 text-slate-400">
                <mat-icon class="!text-5xl !w-12 !h-12 mb-2">history</mat-icon>
                <p class="text-sm">No submissions yet</p>
              </div>
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
})
export class PortalFlowListComponent implements OnInit {
  flowDefinitions = signal<FlowDefinition[]>([]);
  myExecutions = signal<FlowExecution[]>([]);

  constructor(private dataService: DataService, private router: Router) {}

  ngOnInit(): void {
    this.dataService.getFlowDefinitions().subscribe(flows => {
      this.flowDefinitions.set(flows.filter(f => f.isActive));
    });
    this.dataService.getFlowExecutions().subscribe(execs => {
      this.myExecutions.set(execs);
    });
  }

  startFlow(flow: FlowDefinition): void {
    this.dataService.startFlowExecution(flow.id).subscribe(exec => {
      this.router.navigate(['/portal/flows', exec.id, 'run']);
    });
  }

  viewExecution(exec: FlowExecution): void {
    if (exec.status === 'in_progress') {
      this.router.navigate(['/portal/flows', exec.id, 'run']);
    } else {
      this.router.navigate(['/portal/flows', exec.id, 'summary']);
    }
  }
}
