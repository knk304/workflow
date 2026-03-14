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
  status: 'open' | 'pending' | 'resolved' | 'withdrawn';
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

export interface CaseType {
  id: string;
  name: string;
  description: string;
  stages: string[];
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
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
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
