import { Observable } from 'rxjs';
import {
  User, Team, CaseType, Case, Task, KanbanBoard,
  Comment, Notification, AuditLog,
  Workflow, WorkflowValidationResult,
  ApprovalChain, ApprovalDecision, ApprovalDelegation,
  Document, DocumentVersion,
  SLADashboard, SLADefinition,
  FormDefinition, FormSubmission,
  TransitionOption,
  CaseTypeDefinition,
  CaseInstance, CaseCreateRequest, CaseUpdateRequest,
  StepCompleteRequest, AdvanceStageRequest, ChangeStageRequest,
  Assignment, AssignmentCompleteRequest, AssignmentReassignRequest,
} from '../models';

export abstract class DataService {
  // Users
  abstract getUsers(): Observable<User[]>;
  abstract getUserById(id: string): Observable<User | undefined>;
  abstract getCurrentUser(): Observable<User>;
  abstract createUser(user: { email: string; password: string; name: string; role: string; teamIds: string[] }): Observable<User>;
  abstract updateUser(id: string, updates: { name?: string; role?: string; teamIds?: string[] }): Observable<User>;
  abstract deleteUser(id: string): Observable<void>;

  // Teams
  abstract getTeams(): Observable<Team[]>;
  abstract createTeam(team: { name: string; description?: string; memberIds: string[] }): Observable<Team>;
  abstract updateTeam(id: string, updates: { name?: string; description?: string; memberIds?: string[] }): Observable<Team>;
  abstract deleteTeam(id: string): Observable<void>;

  // Case Types
  abstract getCaseTypes(): Observable<CaseType[]>;
  abstract createCaseType(ct: { name: string; slug: string; description?: string; workflowId?: string; fieldsSchema?: Record<string, any> }): Observable<CaseType>;
  abstract updateCaseType(id: string, updates: { name?: string; slug?: string; description?: string; workflowId?: string; fieldsSchema?: Record<string, any> }): Observable<CaseType>;
  abstract deleteCaseType(id: string): Observable<void>;

  // Cases
  abstract getCases(filters?: Record<string, string>): Observable<Case[]>;
  abstract getCaseById(id: string): Observable<Case | undefined>;
  abstract createCase(caseData: Partial<Case>): Observable<Case>;
  abstract updateCase(caseId: string, updates: Partial<Case>): Observable<Case>;
  abstract transitionCase(caseId: string, action: string, notes?: string): Observable<Case>;
  abstract getAvailableTransitions(caseId: string): Observable<TransitionOption[]>;

  // Tasks
  abstract getTasks(filters?: Record<string, string>): Observable<Task[]>;
  abstract getTaskById(id: string): Observable<Task | undefined>;
  abstract getTasksByStatus(status: string): Observable<Task[]>;
  abstract getKanbanBoard(caseId?: string): Observable<KanbanBoard>;
  abstract createTask(task: Partial<Task>): Observable<Task>;
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

  // ===== Phase 2 =====

  // Workflows
  abstract getWorkflows(): Observable<Workflow[]>;
  abstract getWorkflowById(id: string): Observable<Workflow>;
  abstract createWorkflow(workflow: Partial<Workflow>): Observable<Workflow>;
  abstract updateWorkflow(id: string, updates: Partial<Workflow>): Observable<Workflow>;
  abstract deleteWorkflow(id: string): Observable<void>;
  abstract validateWorkflow(id: string): Observable<WorkflowValidationResult>;

  // Approvals
  abstract getApprovals(caseId?: string): Observable<ApprovalChain[]>;
  abstract getApprovalById(id: string): Observable<ApprovalChain>;
  abstract createApproval(approval: Partial<ApprovalChain>): Observable<ApprovalChain>;
  abstract approveChain(id: string, decision: ApprovalDecision): Observable<ApprovalChain>;
  abstract rejectChain(id: string, decision: ApprovalDecision): Observable<ApprovalChain>;
  abstract delegateApproval(id: string, delegation: ApprovalDelegation): Observable<ApprovalChain>;

  // Documents
  abstract getDocuments(caseId?: string): Observable<Document[]>;
  abstract getDocumentById(id: string): Observable<Document>;
  abstract uploadDocument(caseId: string, file: File, description?: string, tags?: string[]): Observable<Document>;
  abstract deleteDocument(id: string): Observable<void>;
  abstract downloadDocument(id: string): Observable<Blob>;
  abstract getDocumentVersions(id: string): Observable<DocumentVersion[]>;

  // SLA
  abstract getSLADashboard(): Observable<SLADashboard>;
  abstract getSLADefinitions(caseTypeId?: string): Observable<SLADefinition[]>;
  abstract acknowledgeSLA(caseId: string): Observable<any>;

  // Forms
  abstract getFormDefinitions(caseTypeId?: string, stage?: string): Observable<FormDefinition[]>;
  abstract getFormDefinitionById(id: string): Observable<FormDefinition>;
  abstract createFormDefinition(form: Partial<FormDefinition>): Observable<FormDefinition>;
  abstract updateFormDefinition(id: string, form: Partial<FormDefinition>): Observable<FormDefinition>;
  abstract deleteFormDefinition(id: string): Observable<void>;
  abstract submitForm(submission: Omit<FormSubmission, 'id' | 'submittedBy' | 'submittedAt'>): Observable<FormSubmission>;
  abstract getFormSubmissions(caseId?: string, formId?: string): Observable<FormSubmission[]>;

  // ===== Pega-Lite Hierarchical Engine =====

  // Case Type Definitions (blueprints)
  abstract getCaseTypeDefinitions(): Observable<CaseTypeDefinition[]>;
  abstract getCaseTypeDefinitionById(id: string): Observable<CaseTypeDefinition>;

  // Cases (hierarchical runtime)
  abstract getCaseInstances(filters?: Record<string, string>): Observable<CaseInstance[]>;
  abstract getCaseInstanceById(id: string): Observable<CaseInstance>;
  abstract createCaseInstance(req: CaseCreateRequest): Observable<CaseInstance>;
  abstract updateCaseInstance(id: string, req: CaseUpdateRequest): Observable<CaseInstance>;
  abstract completeStep(caseId: string, stepId: string, req: StepCompleteRequest): Observable<CaseInstance>;
  abstract advanceStage(caseId: string, req?: AdvanceStageRequest): Observable<CaseInstance>;
  abstract changeStage(caseId: string, req: ChangeStageRequest): Observable<CaseInstance>;
  abstract resolveCase(caseId: string): Observable<CaseInstance>;
  abstract withdrawCase(caseId: string): Observable<CaseInstance>;

  // Assignments (worklist)
  abstract getAssignments(filters?: Record<string, string>): Observable<Assignment[]>;
  abstract getMyAssignments(): Observable<Assignment[]>;
  abstract getAssignmentById(id: string): Observable<Assignment>;
  abstract completeAssignment(id: string, req: AssignmentCompleteRequest): Observable<Assignment>;
  abstract reassignAssignment(id: string, req: AssignmentReassignRequest): Observable<Assignment>;
  abstract holdAssignment(id: string): Observable<Assignment>;
  abstract resumeAssignment(id: string): Observable<Assignment>;
}
