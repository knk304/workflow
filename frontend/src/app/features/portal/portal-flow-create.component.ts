import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DataService } from '@core/services/data.service';
import { FlowDefinition } from '@core/models';

@Component({
  selector: 'app-portal-flow-create',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatProgressBarModule, MatSnackBarModule,
  ],
  template: `
    <div class="space-y-5">
      <!-- Page Header -->
      <div class="bg-gradient-to-r from-[#056DAE] to-[#0891b2] rounded-2xl p-6 text-white shadow-lg">
        <div class="flex items-center gap-3 mb-1">
          <div class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <mat-icon>add_circle</mat-icon>
          </div>
          <div>
            <h1 class="text-xl text-white font-bold">Create New Request</h1>
            <p class="text-sm text-white/80">Select a flow template to start a new request</p>
          </div>
        </div>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" class="rounded-full"></mat-progress-bar>
      }

      <!-- Search & Filter Bar -->
      <div class="flex flex-wrap items-center gap-3">
        <mat-form-field class="flex-1 min-w-[200px] dense-field" subscriptSizing="dynamic">
          <mat-icon matPrefix class="text-slate-400 mr-2">search</mat-icon>
          <mat-label>Search flows...</mat-label>
          <input matInput [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()">
        </mat-form-field>
        <mat-form-field class="w-48 dense-field" subscriptSizing="dynamic">
          <mat-label>Category</mat-label>
          <mat-select [(ngModel)]="selectedCategory" (ngModelChange)="applyFilter()">
            <mat-option value="">All Categories</mat-option>
            @for (cat of categories(); track cat) {
              <mat-option [value]="cat">{{ cat }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <!-- Flow Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        @for (flow of filteredFlows(); track flow.id) {
          <mat-card class="!rounded-2xl !shadow-sm border border-slate-100 hover:shadow-lg hover:border-[#056DAE]/30 transition-all duration-300 group overflow-hidden">
            <!-- Category ribbon -->
            <div class="h-1.5 w-full" [ngClass]="categoryColor(flow.category)"></div>
            <mat-card-content class="pt-4 pb-3 px-5">
              <div class="flex items-start gap-3 mb-3">
                <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                     [ngClass]="categoryBg(flow.category)">
                  <mat-icon [ngClass]="categoryIconColor(flow.category)">{{ categoryIcon(flow.category) }}</mat-icon>
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="font-semibold text-sm text-slate-800 group-hover:text-[#056DAE] transition-colors">{{ flow.name }}</h3>
                  <p class="text-xs text-slate-500 mt-0.5 line-clamp-2">{{ flow.description }}</p>
                </div>
              </div>

              <!-- Meta info -->
              <div class="flex items-center gap-3 mb-3 py-2 border-t border-b border-slate-50">
                @if (flow.category) {
                  <span class="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        [ngClass]="categoryChipClass(flow.category)">
                    {{ flow.category }}
                  </span>
                }
                <span class="text-[10px] text-slate-400 flex items-center gap-0.5">
                  <mat-icon class="!text-[10px] !w-3 !h-3">layers</mat-icon> v{{ flow.version }}
                </span>
                <span class="text-[10px] text-slate-400 flex items-center gap-0.5">
                  <mat-icon class="!text-[10px] !w-3 !h-3">account_tree</mat-icon>
                  {{ flow.definition.nodes.length }} steps
                </span>
              </div>

              <!-- Start Button -->
              @if (starting() && startingId() === flow.id) {
                <button mat-raised-button color="primary"
                        class="!h-9 !text-xs !rounded-lg !shadow-none" disabled
                        (click)="$event.stopPropagation()">
                  <mat-icon class="animate-spin !text-sm !w-4 !h-4">autorenew</mat-icon> Starting...
                </button>
              } @else {
                <button mat-raised-button color="primary"
                        class="!h-9 !text-xs !rounded-lg !shadow-none group-hover:!shadow-md transition-shadow"
                        (click)="startFlow(flow); $event.stopPropagation()">
                  <mat-icon class="!text-sm !w-4 !h-4">play_arrow</mat-icon> Start Request
                </button>
              }
            </mat-card-content>
          </mat-card>
        }
      </div>

      @if (filteredFlows().length === 0 && !loading()) {
        <div class="text-center py-16 text-slate-400">
          <div class="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <mat-icon class="!text-4xl !w-10 !h-10 text-slate-300">search_off</mat-icon>
          </div>
          <p class="text-base font-medium text-slate-500 mb-1">No flows found</p>
          <p class="text-sm text-slate-400">Try changing your search or filter criteria</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .dense-field { font-size: 13px; }
    .dense-field .mat-mdc-form-field-infix { min-height: 36px !important; padding-top: 8px !important; padding-bottom: 8px !important; }
  `],
})
export class PortalFlowCreateComponent implements OnInit {
  loading = signal(true);
  starting = signal(false);
  startingId = signal<string | null>(null);
  allFlows = signal<FlowDefinition[]>([]);
  filteredFlows = signal<FlowDefinition[]>([]);
  categories = signal<string[]>([]);

  searchTerm = '';
  selectedCategory = '';

  constructor(
    private dataService: DataService,
    private router: Router,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.dataService.getFlowDefinitions().subscribe({
      next: flows => {
        const active = flows.filter(f => f.isActive);
        this.allFlows.set(active);
        this.filteredFlows.set(active);
        const cats = [...new Set(active.map(f => f.category).filter(Boolean))];
        this.categories.set(cats);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  applyFilter(): void {
    let result = this.allFlows();
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(term) || f.description.toLowerCase().includes(term)
      );
    }
    if (this.selectedCategory) {
      result = result.filter(f => f.category === this.selectedCategory);
    }
    this.filteredFlows.set(result);
  }

  startFlow(flow: FlowDefinition): void {
    this.starting.set(true);
    this.startingId.set(flow.id);
    this.dataService.startFlowExecution(flow.id).subscribe({
      next: exec => {
        this.starting.set(false);
        this.startingId.set(null);
        this.router.navigate(['/portal/flows', exec.id, 'run']);
      },
      error: () => {
        this.starting.set(false);
        this.startingId.set(null);
        this.snackBar.open('Failed to start flow', 'OK', { duration: 3000 });
      },
    });
  }

  categoryColor(cat: string): string {
    const map: Record<string, string> = {
      HR: 'bg-violet-500', Finance: 'bg-emerald-500', IT: 'bg-blue-500',
      Operations: 'bg-amber-500', Legal: 'bg-rose-500', Sales: 'bg-cyan-500',
    };
    return map[cat] || 'bg-slate-400';
  }

  categoryBg(cat: string): string {
    const map: Record<string, string> = {
      HR: 'bg-violet-50', Finance: 'bg-emerald-50', IT: 'bg-blue-50',
      Operations: 'bg-amber-50', Legal: 'bg-rose-50', Sales: 'bg-cyan-50',
    };
    return map[cat] || 'bg-slate-50';
  }

  categoryIconColor(cat: string): string {
    const map: Record<string, string> = {
      HR: 'text-violet-600', Finance: 'text-emerald-600', IT: 'text-blue-600',
      Operations: 'text-amber-600', Legal: 'text-rose-600', Sales: 'text-cyan-600',
    };
    return map[cat] || 'text-slate-500';
  }

  categoryIcon(cat: string): string {
    const map: Record<string, string> = {
      HR: 'people', Finance: 'account_balance', IT: 'computer',
      Operations: 'settings', Legal: 'gavel', Sales: 'trending_up',
    };
    return map[cat] || 'quiz';
  }

  categoryChipClass(cat: string): string {
    const map: Record<string, string> = {
      HR: 'bg-violet-100 text-violet-700', Finance: 'bg-emerald-100 text-emerald-700', IT: 'bg-blue-100 text-blue-700',
      Operations: 'bg-amber-100 text-amber-700', Legal: 'bg-rose-100 text-rose-700', Sales: 'bg-cyan-100 text-cyan-700',
    };
    return map[cat] || 'bg-slate-100 text-slate-600';
  }
}
