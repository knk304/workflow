// AI/GenAI models for recommendations and risk (P3-S4)

export interface Recommendation {
  action: string;
  label: string;
  description: string;
  confidence: number;
  reason?: string;
}

export interface RecommendationResponse {
  case_id: string;
  recommendations: Recommendation[];
}

export interface RiskFlag {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  source?: string;
}

export interface RiskResponse {
  case_id: string;
  risk_flags: RiskFlag[];
  overall_risk: 'low' | 'medium' | 'high' | 'critical';
}
