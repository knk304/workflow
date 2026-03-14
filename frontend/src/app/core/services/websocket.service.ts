import { Injectable, signal } from '@angular/core';
import { Store } from '@ngrx/store';
import { WSMessage } from '../models';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private ws: WebSocket | null = null;
  private heartbeatInterval: any = null;

  connected = signal(false);
  presenceUsers = signal<string[]>([]);
  lastMessage = signal<WSMessage | null>(null);

  constructor(private store: Store) {}

  connect(caseId: string, token: string): void {
    if (this.ws) this.disconnect();

    const wsUrl = environment.wsUrl || 'ws://localhost:8000';
    this.ws = new WebSocket(`${wsUrl}/ws/cases/${caseId}?token=${token}`);

    this.ws.onopen = () => {
      this.connected.set(true);
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      const msg: WSMessage = JSON.parse(event.data);
      this.lastMessage.set(msg);

      if (msg.type === 'presence') {
        this.presenceUsers.set(msg.data?.users || []);
      }
    };

    this.ws.onclose = () => {
      this.connected.set(false);
      this.stopHeartbeat();
    };

    this.ws.onerror = () => {
      this.connected.set(false);
    };
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected.set(false);
    this.presenceUsers.set([]);
  }

  send(message: WSMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
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
