# Intake Mode — Build Prompt & Implementation Reference

## Feature Overview

**Intake Mode** allows case types to present Stage 1 forms inline during case creation. A worker fills out the intake form, submits it, and receives only a case number. The case is auto-advanced past Stage 1 into the work queue for downstream processing (Stage 2+). Standard case creation (title/description/priority) remains unchanged for non-intake case types.

---

## Build Prompt

> **Goal:** Implement an "intake mode" for case type creation. When `intake_enabled` is toggled ON for a case type, clicking that case type in the portal "Create Case" page navigates to a dedicated intake form page. The form renders all Stage 1 assignment step forms (either inline `formFields` or loaded from a saved `formId`). On submit, the backend auto-generates a case title, auto-completes all Stage 1 steps, saves form data, cancels pending Stage 1 assignments, and auto-advances to Stage 2. The worker sees only a confirmation screen with the case number. Standard mode (intake OFF) is unchanged.

### Requirements

1. **Admin: Case Type Designer** — Add a toggle "Enable Intake Mode" in the Settings tab. When ON, show an info card indicating which Stage 1 steps will render as intake forms.

2. **Portal: Create Case Page** — If a case type has `intakeEnabled`, clicking it navigates to `/portal/cases/new/:caseTypeId/intake` instead of showing inline case details. Case type cards displayed as widget-style cards in a wide 3-column grid.

3. **Portal: Intake Form Page** — Dedicated full-page route. Sticky header with case type name/icon/INTAKE badge. Centered form card layout. Renders all Stage 1 assignment steps that have `formFields` or `formId`. Handles both inline field definitions and saved form definitions loaded via API. Shows a loading spinner while forms resolve. Submit button validates form. On success, shows a confirmation screen with case number, case type info, and submission time.

4. **Reusable Intake Form Component** — Shared component (`<app-intake-form>`) that renders dynamic form fields: text, email, phone, textarea, number, currency, date, select, radio, checkbox, boolean. Accepts steps, stepFieldsMap, form, stageName, and loading as inputs. Select/radio options read from `field.options` OR `field.validation.options`.

5. **Backend: Model Changes** — Add `intake_enabled: bool` to CaseTypeDefinition create/update/response models. Add `intake_form_data: Optional[dict]` to CaseCreateRequest. Make `title` optional in CaseCreateRequest.

6. **Backend: Engine** — `instantiate_case()` accepts `intake_form_data`. After `_enter_stage()`, if intake data present, call `_auto_complete_intake_stage()` which: marks all Stage 1 assignment steps completed, skips non-assignment steps, saves form submission to `db.form_submissions`, cancels open assignments, triggers `advance_to_next_stage()`.

7. **Backend: Routes** — Auto-generate title from case type name when `body.title` is None. Pass `intake_form_data` to `instantiate_case()`. Include `intake_enabled` in `_to_response()`.

8. **No title/description/priority step in intake mode** — title is auto-generated server-side from the case type name.

---

## Files Changed

### Backend

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/models/case_types.py` | Modified | Added `intake_enabled: bool = False` to Create, Update (`Optional[bool]`), and Response models |
| `backend/models/cases.py` | Modified | `title` → `Optional[str] = None`; added `intake_form_data: Optional[dict] = None` to `CaseCreateRequest` |
| `backend/engine/lifecycle.py` | Modified | Added `intake_form_data` param to `instantiate_case()`; new `_auto_complete_intake_stage()` function |
| `backend/routes/cases.py` | Modified | Auto-gen title from case type name; pass `intake_form_data` to engine |
| `backend/routes/case_types.py` | Modified | `_to_response()` includes `intake_enabled` |

### Frontend

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/src/app/core/models/index.ts` | Modified | `intakeEnabled?` on `CaseTypeDefinition`, `CaseTypeCreateRequest`, `CaseTypeUpdateRequest`; `intakeFormData?` on `CaseCreateRequest`; `title` made optional |
| `frontend/src/app/core/services/api-data.service.ts` | Modified | `mapCaseTypeDef()` maps `intake_enabled`; `createCaseInstance()` sends `intake_form_data`; create/update case type sends `intake_enabled` |
| `frontend/src/app/features/admin/case-type-designer/case-type-designer.component.ts` | Modified | Settings tab: slide toggle + info card; `scaffoldNewCaseType()` includes `intakeEnabled: false`; `save()` dispatches `intakeEnabled` |
| `frontend/src/app/features/portal/portal-case-create.component.ts` | Modified | Wide 3-col widget card layout for case types; intake-enabled types navigate to `/portal/cases/new/:id/intake` on click |
| `frontend/src/app/features/portal/portal-case-intake.component.ts` | **New** | Full-page intake form: sticky header, centered form card, async form field loading, submit + confirmation screen |
| `frontend/src/app/features/portal/shared/intake-form.component.ts` | **New** | Reusable form renderer: all Material field types, reads options from `field.options \|\| field.validation?.options` |
| `frontend/src/app/app.routes.ts` | Modified | Added route `cases/new/:caseTypeId/intake → PortalCaseIntakeComponent` |

---

## Architecture

### Data Flow

```
[Admin toggles intake_enabled ON]
        ↓
[Worker clicks case type in Create Case page]
        ↓
[Router navigates to /portal/cases/new/:caseTypeId/intake]
        ↓
[PortalCaseIntakeComponent loads case type from NgRx store]
        ↓
[buildIntakeForm() extracts Stage 1 assignment steps]
        ↓
[For each step: inline formFields used directly, or formId → DataService.getFormDefinitionById()]
        ↓
[IntakeFormComponent renders dynamic form fields]
        ↓
[Worker fills form → clicks Submit Intake]
        ↓
[Dispatch createCaseInstance({ caseTypeId, intakeFormData })]
        ↓
[POST /api/cases → { case_type_id, intake_form_data }]
        ↓
[Backend: auto-gen title, instantiate_case(intake_form_data)]
        ↓
[Engine: _enter_stage() → _auto_complete_intake_stage()]
        ↓
[All Stage 1 steps completed, form_submission saved, assignments cancelled]
        ↓
[Auto-advance to Stage 2]
        ↓
[Frontend: confirmation screen with case number]
```

### Form Field Key Convention

```
{stepId}__{fieldLabel.toLowerCase().replaceAll(' ', '_')}
```

Example: Step `step-fill-app` + field "Applicant Name" → form control key `step-fill-app__applicant_name`

### Intake Form Data Structure (Submitted to Backend)

```json
{
  "step-fill-app": {
    "Applicant Name": "John Doe",
    "Email Address": "john@example.com",
    "Loan Type": "Mortgage",
    "Loan Amount": 250000
  }
}
```

### Backend Auto-Complete Behavior

- All assignment steps in Stage 1 → `status: "completed"`
- Non-assignment steps → `status: "skipped"`, `skipped_reason: "intake_auto_skip"`
- Stage 1 → `status: "completed"`
- Form submission saved to `db.form_submissions` with `_id: "{case_id}_intake"`
- Open Stage 1 assignments → cancelled
- If stage has `on_complete: "auto_advance"` → triggers `advance_to_next_stage()`

### Form Field Options Resolution

Select and radio fields read options from two possible locations:
```
field.options || field.validation?.options || []
```
This handles both inline field definitions (`field.options: [...]`) and saved form definitions where options are nested under `field.validation.options`.

---

## Key Design Decisions

1. **Separate route for intake** — Intake navigates to a dedicated full-page (`/portal/cases/new/:caseTypeId/intake`) rather than rendering inline. Provides a focused, clean experience.

2. **Reusable IntakeFormComponent** — Shared component handles all field-type rendering. Used by `PortalCaseIntakeComponent` and can be reused elsewhere.

3. **No workflow stage sidebar** — Intake page does not show stage progression. Workers see only the form and a confirmation with the case number.

4. **Async form loading** — Steps with a `formId` (saved form definition) are loaded via `DataService.getFormDefinitionById()`. Steps with inline `formFields` resolve immediately. `Promise.all()` waits for all to resolve before building the reactive form.

5. **Title auto-generation** — Backend auto-generates title from case type name when `title` is null. No title/description/priority input in intake mode.

6. **Single toggle** — One `intake_enabled` boolean on the case type definition controls the entire feature across both frontend and backend.

7. **Shell padding offset** — The intake page uses `-m-5` and `sticky -top-5` to break out of the shell's `p-5` content padding for a full-width sticky header.
