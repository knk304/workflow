import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  User, Team, CaseType, Case, Task, KanbanBoard,
  Comment, Notification, AuditLog,
} from '../models';
import { DataService } from './data.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class ApiDataService extends DataService {
  private readonly caseUrl = environment.caseApiUrl;
  private readonly taskUrl = environment.taskApiUrl;
  private readonly notifyUrl = environment.notifyApiUrl;
  private readonly authUrl = environment.authApiUrl;

  constructor(private http: HttpClient) {
    super();
  }

  // ─── Users ───────────────────────────────────────
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.authUrl}/users`);
  }

  getUserById(id: string): Observable<User | undefined> {
    return this.http.get<User>(`${this.authUrl}/users/${id}`);
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.authUrl}/auth/me`);
  }

  // ─── Teams ───────────────────────────────────────
  getTeams(): Observable<Team[]> {
    return this.http.get<Team[]>(`${this.authUrl}/teams`);
  }

  // ─── Case Types ──────────────────────────────────
  getCaseTypes(): Observable<CaseType[]> {
    return this.http.get<CaseType[]>(`${this.caseUrl}/case-types`);
  }

  // ─── Cases ───────────────────────────────────────
  getCases(filters?: Record<string, string>): Observable<Case[]> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val) { params = params.set(key, val); }
      });
    }
    return this.http.get<Case[]>(`${this.caseUrl}/cases`, { params });
  }

  getCaseById(id: string): Observable<Case | undefined> {
    return this.http.get<Case>(`${this.caseUrl}/cases/${id}`);
  }

  updateCase(caseId: string, updates: Partial<Case>): Observable<Case> {
    return this.http.patch<Case>(`${this.caseUrl}/cases/${caseId}`, updates);
  }

  transitionCase(caseId: string, action: string, notes?: string): Observable<Case> {
    return this.http.post<Case>(`${this.caseUrl}/cases/${caseId}/stage`, { action, notes });
  }

  // ─── Tasks ───────────────────────────────────────
  getTasks(filters?: Record<string, string>): Observable<Task[]> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val) { params = params.set(key, val); }
      });
    }
    return this.http.get<Task[]>(`${this.taskUrl}/tasks`, { params });
  }

  getTaskById(id: string): Observable<Task | undefined> {
    return this.http.get<Task>(`${this.taskUrl}/tasks/${id}`);
  }

  getTasksByStatus(status: string): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.taskUrl}/tasks`, {
      params: new HttpParams().set('status', status),
    });
  }

  getKanbanBoard(caseId?: string): Observable<KanbanBoard> {
    let params = new HttpParams();
    if (caseId) { params = params.set('caseId', caseId); }
    return this.http.get<KanbanBoard>(`${this.taskUrl}/tasks/kanban`, { params });
  }

  updateTask(taskId: string, updates: Partial<Task>): Observable<Task> {
    return this.http.patch<Task>(`${this.taskUrl}/tasks/${taskId}`, updates);
  }

  // ─── Comments ────────────────────────────────────
  getComments(caseId?: string, taskId?: string): Observable<Comment[]> {
    let params = new HttpParams();
    if (caseId) { params = params.set('caseId', caseId); }
    if (taskId) { params = params.set('taskId', taskId); }
    return this.http.get<Comment[]>(`${this.caseUrl}/comments`, { params });
  }

  addComment(comment: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'>): Observable<Comment> {
    return this.http.post<Comment>(`${this.caseUrl}/comments`, comment);
  }

  // ─── Notifications ──────────────────────────────
  getNotifications(userId: string): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.notifyUrl}/notifications`, {
      params: new HttpParams().set('userId', userId),
    });
  }

  addNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Observable<Notification> {
    return this.http.post<Notification>(`${this.notifyUrl}/notifications`, notification);
  }

  markNotificationAsRead(notificationId: string): Observable<Notification> {
    return this.http.patch<Notification>(
      `${this.notifyUrl}/notifications/${notificationId}/read`, {}
    );
  }

  // ─── Audit ───────────────────────────────────────
  getAuditLogs(entityId: string): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.caseUrl}/audit-logs`, {
      params: new HttpParams().set('entityId', entityId),
    });
  }
}
