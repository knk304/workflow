import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  User, Team, CaseType, Case, Task, KanbanBoard,
  Comment, Notification, AuditLog,
  Workflow, WorkflowValidationResult,
  ApprovalChain, ApprovalDecision, ApprovalDelegation,
  Document, DocumentVersion,
  SLADashboard, SLADefinition,
  FormDefinition, FormSubmission,
  TransitionOption,
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

  createUser(user: { email: string; password: string; name: string; role: string; teamIds: string[] }): Observable<User> {
    return this.http.post<User>(`${this.authUrl}/users`, user);
  }

  updateUser(id: string, updates: { name?: string; role?: string; teamIds?: string[] }): Observable<User> {
    return this.http.put<User>(`${this.authUrl}/users/${id}`, updates);
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.authUrl}/users/${id}`);
  }

  // ─── Teams ───────────────────────────────────────
  getTeams(): Observable<Team[]> {
    return this.http.get<Team[]>(`${this.authUrl}/teams`);
  }

  createTeam(team: { name: string; description?: string; memberIds: string[] }): Observable<Team> {
    return this.http.post<Team>(`${this.authUrl}/teams`, team);
  }

  updateTeam(id: string, updates: { name?: string; description?: string; memberIds?: string[] }): Observable<Team> {
    return this.http.put<Team>(`${this.authUrl}/teams/${id}`, updates);
  }

  deleteTeam(id: string): Observable<void> {
    return this.http.delete<void>(`${this.authUrl}/teams/${id}`);
  }

  // ─── Case Types ──────────────────────────────────
  getCaseTypes(): Observable<CaseType[]> {
    return this.http.get<CaseType[]>(`${this.caseUrl}/case-types`);
  }

  createCaseType(ct: { name: string; slug: string; description?: string; workflowId?: string; fieldsSchema?: Record<string, any> }): Observable<CaseType> {
    return this.http.post<CaseType>(`${this.caseUrl}/case-types`, ct);
  }

  updateCaseType(id: string, updates: { name?: string; slug?: string; description?: string; workflowId?: string; fieldsSchema?: Record<string, any> }): Observable<CaseType> {
    return this.http.patch<CaseType>(`${this.caseUrl}/case-types/${id}`, updates);
  }

  deleteCaseType(id: string): Observable<void> {
    return this.http.delete<void>(`${this.caseUrl}/case-types/${id}`);
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

  createCase(caseData: Partial<Case>): Observable<Case> {
    return this.http.post<Case>(`${this.caseUrl}/cases`, caseData);
  }

  updateCase(caseId: string, updates: Partial<Case>): Observable<Case> {
    return this.http.patch<Case>(`${this.caseUrl}/cases/${caseId}`, updates);
  }

  transitionCase(caseId: string, action: string, notes?: string): Observable<Case> {
    return this.http.patch<Case>(`${this.caseUrl}/cases/${caseId}/stage`, { action, notes });
  }

  getAvailableTransitions(caseId: string): Observable<TransitionOption[]> {
    return this.http.get<TransitionOption[]>(`${this.caseUrl}/cases/${caseId}/transitions`);
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

  createTask(task: Partial<Task>): Observable<Task> {
    return this.http.post<Task>(`${this.taskUrl}/tasks`, task);
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

  // ─── Workflows ──────────────────────────────────
  getWorkflows(): Observable<Workflow[]> {
    return this.http.get<Workflow[]>(`${this.caseUrl}/workflows`);
  }

  getWorkflowById(id: string): Observable<Workflow> {
    return this.http.get<Workflow>(`${this.caseUrl}/workflows/${id}`);
  }

  createWorkflow(workflow: Partial<Workflow>): Observable<Workflow> {
    return this.http.post<Workflow>(`${this.caseUrl}/workflows`, workflow);
  }

  updateWorkflow(id: string, updates: Partial<Workflow>): Observable<Workflow> {
    return this.http.patch<Workflow>(`${this.caseUrl}/workflows/${id}`, updates);
  }

  deleteWorkflow(id: string): Observable<void> {
    return this.http.delete<void>(`${this.caseUrl}/workflows/${id}`);
  }

  validateWorkflow(id: string): Observable<WorkflowValidationResult> {
    return this.http.post<WorkflowValidationResult>(`${this.caseUrl}/workflows/${id}/validate`, {});
  }

  // ─── Approvals ──────────────────────────────────
  private mapApprover(raw: any): any {
    return {
      userId: raw.user_id ?? raw.userId ?? '',
      userName: raw.user_name ?? raw.userName ?? undefined,
      status: raw.status ?? 'pending',
      decidedAt: raw.decision_at ?? raw.decidedAt ?? undefined,
      comment: raw.decision_notes ?? raw.comment ?? undefined,
      delegatedTo: raw.delegated_to ?? raw.delegatedTo ?? undefined,
    };
  }

  private mapApprovalChain(raw: any): ApprovalChain {
    return {
      id: raw.id,
      caseId: raw.case_id ?? raw.caseId ?? '',
      taskId: raw.task_id ?? raw.taskId ?? undefined,
      mode: raw.mode ?? 'sequential',
      approvers: (raw.approvers || []).map((a: any) => this.mapApprover(a)),
      status: raw.status ?? 'pending',
      createdBy: raw.created_by ?? raw.createdBy ?? '',
      createdAt: raw.created_at ?? raw.createdAt ?? '',
    };
  }

  getApprovals(caseId?: string): Observable<ApprovalChain[]> {
    let params = new HttpParams();
    if (caseId) { params = params.set('case_id', caseId); }
    return this.http.get<any[]>(`${this.caseUrl}/approvals`, { params }).pipe(
      map(list => list.map(item => this.mapApprovalChain(item)))
    );
  }

  getApprovalById(id: string): Observable<ApprovalChain> {
    return this.http.get<any>(`${this.caseUrl}/approvals/${id}`).pipe(
      map(item => this.mapApprovalChain(item))
    );
  }

  createApproval(approval: Partial<ApprovalChain>): Observable<ApprovalChain> {
    const body: any = {
      case_id: approval.caseId,
      mode: approval.mode ?? 'sequential',
      approvers: (approval.approvers || []).map((a, idx) => ({
        user_id: a.userId,
        sequence: idx,
        status: 'pending',
      })),
    };
    return this.http.post<any>(`${this.caseUrl}/approvals`, body).pipe(
      map(item => this.mapApprovalChain(item))
    );
  }

  approveChain(id: string, decision: ApprovalDecision): Observable<ApprovalChain> {
    return this.http.post<any>(`${this.caseUrl}/approvals/${id}/approve`, { notes: decision.comment }).pipe(
      map(item => this.mapApprovalChain(item))
    );
  }

  rejectChain(id: string, decision: ApprovalDecision): Observable<ApprovalChain> {
    return this.http.post<any>(`${this.caseUrl}/approvals/${id}/reject`, { notes: decision.comment }).pipe(
      map(item => this.mapApprovalChain(item))
    );
  }

  delegateApproval(id: string, delegation: ApprovalDelegation): Observable<ApprovalChain> {
    return this.http.post<any>(`${this.caseUrl}/approvals/${id}/delegate`, {
      delegate_to: delegation.delegateTo,
      notes: delegation.comment,
    }).pipe(
      map(item => this.mapApprovalChain(item))
    );
  }

  // ─── Documents ──────────────────────────────────
  private mapDoc(raw: any): Document {
    return {
      id: raw.id,
      caseId: raw.case_id ?? raw.caseId ?? '',
      filename: raw.file_name ?? raw.filename ?? '',
      contentType: raw.file_type ?? raw.contentType ?? '',
      sizeBytes: raw.file_size ?? raw.sizeBytes ?? 0,
      version: raw.version ?? 1,
      isCurrent: raw.current ?? raw.isCurrent ?? true,
      uploadedBy: raw.uploaded_by ?? raw.uploadedBy ?? '',
      uploadedAt: raw.created_at ?? raw.uploadedAt ?? '',
      description: raw.description,
      tags: raw.tags ?? [],
    };
  }

  getDocuments(caseId?: string): Observable<Document[]> {
    let params = new HttpParams();
    if (caseId) { params = params.set('case_id', caseId); }
    return this.http.get<any[]>(`${this.caseUrl}/documents`, { params }).pipe(
      map(docs => docs.map(d => this.mapDoc(d)))
    );
  }

  getDocumentById(id: string): Observable<Document> {
    return this.http.get<any>(`${this.caseUrl}/documents/${id}`).pipe(
      map(d => this.mapDoc(d))
    );
  }

  uploadDocument(caseId: string, file: File, description?: string, tags?: string[]): Observable<Document> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('case_id', caseId);
    if (description) formData.append('description', description);
    if (tags) formData.append('tags', tags.join(','));
    return this.http.post<any>(`${this.caseUrl}/documents`, formData).pipe(
      map(d => this.mapDoc(d))
    );
  }

  deleteDocument(id: string): Observable<void> {
    return this.http.delete<void>(`${this.caseUrl}/documents/${id}`);
  }

  downloadDocument(id: string): Observable<Blob> {
    return this.http.get(`${this.caseUrl}/documents/${id}/download`, {
      responseType: 'blob'
    });
  }

  getDocumentVersions(id: string): Observable<DocumentVersion[]> {
    return this.http.get<any[]>(`${this.caseUrl}/documents/${id}/versions`).pipe(
      map(versions => versions.map(d => this.mapDoc(d) as any))
    );
  }

  // ─── SLA ────────────────────────────────────────
  getSLADashboard(): Observable<SLADashboard> {
    return this.http.get<SLADashboard>(`${this.caseUrl}/sla/dashboard`);
  }

  getSLADefinitions(caseTypeId?: string): Observable<SLADefinition[]> {
    let params = new HttpParams();
    if (caseTypeId) { params = params.set('case_type_id', caseTypeId); }
    return this.http.get<SLADefinition[]>(`${this.caseUrl}/sla/definitions`, { params });
  }

  acknowledgeSLA(caseId: string): Observable<any> {
    return this.http.post(`${this.caseUrl}/sla/${caseId}/acknowledge`, {});
  }

  // ─── Forms ──────────────────────────────────────
  getFormDefinitions(caseTypeId?: string, stage?: string): Observable<FormDefinition[]> {
    let params = new HttpParams();
    if (caseTypeId) { params = params.set('case_type_id', caseTypeId); }
    if (stage) { params = params.set('stage', stage); }
    return this.http.get<FormDefinition[]>(`${this.caseUrl}/forms/definitions`, { params });
  }

  getFormDefinitionById(id: string): Observable<FormDefinition> {
    return this.http.get<FormDefinition>(`${this.caseUrl}/forms/definitions/${id}`);
  }

  createFormDefinition(form: Partial<FormDefinition>): Observable<FormDefinition> {
    return this.http.post<FormDefinition>(`${this.caseUrl}/forms/definitions`, form);
  }

  updateFormDefinition(id: string, form: Partial<FormDefinition>): Observable<FormDefinition> {
    return this.http.patch<FormDefinition>(`${this.caseUrl}/forms/definitions/${id}`, form);
  }

  deleteFormDefinition(id: string): Observable<void> {
    return this.http.delete<void>(`${this.caseUrl}/forms/definitions/${id}`);
  }

  submitForm(submission: Omit<FormSubmission, 'id' | 'submittedBy' | 'submittedAt'>): Observable<FormSubmission> {
    return this.http.post<FormSubmission>(`${this.caseUrl}/forms/submissions`, submission);
  }

  getFormSubmissions(caseId?: string, formId?: string): Observable<FormSubmission[]> {
    let params = new HttpParams();
    if (caseId) { params = params.set('case_id', caseId); }
    if (formId) { params = params.set('form_id', formId); }
    return this.http.get<FormSubmission[]>(`${this.caseUrl}/forms/submissions`, { params });
  }
}
