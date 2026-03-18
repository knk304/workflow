import { Component, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AiService, SearchResult, SearchResponse } from '../../../core/services/ai.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, switchMap, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-semantic-search',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="relative">
      <!-- Search Input -->
      <div class="flex items-center bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200"
           [class.bg-white]="focused()"
           [class.shadow-lg]="focused()"
           [class.ring-2]="focused()"
           [class.ring-indigo-300]="focused()">
        <mat-icon class="ml-3 text-base"
                  [ngClass]="focused() ? 'text-slate-400' : 'text-white/60'">search</mat-icon>
        <input type="text"
               class="w-full bg-transparent border-none outline-none py-2 px-2 text-sm"
               [ngClass]="focused() ? 'text-slate-700 placeholder-slate-400' : 'text-white placeholder-white/60'"
               placeholder="Search cases, tasks, docs..."
               [ngModel]="query()"
               (ngModelChange)="onQueryChange($event)"
               (focus)="focused.set(true)"
               (blur)="onBlur()"
               (keydown.escape)="clearSearch()"
               (keydown.enter)="executeSearch()">
        @if (loading()) {
          <mat-spinner diameter="18" class="mr-2"></mat-spinner>
        } @else if (query()) {
          <button mat-icon-button class="w-7 h-7 mr-1" (mousedown)="clearSearch()">
            <mat-icon class="text-base" [ngClass]="focused() ? 'text-slate-400' : 'text-white/60'">close</mat-icon>
          </button>
        }
      </div>

      <!-- Results Dropdown -->
      @if (showResults() && (results().length > 0 || noResults())) {
        <div class="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 max-h-96 overflow-auto">
          @if (results().length > 0) {
            <div class="py-2">
              @for (result of results(); track result.entity_id) {
                <button class="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-start gap-3"
                        (mousedown)="navigateToResult(result)">
                  <mat-icon class="text-base mt-0.5 shrink-0" [class]="entityIconClass(result.entity_type)">
                    {{ entityIcon(result.entity_type) }}
                  </mat-icon>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium text-slate-700 truncate">{{ result.title }}</span>
                      <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 shrink-0">
                        {{ (result.score * 100).toFixed(0) }}%
                      </span>
                    </div>
                    <p class="text-xs text-slate-400 truncate mt-0.5">{{ result.snippet }}</p>
                  </div>
                  <span class="text-[10px] uppercase tracking-wider text-slate-400 font-medium shrink-0 mt-1">
                    {{ result.entity_type }}
                  </span>
                </button>
              }
            </div>
            <div class="px-4 py-2 border-t border-slate-100">
              <p class="text-[11px] text-slate-400">
                {{ results().length }} result{{ results().length !== 1 ? 's' : '' }} for "{{ query() }}"
              </p>
            </div>
          } @else if (noResults()) {
            <div class="px-4 py-6 text-center">
              <mat-icon class="text-3xl text-slate-200 mb-2">search_off</mat-icon>
              <p class="text-sm text-slate-500">No results for "{{ query() }}"</p>
              <p class="text-xs text-slate-400 mt-1">Try different keywords or fewer filters</p>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class SemanticSearchComponent implements OnDestroy {
  query = signal('');
  results = signal<SearchResult[]>([]);
  loading = signal(false);
  focused = signal(false);
  showResults = signal(false);
  noResults = signal(false);

  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private aiService: AiService,
    private router: Router,
  ) {
    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      filter((q: string) => q.trim().length >= 2),
      switchMap((q: string) => {
        this.loading.set(true);
        this.noResults.set(false);
        return this.aiService.search(q, { limit: 10 });
      }),
      takeUntil(this.destroy$),
    ).subscribe({
      next: (resp: SearchResponse) => {
        this.results.set(resp.results);
        this.noResults.set(resp.results.length === 0);
        this.showResults.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.noResults.set(true);
        this.showResults.set(true);
      },
    });
  }

  onQueryChange(value: string): void {
    this.query.set(value);
    if (value.trim().length < 2) {
      this.results.set([]);
      this.showResults.set(false);
      this.noResults.set(false);
      this.loading.set(false);
      return;
    }
    this.searchSubject.next(value);
  }

  executeSearch(): void {
    const q = this.query().trim();
    if (q.length >= 2) {
      this.searchSubject.next(q);
    }
  }

  clearSearch(): void {
    this.query.set('');
    this.results.set([]);
    this.showResults.set(false);
    this.noResults.set(false);
    this.loading.set(false);
  }

  onBlur(): void {
    // Delay so click handlers on results fire first
    setTimeout(() => {
      this.focused.set(false);
      this.showResults.set(false);
    }, 200);
  }

  navigateToResult(result: SearchResult): void {
    this.showResults.set(false);
    const routes: Record<string, string> = {
      cases: `/cases/${result.entity_id}`,
      tasks: `/tasks`,
      documents: `/documents`,
    };
    const route = routes[result.entity_type] || '/';
    this.router.navigateByUrl(route);
  }

  entityIcon(entityType: string): string {
    return { cases: 'folder_open', tasks: 'task_alt', documents: 'description' }[entityType] || 'search';
  }

  entityIconClass(entityType: string): string {
    return {
      cases: 'text-indigo-500',
      tasks: 'text-amber-500',
      documents: 'text-cyan-500',
    }[entityType] || 'text-slate-400';
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
