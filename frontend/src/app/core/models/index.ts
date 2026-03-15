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
