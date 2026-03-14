import { Observable } from 'rxjs';
import {
  User, Team, CaseType, Case, Task, KanbanBoard,
  Comment, Notification, AuditLog,
} from '../models';

export abstract class DataService {
  // Users
  abstract getUsers(): Observable<User[]>;
  abstract getUserById(id: string): Observable<User | undefined>;
  abstract getCurrentUser(): Observable<User>;

  // Teams
  abstract getTeams(): Observable<Team[]>;

  // Case Types
  abstract getCaseTypes(): Observable<CaseType[]>;

  // Cases
  abstract getCases(filters?: Record<string, string>): Observable<Case[]>;
  abstract getCaseById(id: string): Observable<Case | undefined>;
  abstract updateCase(caseId: string, updates: Partial<Case>): Observable<Case>;

  // Tasks
  abstract getTasks(filters?: Record<string, string>): Observable<Task[]>;
  abstract getTaskById(id: string): Observable<Task | undefined>;
  abstract getTasksByStatus(status: string): Observable<Task[]>;
  abstract getKanbanBoard(caseId?: string): Observable<KanbanBoard>;
  abstract updateTask(taskId: string, updates: Partial<Task>): Observable<Task>;

  // Comments
  abstract getComments(caseId?: string, taskId?: string): Observable<Comment[]>;
  abstract addComment(comment: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'>): Observable<Comment>;

  // Notifications
  abstract getNotifications(userId: string): Observable<Notification[]>;
  abstract addNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Observable<Notification>;
  abstract markNotificationAsRead(notificationId: string): Observable<Notification>;

  // Audit
  abstract getAuditLogs(entityId: string): Observable<AuditLog[]>;
}
