import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CaseSummary {
  case_id: string;
  summary: string;
  key_decisions: string[];
  pending_actions: string[];
  risk_flags: string[];
  generated_by: string;
  cached: boolean;
}

export interface FormFieldConfig {
  type: string;
  label: string;
  icon: string;
  category: string;
  description: string;
  defaultProps: Record<string, any>;
}

export interface FormFieldPalette {
  fields: FormFieldConfig[];
  categories: { id: string; label: string; icon: string; order: number }[];
}

export interface WorkflowNodeConfig {
  type: string;
  label: string;
  icon: string;
  emoji: string;
  category: string;
  description: string;
  singleton: boolean;
  allowedNext: string[];
  properties: Record<string, any>;
}

export interface WorkflowNodePalette {
  nodes: WorkflowNodeConfig[];
  categories: { id: string; label: string; icon: string; order: number }[];
}

export interface LLMProviderInfo {
  active_provider: string;
  label: string;
  type: string;
  model: string | null;
  streaming: boolean;
}

// ── P3-S2: Document Extraction ──────────────────────────

export interface ExtractionField {
  field_name: string;
  value: string;
  confidence: number;
  source_page: number | null;
}

export interface ExtractionResponse {
  document_id: string;
  fields: ExtractionField[];
  raw_text_preview: string;
  generated_by: string;
}

// ── P3-S2: Semantic Search ──────────────────────────────

export interface SearchResult {
  entity_type: string;
  entity_id: string;
  title: string;
  snippet: string;
  score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Case Summarization ─────────────────────────────────
  summarizeCase(caseId: string, options?: {
    include_audit?: boolean;
    include_comments?: boolean;
    include_tasks?: boolean;
    max_length?: number;
  }): Observable<CaseSummary> {
    return this.http.post<CaseSummary>(
      `${this.apiUrl}/ai/summarize/${caseId}`,
      options || {},
    );
  }

  // ── Config Palettes ────────────────────────────────────
  getFormFieldPalette(): Observable<FormFieldPalette> {
    return this.http.get<FormFieldPalette>(`${this.apiUrl}/config/form-fields`);
  }

  getWorkflowNodePalette(): Observable<WorkflowNodePalette> {
    return this.http.get<WorkflowNodePalette>(`${this.apiUrl}/config/workflow-nodes`);
  }

  // ── LLM Provider ──────────────────────────────────────
  getActiveProvider(): Observable<LLMProviderInfo> {
    return this.http.get<LLMProviderInfo>(`${this.apiUrl}/config/llm/active`);
  }

  getLLMConfig(): Observable<any> {
    return this.http.get(`${this.apiUrl}/config/llm`);
  }

  setActiveProvider(provider: string): Observable<any> {
    return this.http.patch(`${this.apiUrl}/config/llm/active`, { provider });
  }

  // ── AI Health ─────────────────────────────────────────
  checkHealth(): Observable<{ status: string; provider: string; healthy: boolean }> {
    return this.http.get<any>(`${this.apiUrl}/ai/health`);
  }

  // ── Document Extraction (P3-S2) ───────────────────────
  extractDocument(documentId: string): Observable<ExtractionResponse> {
    return this.http.post<ExtractionResponse>(
      `${this.apiUrl}/ai/extract/${documentId}`,
      {},
    );
  }

  // ── Semantic Search (P3-S2) ───────────────────────────
  search(query: string, options?: {
    limit?: number;
    entity_types?: string[];
  }): Observable<SearchResponse> {
    return this.http.post<SearchResponse>(
      `${this.apiUrl}/ai/search`,
      { query, ...options },
    );
  }

  // ── Index Management (P3-S2) ──────────────────────────
  rebuildIndex(): Observable<{ status: string; indexed: Record<string, number> }> {
    return this.http.post<any>(`${this.apiUrl}/ai/index/rebuild`, {});
  }

  indexEntity(entityType: string, entityId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/ai/index/${entityType}/${entityId}`, {});
  }
}
