# Phase 3: AI / GenAI Integration — Implementation Plan

> **Status:** In Progress  
> **Sprints:** P3-S1 through P3-S4 (Sprints 14–17 overall)  
> **Started:** March 18, 2026

---

## Overview

Phase 3 transforms the workflow platform into an AI-augmented decision system with:
- Pluggable, multi-provider LLM client (OpenAI, Azure, Ollama, **Custom LLM**)
- Config-driven YAML palettes for form fields and workflow nodes
- AI agents for summarization, extraction, routing, chat, recommendations, and risk detection
- Chatbot-driven creation of forms, workflows, and settings via natural language

---

## Sprint Breakdown

### P3-S1 — AI Foundation (Sprint 14)

| # | Deliverable | Type | Details |
|---|-------------|------|---------|
| 1 | YAML palette configs | Backend | `config/form_fields.yaml`, `config/workflow_nodes.yaml` |
| 2 | LLM provider config | Backend | `config/llm_providers.yaml` with OpenAI, Azure, Ollama, Custom |
| 3 | Config API endpoints | Backend | `GET /api/config/form-fields`, `GET /api/config/workflow-nodes`, `GET/PATCH /api/config/llm` |
| 4 | Multi-provider LLM client | Backend | `agents/providers/` — abstract base + OpenAI-compat + Custom HTTP |
| 5 | Agent base framework | Backend | `agents/base.py` — abstract `BaseAgent` with `run()` method |
| 6 | Summarization agent | Backend | `agents/summarization.py` — case auto-summarization |
| 7 | AI routes | Backend | `routes/ai.py` — `POST /api/ai/summarize/{case_id}` |
| 8 | AI models | Backend | `models/ai.py` — request/response schemas |
| 9 | Frontend summary card | Frontend | Summary card component on case detail page |
| 10 | Tests | Backend | Unit tests for LLM client, agents, config API |

### P3-S2 — Document Intelligence + Semantic Search (Sprint 15)

| # | Deliverable | Type | Details |
|---|-------------|------|---------|
| 1 | Text extraction | Backend | `agents/extraction.py` — PDF/image → structured fields |
| 2 | Embedding pipeline | Backend | `agents/embeddings.py` — text → vector storage |
| 3 | Semantic search | Backend | `POST /api/ai/search` — natural language case search |
| 4 | Extract endpoint | Backend | `POST /api/ai/extract/{doc_id}` — document field extraction |
| 5 | Extraction widget | Frontend | Show extracted fields with confidence percentages |
| 6 | Semantic search bar | Frontend | Natural language search with ranked results |

### P3-S3 — Copilot + Smart Navigation + Chatbot Commands (Sprint 16)

| # | Deliverable | Type | Details |
|---|-------------|------|---------|
| 1 | Command parser | Backend | `agents/command_parser.py` — intent detection |
| 2 | Form builder agent | Backend | `agents/form_builder.py` — NL → form JSON |
| 3 | Workflow builder agent | Backend | `agents/workflow_builder.py` — NL → workflow JSON |
| 4 | Copilot agent | Backend | `agents/copilot.py` — QA + commands + streaming SSE |
| 5 | Routing agent | Backend | `agents/routing.py` — intelligent task assignment |
| 6 | Copilot panel | Frontend | Side-panel chat with streaming, commands, confirmation |
| 7 | Routing sidebar | Frontend | Suggested assignees with score breakdown |
| 8 | YAML-driven palettes | Frontend | Replace hardcoded palettes with config API data |

### P3-S4 — Recommendations + Risk Detection (Sprint 17)

| # | Deliverable | Type | Details |
|---|-------------|------|---------|
| 1 | Recommendation agent | Backend | `agents/recommendation.py` — next-best-action |
| 2 | Risk agent | Backend | `agents/risk.py` — risk flag detection |
| 3 | Recommendation endpoint | Backend | `POST /api/ai/recommend/{case_id}` |
| 4 | Risk endpoint | Backend | `POST /api/ai/risk/{case_id}` |
| 5 | NBA widget | Frontend | Next-best-action cards on case detail |
| 6 | Risk badges | Frontend | Risk flag indicators on case list + detail |

---

## Architecture

```
backend/
├── agents/                          # AI agent framework
│   ├── __init__.py
│   ├── base.py                      # Abstract BaseAgent
│   ├── llm_client.py                # Provider-agnostic LLM interface
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py                  # Abstract LLMProvider
│   │   ├── openai_provider.py       # OpenAI / Azure / Ollama (compat)
│   │   └── custom_provider.py       # Custom HTTP LLM (configurable req/res)
│   ├── summarization.py             # P3-S1: Case summarization
│   ├── embeddings.py                # P3-S2: Vector embeddings
│   ├── extraction.py                # P3-S2: Document extraction
│   ├── routing.py                   # P3-S3: Task routing
│   ├── copilot.py                   # P3-S3: QA chat agent
│   ├── command_parser.py            # P3-S3: Intent → action
│   ├── form_builder.py              # P3-S3: NL → form JSON
│   ├── workflow_builder.py          # P3-S3: NL → workflow JSON
│   ├── recommendation.py            # P3-S4: Next-best-action
│   └── risk.py                      # P3-S4: Risk detection
├── config/                          # YAML configs (single source of truth)
│   ├── form_fields.yaml             # Field palette definition
│   ├── workflow_nodes.yaml          # Node palette definition
│   └── llm_providers.yaml           # LLM provider configs
├── routes/
│   ├── ai.py                        # AI endpoints
│   └── config_api.py                # Config endpoints
├── models/
│   └── ai.py                        # AI request/response models

frontend/src/app/
├── features/ai/                     # AI feature module
│   ├── copilot-panel/               # P3-S3: Chat side-panel
│   ├── summary-card/                # P3-S1: Case summary
│   ├── extraction-widget/           # P3-S2: Doc extraction
│   ├── routing-sidebar/             # P3-S3: Assignee suggestions
│   ├── search-bar/                  # P3-S2: Semantic search
│   └── risk-badge/                  # P3-S4: Risk indicators
├── core/services/
│   └── ai.service.ts                # AI API client
```

---

## Multi-Provider LLM Architecture

### Provider Types

| Provider | Type | Auth | Streaming | Use Case |
|----------|------|------|-----------|----------|
| OpenAI | `openai` | API key | SSE | Default cloud provider |
| Azure OpenAI | `azure_openai` | API key | SSE | Enterprise Azure |
| Ollama | `ollama` | None | SSE | Local/air-gapped |
| **Custom** | `custom` | Token/Header | Configurable | Internal company LLM |

### Custom LLM Config

Custom LLM support enables any HTTP-based LLM via configurable:
- **`base_url`** — Your LLM endpoint URL
- **`request_template`** — Jinja2 template mapping standard input → your LLM's request format
- **`response_mapping`** — JSONPath expressions extracting response text from your LLM's output
- **`headers`** — Custom auth headers (tokens, API keys)

### Switching Providers

- **Env var:** `LLM_PROVIDER=custom` (no restart needed with config reload)
- **Admin API:** `PATCH /api/config/llm-provider` to hot-switch
- **Fallback:** Optional secondary provider if primary fails

---

## YAML-Driven Palette System

### Design

Both the **UI palette** (drag-drop sidebar) and the **AI chatbot** consume the same YAML configs. Adding a new field type or node type requires only a YAML edit — no code changes.

### Data Flow

```
YAML Config → GET /api/config/form-fields → Form Builder palette
                                           → AI form_builder.py agent
YAML Config → GET /api/config/workflow-nodes → Workflow Designer palette  
                                              → AI workflow_builder.py agent
```

---

## Chatbot Command System (P3-S3)

| Command | Example | Action |
|---------|---------|--------|
| Navigate | "Show me case #1234" | `{ action: "navigate", route: "/cases/1234" }` |
| Create Form | "Create a loan form with name, email, amount" | Generates form JSON → `POST /api/forms` |
| Create Workflow | "Build review → approve → complete workflow" | Generates workflow → `POST /api/workflows` |
| Configure | "Add Insurance Claim case type" | `POST /api/case-types` |
| Query | "What cases are overdue?" | Search + summarize |
| Summarize | "Summarize case #5678" | Agent generates narrative |

All commands use **confirmation flow** — AI previews the action, user confirms before execution.

---

## Security Considerations

- **PII scrubbing** before sending data to external LLMs
- **Prompt injection guards** — structured system prompts, input sanitization
- **Rate limiting** per user on AI endpoints
- **Response caching** for repeated/identical queries
- **Audit logging** — all AI actions logged with agent name + input hash
- **Custom LLM** — token stored as env var, never in YAML or response

---

## Validation Gate (End of Phase 3)

- [ ] All LLM providers work (OpenAI, Ollama, Custom)
- [ ] Provider switching works via env var and admin API
- [ ] Summarization generates coherent case narratives
- [ ] Document extraction ≥85% field confidence
- [ ] Semantic search returns relevant results in <1s
- [ ] Routing suggestions score correctly
- [ ] Copilot handles navigation, creation, and Q&A commands
- [ ] YAML palette changes reflected in UI and AI without code edits
- [ ] No PII leakage in LLM prompts
- [ ] All Phase 1–3 tests pass
