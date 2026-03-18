"""Document extraction agent — extracts structured fields from document text.

Supports PDF text extraction (pypdf) and falls back to reading raw text.
Sends extracted text to the LLM for structured field extraction based on
the case-type schema.
"""

import json
import logging
import os
import re
from typing import Any, Optional

from agents.base import BaseAgent
from agents.llm_client import get_llm_client
from agents.providers.base import LLMMessage
from database import get_db

logger = logging.getLogger(__name__)


def _extract_text_from_pdf(filepath: str, max_pages: int = 20) -> str:
    """Extract text from a PDF file using pypdf."""
    try:
        from pypdf import PdfReader

        reader = PdfReader(filepath)
        pages = []
        for i, page in enumerate(reader.pages[:max_pages]):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(f"--- Page {i + 1} ---\n{text}")
        return "\n\n".join(pages)
    except ImportError:
        logger.warning("pypdf not installed — returning empty text for PDF")
        return ""
    except Exception as exc:
        logger.warning("PDF text extraction failed: %s", exc)
        return ""


def _extract_text_from_file(filepath: str, file_type: str) -> str:
    """Read raw text from a plain-text compatible file."""
    text_types = {
        "text/plain", "text/csv", "application/json", "text/xml",
        "application/xml",
    }
    if file_type in text_types:
        try:
            with open(filepath, "r", encoding="utf-8", errors="replace") as f:
                return f.read(500_000)  # cap at 500KB of text
        except Exception as exc:
            logger.warning("Text extraction failed: %s", exc)
    return ""


def extract_document_text(filepath: str, file_type: str) -> str:
    """Top-level dispatcher — extract text from any supported document."""
    if file_type == "application/pdf":
        return _extract_text_from_pdf(filepath)

    # Plain-text variants
    text = _extract_text_from_file(filepath, file_type)
    if text:
        return text

    # Unsupported type
    logger.info("No text extraction for file type: %s", file_type)
    return ""


class ExtractionAgent(BaseAgent):
    """Extracts structured fields from document text using the LLM."""

    @property
    def name(self) -> str:
        return "extraction"

    def _build_system_prompt(self, field_hints: list[str] | None = None) -> str:
        field_section = ""
        if field_hints:
            field_section = (
                "\nThe target fields to extract are:\n"
                + "\n".join(f"- {f}" for f in field_hints)
                + "\n"
            )

        return (
            "You are a document data-extraction specialist.\n"
            "Given the text of a document, extract structured fields.\n"
            f"{field_section}"
            "Respond ONLY in valid JSON with this structure:\n"
            "{\n"
            '  "fields": [\n'
            "    {\n"
            '      "field_name": "field name",\n'
            '      "value": "extracted value",\n'
            '      "confidence": 0.95,\n'
            '      "source_page": 1\n'
            "    }\n"
            "  ]\n"
            "}\n\n"
            "Rules:\n"
            "- confidence is a float 0..1 indicating your certainty\n"
            "- source_page is the 1-based page number if determinable, else null\n"
            "- If a field cannot be found, omit it — do NOT guess\n"
            "- Keep values concise; dates as ISO-8601 where possible\n"
        )

    async def _gather_context(
        self, document_id: str, **kwargs
    ) -> dict[str, Any]:
        """Fetch document metadata + on-disk text."""
        db = get_db()
        doc = await db.documents.find_one({"_id": document_id})
        if doc is None:
            raise ValueError(f"Document {document_id} not found")

        filepath = doc.get("storage_path", "")
        file_type = doc.get("file_type", "")
        raw_text = ""
        if filepath and os.path.isfile(filepath):
            raw_text = extract_document_text(filepath, file_type)

        # Try to get field schema from associated case type
        field_hints: list[str] = kwargs.get("field_hints") or []
        if not field_hints and doc.get("case_id"):
            case = await db.cases.find_one({"_id": doc["case_id"]})
            if case:
                ct = await db.case_types.find_one({"slug": case.get("type")})
                if ct and ct.get("fieldsSchema"):
                    field_hints = list(ct["fieldsSchema"].keys())

        return {
            "document_id": document_id,
            "file_name": doc.get("file_name", ""),
            "file_type": file_type,
            "raw_text": raw_text,
            "field_hints": field_hints,
        }

    async def run(self, document_id: str, **kwargs) -> dict[str, Any]:
        self._log(f"Extracting fields from document {document_id}")
        context = await self._gather_context(document_id, **kwargs)

        raw_text = context["raw_text"]
        if not raw_text:
            self._log("No text could be extracted from document")
            return {
                "document_id": document_id,
                "fields": [],
                "raw_text_preview": "",
                "generated_by": "none",
            }

        # Truncate text for LLM context window (keep first ~12k chars)
        text_for_llm = raw_text[:12_000]
        preview = raw_text[:500]

        prompt = (
            f"Document: {context['file_name']}\n"
            f"Type: {context['file_type']}\n\n"
            f"--- Document Text ---\n{text_for_llm}\n--- End ---"
        )

        messages = [
            LLMMessage(role="system", content=self._build_system_prompt(context["field_hints"])),
            LLMMessage(role="user", content=prompt),
        ]

        client = get_llm_client()
        response = await client.chat(messages, max_tokens=2000)

        # Parse structured output
        try:
            result = json.loads(response.content)
        except json.JSONDecodeError:
            match = re.search(r"\{.*\}", response.content, re.DOTALL)
            result = json.loads(match.group()) if match else {"fields": []}

        fields = result.get("fields", [])

        # Store extraction results alongside the document
        db = get_db()
        await db.documents.update_one(
            {"_id": document_id},
            {"$set": {
                "extracted_fields": fields,
                "extraction_status": "completed",
            }},
        )

        self._log(f"Extracted {len(fields)} fields via {response.provider}")
        return {
            "document_id": document_id,
            "fields": fields,
            "raw_text_preview": preview,
            "generated_by": response.provider,
        }
