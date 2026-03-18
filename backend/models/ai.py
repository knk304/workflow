"""AI request/response models for Phase 3 endpoints."""

from pydantic import BaseModel, Field
from typing import Optional


# ── Summarization ─────────────────────────────────────────

class SummarizationRequest(BaseModel):
    include_audit: bool = True
    include_comments: bool = True
    include_tasks: bool = True
    max_length: Optional[int] = Field(None, description="Max summary length in words")


class SummarizationResponse(BaseModel):
    case_id: str
    summary: str
    key_decisions: list[str] = []
    pending_actions: list[str] = []
    risk_flags: list[str] = []
    generated_by: str = ""          # LLM provider used
    cached: bool = False


# ── Document Extraction (P3-S2) ──────────────────────────

class ExtractionField(BaseModel):
    field_name: str
    value: str
    confidence: float = Field(ge=0, le=1)
    source_page: Optional[int] = None


class ExtractionResponse(BaseModel):
    document_id: str
    fields: list[ExtractionField] = []
    raw_text_preview: str = ""
    generated_by: str = ""


# ── Semantic Search (P3-S2) ──────────────────────────────

class SearchRequest(BaseModel):
    query: str
    limit: int = Field(10, ge=1, le=50)
    entity_types: list[str] = Field(default=["cases", "tasks", "documents"])


class SearchResult(BaseModel):
    entity_type: str
    entity_id: str
    title: str
    snippet: str
    score: float


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult] = []
    total: int = 0


# ── Copilot / Chat (P3-S3) ──────────────────────────────

class CopilotMessage(BaseModel):
    role: str = "user"              # user | assistant | system
    content: str


class CopilotRequest(BaseModel):
    message: str
    case_id: Optional[str] = None
    history: list[CopilotMessage] = []


class CopilotAction(BaseModel):
    """Structured action returned by copilot for navigation/creation."""
    action: str                     # navigate | create_form | create_workflow | confirm | none
    route: Optional[str] = None
    payload: Optional[dict] = None
    description: str = ""


class CopilotResponse(BaseModel):
    reply: str
    action: Optional[CopilotAction] = None
    sources: list[str] = []


# ── Routing (P3-S3) ─────────────────────────────────────

class RoutingSuggestion(BaseModel):
    user_id: str
    user_name: str
    score: float = Field(ge=0, le=1)
    reasons: list[str] = []


class RoutingResponse(BaseModel):
    case_id: str
    suggestions: list[RoutingSuggestion] = []


# ── Recommendations (P3-S4) ─────────────────────────────

class Recommendation(BaseModel):
    action: str
    label: str
    description: str
    confidence: float = Field(ge=0, le=1)
    reason: str = ""


class RecommendationResponse(BaseModel):
    case_id: str
    recommendations: list[Recommendation] = []


# ── Risk Detection (P3-S4) ──────────────────────────────

class RiskFlag(BaseModel):
    severity: str                  # low | medium | high | critical
    category: str
    description: str
    source: str = ""


class RiskResponse(BaseModel):
    case_id: str
    risk_flags: list[RiskFlag] = []
    overall_risk: str = "low"      # low | medium | high | critical


# ── LLM Provider Info ───────────────────────────────────

class LLMProviderInfo(BaseModel):
    active_provider: str
    label: str
    type: str
    model: Optional[str] = None
    streaming: bool = False
