import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  User, Team,
  Comment, Notification, AuditLog,
  Workflow, WorkflowValidationResult,
  ApprovalChain, ApprovalDecision, ApprovalDelegation,
  Document, DocumentVersion,
  SLADashboard, SLADefinition,
  FormDefinition, FormSubmission,
  CaseTypeDefinition, CaseTypeCreateRequest, CaseTypeUpdateRequest,
  StageDefinition, ProcessDefinition, StepDefinition,
  CaseInstance, StageInstance, ProcessInstance, StepInstance,
  CaseCreateRequest, CaseUpdateRequest,
  StepCompleteRequest, AdvanceStageRequest, ChangeStageRequest,
  Assignment, AssignmentCompleteRequest, AssignmentReassignRequest,
  DecisionTable, DecisionTableCreateRequest, DecisionTableUpdateRequest,
  DecisionTableEvaluateRequest, DecisionTableEvaluateResponse,
  RuleEvaluateRequest, RuleEvaluateResponse,
} from '../models';
import { DataService } from './data.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class ApiDataService extends DataService {
  private readonly caseUrl = environment.caseApiUrl;
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

  // ─── Pega-Lite: Case Type Definitions ───────────
  private mapCaseTypeDef(raw: any): CaseTypeDefinition {
    return {
      id: raw.id,
      name: raw.name,
      slug: raw.slug,
      description: raw.description,
      icon: raw.icon ?? 'folder',
      prefix: raw.prefix ?? 'CASE',
      fieldSchema: raw.field_schema ?? {},
      stages: (raw.stages ?? []).map((s: any) => this.mapStageDef(s)),
      attachmentCategories: (raw.attachment_categories ?? []).map((a: any) => ({
        id: a.id,
        name: a.name,
        requiredForResolution: a.required_for_resolution ?? false,
        allowedTypes: a.allowed_types ?? [],
      })),
      caseWideActions: raw.case_wide_actions ?? [],
      createdBy: raw.created_by,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      version: raw.version ?? 1,
      isActive: raw.is_active ?? true,
    };
  }

  private mapStageDef(raw: any): StageDefinition {
    return {
      id: raw.id,
      name: raw.name,
      stageType: raw.stage_type ?? 'primary',
      order: raw.order ?? 0,
      onComplete: raw.on_complete ?? 'auto_advance',
      resolutionStatus: raw.resolution_status,
      skipWhen: raw.skip_when,
      entryCriteria: raw.entry_criteria,
      slaHours: raw.sla_hours,
      processes: (raw.processes ?? []).map((p: any) => this.mapProcessDef(p)),
    };
  }

  private mapProcessDef(raw: any): ProcessDefinition {
    return {
      id: raw.id,
      name: raw.name,
      type: raw.type ?? 'sequential',
      order: raw.order ?? 0,
      isParallel: raw.is_parallel ?? false,
      startWhen: raw.start_when,
      slaHours: raw.sla_hours,
      steps: (raw.steps ?? []).map((s: any) => this.mapStepDef(s)),
    };
  }

  private mapStepDef(raw: any): StepDefinition {
    return {
      id: raw.id,
      name: raw.name,
      type: raw.type ?? 'assignment',
      order: raw.order ?? 0,
      required: raw.required ?? true,
      skipWhen: raw.skip_when,
      visibleWhen: raw.visible_when,
      slaHours: raw.sla_hours,
      config: this.deserializeStepConfig(raw.config ?? {}),
    };
  }

  private deserializeStepConfig(c: any): Record<string, any> {
    if (!c) return {};
    return {
      assigneeRole: c.assignee_role ?? c.assigneeRole,
      assigneeUserId: c.assignee_user_id ?? c.assigneeUserId,
      formId: c.form_id ?? c.formId,
      formFields: c.form_fields ?? c.formFields ?? [],
      instructions: c.instructions,
      setCaseStatus: c.set_case_status ?? c.setCaseStatus,
      mode: c.mode,
      approverRoles: c.approver_roles ?? c.approverRoles,
      approverUserIds: c.approver_user_ids ?? c.approverUserIds,
      allowDelegation: c.allow_delegation ?? c.allowDelegation,
      rejectionStageId: c.rejection_stage_id ?? c.rejectionStageId,
      categories: c.categories,
      minFiles: c.min_files ?? c.minFiles,
      allowedTypes: c.allowed_types ?? c.allowedTypes,
      maxFileSizeMb: c.max_file_size_mb ?? c.maxFileSizeMb,
      branches: (c.branches ?? []).map((b: any) => ({
        id: b.id, label: b.label, condition: b.condition,
        nextStepId: b.next_step_id ?? b.nextStepId,
      })),
      decisionTableId: c.decision_table_id ?? c.decisionTableId,
      defaultStepId: c.default_step_id ?? c.defaultStepId,
      actions: c.actions,
      rules: c.rules,
      webhook: c.webhook ? {
        url: c.webhook.url, method: c.webhook.method, headers: c.webhook.headers,
        bodyTemplate: c.webhook.body_template ?? c.webhook.bodyTemplate,
        responseMap: c.webhook.response_map ?? c.webhook.responseMap,
      } : undefined,
      childCaseTypeId: c.child_case_type_id ?? c.childCaseTypeId,
      fieldMapping: c.field_mapping ?? c.fieldMapping,
      waitForResolution: c.wait_for_resolution ?? c.waitForResolution,
      propagateFields: c.propagate_fields ?? c.propagateFields,
    };
  }

  getCaseTypeDefinitions(): Observable<CaseTypeDefinition[]> {
    return this.http.get<any[]>(`${this.caseUrl}/case-types`).pipe(
      map(list => list.map(d => this.mapCaseTypeDef(d)))
    );
  }

  getCaseTypeDefinitionById(id: string): Observable<CaseTypeDefinition> {
    return this.http.get<any>(`${this.caseUrl}/case-types/${id}`).pipe(
      map(d => this.mapCaseTypeDef(d))
    );
  }

  // ─── Pega-Lite: Case Instances ──────────────────
  private mapCaseInstance(raw: any): CaseInstance {
    return {
      id: raw.id,
      caseTypeId: raw.case_type_id ?? '',
      caseTypeName: raw.case_type_name ?? '',
      title: raw.title ?? '',
      description: raw.description ?? '',
      status: raw.status ?? 'open',
      priority: raw.priority ?? 'medium',
      ownerId: raw.owner_id ?? '',
      teamId: raw.team_id,
      data: raw.custom_fields ?? raw.data ?? {},
      currentStageIndex: raw.current_stage_index ?? 0,
      currentStageId: raw.current_stage_id,
      currentProcessId: raw.current_process_id,
      currentStepId: raw.current_step_id,
      stages: (raw.stages ?? []).map((s: any) => this.mapStageInstance(s)),
      createdBy: raw.created_by ?? '',
      createdAt: raw.created_at ?? '',
      updatedAt: raw.updated_at ?? '',
      resolvedAt: raw.resolved_at,
      resolutionStatus: raw.resolution_status,
      parentCaseId: raw.parent_case_id,
      slaTargetDate: raw.sla_target_date,
      slaDaysRemaining: raw.sla_days_remaining,
      escalationLevel: raw.escalation_level ?? 0,
    };
  }

  private mapStageInstance(raw: any): StageInstance {
    return {
      stageDefinitionId: raw.stage_definition_id ?? raw.definition_id ?? '',
      name: raw.name ?? '',
      stageType: raw.stage_type ?? 'primary',
      status: raw.status ?? 'pending',
      order: raw.order ?? 0,
      onComplete: raw.on_complete ?? '',
      enteredAt: raw.entered_at,
      completedAt: raw.completed_at,
      completedBy: raw.completed_by,
      processes: (raw.processes ?? []).map((p: any) => this.mapProcessInstance(p)),
    };
  }

  private mapProcessInstance(raw: any): ProcessInstance {
    return {
      processDefinitionId: raw.process_definition_id ?? raw.definition_id ?? '',
      name: raw.name ?? '',
      type: raw.type ?? 'sequential',
      status: raw.status ?? 'pending',
      order: raw.order ?? 0,
      isParallel: raw.is_parallel ?? false,
      startedAt: raw.started_at,
      completedAt: raw.completed_at,
      steps: (raw.steps ?? []).map((s: any) => this.mapStepInstance(s)),
    };
  }

  private mapStepInstance(raw: any): StepInstance {
    return {
      stepDefinitionId: raw.step_definition_id ?? raw.definition_id ?? '',
      name: raw.name ?? '',
      type: raw.type ?? 'assignment',
      status: raw.status ?? 'pending',
      order: raw.order ?? 0,
      description: raw.description ?? '',
      config: raw.config ?? {},
      formFields: raw.form_fields ?? [],
      startedAt: raw.started_at,
      completedAt: raw.completed_at,
      completedBy: raw.completed_by,
      assignedTo: raw.assigned_to,
      formSubmissionId: raw.form_submission_id,
      approvalChainId: raw.approval_chain_id,
      childCaseId: raw.child_case_id,
      decisionBranchTaken: raw.decision_branch_taken,
      skippedReason: raw.skipped_reason,
      notes: raw.notes,
      slaTarget: raw.sla_target,
    };
  }

  getCaseInstances(filters?: Record<string, string>): Observable<CaseInstance[]> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val) { params = params.set(key, val); }
      });
    }
    return this.http.get<any[]>(`${this.caseUrl}/cases`, { params }).pipe(
      map(list => list.map(d => this.mapCaseInstance(d)))
    );
  }

  getCaseInstanceById(id: string): Observable<CaseInstance> {
    return this.http.get<any>(`${this.caseUrl}/cases/${id}`).pipe(
      map(d => this.mapCaseInstance(d))
    );
  }

  createCaseInstance(req: CaseCreateRequest): Observable<CaseInstance> {
    const body = {
      case_type_id: req.caseTypeId,
      title: req.title,
      description: req.description,
      priority: req.priority,
      owner_id: req.ownerId,
      team_id: req.teamId,
      custom_fields: req.customFields,
    };
    return this.http.post<any>(`${this.caseUrl}/cases`, body).pipe(
      map(d => this.mapCaseInstance(d))
    );
  }

  updateCaseInstance(id: string, req: CaseUpdateRequest): Observable<CaseInstance> {
    const body: Record<string, any> = {};
    if (req.title !== undefined) body['title'] = req.title;
    if (req.priority !== undefined) body['priority'] = req.priority;
    if (req.ownerId !== undefined) body['owner_id'] = req.ownerId;
    if (req.teamId !== undefined) body['team_id'] = req.teamId;
    if (req.customFields !== undefined) body['custom_fields'] = req.customFields;
    return this.http.patch<any>(`${this.caseUrl}/cases/${id}`, body).pipe(
      map(d => this.mapCaseInstance(d))
    );
  }

  completeStep(caseId: string, stepId: string, req: StepCompleteRequest): Observable<CaseInstance> {
    const body = {
      notes: req.notes,
      form_data: req.formData,
      decision: req.decision,
      delegate_to: req.delegateTo,
    };
    return this.http.post<any>(`${this.caseUrl}/cases/${caseId}/steps/${stepId}/complete`, body).pipe(
      map(d => this.mapCaseInstance(d))
    );
  }

  advanceStage(caseId: string, req?: AdvanceStageRequest): Observable<CaseInstance> {
    return this.http.post<any>(`${this.caseUrl}/cases/${caseId}/advance`, req ?? {}).pipe(
      map(d => this.mapCaseInstance(d))
    );
  }

  changeStage(caseId: string, req: ChangeStageRequest): Observable<CaseInstance> {
    return this.http.post<any>(`${this.caseUrl}/cases/${caseId}/change-stage`, {
      target_stage_id: req.targetStageId,
      reason: req.reason,
    }).pipe(
      map(d => this.mapCaseInstance(d))
    );
  }

  resolveCase(caseId: string): Observable<CaseInstance> {
    return this.http.post<any>(`${this.caseUrl}/cases/${caseId}/resolve`, {}).pipe(
      map(d => this.mapCaseInstance(d))
    );
  }

  withdrawCase(caseId: string): Observable<CaseInstance> {
    return this.http.post<any>(`${this.caseUrl}/cases/${caseId}/withdraw`, {}).pipe(
      map(d => this.mapCaseInstance(d))
    );
  }

  // ─── Pega-Lite: Assignments ─────────────────────
  private mapAssignment(raw: any): Assignment {
    return {
      id: raw.id,
      caseId: raw.case_id ?? '',
      caseTitle: raw.case_title ?? '',
      caseTypeId: raw.case_type_id ?? '',
      stageName: raw.stage_name ?? '',
      processName: raw.process_name ?? '',
      stepName: raw.step_name ?? '',
      name: raw.name ?? raw.step_name ?? '',
      assignmentType: raw.type ?? raw.assignment_type ?? 'form',
      status: raw.status ?? 'open',
      priority: raw.priority ?? 'medium',
      assignedTo: raw.assigned_to,
      assignedToName: raw.assigned_to_name,
      assignedRole: raw.assigned_role,
      formId: raw.form_id,
      instructions: raw.instructions,
      dueAt: raw.due_at,
      isOverdue: raw.is_overdue ?? false,
      slaHours: raw.sla_hours,
      createdAt: raw.created_at ?? '',
    };
  }

  getAssignments(filters?: Record<string, string>): Observable<Assignment[]> {
    let params = new HttpParams();
    if (filters) {
      Object.entries(filters).forEach(([key, val]) => {
        if (val) { params = params.set(key, val); }
      });
    }
    return this.http.get<any[]>(`${this.caseUrl}/assignments`, { params }).pipe(
      map(list => list.map(d => this.mapAssignment(d)))
    );
  }

  getMyAssignments(): Observable<Assignment[]> {
    return this.http.get<any[]>(`${this.caseUrl}/assignments/my`).pipe(
      map(list => list.map(d => this.mapAssignment(d)))
    );
  }

  getAssignmentById(id: string): Observable<Assignment> {
    return this.http.get<any>(`${this.caseUrl}/assignments/${id}`).pipe(
      map(d => this.mapAssignment(d))
    );
  }

  completeAssignment(id: string, req: AssignmentCompleteRequest): Observable<Assignment> {
    return this.http.post<any>(`${this.caseUrl}/assignments/${id}/complete`, {
      form_data: req.formData,
      notes: req.notes,
      decision: req.decision,
      delegate_to: req.delegateTo,
    }).pipe(
      map(d => this.mapAssignment(d))
    );
  }

  reassignAssignment(id: string, req: AssignmentReassignRequest): Observable<Assignment> {
    return this.http.post<any>(`${this.caseUrl}/assignments/${id}/reassign`, {
      assigned_to: req.assignedTo,
      reason: req.reason,
    }).pipe(
      map(d => this.mapAssignment(d))
    );
  }

  holdAssignment(id: string): Observable<Assignment> {
    return this.http.post<any>(`${this.caseUrl}/assignments/${id}/hold`, {}).pipe(
      map(d => this.mapAssignment(d))
    );
  }

  resumeAssignment(id: string): Observable<Assignment> {
    return this.http.post<any>(`${this.caseUrl}/assignments/${id}/resume`, {}).pipe(
      map(d => this.mapAssignment(d))
    );
  }

  // ===== Admin — Case Type Definitions CRUD =====

  createCaseTypeDefinition(req: CaseTypeCreateRequest): Observable<CaseTypeDefinition> {
    const body = {
      name: req.name,
      slug: req.slug,
      description: req.description,
      icon: req.icon || 'folder',
      prefix: req.prefix,
      field_schema: req.fieldSchema || {},
      stages: (req.stages || []).map(s => this.serializeStageDef(s as StageDefinition)),
      attachment_categories: (req.attachmentCategories || []).map(c => ({
        id: c.id, name: c.name,
        required_for_resolution: c.requiredForResolution,
        allowed_types: c.allowedTypes,
      })),
    };
    return this.http.post<any>(`${this.caseUrl}/case-types`, body).pipe(
      map(d => this.mapCaseTypeDef(d))
    );
  }

  updateCaseTypeDefinition(id: string, req: CaseTypeUpdateRequest): Observable<CaseTypeDefinition> {
    const body: Record<string, any> = {};
    if (req.name !== undefined) body['name'] = req.name;
    if (req.slug !== undefined) body['slug'] = req.slug;
    if (req.description !== undefined) body['description'] = req.description;
    if (req.icon !== undefined) body['icon'] = req.icon;
    if (req.prefix !== undefined) body['prefix'] = req.prefix;
    if (req.fieldSchema !== undefined) body['field_schema'] = req.fieldSchema;
    if (req.isActive !== undefined) body['is_active'] = req.isActive;
    if (req.stages !== undefined) body['stages'] = req.stages.map(s => this.serializeStageDef(s));
    if (req.attachmentCategories !== undefined) body['attachment_categories'] = req.attachmentCategories.map(c => ({
      id: c.id, name: c.name,
      required_for_resolution: c.requiredForResolution,
      allowed_types: c.allowedTypes,
    }));
    return this.http.patch<any>(`${this.caseUrl}/case-types/${id}`, body).pipe(
      map(d => this.mapCaseTypeDef(d))
    );
  }

  deleteCaseTypeDefinition(id: string): Observable<void> {
    return this.http.delete<void>(`${this.caseUrl}/case-types/${id}`);
  }

  duplicateCaseTypeDefinition(id: string): Observable<CaseTypeDefinition> {
    return this.http.post<any>(`${this.caseUrl}/case-types/${id}/duplicate`, {}).pipe(
      map(d => this.mapCaseTypeDef(d))
    );
  }

  validateCaseTypeDefinition(id: string): Observable<{ valid: boolean; errors: string[] }> {
    return this.http.post<{ valid: boolean; errors: string[] }>(`${this.caseUrl}/case-types/${id}/validate`, {});
  }

  private serializeStageDef(s: StageDefinition): Record<string, any> {
    return {
      id: s.id, name: s.name, stage_type: s.stageType, order: s.order,
      on_complete: s.onComplete, resolution_status: s.resolutionStatus || null,
      skip_when: s.skipWhen || null, entry_criteria: s.entryCriteria || null,
      sla_hours: s.slaHours || null,
      processes: (s.processes || []).map(p => ({
        id: p.id, name: p.name, type: p.type, order: p.order,
        is_parallel: p.isParallel, start_when: p.startWhen || null,
        sla_hours: p.slaHours || null,
        steps: (p.steps || []).map(st => ({
          id: st.id, name: st.name, type: st.type, order: st.order,
          required: st.required, skip_when: st.skipWhen || null,
          visible_when: st.visibleWhen || null, sla_hours: st.slaHours || null,
          config: this.serializeStepConfig(st.config),
        })),
      })),
    };
  }

  private serializeStepConfig(c: any): Record<string, any> {
    if (!c) return {};
    return {
      assignee_role: c.assigneeRole, assignee_user_id: c.assigneeUserId,
      form_id: c.formId, form_fields: c.formFields ?? [],
      instructions: c.instructions,
      set_case_status: c.setCaseStatus, mode: c.mode,
      approver_roles: c.approverRoles, approver_user_ids: c.approverUserIds,
      allow_delegation: c.allowDelegation, rejection_stage_id: c.rejectionStageId,
      categories: c.categories, min_files: c.minFiles,
      allowed_types: c.allowedTypes, max_file_size_mb: c.maxFileSizeMb,
      branches: c.branches?.map((b: any) => ({
        id: b.id, label: b.label, condition: b.condition, next_step_id: b.nextStepId,
      })),
      decision_table_id: c.decisionTableId, default_step_id: c.defaultStepId,
      actions: c.actions, rules: c.rules,
      webhook: c.webhook ? {
        url: c.webhook.url, method: c.webhook.method, headers: c.webhook.headers,
        body_template: c.webhook.bodyTemplate, response_map: c.webhook.responseMap,
      } : undefined,
      child_case_type_id: c.childCaseTypeId, field_mapping: c.fieldMapping,
      wait_for_resolution: c.waitForResolution, propagate_fields: c.propagateFields,
    };
  }

  // ===== Admin — Decision Tables CRUD =====

  getDecisionTables(): Observable<DecisionTable[]> {
    return this.http.get<any[]>(`${this.caseUrl}/decision-tables`).pipe(
      map(list => list.map(d => this.mapDecisionTable(d)))
    );
  }

  getDecisionTableById(id: string): Observable<DecisionTable> {
    return this.http.get<any>(`${this.caseUrl}/decision-tables/${id}`).pipe(
      map(d => this.mapDecisionTable(d))
    );
  }

  createDecisionTable(req: DecisionTableCreateRequest): Observable<DecisionTable> {
    const body = {
      name: req.name, description: req.description,
      inputs: req.inputs, output_field: req.outputField,
      rows: req.rows, default_output: req.defaultOutput,
    };
    return this.http.post<any>(`${this.caseUrl}/decision-tables`, body).pipe(
      map(d => this.mapDecisionTable(d))
    );
  }

  updateDecisionTable(id: string, req: DecisionTableUpdateRequest): Observable<DecisionTable> {
    const body: Record<string, any> = {};
    if (req.name !== undefined) body['name'] = req.name;
    if (req.description !== undefined) body['description'] = req.description;
    if (req.inputs !== undefined) body['inputs'] = req.inputs;
    if (req.outputField !== undefined) body['output_field'] = req.outputField;
    if (req.rows !== undefined) body['rows'] = req.rows;
    if (req.defaultOutput !== undefined) body['default_output'] = req.defaultOutput;
    return this.http.patch<any>(`${this.caseUrl}/decision-tables/${id}`, body).pipe(
      map(d => this.mapDecisionTable(d))
    );
  }

  deleteDecisionTable(id: string): Observable<void> {
    return this.http.delete<void>(`${this.caseUrl}/decision-tables/${id}`);
  }

  evaluateDecisionTable(id: string, req: DecisionTableEvaluateRequest): Observable<DecisionTableEvaluateResponse> {
    return this.http.post<any>(`${this.caseUrl}/decision-tables/${id}/evaluate`, { data: req.data }).pipe(
      map(d => ({ output: d.output, matchedRow: d.matched_row }))
    );
  }

  private mapDecisionTable(d: any): DecisionTable {
    return {
      id: d.id || d._id,
      name: d.name,
      description: d.description,
      inputs: d.inputs || [],
      outputField: d.output_field,
      rows: (d.rows || []).map((r: any) => ({
        conditions: r.conditions,
        output: r.output,
        priority: r.priority ?? 0,
      })),
      defaultOutput: d.default_output,
      createdBy: d.created_by,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      version: d.version ?? 1,
    };
  }

  // ===== Admin — Rules =====

  evaluateRule(req: RuleEvaluateRequest): Observable<RuleEvaluateResponse> {
    return this.http.post<any>(`${this.caseUrl}/rules/evaluate`, {
      condition: req.condition, data: req.data,
    }).pipe(
      map(d => ({
        result: d.result,
        matchedConditions: d.matched_conditions || [],
        evaluationPath: d.evaluation_path || [],
      }))
    );
  }
}
