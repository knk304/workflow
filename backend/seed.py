"""Consolidated seed data for all collections — hierarchical Pega-Lite model."""

from datetime import datetime, timezone, timedelta
from database import get_db
from security import hash_password


async def force_reseed():
    """Drop all collections and re-seed from scratch."""
    db = get_db()
    collections = [
        "users", "teams", "case_types", "case_type_definitions", "cases",
        "tasks", "assignments", "comments", "notifications", "workflows",
        "approval_chains", "sla_definitions", "case_forms",
        "approval_routing_rules", "documents", "audit_logs",
        "form_submissions", "decision_tables", "counters",
    ]
    for col in collections:
        await db[col].drop()
    await _insert_all(db)


async def seed_all():
    """Seed all collections if the database is empty."""
    db = get_db()
    count = await db.users.count_documents({})
    if count == 0:
        await _insert_all(db)
    else:
        # Users exist — still seed flow definitions if missing
        if await db.flow_definitions.count_documents({}) == 0:
            await _seed_flow_definitions(db)


# ─── Blueprint helpers ─────────────────────────────

def _step(sid, name, stype, order, config=None, skip_when=None, sla_hours=None):
    return {"id": sid, "name": name, "type": stype, "order": order,
            "required": True, "skip_when": skip_when, "visible_when": None,
            "sla_hours": sla_hours, "config": config or {}}

def _proc(pid, name, order, steps, is_parallel=False, start_when=None):
    return {"id": pid, "name": name, "type": "sequential", "order": order,
            "is_parallel": is_parallel, "start_when": start_when,
            "sla_hours": None, "steps": steps}

def _stage(sid, name, order, processes, stage_type="primary",
           on_complete="auto_advance", resolution_status=None, skip_when=None):
    return {"id": sid, "name": name, "stage_type": stage_type,
            "order": order, "on_complete": on_complete,
            "resolution_status": resolution_status, "skip_when": skip_when,
            "entry_criteria": None, "required_attachments": [],
            "delete_open_assignments": True, "resolve_child_cases": True,
            "sla_hours": None, "processes": processes}


# ─── Runtime instance helpers (matches instantiate_case shape) ──

def _rt_step(def_id, name, stype, order, status="pending",
             started_at=None, completed_at=None, assigned_to=None, **kw):
    return {"definition_id": def_id, "name": name, "type": stype,
            "status": status, "order": order,
            "started_at": started_at, "completed_at": completed_at,
            "assigned_to": assigned_to, "form_submission_id": None,
            "approval_chain_id": kw.get("approval_chain_id"),
            "child_case_id": kw.get("child_case_id"), "decision_branch_taken": None,
            "skipped_reason": None, "notes": kw.get("notes"),
            "sla_target": None}

def _rt_proc(def_id, name, order, steps, status="pending",
             started_at=None, completed_at=None, **kw):
    return {"definition_id": def_id, "name": name, "type": "sequential",
            "status": status, "order": order, "is_parallel": False,
            "started_at": started_at, "completed_at": completed_at,
            "steps": steps, "start_when": None}

def _rt_stage(def_id, name, order, processes, status="pending",
              on_complete="auto_advance", resolution_status=None,
              entered_at=None, completed_at=None, completed_by=None):
    return {"definition_id": def_id, "name": name,
            "stage_type": "primary", "status": status, "order": order,
            "on_complete": on_complete, "resolution_status": resolution_status,
            "entered_at": entered_at, "completed_at": completed_at,
            "completed_by": completed_by, "processes": processes}



async def _seed_flow_definitions(db):
    """Seed flow definitions if collection is empty."""
    if await db.flow_definitions.count_documents({}) > 0:
        return
    flow_definitions = [
        {
            "_id": "flow-health-assessment",
            "name": "Health Risk Assessment Questionnaire",
            "description": "Comprehensive health risk evaluation with dynamic branching based on responses. Covers general health, lifestyle, family history, and mental wellness.",
            "category": "health",
            "definition": {
                "nodes": [
                    {"id": "n-start", "type": "start", "label": "Start", "position": {"x": 50, "y": 250}},

                    # Q1: General Info
                    {"id": "n-q1", "type": "question", "label": "Personal Information",
                     "position": {"x": 250, "y": 250},
                     "fields": [
                         {"id": "f-name", "type": "text", "label": "Full Name", "placeholder": "Enter your full name",
                          "options": [], "validation": {"required": True, "minLength": 2}, "order": 0},
                         {"id": "f-age", "type": "number", "label": "Age", "placeholder": "Your age",
                          "options": [], "validation": {"required": True, "minValue": 1, "maxValue": 120}, "order": 1},
                         {"id": "f-gender", "type": "select", "label": "Gender",
                          "options": [{"label": "Male", "value": "male"}, {"label": "Female", "value": "female"}, {"label": "Other", "value": "other"}],
                          "validation": {"required": True}, "order": 2},
                     ],
                     "conditions": [], "content": None, "config": {}},

                    # Q2: Smoking status
                    {"id": "n-q2", "type": "question", "label": "Smoking Status",
                     "position": {"x": 500, "y": 250},
                     "fields": [
                         {"id": "f-smoker", "type": "radio", "label": "Do you currently smoke?",
                          "helpText": "This includes cigarettes, cigars, pipes, and e-cigarettes",
                          "options": [{"label": "Yes, daily", "value": "daily"}, {"label": "Yes, occasionally", "value": "occasional"}, {"label": "No, I quit", "value": "quit"}, {"label": "Never smoked", "value": "never"}],
                          "validation": {"required": True}, "order": 0},
                     ],
                     "conditions": [], "content": None, "config": {}},

                    # Decision: smoking branch
                    {"id": "n-d1", "type": "decision", "label": "Smoker?",
                     "position": {"x": 750, "y": 250},
                     "fields": [],
                     "conditions": [
                         {"id": "c-smoker-yes", "label": "Is smoker", "fieldId": "f-smoker", "operator": "in", "value": ["daily", "occasional"], "targetNodeId": "n-q3a"},
                         {"id": "c-smoker-quit", "label": "Quit smoking", "fieldId": "f-smoker", "operator": "equals", "value": "quit", "targetNodeId": "n-q3b"},
                     ],
                     "defaultTarget": "n-q4",
                     "content": None, "config": {}},

                    # Q3a: Smoking details (for current smokers)
                    {"id": "n-q3a", "type": "question", "label": "Smoking Details",
                     "position": {"x": 1000, "y": 100},
                     "fields": [
                         {"id": "f-cigs-per-day", "type": "number", "label": "How many cigarettes per day?",
                          "options": [], "validation": {"required": True, "minValue": 0}, "order": 0},
                         {"id": "f-years-smoking", "type": "number", "label": "How many years have you been smoking?",
                          "options": [], "validation": {"required": True, "minValue": 0}, "order": 1},
                         {"id": "f-quit-interest", "type": "radio", "label": "Are you interested in quitting?",
                          "options": [{"label": "Yes, very interested", "value": "yes"}, {"label": "Maybe someday", "value": "maybe"}, {"label": "No", "value": "no"}],
                          "validation": {"required": True}, "order": 2},
                     ],
                     "conditions": [], "content": None, "config": {}},

                    # Q3b: Quit smoking details
                    {"id": "n-q3b", "type": "question", "label": "Quit Smoking Details",
                     "position": {"x": 1000, "y": 400},
                     "fields": [
                         {"id": "f-quit-duration", "type": "select", "label": "How long ago did you quit?",
                          "options": [{"label": "Less than 6 months", "value": "lt6m"}, {"label": "6-12 months", "value": "6to12m"}, {"label": "1-5 years", "value": "1to5y"}, {"label": "More than 5 years", "value": "gt5y"}],
                          "validation": {"required": True}, "order": 0},
                     ],
                     "conditions": [], "content": None, "config": {}},

                    # Q4: Exercise habits
                    {"id": "n-q4", "type": "question", "label": "Exercise & Activity",
                     "position": {"x": 1250, "y": 250},
                     "fields": [
                         {"id": "f-exercise-freq", "type": "radio", "label": "How often do you exercise?",
                          "options": [{"label": "Daily", "value": "daily"}, {"label": "3-5 times/week", "value": "3to5"}, {"label": "1-2 times/week", "value": "1to2"}, {"label": "Rarely/Never", "value": "rarely"}],
                          "validation": {"required": True}, "order": 0},
                         {"id": "f-exercise-type", "type": "multi_select", "label": "What types of exercise do you do?",
                          "helpText": "Select all that apply",
                          "options": [{"label": "Walking", "value": "walking"}, {"label": "Running", "value": "running"}, {"label": "Swimming", "value": "swimming"}, {"label": "Cycling", "value": "cycling"}, {"label": "Weight Training", "value": "weights"}, {"label": "Yoga/Pilates", "value": "yoga"}, {"label": "Team Sports", "value": "sports"}],
                          "validation": {}, "order": 1},
                     ],
                     "conditions": [], "content": None, "config": {}},

                    # Decision: exercise level
                    {"id": "n-d2", "type": "decision", "label": "Activity Level?",
                     "position": {"x": 1500, "y": 250},
                     "fields": [],
                     "conditions": [
                         {"id": "c-sedentary", "label": "Sedentary", "fieldId": "f-exercise-freq", "operator": "equals", "value": "rarely", "targetNodeId": "n-q5a"},
                     ],
                     "defaultTarget": "n-q5",
                     "content": None, "config": {}},

                    # Q5a: Sedentary lifestyle follow-up
                    {"id": "n-q5a", "type": "question", "label": "Sedentary Lifestyle",
                     "position": {"x": 1750, "y": 100},
                     "fields": [
                         {"id": "f-sitting-hours", "type": "number", "label": "Average hours sitting per day?",
                          "options": [], "validation": {"required": True, "minValue": 0, "maxValue": 24}, "order": 0},
                         {"id": "f-sedentary-reason", "type": "select", "label": "Main reason for low activity?",
                          "options": [{"label": "Physical limitations", "value": "physical"}, {"label": "Lack of time", "value": "time"}, {"label": "Lack of motivation", "value": "motivation"}, {"label": "Medical condition", "value": "medical"}, {"label": "Other", "value": "other"}],
                          "validation": {"required": True}, "order": 1},
                     ],
                     "conditions": [], "content": None, "config": {}},

                    # Q5: Family history
                    {"id": "n-q5", "type": "question", "label": "Family Medical History",
                     "position": {"x": 1750, "y": 400},
                     "fields": [
                         {"id": "f-family-conditions", "type": "multi_select", "label": "Any family history of the following?",
                          "helpText": "Select all that apply (parents, siblings, grandparents)",
                          "options": [{"label": "Heart Disease", "value": "heart"}, {"label": "Diabetes", "value": "diabetes"}, {"label": "Cancer", "value": "cancer"}, {"label": "Stroke", "value": "stroke"}, {"label": "High Blood Pressure", "value": "bp"}, {"label": "Mental Health Conditions", "value": "mental"}, {"label": "None of the above", "value": "none"}],
                          "validation": {"required": True}, "order": 0},
                     ],
                     "conditions": [], "content": None, "config": {}},

                    # Q6: Mental health
                    {"id": "n-q6", "type": "question", "label": "Mental Wellness",
                     "position": {"x": 2000, "y": 250},
                     "fields": [
                         {"id": "f-stress-level", "type": "radio", "label": "How would you rate your stress level?",
                          "options": [{"label": "Very Low", "value": "very_low"}, {"label": "Low", "value": "low"}, {"label": "Moderate", "value": "moderate"}, {"label": "High", "value": "high"}, {"label": "Very High", "value": "very_high"}],
                          "validation": {"required": True}, "order": 0},
                         {"id": "f-sleep-hours", "type": "number", "label": "Average hours of sleep per night?",
                          "options": [], "validation": {"required": True, "minValue": 0, "maxValue": 24}, "order": 1},
                         {"id": "f-mental-support", "type": "radio", "label": "Do you have access to mental health support?",
                          "options": [{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}, {"label": "Not sure", "value": "unsure"}],
                          "validation": {"required": True}, "order": 2},
                     ],
                     "conditions": [], "content": None, "config": {}},

                    # Q7: Diet
                    {"id": "n-q7", "type": "question", "label": "Diet & Nutrition",
                     "position": {"x": 2250, "y": 250},
                     "fields": [
                         {"id": "f-diet-type", "type": "select", "label": "How would you describe your diet?",
                          "options": [{"label": "Balanced/Healthy", "value": "balanced"}, {"label": "Mostly healthy", "value": "mostly_healthy"}, {"label": "Average", "value": "average"}, {"label": "Mostly unhealthy", "value": "mostly_unhealthy"}, {"label": "Poor", "value": "poor"}],
                          "validation": {"required": True}, "order": 0},
                         {"id": "f-water-intake", "type": "radio", "label": "Daily water intake?",
                          "options": [{"label": "Less than 4 glasses", "value": "lt4"}, {"label": "4-6 glasses", "value": "4to6"}, {"label": "7-8 glasses", "value": "7to8"}, {"label": "More than 8 glasses", "value": "gt8"}],
                          "validation": {"required": True}, "order": 1},
                         {"id": "f-alcohol", "type": "radio", "label": "Alcohol consumption?",
                          "options": [{"label": "Never", "value": "never"}, {"label": "Occasionally (1-2/month)", "value": "occasional"}, {"label": "Moderate (1-2/week)", "value": "moderate"}, {"label": "Frequent (3+/week)", "value": "frequent"}, {"label": "Daily", "value": "daily"}],
                          "validation": {"required": True}, "order": 2},
                     ],
                     "conditions": [], "content": None, "config": {}},

                    # Decision: alcohol check
                    {"id": "n-d3", "type": "decision", "label": "Alcohol Level?",
                     "position": {"x": 2500, "y": 250},
                     "fields": [],
                     "conditions": [
                         {"id": "c-heavy-drinker", "label": "Heavy drinker", "fieldId": "f-alcohol", "operator": "in", "value": ["frequent", "daily"], "targetNodeId": "n-q7a"},
                     ],
                     "defaultTarget": "n-q8",
                     "content": None, "config": {}},

                    # Q7a: Heavy drinking follow-up
                    {"id": "n-q7a", "type": "question", "label": "Alcohol Consumption Details",
                     "position": {"x": 2750, "y": 100},
                     "fields": [
                         {"id": "f-drinks-per-week", "type": "number", "label": "Average drinks per week?",
                          "options": [], "validation": {"required": True, "minValue": 0}, "order": 0},
                         {"id": "f-alcohol-concern", "type": "radio", "label": "Are you concerned about your alcohol intake?",
                          "options": [{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}, {"label": "Sometimes", "value": "sometimes"}],
                          "validation": {"required": True}, "order": 1},
                     ],
                     "conditions": [], "content": None, "config": {}},

                    # Q8: Current medical conditions
                    {"id": "n-q8", "type": "question", "label": "Current Health Status",
                     "position": {"x": 2750, "y": 400},
                     "fields": [
                         {"id": "f-conditions", "type": "multi_select", "label": "Do you currently have any of these conditions?",
                          "helpText": "Select all that apply",
                          "options": [{"label": "Diabetes", "value": "diabetes"}, {"label": "High Blood Pressure", "value": "bp"}, {"label": "Heart Condition", "value": "heart"}, {"label": "Asthma/COPD", "value": "respiratory"}, {"label": "Arthritis", "value": "arthritis"}, {"label": "Depression/Anxiety", "value": "mental"}, {"label": "None", "value": "none"}],
                          "validation": {"required": True}, "order": 0},
                         {"id": "f-medications", "type": "radio", "label": "Are you currently taking any medications?",
                          "options": [{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}],
                          "validation": {"required": True}, "order": 1},
                     ],
                     "conditions": [], "content": None, "config": {}},

                    # Q9: Final review consent
                    {"id": "n-q9", "type": "question", "label": "Review & Consent",
                     "position": {"x": 3000, "y": 250},
                     "fields": [
                         {"id": "f-consent", "type": "checkbox", "label": "I confirm all information provided is accurate to the best of my knowledge.",
                          "options": [], "validation": {"required": True}, "order": 0},
                         {"id": "f-contact-pref", "type": "radio", "label": "Preferred contact method for results?",
                          "options": [{"label": "Email", "value": "email"}, {"label": "Phone", "value": "phone"}, {"label": "In-person appointment", "value": "in_person"}],
                          "validation": {"required": True}, "order": 1},
                         {"id": "f-notes", "type": "textarea", "label": "Additional notes or concerns",
                          "placeholder": "Anything else you'd like us to know?",
                          "options": [], "validation": {}, "order": 2},
                     ],
                     "conditions": [], "content": None, "config": {}},

                    {"id": "n-end", "type": "end", "label": "End", "position": {"x": 3250, "y": 250}},
                ],
                "edges": [
                    {"id": "e-0", "source": "n-start", "target": "n-q1"},
                    {"id": "e-1", "source": "n-q1", "target": "n-q2"},
                    {"id": "e-2", "source": "n-q2", "target": "n-d1"},
                    {"id": "e-3", "source": "n-d1", "target": "n-q3a", "label": "Smoker"},
                    {"id": "e-4", "source": "n-d1", "target": "n-q3b", "label": "Quit"},
                    {"id": "e-5", "source": "n-d1", "target": "n-q4", "label": "Never smoked"},
                    {"id": "e-6", "source": "n-q3a", "target": "n-q4"},
                    {"id": "e-7", "source": "n-q3b", "target": "n-q4"},
                    {"id": "e-8", "source": "n-q4", "target": "n-d2"},
                    {"id": "e-9", "source": "n-d2", "target": "n-q5a", "label": "Sedentary"},
                    {"id": "e-10", "source": "n-d2", "target": "n-q5", "label": "Active"},
                    {"id": "e-11", "source": "n-q5a", "target": "n-q5"},
                    {"id": "e-12", "source": "n-q5", "target": "n-q6"},
                    {"id": "e-13", "source": "n-q6", "target": "n-q7"},
                    {"id": "e-14", "source": "n-q7", "target": "n-d3"},
                    {"id": "e-15", "source": "n-d3", "target": "n-q7a", "label": "Heavy drinker"},
                    {"id": "e-16", "source": "n-d3", "target": "n-q8", "label": "Moderate/None"},
                    {"id": "e-17", "source": "n-q7a", "target": "n-q8"},
                    {"id": "e-18", "source": "n-q8", "target": "n-q9"},
                    {"id": "e-19", "source": "n-q9", "target": "n-end"},
                ],
            },
            "version": 1,
            "is_active": True,
            "created_by": "user-admin",
            "created_at": "2025-06-01T00:00:00.000Z",
            "updated_at": "2025-06-01T00:00:00.000Z",
        },

        # ── Loan Origination Flow ──
        {
            "_id": "flow-loan-origination",
            "name": "Loan Origination",
            "description": "End-to-end loan application flow covering applicant details, income verification, credit check, and final approval.",
            "category": "finance",
            "definition": {
                "nodes": [
                    {"id": "n-start", "type": "start", "label": "Start", "position": {"x": 50, "y": 200}, "fields": [], "conditions": []},
                    {"id": "n-q1", "type": "question", "label": "Applicant Details",
                     "position": {"x": 250, "y": 200},
                     "fields": [
                         {"id": "f-fullname", "type": "text", "label": "Full Legal Name", "options": [], "validation": {"required": True, "minLength": 2}, "order": 0},
                         {"id": "f-ssn", "type": "text", "label": "SSN / Tax ID", "placeholder": "XXX-XX-XXXX", "options": [], "validation": {"required": True}, "order": 1},
                         {"id": "f-dob", "type": "date", "label": "Date of Birth", "options": [], "validation": {"required": True}, "order": 2},
                         {"id": "f-loan-amount", "type": "number", "label": "Requested Loan Amount ($)", "options": [], "validation": {"required": True, "minValue": 1000}, "order": 3},
                         {"id": "f-loan-purpose", "type": "select", "label": "Loan Purpose",
                          "options": [{"label": "Home Purchase", "value": "home"}, {"label": "Auto", "value": "auto"}, {"label": "Education", "value": "education"}, {"label": "Personal", "value": "personal"}, {"label": "Business", "value": "business"}],
                          "validation": {"required": True}, "order": 4},
                     ], "conditions": [], "config": {"alertMessage": "All information must match government-issued ID exactly.", "alertType": "warning"}},
                    {"id": "n-q2", "type": "question", "label": "Income & Employment",
                     "position": {"x": 500, "y": 200},
                     "fields": [
                         {"id": "f-employer", "type": "text", "label": "Current Employer", "options": [], "validation": {"required": True}, "order": 0},
                         {"id": "f-annual-income", "type": "number", "label": "Annual Income ($)", "options": [], "validation": {"required": True, "minValue": 0}, "order": 1},
                         {"id": "f-employment-years", "type": "number", "label": "Years at Current Employer", "options": [], "validation": {"required": True, "minValue": 0}, "order": 2},
                         {"id": "f-income-docs", "type": "file", "label": "Upload Pay Stubs / W-2", "options": [], "validation": {"required": True}, "order": 3},
                     ], "conditions": [], "config": {}},
                    {"id": "n-task-credit", "type": "task", "label": "Credit Check",
                     "position": {"x": 750, "y": 200},
                     "fields": [], "conditions": [], "config": {"assigneeRole": "WORKER"},
                     "content": "Run credit check against bureau. Record score and derogatory marks."},
                    {"id": "n-d1", "type": "decision", "label": "Credit Score?",
                     "position": {"x": 1000, "y": 200},
                     "fields": [],
                     "conditions": [
                         {"id": "c-good", "label": "Score >= 700", "fieldId": "credit_score", "operator": "gt", "value": "699", "targetNodeId": "n-approval"},
                         {"id": "c-fair", "label": "Score 600-699", "fieldId": "credit_score", "operator": "gt", "value": "599", "targetNodeId": "n-q3"},
                     ],
                     "defaultTarget": "n-reject", "config": {}},
                    {"id": "n-q3", "type": "question", "label": "Additional Documentation",
                     "position": {"x": 1250, "y": 100},
                     "fields": [
                         {"id": "f-collateral", "type": "text", "label": "Collateral Description", "options": [], "validation": {"required": True}, "order": 0},
                         {"id": "f-cosigner", "type": "radio", "label": "Will there be a co-signer?",
                          "options": [{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}],
                          "validation": {"required": True}, "order": 1},
                     ], "conditions": [], "config": {}},
                    {"id": "n-approval", "type": "approval", "label": "Manager Approval",
                     "position": {"x": 1250, "y": 300},
                     "fields": [], "conditions": [], "config": {"assigneeRole": "MANAGER", "approvalType": "single"}},
                    {"id": "n-notify", "type": "notification", "label": "Notify Applicant",
                     "position": {"x": 1500, "y": 200},
                     "fields": [], "conditions": [], "config": {"channel": "email", "recipientRole": ""},
                     "content": "Dear applicant, your loan application has been approved. We will contact you with next steps."},
                    {"id": "n-reject", "type": "notification", "label": "Rejection Notice",
                     "position": {"x": 1250, "y": 450},
                     "fields": [], "conditions": [], "config": {"channel": "email", "recipientRole": ""},
                     "content": "We regret to inform you that your loan application could not be approved at this time."},
                    {"id": "n-end", "type": "end", "label": "End", "position": {"x": 1750, "y": 200}, "fields": [], "conditions": []},
                ],
                "edges": [
                    {"id": "e-0", "source": "n-start", "target": "n-q1"},
                    {"id": "e-1", "source": "n-q1", "target": "n-q2"},
                    {"id": "e-2", "source": "n-q2", "target": "n-task-credit"},
                    {"id": "e-3", "source": "n-task-credit", "target": "n-d1"},
                    {"id": "e-4", "source": "n-d1", "target": "n-approval", "label": "Good credit"},
                    {"id": "e-5", "source": "n-d1", "target": "n-q3", "label": "Fair credit"},
                    {"id": "e-6", "source": "n-d1", "target": "n-reject", "label": "Poor credit"},
                    {"id": "e-7", "source": "n-q3", "target": "n-approval"},
                    {"id": "e-8", "source": "n-approval", "target": "n-notify"},
                    {"id": "e-9", "source": "n-notify", "target": "n-end"},
                    {"id": "e-10", "source": "n-reject", "target": "n-end"},
                ],
            },
            "version": 1,
            "is_active": True,
            "created_by": "user-admin",
            "created_at": "2025-06-15T00:00:00.000Z",
            "updated_at": "2025-06-15T00:00:00.000Z",
        },

        # ── Claims Insurance Flow ──
        {
            "_id": "flow-claims-insurance",
            "name": "Claims Insurance",
            "description": "Insurance claim filing and processing flow with damage assessment, document upload, and adjuster review.",
            "category": "finance",
            "definition": {
                "nodes": [
                    {"id": "n-start", "type": "start", "label": "Start", "position": {"x": 50, "y": 200}, "fields": [], "conditions": []},
                    {"id": "n-q1", "type": "question", "label": "Policy & Personal Info",
                     "position": {"x": 250, "y": 200},
                     "fields": [
                         {"id": "f-policy-num", "type": "text", "label": "Policy Number", "options": [], "validation": {"required": True}, "order": 0},
                         {"id": "f-name", "type": "text", "label": "Policyholder Name", "options": [], "validation": {"required": True}, "order": 1},
                         {"id": "f-claim-type", "type": "select", "label": "Claim Type",
                          "options": [{"label": "Auto Accident", "value": "auto"}, {"label": "Property Damage", "value": "property"}, {"label": "Health / Medical", "value": "health"}, {"label": "Liability", "value": "liability"}, {"label": "Natural Disaster", "value": "disaster"}],
                          "validation": {"required": True}, "order": 2},
                         {"id": "f-incident-date", "type": "date", "label": "Date of Incident", "options": [], "validation": {"required": True}, "order": 3},
                     ], "conditions": [], "config": {"alertMessage": "Have your policy number ready before starting this claim.", "alertType": "info"}},
                    {"id": "n-q2", "type": "question", "label": "Incident Details",
                     "position": {"x": 500, "y": 200},
                     "fields": [
                         {"id": "f-description", "type": "textarea", "label": "Describe what happened", "placeholder": "Provide a detailed account of the incident...", "options": [], "validation": {"required": True, "minLength": 20}, "order": 0},
                         {"id": "f-location", "type": "text", "label": "Location of Incident", "options": [], "validation": {"required": True}, "order": 1},
                         {"id": "f-police-report", "type": "radio", "label": "Was a police report filed?",
                          "options": [{"label": "Yes", "value": "yes"}, {"label": "No", "value": "no"}],
                          "validation": {"required": True}, "order": 2},
                         {"id": "f-estimated-damage", "type": "number", "label": "Estimated Damage ($)", "options": [], "validation": {"required": True, "minValue": 0}, "order": 3},
                     ], "conditions": [], "config": {}},
                    {"id": "n-q3", "type": "question", "label": "Upload Evidence",
                     "position": {"x": 750, "y": 200},
                     "fields": [
                         {"id": "f-photos", "type": "file", "label": "Photos of Damage", "options": [], "validation": {"required": True}, "order": 0},
                         {"id": "f-docs", "type": "file", "label": "Supporting Documents (receipts, reports)", "options": [], "validation": {}, "order": 1},
                     ], "conditions": [], "config": {}},
                    {"id": "n-d1", "type": "decision", "label": "Damage Amount?",
                     "position": {"x": 1000, "y": 200},
                     "fields": [],
                     "conditions": [
                         {"id": "c-high", "label": "High value claim", "fieldId": "f-estimated-damage", "operator": "gt", "value": "10000", "targetNodeId": "n-task-inspect"},
                     ],
                     "defaultTarget": "n-task-review", "config": {}},
                    {"id": "n-task-inspect", "type": "task", "label": "On-site Inspection",
                     "position": {"x": 1250, "y": 100},
                     "fields": [], "conditions": [], "config": {"assigneeRole": "WORKER"},
                     "content": "Schedule and complete an on-site inspection for high-value claim."},
                    {"id": "n-task-review", "type": "task", "label": "Adjuster Review",
                     "position": {"x": 1250, "y": 300},
                     "fields": [], "conditions": [], "config": {"assigneeRole": "WORKER"},
                     "content": "Review claim documentation and evidence. Determine payout amount."},
                    {"id": "n-approval", "type": "approval", "label": "Manager Approval",
                     "position": {"x": 1500, "y": 200},
                     "fields": [], "conditions": [], "config": {"assigneeRole": "MANAGER", "approvalType": "single"}},
                    {"id": "n-notify", "type": "notification", "label": "Notify Claimant",
                     "position": {"x": 1750, "y": 200},
                     "fields": [], "conditions": [], "config": {"channel": "email"},
                     "content": "Your insurance claim has been reviewed and a determination has been made. Please check your account for details."},
                    {"id": "n-end", "type": "end", "label": "End", "position": {"x": 2000, "y": 200}, "fields": [], "conditions": []},
                ],
                "edges": [
                    {"id": "e-0", "source": "n-start", "target": "n-q1"},
                    {"id": "e-1", "source": "n-q1", "target": "n-q2"},
                    {"id": "e-2", "source": "n-q2", "target": "n-q3"},
                    {"id": "e-3", "source": "n-q3", "target": "n-d1"},
                    {"id": "e-4", "source": "n-d1", "target": "n-task-inspect", "label": "> $10k"},
                    {"id": "e-5", "source": "n-d1", "target": "n-task-review", "label": "<= $10k"},
                    {"id": "e-6", "source": "n-task-inspect", "target": "n-approval"},
                    {"id": "e-7", "source": "n-task-review", "target": "n-approval"},
                    {"id": "e-8", "source": "n-approval", "target": "n-notify"},
                    {"id": "e-9", "source": "n-notify", "target": "n-end"},
                ],
            },
            "version": 1,
            "is_active": True,
            "created_by": "user-admin",
            "created_at": "2025-06-20T00:00:00.000Z",
            "updated_at": "2025-06-20T00:00:00.000Z",
        },

        # ── Customer Onboarding Flow ──
        {
            "_id": "flow-customer-onboarding",
            "name": "Customer Onboarding",
            "description": "New customer onboarding with KYC verification, account setup, and welcome communications.",
            "category": "process",
            "definition": {
                "nodes": [
                    {"id": "n-start", "type": "start", "label": "Start", "position": {"x": 50, "y": 200}, "fields": [], "conditions": []},
                    {"id": "n-q1", "type": "question", "label": "Customer Information",
                     "position": {"x": 250, "y": 200},
                     "fields": [
                         {"id": "f-first", "type": "text", "label": "First Name", "options": [], "validation": {"required": True}, "order": 0},
                         {"id": "f-last", "type": "text", "label": "Last Name", "options": [], "validation": {"required": True}, "order": 1},
                         {"id": "f-email", "type": "text", "label": "Email Address", "placeholder": "name@company.com", "options": [], "validation": {"required": True}, "order": 2},
                         {"id": "f-phone", "type": "text", "label": "Phone Number", "options": [], "validation": {"required": True}, "order": 3},
                         {"id": "f-account-type", "type": "select", "label": "Account Type",
                          "options": [{"label": "Individual", "value": "individual"}, {"label": "Business", "value": "business"}, {"label": "Joint", "value": "joint"}],
                          "validation": {"required": True}, "order": 4},
                     ], "conditions": [], "config": {"alertMessage": "Ensure customer consents to data collection before proceeding.", "alertType": "info"}},
                    {"id": "n-q2", "type": "question", "label": "Identity Verification (KYC)",
                     "position": {"x": 500, "y": 200},
                     "fields": [
                         {"id": "f-id-type", "type": "select", "label": "ID Type",
                          "options": [{"label": "Passport", "value": "passport"}, {"label": "Driver's License", "value": "drivers_license"}, {"label": "National ID", "value": "national_id"}],
                          "validation": {"required": True}, "order": 0},
                         {"id": "f-id-number", "type": "text", "label": "ID Number", "options": [], "validation": {"required": True}, "order": 1},
                         {"id": "f-id-photo", "type": "file", "label": "Upload ID Photo", "options": [], "validation": {"required": True}, "order": 2},
                         {"id": "f-address", "type": "textarea", "label": "Residential Address", "options": [], "validation": {"required": True}, "order": 3},
                         {"id": "f-proof-address", "type": "file", "label": "Proof of Address", "options": [], "validation": {"required": True}, "order": 4},
                     ], "conditions": [], "config": {}},
                    {"id": "n-task-kyc", "type": "task", "label": "KYC Verification",
                     "position": {"x": 750, "y": 200},
                     "fields": [], "conditions": [], "config": {"assigneeRole": "WORKER"},
                     "content": "Verify customer identity documents against KYC/AML databases. Flag any discrepancies."},
                    {"id": "n-d1", "type": "decision", "label": "KYC Passed?",
                     "position": {"x": 1000, "y": 200},
                     "fields": [],
                     "conditions": [
                         {"id": "c-pass", "label": "KYC Passed", "fieldId": "kyc_status", "operator": "equals", "value": "passed", "targetNodeId": "n-task-setup"},
                         {"id": "c-review", "label": "Needs Review", "fieldId": "kyc_status", "operator": "equals", "value": "review", "targetNodeId": "n-approval"},
                     ],
                     "defaultTarget": "n-reject", "config": {}},
                    {"id": "n-approval", "type": "approval", "label": "Compliance Review",
                     "position": {"x": 1250, "y": 100},
                     "fields": [], "conditions": [], "config": {"assigneeRole": "MANAGER", "approvalType": "single"}},
                    {"id": "n-task-setup", "type": "task", "label": "Create Account",
                     "position": {"x": 1250, "y": 300},
                     "fields": [], "conditions": [], "config": {"assigneeRole": "WORKER"},
                     "content": "Provision new customer account in core banking system. Assign account number."},
                    {"id": "n-notify-welcome", "type": "notification", "label": "Welcome Email",
                     "position": {"x": 1500, "y": 200},
                     "fields": [], "conditions": [], "config": {"channel": "email"},
                     "content": "Welcome to our platform! Your account has been created. Login credentials have been sent to your registered email."},
                    {"id": "n-reject", "type": "notification", "label": "KYC Rejection",
                     "position": {"x": 1250, "y": 450},
                     "fields": [], "conditions": [], "config": {"channel": "email"},
                     "content": "We were unable to verify your identity. Please visit a branch with original documents."},
                    {"id": "n-end", "type": "end", "label": "End", "position": {"x": 1750, "y": 200}, "fields": [], "conditions": []},
                ],
                "edges": [
                    {"id": "e-0", "source": "n-start", "target": "n-q1"},
                    {"id": "e-1", "source": "n-q1", "target": "n-q2"},
                    {"id": "e-2", "source": "n-q2", "target": "n-task-kyc"},
                    {"id": "e-3", "source": "n-task-kyc", "target": "n-d1"},
                    {"id": "e-4", "source": "n-d1", "target": "n-task-setup", "label": "Passed"},
                    {"id": "e-5", "source": "n-d1", "target": "n-approval", "label": "Needs review"},
                    {"id": "e-6", "source": "n-d1", "target": "n-reject", "label": "Failed"},
                    {"id": "e-7", "source": "n-approval", "target": "n-task-setup"},
                    {"id": "e-8", "source": "n-task-setup", "target": "n-notify-welcome"},
                    {"id": "e-9", "source": "n-notify-welcome", "target": "n-end"},
                    {"id": "e-10", "source": "n-reject", "target": "n-end"},
                ],
            },
            "version": 1,
            "is_active": True,
            "created_by": "user-admin",
            "created_at": "2025-07-01T00:00:00.000Z",
            "updated_at": "2025-07-01T00:00:00.000Z",
        },

        # ── Complete Showcase Flow (All Node Types) ──
        {
            "_id": "flow-employee-onboarding-showcase",
            "name": "Employee Onboarding (All Node Types)",
            "description": "Complete employee onboarding flow showcasing every available node type: Custom Form, Decision, Display, Task, Approval, Notification, Timer, Parallel, Subprocess, and External API Call.",
            "category": "process",
            "definition": {
                "nodes": [
                    # START
                    {"id": "n-start", "type": "start", "label": "Start", "position": {"x": 50, "y": 300}, "fields": [], "conditions": []},

                    # DISPLAY — Welcome info
                    {"id": "n-welcome", "type": "display", "label": "Welcome",
                     "position": {"x": 250, "y": 300},
                     "fields": [], "conditions": [],
                     "content": "Welcome to the Employee Onboarding Portal!\n\nThis guided flow will walk you through:\n• Personal details & ID verification\n• Background check (external API)\n• Equipment & access provisioning\n• Manager approval\n• Welcome notification\n\nPlease have your government ID and emergency contact information ready."},

                    # CUSTOM FORM (question) — Employee details with all field types
                    {"id": "n-q1", "type": "question", "label": "Personal Information",
                     "position": {"x": 500, "y": 300},
                     "fields": [
                         {"id": "f-alert-info", "type": "alert", "label": "Important Notice",
                          "placeholder": "warning", "defaultValue": "All fields marked with * are mandatory. Information provided will be verified against your government ID.",
                          "options": [], "validation": {}, "order": 0},
                         {"id": "f-full-name", "type": "text", "label": "Full Legal Name", "placeholder": "As it appears on your ID",
                          "options": [], "validation": {"required": True, "minLength": 2}, "order": 1},
                         {"id": "f-email", "type": "text", "label": "Personal Email", "placeholder": "you@example.com",
                          "options": [], "validation": {"required": True}, "order": 2},
                         {"id": "f-dob", "type": "date", "label": "Date of Birth",
                          "options": [], "validation": {"required": True}, "order": 3},
                         {"id": "f-phone", "type": "text", "label": "Phone Number", "placeholder": "+1 (555) 123-4567",
                          "options": [], "validation": {"required": True}, "order": 4},
                         {"id": "f-department", "type": "select", "label": "Department",
                          "options": [
                              {"label": "Engineering", "value": "engineering"},
                              {"label": "Marketing", "value": "marketing"},
                              {"label": "Sales", "value": "sales"},
                              {"label": "Human Resources", "value": "hr"},
                              {"label": "Finance", "value": "finance"},
                          ], "validation": {"required": True}, "order": 5},
                         {"id": "f-role-level", "type": "radio", "label": "Role Level",
                          "options": [
                              {"label": "Junior (0-2 years)", "value": "junior"},
                              {"label": "Mid-level (3-5 years)", "value": "mid"},
                              {"label": "Senior (6-10 years)", "value": "senior"},
                              {"label": "Lead / Principal (10+ years)", "value": "lead"},
                          ], "validation": {"required": True}, "order": 6},
                         {"id": "f-salary-expected", "type": "number", "label": "Expected Annual Salary (USD)",
                          "placeholder": "e.g. 85000",
                          "options": [], "validation": {"required": True, "minValue": 30000, "maxValue": 500000}, "order": 7},
                         {"id": "f-remote", "type": "checkbox", "label": "I will be working remotely",
                          "options": [], "validation": {}, "order": 8},
                         {"id": "f-skills", "type": "multi_select", "label": "Key Skills",
                          "options": [
                              {"label": "Python", "value": "python"},
                              {"label": "JavaScript", "value": "javascript"},
                              {"label": "Java", "value": "java"},
                              {"label": "DevOps", "value": "devops"},
                              {"label": "Data Science", "value": "data_science"},
                              {"label": "Project Management", "value": "pm"},
                          ], "validation": {}, "order": 9},
                         {"id": "f-bio", "type": "textarea", "label": "Short Bio",
                          "placeholder": "Tell us about yourself in a few sentences...",
                          "helpText": "This will appear on your internal profile page.",
                          "options": [], "validation": {"maxLength": 500}, "order": 10},
                         {"id": "f-id-upload", "type": "file", "label": "Upload Government ID",
                          "options": [], "validation": {"required": True}, "order": 11},
                     ],
                     "conditions": [], "config": {
                         "alertMessage": "Please provide accurate information. It will be cross-checked during background verification.",
                         "alertType": "info",
                     }},

                    # DECISION — Route based on role level
                    {"id": "n-d1", "type": "decision", "label": "Senior Role?",
                     "position": {"x": 750, "y": 300},
                     "fields": [],
                     "conditions": [
                         {"id": "c-senior", "label": "Senior/Lead", "fieldId": "f-role-level", "operator": "in", "value": ["senior", "lead"], "targetNodeId": "n-approval-vp"},
                     ],
                     "defaultTarget": "n-api-bgcheck", "config": {}},

                    # APPROVAL — VP approval for senior hires
                    {"id": "n-approval-vp", "type": "approval", "label": "VP Approval Required",
                     "position": {"x": 1000, "y": 150},
                     "fields": [], "conditions": [],
                     "config": {"assigneeRole": "MANAGER", "approvalType": "single"},
                     "content": "This candidate is applying for a Senior/Lead role. VP approval is required before proceeding with background check."},

                    # EXTERNAL API CALL — Background check
                    {"id": "n-api-bgcheck", "type": "api_call", "label": "Background Check API",
                     "position": {"x": 1250, "y": 300},
                     "fields": [], "conditions": [],
                     "config": {
                         "apiMode": "automatic",
                         "apiMethod": "POST",
                         "apiUrl": "https://api.bgcheck-provider.com/v2/verify",
                         "apiHeaders": [
                             {"key": "Authorization", "value": "Bearer {{API_KEY}}"},
                             {"key": "Content-Type", "value": "application/json"},
                             {"key": "X-Request-ID", "value": "{response.executionId}"},
                         ],
                         "apiBody": "{\n  \"fullName\": \"{response.f-full-name}\",\n  \"email\": \"{response.f-email}\",\n  \"dateOfBirth\": \"{response.f-dob}\",\n  \"checkType\": \"comprehensive\"\n}",
                         "apiResponseMappings": [
                             {"expression": "{response.data.status}", "variableName": "bgcheck_status"},
                             {"expression": "{response.data.referenceId}", "variableName": "bgcheck_ref"},
                             {"expression": "{response.data.riskScore}", "variableName": "bgcheck_risk_score"},
                             {"expression": "{response.data.criminal.clear}", "variableName": "criminal_clear"},
                             {"expression": "{response.data.education.verified}", "variableName": "edu_verified"},
                         ],
                     },
                     "content": "Runs an automated background verification check against third-party provider. Results are captured and stored for compliance."},

                    # TIMER — Wait for background check results
                    {"id": "n-timer-wait", "type": "timer", "label": "Wait for Results",
                     "position": {"x": 1500, "y": 300},
                     "fields": [], "conditions": [],
                     "config": {"durationMinutes": 1440, "timerType": "delay"},
                     "content": None},

                    # DECISION — Check background result
                    {"id": "n-d2", "type": "decision", "label": "BG Check Passed?",
                     "position": {"x": 1750, "y": 300},
                     "fields": [],
                     "conditions": [
                         {"id": "c-bg-pass", "label": "Passed", "fieldId": "bgcheck_status", "operator": "equals", "value": "clear", "targetNodeId": "n-parallel"},
                         {"id": "c-bg-fail", "label": "Failed", "fieldId": "bgcheck_status", "operator": "equals", "value": "flagged", "targetNodeId": "n-notify-reject"},
                     ],
                     "defaultTarget": "n-parallel", "config": {}},

                    # NOTIFICATION — Rejection
                    {"id": "n-notify-reject", "type": "notification", "label": "Rejection Notice",
                     "position": {"x": 2000, "y": 500},
                     "fields": [], "conditions": [],
                     "config": {"channel": "email", "recipientRole": ""},
                     "content": "Unfortunately, your application did not pass the background verification. Please contact HR for more information. Reference: {response.bgcheck_ref}"},

                    # PARALLEL — Equipment + IT Access provisioning
                    {"id": "n-parallel", "type": "parallel", "label": "Provision Equipment & Access",
                     "position": {"x": 2000, "y": 300},
                     "fields": [], "conditions": [],
                     "config": {"joinType": "all"}},

                    # TASK — IT access setup (branch 1)
                    {"id": "n-task-it", "type": "task", "label": "IT Access Setup",
                     "position": {"x": 2250, "y": 200},
                     "fields": [], "conditions": [],
                     "config": {"assigneeRole": "WORKER"},
                     "content": "Create Active Directory account, provision email, set up VPN access, and assign security groups based on department."},

                    # TASK — Equipment ordering (branch 2)
                    {"id": "n-task-equip", "type": "task", "label": "Order Equipment",
                     "position": {"x": 2250, "y": 400},
                     "fields": [], "conditions": [],
                     "config": {"assigneeRole": "WORKER"},
                     "content": "Order laptop, monitors, peripherals, and office supplies. Ship to office or home address if remote."},

                    # EXTERNAL API CALL — Create Slack account (manual trigger)
                    {"id": "n-api-slack", "type": "api_call", "label": "Create Slack Account",
                     "position": {"x": 2500, "y": 300},
                     "fields": [], "conditions": [],
                     "config": {
                         "apiMode": "manual",
                         "apiMethod": "POST",
                         "apiUrl": "https://slack.com/api/admin.users.invite",
                         "apiHeaders": [
                             {"key": "Authorization", "value": "Bearer xoxb-slack-bot-token"},
                             {"key": "Content-Type", "value": "application/json"},
                         ],
                         "apiBody": "{\n  \"email\": \"{response.f-email}\",\n  \"real_name\": \"{response.f-full-name}\",\n  \"channels\": [\"C-general\", \"C-{response.f-department}\"]\n}",
                         "apiResponseMappings": [
                             {"expression": "{response.ok}", "variableName": "slack_created"},
                             {"expression": "{response.user.id}", "variableName": "slack_user_id"},
                         ],
                     },
                     "content": "Invite the new employee to the company Slack workspace and add them to relevant department channels."},

                    # SUBPROCESS — Link to separate compliance training flow
                    {"id": "n-subprocess", "type": "subprocess", "label": "Compliance Training",
                     "position": {"x": 2750, "y": 300},
                     "fields": [], "conditions": [],
                     "linkedFlowId": "flow-health-assessment",
                     "config": {}},

                    # NOTIFICATION — Welcome
                    {"id": "n-notify-welcome", "type": "notification", "label": "Welcome Email",
                     "position": {"x": 3000, "y": 300},
                     "fields": [], "conditions": [],
                     "config": {"channel": "email", "recipientRole": ""},
                     "content": "Welcome aboard, {response.f-full-name}! 🎉\n\nYour accounts have been provisioned:\n• Email: {response.f-full-name}@company.com\n• Slack ID: {response.slack_user_id}\n• Department: {response.f-department}\n\nYour equipment will arrive within 3-5 business days. Please complete the compliance training linked in your portal."},

                    # END
                    {"id": "n-end", "type": "end", "label": "Onboarding Complete", "position": {"x": 3250, "y": 300}, "fields": [], "conditions": []},
                ],
                "edges": [
                    {"id": "e-0", "source": "n-start", "target": "n-welcome"},
                    {"id": "e-1", "source": "n-welcome", "target": "n-q1"},
                    {"id": "e-2", "source": "n-q1", "target": "n-d1"},
                    {"id": "e-3", "source": "n-d1", "target": "n-approval-vp", "label": "Senior/Lead"},
                    {"id": "e-4", "source": "n-d1", "target": "n-api-bgcheck", "label": "default"},
                    {"id": "e-5", "source": "n-approval-vp", "target": "n-api-bgcheck"},
                    {"id": "e-6", "source": "n-api-bgcheck", "target": "n-timer-wait"},
                    {"id": "e-7", "source": "n-timer-wait", "target": "n-d2"},
                    {"id": "e-8", "source": "n-d2", "target": "n-parallel", "label": "Passed"},
                    {"id": "e-9", "source": "n-d2", "target": "n-notify-reject", "label": "Failed"},
                    {"id": "e-10", "source": "n-parallel", "target": "n-task-it"},
                    {"id": "e-11", "source": "n-parallel", "target": "n-task-equip"},
                    {"id": "e-12", "source": "n-task-it", "target": "n-api-slack"},
                    {"id": "e-13", "source": "n-task-equip", "target": "n-api-slack"},
                    {"id": "e-14", "source": "n-api-slack", "target": "n-subprocess"},
                    {"id": "e-15", "source": "n-subprocess", "target": "n-notify-welcome"},
                    {"id": "e-16", "source": "n-notify-welcome", "target": "n-end"},
                    {"id": "e-17", "source": "n-notify-reject", "target": "n-end"},
                ],
            },
            "version": 1,
            "is_active": True,
            "created_by": "user-admin",
            "created_at": "2025-08-01T00:00:00.000Z",
            "updated_at": "2025-08-01T00:00:00.000Z",
        },
    ]
    await db.flow_definitions.insert_many(flow_definitions)

async def _insert_all(db):
    now = datetime.now(timezone.utc).isoformat()
    sla_30 = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    sla_20 = (datetime.now(timezone.utc) + timedelta(days=20)).isoformat()
    sla_15 = (datetime.now(timezone.utc) + timedelta(days=15)).isoformat()

    # ─── Users ──────────────────────────────────
    users = [
        {"_id": "user-1", "email": "alice@example.com", "name": "Alice Johnson", "role": "MANAGER",
         "team_ids": ["team-1", "team-2"], "hashed_password": hash_password("demo123"),
         "avatar": None, "is_active": True, "created_at": "2025-01-01T00:00:00.000Z"},
        {"_id": "user-2", "email": "bob@example.com", "name": "Bob Smith", "role": "WORKER",
         "team_ids": ["team-1", "team-3"], "hashed_password": hash_password("demo123"),
         "avatar": None, "is_active": True, "created_at": "2025-02-15T00:00:00.000Z"},
        {"_id": "user-3", "email": "carol@example.com", "name": "Carol Davis", "role": "WORKER",
         "team_ids": ["team-2", "team-3"], "hashed_password": hash_password("demo123"),
         "avatar": None, "is_active": True, "created_at": "2025-03-10T00:00:00.000Z"},
        {"_id": "user-admin", "email": "admin@example.com", "name": "Admin User", "role": "ADMIN",
         "team_ids": ["team-1", "team-2", "team-3"], "hashed_password": hash_password("admin123"),
         "avatar": None, "is_active": True, "created_at": "2025-01-01T00:00:00.000Z"},
    ]
    await db.users.insert_many(users)

    # ─── Teams ──────────────────────────────────
    teams = [
        {"_id": "team-1", "name": "Loan Processing", "description": "Handles all loan origination cases",
         "member_ids": ["user-1", "user-2", "user-admin"], "created_at": "2025-01-01T00:00:00.000Z"},
        {"_id": "team-2", "name": "Customer Onboarding", "description": "KYC and new customer onboarding",
         "member_ids": ["user-1", "user-3", "user-admin"], "created_at": "2025-01-01T00:00:00.000Z"},
        {"_id": "team-3", "name": "Claims Department", "description": "Insurance claims processing and review",
         "member_ids": ["user-2", "user-3", "user-admin"], "created_at": "2025-01-01T00:00:00.000Z"},
    ]
    await db.teams.insert_many(teams)

    # ═══════════════════════════════════════════════════════════
    # CASE TYPE DEFINITIONS (hierarchical blueprints)
    # ═══════════════════════════════════════════════════════════

    ct_base = {"icon": "folder", "attachment_categories": [], "case_wide_actions": [],
               "created_by": "user-admin", "created_at": "2025-01-15T00:00:00Z",
               "updated_at": "2025-01-15T00:00:00Z", "version": 1, "is_active": True}

    # ──── 1) Loan Origination ────
    ct_loan = {
        **ct_base,
        "_id": "ct-loan", "name": "Loan Origination", "slug": "loan_origination",
        "description": "End-to-end loan processing workflow", "prefix": "LOAN",
        "field_schema": {
            "loanAmount": {"type": "number", "label": "Loan Amount"},
            "loanType": {"type": "string", "label": "Loan Type"},
            "applicantName": {"type": "string", "label": "Applicant Name"},
            "applicantIncome": {"type": "number", "label": "Annual Income"},
            "creditScore": {"type": "number", "label": "Credit Score"},
            "approvalTier": {"type": "string", "label": "Approval Tier"},
        },
        "stages": [
            _stage("stage-intake", "Intake Review", 1, [
                _proc("proc-intake", "Application Intake", 1, [
                    _step("step-fill-app", "Fill Application", "assignment", 1,
                          config={"assignee_role": "WORKER", "form_id": "form-loan-intake",
                                  "instructions": "Complete the loan application form with all required fields."}, sla_hours=24),
                ]),
            ]),
            _stage("stage-docs", "Document Collection", 2, [
                _proc("proc-docs", "Collect Documents", 1, [
                    _step("step-upload-docs", "Upload Documents", "attachment", 1,
                          config={"required_categories": ["income", "identity"],
                                  "instructions": "Upload income verification and identity documents."}, sla_hours=72),
                    _step("step-verify-docs", "Verify Documents", "assignment", 2,
                          config={"assignee_role": "WORKER",
                                  "instructions": "Review all uploaded documents for completeness and authenticity."}, sla_hours=24),
                ]),
            ]),
            _stage("stage-underwriting", "Underwriting", 3, [
                _proc("proc-risk", "Risk Assessment", 1, [
                    _step("step-auto-credit", "Auto Credit Check (Webhook)", "automation", 1,
                          config={
                              "actions": [
                                  {"type": "set_field", "config": {"field": "creditChecked", "value": True}},
                                  {"type": "call_webhook", "config": {
                                      "url": "https://api.stub.example.com/credit-check",
                                      "method": "POST",
                                      "headers": {"Authorization": "Bearer stub-token-123"},
                                  }},
                              ],
                              "webhook": {
                                  "url": "https://api.stub.example.com/credit-check",
                                  "method": "POST",
                                  "headers": {"Authorization": "Bearer stub-token-123", "Content-Type": "application/json"},
                                  "body_template": {"applicant_name": "{{applicantName}}", "income": "{{applicantIncome}}"},
                                  "response_map": {"creditScore": "score", "approvalTier": "tier"},
                              },
                          }),
                    _step("step-risk-review", "Risk Review", "assignment", 2,
                          config={"assignee_role": "MANAGER",
                                  "instructions": "Review credit check results and assess overall risk profile."}, sla_hours=48),
                ]),
                _proc("proc-decision", "Approval Decision", 2, [
                    _step("step-routing-decision", "Loan Routing (Decision Table)", "decision", 1,
                          config={"mode": "decision_table",
                                  "decision_table_id": "dt-loan-routing",
                                  "field_mapping": {
                                      "loan_amount": "f-amount",
                                      "loan_type": "f-loan-type",
                                      "applicant_income": "f-income",
                                  }}),
                    _step("step-amount-check", "Amount Decision", "decision", 2,
                          config={"mode": "first_match", "branches": [
                              {"id": "branch-high", "label": "High Value (>100K)",
                               "condition": {"field": "f-amount", "operator": "gt", "value": 100000},
                               "next_step_id": "step-vp-approval"},
                              {"id": "branch-standard", "label": "Standard (<=100K)",
                               "condition": {"field": "f-amount", "operator": "lte", "value": 100000},
                               "next_step_id": "step-mgr-approval"},
                          ], "default_step_id": "step-mgr-approval"}),
                    _step("step-mgr-approval", "Manager Approval", "approval", 3,
                          config={"mode": "sequential",
                                  "approver_roles": ["MANAGER"],
                                  "approver_user_ids": ["user-1"],
                                  "allow_delegation": True,
                                  "rejection_stage_id": "stage-rejected",
                                  "instructions": "Review loan details and approve or reject."}),
                    _step("step-vp-approval", "VP Approval", "approval", 4,
                          config={"mode": "sequential",
                                  "approver_roles": ["MANAGER", "ADMIN"],
                                  "approver_user_ids": ["user-1", "user-admin"],
                                  "allow_delegation": True,
                                  "rejection_stage_id": "stage-rejected",
                                  "instructions": "Executive review required for high-value loans."}),
                ]),
            ]),
            _stage("stage-compliance", "Compliance Review", 4, [
                _proc("proc-compliance", "Compliance Subprocess", 1, [
                    _step("step-compliance-check", "AML/KYC Compliance Check", "subprocess", 1,
                          config={
                              "child_case_type_id": "ct-kyc",
                              "wait_for_resolution": True,
                              "field_mapping": {
                                  "applicantName": "customerName",
                                  "loanType": "accountType",
                              },
                              "propagate_fields": {
                                  "riskLevel": "complianceRiskLevel",
                                  "riskCleared": "complianceCleared",
                              },
                          }),
                    _step("step-compliance-review", "Compliance Sign-off", "assignment", 2,
                          config={"assignee_role": "MANAGER",
                                  "instructions": "Review compliance check results and sign off."}),
                ]),
            ]),
            _stage("stage-disburse", "Disbursement", 5, [
                _proc("proc-disburse", "Disbursement Process", 1, [
                    _step("step-send-funds", "Process Disbursement", "assignment", 1,
                          config={"assignee_role": "WORKER"}, sla_hours=48),
                    _step("step-confirm-notify", "Confirmation Notification", "automation", 2,
                          config={"actions": [{"type": "send_notification",
                                               "config": {"title": "Loan Disbursed", "message": "Your loan has been disbursed."}}]}),
                ]),
            ], on_complete="resolve_case", resolution_status="resolved_completed"),
            # Alternate stages
            _stage("stage-rejected", "Rejected", 10, [
                _proc("proc-reject-notify", "Rejection Notification", 1, [
                    _step("step-reject-notify", "Send Rejection", "automation", 1,
                          config={"actions": [{"type": "send_notification",
                                               "config": {"title": "Loan Rejected", "message": "Your loan application has been rejected."}}]}),
                ]),
            ], stage_type="alternate", on_complete="resolve_case", resolution_status="resolved_rejected"),
        ],
    }

    # ──── 2) Customer Onboarding (KYC) ────
    ct_kyc = {
        **ct_base,
        "_id": "ct-kyc", "name": "Customer Onboarding", "slug": "customer_onboarding",
        "description": "KYC verification and new customer account setup", "prefix": "KYC",
        "field_schema": {
            "customerName": {"type": "string", "label": "Customer Name"},
            "accountType": {"type": "string", "label": "Account Type"},
            "riskLevel": {"type": "string", "label": "Risk Level"},
        },
        "stages": [
            _stage("stage-app-review", "Application Review", 1, [
                _proc("proc-app-review", "Review Application", 1, [
                    _step("step-kyc-form", "KYC Application Form", "assignment", 1,
                          config={"assignee_role": "WORKER", "form_id": "form-kyc-intake"}, sla_hours=12),
                ]),
            ]),
            _stage("stage-id-verify", "Identity Verification", 2, [
                _proc("proc-id-verify", "Verify Identity", 1, [
                    _step("step-upload-id", "Upload ID Documents", "attachment", 1,
                          config={"required_categories": ["identity"]}, sla_hours=48),
                    _step("step-verify-id", "Verify Identity", "assignment", 2,
                          config={"assignee_role": "WORKER"}, sla_hours=24),
                ]),
            ]),
            _stage("stage-risk", "Risk Assessment", 3, [
                _proc("proc-risk-assess", "Assess Risk", 1, [
                    _step("step-risk-decision", "Risk Level Decision", "decision", 1,
                          config={"mode": "first_match", "branches": [
                              {"id": "branch-high-risk", "label": "High Risk",
                               "condition": {"field": "riskLevel", "operator": "eq", "value": "high"},
                               "next_step_id": "step-edd"},
                              {"id": "branch-low-risk", "label": "Low/Medium Risk",
                               "condition": {"field": "riskLevel", "operator": "in", "value": ["low", "medium"]},
                               "next_step_id": "step-auto-clear"},
                          ], "default_step_id": "step-edd"}),
                    _step("step-auto-clear", "Auto Clear", "automation", 2,
                          config={"actions": [{"type": "set_field", "config": {"field": "riskCleared", "value": True}}]}),
                    _step("step-edd", "Enhanced Due Diligence", "assignment", 3,
                          config={"assignee_role": "MANAGER"}, sla_hours=72),
                ]),
            ]),
            _stage("stage-acct-setup", "Account Setup", 4, [
                _proc("proc-acct-setup", "Setup Account", 1, [
                    _step("step-create-acct", "Create Account", "assignment", 1,
                          config={"assignee_role": "WORKER"}, sla_hours=24),
                ]),
            ]),
            _stage("stage-welcome", "Welcome", 5, [
                _proc("proc-welcome", "Welcome Process", 1, [
                    _step("step-welcome-notify", "Send Welcome Pack", "automation", 1,
                          config={"actions": [{"type": "send_notification",
                                               "config": {"title": "Welcome!", "message": "Your account is ready."}}]}),
                ]),
            ], on_complete="resolve_case", resolution_status="resolved_completed"),
        ],
    }

    # ──── 3) Insurance Claims ────
    ct_claims = {
        **ct_base,
        "_id": "ct-claims", "name": "Insurance Claims", "slug": "insurance_claims",
        "description": "Process and adjudicate insurance claims", "prefix": "CLM",
        "field_schema": {
            "claimantName": {"type": "string", "label": "Claimant Name"},
            "claimType": {"type": "string", "label": "Claim Type"},
            "claimAmount": {"type": "number", "label": "Claim Amount"},
            "policyNumber": {"type": "string", "label": "Policy Number"},
        },
        "stages": [
            _stage("stage-claim-intake", "Claim Intake", 1, [
                _proc("proc-claim-intake", "Record Claim", 1, [
                    _step("step-claim-form", "Submit Claim Form", "assignment", 1,
                          config={"assignee_role": "WORKER", "form_id": "form-claims-intake"}, sla_hours=8),
                ]),
            ]),
            _stage("stage-investigation", "Investigation", 2, [
                _proc("proc-investigate", "Investigate Claim", 1, [
                    _step("step-gather-evidence", "Gather Evidence", "assignment", 1,
                          config={"assignee_role": "WORKER"}, sla_hours=96),
                    _step("step-upload-evidence", "Upload Evidence Docs", "attachment", 2,
                          config={"required_categories": ["evidence", "reports"]}),
                ]),
            ]),
            _stage("stage-adjudicate", "Adjudication", 3, [
                _proc("proc-adjudicate", "Adjudicate Claim", 1, [
                    _step("step-adjudicate-decision", "Coverage Decision", "decision", 1,
                          config={"mode": "first_match", "branches": [
                              {"id": "branch-high-claim", "label": "High Value Claim",
                               "condition": {"field": "claimAmount", "operator": "gt", "value": 50000},
                               "next_step_id": "step-senior-review"},
                              {"id": "branch-normal", "label": "Standard Claim",
                               "condition": {"field": "claimAmount", "operator": "lte", "value": 50000},
                               "next_step_id": "step-mgr-adjudicate"},
                          ], "default_step_id": "step-mgr-adjudicate"}),
                    _step("step-mgr-adjudicate", "Manager Adjudication", "approval", 2,
                          config={"mode": "sequential", "approver_roles": ["MANAGER"],
                                  "on_reject_stage": "stage-denied"}),
                    _step("step-senior-review", "Senior Review", "approval", 3,
                          config={"mode": "sequential", "approver_roles": ["MANAGER", "ADMIN"],
                                  "on_reject_stage": "stage-denied"}),
                ]),
            ]),
            _stage("stage-settlement", "Settlement", 4, [
                _proc("proc-settle", "Process Settlement", 1, [
                    _step("step-calc-payout", "Calculate Payout", "assignment", 1,
                          config={"assignee_role": "WORKER"}, sla_hours=48),
                    _step("step-issue-payment", "Issue Payment", "assignment", 2,
                          config={"assignee_role": "WORKER"}, sla_hours=24),
                ]),
            ]),
            _stage("stage-closure", "Closure", 5, [
                _proc("proc-closure", "Close Claim", 1, [
                    _step("step-close-notify", "Send Closure Notification", "automation", 1,
                          config={"actions": [{"type": "send_notification",
                                               "config": {"title": "Claim Closed", "message": "Your claim has been resolved."}}]}),
                ]),
            ], on_complete="resolve_case", resolution_status="resolved_completed"),
            # Alternate: denied
            _stage("stage-denied", "Denied", 10, [
                _proc("proc-deny-notify", "Denial Notification", 1, [
                    _step("step-deny-notify", "Send Denial Notice", "automation", 1,
                          config={"actions": [{"type": "send_notification",
                                               "config": {"title": "Claim Denied", "message": "Your claim has been denied."}}]}),
                ]),
            ], stage_type="alternate", on_complete="resolve_case", resolution_status="resolved_rejected"),
        ],
    }

    # ──── 4) Credit Card Stolen Transaction ────
    ct_cc_stolen = {
        **ct_base,
        "_id": "ct-cc-stolen", "name": "Credit Card Stolen Transaction", "slug": "cc_stolen_transaction",
        "description": "Report and investigate unauthorized transactions from a stolen credit card",
        "prefix": "CCS", "icon": "credit_card_off",
        "field_schema": {
            "cardholderName": {"type": "string", "label": "Cardholder Name"},
            "cardLastFour": {"type": "string", "label": "Card Last 4 Digits"},
            "cardType": {"type": "string", "label": "Card Type"},
            "totalDisputedAmount": {"type": "number", "label": "Total Disputed Amount"},
            "fraudConfirmed": {"type": "boolean", "label": "Fraud Confirmed"},
            "replacementCardIssued": {"type": "boolean", "label": "Replacement Card Issued"},
        },
        "stages": [
            _stage("stg-report", "Report & Card Block", 1, [
                _proc("proc-report-incident", "Report Incident", 1, [
                    _step("stp-incident-details", "Incident Details", "assignment", 1,
                          config={
                              "assignee_role": "WORKER",
                              "instructions": "Collect details about the stolen card incident from the cardholder.",
                              "form_fields": [
                                  {"id": "ff-cardholder", "type": "text", "label": "Cardholder Full Name", "placeholder": "As it appears on the card", "default_value": "", "validation": {"required": True, "minLength": 2, "maxLength": 100}, "order": 1, "section": ""},
                                  {"id": "ff-card-last4", "type": "text", "label": "Card Last 4 Digits", "placeholder": "e.g. 4829", "default_value": "", "validation": {"required": True, "pattern": "^\\d{4}$"}, "order": 2, "section": ""},
                                  {"id": "ff-card-type", "type": "select", "label": "Card Type", "placeholder": "", "default_value": "", "validation": {"required": True, "options": ["Visa", "Mastercard", "Amex", "Discover"]}, "order": 3, "section": ""},
                                  {"id": "ff-stolen-date", "type": "date", "label": "Date Card Was Stolen / Lost", "placeholder": "", "default_value": "", "validation": {"required": True}, "order": 4, "section": ""},
                                  {"id": "ff-discovery-date", "type": "date", "label": "Date Unauthorized Charge Discovered", "placeholder": "", "default_value": "", "validation": {"required": True}, "order": 5, "section": ""},
                                  {"id": "ff-incident-desc", "type": "textarea", "label": "Describe How the Card Was Stolen", "placeholder": "Wallet theft, mail theft, skimming, etc.", "default_value": "", "validation": {"required": True, "minLength": 20}, "order": 6, "section": ""},
                                  {"id": "ff-police-filed", "type": "radio", "label": "Has a Police Report Been Filed?", "placeholder": "", "default_value": "", "validation": {"required": True, "options": ["Yes", "No", "Will file soon"]}, "order": 7, "section": ""},
                                  {"id": "ff-police-number", "type": "text", "label": "Police Report Number", "placeholder": "If available", "default_value": "", "validation": {"required": False}, "order": 8, "section": ""},
                              ],
                          }, sla_hours=4),
                    _step("stp-block-card", "Block Card & Issue Replacement", "automation", 2,
                          config={
                              "actions": [
                                  {"type": "set_field", "config": {"field": "replacementCardIssued", "value": True}},
                                  {"type": "send_notification", "config": {"title": "Card Blocked", "message": "Your stolen card has been blocked. A replacement will be mailed within 5-7 business days."}},
                              ],
                          }),
                ]),
            ]),
            _stage("stg-investigate", "Fraud Investigation", 2, [
                _proc("proc-review-txns", "Review Transactions", 1, [
                    _step("stp-flag-transactions", "Flag Unauthorized Transactions", "assignment", 1,
                          config={
                              "assignee_role": "WORKER",
                              "instructions": "Review the cardholder's recent statement and flag all unauthorized transactions.",
                              "form_fields": [
                                  {"id": "ff-txn-count", "type": "number", "label": "Number of Unauthorized Transactions", "placeholder": "e.g. 5", "default_value": "", "validation": {"required": True, "minValue": 1}, "order": 1, "section": ""},
                                  {"id": "ff-total-amount", "type": "number", "label": "Total Disputed Amount ($)", "placeholder": "e.g. 2450.00", "default_value": "", "validation": {"required": True, "minValue": 0.01}, "order": 2, "section": ""},
                                  {"id": "ff-largest-txn", "type": "number", "label": "Largest Single Transaction ($)", "placeholder": "e.g. 899.99", "default_value": "", "validation": {"required": True, "minValue": 0.01}, "order": 3, "section": ""},
                                  {"id": "ff-merchant-list", "type": "textarea", "label": "Merchant Names & Amounts", "placeholder": "List each merchant and amount on a new line", "default_value": "", "validation": {"required": True, "minLength": 10}, "order": 4, "section": ""},
                                  {"id": "ff-txn-location", "type": "select", "label": "Transaction Location Pattern", "placeholder": "", "default_value": "", "validation": {"required": True, "options": ["Same city as cardholder", "Different city", "Different state", "International", "Online only", "Mixed"]}, "order": 5, "section": ""},
                                  {"id": "ff-card-present", "type": "radio", "label": "Were Transactions Card-Present or Card-Not-Present?", "placeholder": "", "default_value": "", "validation": {"required": True, "options": ["Card-Present (physical swipe/tap)", "Card-Not-Present (online/phone)", "Both"]}, "order": 6, "section": ""},
                              ],
                          }, sla_hours=48),
                    _step("stp-upload-evidence", "Upload Supporting Evidence", "attachment", 2,
                          config={"required_categories": ["statement", "police_report"],
                                  "instructions": "Upload the flagged bank statement and police report if available.",
                                  "max_file_size_mb": 25}, sla_hours=72),
                ]),
                _proc("proc-fraud-decision", "Fraud Determination", 2, [
                    _step("stp-fraud-decision", "Fraud Determination", "decision", 1,
                          config={"mode": "first_match", "branches": [
                              {"id": "br-high-value", "label": "High Value Fraud (>$5,000)",
                               "condition": {"field": "totalDisputedAmount", "operator": "gt", "value": 5000},
                               "next_step_id": "stp-senior-review"},
                              {"id": "br-standard", "label": "Standard Fraud (≤$5,000)",
                               "condition": {"field": "totalDisputedAmount", "operator": "lte", "value": 5000},
                               "next_step_id": "stp-mgr-review"},
                          ], "default_step_id": "stp-mgr-review"}),
                    _step("stp-mgr-review", "Manager Fraud Review", "approval", 2,
                          config={"mode": "sequential", "approver_roles": ["MANAGER"],
                                  "allow_delegation": True, "rejection_stage_id": "stg-denied",
                                  "instructions": "Review flagged transactions and approve or deny the fraud claim."}),
                    _step("stp-senior-review", "Senior Fraud Review", "approval", 3,
                          config={"mode": "sequential", "approver_roles": ["MANAGER", "ADMIN"],
                                  "allow_delegation": True, "rejection_stage_id": "stg-denied",
                                  "instructions": "Executive review required for high-value stolen card claims."}),
                ]),
            ]),
            _stage("stg-resolution", "Resolution & Refund", 3, [
                _proc("proc-refund", "Process Refund", 1, [
                    _step("stp-process-refund", "Issue Provisional Credit", "assignment", 1,
                          config={
                              "assignee_role": "WORKER",
                              "instructions": "Issue provisional credit to the cardholder's account.",
                              "form_fields": [
                                  {"id": "ff-refund-amount", "type": "number", "label": "Refund Amount ($)", "placeholder": "Amount to credit", "default_value": "", "validation": {"required": True, "minValue": 0.01}, "order": 1, "section": ""},
                                  {"id": "ff-refund-method", "type": "select", "label": "Refund Method", "placeholder": "", "default_value": "", "validation": {"required": True, "options": ["Provisional Credit", "Permanent Credit", "Check", "Wire Transfer"]}, "order": 2, "section": ""},
                                  {"id": "ff-refund-notes", "type": "textarea", "label": "Refund Notes", "placeholder": "Any additional notes for the refund", "default_value": "", "validation": {"required": False}, "order": 3, "section": ""},
                              ],
                          }, sla_hours=24),
                    _step("stp-close-notify", "Send Resolution Notification", "automation", 2,
                          config={"actions": [{"type": "send_notification",
                                               "config": {"title": "Stolen Card Claim Resolved",
                                                          "message": "Your stolen card fraud claim has been resolved. A provisional credit has been applied to your account."}}]}),
                ]),
            ], on_complete="resolve_case", resolution_status="resolved_completed"),
            _stage("stg-denied", "Claim Denied", 10, [
                _proc("proc-deny", "Denial Process", 1, [
                    _step("stp-deny-notify", "Send Denial Notice", "automation", 1,
                          config={"actions": [{"type": "send_notification",
                                               "config": {"title": "Stolen Card Claim Denied",
                                                          "message": "Your stolen card fraud claim has been denied. Please contact us for further details."}}]}),
                ]),
            ], stage_type="alternate", on_complete="resolve_case", resolution_status="resolved_rejected"),
        ],
    }

    # ──── 5) Credit Card Dispute Transaction ────
    ct_cc_dispute = {
        **ct_base,
        "_id": "ct-cc-dispute", "name": "Credit Card Dispute Transaction", "slug": "cc_dispute_transaction",
        "description": "Dispute a charge on your credit card statement — billing errors, undelivered goods, or service issues",
        "prefix": "CCD", "icon": "gavel",
        "field_schema": {
            "cardholderName": {"type": "string", "label": "Cardholder Name"},
            "cardLastFour": {"type": "string", "label": "Card Last 4 Digits"},
            "merchantName": {"type": "string", "label": "Merchant Name"},
            "disputedAmount": {"type": "number", "label": "Disputed Amount"},
            "disputeReason": {"type": "string", "label": "Dispute Reason"},
            "merchantResponded": {"type": "boolean", "label": "Merchant Responded"},
            "chargebackIssued": {"type": "boolean", "label": "Chargeback Issued"},
        },
        "stages": [
            _stage("stg-intake", "Dispute Intake", 1, [
                _proc("proc-file-dispute", "File Dispute", 1, [
                    _step("stp-dispute-form", "Dispute Details", "assignment", 1,
                          config={
                              "assignee_role": "WORKER",
                              "instructions": "Collect all relevant details about the disputed transaction from the cardholder.",
                              "form_fields": [
                                  {"id": "ff-ch-name", "type": "text", "label": "Cardholder Full Name", "placeholder": "As shown on the card", "default_value": "", "validation": {"required": True, "minLength": 2, "maxLength": 100}, "order": 1, "section": ""},
                                  {"id": "ff-card-last4", "type": "text", "label": "Card Last 4 Digits", "placeholder": "e.g. 7713", "default_value": "", "validation": {"required": True, "pattern": "^\\d{4}$"}, "order": 2, "section": ""},
                                  {"id": "ff-merchant-name", "type": "text", "label": "Merchant Name", "placeholder": "As shown on statement", "default_value": "", "validation": {"required": True}, "order": 3, "section": ""},
                                  {"id": "ff-txn-date", "type": "date", "label": "Transaction Date", "placeholder": "", "default_value": "", "validation": {"required": True}, "order": 4, "section": ""},
                                  {"id": "ff-dispute-amount", "type": "number", "label": "Disputed Amount ($)", "placeholder": "e.g. 399.99", "default_value": "", "validation": {"required": True, "minValue": 0.01}, "order": 5, "section": ""},
                                  {"id": "ff-dispute-reason", "type": "select", "label": "Reason for Dispute", "placeholder": "", "default_value": "", "validation": {"required": True, "options": ["Goods not received", "Goods not as described", "Duplicate charge", "Billing error / wrong amount", "Cancelled but still charged", "Subscription not cancelled", "Service not provided", "Other"]}, "order": 6, "section": ""},
                                  {"id": "ff-reason-details", "type": "textarea", "label": "Detailed Description of Dispute", "placeholder": "Explain the issue in detail — include dates, what was promised vs received, any communication with the merchant.", "default_value": "", "validation": {"required": True, "minLength": 30}, "order": 7, "section": ""},
                                  {"id": "ff-contacted-merchant", "type": "radio", "label": "Have You Contacted the Merchant?", "placeholder": "", "default_value": "", "validation": {"required": True, "options": ["Yes - no resolution", "Yes - partial resolution", "No - unable to reach", "No - not attempted"]}, "order": 8, "section": ""},
                                  {"id": "ff-merchant-response", "type": "textarea", "label": "Merchant Response (if any)", "placeholder": "Summarize what the merchant said", "default_value": "", "validation": {"required": False}, "order": 9, "section": ""},
                              ],
                          }, sla_hours=8),
                    _step("stp-upload-docs", "Upload Supporting Documents", "attachment", 2,
                          config={"required_categories": ["receipt", "correspondence"],
                                  "instructions": "Upload receipts, order confirmations, emails with merchant, or any supporting documentation.",
                                  "max_file_size_mb": 25}, sla_hours=72),
                ]),
            ]),
            _stage("stg-review", "Investigation & Merchant Contact", 2, [
                _proc("proc-investigate", "Investigate Dispute", 1, [
                    _step("stp-verify-charge", "Verify Charge Details", "assignment", 1,
                          config={
                              "assignee_role": "WORKER",
                              "instructions": "Verify the disputed charge details against the merchant's transaction records.",
                              "form_fields": [
                                  {"id": "ff-merchant-id", "type": "text", "label": "Merchant ID / MCC Code", "placeholder": "From transaction processor", "default_value": "", "validation": {"required": True}, "order": 1, "section": ""},
                                  {"id": "ff-auth-code", "type": "text", "label": "Authorization Code", "placeholder": "Transaction auth code", "default_value": "", "validation": {"required": False}, "order": 2, "section": ""},
                                  {"id": "ff-charge-verified", "type": "radio", "label": "Is the Charge Legitimate?", "placeholder": "", "default_value": "", "validation": {"required": True, "options": ["Yes - legitimate charge", "No - charge is invalid", "Inconclusive - needs further review"]}, "order": 3, "section": ""},
                                  {"id": "ff-merchant-contacted", "type": "radio", "label": "Merchant Response to Inquiry", "placeholder": "", "default_value": "", "validation": {"required": True, "options": ["Agrees to refund", "Disputes the claim", "No response within timeframe", "Merchant unreachable"]}, "order": 4, "section": ""},
                                  {"id": "ff-investigator-notes", "type": "textarea", "label": "Investigation Notes", "placeholder": "Summarize findings from investigation", "default_value": "", "validation": {"required": True, "minLength": 20}, "order": 5, "section": ""},
                              ],
                          }, sla_hours=120),
                ]),
                _proc("proc-dispute-decision", "Dispute Decision", 2, [
                    _step("stp-dispute-route", "Dispute Routing", "decision", 1,
                          config={"mode": "first_match", "branches": [
                              {"id": "br-high-amount", "label": "High Value Dispute (>$1,000)",
                               "condition": {"field": "disputedAmount", "operator": "gt", "value": 1000},
                               "next_step_id": "stp-senior-approval"},
                              {"id": "br-standard", "label": "Standard Dispute (≤$1,000)",
                               "condition": {"field": "disputedAmount", "operator": "lte", "value": 1000},
                               "next_step_id": "stp-mgr-approval"},
                          ], "default_step_id": "stp-mgr-approval"}),
                    _step("stp-mgr-approval", "Manager Dispute Approval", "approval", 2,
                          config={"mode": "sequential", "approver_roles": ["MANAGER"],
                                  "allow_delegation": True, "rejection_stage_id": "stg-rejected",
                                  "instructions": "Review dispute investigation and approve or deny the chargeback."}),
                    _step("stp-senior-approval", "Senior Dispute Approval", "approval", 3,
                          config={"mode": "sequential", "approver_roles": ["MANAGER", "ADMIN"],
                                  "allow_delegation": True, "rejection_stage_id": "stg-rejected",
                                  "instructions": "Senior review required for high-value disputes."}),
                ]),
            ]),
            _stage("stg-chargeback", "Chargeback & Resolution", 3, [
                _proc("proc-chargeback", "Process Chargeback", 1, [
                    _step("stp-issue-chargeback", "Issue Chargeback", "assignment", 1,
                          config={
                              "assignee_role": "WORKER",
                              "instructions": "Process the chargeback and issue credit to the cardholder.",
                              "form_fields": [
                                  {"id": "ff-chargeback-amount", "type": "number", "label": "Chargeback Amount ($)", "placeholder": "Amount to charge back", "default_value": "", "validation": {"required": True, "minValue": 0.01}, "order": 1, "section": ""},
                                  {"id": "ff-chargeback-type", "type": "select", "label": "Chargeback Reason Code", "placeholder": "", "default_value": "", "validation": {"required": True, "options": ["4837 - No Cardholder Authorization", "4853 - Goods/Services Not as Described", "4855 - Goods/Services Not Received", "4860 - Credit Not Processed", "4863 - Duplicate Processing"]}, "order": 2, "section": ""},
                                  {"id": "ff-credit-type", "type": "select", "label": "Credit Type", "placeholder": "", "default_value": "", "validation": {"required": True, "options": ["Provisional Credit", "Permanent Credit"]}, "order": 3, "section": ""},
                                  {"id": "ff-resolution-notes", "type": "textarea", "label": "Resolution Summary", "placeholder": "Final notes on dispute resolution", "default_value": "", "validation": {"required": True, "minLength": 10}, "order": 4, "section": ""},
                              ],
                          }, sla_hours=24),
                    _step("stp-resolve-notify", "Send Resolution Notification", "automation", 2,
                          config={"actions": [{"type": "send_notification",
                                               "config": {"title": "Dispute Resolved",
                                                          "message": "Your credit card dispute has been resolved. A credit has been applied to your account."}}]}),
                ]),
            ], on_complete="resolve_case", resolution_status="resolved_completed"),
            _stage("stg-rejected", "Dispute Rejected", 10, [
                _proc("proc-reject", "Rejection Process", 1, [
                    _step("stp-reject-notify", "Send Rejection Notice", "automation", 1,
                          config={"actions": [{"type": "send_notification",
                                               "config": {"title": "Dispute Rejected",
                                                          "message": "Your credit card dispute has been denied. The charge has been deemed valid. You may appeal within 30 days."}}]}),
                ]),
            ], stage_type="alternate", on_complete="resolve_case", resolution_status="resolved_rejected"),
        ],
    }

    await db.case_type_definitions.insert_many([ct_loan, ct_kyc, ct_claims, ct_cc_stolen, ct_cc_dispute])

    # ═══════════════════════════════════════════════════════════
    # COUNTERS (for case ID sequencing)
    # ═══════════════════════════════════════════════════════════
    counters = [
        {"_id": "case_LOAN", "seq": 4},   # 4 loan cases seeded
        {"_id": "case_KYC", "seq": 4},    # 4 KYC cases (includes 1 subprocess child)
        {"_id": "case_CLM", "seq": 3},    # 3 claims cases
        {"_id": "case_CCS", "seq": 2},    # 2 stolen card cases
        {"_id": "case_CCD", "seq": 2},    # 2 dispute cases
    ]
    await db.counters.insert_many(counters)

    # ═══════════════════════════════════════════════════════════
    # CASES (hierarchical runtime instances)
    # ═══════════════════════════════════════════════════════════

    # ── Loan case 1: in Document Collection stage ──
    cases = [
        {
            "_id": "LOAN-001", "case_type_id": "ct-loan", "case_type_name": "Loan Origination",
            "title": "Mortgage - John Doe", "status": "in_progress", "priority": "high",
            "owner_id": "user-1", "team_id": "team-1",
            "custom_fields": {"loanAmount": 250000, "loanType": "Mortgage", "applicantName": "John Doe", "applicantIncome": 85000},
            "current_stage_id": "stage-docs", "current_process_id": "proc-docs", "current_step_id": "step-upload-docs",
            "stages": [
                _rt_stage("stage-intake", "Intake Review", 1, [
                    _rt_proc("proc-intake", "Application Intake", 1, [
                        _rt_step("step-fill-app", "Fill Application", "assignment", 1,
                                 status="completed", started_at="2026-02-01T10:00:00Z",
                                 completed_at="2026-02-02T14:00:00Z", assigned_to="user-2"),
                    ], status="completed", started_at="2026-02-01T10:00:00Z", completed_at="2026-02-02T14:00:00Z"),
                ], status="completed", entered_at="2026-02-01T10:00:00Z",
                   completed_at="2026-02-02T14:00:00Z", completed_by="user-2"),
                _rt_stage("stage-docs", "Document Collection", 2, [
                    _rt_proc("proc-docs", "Collect Documents", 1, [
                        _rt_step("step-upload-docs", "Upload Documents", "attachment", 1,
                                 status="in_progress", started_at="2026-02-02T14:00:00Z"),
                        _rt_step("step-verify-docs", "Verify Documents", "assignment", 2),
                    ], status="in_progress", started_at="2026-02-02T14:00:00Z"),
                ], status="in_progress", entered_at="2026-02-02T14:00:00Z"),
                _rt_stage("stage-underwriting", "Underwriting", 3, [
                    _rt_proc("proc-risk", "Risk Assessment", 1, [
                        _rt_step("step-auto-credit", "Auto Credit Check (Webhook)", "automation", 1),
                        _rt_step("step-risk-review", "Risk Review", "assignment", 2),
                    ]),
                    _rt_proc("proc-decision", "Approval Decision", 2, [
                        _rt_step("step-routing-decision", "Loan Routing (Decision Table)", "decision", 1),
                        _rt_step("step-amount-check", "Amount Decision", "decision", 2),
                        _rt_step("step-mgr-approval", "Manager Approval", "approval", 3),
                        _rt_step("step-vp-approval", "VP Approval", "approval", 4),
                    ]),
                ]),
                _rt_stage("stage-compliance", "Compliance Review", 4, [
                    _rt_proc("proc-compliance", "Compliance Subprocess", 1, [
                        _rt_step("step-compliance-check", "AML/KYC Compliance Check", "subprocess", 1),
                        _rt_step("step-compliance-review", "Compliance Sign-off", "assignment", 2),
                    ]),
                ]),
                _rt_stage("stage-disburse", "Disbursement", 5, [
                    _rt_proc("proc-disburse", "Disbursement Process", 1, [
                        _rt_step("step-send-funds", "Process Disbursement", "assignment", 1),
                        _rt_step("step-confirm-notify", "Confirmation Notification", "automation", 2),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-1", "created_at": "2026-02-01T10:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_30, "sla_days_remaining": 25, "escalation_level": 0,
        },

        # ── Loan case 2: in Underwriting (risk review step) ──
        {
            "_id": "LOAN-002", "case_type_id": "ct-loan", "case_type_name": "Loan Origination",
            "title": "Personal Loan - Jane Smith", "status": "in_progress", "priority": "medium",
            "owner_id": "user-2", "team_id": "team-1",
            "custom_fields": {"loanAmount": 50000, "loanType": "Personal", "applicantName": "Jane Smith", "applicantIncome": 62000, "creditChecked": True},
            "current_stage_id": "stage-underwriting", "current_process_id": "proc-risk", "current_step_id": "step-risk-review",
            "stages": [
                _rt_stage("stage-intake", "Intake Review", 1, [
                    _rt_proc("proc-intake", "Application Intake", 1, [
                        _rt_step("step-fill-app", "Fill Application", "assignment", 1,
                                 status="completed", started_at="2026-01-20T09:00:00Z",
                                 completed_at="2026-01-20T11:00:00Z", assigned_to="user-2"),
                    ], status="completed", started_at="2026-01-20T09:00:00Z", completed_at="2026-01-20T11:00:00Z"),
                ], status="completed", entered_at="2026-01-20T09:00:00Z",
                   completed_at="2026-01-20T11:00:00Z", completed_by="user-2"),
                _rt_stage("stage-docs", "Document Collection", 2, [
                    _rt_proc("proc-docs", "Collect Documents", 1, [
                        _rt_step("step-upload-docs", "Upload Documents", "attachment", 1,
                                 status="completed", started_at="2026-01-20T11:00:00Z",
                                 completed_at="2026-01-22T10:00:00Z"),
                        _rt_step("step-verify-docs", "Verify Documents", "assignment", 2,
                                 status="completed", started_at="2026-01-22T10:00:00Z",
                                 completed_at="2026-01-22T16:00:00Z", assigned_to="user-2"),
                    ], status="completed", started_at="2026-01-20T11:00:00Z", completed_at="2026-01-22T16:00:00Z"),
                ], status="completed", entered_at="2026-01-20T11:00:00Z",
                   completed_at="2026-01-22T16:00:00Z", completed_by="user-2"),
                _rt_stage("stage-underwriting", "Underwriting", 3, [
                    _rt_proc("proc-risk", "Risk Assessment", 1, [
                        _rt_step("step-auto-credit", "Auto Credit Check (Webhook)", "automation", 1,
                                 status="completed", started_at="2026-01-22T16:00:00Z",
                                 completed_at="2026-01-22T16:00:00Z"),
                        _rt_step("step-risk-review", "Risk Review", "assignment", 2,
                                 status="in_progress", started_at="2026-01-22T16:00:00Z",
                                 assigned_to="user-1"),
                    ], status="in_progress", started_at="2026-01-22T16:00:00Z"),
                    _rt_proc("proc-decision", "Approval Decision", 2, [
                        _rt_step("step-routing-decision", "Loan Routing (Decision Table)", "decision", 1),
                        _rt_step("step-amount-check", "Amount Decision", "decision", 2),
                        _rt_step("step-mgr-approval", "Manager Approval", "approval", 3),
                        _rt_step("step-vp-approval", "VP Approval", "approval", 4),
                    ]),
                ], status="in_progress", entered_at="2026-01-22T16:00:00Z"),
                _rt_stage("stage-compliance", "Compliance Review", 4, [
                    _rt_proc("proc-compliance", "Compliance Subprocess", 1, [
                        _rt_step("step-compliance-check", "AML/KYC Compliance Check", "subprocess", 1),
                        _rt_step("step-compliance-review", "Compliance Sign-off", "assignment", 2),
                    ]),
                ]),
                _rt_stage("stage-disburse", "Disbursement", 5, [
                    _rt_proc("proc-disburse", "Disbursement Process", 1, [
                        _rt_step("step-send-funds", "Process Disbursement", "assignment", 1),
                        _rt_step("step-confirm-notify", "Confirmation Notification", "automation", 2),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-2", "created_at": "2026-01-20T09:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_30, "sla_days_remaining": 18, "escalation_level": 0,
        },

        # ── Loan case 3: in Underwriting VP approval (high value, escalated) ──
        {
            "_id": "LOAN-003", "case_type_id": "ct-loan", "case_type_name": "Loan Origination",
            "title": "Commercial Loan - Acme Corp", "status": "in_progress", "priority": "critical",
            "owner_id": "user-1", "team_id": "team-1",
            "custom_fields": {"loanAmount": 500000, "loanType": "Commercial", "applicantName": "Acme Corp", "applicantIncome": 2000000, "creditChecked": True, "creditScore": 780, "approvalTier": "executive"},
            "current_stage_id": "stage-underwriting", "current_process_id": "proc-decision", "current_step_id": "step-vp-approval",
            "stages": [
                _rt_stage("stage-intake", "Intake Review", 1, [
                    _rt_proc("proc-intake", "Application Intake", 1, [
                        _rt_step("step-fill-app", "Fill Application", "assignment", 1,
                                 status="completed", started_at="2026-01-10T08:00:00Z",
                                 completed_at="2026-01-10T10:00:00Z", assigned_to="user-1"),
                    ], status="completed", started_at="2026-01-10T08:00:00Z", completed_at="2026-01-10T10:00:00Z"),
                ], status="completed", entered_at="2026-01-10T08:00:00Z",
                   completed_at="2026-01-10T10:00:00Z", completed_by="user-1"),
                _rt_stage("stage-docs", "Document Collection", 2, [
                    _rt_proc("proc-docs", "Collect Documents", 1, [
                        _rt_step("step-upload-docs", "Upload Documents", "attachment", 1,
                                 status="completed", started_at="2026-01-10T10:00:00Z",
                                 completed_at="2026-01-11T14:00:00Z"),
                        _rt_step("step-verify-docs", "Verify Documents", "assignment", 2,
                                 status="completed", started_at="2026-01-11T14:00:00Z",
                                 completed_at="2026-01-12T14:00:00Z", assigned_to="user-2"),
                    ], status="completed", started_at="2026-01-10T10:00:00Z", completed_at="2026-01-12T14:00:00Z"),
                ], status="completed", entered_at="2026-01-10T10:00:00Z",
                   completed_at="2026-01-12T14:00:00Z", completed_by="user-2"),
                _rt_stage("stage-underwriting", "Underwriting", 3, [
                    _rt_proc("proc-risk", "Risk Assessment", 1, [
                        _rt_step("step-auto-credit", "Auto Credit Check (Webhook)", "automation", 1,
                                 status="completed", started_at="2026-01-12T14:00:00Z",
                                 completed_at="2026-01-12T14:00:00Z"),
                        _rt_step("step-risk-review", "Risk Review", "assignment", 2,
                                 status="completed", started_at="2026-01-12T14:00:00Z",
                                 completed_at="2026-01-13T10:00:00Z", assigned_to="user-1"),
                    ], status="completed", started_at="2026-01-12T14:00:00Z", completed_at="2026-01-13T10:00:00Z"),
                    _rt_proc("proc-decision", "Approval Decision", 2, [
                        _rt_step("step-routing-decision", "Loan Routing (Decision Table)", "decision", 1,
                                 status="completed", started_at="2026-01-13T10:00:00Z",
                                 completed_at="2026-01-13T10:00:00Z"),
                        _rt_step("step-amount-check", "Amount Decision", "decision", 2,
                                 status="completed", started_at="2026-01-13T10:00:00Z",
                                 completed_at="2026-01-13T10:00:00Z"),
                        _rt_step("step-mgr-approval", "Manager Approval", "approval", 3,
                                 status="skipped"),
                        _rt_step("step-vp-approval", "VP Approval", "approval", 4,
                                 status="in_progress", started_at="2026-01-15T09:00:00Z",
                                 assigned_to="user-admin"),
                    ], status="in_progress", started_at="2026-01-13T10:00:00Z"),
                ], status="in_progress", entered_at="2026-01-12T14:00:00Z"),
                _rt_stage("stage-compliance", "Compliance Review", 4, [
                    _rt_proc("proc-compliance", "Compliance Subprocess", 1, [
                        _rt_step("step-compliance-check", "AML/KYC Compliance Check", "subprocess", 1),
                        _rt_step("step-compliance-review", "Compliance Sign-off", "assignment", 2),
                    ]),
                ]),
                _rt_stage("stage-disburse", "Disbursement", 5, [
                    _rt_proc("proc-disburse", "Disbursement Process", 1, [
                        _rt_step("step-send-funds", "Process Disbursement", "assignment", 1),
                        _rt_step("step-confirm-notify", "Confirmation Notification", "automation", 2),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-1", "created_at": "2026-01-10T08:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_30, "sla_days_remaining": 5, "escalation_level": 1,
        },

        # ── Loan case 4: in Compliance Review — subprocess waiting for child KYC ──
        {
            "_id": "LOAN-004", "case_type_id": "ct-loan", "case_type_name": "Loan Origination",
            "title": "Auto Loan - Sarah Kim", "status": "in_progress", "priority": "medium",
            "owner_id": "user-2", "team_id": "team-1",
            "custom_fields": {"loanAmount": 35000, "loanType": "Auto", "applicantName": "Sarah Kim",
                              "applicantIncome": 72000, "creditChecked": True, "creditScore": 710,
                              "approvalTier": "standard"},
            "current_stage_id": "stage-compliance", "current_process_id": "proc-compliance",
            "current_step_id": "step-compliance-check",
            "stages": [
                _rt_stage("stage-intake", "Intake Review", 1, [
                    _rt_proc("proc-intake", "Application Intake", 1, [
                        _rt_step("step-fill-app", "Fill Application", "assignment", 1,
                                 status="completed", started_at="2026-03-01T09:00:00Z",
                                 completed_at="2026-03-01T11:00:00Z", assigned_to="user-2"),
                    ], status="completed", started_at="2026-03-01T09:00:00Z",
                       completed_at="2026-03-01T11:00:00Z"),
                ], status="completed", entered_at="2026-03-01T09:00:00Z",
                   completed_at="2026-03-01T11:00:00Z", completed_by="user-2"),
                _rt_stage("stage-docs", "Document Collection", 2, [
                    _rt_proc("proc-docs", "Collect Documents", 1, [
                        _rt_step("step-upload-docs", "Upload Documents", "attachment", 1,
                                 status="completed", started_at="2026-03-01T11:00:00Z",
                                 completed_at="2026-03-02T10:00:00Z"),
                        _rt_step("step-verify-docs", "Verify Documents", "assignment", 2,
                                 status="completed", started_at="2026-03-02T10:00:00Z",
                                 completed_at="2026-03-02T16:00:00Z", assigned_to="user-1"),
                    ], status="completed", started_at="2026-03-01T11:00:00Z",
                       completed_at="2026-03-02T16:00:00Z"),
                ], status="completed", entered_at="2026-03-01T11:00:00Z",
                   completed_at="2026-03-02T16:00:00Z", completed_by="user-1"),
                _rt_stage("stage-underwriting", "Underwriting", 3, [
                    _rt_proc("proc-risk", "Risk Assessment", 1, [
                        _rt_step("step-auto-credit", "Auto Credit Check (Webhook)", "automation", 1,
                                 status="completed", started_at="2026-03-02T16:00:00Z",
                                 completed_at="2026-03-02T16:00:00Z"),
                        _rt_step("step-risk-review", "Risk Review", "assignment", 2,
                                 status="completed", started_at="2026-03-02T16:00:00Z",
                                 completed_at="2026-03-03T10:00:00Z", assigned_to="user-1"),
                    ], status="completed", started_at="2026-03-02T16:00:00Z",
                       completed_at="2026-03-03T10:00:00Z"),
                    _rt_proc("proc-decision", "Approval Decision", 2, [
                        _rt_step("step-routing-decision", "Loan Routing (Decision Table)", "decision", 1,
                                 status="completed", started_at="2026-03-03T10:00:00Z",
                                 completed_at="2026-03-03T10:00:00Z"),
                        _rt_step("step-amount-check", "Amount Decision", "decision", 2,
                                 status="completed", started_at="2026-03-03T10:00:00Z",
                                 completed_at="2026-03-03T10:00:00Z"),
                        _rt_step("step-mgr-approval", "Manager Approval", "approval", 3,
                                 status="completed", started_at="2026-03-03T10:00:00Z",
                                 completed_at="2026-03-04T09:00:00Z", assigned_to="user-admin"),
                        _rt_step("step-vp-approval", "VP Approval", "approval", 4,
                                 status="skipped"),
                    ], status="completed", started_at="2026-03-03T10:00:00Z",
                       completed_at="2026-03-04T09:00:00Z"),
                ], status="completed", entered_at="2026-03-02T16:00:00Z",
                   completed_at="2026-03-04T09:00:00Z", completed_by="user-admin"),
                _rt_stage("stage-compliance", "Compliance Review", 4, [
                    _rt_proc("proc-compliance", "Compliance Subprocess", 1, [
                        _rt_step("step-compliance-check", "AML/KYC Compliance Check", "subprocess", 1,
                                 status="waiting", started_at="2026-03-04T09:00:00Z",
                                 child_case_id="KYC-004"),
                        _rt_step("step-compliance-review", "Compliance Sign-off", "assignment", 2),
                    ], status="in_progress", started_at="2026-03-04T09:00:00Z"),
                ], status="in_progress", entered_at="2026-03-04T09:00:00Z"),
                _rt_stage("stage-disburse", "Disbursement", 5, [
                    _rt_proc("proc-disburse", "Disbursement Process", 1, [
                        _rt_step("step-send-funds", "Process Disbursement", "assignment", 1),
                        _rt_step("step-confirm-notify", "Confirmation Notification", "automation", 2),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-2", "created_at": "2026-03-01T09:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_30, "sla_days_remaining": 20, "escalation_level": 0,
        },

        # ── KYC case 1: in Identity Verification ──
        {
            "_id": "KYC-001", "case_type_id": "ct-kyc", "case_type_name": "Customer Onboarding",
            "title": "KYC - Michael Chen", "status": "in_progress", "priority": "high",
            "owner_id": "user-3", "team_id": "team-2",
            "custom_fields": {"customerName": "Michael Chen", "accountType": "Premium Checking", "riskLevel": "medium"},
            "current_stage_id": "stage-id-verify", "current_process_id": "proc-id-verify", "current_step_id": "step-verify-id",
            "stages": [
                _rt_stage("stage-app-review", "Application Review", 1, [
                    _rt_proc("proc-app-review", "Review Application", 1, [
                        _rt_step("step-kyc-form", "KYC Application Form", "assignment", 1,
                                 status="completed", started_at="2026-03-01T09:00:00Z",
                                 completed_at="2026-03-01T11:00:00Z", assigned_to="user-3"),
                    ], status="completed", started_at="2026-03-01T09:00:00Z", completed_at="2026-03-01T11:00:00Z"),
                ], status="completed", entered_at="2026-03-01T09:00:00Z",
                   completed_at="2026-03-01T11:00:00Z", completed_by="user-3"),
                _rt_stage("stage-id-verify", "Identity Verification", 2, [
                    _rt_proc("proc-id-verify", "Verify Identity", 1, [
                        _rt_step("step-upload-id", "Upload ID Documents", "attachment", 1,
                                 status="completed", started_at="2026-03-01T11:00:00Z",
                                 completed_at="2026-03-02T09:30:00Z"),
                        _rt_step("step-verify-id", "Verify Identity", "assignment", 2,
                                 status="in_progress", started_at="2026-03-02T09:30:00Z",
                                 assigned_to="user-3"),
                    ], status="in_progress", started_at="2026-03-01T11:00:00Z"),
                ], status="in_progress", entered_at="2026-03-01T11:00:00Z"),
                _rt_stage("stage-risk", "Risk Assessment", 3, [
                    _rt_proc("proc-risk-assess", "Assess Risk", 1, [
                        _rt_step("step-risk-decision", "Risk Level Decision", "decision", 1),
                        _rt_step("step-auto-clear", "Auto Clear", "automation", 2),
                        _rt_step("step-edd", "Enhanced Due Diligence", "assignment", 3),
                    ]),
                ]),
                _rt_stage("stage-acct-setup", "Account Setup", 4, [
                    _rt_proc("proc-acct-setup", "Setup Account", 1, [
                        _rt_step("step-create-acct", "Create Account", "assignment", 1),
                    ]),
                ]),
                _rt_stage("stage-welcome", "Welcome", 5, [
                    _rt_proc("proc-welcome", "Welcome Process", 1, [
                        _rt_step("step-welcome-notify", "Send Welcome Pack", "automation", 1),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-3", "created_at": "2026-03-01T09:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_20, "sla_days_remaining": 15, "escalation_level": 0,
        },

        # ── KYC case 2: in Risk Assessment (high-risk, EDD step) ──
        {
            "_id": "KYC-002", "case_type_id": "ct-kyc", "case_type_name": "Customer Onboarding",
            "title": "KYC - Global Trading LLC", "status": "in_progress", "priority": "critical",
            "owner_id": "user-1", "team_id": "team-2",
            "custom_fields": {"customerName": "Global Trading LLC", "accountType": "Business Account", "riskLevel": "high"},
            "current_stage_id": "stage-risk", "current_process_id": "proc-risk-assess", "current_step_id": "step-edd",
            "stages": [
                _rt_stage("stage-app-review", "Application Review", 1, [
                    _rt_proc("proc-app-review", "Review Application", 1, [
                        _rt_step("step-kyc-form", "KYC Application Form", "assignment", 1,
                                 status="completed", started_at="2026-02-20T08:00:00Z",
                                 completed_at="2026-02-20T10:00:00Z", assigned_to="user-1"),
                    ], status="completed", started_at="2026-02-20T08:00:00Z", completed_at="2026-02-20T10:00:00Z"),
                ], status="completed", entered_at="2026-02-20T08:00:00Z",
                   completed_at="2026-02-20T10:00:00Z", completed_by="user-1"),
                _rt_stage("stage-id-verify", "Identity Verification", 2, [
                    _rt_proc("proc-id-verify", "Verify Identity", 1, [
                        _rt_step("step-upload-id", "Upload ID Documents", "attachment", 1,
                                 status="completed", started_at="2026-02-20T10:00:00Z",
                                 completed_at="2026-02-21T14:00:00Z"),
                        _rt_step("step-verify-id", "Verify Identity", "assignment", 2,
                                 status="completed", started_at="2026-02-21T14:00:00Z",
                                 completed_at="2026-02-22T16:00:00Z", assigned_to="user-3"),
                    ], status="completed", started_at="2026-02-20T10:00:00Z", completed_at="2026-02-22T16:00:00Z"),
                ], status="completed", entered_at="2026-02-20T10:00:00Z",
                   completed_at="2026-02-22T16:00:00Z", completed_by="user-3"),
                _rt_stage("stage-risk", "Risk Assessment", 3, [
                    _rt_proc("proc-risk-assess", "Assess Risk", 1, [
                        _rt_step("step-risk-decision", "Risk Level Decision", "decision", 1,
                                 status="completed", started_at="2026-02-22T16:00:00Z",
                                 completed_at="2026-02-22T16:00:00Z"),
                        _rt_step("step-auto-clear", "Auto Clear", "automation", 2,
                                 status="skipped"),
                        _rt_step("step-edd", "Enhanced Due Diligence", "assignment", 3,
                                 status="in_progress", started_at="2026-02-22T16:00:00Z",
                                 assigned_to="user-1"),
                    ], status="in_progress", started_at="2026-02-22T16:00:00Z"),
                ], status="in_progress", entered_at="2026-02-22T16:00:00Z"),
                _rt_stage("stage-acct-setup", "Account Setup", 4, [
                    _rt_proc("proc-acct-setup", "Setup Account", 1, [
                        _rt_step("step-create-acct", "Create Account", "assignment", 1),
                    ]),
                ]),
                _rt_stage("stage-welcome", "Welcome", 5, [
                    _rt_proc("proc-welcome", "Welcome Process", 1, [
                        _rt_step("step-welcome-notify", "Send Welcome Pack", "automation", 1),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-1", "created_at": "2026-02-20T08:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_15, "sla_days_remaining": 8, "escalation_level": 1,
        },

        # ── KYC case 3: in Account Setup ──
        {
            "_id": "KYC-003", "case_type_id": "ct-kyc", "case_type_name": "Customer Onboarding",
            "title": "KYC - Sarah Williams", "status": "in_progress", "priority": "low",
            "owner_id": "user-3", "team_id": "team-2",
            "custom_fields": {"customerName": "Sarah Williams", "accountType": "Savings", "riskLevel": "low", "riskCleared": True},
            "current_stage_id": "stage-acct-setup", "current_process_id": "proc-acct-setup", "current_step_id": "step-create-acct",
            "stages": [
                _rt_stage("stage-app-review", "Application Review", 1, [
                    _rt_proc("proc-app-review", "Review Application", 1, [
                        _rt_step("step-kyc-form", "KYC Application Form", "assignment", 1,
                                 status="completed", started_at="2026-02-10T09:00:00Z",
                                 completed_at="2026-02-10T10:00:00Z", assigned_to="user-3"),
                    ], status="completed", started_at="2026-02-10T09:00:00Z", completed_at="2026-02-10T10:00:00Z"),
                ], status="completed", entered_at="2026-02-10T09:00:00Z",
                   completed_at="2026-02-10T10:00:00Z", completed_by="user-3"),
                _rt_stage("stage-id-verify", "Identity Verification", 2, [
                    _rt_proc("proc-id-verify", "Verify Identity", 1, [
                        _rt_step("step-upload-id", "Upload ID Documents", "attachment", 1,
                                 status="completed", started_at="2026-02-10T10:00:00Z",
                                 completed_at="2026-02-10T14:00:00Z"),
                        _rt_step("step-verify-id", "Verify Identity", "assignment", 2,
                                 status="completed", started_at="2026-02-10T14:00:00Z",
                                 completed_at="2026-02-11T09:00:00Z", assigned_to="user-3"),
                    ], status="completed", started_at="2026-02-10T10:00:00Z", completed_at="2026-02-11T09:00:00Z"),
                ], status="completed", entered_at="2026-02-10T10:00:00Z",
                   completed_at="2026-02-11T09:00:00Z", completed_by="user-3"),
                _rt_stage("stage-risk", "Risk Assessment", 3, [
                    _rt_proc("proc-risk-assess", "Assess Risk", 1, [
                        _rt_step("step-risk-decision", "Risk Level Decision", "decision", 1,
                                 status="completed", started_at="2026-02-11T09:00:00Z",
                                 completed_at="2026-02-11T09:00:00Z"),
                        _rt_step("step-auto-clear", "Auto Clear", "automation", 2,
                                 status="completed", started_at="2026-02-11T09:00:00Z",
                                 completed_at="2026-02-11T09:00:00Z"),
                        _rt_step("step-edd", "Enhanced Due Diligence", "assignment", 3,
                                 status="skipped"),
                    ], status="completed", started_at="2026-02-11T09:00:00Z", completed_at="2026-02-11T09:00:00Z"),
                ], status="completed", entered_at="2026-02-11T09:00:00Z",
                   completed_at="2026-02-11T14:00:00Z", completed_by="user-1"),
                _rt_stage("stage-acct-setup", "Account Setup", 4, [
                    _rt_proc("proc-acct-setup", "Setup Account", 1, [
                        _rt_step("step-create-acct", "Create Account", "assignment", 1,
                                 status="in_progress", started_at="2026-02-11T14:00:00Z",
                                 assigned_to="user-3"),
                    ], status="in_progress", started_at="2026-02-11T14:00:00Z"),
                ], status="in_progress", entered_at="2026-02-11T14:00:00Z"),
                _rt_stage("stage-welcome", "Welcome", 5, [
                    _rt_proc("proc-welcome", "Welcome Process", 1, [
                        _rt_step("step-welcome-notify", "Send Welcome Pack", "automation", 1),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-3", "created_at": "2026-02-10T09:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_20, "sla_days_remaining": 12, "escalation_level": 0,
        },

        # ── KYC case 4: child of LOAN-004 subprocess — in Identity Verification ──
        {
            "_id": "KYC-004", "case_type_id": "ct-kyc", "case_type_name": "Customer Onboarding",
            "title": "Subprocess: AML/KYC Compliance Check (from LOAN-004)", "status": "in_progress",
            "priority": "medium", "owner_id": "user-2", "team_id": "team-1",
            "custom_fields": {"customerName": "Sarah Kim", "accountType": "Auto"},
            "current_stage_id": "stage-id-verify", "current_process_id": "proc-id-verify",
            "current_step_id": "step-upload-id",
            "stages": [
                _rt_stage("stage-app-review", "Application Review", 1, [
                    _rt_proc("proc-app-review", "Review Application", 1, [
                        _rt_step("step-kyc-form", "KYC Application Form", "assignment", 1,
                                 status="completed", started_at="2026-03-04T09:00:00Z",
                                 completed_at="2026-03-04T10:00:00Z", assigned_to="user-2"),
                    ], status="completed", started_at="2026-03-04T09:00:00Z",
                       completed_at="2026-03-04T10:00:00Z"),
                ], status="completed", entered_at="2026-03-04T09:00:00Z",
                   completed_at="2026-03-04T10:00:00Z", completed_by="user-2"),
                _rt_stage("stage-id-verify", "Identity Verification", 2, [
                    _rt_proc("proc-id-verify", "Verify Identity", 1, [
                        _rt_step("step-upload-id", "Upload ID Documents", "attachment", 1,
                                 status="in_progress", started_at="2026-03-04T10:00:00Z"),
                        _rt_step("step-verify-id", "Verify Identity", "assignment", 2),
                    ], status="in_progress", started_at="2026-03-04T10:00:00Z"),
                ], status="in_progress", entered_at="2026-03-04T10:00:00Z"),
                _rt_stage("stage-risk", "Risk Assessment", 3, [
                    _rt_proc("proc-risk-assess", "Assess Risk", 1, [
                        _rt_step("step-risk-decision", "Risk Level Decision", "decision", 1),
                        _rt_step("step-auto-clear", "Auto Clear", "automation", 2),
                        _rt_step("step-edd", "Enhanced Due Diligence", "assignment", 3),
                    ]),
                ]),
                _rt_stage("stage-acct-setup", "Account Setup", 4, [
                    _rt_proc("proc-acct-setup", "Setup Account", 1, [
                        _rt_step("step-create-acct", "Create Account", "assignment", 1),
                    ]),
                ]),
                _rt_stage("stage-welcome", "Welcome", 5, [
                    _rt_proc("proc-welcome", "Welcome Process", 1, [
                        _rt_step("step-welcome-notify", "Send Welcome Pack", "automation", 1),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-2", "created_at": "2026-03-04T09:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None,
            "parent_case_id": "LOAN-004", "parent_step_id": "step-compliance-check",
            "sla_target_date": sla_20, "sla_days_remaining": 15, "escalation_level": 0,
        },

        # ── Claims case 1: in Investigation ──
        {
            "_id": "CLM-001", "case_type_id": "ct-claims", "case_type_name": "Insurance Claims",
            "title": "Auto Claim - Robert Taylor", "status": "in_progress", "priority": "high",
            "owner_id": "user-2", "team_id": "team-3",
            "custom_fields": {"claimantName": "Robert Taylor", "claimType": "Auto Collision", "claimAmount": 18500, "policyNumber": "POL-2025-44821"},
            "current_stage_id": "stage-investigation", "current_process_id": "proc-investigate", "current_step_id": "step-gather-evidence",
            "stages": [
                _rt_stage("stage-claim-intake", "Claim Intake", 1, [
                    _rt_proc("proc-claim-intake", "Record Claim", 1, [
                        _rt_step("step-claim-form", "Submit Claim Form", "assignment", 1,
                                 status="completed", started_at="2026-03-05T10:00:00Z",
                                 completed_at="2026-03-05T11:30:00Z", assigned_to="user-2"),
                    ], status="completed", started_at="2026-03-05T10:00:00Z", completed_at="2026-03-05T11:30:00Z"),
                ], status="completed", entered_at="2026-03-05T10:00:00Z",
                   completed_at="2026-03-05T11:30:00Z", completed_by="user-2"),
                _rt_stage("stage-investigation", "Investigation", 2, [
                    _rt_proc("proc-investigate", "Investigate Claim", 1, [
                        _rt_step("step-gather-evidence", "Gather Evidence", "assignment", 1,
                                 status="in_progress", started_at="2026-03-05T11:30:00Z",
                                 assigned_to="user-2"),
                        _rt_step("step-upload-evidence", "Upload Evidence Docs", "attachment", 2),
                    ], status="in_progress", started_at="2026-03-05T11:30:00Z"),
                ], status="in_progress", entered_at="2026-03-05T11:30:00Z"),
                _rt_stage("stage-adjudicate", "Adjudication", 3, [
                    _rt_proc("proc-adjudicate", "Adjudicate Claim", 1, [
                        _rt_step("step-adjudicate-decision", "Coverage Decision", "decision", 1),
                        _rt_step("step-mgr-adjudicate", "Manager Adjudication", "approval", 2),
                        _rt_step("step-senior-review", "Senior Review", "approval", 3),
                    ]),
                ]),
                _rt_stage("stage-settlement", "Settlement", 4, [
                    _rt_proc("proc-settle", "Process Settlement", 1, [
                        _rt_step("step-calc-payout", "Calculate Payout", "assignment", 1),
                        _rt_step("step-issue-payment", "Issue Payment", "assignment", 2),
                    ]),
                ]),
                _rt_stage("stage-closure", "Closure", 5, [
                    _rt_proc("proc-closure", "Close Claim", 1, [
                        _rt_step("step-close-notify", "Send Closure Notification", "automation", 1),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-2", "created_at": "2026-03-05T10:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_20, "sla_days_remaining": 14, "escalation_level": 0,
        },

        # ── Claims case 2: in Adjudication (high-value, escalated) ──
        {
            "_id": "CLM-002", "case_type_id": "ct-claims", "case_type_name": "Insurance Claims",
            "title": "Property Claim - Maria Garcia", "status": "in_progress", "priority": "critical",
            "owner_id": "user-3", "team_id": "team-3",
            "custom_fields": {"claimantName": "Maria Garcia", "claimType": "Property Damage", "claimAmount": 125000, "policyNumber": "POL-2024-31056"},
            "current_stage_id": "stage-adjudicate", "current_process_id": "proc-adjudicate", "current_step_id": "step-senior-review",
            "stages": [
                _rt_stage("stage-claim-intake", "Claim Intake", 1, [
                    _rt_proc("proc-claim-intake", "Record Claim", 1, [
                        _rt_step("step-claim-form", "Submit Claim Form", "assignment", 1,
                                 status="completed", started_at="2026-02-15T08:00:00Z",
                                 completed_at="2026-02-15T10:00:00Z", assigned_to="user-3"),
                    ], status="completed", started_at="2026-02-15T08:00:00Z", completed_at="2026-02-15T10:00:00Z"),
                ], status="completed", entered_at="2026-02-15T08:00:00Z",
                   completed_at="2026-02-15T10:00:00Z", completed_by="user-3"),
                _rt_stage("stage-investigation", "Investigation", 2, [
                    _rt_proc("proc-investigate", "Investigate Claim", 1, [
                        _rt_step("step-gather-evidence", "Gather Evidence", "assignment", 1,
                                 status="completed", started_at="2026-02-15T10:00:00Z",
                                 completed_at="2026-02-18T16:00:00Z", assigned_to="user-2"),
                        _rt_step("step-upload-evidence", "Upload Evidence Docs", "attachment", 2,
                                 status="completed", started_at="2026-02-18T16:00:00Z",
                                 completed_at="2026-02-20T16:00:00Z"),
                    ], status="completed", started_at="2026-02-15T10:00:00Z", completed_at="2026-02-20T16:00:00Z"),
                ], status="completed", entered_at="2026-02-15T10:00:00Z",
                   completed_at="2026-02-20T16:00:00Z", completed_by="user-2"),
                _rt_stage("stage-adjudicate", "Adjudication", 3, [
                    _rt_proc("proc-adjudicate", "Adjudicate Claim", 1, [
                        _rt_step("step-adjudicate-decision", "Coverage Decision", "decision", 1,
                                 status="completed", started_at="2026-02-20T16:00:00Z",
                                 completed_at="2026-02-20T16:00:00Z"),
                        _rt_step("step-mgr-adjudicate", "Manager Adjudication", "approval", 2,
                                 status="skipped"),
                        _rt_step("step-senior-review", "Senior Review", "approval", 3,
                                 status="in_progress", started_at="2026-02-20T16:00:00Z",
                                 assigned_to="user-admin",
                                 approval_chain_id="approval-2"),
                    ], status="in_progress", started_at="2026-02-20T16:00:00Z"),
                ], status="in_progress", entered_at="2026-02-20T16:00:00Z"),
                _rt_stage("stage-settlement", "Settlement", 4, [
                    _rt_proc("proc-settle", "Process Settlement", 1, [
                        _rt_step("step-calc-payout", "Calculate Payout", "assignment", 1),
                        _rt_step("step-issue-payment", "Issue Payment", "assignment", 2),
                    ]),
                ]),
                _rt_stage("stage-closure", "Closure", 5, [
                    _rt_proc("proc-closure", "Close Claim", 1, [
                        _rt_step("step-close-notify", "Send Closure Notification", "automation", 1),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-3", "created_at": "2026-02-15T08:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_15, "sla_days_remaining": 4, "escalation_level": 1,
        },

        # ── Claims case 3: in Settlement ──
        {
            "_id": "CLM-003", "case_type_id": "ct-claims", "case_type_name": "Insurance Claims",
            "title": "Medical Claim - David Kim", "status": "in_progress", "priority": "medium",
            "owner_id": "user-2", "team_id": "team-3",
            "custom_fields": {"claimantName": "David Kim", "claimType": "Medical", "claimAmount": 8200, "policyNumber": "POL-2025-17893"},
            "current_stage_id": "stage-settlement", "current_process_id": "proc-settle", "current_step_id": "step-calc-payout",
            "stages": [
                _rt_stage("stage-claim-intake", "Claim Intake", 1, [
                    _rt_proc("proc-claim-intake", "Record Claim", 1, [
                        _rt_step("step-claim-form", "Submit Claim Form", "assignment", 1,
                                 status="completed", started_at="2026-01-28T09:00:00Z",
                                 completed_at="2026-01-28T10:00:00Z", assigned_to="user-2"),
                    ], status="completed", started_at="2026-01-28T09:00:00Z", completed_at="2026-01-28T10:00:00Z"),
                ], status="completed", entered_at="2026-01-28T09:00:00Z",
                   completed_at="2026-01-28T10:00:00Z", completed_by="user-2"),
                _rt_stage("stage-investigation", "Investigation", 2, [
                    _rt_proc("proc-investigate", "Investigate Claim", 1, [
                        _rt_step("step-gather-evidence", "Gather Evidence", "assignment", 1,
                                 status="completed", started_at="2026-01-28T10:00:00Z",
                                 completed_at="2026-01-30T14:00:00Z", assigned_to="user-3"),
                        _rt_step("step-upload-evidence", "Upload Evidence Docs", "attachment", 2,
                                 status="completed", started_at="2026-01-30T14:00:00Z",
                                 completed_at="2026-02-01T14:00:00Z"),
                    ], status="completed", started_at="2026-01-28T10:00:00Z", completed_at="2026-02-01T14:00:00Z"),
                ], status="completed", entered_at="2026-01-28T10:00:00Z",
                   completed_at="2026-02-01T14:00:00Z", completed_by="user-3"),
                _rt_stage("stage-adjudicate", "Adjudication", 3, [
                    _rt_proc("proc-adjudicate", "Adjudicate Claim", 1, [
                        _rt_step("step-adjudicate-decision", "Coverage Decision", "decision", 1,
                                 status="completed", started_at="2026-02-01T14:00:00Z",
                                 completed_at="2026-02-01T14:00:00Z"),
                        _rt_step("step-mgr-adjudicate", "Manager Adjudication", "approval", 2,
                                 status="completed", started_at="2026-02-01T14:00:00Z",
                                 completed_at="2026-02-05T09:00:00Z",
                                 approval_chain_id="approval-5"),
                        _rt_step("step-senior-review", "Senior Review", "approval", 3,
                                 status="skipped"),
                    ], status="completed", started_at="2026-02-01T14:00:00Z", completed_at="2026-02-05T09:00:00Z"),
                ], status="completed", entered_at="2026-02-01T14:00:00Z",
                   completed_at="2026-02-05T09:00:00Z", completed_by="user-admin"),
                _rt_stage("stage-settlement", "Settlement", 4, [
                    _rt_proc("proc-settle", "Process Settlement", 1, [
                        _rt_step("step-calc-payout", "Calculate Payout", "assignment", 1,
                                 status="in_progress", started_at="2026-02-05T09:00:00Z",
                                 assigned_to="user-2"),
                        _rt_step("step-issue-payment", "Issue Payment", "assignment", 2),
                    ], status="in_progress", started_at="2026-02-05T09:00:00Z"),
                ], status="in_progress", entered_at="2026-02-05T09:00:00Z"),
                _rt_stage("stage-closure", "Closure", 5, [
                    _rt_proc("proc-closure", "Close Claim", 1, [
                        _rt_step("step-close-notify", "Send Closure Notification", "automation", 1),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-2", "created_at": "2026-01-28T09:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_20, "sla_days_remaining": 10, "escalation_level": 0,
        },

        # ── Stolen card case 1: in Fraud Investigation (flagging transactions) ──
        {
            "_id": "CCS-001", "case_type_id": "ct-cc-stolen", "case_type_name": "Credit Card Stolen Transaction",
            "title": "Stolen Visa - Emily Chen", "status": "in_progress", "priority": "high",
            "owner_id": "user-2", "team_id": "team-1",
            "custom_fields": {"cardholderName": "Emily Chen", "cardLastFour": "4829", "cardType": "Visa",
                              "totalDisputedAmount": 3475.50, "fraudConfirmed": False, "replacementCardIssued": True},
            "current_stage_id": "stg-investigate", "current_process_id": "proc-review-txns",
            "current_step_id": "stp-flag-transactions",
            "stages": [
                _rt_stage("stg-report", "Report & Card Block", 1, [
                    _rt_proc("proc-report-incident", "Report Incident", 1, [
                        _rt_step("stp-incident-details", "Incident Details", "assignment", 1,
                                 status="completed", started_at="2026-03-20T08:30:00Z",
                                 completed_at="2026-03-20T09:15:00Z", assigned_to="user-2"),
                        _rt_step("stp-block-card", "Block Card & Issue Replacement", "automation", 2,
                                 status="completed", started_at="2026-03-20T09:15:00Z",
                                 completed_at="2026-03-20T09:15:00Z"),
                    ], status="completed", started_at="2026-03-20T08:30:00Z",
                       completed_at="2026-03-20T09:15:00Z"),
                ], status="completed", entered_at="2026-03-20T08:30:00Z",
                   completed_at="2026-03-20T09:15:00Z", completed_by="user-2"),
                _rt_stage("stg-investigate", "Fraud Investigation", 2, [
                    _rt_proc("proc-review-txns", "Review Transactions", 1, [
                        _rt_step("stp-flag-transactions", "Flag Unauthorized Transactions", "assignment", 1,
                                 status="in_progress", started_at="2026-03-20T09:15:00Z",
                                 assigned_to="user-2"),
                        _rt_step("stp-upload-evidence", "Upload Supporting Evidence", "attachment", 2),
                    ], status="in_progress", started_at="2026-03-20T09:15:00Z"),
                    _rt_proc("proc-fraud-decision", "Fraud Determination", 2, [
                        _rt_step("stp-fraud-decision", "Fraud Determination", "decision", 1),
                        _rt_step("stp-mgr-review", "Manager Fraud Review", "approval", 2),
                        _rt_step("stp-senior-review", "Senior Fraud Review", "approval", 3),
                    ]),
                ], status="in_progress", entered_at="2026-03-20T09:15:00Z"),
                _rt_stage("stg-resolution", "Resolution & Refund", 3, [
                    _rt_proc("proc-refund", "Process Refund", 1, [
                        _rt_step("stp-process-refund", "Issue Provisional Credit", "assignment", 1),
                        _rt_step("stp-close-notify", "Send Resolution Notification", "automation", 2),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-2", "created_at": "2026-03-20T08:30:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_15, "sla_days_remaining": 12, "escalation_level": 0,
        },

        # ── Stolen card case 2: in Resolution (issuing refund) — high value ──
        {
            "_id": "CCS-002", "case_type_id": "ct-cc-stolen", "case_type_name": "Credit Card Stolen Transaction",
            "title": "Stolen Amex - Marcus Williams", "status": "in_progress", "priority": "critical",
            "owner_id": "user-1", "team_id": "team-1",
            "custom_fields": {"cardholderName": "Marcus Williams", "cardLastFour": "9102", "cardType": "Amex",
                              "totalDisputedAmount": 12890.00, "fraudConfirmed": True, "replacementCardIssued": True},
            "current_stage_id": "stg-resolution", "current_process_id": "proc-refund",
            "current_step_id": "stp-process-refund",
            "stages": [
                _rt_stage("stg-report", "Report & Card Block", 1, [
                    _rt_proc("proc-report-incident", "Report Incident", 1, [
                        _rt_step("stp-incident-details", "Incident Details", "assignment", 1,
                                 status="completed", started_at="2026-03-10T14:00:00Z",
                                 completed_at="2026-03-10T14:45:00Z", assigned_to="user-3"),
                        _rt_step("stp-block-card", "Block Card & Issue Replacement", "automation", 2,
                                 status="completed", started_at="2026-03-10T14:45:00Z",
                                 completed_at="2026-03-10T14:45:00Z"),
                    ], status="completed", started_at="2026-03-10T14:00:00Z",
                       completed_at="2026-03-10T14:45:00Z"),
                ], status="completed", entered_at="2026-03-10T14:00:00Z",
                   completed_at="2026-03-10T14:45:00Z", completed_by="user-3"),
                _rt_stage("stg-investigate", "Fraud Investigation", 2, [
                    _rt_proc("proc-review-txns", "Review Transactions", 1, [
                        _rt_step("stp-flag-transactions", "Flag Unauthorized Transactions", "assignment", 1,
                                 status="completed", started_at="2026-03-10T14:45:00Z",
                                 completed_at="2026-03-12T10:00:00Z", assigned_to="user-2"),
                        _rt_step("stp-upload-evidence", "Upload Supporting Evidence", "attachment", 2,
                                 status="completed", started_at="2026-03-12T10:00:00Z",
                                 completed_at="2026-03-13T16:00:00Z"),
                    ], status="completed", started_at="2026-03-10T14:45:00Z",
                       completed_at="2026-03-13T16:00:00Z"),
                    _rt_proc("proc-fraud-decision", "Fraud Determination", 2, [
                        _rt_step("stp-fraud-decision", "Fraud Determination", "decision", 1,
                                 status="completed", started_at="2026-03-13T16:00:00Z",
                                 completed_at="2026-03-13T16:00:00Z"),
                        _rt_step("stp-mgr-review", "Manager Fraud Review", "approval", 2,
                                 status="skipped"),
                        _rt_step("stp-senior-review", "Senior Fraud Review", "approval", 3,
                                 status="completed", started_at="2026-03-13T16:00:00Z",
                                 completed_at="2026-03-15T11:00:00Z", assigned_to="user-admin"),
                    ], status="completed", started_at="2026-03-13T16:00:00Z",
                       completed_at="2026-03-15T11:00:00Z"),
                ], status="completed", entered_at="2026-03-10T14:45:00Z",
                   completed_at="2026-03-15T11:00:00Z", completed_by="user-admin"),
                _rt_stage("stg-resolution", "Resolution & Refund", 3, [
                    _rt_proc("proc-refund", "Process Refund", 1, [
                        _rt_step("stp-process-refund", "Issue Provisional Credit", "assignment", 1,
                                 status="in_progress", started_at="2026-03-15T11:00:00Z",
                                 assigned_to="user-1"),
                        _rt_step("stp-close-notify", "Send Resolution Notification", "automation", 2),
                    ], status="in_progress", started_at="2026-03-15T11:00:00Z"),
                ], status="in_progress", entered_at="2026-03-15T11:00:00Z",
                   on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-1", "created_at": "2026-03-10T14:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_15, "sla_days_remaining": 3, "escalation_level": 1,
        },

        # ── Dispute case 1: in Investigation stage (verifying charge) ──
        {
            "_id": "CCD-001", "case_type_id": "ct-cc-dispute", "case_type_name": "Credit Card Dispute Transaction",
            "title": "Dispute - Undelivered Electronics (Lisa Park)", "status": "in_progress", "priority": "medium",
            "owner_id": "user-3", "team_id": "team-1",
            "custom_fields": {"cardholderName": "Lisa Park", "cardLastFour": "7713", "merchantName": "TechGadgets Online",
                              "disputedAmount": 649.99, "disputeReason": "Goods not received",
                              "merchantResponded": False, "chargebackIssued": False},
            "current_stage_id": "stg-review", "current_process_id": "proc-investigate",
            "current_step_id": "stp-verify-charge",
            "stages": [
                _rt_stage("stg-intake", "Dispute Intake", 1, [
                    _rt_proc("proc-file-dispute", "File Dispute", 1, [
                        _rt_step("stp-dispute-form", "Dispute Details", "assignment", 1,
                                 status="completed", started_at="2026-03-22T11:00:00Z",
                                 completed_at="2026-03-22T11:40:00Z", assigned_to="user-3"),
                        _rt_step("stp-upload-docs", "Upload Supporting Documents", "attachment", 2,
                                 status="completed", started_at="2026-03-22T11:40:00Z",
                                 completed_at="2026-03-23T09:00:00Z"),
                    ], status="completed", started_at="2026-03-22T11:00:00Z",
                       completed_at="2026-03-23T09:00:00Z"),
                ], status="completed", entered_at="2026-03-22T11:00:00Z",
                   completed_at="2026-03-23T09:00:00Z", completed_by="user-3"),
                _rt_stage("stg-review", "Investigation & Merchant Contact", 2, [
                    _rt_proc("proc-investigate", "Investigate Dispute", 1, [
                        _rt_step("stp-verify-charge", "Verify Charge Details", "assignment", 1,
                                 status="in_progress", started_at="2026-03-23T09:00:00Z",
                                 assigned_to="user-2"),
                    ], status="in_progress", started_at="2026-03-23T09:00:00Z"),
                    _rt_proc("proc-dispute-decision", "Dispute Decision", 2, [
                        _rt_step("stp-dispute-route", "Dispute Routing", "decision", 1),
                        _rt_step("stp-mgr-approval", "Manager Dispute Approval", "approval", 2),
                        _rt_step("stp-senior-approval", "Senior Dispute Approval", "approval", 3),
                    ]),
                ], status="in_progress", entered_at="2026-03-23T09:00:00Z"),
                _rt_stage("stg-chargeback", "Chargeback & Resolution", 3, [
                    _rt_proc("proc-chargeback", "Process Chargeback", 1, [
                        _rt_step("stp-issue-chargeback", "Issue Chargeback", "assignment", 1),
                        _rt_step("stp-resolve-notify", "Send Resolution Notification", "automation", 2),
                    ]),
                ], on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-3", "created_at": "2026-03-22T11:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_30, "sla_days_remaining": 22, "escalation_level": 0,
        },

        # ── Dispute case 2: in Chargeback stage (high-value, issuing chargeback) ──
        {
            "_id": "CCD-002", "case_type_id": "ct-cc-dispute", "case_type_name": "Credit Card Dispute Transaction",
            "title": "Dispute - Wrong Charge Amount (James Rivera)", "status": "in_progress", "priority": "high",
            "owner_id": "user-1", "team_id": "team-1",
            "custom_fields": {"cardholderName": "James Rivera", "cardLastFour": "3356", "merchantName": "Luxury Stays Hotel",
                              "disputedAmount": 2875.00, "disputeReason": "Billing error / wrong amount",
                              "merchantResponded": True, "chargebackIssued": False},
            "current_stage_id": "stg-chargeback", "current_process_id": "proc-chargeback",
            "current_step_id": "stp-issue-chargeback",
            "stages": [
                _rt_stage("stg-intake", "Dispute Intake", 1, [
                    _rt_proc("proc-file-dispute", "File Dispute", 1, [
                        _rt_step("stp-dispute-form", "Dispute Details", "assignment", 1,
                                 status="completed", started_at="2026-03-05T10:00:00Z",
                                 completed_at="2026-03-05T10:30:00Z", assigned_to="user-2"),
                        _rt_step("stp-upload-docs", "Upload Supporting Documents", "attachment", 2,
                                 status="completed", started_at="2026-03-05T10:30:00Z",
                                 completed_at="2026-03-06T14:00:00Z"),
                    ], status="completed", started_at="2026-03-05T10:00:00Z",
                       completed_at="2026-03-06T14:00:00Z"),
                ], status="completed", entered_at="2026-03-05T10:00:00Z",
                   completed_at="2026-03-06T14:00:00Z", completed_by="user-2"),
                _rt_stage("stg-review", "Investigation & Merchant Contact", 2, [
                    _rt_proc("proc-investigate", "Investigate Dispute", 1, [
                        _rt_step("stp-verify-charge", "Verify Charge Details", "assignment", 1,
                                 status="completed", started_at="2026-03-06T14:00:00Z",
                                 completed_at="2026-03-10T16:00:00Z", assigned_to="user-3"),
                    ], status="completed", started_at="2026-03-06T14:00:00Z",
                       completed_at="2026-03-10T16:00:00Z"),
                    _rt_proc("proc-dispute-decision", "Dispute Decision", 2, [
                        _rt_step("stp-dispute-route", "Dispute Routing", "decision", 1,
                                 status="completed", started_at="2026-03-10T16:00:00Z",
                                 completed_at="2026-03-10T16:00:00Z"),
                        _rt_step("stp-mgr-approval", "Manager Dispute Approval", "approval", 2,
                                 status="completed", started_at="2026-03-10T16:00:00Z",
                                 completed_at="2026-03-12T10:00:00Z", assigned_to="user-1"),
                        _rt_step("stp-senior-approval", "Senior Dispute Approval", "approval", 3,
                                 status="skipped"),
                    ], status="completed", started_at="2026-03-10T16:00:00Z",
                       completed_at="2026-03-12T10:00:00Z"),
                ], status="completed", entered_at="2026-03-06T14:00:00Z",
                   completed_at="2026-03-12T10:00:00Z", completed_by="user-1"),
                _rt_stage("stg-chargeback", "Chargeback & Resolution", 3, [
                    _rt_proc("proc-chargeback", "Process Chargeback", 1, [
                        _rt_step("stp-issue-chargeback", "Issue Chargeback", "assignment", 1,
                                 status="in_progress", started_at="2026-03-12T10:00:00Z",
                                 assigned_to="user-1"),
                        _rt_step("stp-resolve-notify", "Send Resolution Notification", "automation", 2),
                    ], status="in_progress", started_at="2026-03-12T10:00:00Z"),
                ], status="in_progress", entered_at="2026-03-12T10:00:00Z",
                   on_complete="resolve_case", resolution_status="resolved_completed"),
            ],
            "created_by": "user-1", "created_at": "2026-03-05T10:00:00Z", "updated_at": now,
            "resolved_at": None, "resolution_status": None, "parent_case_id": None, "parent_step_id": None,
            "sla_target_date": sla_20, "sla_days_remaining": 6, "escalation_level": 0,
        },
    ]
    await db.cases.insert_many(cases)

    # ═══════════════════════════════════════════════════════════
    # ASSIGNMENTS (materialized worklist)
    # ═══════════════════════════════════════════════════════════
    assignments = [
        # LOAN-001: step-upload-docs waiting
        {"_id": "asgn-1", "case_id": "LOAN-001", "case_type_id": "ct-loan",
         "stage_id": "stage-docs", "process_id": "proc-docs",
         "step_definition_id": "step-upload-docs", "step_name": "Upload Documents",
         "step_type": "attachment", "assigned_to": None, "assigned_role": "WORKER",
         "status": "open", "priority": "high",
         "created_at": "2026-02-02T14:00:00Z", "due_at": "2026-02-05T14:00:00Z",
         "completed_at": None, "completed_by": None},
        # LOAN-002: step-risk-review assigned to Alice
        {"_id": "asgn-2", "case_id": "LOAN-002", "case_type_id": "ct-loan",
         "stage_id": "stage-underwriting", "process_id": "proc-risk",
         "step_definition_id": "step-risk-review", "step_name": "Risk Review",
         "step_type": "assignment", "assigned_to": "user-1", "assigned_role": "MANAGER",
         "status": "in_progress", "priority": "medium",
         "created_at": "2026-01-22T16:00:00Z", "due_at": "2026-01-24T16:00:00Z",
         "completed_at": None, "completed_by": None},
        # LOAN-003: step-vp-approval assigned to Admin
        {"_id": "asgn-3", "case_id": "LOAN-003", "case_type_id": "ct-loan",
         "stage_id": "stage-underwriting", "process_id": "proc-decision",
         "step_definition_id": "step-vp-approval", "step_name": "VP Approval",
         "step_type": "approval", "assigned_to": "user-admin", "assigned_role": "ADMIN",
         "status": "in_progress", "priority": "critical",
         "created_at": "2026-01-15T09:00:00Z", "due_at": "2026-01-17T09:00:00Z",
         "completed_at": None, "completed_by": None},
        # KYC-001: step-verify-id assigned to Carol
        {"_id": "asgn-4", "case_id": "KYC-001", "case_type_id": "ct-kyc",
         "stage_id": "stage-id-verify", "process_id": "proc-id-verify",
         "step_definition_id": "step-verify-id", "step_name": "Verify Identity",
         "step_type": "assignment", "assigned_to": "user-3", "assigned_role": "WORKER",
         "status": "in_progress", "priority": "high",
         "created_at": "2026-03-02T09:30:00Z", "due_at": "2026-03-03T09:30:00Z",
         "completed_at": None, "completed_by": None},
        # KYC-002: step-edd assigned to Alice
        {"_id": "asgn-5", "case_id": "KYC-002", "case_type_id": "ct-kyc",
         "stage_id": "stage-risk", "process_id": "proc-risk-assess",
         "step_definition_id": "step-edd", "step_name": "Enhanced Due Diligence",
         "step_type": "assignment", "assigned_to": "user-1", "assigned_role": "MANAGER",
         "status": "in_progress", "priority": "critical",
         "created_at": "2026-02-22T16:00:00Z", "due_at": "2026-02-25T16:00:00Z",
         "completed_at": None, "completed_by": None},
        # KYC-003: step-create-acct assigned to Carol
        {"_id": "asgn-6", "case_id": "KYC-003", "case_type_id": "ct-kyc",
         "stage_id": "stage-acct-setup", "process_id": "proc-acct-setup",
         "step_definition_id": "step-create-acct", "step_name": "Create Account",
         "step_type": "assignment", "assigned_to": "user-3", "assigned_role": "WORKER",
         "status": "in_progress", "priority": "low",
         "created_at": "2026-02-11T14:00:00Z", "due_at": "2026-02-12T14:00:00Z",
         "completed_at": None, "completed_by": None},
        # CLM-001: step-gather-evidence assigned to Bob
        {"_id": "asgn-7", "case_id": "CLM-001", "case_type_id": "ct-claims",
         "stage_id": "stage-investigation", "process_id": "proc-investigate",
         "step_definition_id": "step-gather-evidence", "step_name": "Gather Evidence",
         "step_type": "assignment", "assigned_to": "user-2", "assigned_role": "WORKER",
         "status": "in_progress", "priority": "high",
         "created_at": "2026-03-05T11:30:00Z", "due_at": "2026-03-09T11:30:00Z",
         "completed_at": None, "completed_by": None},
        # CLM-002: step-senior-review assigned to Admin
        {"_id": "asgn-8", "case_id": "CLM-002", "case_type_id": "ct-claims",
         "stage_id": "stage-adjudicate", "process_id": "proc-adjudicate",
         "step_definition_id": "step-senior-review", "step_name": "Senior Review",
         "step_type": "approval", "assigned_to": "user-admin", "assigned_role": "ADMIN",
         "status": "in_progress", "priority": "critical",
         "created_at": "2026-02-20T16:00:00Z", "due_at": "2026-02-22T16:00:00Z",
         "completed_at": None, "completed_by": None},
        # CLM-003: step-calc-payout assigned to Bob
        {"_id": "asgn-9", "case_id": "CLM-003", "case_type_id": "ct-claims",
         "stage_id": "stage-settlement", "process_id": "proc-settle",
         "step_definition_id": "step-calc-payout", "step_name": "Calculate Payout",
         "step_type": "assignment", "assigned_to": "user-2", "assigned_role": "WORKER",
         "status": "in_progress", "priority": "medium",
         "created_at": "2026-02-05T09:00:00Z", "due_at": "2026-02-07T09:00:00Z",
         "completed_at": None, "completed_by": None},
        # CCS-001: stp-flag-transactions assigned to Bob
        {"_id": "asgn-10", "case_id": "CCS-001", "case_type_id": "ct-cc-stolen",
         "stage_id": "stg-investigate", "process_id": "proc-review-txns",
         "step_definition_id": "stp-flag-transactions", "step_name": "Flag Unauthorized Transactions",
         "step_type": "assignment", "assigned_to": "user-2", "assigned_role": "WORKER",
         "status": "in_progress", "priority": "high",
         "created_at": "2026-03-20T09:15:00Z", "due_at": "2026-03-22T09:15:00Z",
         "completed_at": None, "completed_by": None},
        # CCS-002: stp-process-refund assigned to Alice
        {"_id": "asgn-11", "case_id": "CCS-002", "case_type_id": "ct-cc-stolen",
         "stage_id": "stg-resolution", "process_id": "proc-refund",
         "step_definition_id": "stp-process-refund", "step_name": "Issue Provisional Credit",
         "step_type": "assignment", "assigned_to": "user-1", "assigned_role": "MANAGER",
         "status": "in_progress", "priority": "critical",
         "created_at": "2026-03-15T11:00:00Z", "due_at": "2026-03-16T11:00:00Z",
         "completed_at": None, "completed_by": None},
        # CCD-001: stp-verify-charge assigned to Bob
        {"_id": "asgn-12", "case_id": "CCD-001", "case_type_id": "ct-cc-dispute",
         "stage_id": "stg-review", "process_id": "proc-investigate",
         "step_definition_id": "stp-verify-charge", "step_name": "Verify Charge Details",
         "step_type": "assignment", "assigned_to": "user-2", "assigned_role": "WORKER",
         "status": "in_progress", "priority": "medium",
         "created_at": "2026-03-23T09:00:00Z", "due_at": "2026-03-28T09:00:00Z",
         "completed_at": None, "completed_by": None},
        # CCD-002: stp-issue-chargeback assigned to Alice
        {"_id": "asgn-13", "case_id": "CCD-002", "case_type_id": "ct-cc-dispute",
         "stage_id": "stg-chargeback", "process_id": "proc-chargeback",
         "step_definition_id": "stp-issue-chargeback", "step_name": "Issue Chargeback",
         "step_type": "assignment", "assigned_to": "user-1", "assigned_role": "MANAGER",
         "status": "in_progress", "priority": "high",
         "created_at": "2026-03-12T10:00:00Z", "due_at": "2026-03-13T10:00:00Z",
         "completed_at": None, "completed_by": None},
    ]
    await db.assignments.insert_many(assignments)

    # ─── Tasks (legacy — retained for backward compat) ──────
    tasks = [
        # Loan tasks
        {"_id": "task-1", "caseId": "LOAN-001", "title": "Collect income verification",
         "description": "Request and verify applicant income documents (W-2, pay stubs)",
         "assigneeId": "user-2", "teamId": "team-1", "status": "in_progress", "priority": "high",
         "dueDate": "2026-03-20T00:00:00Z", "dependsOn": [], "tags": ["documents", "verification"],
         "checklist": [
             {"id": "cl-1", "item": "Request W-2 forms", "checked": True, "completedAt": "2026-02-03T10:00:00Z"},
             {"id": "cl-2", "item": "Request pay stubs (3 months)", "checked": True, "completedAt": "2026-02-03T10:00:00Z"},
             {"id": "cl-3", "item": "Verify income matches application", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-02T14:00:00Z", "updatedAt": "2026-02-05T09:00:00Z", "completedAt": None},
        {"_id": "task-2", "caseId": "LOAN-001", "title": "Property appraisal",
         "description": "Order and review property appraisal report",
         "assigneeId": "user-1", "teamId": "team-1", "status": "pending", "priority": "medium",
         "dueDate": "2026-03-25T00:00:00Z", "dependsOn": ["task-1"], "tags": ["appraisal"],
         "checklist": [
             {"id": "cl-4", "item": "Order appraisal", "checked": False, "completedAt": None},
             {"id": "cl-5", "item": "Review appraisal report", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-02T14:00:00Z", "updatedAt": "2026-02-02T14:00:00Z", "completedAt": None},
        {"_id": "task-3", "caseId": "LOAN-002", "title": "Credit check review",
         "description": "Review applicant credit report and score",
         "assigneeId": "user-2", "teamId": "team-1", "status": "completed", "priority": "high",
         "dueDate": "2026-02-01T00:00:00Z", "dependsOn": [], "tags": ["credit", "underwriting"],
         "checklist": [
             {"id": "cl-6", "item": "Pull credit report", "checked": True, "completedAt": "2026-01-21T11:00:00Z"},
             {"id": "cl-7", "item": "Verify score meets threshold", "checked": True, "completedAt": "2026-01-22T09:00:00Z"},
         ],
         "createdAt": "2026-01-20T11:00:00Z", "updatedAt": "2026-01-22T09:00:00Z", "completedAt": "2026-01-22T09:00:00Z"},
        {"_id": "task-4", "caseId": "LOAN-003", "title": "Final approval review",
         "description": "VP review and sign-off for commercial loan",
         "assigneeId": "user-1", "teamId": "team-1", "status": "blocked", "priority": "critical",
         "dueDate": "2026-02-01T00:00:00Z", "dependsOn": [], "tags": ["approval", "commercial"],
         "checklist": [
             {"id": "cl-8", "item": "Prepare approval packet", "checked": True, "completedAt": "2026-01-16T10:00:00Z"},
             {"id": "cl-9", "item": "Schedule VP review meeting", "checked": False, "completedAt": None},
             {"id": "cl-10", "item": "Obtain VP signature", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-01-15T09:00:00Z", "updatedAt": "2026-01-18T14:00:00Z", "completedAt": None},
        {"_id": "task-5", "caseId": "LOAN-002", "title": "Risk assessment",
         "description": "Complete risk assessment for personal loan underwriting",
         "assigneeId": "user-2", "teamId": "team-1", "status": "in_progress", "priority": "medium",
         "dueDate": "2026-03-10T00:00:00Z", "dependsOn": ["task-3"], "tags": ["underwriting", "risk"],
         "checklist": [
             {"id": "cl-11", "item": "Calculate debt-to-income ratio", "checked": True, "completedAt": "2026-01-23T10:00:00Z"},
             {"id": "cl-12", "item": "Assess collateral value", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-01-22T16:00:00Z", "updatedAt": "2026-01-25T11:00:00Z", "completedAt": None},
        # KYC tasks
        {"_id": "task-6", "caseId": "KYC-001", "title": "Verify government ID",
         "description": "Scan and validate government-issued photo ID",
         "assigneeId": "user-3", "teamId": "team-2", "status": "in_progress", "priority": "high",
         "dueDate": "2026-03-18T00:00:00Z", "dependsOn": [], "tags": ["kyc", "identity"],
         "checklist": [
             {"id": "cl-13", "item": "Scan passport or drivers license", "checked": True, "completedAt": "2026-03-02T09:00:00Z"},
             {"id": "cl-14", "item": "Run facial recognition match", "checked": False, "completedAt": None},
             {"id": "cl-15", "item": "Verify document authenticity", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-03-01T11:00:00Z", "updatedAt": "2026-03-02T09:00:00Z", "completedAt": None},
        {"_id": "task-7", "caseId": "KYC-002", "title": "Enhanced due diligence",
         "description": "Perform enhanced due diligence for high-risk corporate entity",
         "assigneeId": "user-1", "teamId": "team-2", "status": "in_progress", "priority": "critical",
         "dueDate": "2026-03-15T00:00:00Z", "dependsOn": [], "tags": ["kyc", "risk", "edd"],
         "checklist": [
             {"id": "cl-16", "item": "Verify beneficial ownership", "checked": True, "completedAt": "2026-02-23T10:00:00Z"},
             {"id": "cl-17", "item": "Screen against sanctions lists", "checked": True, "completedAt": "2026-02-23T14:00:00Z"},
             {"id": "cl-18", "item": "Assess source of funds", "checked": False, "completedAt": None},
             {"id": "cl-19", "item": "Prepare risk report", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-22T16:00:00Z", "updatedAt": "2026-02-23T14:00:00Z", "completedAt": None},
        {"_id": "task-8", "caseId": "KYC-003", "title": "Configure account",
         "description": "Set up savings account with proper tier and interest rate",
         "assigneeId": "user-3", "teamId": "team-2", "status": "pending", "priority": "low",
         "dueDate": "2026-03-20T00:00:00Z", "dependsOn": [], "tags": ["account", "setup"],
         "checklist": [
             {"id": "cl-20", "item": "Create account in core banking", "checked": False, "completedAt": None},
             {"id": "cl-21", "item": "Set up online banking access", "checked": False, "completedAt": None},
             {"id": "cl-22", "item": "Mail welcome kit", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-11T14:00:00Z", "updatedAt": "2026-02-11T14:00:00Z", "completedAt": None},
        # Insurance Claims tasks
        {"_id": "task-9", "caseId": "CLM-001", "title": "Obtain repair estimate",
         "description": "Get certified repair estimate from approved body shop",
         "assigneeId": "user-2", "teamId": "team-3", "status": "in_progress", "priority": "high",
         "dueDate": "2026-03-20T00:00:00Z", "dependsOn": [], "tags": ["investigation", "auto"],
         "checklist": [
             {"id": "cl-23", "item": "Contact approved body shop", "checked": True, "completedAt": "2026-03-06T09:00:00Z"},
             {"id": "cl-24", "item": "Schedule vehicle inspection", "checked": True, "completedAt": "2026-03-06T14:00:00Z"},
             {"id": "cl-25", "item": "Collect written estimate", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-03-05T11:30:00Z", "updatedAt": "2026-03-06T14:00:00Z", "completedAt": None},
        {"_id": "task-10", "caseId": "CLM-002", "title": "Review structural engineer report",
         "description": "Analyze structural damage assessment for property claim",
         "assigneeId": "user-3", "teamId": "team-3", "status": "in_progress", "priority": "critical",
         "dueDate": "2026-03-10T00:00:00Z", "dependsOn": [], "tags": ["adjudication", "property"],
         "checklist": [
             {"id": "cl-26", "item": "Review engineer findings", "checked": True, "completedAt": "2026-02-21T10:00:00Z"},
             {"id": "cl-27", "item": "Validate damage photographs", "checked": True, "completedAt": "2026-02-21T14:00:00Z"},
             {"id": "cl-28", "item": "Compare against policy coverage", "checked": False, "completedAt": None},
             {"id": "cl-29", "item": "Prepare adjudication recommendation", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-20T16:00:00Z", "updatedAt": "2026-02-21T14:00:00Z", "completedAt": None},
        {"_id": "task-11", "caseId": "CLM-003", "title": "Process settlement payment",
         "description": "Issue settlement payment to claimant bank account",
         "assigneeId": "user-2", "teamId": "team-3", "status": "pending", "priority": "medium",
         "dueDate": "2026-03-15T00:00:00Z", "dependsOn": [], "tags": ["settlement", "payment"],
         "checklist": [
             {"id": "cl-30", "item": "Verify claimant bank details", "checked": False, "completedAt": None},
             {"id": "cl-31", "item": "Initiate wire transfer", "checked": False, "completedAt": None},
             {"id": "cl-32", "item": "Send payment confirmation", "checked": False, "completedAt": None},
         ],
         "createdAt": "2026-02-05T09:00:00Z", "updatedAt": "2026-02-05T09:00:00Z", "completedAt": None},
        {"_id": "task-12", "caseId": "CLM-001", "title": "Review police report",
         "description": "Verify police report details match claim submission",
         "assigneeId": "user-3", "teamId": "team-3", "status": "completed", "priority": "high",
         "dueDate": "2026-03-10T00:00:00Z", "dependsOn": [], "tags": ["investigation", "verification"],
         "checklist": [
             {"id": "cl-33", "item": "Obtain police report copy", "checked": True, "completedAt": "2026-03-05T14:00:00Z"},
             {"id": "cl-34", "item": "Cross-reference with claim details", "checked": True, "completedAt": "2026-03-05T16:00:00Z"},
         ],
         "createdAt": "2026-03-05T11:30:00Z", "updatedAt": "2026-03-05T16:00:00Z", "completedAt": "2026-03-05T16:00:00Z"},
    ]
    await db.tasks.insert_many(tasks)

    # ─── Comments ───────────────────────────────
    comments = [
        {"_id": "comment-1", "caseId": "LOAN-001", "taskId": None, "userId": "user-1", "userName": "Alice Johnson",
         "userAvatar": None, "text": "Requested income verification from applicant.", "mentions": [],
         "createdAt": "2026-02-02T14:30:00Z", "updatedAt": "2026-02-02T14:30:00Z"},
        {"_id": "comment-2", "caseId": "LOAN-003", "taskId": None, "userId": "user-2", "userName": "Bob Smith",
         "userAvatar": None, "text": "Underwriting completed. @Alice please review for approval.",
         "mentions": [{"id": "user-1", "name": "Alice Johnson"}],
         "createdAt": "2026-01-15T09:15:00Z", "updatedAt": "2026-01-15T09:15:00Z"},
        {"_id": "comment-3", "caseId": "KYC-002", "taskId": None, "userId": "user-1", "userName": "Alice Johnson",
         "userAvatar": None, "text": "Enhanced due diligence required for this corporate entity. @Carol please run sanctions screening.",
         "mentions": [{"id": "user-3", "name": "Carol Davis"}],
         "createdAt": "2026-02-22T17:00:00Z", "updatedAt": "2026-02-22T17:00:00Z"},
        {"_id": "comment-4", "caseId": "CLM-002", "taskId": None, "userId": "user-3", "userName": "Carol Davis",
         "userAvatar": None, "text": "Structural engineer report received. Damage is extensive — recommending full coverage payout.",
         "mentions": [], "createdAt": "2026-02-21T10:30:00Z", "updatedAt": "2026-02-21T10:30:00Z"},
        {"_id": "comment-5", "caseId": "CLM-003", "taskId": None, "userId": "user-2", "userName": "Bob Smith",
         "userAvatar": None, "text": "Claim approved. Waiting for claimant to provide bank details for settlement.",
         "mentions": [], "createdAt": "2026-02-05T09:30:00Z", "updatedAt": "2026-02-05T09:30:00Z"},
    ]
    await db.comments.insert_many(comments)

    # ─── Notifications ──────────────────────────
    notifications = [
        {"_id": "notif-1", "userId": "user-1", "type": "assignment", "title": "New Case Assigned",
         "message": "You have been assigned case #LOAN-001 (Loan - John Doe)", "entityType": "case", "entityId": "LOAN-001",
         "isRead": True, "readAt": "2026-02-01T10:30:00Z", "createdAt": "2026-02-01T10:00:00Z"},
        {"_id": "notif-2", "userId": "user-1", "type": "sla_warning", "title": "SLA Warning - Case #LOAN-003",
         "message": "Case #LOAN-003 (Acme Corp) has only 5 days remaining before SLA breach",
         "entityType": "case", "entityId": "LOAN-003", "isRead": False, "readAt": None, "createdAt": "2026-03-05T08:00:00Z"},
        {"_id": "notif-3", "userId": "user-1", "type": "mention", "title": "You were mentioned",
         "message": "Bob Smith mentioned you in a comment on case #LOAN-003",
         "entityType": "case", "entityId": "LOAN-003", "isRead": False, "readAt": None, "createdAt": "2026-01-15T09:15:00Z"},
        {"_id": "notif-4", "userId": "user-3", "type": "assignment", "title": "New Case Assigned",
         "message": "You have been assigned case #KYC-001 (KYC - Michael Chen)",
         "entityType": "case", "entityId": "KYC-001", "isRead": True, "readAt": "2026-03-01T09:30:00Z", "createdAt": "2026-03-01T09:00:00Z"},
        {"_id": "notif-5", "userId": "user-3", "type": "mention", "title": "You were mentioned",
         "message": "Alice Johnson mentioned you in a comment on case #KYC-002",
         "entityType": "case", "entityId": "KYC-002", "isRead": False, "readAt": None, "createdAt": "2026-02-22T17:00:00Z"},
        {"_id": "notif-6", "userId": "user-2", "type": "assignment", "title": "New Case Assigned",
         "message": "You have been assigned case #CLM-001 (Claims - Robert Taylor)",
         "entityType": "case", "entityId": "CLM-001", "isRead": True, "readAt": "2026-03-05T10:30:00Z", "createdAt": "2026-03-05T10:00:00Z"},
        {"_id": "notif-7", "userId": "user-3", "type": "sla_warning", "title": "SLA Warning - Case #CLM-002",
         "message": "Case #CLM-002 (Maria Garcia property claim) has only 4 days remaining",
         "entityType": "case", "entityId": "CLM-002", "isRead": False, "readAt": None, "createdAt": "2026-03-10T08:00:00Z"},
    ]
    await db.notifications.insert_many(notifications)

    # ─── Workflows ──────────────────────────────
    workflows = [
        {
            "_id": "wf-loan", "name": "Loan Origination Workflow",
            "description": "Standard loan processing workflow from intake to disbursement",
            "case_type_id": "ct-loan",
            "definition": {
                "nodes": [
                    {"id": "n-start", "type": "start", "label": "Start", "position": {"x": 50, "y": 200}},
                    {"id": "n-intake", "type": "task", "label": "Intake Review", "position": {"x": 220, "y": 200}, "assigneeRole": "WORKER", "formId": "form-loan-intake"},
                    {"id": "n-docs", "type": "task", "label": "Document Collection", "position": {"x": 400, "y": 200}, "assigneeRole": "WORKER"},
                    {"id": "n-uw", "type": "task", "label": "Underwriting", "position": {"x": 580, "y": 200}, "assigneeRole": "WORKER"},
                    {"id": "n-decision", "type": "decision", "label": "Approval?", "position": {"x": 760, "y": 200}},
                    {"id": "n-approve", "type": "task", "label": "VP Approval", "position": {"x": 940, "y": 100}, "assigneeRole": "MANAGER"},
                    {"id": "n-disburse", "type": "task", "label": "Disbursement", "position": {"x": 1100, "y": 200}, "assigneeRole": "WORKER"},
                    {"id": "n-end", "type": "end", "label": "End", "position": {"x": 1280, "y": 200}},
                ],
                "edges": [
                    {"id": "e-1", "source": "n-start", "target": "n-intake"},
                    {"id": "e-2", "source": "n-intake", "target": "n-docs"},
                    {"id": "e-3", "source": "n-docs", "target": "n-uw"},
                    {"id": "e-4", "source": "n-uw", "target": "n-decision"},
                    {"id": "e-5", "source": "n-decision", "target": "n-approve", "label": "High value"},
                    {"id": "e-6", "source": "n-decision", "target": "n-disburse", "label": "Standard"},
                    {"id": "e-7", "source": "n-approve", "target": "n-disburse"},
                    {"id": "e-8", "source": "n-disburse", "target": "n-end"},
                ],
            },
            "version": 1, "is_active": True, "created_by": "user-admin", "created_at": "2025-01-15T00:00:00.000Z",
        },
        {
            "_id": "wf-kyc", "name": "Customer Onboarding Workflow",
            "description": "KYC verification and account setup workflow",
            "case_type_id": "ct-kyc",
            "definition": {
                "nodes": [
                    {"id": "n-start", "type": "start", "label": "Start", "position": {"x": 50, "y": 200}},
                    {"id": "n-app", "type": "task", "label": "Application Review", "position": {"x": 220, "y": 200}, "assigneeRole": "WORKER", "formId": "form-kyc-intake"},
                    {"id": "n-id", "type": "task", "label": "Identity Verification", "position": {"x": 420, "y": 200}, "assigneeRole": "WORKER"},
                    {"id": "n-risk", "type": "task", "label": "Risk Assessment", "position": {"x": 620, "y": 200}, "assigneeRole": "MANAGER"},
                    {"id": "n-decision", "type": "decision", "label": "Risk Level?", "position": {"x": 820, "y": 200}},
                    {"id": "n-setup", "type": "task", "label": "Account Setup", "position": {"x": 1020, "y": 200}, "assigneeRole": "WORKER"},
                    {"id": "n-welcome", "type": "task", "label": "Welcome", "position": {"x": 1200, "y": 200}, "assigneeRole": "WORKER"},
                    {"id": "n-end", "type": "end", "label": "End", "position": {"x": 1380, "y": 200}},
                ],
                "edges": [
                    {"id": "e-1", "source": "n-start", "target": "n-app"},
                    {"id": "e-2", "source": "n-app", "target": "n-id"},
                    {"id": "e-3", "source": "n-id", "target": "n-risk"},
                    {"id": "e-4", "source": "n-risk", "target": "n-decision"},
                    {"id": "e-5", "source": "n-decision", "target": "n-setup", "label": "Approved"},
                    {"id": "e-6", "source": "n-decision", "target": "n-app", "label": "Rejected"},
                    {"id": "e-7", "source": "n-setup", "target": "n-welcome"},
                    {"id": "e-8", "source": "n-welcome", "target": "n-end"},
                ],
            },
            "version": 1, "is_active": True, "created_by": "user-admin", "created_at": "2025-01-15T00:00:00.000Z",
        },
        {
            "_id": "wf-claims", "name": "Insurance Claims Workflow",
            "description": "End-to-end insurance claims processing",
            "case_type_id": "ct-claims",
            "definition": {
                "nodes": [
                    {"id": "n-start", "type": "start", "label": "Start", "position": {"x": 50, "y": 200}},
                    {"id": "n-intake", "type": "task", "label": "Claim Intake", "position": {"x": 220, "y": 200}, "assigneeRole": "WORKER", "formId": "form-claims-intake"},
                    {"id": "n-investigate", "type": "task", "label": "Investigation", "position": {"x": 420, "y": 200}, "assigneeRole": "WORKER"},
                    {"id": "n-adjudicate", "type": "task", "label": "Adjudication", "position": {"x": 620, "y": 200}, "assigneeRole": "MANAGER"},
                    {"id": "n-decision", "type": "decision", "label": "Covered?", "position": {"x": 820, "y": 200}},
                    {"id": "n-settle", "type": "task", "label": "Settlement", "position": {"x": 1020, "y": 100}, "assigneeRole": "WORKER"},
                    {"id": "n-close", "type": "task", "label": "Closure", "position": {"x": 1020, "y": 300}, "assigneeRole": "WORKER"},
                    {"id": "n-end", "type": "end", "label": "End", "position": {"x": 1200, "y": 200}},
                ],
                "edges": [
                    {"id": "e-1", "source": "n-start", "target": "n-intake"},
                    {"id": "e-2", "source": "n-intake", "target": "n-investigate"},
                    {"id": "e-3", "source": "n-investigate", "target": "n-adjudicate"},
                    {"id": "e-4", "source": "n-adjudicate", "target": "n-decision"},
                    {"id": "e-5", "source": "n-decision", "target": "n-settle", "label": "Approved"},
                    {"id": "e-6", "source": "n-decision", "target": "n-close", "label": "Denied"},
                    {"id": "e-7", "source": "n-settle", "target": "n-close"},
                    {"id": "e-8", "source": "n-close", "target": "n-end"},
                ],
            },
            "version": 1, "is_active": True, "created_by": "user-admin", "created_at": "2025-01-15T00:00:00.000Z",
        },
    ]
    await db.workflows.insert_many(workflows)

    # ─── Flow Definitions (Questionnaire Flows) ─────
    await _seed_flow_definitions(db)


    # ─── Approval Chains ────────────────────────
    approval_chains = [
        # LOAN-003: sequential, partially approved (pending VP approval)
        {"_id": "approval-1", "case_id": "LOAN-003", "workflow_id": "wf-loan", "mode": "sequential",
         "approvers": [
             {"user_id": "user-1", "user_name": "Alice Johnson", "sequence": 0, "status": "approved",
              "decision_at": "2026-01-16T10:00:00Z", "decision_notes": "Financials look strong — DTI ratio within limits"},
             {"user_id": "user-admin", "user_name": "Admin User", "sequence": 1, "status": "pending",
              "decision_at": None, "decision_notes": None},
         ],
         "status": "pending", "created_by": "user-2", "created_at": "2026-01-15T09:30:00Z", "completed_at": None},

        # CLM-002: sequential, partially approved (pending final approval)
        {"_id": "approval-2", "case_id": "CLM-002", "workflow_id": "wf-claims", "mode": "sequential",
         "approvers": [
             {"user_id": "user-3", "user_name": "Carol Davis", "sequence": 0, "status": "approved",
              "decision_at": "2026-02-21T15:00:00Z", "decision_notes": "Engineer report confirms structural damage"},
             {"user_id": "user-admin", "user_name": "Admin User", "sequence": 1, "status": "pending",
              "decision_at": None, "decision_notes": None},
         ],
         "status": "pending", "created_by": "user-3", "created_at": "2026-02-20T16:30:00Z", "completed_at": None},

        # LOAN-002: parallel, fully approved
        {"_id": "approval-3", "case_id": "LOAN-002", "workflow_id": "wf-loan", "mode": "parallel",
         "approvers": [
             {"user_id": "user-1", "user_name": "Alice Johnson", "sequence": 0, "status": "approved",
              "decision_at": "2026-02-01T14:30:00Z", "decision_notes": "Income verified, all clear"},
             {"user_id": "user-2", "user_name": "Bob Smith", "sequence": 1, "status": "approved",
              "decision_at": "2026-02-01T16:00:00Z", "decision_notes": "Document completeness confirmed"},
             {"user_id": "user-admin", "user_name": "Admin User", "sequence": 2, "status": "approved",
              "decision_at": "2026-02-02T09:00:00Z", "decision_notes": "Final sign-off granted"},
         ],
         "status": "approved", "created_by": "user-1", "created_at": "2026-02-01T10:00:00Z",
         "completed_at": "2026-02-02T09:00:00Z"},

        # KYC-002: sequential, rejected
        {"_id": "approval-4", "case_id": "KYC-002", "workflow_id": "wf-kyc", "mode": "sequential",
         "approvers": [
             {"user_id": "user-1", "user_name": "Alice Johnson", "sequence": 0, "status": "rejected",
              "decision_at": "2026-03-01T11:00:00Z",
              "decision_notes": "Insufficient identity documentation — additional proof of address required"},
             {"user_id": "user-admin", "user_name": "Admin User", "sequence": 1, "status": "pending",
              "decision_at": None, "decision_notes": None},
         ],
         "status": "rejected", "created_by": "user-3", "created_at": "2026-02-28T14:00:00Z",
         "completed_at": "2026-03-01T11:00:00Z"},

        # CLM-003: parallel, all pending
        {"_id": "approval-5", "case_id": "CLM-003", "workflow_id": "wf-claims", "mode": "parallel",
         "approvers": [
             {"user_id": "user-2", "user_name": "Bob Smith", "sequence": 0, "status": "pending",
              "decision_at": None, "decision_notes": None},
             {"user_id": "user-3", "user_name": "Carol Davis", "sequence": 1, "status": "pending",
              "decision_at": None, "decision_notes": None},
         ],
         "status": "pending", "created_by": "user-admin", "created_at": "2026-03-10T08:00:00Z", "completed_at": None},

        # LOAN-001: sequential with delegation
        {"_id": "approval-6", "case_id": "LOAN-001", "workflow_id": "wf-loan", "mode": "sequential",
         "approvers": [
             {"user_id": "user-3", "user_name": "Carol Davis", "sequence": 0, "status": "approved",
              "decision_at": "2026-03-05T10:00:00Z", "decision_notes": "Initial review passed"},
             {"user_id": "user-1", "user_name": "Alice Johnson", "sequence": 1, "status": "delegated",
              "delegated_to": "user-2", "decision_at": "2026-03-05T14:00:00Z",
              "decision_notes": "Delegating to Bob — on leave this week"},
             {"user_id": "user-admin", "user_name": "Admin User", "sequence": 2, "status": "pending",
              "decision_at": None, "decision_notes": None},
         ],
         "status": "pending", "created_by": "user-2", "created_at": "2026-03-04T09:00:00Z", "completed_at": None},
    ]
    await db.approval_chains.insert_many(approval_chains)

    # ─── SLA Definitions ────────────────────────
    sla_definitions = [
        {"_id": "sla-loan-intake", "case_type_id": "ct-loan", "stage_id": "stage-intake", "stage_label": "Intake Review",
         "hours_target": 24, "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-loan-docs", "case_type_id": "ct-loan", "stage_id": "stage-docs", "stage_label": "Document Collection",
         "hours_target": 72, "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-loan-uw", "case_type_id": "ct-loan", "stage_id": "stage-underwriting", "stage_label": "Underwriting",
         "hours_target": 120, "escalation_enabled": True, "escalate_to_role": "ADMIN", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-kyc-app", "case_type_id": "ct-kyc", "stage_id": "stage-app-review", "stage_label": "Application Review",
         "hours_target": 12, "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-kyc-id", "case_type_id": "ct-kyc", "stage_id": "stage-id-verify", "stage_label": "Identity Verification",
         "hours_target": 48, "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-claims-intake", "case_type_id": "ct-claims", "stage_id": "stage-intake", "stage_label": "Claim Intake",
         "hours_target": 8, "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "sla-claims-investigate", "case_type_id": "ct-claims", "stage_id": "stage-investigation", "stage_label": "Investigation",
         "hours_target": 96, "escalation_enabled": True, "escalate_to_role": "MANAGER", "created_at": "2025-01-15T00:00:00.000Z"},
    ]
    await db.sla_definitions.insert_many(sla_definitions)

    # ─── Form Definitions ───────────────────────
    form_definitions = [
        {
            "_id": "form-loan-intake", "name": "Loan Intake Form", "case_type_id": "ct-loan", "stage": "intake",
            "description": "Initial loan application intake form",
            "sections": [
                {"id": "sec-applicant", "title": "Applicant Information", "order": 0},
                {"id": "sec-loan", "title": "Loan Details", "order": 1},
            ],
            "fields": [
                {"id": "f-name", "type": "text", "label": "Applicant Name", "placeholder": "Full legal name", "order": 0, "section": "sec-applicant", "validation": {"required": True, "minLength": 2, "maxLength": 100}},
                {"id": "f-email", "type": "text", "label": "Email Address", "placeholder": "applicant@example.com", "order": 1, "section": "sec-applicant", "validation": {"required": True, "pattern": "^[\\w.-]+@[\\w.-]+\\.\\w+$"}},
                {"id": "f-income", "type": "number", "label": "Annual Income", "placeholder": "e.g. 85000", "order": 2, "section": "sec-applicant", "validation": {"required": True, "minValue": 0}},
                {"id": "f-contact-grid", "type": "grid", "label": "Contact Details", "order": 3, "section": "sec-applicant", "validation": {},
                 "gridConfig": {
                     "columns": 2, "rows": 2,
                     "cells": [
                         {"id": "f-phone-home", "type": "text", "label": "Home Phone", "placeholder": "(555) 000-0000", "order": 0, "section": "grid", "validation": {"required": False}},
                         {"id": "f-phone-work", "type": "text", "label": "Work Phone", "placeholder": "(555) 000-0000", "order": 1, "section": "grid", "validation": {"required": False}},
                         {"id": "f-address-type", "type": "select", "label": "Address Type", "order": 2, "section": "grid", "validation": {"required": True, "options": ["Home", "Business", "Mailing"]}},
                         {"id": "f-years-at-addr", "type": "number", "label": "Years at Address", "placeholder": "e.g. 5", "order": 3, "section": "grid", "validation": {"required": False, "minValue": 0}},
                     ]
                 }},
                {"id": "f-loan-type", "type": "select", "label": "Loan Type", "order": 0, "section": "sec-loan", "validation": {"required": True, "options": ["Mortgage", "Personal", "Commercial", "Auto"]}},
                {"id": "f-amount", "type": "number", "label": "Loan Amount", "placeholder": "Requested amount", "order": 1, "section": "sec-loan", "validation": {"required": True, "minValue": 1000, "maxValue": 10000000}},
                {"id": "f-purpose", "type": "textarea", "label": "Loan Purpose", "placeholder": "Describe the purpose of the loan", "order": 2, "section": "sec-loan", "validation": {"required": False}},
                {"id": "f-commercial-entity", "type": "text", "label": "Business Entity Name", "order": 3, "section": "sec-loan", "validation": {"required": False}, "visibleWhen": {"f-loan-type": "Commercial"}},
                {"id": "f-terms", "type": "checkbox", "label": "I agree to the terms and conditions", "order": 4, "section": "sec-loan", "validation": {"required": True}},
            ],
            "version": 1, "is_active": True, "created_at": "2025-01-15T00:00:00.000Z",
        },
        {
            "_id": "form-kyc-intake", "name": "Customer Onboarding Form", "case_type_id": "ct-kyc", "stage": "intake",
            "description": "New customer KYC application form",
            "sections": [
                {"id": "sec-personal", "title": "Personal Information", "order": 0},
                {"id": "sec-account", "title": "Account Preferences", "order": 1},
                {"id": "sec-identity", "title": "Identity Documents", "order": 2},
            ],
            "fields": [
                {"id": "f-fullname", "type": "text", "label": "Full Legal Name", "placeholder": "As it appears on ID", "order": 0, "section": "sec-personal", "validation": {"required": True, "minLength": 2, "maxLength": 100}},
                {"id": "f-dob", "type": "date", "label": "Date of Birth", "order": 1, "section": "sec-personal", "validation": {"required": True}},
                {"id": "f-ssn", "type": "text", "label": "SSN / Tax ID", "placeholder": "XXX-XX-XXXX", "order": 2, "section": "sec-personal", "validation": {"required": True, "pattern": "^\\d{3}-\\d{2}-\\d{4}$"}},
                {"id": "f-address", "type": "textarea", "label": "Residential Address", "placeholder": "Full address including city, state, zip", "order": 3, "section": "sec-personal", "validation": {"required": True}},
                {"id": "f-phone", "type": "text", "label": "Phone Number", "placeholder": "(555) 123-4567", "order": 4, "section": "sec-personal", "validation": {"required": True}},
                {"id": "f-email-kyc", "type": "text", "label": "Email Address", "placeholder": "email@example.com", "order": 5, "section": "sec-personal", "validation": {"required": True, "pattern": "^[\\w.-]+@[\\w.-]+\\.\\w+$"}},
                {"id": "f-acct-type", "type": "select", "label": "Account Type", "order": 0, "section": "sec-account", "validation": {"required": True, "options": ["Savings", "Premium Checking", "Business Account", "Investment"]}},
                {"id": "f-currency", "type": "select", "label": "Preferred Currency", "order": 1, "section": "sec-account", "validation": {"required": True, "options": ["USD", "EUR", "GBP"]}},
                {"id": "f-entity-name", "type": "text", "label": "Business Entity Name", "order": 2, "section": "sec-account", "validation": {"required": False}, "visibleWhen": {"f-acct-type": "Business Account"}},
                {"id": "f-id-type", "type": "select", "label": "ID Document Type", "order": 0, "section": "sec-identity", "validation": {"required": True, "options": ["Passport", "Drivers License", "National ID"]}},
                {"id": "f-id-number", "type": "text", "label": "ID Document Number", "order": 1, "section": "sec-identity", "validation": {"required": True}},
                {"id": "f-kyc-consent", "type": "checkbox", "label": "I consent to identity verification and background check", "order": 2, "section": "sec-identity", "validation": {"required": True}},
            ],
            "version": 1, "is_active": True, "created_at": "2025-01-15T00:00:00.000Z",
        },
        {
            "_id": "form-claims-intake", "name": "Insurance Claim Form", "case_type_id": "ct-claims", "stage": "intake",
            "description": "Initial insurance claim submission form",
            "sections": [
                {"id": "sec-claimant", "title": "Claimant Information", "order": 0},
                {"id": "sec-policy", "title": "Policy Details", "order": 1},
                {"id": "sec-incident", "title": "Incident Details", "order": 2},
            ],
            "fields": [
                {"id": "f-claimant-name", "type": "text", "label": "Claimant Name", "placeholder": "Full legal name", "order": 0, "section": "sec-claimant", "validation": {"required": True, "minLength": 2}},
                {"id": "f-claimant-phone", "type": "text", "label": "Phone Number", "placeholder": "(555) 123-4567", "order": 1, "section": "sec-claimant", "validation": {"required": True}},
                {"id": "f-claimant-email", "type": "text", "label": "Email Address", "placeholder": "email@example.com", "order": 2, "section": "sec-claimant", "validation": {"required": True, "pattern": "^[\\w.-]+@[\\w.-]+\\.\\w+$"}},
                {"id": "f-policy-number", "type": "text", "label": "Policy Number", "placeholder": "POL-XXXX-XXXXX", "order": 0, "section": "sec-policy", "validation": {"required": True, "pattern": "^POL-\\d{4}-\\d{5}$"}},
                {"id": "f-claim-type", "type": "select", "label": "Claim Type", "order": 1, "section": "sec-policy", "validation": {"required": True, "options": ["Auto Collision", "Property Damage", "Medical", "Liability", "Theft"]}},
                {"id": "f-claim-amount", "type": "number", "label": "Estimated Claim Amount", "placeholder": "Estimated damages in USD", "order": 2, "section": "sec-policy", "validation": {"required": True, "minValue": 0}},
                {"id": "f-incident-date", "type": "date", "label": "Date of Incident", "order": 0, "section": "sec-incident", "validation": {"required": True}},
                {"id": "f-incident-location", "type": "text", "label": "Location of Incident", "placeholder": "Address or description", "order": 1, "section": "sec-incident", "validation": {"required": True}},
                {"id": "f-incident-desc", "type": "textarea", "label": "Description of Incident", "placeholder": "Provide a detailed description of what happened", "order": 2, "section": "sec-incident", "validation": {"required": True, "minLength": 20}},
                {"id": "f-damage-grid", "type": "grid", "label": "Damage Assessment", "order": 3, "section": "sec-incident", "validation": {},
                 "gridConfig": {
                     "columns": 3, "rows": 2,
                     "cells": [
                         {"id": "f-damage-area", "type": "text", "label": "Damaged Area", "placeholder": "e.g. Front bumper", "order": 0, "section": "grid", "validation": {"required": True}},
                         {"id": "f-damage-severity", "type": "select", "label": "Severity", "order": 1, "section": "grid", "validation": {"required": True, "options": ["Minor", "Moderate", "Severe", "Total Loss"]}},
                         {"id": "f-damage-cost", "type": "number", "label": "Est. Repair Cost", "placeholder": "USD", "order": 2, "section": "grid", "validation": {"required": False, "minValue": 0}},
                         {"id": "f-damage-area2", "type": "text", "label": "Damaged Area 2", "placeholder": "e.g. Windshield", "order": 3, "section": "grid", "validation": {"required": False}},
                         {"id": "f-damage-severity2", "type": "select", "label": "Severity", "order": 4, "section": "grid", "validation": {"required": False, "options": ["Minor", "Moderate", "Severe", "Total Loss"]}},
                         {"id": "f-damage-cost2", "type": "number", "label": "Est. Repair Cost", "placeholder": "USD", "order": 5, "section": "grid", "validation": {"required": False, "minValue": 0}},
                     ]
                 }},
                {"id": "f-police-report", "type": "checkbox", "label": "Police report filed", "order": 4, "section": "sec-incident", "validation": {"required": False}},
                {"id": "f-claim-consent", "type": "checkbox", "label": "I certify the information provided is accurate and complete", "order": 5, "section": "sec-incident", "validation": {"required": True}},
            ],
            "version": 1, "is_active": True, "created_at": "2025-01-15T00:00:00.000Z",
        },
    ]
    await db.case_forms.insert_many(form_definitions)

    # ─── Approval Routing Rules ─────────────────
    routing_rules = [
        {"_id": "rule-high-value-loan", "name": "High Value Loan VP Approval", "case_type_id": "ct-loan",
         "conditions": [{"field": "loanAmount", "operator": "gt", "value": 100000}],
         "approver_user_ids": ["user-1", "user-admin"], "mode": "sequential", "priority": 10,
         "is_active": True, "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "rule-commercial", "name": "Commercial Loan Extra Approval", "case_type_id": "ct-loan",
         "conditions": [{"field": "loanType", "operator": "eq", "value": "Commercial"}, {"field": "loanAmount", "operator": "gte", "value": 250000}],
         "approver_user_ids": ["user-admin"], "mode": "sequential", "priority": 20,
         "is_active": True, "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "rule-high-risk-kyc", "name": "High Risk Customer Escalation", "case_type_id": "ct-kyc",
         "conditions": [{"field": "riskLevel", "operator": "eq", "value": "high"}],
         "approver_user_ids": ["user-1", "user-admin"], "mode": "sequential", "priority": 10,
         "is_active": True, "created_at": "2025-01-15T00:00:00.000Z"},
        {"_id": "rule-high-value-claim", "name": "High Value Claim Approval", "case_type_id": "ct-claims",
         "conditions": [{"field": "claimAmount", "operator": "gt", "value": 50000}],
         "approver_user_ids": ["user-admin"], "mode": "sequential", "priority": 10,
         "is_active": True, "created_at": "2025-01-15T00:00:00.000Z"},
    ]
    await db.approval_routing_rules.insert_many(routing_rules)

    # ─── Documents (metadata only) ──────────────
    documents = [
        {"_id": "doc-1", "case_id": "LOAN-001", "task_id": None, "file_name": "w2_john_doe_2024.pdf",
         "file_type": "application/pdf", "file_size": 245760, "version": 1, "uploaded_by": "user-2",
         "tags": ["w2", "income", "verification"], "storage_path": "uploads/doc-1.pdf",
         "current": True, "created_at": "2026-02-03T10:30:00Z"},
        {"_id": "doc-2", "case_id": "LOAN-003", "task_id": None, "file_name": "acme_corp_financials_2024.pdf",
         "file_type": "application/pdf", "file_size": 1048576, "version": 1, "uploaded_by": "user-1",
         "tags": ["financials", "commercial"], "storage_path": "uploads/doc-2.pdf",
         "current": True, "created_at": "2026-01-11T14:00:00Z"},
        {"_id": "doc-3", "case_id": "KYC-001", "task_id": None, "file_name": "michael_chen_passport.jpg",
         "file_type": "image/jpeg", "file_size": 524288, "version": 1, "uploaded_by": "user-3",
         "tags": ["passport", "identity", "kyc"], "storage_path": "uploads/doc-3.jpg",
         "current": True, "created_at": "2026-03-02T09:30:00Z"},
        {"_id": "doc-4", "case_id": "CLM-001", "task_id": None, "file_name": "police_report_taylor.pdf",
         "file_type": "application/pdf", "file_size": 389120, "version": 1, "uploaded_by": "user-2",
         "tags": ["police-report", "auto", "investigation"], "storage_path": "uploads/doc-4.pdf",
         "current": True, "created_at": "2026-03-05T14:00:00Z"},
        {"_id": "doc-5", "case_id": "CLM-002", "task_id": None, "file_name": "structural_engineer_report.pdf",
         "file_type": "application/pdf", "file_size": 2097152, "version": 1, "uploaded_by": "user-3",
         "tags": ["engineer-report", "property", "structural"], "storage_path": "uploads/doc-5.pdf",
         "current": True, "created_at": "2026-02-21T10:00:00Z"},
    ]
    await db.documents.insert_many(documents)

    # ─── Decision Tables ────────────────────────
    decision_tables = [
        {
            "_id": "dt-loan-routing",
            "name": "Loan Routing Decision Table",
            "description": "Routes loan applications to the appropriate approval tier based on amount, type, and income",
            "inputs": ["loan_amount", "loan_type", "applicant_income"],
            "output_field": "approval_tier",
            "rows": [
                {"conditions": {"loan_amount": "<=10000", "loan_type": "personal"}, "output": "auto_approve", "priority": 1},
                {"conditions": {"loan_amount": "10000-100000", "applicant_income": ">=50000"}, "output": "manager", "priority": 2},
                {"conditions": {"loan_amount": "10000-100000", "applicant_income": "<50000"}, "output": "senior_manager", "priority": 3},
                {"conditions": {"loan_amount": ">100000"}, "output": "vp_approval", "priority": 4},
                {"conditions": {"loan_type": "commercial"}, "output": "commercial_review", "priority": 5},
            ],
            "default_output": "manager",
            "created_by": "user-admin",
            "created_at": "2025-06-01T00:00:00Z",
            "updated_at": "2025-06-01T00:00:00Z",
            "version": 1,
        },
        {
            "_id": "dt-risk-scoring",
            "name": "Risk Scoring Decision Table",
            "description": "Calculates risk level for KYC onboarding based on country, amount, and PEP status",
            "inputs": ["country_risk", "transaction_volume", "pep_status"],
            "output_field": "risk_level",
            "rows": [
                {"conditions": {"country_risk": "high", "pep_status": "yes"}, "output": "critical", "priority": 1},
                {"conditions": {"country_risk": "high"}, "output": "high", "priority": 2},
                {"conditions": {"transaction_volume": ">500000"}, "output": "high", "priority": 3},
                {"conditions": {"pep_status": "yes"}, "output": "medium", "priority": 4},
                {"conditions": {"country_risk": "medium"}, "output": "medium", "priority": 5},
            ],
            "default_output": "low",
            "created_by": "user-admin",
            "created_at": "2025-06-15T00:00:00Z",
            "updated_at": "2025-06-15T00:00:00Z",
            "version": 1,
        },
        {
            "_id": "dt-claims-adjuster",
            "name": "Claims Adjuster Assignment",
            "description": "Assigns claims to adjusters based on claim type and estimated amount",
            "inputs": ["claim_type", "claim_amount"],
            "output_field": "adjuster_pool",
            "rows": [
                {"conditions": {"claim_type": "auto_collision", "claim_amount": ">25000"}, "output": "senior_auto", "priority": 1},
                {"conditions": {"claim_type": "auto_collision"}, "output": "auto_pool", "priority": 2},
                {"conditions": {"claim_type": "property_damage", "claim_amount": ">50000"}, "output": "senior_property", "priority": 3},
                {"conditions": {"claim_type": "property_damage"}, "output": "property_pool", "priority": 4},
                {"conditions": {"claim_type": "medical"}, "output": "medical_pool", "priority": 5},
                {"conditions": {"claim_amount": ">100000"}, "output": "executive_review", "priority": 6},
            ],
            "default_output": "general_pool",
            "created_by": "user-admin",
            "created_at": "2025-07-01T00:00:00Z",
            "updated_at": "2025-07-01T00:00:00Z",
            "version": 1,
        },
    ]
    await db.decision_tables.insert_many(decision_tables)


if __name__ == "__main__":
    import asyncio
    from database import connect_db, close_db

    async def main():
        await connect_db()
        await force_reseed()
        await close_db()
        print("Re-seed complete — all collections rebuilt.")

    asyncio.run(main())
