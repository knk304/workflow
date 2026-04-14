import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

// ── Models ─────────────────────────────────────────────────

export type MailEvent =
  | 'case_created'
  | 'case_status_changed'
  | 'step_assigned'
  | 'step_completed'
  | 'case_resolved';

export type RecipientType = 'owner' | 'assignee' | 'team_dl' | 'custom';
export type MailLogStatus = 'sent' | 'failed' | 'skipped';

export interface MailConfig {
  id: string;
  case_type_id: string;
  case_type_name?: string;
  event: MailEvent;
  enabled: boolean;
  recipient_type: RecipientType;
  custom_emails: string[];
  subject_template: string;
  template_override?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MailConfigCreate {
  case_type_id: string;
  event: MailEvent;
  enabled?: boolean;
  recipient_type: RecipientType;
  custom_emails?: string[];
  subject_template?: string;
  template_override?: string | null;
}

export interface MailConfigUpdate {
  enabled?: boolean;
  recipient_type?: RecipientType;
  custom_emails?: string[];
  subject_template?: string;
  template_override?: string | null;
}

export interface MailLog {
  id: string;
  case_id: string;
  case_type_id: string;
  event: MailEvent;
  recipients: string[];
  subject: string;
  status: MailLogStatus;
  error?: string | null;
  sent_at: string;
}

export interface MailSettings {
  mail_enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  from_address: string;
  from_name: string;
  log_enabled: boolean;
  configured: boolean;
}

export interface MailTestRequest {
  to_email: string;
  subject?: string;
  body?: string;
}

export const MAIL_EVENT_LABELS: Record<MailEvent, string> = {
  case_created: 'Case Created',
  case_status_changed: 'Case Status Changed',
  step_assigned: 'Step Assigned',
  step_completed: 'Step Completed',
  case_resolved: 'Case Resolved',
};

export const RECIPIENT_TYPE_LABELS: Record<RecipientType, string> = {
  owner: 'Case Owner',
  assignee: 'Step Assignee',
  team_dl: 'Team Distribution List',
  custom: 'Custom Emails',
};

// ── Service ────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class MailService {
  private readonly baseUrl = `${environment.caseApiUrl}/mail`;

  constructor(private http: HttpClient) {}

  // ── Configs ────────────────────────

  getConfigs(caseTypeId?: string): Observable<MailConfig[]> {
    let params = new HttpParams();
    if (caseTypeId) {
      params = params.set('case_type_id', caseTypeId);
    }
    return this.http.get<MailConfig[]>(`${this.baseUrl}/configs`, { params });
  }

  getConfigsByCaseType(caseTypeId: string): Observable<MailConfig[]> {
    return this.http.get<MailConfig[]>(
      `${this.baseUrl}/configs/by-case-type/${caseTypeId}`
    );
  }

  createConfig(config: MailConfigCreate): Observable<MailConfig> {
    return this.http.post<MailConfig>(`${this.baseUrl}/configs`, config);
  }

  updateConfig(id: string, updates: MailConfigUpdate): Observable<MailConfig> {
    return this.http.patch<MailConfig>(`${this.baseUrl}/configs/${id}`, updates);
  }

  deleteConfig(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/configs/${id}`);
  }

  // ── Logs ───────────────────────────

  getLogs(filters?: {
    case_type_id?: string;
    case_id?: string;
    event?: string;
    status?: string;
    limit?: number;
  }): Observable<MailLog[]> {
    let params = new HttpParams();
    if (filters?.case_type_id) params = params.set('case_type_id', filters.case_type_id);
    if (filters?.case_id) params = params.set('case_id', filters.case_id);
    if (filters?.event) params = params.set('event', filters.event);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.limit) params = params.set('limit', filters.limit.toString());
    return this.http.get<MailLog[]>(`${this.baseUrl}/logs`, { params });
  }

  // ── Test & Settings ────────────────

  sendTestEmail(payload: MailTestRequest): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/test`,
      payload
    );
  }

  getTemplates(): Observable<{ templates: string[] }> {
    return this.http.get<{ templates: string[] }>(`${this.baseUrl}/templates`);
  }

  getSettings(): Observable<MailSettings> {
    return this.http.get<MailSettings>(`${this.baseUrl}/settings`);
  }
}
