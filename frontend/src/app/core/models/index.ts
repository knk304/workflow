// User & Auth Models
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'WORKER' | 'VIEWER';
  teamIds: string[];
  avatar?: string;
  createdAt: Date;
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
  status: 'open' | 'pending' | 'resolved' | 'withdrawn';
  stage: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  ownerId: string;
  teamId: string;
  fields: Record<string, any>;
  stages: StageHistory[];
  sla: SLAInfo;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface StageHistory {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completedAt?: Date;
  enteredAt: Date;
  completedBy?: string;
}

export interface SLAInfo {
  targetDate: Date;
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
  dueDate?: Date;
  dependsOn: string[];
  tags: string[];
  checklist: ChecklistItem[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface ChecklistItem {
  id: string;
  item: string;
  checked: boolean;
  completedAt?: Date;
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
  createdAt: Date;
  updatedAt: Date;
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
  readAt?: Date;
  createdAt: Date;
}

// Team Models
export interface Team {
  id: string;
  name: string;
  description?: string;
  memberIds: string[];
  createdAt: Date;
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
  timestamp: Date;
}
