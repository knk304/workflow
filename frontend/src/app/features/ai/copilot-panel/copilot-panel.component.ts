import { Component, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
        class="fixed bottom-6 right-6 z-50 shadow-xl"
        matTooltip="AI Copilot"
        (click)="togglePanel()"
      >
        <mat-icon>smart_toy</mat-icon>
      </button>
    }

    <!-- Chat Panel -->
    @if (panelOpen()) {
      <div class="fixed bottom-6 right-6 z-50 w-96 max-h-[600px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <!-- Header -->
        <div class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <mat-icon class="text-xl">smart_toy</mat-icon>
            <span class="font-semibold text-sm">AI Copilot</span>
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
              <p>Ask me anything about your workflow!</p>
              <div class="mt-4 space-y-2">
                <button class="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors"
                  (click)="sendQuickCommand('Show my open tasks')">Show my open tasks</button>
                <button class="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors"
                  (click)="sendQuickCommand('Create a form for employee onboarding')">Create onboarding form</button>
                <button class="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors"
                  (click)="sendQuickCommand('Create a workflow for leave approval')">Build leave workflow</button>
              </div>
            </div>
          }

          @for (msg of messages(); track $index) {
            <div [ngClass]="msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'">
              <div [ngClass]="msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] text-sm'
                : 'bg-slate-100 text-slate-800 rounded-2xl rounded-bl-sm px-4 py-2 max-w-[85%] text-sm'">
                <div class="whitespace-pre-wrap">{{ msg.content }}</div>
                @if (msg.action && msg.action.action !== 'none' && msg.action.action !== 'navigate') {
                  <div class="mt-2 pt-2 border-t"
                    [ngClass]="msg.role === 'user' ? 'border-blue-500' : 'border-slate-300'">
                    <button
                      class="text-xs font-semibold px-3 py-1 rounded-full transition-colors"
                      [ngClass]="msg.role === 'user'
                        ? 'bg-white text-blue-600 hover:bg-blue-50'
                        : 'bg-blue-600 text-white hover:bg-blue-700'"
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
              class="flex-1 border border-slate-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Ask the copilot..."
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
})
export class CopilotPanelComponent implements AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  panelOpen = signal(false);
  messages = signal<ChatMessage[]>([]);
  loading = signal(false);
  streamingText = signal('');
  inputText = '';

  private shouldScroll = false;

  constructor(
    private aiService: AiService,
    private router: Router,
  ) {}

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

    // Use streaming endpoint
    let accumulated = '';
    let pendingAction: CopilotAction | null = null;

    this.aiService.copilotStream(text, { history }).subscribe({
      next: (event) => {
        this.loading.set(false);
        if (event.type === 'action') {
          pendingAction = event.data;
          // Handle navigate immediately
          if (event.data?.action === 'navigate' && event.data?.route) {
            this.router.navigateByUrl(event.data.route);
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

  private scrollToBottom(): void {
    try {
      const el = this.messagesContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch { /* noop */ }
  }
}
