// User & Auth Models
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'WORKER' | 'VIEWER';
  teamIds: string[];
  avatar?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// Case Models
export interface Case {
  id: string;
  type: string;
  caseType?: string; // Alias for type for compatibility
  status: 'open' | 'in_progress' | 'pending' | 'resolved' | 'withdrawn';
  stage: string;
  stageHistory?: StageHistory[]; // Alias for stages for compatibility
  priority: 'low' | 'medium' | 'high' | 'critical';
  ownerId: string;
  teamId: string;
  assignedTo?: User; // Person assigned to this case
  fields: Record<string, any>;
  stages: StageHistory[];
  tasks?: Task[]; // Tasks related to this case
  notes?: string; // Case notes
  sla: SLAInfo;
  auditLog?: AuditLog[]; // Audit trail
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface StageHistory {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completedAt?: string;
  enteredAt: string;
  completedBy?: string;
}

export interface SLAInfo {
  targetDate: string;
  targetResolutionDate?: string; // Alias for targetDate
  daysRemaining?: number; // Days until target resolution
  escalated: boolean;
  escalationLevel: number;
}

export interface TransitionOption {
  action: string;
  from: string;
  to: string;
}

export interface CaseType {
  id: string;
  name: string;
  slug: string;
  description: string;
  workflowId?: string;
  stages: string[];
  transitions: TransitionOption[];
  fieldsSchema: Record<string, FieldDefinition>;
  stageFormMap?: Record<string, string>;
}

export interface FieldDefinition {
  type: 'text' | 'select' | 'date' | 'checkbox' | 'textarea' | 'number';
  label: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

// Task Models
export interface Task {
  id: string;
  caseId: string;
  title: string;
  description: string;
  assigneeId?: string;
  teamId?: string;
  status: 'pending' | 'in_progress' | 'review' | 'completed' | 'blocked' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  dependsOn: string[];
  tags: string[];
  checklist: ChecklistItem[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ChecklistItem {
  id: string;
  item: string;
  checked?: boolean; // checkbox status for template compatibility
  completedAt?: string; // When the item was marked complete
}

export interface KanbanBoard {
  pending: Task[];
  inProgress: Task[];
  review: Task[];
  done: Task[];
  blocked: Task[];
}

// Comment Models
export interface Comment {
  id: string;
  caseId?: string;
  taskId?: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  mentions: Mention[];
  parentId?: string;
  replies?: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface Mention {
  userId: string;
  userName: string;
}

// Notification Models
export interface Notification {
  id: string;
  userId: string;
  type: 'assignment' | 'mention' | 'status_change' | 'sla_warning' | 'comment';
  title: string;
  message: string;
  entityType: 'case' | 'task';
  entityId: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// Team Models
export interface Team {
  id: string;
  name: string;
  description?: string;
  memberIds: string[];
  createdAt: string;
}

// Audit Log
export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actorName: string;
  changes: {
    before: Record<string, any>;
    after: Record<string, any>;
  };
  timestamp: string;
}

// ===== Phase 2 Models =====

// Workflow Designer
export type NodeType = 'start' | 'end' | 'task' | 'decision' | 'parallel' | 'subprocess';

export interface NodePosition {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  position: NodePosition;
  assigneeRole?: string;
  formId?: string;
  config?: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

export interface WorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  caseTypeId: string;
  definition: WorkflowDefinition;
  version: number;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface WorkflowValidationError {
  field: string;
  message: string;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: WorkflowValidationError[];
}

// Approval Engine
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'delegated';
export type ApprovalMode = 'sequential' | 'parallel';

export interface Approver {
  userId: string;
  userName?: string;
  status: ApprovalStatus;
  decidedAt?: string;
  comment?: string;
  delegatedTo?: string;
}

export interface ApprovalChain {
  id: string;
  caseId: string;
  taskId?: string;
  mode: ApprovalMode;
  approvers: Approver[];
  status: ApprovalStatus;
  createdBy: string;
  createdAt: string;
}

export interface ApprovalDecision {
  comment: string;
}

export interface ApprovalDelegation {
  delegateTo: string;
  comment: string;
}

// Document Management
export interface Document {
  id: string;
  caseId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  version: number;
  isCurrent: boolean;
  uploadedBy: string;
  uploadedAt: string;
  description?: string;
  tags: string[];
}

export interface DocumentVersion {
  id: string;
  filename: string;
  version: number;
  isCurrent: boolean;
  uploadedBy: string;
  uploadedAt: string;
}

// SLA Dashboard
export type SLARisk = 'normal' | 'warning' | 'breached' | 'critical';

export interface SLACaseInfo {
  id: string;
  type: string;
  stage: string;
  priority: string;
  ownerId: string;
  slaTarget: string;
  percentageElapsed: number;
  remainingHours: number;
  risk: SLARisk;
  escalated: boolean;
  escalationLevel: number;
}

export interface SLADashboard {
  summary: {
    total: number;
    critical: number;
    breached: number;
    warning: number;
    normal: number;
  };
  cases: SLACaseInfo[];
}

export interface SLADefinition {
  id: string;
  caseTypeId: string;
  stage: string;
  hoursTarget: number;
  escalationEnabled: boolean;
  escalateToRole: string;
  createdAt: string;
}

// Form Builder
export interface FormFieldValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minValue?: number;
  maxValue?: number;
  options?: string[];
}

export interface FormField {
  id: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox' | 'radio' | 'file';
  label: string;
  placeholder?: string;
  defaultValue?: string;
  validation: FormFieldValidation;
  order: number;
  section: string;
  visibleWhen?: Record<string, any>;
  editableRoles?: string[];
}

export interface FormSection {
  id: string;
  title: string;
  order: number;
}

export interface FormDefinition {
  id: string;
  name: string;
  caseTypeId: string;
  stage?: string;
  sections: FormSection[];
  fields: FormField[];
  description: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface FormSubmission {
  id: string;
  formId: string;
  caseId: string;
  data: Record<string, any>;
  submittedBy: string;
  submittedAt: string;
}

// WebSocket messages
export type WSMessageType = 'task_updated' | 'comment_added' | 'case_updated' | 'user_joined' | 'user_left' | 'presence' | 'heartbeat';

export interface WSMessage {
  type: WSMessageType;
  data: any;
  userId?: string;
  timestamp?: string;
}


// ===== Pega-Lite Hierarchical Engine Models =====

// ── Enums ──────────────────────────────────────────────────

export type StepType = 'assignment' | 'approval' | 'attachment' | 'decision' | 'automation' | 'subprocess';
export type StageType = 'primary' | 'alternate';
export type ProcessType = 'sequential' | 'parallel';
export type ItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'cancelled' | 'waiting';
export type CaseStatus = 'open' | 'in_progress' | 'pending' | 'resolved_completed' | 'resolved_cancelled' | 'resolved_rejected' | 'withdrawn';
export type AssignmentType = 'form' | 'approval' | 'attachment' | 'action';
export type AssignmentStatus = 'open' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';

// ── Blueprint (Case Type Definition) ──────────────────────

export interface StepConfig {
  assigneeRole?: string;
  assigneeUserId?: string;
  formId?: string;
  instructions?: string;
  setCaseStatus?: string;
  mode?: string;
  approverRoles?: string[];
  approverUserIds?: string[];
  allowDelegation?: boolean;
  rejectionStageId?: string;
  categories?: string[];
  minFiles?: number;
  allowedTypes?: string[];
  maxFileSizeMb?: number;
  branches?: DecisionBranch[];
  decisionTableId?: string;
  defaultStepId?: string;
  actions?: AutomationAction[];
  rules?: AutomationRule[];
  webhook?: WebhookConfig;
  childCaseTypeId?: string;
  fieldMapping?: Record<string, string>;
  waitForResolution?: boolean;
  propagateFields?: Record<string, string>;
}

export interface DecisionBranch {
  id: string;
  label: string;
  condition: Record<string, any>;
  nextStepId: string;
}

export interface AutomationAction {
  type: string;
  config: Record<string, any>;
}

export interface AutomationRule {
  condition: Record<string, any>;
  actions: AutomationAction[];
}

export interface WebhookConfig {
  url: string;
  method: string;
  headers: Record<string, string>;
  bodyTemplate: Record<string, any>;
  responseMap: Record<string, string>;
}

export interface StepDefinition {
  id: string;
  name: string;
  type: StepType;
  order: number;
  required: boolean;
  skipWhen?: Record<string, any> | null;
  visibleWhen?: Record<string, any> | null;
  slaHours?: number | null;
  config: StepConfig;
}

export interface ProcessDefinition {
  id: string;
  name: string;
  type: ProcessType;
  order: number;
  isParallel: boolean;
  startWhen?: Record<string, any> | null;
  slaHours?: number | null;
  steps: StepDefinition[];
}

export interface StageDefinition {
  id: string;
  name: string;
  stageType: StageType;
  order: number;
  onComplete: 'auto_advance' | 'wait_for_user' | 'resolve_case';
  resolutionStatus?: string | null;
  skipWhen?: Record<string, any> | null;
  entryCriteria?: Record<string, any> | null;
  slaHours?: number | null;
  processes: ProcessDefinition[];
}

export interface CaseTypeDefinition {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  prefix: string;
  fieldSchema: Record<string, any>;
  stages: StageDefinition[];
  attachmentCategories: AttachmentCategory[];
  caseWideActions: string[];
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  version: number;
  isActive: boolean;
}

export interface AttachmentCategory {
  id: string;
  name: string;
  requiredForResolution: boolean;
  allowedTypes: string[];
}

// ── Runtime Instances ─────────────────────────────────────

export interface StepInstance {
  stepDefinitionId: string;
  name: string;
  type: StepType;
  status: ItemStatus;
  order: number;
  description?: string;
  formFields?: any[];
  startedAt?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  assignedTo?: string | null;
  formSubmissionId?: string | null;
  approvalChainId?: string | null;
  childCaseId?: string | null;
  decisionBranchTaken?: string | null;
  skippedReason?: string | null;
  notes?: string | null;
  slaTarget?: string | null;
}

export interface ProcessInstance {
  processDefinitionId: string;
  name: string;
  type: ProcessType;
  status: ItemStatus;
  order: number;
  isParallel: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  steps: StepInstance[];
}

export interface StageInstance {
  stageDefinitionId: string;
  name: string;
  stageType: StageType;
  status: ItemStatus;
  order: number;
  onComplete: string;
  enteredAt?: string | null;
  completedAt?: string | null;
  completedBy?: string | null;
  processes: ProcessInstance[];
}

export interface CaseInstance {
  id: string;
  caseTypeId: string;
  caseTypeName: string;
  title: string;
  status: CaseStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  ownerId: string;
  teamId?: string;
  data: Record<string, any>;
  currentStageIndex: number;
  currentStageId?: string;
  currentProcessId?: string;
  currentStepId?: string;
  stages: StageInstance[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolutionStatus?: string;
  parentCaseId?: string;
  slaTargetDate?: string;
  slaDaysRemaining?: number;
  escalationLevel: number;
  description?: string;
}

// ── Case Create / Update DTOs ─────────────────────────────

export interface CaseCreateRequest {
  caseTypeId: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  ownerId?: string;
  teamId?: string;
  customFields?: Record<string, any>;
}

export interface CaseUpdateRequest {
  title?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  ownerId?: string;
  teamId?: string;
  customFields?: Record<string, any>;
}

export interface StepCompleteRequest {
  notes?: string;
  formData?: Record<string, any>;
  decision?: string;
  delegateTo?: string;
}

export interface AdvanceStageRequest {
  notes?: string;
}

export interface ChangeStageRequest {
  targetStageId: string;
  reason: string;
}

// ── Assignment (Worklist) ─────────────────────────────────

export interface Assignment {
  id: string;
  caseId: string;
  caseTitle: string;
  caseTypeId: string;
  stageName: string;
  processName: string;
  stepName: string;
  name: string;
  assignmentType: AssignmentType;
  status: AssignmentStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  assignedToName?: string;
  assignedRole?: string;
  formId?: string;
  instructions?: string;
  dueAt?: string;
  isOverdue: boolean;
  slaHours?: number;
  createdAt: string;
}

export interface AssignmentCompleteRequest {
  formData?: Record<string, any>;
  notes?: string;
  decision?: string;
  delegateTo?: string;
}

export interface AssignmentReassignRequest {
  assignedTo: string;
  reason?: string;
}

// ── Rule Engine / Conditions ──────────────────────────────

export interface SimpleCondition {
  field: string;
  operator: string;
  value?: any;
}

export interface CompoundCondition {
  all?: (SimpleCondition | CompoundCondition)[];
  any?: (SimpleCondition | CompoundCondition)[];
}

export type Condition = SimpleCondition | CompoundCondition;

export interface RuleAction {
  type: 'set_field' | 'send_notification' | 'change_stage' | 'create_assignment' | 'call_webhook';
  field?: string;
  value?: any;
  config: Record<string, any>;
}

export interface RuleEvaluateRequest {
  condition: Condition;
  data: Record<string, any>;
}

export interface RuleEvaluateResponse {
  result: boolean;
  matchedConditions: string[];
  evaluationPath: string[];
}

// ── Decision Tables ───────────────────────────────────────

export interface DecisionTableRow {
  conditions: Record<string, any>;
  output: any;
  priority: number;
}

export interface DecisionTable {
  id: string;
  name: string;
  description?: string;
  inputs: string[];
  outputField: string;
  rows: DecisionTableRow[];
  defaultOutput: any;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface DecisionTableCreateRequest {
  name: string;
  description?: string;
  inputs: string[];
  outputField: string;
  rows: DecisionTableRow[];
  defaultOutput?: any;
}

export interface DecisionTableUpdateRequest {
  name?: string;
  description?: string;
  inputs?: string[];
  outputField?: string;
  rows?: DecisionTableRow[];
  defaultOutput?: any;
}

export interface DecisionTableEvaluateRequest {
  data: Record<string, any>;
}

export interface DecisionTableEvaluateResponse {
  output: any;
  matchedRow?: number;
}

// ── Case Type Admin CRUD DTOs ─────────────────────────────

export interface CaseTypeCreateRequest {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  prefix: string;
  fieldSchema?: Record<string, any>;
  stages?: Partial<StageDefinition>[];
  attachmentCategories?: AttachmentCategory[];
}

export interface CaseTypeUpdateRequest {
  name?: string;
  slug?: string;
  description?: string;
  icon?: string;
  prefix?: string;
  fieldSchema?: Record<string, any>;
  stages?: StageDefinition[];
  attachmentCategories?: AttachmentCategory[];
  isActive?: boolean;
}
