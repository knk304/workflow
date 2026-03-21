import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import {
  User,
  Comment,
  Notification,
  Team,
  AuditLog,
  Workflow,
  WorkflowValidationResult,
  ApprovalChain,
  ApprovalDecision,
  ApprovalDelegation,
  Document,
  DocumentVersion,
  SLADashboard,
  SLADefinition,
  FormDefinition,
  FormSubmission,
  CaseTypeDefinition, CaseTypeCreateRequest, CaseTypeUpdateRequest,
  CaseInstance, CaseCreateRequest, CaseUpdateRequest,
  StepCompleteRequest, AdvanceStageRequest, ChangeStageRequest,
  Assignment, AssignmentCompleteRequest, AssignmentReassignRequest,
  DecisionTable, DecisionTableCreateRequest, DecisionTableUpdateRequest,
  DecisionTableEvaluateRequest, DecisionTableEvaluateResponse,
  RuleEvaluateRequest, RuleEvaluateResponse,
} from '../models';
import { DataService } from './data.service';

@Injectable()
export class MockDataService extends DataService {
  // Mock Users
  private mockUsers: User[] = [
    {
      id: 'user-1',
      email: 'alice@example.com',
      name: 'Alice Johnson',
      role: 'MANAGER',
      teamIds: ['team-1'],
      avatar: '👩‍💼',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'user-2',
      email: 'bob@example.com',
      name: 'Bob Smith',
      role: 'WORKER',
      teamIds: ['team-1'],
      avatar: '👨‍💼',
      createdAt: '2025-01-05T00:00:00.000Z',
    },
    {
      id: 'user-3',
      email: 'carol@example.com',
      name: 'Carol Davis',
      role: 'WORKER',
      teamIds: ['team-1'],
      avatar: '👩‍🔬',
      createdAt: '2025-01-10T00:00:00.000Z',
    },
    {
      id: 'user-4',
      email: 'dave@example.com',
      name: 'Dave Wilson',
      role: 'ADMIN',
      teamIds: ['team-1', 'team-2'],
      avatar: '👨‍⚖️',
      createdAt: '2024-12-01T00:00:00.000Z',
    },
  ];

  // Mock Teams
  private mockTeams: Team[] = [
    {
      id: 'team-1',
      name: 'Lending Operations',
      description: 'Loan origination and processing',
      memberIds: ['user-1', 'user-2', 'user-3'],
      createdAt: '2024-12-01T00:00:00.000Z',
    },
    {
      id: 'team-2',
      name: 'Compliance',
      description: 'Risk and compliance review',
      memberIds: ['user-4'],
      createdAt: '2024-12-15T00:00:00.000Z',
    },
  ];

  // Mock Comments
  private mockComments: Comment[] = [
    {
      id: 'comment-1',
      caseId: 'CASE-2026-00001',
      userId: 'user-1',
      userName: 'Alice Johnson',
      userAvatar: '👩‍💼',
      text: 'I reviewed the application. Looking good so far, but missing proof of income.',
      mentions: [],
      createdAt: '2026-03-11T00:00:00.000Z',
      updatedAt: '2026-03-11T00:00:00.000Z',
    },
    {
      id: 'comment-2',
      caseId: 'CASE-2026-00001',
      userId: 'user-2',
      userName: 'Bob Smith',
      userAvatar: '👨‍💼',
      text: '@Alice Johnson - I will reach out to the applicant today about the missing documents.',
      mentions: [{ userId: 'user-1', userName: 'Alice Johnson' }],
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
    },
    {
      id: 'comment-3',
      caseId: 'CASE-2026-00002',
      taskId: 'task-3',
      userId: 'user-1',
      userName: 'Alice Johnson',
      userAvatar: '👩‍💼',
      text: 'Credit score is excellent. DTI ratio is within acceptable limits. Just waiting on collateral assessment.',
      mentions: [],
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
    },
  ];

  // Mock Notifications
  private mockNotifications: Notification[] = [
    {
      id: 'notif-1',
      userId: 'user-1',
      type: 'assignment',
      title: 'New task assigned',
      message: 'Review initial application for CASE-2026-00001',
      entityType: 'task',
      entityId: 'task-1',
      isRead: true,
      readAt: '2026-03-12T00:00:00.000Z',
      createdAt: '2026-03-10T00:00:00.000Z',
    },
    {
      id: 'notif-2',
      userId: 'user-1',
      type: 'mention',
      title: 'You were mentioned',
      message: 'Bob Smith mentioned you in CASE-2026-00001',
      entityType: 'case',
      entityId: 'CASE-2026-00001',
      isRead: false,
      createdAt: '2026-03-12T00:00:00.000Z',
    },
    {
      id: 'notif-3',
      userId: 'user-1',
      type: 'sla_warning',
      title: 'SLA Warning',
      message: 'CASE-2026-00002 is approaching SLA threshold (75%)',
      entityType: 'case',
      entityId: 'CASE-2026-00002',
      isRead: false,
      createdAt: '2026-03-12T00:00:00.000Z',
    },
  ];

  // Mock Audit Logs
  private mockAuditLogs: AuditLog[] = [
    {
      id: 'audit-1',
      entityType: 'case',
      entityId: 'CASE-2026-00001',
      action: 'created',
      actorId: 'user-1',
      actorName: 'Alice Johnson',
      changes: {
        before: {},
        after: { status: 'open', stage: 'intake' },
      },
      timestamp: '2026-03-10T00:00:00.000Z',
    },
    {
      id: 'audit-2',
      entityType: 'task',
      entityId: 'task-1',
      action: 'assigned',
      actorId: 'user-1',
      actorName: 'Alice Johnson',
      changes: {
        before: { assigneeId: null },
        after: { assigneeId: 'user-1' },
      },
      timestamp: '2026-03-10T00:00:00.000Z',
    },
  ];

  // Getters
  getUsers(): Observable<User[]> {
    return of([...this.mockUsers]).pipe(delay(300));
  }

  getUserById(id: string): Observable<User | undefined> {
    return of(this.mockUsers.find((u) => u.id === id)).pipe(delay(200));
  }

  getCurrentUser(): Observable<User> {
    return of(this.mockUsers[0]).pipe(delay(200)); // Returns Alice as current user
  }

  createUser(user: { email: string; password: string; name: string; role: string; teamIds: string[] }): Observable<User> {
    const newUser: User = { id: `user-${Date.now()}`, email: user.email, name: user.name, role: user.role as any, teamIds: user.teamIds, createdAt: new Date().toISOString() };
    this.mockUsers.push(newUser);
    return of(newUser).pipe(delay(300));
  }

  updateUser(id: string, updates: { name?: string; role?: string; teamIds?: string[] }): Observable<User> {
    const u = this.mockUsers.find(u => u.id === id);
    if (u) { Object.assign(u, updates); }
    return of(u!).pipe(delay(300));
  }

  deleteUser(id: string): Observable<void> {
    this.mockUsers = this.mockUsers.filter(u => u.id !== id);
    return of(void 0).pipe(delay(300));
  }

  getTeams(): Observable<Team[]> {
    return of([...this.mockTeams]).pipe(delay(300));
  }

  createTeam(team: { name: string; description?: string; memberIds: string[] }): Observable<Team> {
    const newTeam: Team = { id: `team-${Date.now()}`, name: team.name, description: team.description, memberIds: team.memberIds, createdAt: new Date().toISOString() };
    this.mockTeams.push(newTeam);
    return of(newTeam).pipe(delay(300));
  }

  updateTeam(id: string, updates: { name?: string; description?: string; memberIds?: string[] }): Observable<Team> {
    const t = this.mockTeams.find(t => t.id === id);
    if (t) { Object.assign(t, updates); }
    return of(t!).pipe(delay(300));
  }

  deleteTeam(id: string): Observable<void> {
    this.mockTeams = this.mockTeams.filter(t => t.id !== id);
    return of(void 0).pipe(delay(300));
  }

  getComments(caseId?: string, taskId?: string): Observable<Comment[]> {
    let comments = [...this.mockComments];
    if (caseId) {
      comments = comments.filter((c) => c.caseId === caseId);
    }
    if (taskId) {
      comments = comments.filter((c) => c.taskId === taskId);
    }
    return of(comments).pipe(delay(300));
  }

  getNotifications(userId: string): Observable<Notification[]> {
    return of(this.mockNotifications.filter((n) => n.userId === userId)).pipe(delay(300));
  }

  getAuditLogs(entityId: string): Observable<AuditLog[]> {
    return of(this.mockAuditLogs.filter((a) => a.entityId === entityId)).pipe(delay(300));
  }

  addComment(comment: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'>): Observable<Comment> {
    const newComment: Comment = {
      ...comment,
      id: `comment-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.mockComments.push(newComment);
    return of(newComment).pipe(delay(500));
  }

  addNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Observable<Notification> {
    const newNotif: Notification = {
      ...notification,
      id: `notif-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.mockNotifications.push(newNotif);
    return of(newNotif).pipe(delay(300));
  }

  markNotificationAsRead(notificationId: string): Observable<Notification> {
    const notifIdx = this.mockNotifications.findIndex((n) => n.id === notificationId);
    if (notifIdx >= 0) {
      this.mockNotifications[notifIdx].isRead = true;
      this.mockNotifications[notifIdx].readAt = new Date().toISOString();
      return of(this.mockNotifications[notifIdx]).pipe(delay(300));
    }
    throw new Error('Notification not found');
  }

  // ===== Phase 2 Mock Data =====

  private mockWorkflows: Workflow[] = [
    {
      id: 'wf-1',
      name: 'Loan Origination Workflow',
      description: 'Standard loan processing pipeline',
      caseTypeId: 'case-type-1',
      definition: {
        nodes: [
          { id: 'n1', type: 'start', label: 'Start', position: { x: 50, y: 200 } },
          { id: 'n2', type: 'task', label: 'Intake Review', position: { x: 250, y: 200 }, assigneeRole: 'WORKER' },
          { id: 'n3', type: 'decision', label: 'Docs Complete?', position: { x: 450, y: 200 } },
          { id: 'n4', type: 'task', label: 'Request Documents', position: { x: 450, y: 350 }, assigneeRole: 'WORKER' },
          { id: 'n5', type: 'task', label: 'Underwriting', position: { x: 650, y: 200 }, assigneeRole: 'MANAGER' },
          { id: 'n6', type: 'decision', label: 'Approved?', position: { x: 850, y: 200 } },
          { id: 'n7', type: 'task', label: 'Disbursement', position: { x: 1050, y: 200 }, assigneeRole: 'WORKER' },
          { id: 'n8', type: 'end', label: 'Complete', position: { x: 1250, y: 200 } },
          { id: 'n9', type: 'end', label: 'Rejected', position: { x: 850, y: 350 } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2' },
          { id: 'e2', source: 'n2', target: 'n3' },
          { id: 'e3', source: 'n3', target: 'n5', label: 'Yes' },
          { id: 'e4', source: 'n3', target: 'n4', label: 'No' },
          { id: 'e5', source: 'n4', target: 'n3' },
          { id: 'e6', source: 'n5', target: 'n6' },
          { id: 'e7', source: 'n6', target: 'n7', label: 'Approved' },
          { id: 'e8', source: 'n6', target: 'n9', label: 'Rejected' },
          { id: 'e9', source: 'n7', target: 'n8' },
        ],
      },
      version: 1,
      isActive: true,
      createdBy: 'user-4',
      createdAt: '2025-01-15T00:00:00.000Z',
    },
  ];

  private mockApprovals: ApprovalChain[] = [
    {
      id: 'approval-1',
      caseId: 'CASE-2026-00002',
      mode: 'sequential',
      approvers: [
        { userId: 'user-1', userName: 'Alice Johnson', status: 'approved', decidedAt: '2026-03-10T00:00:00.000Z', comment: 'Looks good' },
        { userId: 'user-4', userName: 'Dave Wilson', status: 'pending' },
      ],
      status: 'pending',
      createdBy: 'user-2',
      createdAt: '2026-03-09T00:00:00.000Z',
    },
    {
      id: 'approval-2',
      caseId: 'CASE-2026-00001',
      mode: 'parallel',
      approvers: [
        { userId: 'user-1', userName: 'Alice Johnson', status: 'approved', decidedAt: '2026-03-08T14:30:00.000Z', comment: 'Financial review passed' },
        { userId: 'user-2', userName: 'Bob Smith', status: 'approved', decidedAt: '2026-03-08T16:00:00.000Z', comment: 'Compliance check complete' },
        { userId: 'user-4', userName: 'Dave Wilson', status: 'approved', decidedAt: '2026-03-09T09:00:00.000Z', comment: 'Final sign-off' },
      ],
      status: 'approved',
      createdBy: 'user-4',
      createdAt: '2026-03-07T00:00:00.000Z',
    },
    {
      id: 'approval-3',
      caseId: 'CASE-2026-00003',
      mode: 'sequential',
      approvers: [
        { userId: 'user-1', userName: 'Alice Johnson', status: 'rejected', decidedAt: '2026-03-12T11:00:00.000Z', comment: 'Insufficient documentation provided' },
        { userId: 'user-4', userName: 'Dave Wilson', status: 'pending' },
      ],
      status: 'rejected',
      createdBy: 'user-3',
      createdAt: '2026-03-11T00:00:00.000Z',
    },
    {
      id: 'approval-4',
      caseId: 'CASE-2026-00002',
      mode: 'parallel',
      approvers: [
        { userId: 'user-2', userName: 'Bob Smith', status: 'pending' },
        { userId: 'user-3', userName: 'Carol Davis', status: 'pending' },
      ],
      status: 'pending',
      createdBy: 'user-1',
      createdAt: '2026-03-15T00:00:00.000Z',
    },
    {
      id: 'approval-5',
      caseId: 'CASE-2026-00001',
      mode: 'sequential',
      approvers: [
        { userId: 'user-3', userName: 'Carol Davis', status: 'approved', decidedAt: '2026-03-14T10:00:00.000Z', comment: 'Verified' },
        { userId: 'user-1', userName: 'Alice Johnson', status: 'delegated', decidedAt: '2026-03-14T14:00:00.000Z', comment: 'Delegating to Bob for review', delegatedTo: 'user-2' },
        { userId: 'user-4', userName: 'Dave Wilson', status: 'pending' },
      ],
      status: 'pending',
      createdBy: 'user-2',
      createdAt: '2026-03-13T00:00:00.000Z',
    },
  ];

  private mockDocuments: Document[] = [
    {
      id: 'doc-1',
      caseId: 'CASE-2026-00001',
      filename: 'identity_verification.pdf',
      contentType: 'application/pdf',
      sizeBytes: 245760,
      version: 1,
      isCurrent: true,
      uploadedBy: 'user-2',
      uploadedAt: '2026-03-11T00:00:00.000Z',
      description: 'Government ID scan',
      tags: ['identity', 'verification'],
    },
    {
      id: 'doc-2',
      caseId: 'CASE-2026-00002',
      filename: 'income_statement.pdf',
      contentType: 'application/pdf',
      sizeBytes: 512000,
      version: 2,
      isCurrent: true,
      uploadedBy: 'user-3',
      uploadedAt: '2026-03-06T00:00:00.000Z',
      description: 'Proof of income — updated',
      tags: ['income', 'financial'],
    },
  ];

  private mockFormDefinitions: FormDefinition[] = [
    {
      id: 'form-1',
      name: 'Loan Intake Form',
      caseTypeId: 'case-type-1',
      stage: 'intake',
      sections: [
        { id: 'sec-1', title: 'Applicant Information', order: 0 },
        { id: 'sec-2', title: 'Loan Details', order: 1 },
      ],
      fields: [
        { id: 'f1', type: 'text', label: 'Full Name', placeholder: 'Enter full name', order: 0, section: 'sec-1', validation: { required: true, minLength: 2 } },
        { id: 'f2', type: 'text', label: 'Email', placeholder: 'email@example.com', order: 1, section: 'sec-1', validation: { required: true, pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' } },
        { id: 'f3', type: 'number', label: 'Loan Amount', placeholder: '50000', order: 0, section: 'sec-2', validation: { required: true, minValue: 1000, maxValue: 1000000 } },
        { id: 'f4', type: 'select', label: 'Loan Type', order: 1, section: 'sec-2', validation: { required: true, options: ['personal', 'business', 'mortgage', 'auto'] } },
        { id: 'f5', type: 'date', label: 'Application Date', order: 2, section: 'sec-2', validation: { required: true } },
      ],
      description: 'Initial intake form for loan applications',
      version: 1,
      isActive: true,
      createdAt: '2025-01-20T00:00:00.000Z',
    },
  ];

  // Phase 2 Methods

  // Workflows
  getWorkflows(): Observable<Workflow[]> {
    return of([...this.mockWorkflows]).pipe(delay(300));
  }

  getWorkflowById(id: string): Observable<Workflow> {
    const wf = this.mockWorkflows.find(w => w.id === id);
    if (!wf) throw new Error('Workflow not found');
    return of({ ...wf }).pipe(delay(200));
  }

  createWorkflow(workflow: Partial<Workflow>): Observable<Workflow> {
    const newWf: Workflow = {
      id: `wf-${Date.now()}`,
      name: workflow.name || 'New Workflow',
      description: workflow.description || '',
      caseTypeId: workflow.caseTypeId || '',
      definition: workflow.definition || { nodes: [], edges: [] },
      version: 1,
      isActive: true,
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
    };
    this.mockWorkflows.push(newWf);
    return of(newWf).pipe(delay(500));
  }

  updateWorkflow(id: string, updates: Partial<Workflow>): Observable<Workflow> {
    const idx = this.mockWorkflows.findIndex(w => w.id === id);
    if (idx < 0) throw new Error('Workflow not found');
    this.mockWorkflows[idx] = { ...this.mockWorkflows[idx], ...updates, updatedAt: new Date().toISOString() };
    return of(this.mockWorkflows[idx]).pipe(delay(500));
  }

  deleteWorkflow(id: string): Observable<void> {
    this.mockWorkflows = this.mockWorkflows.filter(w => w.id !== id);
    return of(void 0).pipe(delay(300));
  }

  validateWorkflow(id: string): Observable<WorkflowValidationResult> {
    return of({ valid: true, errors: [] }).pipe(delay(300));
  }

  // Approvals
  getApprovals(caseId?: string): Observable<ApprovalChain[]> {
    let approvals = [...this.mockApprovals];
    if (caseId) approvals = approvals.filter(a => a.caseId === caseId);
    return of(approvals).pipe(delay(300));
  }

  getApprovalById(id: string): Observable<ApprovalChain> {
    const a = this.mockApprovals.find(a => a.id === id);
    if (!a) throw new Error('Approval not found');
    return of({ ...a }).pipe(delay(200));
  }

  createApproval(approval: Partial<ApprovalChain>): Observable<ApprovalChain> {
    const newA: ApprovalChain = {
      id: `approval-${Date.now()}`,
      caseId: approval.caseId || '',
      mode: approval.mode || 'sequential',
      approvers: approval.approvers || [],
      status: 'pending',
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
    };
    this.mockApprovals.push(newA);
    return of(newA).pipe(delay(500));
  }

  approveChain(id: string, decision: ApprovalDecision): Observable<ApprovalChain> {
    const idx = this.mockApprovals.findIndex(a => a.id === id);
    if (idx < 0) throw new Error('Approval not found');
    const chain = { ...this.mockApprovals[idx], approvers: [...this.mockApprovals[idx].approvers] };
    const pending = chain.approvers.findIndex(a => a.status === 'pending');
    if (pending >= 0) {
      chain.approvers[pending] = { ...chain.approvers[pending], status: 'approved', decidedAt: new Date().toISOString(), comment: decision.comment || 'Approved' };
    }
    const allApproved = chain.approvers.every(a => a.status === 'approved');
    chain.status = allApproved ? 'approved' : 'pending';
    this.mockApprovals[idx] = chain;
    return of(chain).pipe(delay(500));
  }

  rejectChain(id: string, decision: ApprovalDecision): Observable<ApprovalChain> {
    const idx = this.mockApprovals.findIndex(a => a.id === id);
    if (idx < 0) throw new Error('Approval not found');
    this.mockApprovals[idx] = { ...this.mockApprovals[idx], status: 'rejected' };
    return of(this.mockApprovals[idx]).pipe(delay(500));
  }

  delegateApproval(id: string, delegation: ApprovalDelegation): Observable<ApprovalChain> {
    const idx = this.mockApprovals.findIndex(a => a.id === id);
    if (idx < 0) throw new Error('Approval not found');
    const chain = { ...this.mockApprovals[idx], approvers: [...this.mockApprovals[idx].approvers] };
    const pending = chain.approvers.findIndex(a => a.status === 'pending');
    if (pending >= 0) {
      chain.approvers[pending] = { ...chain.approvers[pending], status: 'delegated', delegatedTo: delegation.delegateTo, decidedAt: new Date().toISOString(), comment: delegation.comment || 'Delegated' };
    }
    this.mockApprovals[idx] = chain;
    return of(chain).pipe(delay(500));
  }

  // Documents
  getDocuments(caseId?: string): Observable<Document[]> {
    let docs = [...this.mockDocuments];
    if (caseId) docs = docs.filter(d => d.caseId === caseId);
    return of(docs).pipe(delay(300));
  }

  getDocumentById(id: string): Observable<Document> {
    const doc = this.mockDocuments.find(d => d.id === id);
    if (!doc) throw new Error('Document not found');
    return of({ ...doc }).pipe(delay(200));
  }

  uploadDocument(caseId: string, file: File, description?: string, tags?: string[]): Observable<Document> {
    const newDoc: Document = {
      id: `doc-${Date.now()}`,
      caseId,
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      version: 1,
      isCurrent: true,
      uploadedBy: 'user-1',
      uploadedAt: new Date().toISOString(),
      description,
      tags: tags || [],
    };
    this.mockDocuments.push(newDoc);
    return of(newDoc).pipe(delay(800));
  }

  deleteDocument(id: string): Observable<void> {
    this.mockDocuments = this.mockDocuments.filter(d => d.id !== id);
    return of(void 0).pipe(delay(300));
  }

  downloadDocument(id: string): Observable<Blob> {
    // Mock: return a dummy blob
    const blob = new Blob(['Mock document content'], { type: 'text/plain' });
    return of(blob).pipe(delay(300));
  }

  getDocumentVersions(id: string): Observable<DocumentVersion[]> {
    const doc = this.mockDocuments.find(d => d.id === id);
    if (!doc) return of([]);
    return of([{
      id: doc.id,
      filename: doc.filename,
      version: doc.version,
      isCurrent: doc.isCurrent,
      uploadedBy: doc.uploadedBy,
      uploadedAt: doc.uploadedAt,
    }]).pipe(delay(200));
  }

  // SLA
  getSLADashboard(): Observable<SLADashboard> {
    return of<SLADashboard>({
      summary: { total: 3, critical: 0, breached: 1, warning: 1, normal: 1 },
      cases: [
        { id: 'CASE-2026-00002', type: 'loan_origination', stage: 'underwriting', priority: 'critical', ownerId: 'user-2', slaTarget: '2026-03-19T00:00:00.000Z', percentageElapsed: 105, remainingHours: -12, risk: 'breached' as const, escalated: true, escalationLevel: 1 },
        { id: 'CASE-2026-00001', type: 'loan_origination', stage: 'intake', priority: 'high', ownerId: 'user-1', slaTarget: '2026-03-17T00:00:00.000Z', percentageElapsed: 78, remainingHours: 36, risk: 'warning' as const, escalated: false, escalationLevel: 0 },
        { id: 'CASE-2026-00003', type: 'loan_origination', stage: 'disbursement', priority: 'medium', ownerId: 'user-3', slaTarget: '2026-03-01T00:00:00.000Z', percentageElapsed: 45, remainingHours: 120, risk: 'normal' as const, escalated: false, escalationLevel: 0 },
      ],
    }).pipe(delay(300));
  }

  getSLADefinitions(caseTypeId?: string): Observable<SLADefinition[]> {
    return of([
      { id: 'sla-1', caseTypeId: 'case-type-1', stage: 'intake', hoursTarget: 48, escalationEnabled: true, escalateToRole: 'MANAGER', createdAt: '2025-01-01T00:00:00.000Z' },
      { id: 'sla-2', caseTypeId: 'case-type-1', stage: 'underwriting', hoursTarget: 120, escalationEnabled: true, escalateToRole: 'ADMIN', createdAt: '2025-01-01T00:00:00.000Z' },
    ]).pipe(delay(300));
  }

  acknowledgeSLA(caseId: string): Observable<any> {
    return of({ acknowledged: true, case_id: caseId }).pipe(delay(300));
  }

  // Forms
  getFormDefinitions(caseTypeId?: string, stage?: string): Observable<FormDefinition[]> {
    let forms = [...this.mockFormDefinitions];
    if (caseTypeId) forms = forms.filter(f => f.caseTypeId === caseTypeId);
    if (stage) forms = forms.filter(f => f.stage === stage);
    return of(forms).pipe(delay(300));
  }

  getFormDefinitionById(id: string): Observable<FormDefinition> {
    const form = this.mockFormDefinitions.find(f => f.id === id);
    if (!form) throw new Error('Form not found');
    return of({ ...form }).pipe(delay(200));
  }

  createFormDefinition(form: Partial<FormDefinition>): Observable<FormDefinition> {
    const newForm: FormDefinition = {
      id: `form-${Date.now()}`,
      name: form.name || 'New Form',
      caseTypeId: form.caseTypeId || '',
      sections: form.sections || [],
      fields: form.fields || [],
      description: form.description || '',
      version: 1,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    this.mockFormDefinitions.push(newForm);
    return of(newForm).pipe(delay(500));
  }

  updateFormDefinition(id: string, form: Partial<FormDefinition>): Observable<FormDefinition> {
    const idx = this.mockFormDefinitions.findIndex(f => f.id === id);
    if (idx < 0) throw new Error('Form not found');
    this.mockFormDefinitions[idx] = { ...this.mockFormDefinitions[idx], ...form, updatedAt: new Date().toISOString() };
    return of(this.mockFormDefinitions[idx]).pipe(delay(500));
  }

  deleteFormDefinition(id: string): Observable<void> {
    this.mockFormDefinitions = this.mockFormDefinitions.filter(f => f.id !== id);
    return of(void 0).pipe(delay(300));
  }

  submitForm(submission: Omit<FormSubmission, 'id' | 'submittedBy' | 'submittedAt'>): Observable<FormSubmission> {
    const newSub: FormSubmission = {
      ...submission,
      id: `sub-${Date.now()}`,
      submittedBy: 'user-1',
      submittedAt: new Date().toISOString(),
    };
    return of(newSub).pipe(delay(500));
  }

  getFormSubmissions(caseId?: string, formId?: string): Observable<FormSubmission[]> {
    return of([]).pipe(delay(200));
  }

  // ─── Pega-Lite Stubs (mock not yet implemented) ──
  getCaseTypeDefinitions(): Observable<CaseTypeDefinition[]> { return of([] as CaseTypeDefinition[]).pipe(delay(200)); }
  getCaseTypeDefinitionById(id: string): Observable<CaseTypeDefinition> { return of({} as CaseTypeDefinition).pipe(delay(200)); }
  getCaseInstances(filters?: Record<string, string>): Observable<CaseInstance[]> { return of([] as CaseInstance[]).pipe(delay(200)); }
  getCaseInstanceById(id: string): Observable<CaseInstance> { return of({} as CaseInstance).pipe(delay(200)); }
  createCaseInstance(req: CaseCreateRequest): Observable<CaseInstance> { return of({} as CaseInstance).pipe(delay(300)); }
  updateCaseInstance(id: string, req: CaseUpdateRequest): Observable<CaseInstance> { return of({} as CaseInstance).pipe(delay(300)); }
  completeStep(caseId: string, stepId: string, req: StepCompleteRequest): Observable<CaseInstance> { return of({} as CaseInstance).pipe(delay(300)); }
  advanceStage(caseId: string, req?: AdvanceStageRequest): Observable<CaseInstance> { return of({} as CaseInstance).pipe(delay(300)); }
  changeStage(caseId: string, req: ChangeStageRequest): Observable<CaseInstance> { return of({} as CaseInstance).pipe(delay(300)); }
  resolveCase(caseId: string): Observable<CaseInstance> { return of({} as CaseInstance).pipe(delay(300)); }
  withdrawCase(caseId: string): Observable<CaseInstance> { return of({} as CaseInstance).pipe(delay(300)); }
  getAssignments(filters?: Record<string, string>): Observable<Assignment[]> { return of([] as Assignment[]).pipe(delay(200)); }
  getMyAssignments(): Observable<Assignment[]> { return of([] as Assignment[]).pipe(delay(200)); }
  getAssignmentById(id: string): Observable<Assignment> { return of({} as Assignment).pipe(delay(200)); }
  completeAssignment(id: string, req: AssignmentCompleteRequest): Observable<Assignment> { return of({} as Assignment).pipe(delay(300)); }
  reassignAssignment(id: string, req: AssignmentReassignRequest): Observable<Assignment> { return of({} as Assignment).pipe(delay(300)); }
  holdAssignment(id: string): Observable<Assignment> { return of({} as Assignment).pipe(delay(300)); }
  resumeAssignment(id: string): Observable<Assignment> { return of({} as Assignment).pipe(delay(300)); }

  // Admin — Case Type Definitions CRUD
  createCaseTypeDefinition(req: CaseTypeCreateRequest): Observable<CaseTypeDefinition> { return of({} as CaseTypeDefinition).pipe(delay(300)); }
  updateCaseTypeDefinition(id: string, req: CaseTypeUpdateRequest): Observable<CaseTypeDefinition> { return of({} as CaseTypeDefinition).pipe(delay(300)); }
  deleteCaseTypeDefinition(id: string): Observable<void> { return of(void 0).pipe(delay(200)); }
  duplicateCaseTypeDefinition(id: string): Observable<CaseTypeDefinition> { return of({} as CaseTypeDefinition).pipe(delay(300)); }
  validateCaseTypeDefinition(id: string): Observable<{ valid: boolean; errors: string[] }> { return of({ valid: true, errors: [] }).pipe(delay(200)); }

  // Admin — Decision Tables CRUD
  getDecisionTables(): Observable<DecisionTable[]> { return of([] as DecisionTable[]).pipe(delay(200)); }
  getDecisionTableById(id: string): Observable<DecisionTable> { return of({} as DecisionTable).pipe(delay(200)); }
  createDecisionTable(req: DecisionTableCreateRequest): Observable<DecisionTable> { return of({} as DecisionTable).pipe(delay(300)); }
  updateDecisionTable(id: string, req: DecisionTableUpdateRequest): Observable<DecisionTable> { return of({} as DecisionTable).pipe(delay(300)); }
  deleteDecisionTable(id: string): Observable<void> { return of(void 0).pipe(delay(200)); }
  evaluateDecisionTable(id: string, req: DecisionTableEvaluateRequest): Observable<DecisionTableEvaluateResponse> { return of({ output: null } as DecisionTableEvaluateResponse).pipe(delay(200)); }

  // Admin — Rules
  evaluateRule(req: RuleEvaluateRequest): Observable<RuleEvaluateResponse> { return of({ result: false, matchedConditions: [], evaluationPath: [] }).pipe(delay(200)); }
}
