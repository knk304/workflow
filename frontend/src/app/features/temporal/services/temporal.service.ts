import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface TemporalHealth {
  status: string;
  namespace?: string;
  state?: string;
  error?: string;
}

export interface WorkflowExecution {
  workflow_id: string;
  run_id: string;
  workflow_type: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out' | 'unknown';
  start_time: string | null;
  close_time: string | null;
  task_queue: string;
}

export interface WorkflowListResponse {
  workflows: WorkflowExecution[];
  count: number;
}

export interface HistoryEvent {
  event_id: number;
  event_type: string;
  event_time: string | null;
}

export interface WorkflowDetail extends WorkflowExecution {
  history_length: number;
  history_events: HistoryEvent[];
}

export interface WorkerInfo {
  task_queue: string;
  pollers: { identity: string; last_access_time: string | null }[];
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class TemporalService {
  private base = `${environment.apiUrl}/temporal`;

  constructor(private http: HttpClient) {}

  getHealth(): Observable<TemporalHealth> {
    return this.http.get<TemporalHealth>(`${this.base}/health`);
  }

  listWorkflows(status?: string, pageSize = 20): Observable<WorkflowListResponse> {
    let params = new HttpParams().set('page_size', pageSize);
    if (status) params = params.set('status', status);
    return this.http.get<WorkflowListResponse>(`${this.base}/workflows`, { params });
  }

  getWorkflow(workflowId: string, runId?: string): Observable<WorkflowDetail> {
    let params = new HttpParams();
    if (runId) params = params.set('run_id', runId);
    return this.http.get<WorkflowDetail>(`${this.base}/workflows/${encodeURIComponent(workflowId)}`, { params });
  }

  startCaseWorkflow(caseId: string): Observable<{ workflow_id: string; run_id?: string; already_running?: boolean }> {
    return this.http.post<any>(`${this.base}/cases/${caseId}/start`, {});
  }

  getWorkers(): Observable<WorkerInfo> {
    return this.http.get<WorkerInfo>(`${this.base}/workers`);
  }
}
