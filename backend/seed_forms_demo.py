"""Seed data for the All Field Types Demo form.

Run standalone to upsert the demo form into an existing database:
    python seed_forms_demo.py

Or import and call seed_demo_form(db) from within another seed module.
"""

import asyncio
import sys


FORM_ALL_FIELDS_DEMO = {
    "_id": "form-all-fields-demo",
    "name": "All Field Types Demo",
    "case_type_id": "ct-loan",
    "stage": "intake",
    "description": (
        "A comprehensive test form covering every supported field type — "
        "text, textarea, number, date, select, radio, checkbox, file upload, "
        "grid layout, and conditional visibility."
    ),
    "sections": [
        {"id": "sec-text-fields",   "title": "Text Fields",           "order": 0},
        {"id": "sec-numeric-date",  "title": "Numeric & Date Fields",  "order": 1},
        {"id": "sec-choice-fields", "title": "Choice Fields",          "order": 2},
        {"id": "sec-file-upload",   "title": "File Upload",            "order": 3},
        {"id": "sec-grid-layout",   "title": "Grid Layout",            "order": 4},
        {"id": "sec-conditional",   "title": "Conditional Fields",     "order": 5},
    ],
    "fields": [
        # ── Text Fields ─────────────────────────────────────────────────────────
        {
            "id": "fd-text-required", "type": "text",
            "label": "Required Text (min 3, max 50 chars)",
            "placeholder": "Must be between 3 and 50 characters",
            "order": 0, "section": "sec-text-fields",
            "validation": {"required": True, "minLength": 3, "maxLength": 50},
        },
        {
            "id": "fd-text-pattern", "type": "text",
            "label": "Email Address (pattern validated)",
            "placeholder": "you@example.com",
            "order": 1, "section": "sec-text-fields",
            "validation": {"required": True, "pattern": r"^[\w.-]+@[\w.-]+\.\w+$"},
        },
        {
            "id": "fd-text-optional", "type": "text",
            "label": "Optional Text (no validation)",
            "placeholder": "Leave blank if you like",
            "order": 2, "section": "sec-text-fields",
            "validation": {"required": False},
        },
        {
            "id": "fd-textarea", "type": "textarea",
            "label": "Multi-line Text Area (min 10 chars)",
            "placeholder": "Type at least 10 characters here...",
            "order": 3, "section": "sec-text-fields",
            "validation": {"required": True, "minLength": 10},
        },

        # ── Numeric & Date Fields ────────────────────────────────────────────────
        {
            "id": "fd-number-minmax", "type": "number",
            "label": "Age (1 – 120)",
            "placeholder": "e.g. 30",
            "order": 0, "section": "sec-numeric-date",
            "validation": {"required": True, "minValue": 1, "maxValue": 120},
        },
        {
            "id": "fd-number-optional", "type": "number",
            "label": "Optional Dollar Amount",
            "placeholder": "e.g. 5000",
            "order": 1, "section": "sec-numeric-date",
            "validation": {"required": False, "minValue": 0},
        },
        {
            "id": "fd-date-required", "type": "date",
            "label": "Start Date (required)",
            "order": 2, "section": "sec-numeric-date",
            "validation": {"required": True},
        },
        {
            "id": "fd-date-optional", "type": "date",
            "label": "End Date (optional)",
            "order": 3, "section": "sec-numeric-date",
            "validation": {"required": False},
        },

        # ── Choice Fields ────────────────────────────────────────────────────────
        {
            "id": "fd-select-required", "type": "select",
            "label": "Priority (required dropdown)",
            "order": 0, "section": "sec-choice-fields",
            "validation": {"required": True, "options": ["Low", "Medium", "High", "Critical"]},
        },
        {
            "id": "fd-select-optional", "type": "select",
            "label": "Department (optional dropdown)",
            "order": 1, "section": "sec-choice-fields",
            "validation": {
                "required": False,
                "options": ["Engineering", "Finance", "HR", "Legal", "Operations", "Sales"],
            },
        },
        {
            "id": "fd-radio-required", "type": "radio",
            "label": "Employment Status (required radio group)",
            "order": 2, "section": "sec-choice-fields",
            "validation": {
                "required": True,
                "options": ["Full-time", "Part-time", "Self-employed", "Unemployed", "Retired"],
            },
        },
        {
            "id": "fd-checkbox-required", "type": "checkbox",
            "label": "I agree to the terms and conditions (required checkbox)",
            "order": 3, "section": "sec-choice-fields",
            "validation": {"required": True},
        },
        {
            "id": "fd-checkbox-optional", "type": "checkbox",
            "label": "Subscribe to email updates (optional checkbox)",
            "order": 4, "section": "sec-choice-fields",
            "validation": {"required": False},
        },

        # ── File Upload ──────────────────────────────────────────────────────────
        {
            "id": "fd-file-upload", "type": "file",
            "label": "Upload Supporting Document",
            "order": 0, "section": "sec-file-upload",
            "validation": {"required": False},
        },

        # ── Grid Layout ──────────────────────────────────────────────────────────
        {
            "id": "fd-grid", "type": "grid",
            "label": "Address & Contact (2-column grid)",
            "order": 0, "section": "sec-grid-layout",
            "validation": {},
            "gridConfig": {
                "columns": 2,
                "rows": 3,
                "cells": [
                    {"id": "fd-grid-city",  "type": "text",     "label": "City",            "placeholder": "e.g. New York", "order": 0, "section": "grid", "validation": {"required": True}},
                    {"id": "fd-grid-state", "type": "select",   "label": "State",            "order": 1,                     "section": "grid", "validation": {"required": True, "options": ["CA", "FL", "NY", "TX", "WA", "Other"]}},
                    {"id": "fd-grid-zip",   "type": "text",     "label": "ZIP Code",         "placeholder": "e.g. 10001",   "order": 2, "section": "grid", "validation": {"required": True}},
                    {"id": "fd-grid-since", "type": "date",     "label": "Residing Since",   "order": 3,                     "section": "grid", "validation": {"required": False}},
                    {"id": "fd-grid-years", "type": "number",   "label": "Years at Address", "placeholder": "e.g. 3",       "order": 4, "section": "grid", "validation": {"required": False, "minValue": 0}},
                    {"id": "fd-grid-owns",  "type": "checkbox", "label": "Owns Property",    "order": 5,                     "section": "grid", "validation": {"required": False}},
                ],
            },
        },

        # ── Conditional Fields ───────────────────────────────────────────────────
        {
            "id": "fd-cond-trigger", "type": "select",
            "label": "Account Type (controls which fields appear below)",
            "order": 0, "section": "sec-conditional",
            "validation": {"required": True, "options": ["Personal", "Business"]},
        },
        {
            "id": "fd-cond-business-name", "type": "text",
            "label": "Business Name (shown only when Business is selected)",
            "placeholder": "Legal business name",
            "order": 1, "section": "sec-conditional",
            "validation": {"required": False},
            "visibleWhen": {"fd-cond-trigger": "Business"},
        },
        {
            "id": "fd-cond-business-reg", "type": "text",
            "label": "Registration Number (shown only when Business is selected)",
            "placeholder": "e.g. EIN 12-3456789",
            "order": 2, "section": "sec-conditional",
            "validation": {"required": False},
            "visibleWhen": {"fd-cond-trigger": "Business"},
        },
        {
            "id": "fd-cond-personal-ssn", "type": "text",
            "label": "SSN Last 4 Digits (shown only when Personal is selected)",
            "placeholder": "XXXX",
            "order": 3, "section": "sec-conditional",
            "validation": {"required": False, "pattern": r"^\d{4}$"},
            "visibleWhen": {"fd-cond-trigger": "Personal"},
        },
    ],
    "version": 1,
    "is_active": True,
    "created_at": "2025-01-15T00:00:00.000Z",
}


async def seed_demo_form(db) -> None:
    """Upsert the All Field Types Demo form. Safe to call multiple times."""
    await db.case_forms.replace_one(
        {"_id": FORM_ALL_FIELDS_DEMO["_id"]},
        FORM_ALL_FIELDS_DEMO,
        upsert=True,
    )


# ── Standalone runner ────────────────────────────────────────────────────────
async def _main():
    sys.path.insert(0, ".")
    from database import connect_db, get_db  # noqa: PLC0415

    await connect_db()
    db = get_db()
    await seed_demo_form(db)
    print(f"Upserted form: {FORM_ALL_FIELDS_DEMO['_id']} — {FORM_ALL_FIELDS_DEMO['name']}")


if __name__ == "__main__":
    asyncio.run(_main())
