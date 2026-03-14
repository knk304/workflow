import { Injectable, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { WSMessage } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private ws: WebSocket | null = null;
  private heartbeatInterval: any = null;
  private reconnectTimer: any = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private currentCaseId: string | null = null;
  private currentToken: string | null = null;

  connected = signal(false);
  presenceUsers = signal<{ id: string; name: string }[]>([]);
  lastMessage = signal<WSMessage | null>(null);

  constructor(private store: Store) {}

  connect(caseId: string, token: string): void {
    if (this.ws) this.disconnect(false);

    this.currentCaseId = caseId;
    this.currentToken = token;

    const wsUrl = environment.wsUrl || 'ws://localhost:8000';
    this.ws = new WebSocket(`${wsUrl}/ws/cases/${caseId}?token=${encodeURIComponent(token)}`);

    this.ws.onopen = () => {
      this.connected.set(true);
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      const msg: WSMessage = JSON.parse(event.data);
      this.lastMessage.set(msg);

      if (msg.type === 'presence' || msg.type === 'user_joined' || msg.type === 'user_left') {
        this.presenceUsers.set(msg.data?.viewers || []);
      }
    };

    this.ws.onclose = (event) => {
      this.connected.set(false);
      this.stopHeartbeat();
      // Reconnect unless intentionally closed (code 1000) or auth error (4001)
      if (event.code !== 1000 && event.code !== 4001) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.connected.set(false);
    };
  }

  disconnect(clearState = true): void {
    this.stopHeartbeat();
    this.stopReconnect();
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
    this.connected.set(false);
    if (clearState) {
      this.presenceUsers.set([]);
      this.currentCaseId = null;
      this.currentToken = null;
      this.reconnectAttempts = 0;
    }
  }

  send(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    if (!this.currentCaseId || !this.currentToken) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      if (this.currentCaseId && this.currentToken) {
        this.connect(this.currentCaseId, this.currentToken);
      }
    }, delay);
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'heartbeat', data: {} });
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
