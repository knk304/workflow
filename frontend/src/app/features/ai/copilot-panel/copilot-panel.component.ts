import { Component, signal, computed, ViewChild, ElementRef, AfterViewChecked, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, NavigationEnd } from '@angular/router';
import { Subject, takeUntil, filter } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  AiService,
  CopilotMessage,
  CopilotAction,
} from '../../../core/services/ai.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: CopilotAction | null;
  timestamp: Date;
}

@Component({
  selector: 'app-copilot-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <!-- FAB Toggle -->
    @if (!panelOpen()) {
      <button
        mat-fab
        color="primary"
        class="copilot-fab"
        matTooltip="AI Copilot"
        (click)="togglePanel()"
      >
        <mat-icon>smart_toy</mat-icon>
      </button>
    }

    <!-- Chat Panel -->
    @if (panelOpen()) {
      <div class="copilot-panel bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="bg-gradient-to-r from-primary-500 to-primary-800 text-white px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
              <mat-icon class="text-lg">smart_toy</mat-icon>
            </div>
            <span class="font-semibold text-sm">AI Copilot</span>
            <span class="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full font-medium">Beta</span>
          </div>
          <button mat-icon-button class="text-white" (click)="togglePanel()">
            <mat-icon class="text-lg">close</mat-icon>
          </button>
        </div>

        <!-- Messages -->
        <div #messagesContainer class="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[400px]">
          @if (messages().length === 0) {
            <div class="text-center text-slate-400 text-sm mt-8">
              <mat-icon class="text-5xl text-slate-300 mb-2">forum</mat-icon>
              <p>Ask me anything about your cases!</p>
              <div class="mt-4 space-y-2">
                <button class="text-xs bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-full transition-colors border border-primary-200"
                  (click)="sendQuickCommand('Show my open assignments')">Show my assignments</button>
                @if (activeCaseId()) {
                  <button class="text-xs bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-full transition-colors border border-primary-200"
                    (click)="sendQuickCommand('Summarize this case')">Summarize case</button>
                  <button class="text-xs bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-full transition-colors border border-primary-200"
                    (click)="sendQuickCommand('What are the risk flags for this case?')">Check risk flags</button>
                  <button class="text-xs bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-full transition-colors border border-primary-200"
                    (click)="sendQuickCommand('Recommend next actions')">Get recommendations</button>
                  <button class="text-xs bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-full transition-colors border border-primary-200"
                    (click)="sendQuickCommand('Suggest the best assignee for the current step')">Suggest assignee</button>
                } @else {
                  <button class="text-xs bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-full transition-colors border border-primary-200"
                    (click)="sendQuickCommand('What case types are available?')">List case types</button>
                  <button class="text-xs bg-primary-50 hover:bg-primary-100 text-primary-700 px-3 py-1.5 rounded-full transition-colors border border-primary-200"
                    (click)="sendQuickCommand('Show overdue cases')">Show overdue cases</button>
                }
              </div>
            </div>
          }

          @for (msg of messages(); track $index) {
            <div [ngClass]="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
              <div [ngClass]="msg.role === 'user'
                ? 'bg-primary-500 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] text-sm'
                : 'bg-slate-100 text-slate-800 rounded-2xl rounded-bl-sm px-4 py-2 max-w-[85%] text-sm'">
                <div class="whitespace-pre-wrap">{{ msg.content }}</div>
                @if (msg.action && msg.action.action !== 'none' && msg.action.action !== 'navigate') {
                  <div class="mt-2 pt-2 border-t"
                    [ngClass]="msg.role === 'user' ? 'border-primary-400' : 'border-slate-300'">
                    <button
                      class="text-xs font-semibold px-3 py-1 rounded-full transition-colors"
                      [ngClass]="msg.role === 'user'
                        ? 'bg-white text-primary-600 hover:bg-primary-50'
                        : 'bg-primary-500 text-white hover:bg-primary-600'"
                      (click)="confirmAction(msg.action!)"
                    >
                      ✓ {{ msg.action!.description }}
                    </button>
                  </div>
                }
              </div>
            </div>
          }

          @if (loading()) {
            <div class="flex justify-start">
              <div class="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
                <mat-spinner diameter="20"></mat-spinner>
              </div>
            </div>
          }

          @if (streamingText()) {
            <div class="flex justify-start">
              <div class="bg-slate-100 text-slate-800 rounded-2xl rounded-bl-sm px-4 py-2 max-w-[85%] text-sm whitespace-pre-wrap">
                {{ streamingText() }}<span class="animate-pulse">▌</span>
              </div>
            </div>
          }
        </div>

        <!-- Input -->
        <div class="border-t border-slate-200 p-3">
          <form (ngSubmit)="sendMessage()" class="flex items-center gap-2">
            <input
              class="flex-1 border border-slate-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
              [placeholder]="activeCaseId() ? 'Ask about case ' + activeCaseId() + '...' : 'Ask the copilot...'"
              [(ngModel)]="inputText"
              name="copilotInput"
              [disabled]="loading() || !!streamingText()"
              autocomplete="off"
            />
            <button
              mat-icon-button
              color="primary"
              type="submit"
              [disabled]="!inputText.trim() || loading() || !!streamingText()"
            >
              <mat-icon>send</mat-icon>
            </button>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }
    .copilot-fab {
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      z-index: 9999 !important;
      box-shadow: 0 4px 14px rgba(5, 109, 174, 0.4) !important;
    }
    .copilot-panel {
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      z-index: 9999 !important;
      width: 384px;
      max-height: 600px;
    }
  `],
})
export class CopilotPanelComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  panelOpen = signal(false);
  messages = signal<ChatMessage[]>([]);
  loading = signal(false);
  streamingText = signal('');
  inputText = '';

  /** Auto-detected case context from URL (/portal/cases/:id) */
  activeCaseId = signal<string | null>(null);

  private shouldScroll = false;
  private destroy$ = new Subject<void>();

  constructor(
    private aiService: AiService,
    private router: Router,
  ) {
    // Detect case context from URL changes
    this.detectCaseContext(this.router.url);
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntil(this.destroy$),
    ).subscribe(e => this.detectCaseContext(e.urlAfterRedirects));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private detectCaseContext(url: string): void {
    const match = url.match(/\/portal\/cases\/([^/\?]+)/);
    this.activeCaseId.set(match ? match[1] : null);
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  togglePanel(): void {
    this.panelOpen.update(v => !v);
  }

  sendQuickCommand(text: string): void {
    this.inputText = text;
    this.sendMessage();
  }

  sendMessage(): void {
    const text = this.inputText.trim();
    if (!text) return;

    // Add user message
    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: new Date() };
    this.messages.update(msgs => [...msgs, userMsg]);
    this.inputText = '';
    this.shouldScroll = true;

    // Build history for context
    const history: CopilotMessage[] = this.messages()
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    this.loading.set(true);
    this.streamingText.set('');

    // Pass case context if viewing a case (pega-lite hierarchy)
    const streamOptions: { case_id?: string; history?: CopilotMessage[] } = { history };
    if (this.activeCaseId()) {
      streamOptions.case_id = this.activeCaseId()!;
    }

    // Use streaming endpoint
    let accumulated = '';
    let pendingAction: CopilotAction | null = null;

    this.aiService.copilotStream(text, streamOptions).subscribe({
      next: (event) => {
        this.loading.set(false);
        if (event.type === 'action') {
          pendingAction = event.data;
          // Handle navigate immediately — remap legacy routes to pega-lite portal routes
          if (event.data?.action === 'navigate' && event.data?.route) {
            this.router.navigateByUrl(this.remapRoute(event.data.route));
          }
        } else if (event.type === 'delta') {
          accumulated += event.data;
          this.streamingText.set(accumulated);
          this.shouldScroll = true;
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.streamingText.set('');
        const errMsg: ChatMessage = {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
          timestamp: new Date(),
        };
        this.messages.update(msgs => [...msgs, errMsg]);
        this.shouldScroll = true;
      },
      complete: () => {
        this.loading.set(false);
        if (accumulated) {
          const assistantMsg: ChatMessage = {
            role: 'assistant',
            content: accumulated,
            action: pendingAction,
            timestamp: new Date(),
          };
          this.messages.update(msgs => [...msgs, assistantMsg]);
        }
        this.streamingText.set('');
        this.shouldScroll = true;
      },
    });
  }

  confirmAction(action: CopilotAction): void {
    if (!action.payload) return;

    this.loading.set(true);
    this.aiService.executeAction(action.action, action.payload).subscribe({
      next: (result) => {
        this.loading.set(false);
        const msg: ChatMessage = {
          role: 'assistant',
          content: `Done! Created ${result.type} **${result.id}**.`,
          timestamp: new Date(),
        };
        this.messages.update(msgs => [...msgs, msg]);
        this.shouldScroll = true;
      },
      error: () => {
        this.loading.set(false);
        const msg: ChatMessage = {
          role: 'assistant',
          content: 'Failed to execute action. Please try again.',
          timestamp: new Date(),
        };
        this.messages.update(msgs => [...msgs, msg]);
        this.shouldScroll = true;
      },
    });
  }

  /** Remap legacy routes to pega-lite portal structure */
  private remapRoute(route: string): string {
    // /cases/:id → /portal/cases/:id
    if (/^\/cases\//.test(route) && !route.startsWith('/portal/')) {
      return '/portal' + route;
    }
    // /tasks → /portal/worklist (tasks don't exist in pega-lite)
    if (route === '/tasks' || route.startsWith('/tasks/')) {
      return '/portal/worklist';
    }
    return route;
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch { /* noop */ }
  }
}
