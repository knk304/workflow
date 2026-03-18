import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AiService, ExtractionField, ExtractionResponse } from '../../../core/services/ai.service';

@Component({
  selector: 'app-extraction-widget',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatProgressBarModule,
  ],
  template: `
    <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <!-- Header -->
      <div class="bg-gradient-to-r from-cyan-50 to-blue-50 px-5 py-3 border-b border-slate-200">
        <div class="flex items-center justify-between">
          <h4 class="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <mat-icon class="text-base text-cyan-500">document_scanner</mat-icon>
            Extracted Fields
          </h4>
          <div class="flex items-center gap-1">
            @if (extraction()) {
              <span class="text-[10px] text-slate-400 font-medium">
                {{ extraction()!.fields.length }} fields via {{ extraction()!.generated_by }}
              </span>
            }
            <button mat-icon-button
                    class="w-7 h-7"
                    [matTooltip]="extraction() ? 'Re-extract' : 'Extract fields'"
                    (click)="extract()"
                    [disabled]="loading()">
              <mat-icon class="text-base text-cyan-500"
                        [class.animate-spin]="loading()">
                {{ loading() ? 'sync' : 'refresh' }}
              </mat-icon>
            </button>
          </div>
        </div>
      </div>

      <!-- Content -->
      <div class="p-5">
        @if (loading()) {
          <div class="flex items-center justify-center py-8">
            <mat-spinner diameter="28"></mat-spinner>
            <span class="text-sm text-slate-500 ml-3">Extracting fields...</span>
          </div>
        } @else if (error()) {
          <div class="text-center py-6">
            <mat-icon class="text-3xl text-amber-400 mb-2">warning</mat-icon>
            <p class="text-sm text-slate-500">{{ error() }}</p>
            <button mat-stroked-button class="mt-3 text-xs" (click)="extract()">
              <mat-icon class="text-sm">refresh</mat-icon>
              Retry
            </button>
          </div>
        } @else if (extraction() && extraction()!.fields.length > 0) {
          <!-- Extracted fields list -->
          <div class="space-y-3">
            @for (field of extraction()!.fields; track field.field_name) {
              <div class="border border-slate-100 rounded-lg p-3">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {{ field.field_name }}
                  </span>
                  <div class="flex items-center gap-1.5">
                    @if (field.source_page) {
                      <span class="text-[10px] text-slate-400">p.{{ field.source_page }}</span>
                    }
                    <span class="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                          [class]="confidenceClass(field.confidence)">
                      {{ (field.confidence * 100).toFixed(0) }}%
                    </span>
                  </div>
                </div>
                <p class="text-sm text-slate-700">{{ field.value }}</p>
                <mat-progress-bar
                  mode="determinate"
                  [value]="field.confidence * 100"
                  [color]="field.confidence >= 0.8 ? 'primary' : field.confidence >= 0.5 ? 'accent' : 'warn'"
                  class="mt-1.5 rounded-full h-1">
                </mat-progress-bar>
              </div>
            }
          </div>

          <!-- Raw text preview -->
          @if (extraction()!.raw_text_preview) {
            <details class="mt-4">
              <summary class="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                Raw text preview
              </summary>
              <pre class="mt-2 text-[11px] text-slate-500 bg-slate-50 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">{{ extraction()!.raw_text_preview }}</pre>
            </details>
          }
        } @else if (extraction() && extraction()!.fields.length === 0) {
          <div class="text-center py-6">
            <mat-icon class="text-3xl text-slate-300 mb-2">search_off</mat-icon>
            <p class="text-sm text-slate-500">No fields could be extracted</p>
            <p class="text-xs text-slate-400 mt-1">The document may not contain structured data</p>
          </div>
        } @else {
          <!-- Empty state -->
          <div class="text-center py-6">
            <div class="w-12 h-12 rounded-full bg-cyan-50 flex items-center justify-center mx-auto mb-3">
              <mat-icon class="text-2xl text-cyan-400">document_scanner</mat-icon>
            </div>
            <p class="text-sm text-slate-500 mb-1">No extraction yet</p>
            <p class="text-xs text-slate-400 mb-3">AI will extract structured fields from this document</p>
            <button mat-raised-button
                    class="bg-cyan-500 text-white hover:bg-cyan-600 text-xs"
                    (click)="extract()">
              <mat-icon class="text-sm">auto_awesome</mat-icon>
              Extract Fields
            </button>
          </div>
        }
      </div>
    </div>
  `,
})
export class ExtractionWidgetComponent {
  @Input({ required: true }) documentId!: string;

  extraction = signal<ExtractionResponse | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private aiService: AiService) {}

  extract(): void {
    this.loading.set(true);
    this.error.set(null);

    this.aiService.extractDocument(this.documentId).subscribe({
      next: (result: ExtractionResponse) => {
        this.extraction.set(result);
        this.loading.set(false);
      },
      error: (err: any) => {
        const detail = err.error?.detail || err.message || 'Failed to extract fields';
        this.error.set(detail);
        this.loading.set(false);
      },
    });
  }

  confidenceClass(confidence: number): string {
    if (confidence >= 0.8) return 'bg-emerald-100 text-emerald-700';
    if (confidence >= 0.5) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  }
}
