import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';
import {
  User,
  Case,
  Task,
  Comment,
  Notification,
  Team,
  AuditLog,
  CaseType,
  KanbanBoard,
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

  // Mock Case Types
  private mockCaseTypes: CaseType[] = [
    {
      id: 'case-type-1',
      name: 'loan_origination',
      description: 'Personal or business loan application',
      stages: ['intake', 'documents', 'underwriting', 'approval', 'disbursement'],
      fieldsSchema: {
        applicantName: {
          type: 'text',
          label: 'Applicant Name',
          required: true,
          placeholder: 'Full name',
        },
        loanAmount: {
          type: 'number',
          label: 'Loan Amount',
          required: true,
          placeholder: '50000',
        },
        loanType: {
          type: 'select',
          label: 'Loan Type',
          required: true,
          options: ['personal', 'business', 'mortgage', 'auto'],
        },
        applicationDate: {
          type: 'date',
          label: 'Application Date',
          required: true,
        },
        documentationComplete: {
          type: 'checkbox',
          label: 'Documentation Complete',
          required: false,
        },
      },
    },
    {
      id: 'case-type-2',
      name: 'support_ticket',
      description: 'Customer support request',
      stages: ['open', 'in_progress', 'waiting_info', 'resolved'],
      fieldsSchema: {
        issueTitle: {
          type: 'text',
          label: 'Issue Title',
          required: true,
        },
        issueDescription: {
          type: 'textarea',
          label: 'Description',
          required: true,
        },
        severity: {
          type: 'select',
          label: 'Severity',
          required: true,
          options: ['low', 'medium', 'high', 'critical'],
        },
      },
    },
  ];

  // Mock Cases
  private mockCases: Case[] = [
    {
      id: 'CASE-2026-00001',
      type: 'loan_origination',
      status: 'open',
      stage: 'intake',
      priority: 'high',
      ownerId: 'user-1',
      teamId: 'team-1',
      fields: {
        applicantName: 'Sarah Mitchell',
        loanAmount: 150000,
        loanType: 'mortgage',
        applicationDate: '2026-03-10T00:00:00.000Z',
        documentationComplete: false,
      },
      stages: [
        {
          name: 'intake',
          status: 'in_progress',
          enteredAt: '2026-03-10T00:00:00.000Z',
        },
      ],
      sla: {
        targetDate: '2026-03-17T00:00:00.000Z',
        escalated: false,
        escalationLevel: -1,
      },
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      createdBy: 'user-1',
    },
    {
      id: 'CASE-2026-00002',
      type: 'loan_origination',
      status: 'pending',
      stage: 'underwriting',
      priority: 'critical',
      ownerId: 'user-2',
      teamId: 'team-1',
      fields: {
        applicantName: 'John Rodriguez',
        loanAmount: 75000,
        loanType: 'personal',
        applicationDate: '2026-02-28T00:00:00.000Z',
        documentationComplete: true,
      },
      stages: [
        {
          name: 'intake',
          status: 'completed',
          enteredAt: '2026-02-28T00:00:00.000Z',
          completedAt: '2026-03-01T00:00:00.000Z',
          completedBy: 'user-2',
        },
        {
          name: 'documents',
          status: 'completed',
          enteredAt: '2026-03-01T00:00:00.000Z',
          completedAt: '2026-03-05T00:00:00.000Z',
          completedBy: 'user-3',
        },
        {
          name: 'underwriting',
          status: 'in_progress',
          enteredAt: '2026-03-05T00:00:00.000Z',
        },
      ],
      sla: {
        targetDate: '2026-03-19T00:00:00.000Z',
        escalated: true,
        escalationLevel: 0,
      },
      createdAt: '2026-02-28T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
      createdBy: 'user-1',
    },
    {
      id: 'CASE-2026-00003',
      type: 'loan_origination',
      status: 'resolved',
      stage: 'disbursement',
      priority: 'medium',
      ownerId: 'user-3',
      teamId: 'team-1',
      fields: {
        applicantName: 'Emma Thompson',
        loanAmount: 250000,
        loanType: 'business',
        applicationDate: '2026-02-01T00:00:00.000Z',
        documentationComplete: true,
      },
      stages: [
        {
          name: 'intake',
          status: 'completed',
          enteredAt: '2026-02-01T00:00:00.000Z',
          completedAt: '2026-02-03T00:00:00.000Z',
          completedBy: 'user-1',
        },
        {
          name: 'documents',
          status: 'completed',
          enteredAt: '2026-02-03T00:00:00.000Z',
          completedAt: '2026-02-08T00:00:00.000Z',
          completedBy: 'user-2',
        },
        {
          name: 'underwriting',
          status: 'completed',
          enteredAt: '2026-02-08T00:00:00.000Z',
          completedAt: '2026-02-15T00:00:00.000Z',
          completedBy: 'user-1',
        },
        {
          name: 'approval',
          status: 'completed',
          enteredAt: '2026-02-15T00:00:00.000Z',
          completedAt: '2026-02-20T00:00:00.000Z',
          completedBy: 'user-4',
        },
        {
          name: 'disbursement',
          status: 'completed',
          enteredAt: '2026-02-20T00:00:00.000Z',
          completedAt: '2026-03-01T00:00:00.000Z',
          completedBy: 'user-3',
        },
      ],
      sla: {
        targetDate: '2026-03-01T00:00:00.000Z',
        escalated: false,
        escalationLevel: -1,
      },
      createdAt: '2026-02-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      createdBy: 'user-1',
    },
  ];

  // Mock Tasks
  private mockTasks: Task[] = [
    {
      id: 'task-1',
      caseId: 'CASE-2026-00001',
      title: 'Review initial application',
      description: 'Verify all required fields are completed',
      assigneeId: 'user-1',
      teamId: 'team-1',
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-03-15T00:00:00.000Z',
      dependsOn: [],
      tags: ['intake', 'verification'],
      checklist: [
        { id: 'check-1', item: 'Verify identity documents', checked: true, completedAt: '2026-03-11T00:00:00.000Z' },
        { id: 'check-2', item: 'Confirm contact information', checked: true, completedAt: '2026-03-11T00:00:00.000Z' },
        { id: 'check-3', item: 'Check income documentation', checked: false },
      ],
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
    },
    {
      id: 'task-2',
      caseId: 'CASE-2026-00001',
      title: 'Request missing documents',
      description: 'Request applicant to provide proof of income',
      assigneeId: 'user-2',
      teamId: 'team-1',
      status: 'pending',
      priority: 'high',
      dueDate: '2026-03-13T00:00:00.000Z',
      dependsOn: ['task-1'],
      tags: ['documents', 'follow-up'],
      checklist: [],
      createdAt: '2026-03-10T00:00:00.000Z',
      updatedAt: '2026-03-10T00:00:00.000Z',
    },
    {
      id: 'task-3',
      caseId: 'CASE-2026-00002',
      title: 'Underwriting review',
      description: 'Perform detailed credit and risk assessment',
      assigneeId: 'user-1',
      teamId: 'team-1',
      status: 'in_progress',
      priority: 'critical',
      dueDate: '2026-03-16T00:00:00.000Z',
      dependsOn: [],
      tags: ['underwriting', 'risk'],
      checklist: [
        { id: 'check-4', item: 'Credit check completed', checked: true, completedAt: '2026-03-10T00:00:00.000Z' },
        { id: 'check-5', item: 'Debt-to-income ratio acceptable', checked: true, completedAt: '2026-03-10T00:00:00.000Z' },
        { id: 'check-6', item: 'Collateral assessment', checked: false },
      ],
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
    },
    {
      id: 'task-4',
      caseId: 'CASE-2026-00002',
      title: 'Obtain manager approval',
      description: 'Get final approval before proceeding',
      assigneeId: undefined,
      teamId: 'team-1',
      status: 'pending',
      priority: 'critical',
      dueDate: '2026-03-18T00:00:00.000Z',
      dependsOn: ['task-3'],
      tags: ['approval'],
      checklist: [],
      createdAt: '2026-03-05T00:00:00.000Z',
      updatedAt: '2026-03-05T00:00:00.000Z',
    },
    {
      id: 'task-5',
      caseId: 'CASE-2026-00003',
      title: 'Fund transfer setup',
      description: 'Configure automated payout',
      assigneeId: 'user-3',
      teamId: 'team-1',
      status: 'completed',
      priority: 'medium',
      dueDate: '2026-02-28T00:00:00.000Z',
      dependsOn: [],
      tags: ['disbursement', 'ops'],
      checklist: [
        {
          id: 'check-7',
          item: 'Bank account verified',
          checked: true,
          completedAt: '2026-02-25T00:00:00.000Z',
        },
        {
          id: 'check-8',
          item: 'Transfer limit confirmed',
          checked: true,
          completedAt: '2026-02-26T00:00:00.000Z',
        },
      ],
      createdAt: '2026-02-20T00:00:00.000Z',
      updatedAt: '2026-02-28T00:00:00.000Z',
      completedAt: '2026-02-28T00:00:00.000Z',
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

  getCaseTypes(): Observable<CaseType[]> {
    return of([...this.mockCaseTypes]).pipe(delay(300));
  }

  getCases(filters?: any): Observable<Case[]> {
    let cases = [...this.mockCases];
    if (filters?.status) {
      cases = cases.filter((c) => c.status === filters.status);
    }
    if (filters?.stage) {
      cases = cases.filter((c) => c.stage === filters.stage);
    }
    if (filters?.ownerId) {
      cases = cases.filter((c) => c.ownerId === filters.ownerId);
    }
    return of(cases).pipe(delay(300));
  }

  getCaseById(id: string): Observable<Case | undefined> {
    return of(this.mockCases.find((c) => c.id === id)).pipe(delay(200));
  }

  createCase(caseData: Partial<Case>): Observable<Case> {
    const now = new Date().toISOString();
    const caseNumber = String(this.mockCases.length + 1).padStart(5, '0');
    const newCase: Case = {
      id: `CASE-2026-${caseNumber}`,
      type: caseData.type || 'loan_origination',
      status: 'open',
      stage: 'intake',
      priority: caseData.priority || 'medium',
      ownerId: caseData.ownerId || 'user-1',
      teamId: caseData.teamId || 'team-1',
      fields: caseData.fields || {},
      stages: [{ name: 'intake', status: 'in_progress', enteredAt: now }],
      sla: {
        targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        escalated: false,
        escalationLevel: 0,
      },
      createdAt: now,
      updatedAt: now,
      createdBy: caseData.createdBy || 'user-1',
    };
    this.mockCases.push(newCase);
    return of(newCase).pipe(delay(500));
  }

  getTasks(filters?: any): Observable<Task[]> {
    let tasks = [...this.mockTasks];
    if (filters?.caseId) {
      tasks = tasks.filter((t) => t.caseId === filters.caseId);
    }
    if (filters?.assigneeId) {
      tasks = tasks.filter((t) => t.assigneeId === filters.assigneeId);
    }
    if (filters?.status) {
      tasks = tasks.filter((t) => t.status === filters.status);
    }
    return of(tasks).pipe(delay(300));
  }

  getTaskById(id: string): Observable<Task | undefined> {
    return of(this.mockTasks.find((t) => t.id === id)).pipe(delay(200));
  }

  getTasksByStatus(status: string): Observable<Task[]> {
    return of(this.mockTasks.filter((t) => t.status === status)).pipe(delay(300));
  }

  getKanbanBoard(caseId?: string): Observable<KanbanBoard> {
    let tasks = [...this.mockTasks];
    if (caseId) {
      tasks = tasks.filter((t) => t.caseId === caseId);
    }

    const board: KanbanBoard = {
      pending: tasks.filter((t) => t.status === 'pending'),
      inProgress: tasks.filter((t) => t.status === 'in_progress'),
      review: tasks.filter((t) => t.status === 'blocked'), // Blocked tasks shown in review column
      done: tasks.filter((t) => t.status === 'completed'),
      blocked: tasks.filter((t) => t.status === 'cancelled'),
    };
    return of(board).pipe(delay(300));
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

  // Mock mutations (update operations)
  updateCase(caseId: string, updates: Partial<Case>): Observable<Case> {
    const caseIdx = this.mockCases.findIndex((c) => c.id === caseId);
    if (caseIdx >= 0) {
      this.mockCases[caseIdx] = { ...this.mockCases[caseIdx], ...updates };
      return of(this.mockCases[caseIdx]).pipe(delay(500));
    }
    throw new Error('Case not found');
  }

  transitionCase(caseId: string, action: string, notes?: string): Observable<Case> {
    const caseIdx = this.mockCases.findIndex((c) => c.id === caseId);
    if (caseIdx >= 0) {
      const caseData = { ...this.mockCases[caseIdx] };
      const stages = ['intake', 'documents', 'underwriting', 'approval', 'disbursement'];
      const currentIndex = stages.indexOf(caseData.stage);
      if (currentIndex >= 0 && currentIndex < stages.length - 1) {
        const currentStageIndex = caseData.stages.length - 1;
        if (currentStageIndex >= 0) {
          caseData.stages = [...caseData.stages];
          caseData.stages[currentStageIndex] = {
            ...caseData.stages[currentStageIndex],
            status: 'completed',
            completedAt: new Date().toISOString(),
          };
        }
        caseData.stage = stages[currentIndex + 1];
        caseData.stages = [
          ...caseData.stages,
          { name: caseData.stage, status: 'in_progress', enteredAt: new Date().toISOString() },
        ];
      }
      caseData.updatedAt = new Date().toISOString();
      this.mockCases[caseIdx] = caseData;
      return of(caseData).pipe(delay(500));
    }
    throw new Error('Case not found');
  }

  createTask(task: Partial<Task>): Observable<Task> {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      caseId: task.caseId || '',
      title: task.title || '',
      description: task.description || '',
      status: 'pending',
      priority: task.priority || 'medium',
      dueDate: task.dueDate,
      dependsOn: [],
      tags: [],
      checklist: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.mockTasks.push(newTask);
    return of(newTask).pipe(delay(500));
  }

  updateTask(taskId: string, updates: Partial<Task>): Observable<Task> {
    const taskIdx = this.mockTasks.findIndex((t) => t.id === taskId);
    if (taskIdx >= 0) {
      this.mockTasks[taskIdx] = { ...this.mockTasks[taskIdx], ...updates };
      return of(this.mockTasks[taskIdx]).pipe(delay(500));
    }
    throw new Error('Task not found');
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
    return of(this.mockApprovals[idx]).pipe(delay(500));
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
    return of(this.mockApprovals[idx]).pipe(delay(500));
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
  getFormDefinitions(caseTypeId?: string): Observable<FormDefinition[]> {
    let forms = [...this.mockFormDefinitions];
    if (caseTypeId) forms = forms.filter(f => f.caseTypeId === caseTypeId);
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
}
