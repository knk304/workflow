# Portal & Pega-Lite Completion Plan

## Current Status — All Core Components Implemented ✅

The legacy Phase 1/2 code (old Case, Task, Workflow admin, CaseType) has been fully removed. The application now runs exclusively on the Pega-Lite model:

| Component | Status | Notes |
|-----------|--------|-------|
| Portal Dashboard | ✅ Done | Summary cards, recent cases, assignments |
| Worklist | ✅ Done | My Work / All tabs, grouped by status, actions |
| Case Instance List | ✅ Done | Material table, filters, paginator |
| Case View | ✅ Done | Stage bar, tabs (Work/Details/History), actions |
| Case Create | ✅ Done | Type picker → form, validation, dispatch |
| Case Type Designer | ✅ Done | Stages, processes, steps, rule builder |
| Step Config Panel | ✅ Done | Form dropdown, type-specific config |
| Process Config Panel | ✅ Done | Flow linking, SLA, start-when rules |
| Flow Designer | ✅ Done | Renamed from Workflow Designer, visual editor |
| Dashboard | ✅ Done | Rewired to CaseInstance & Assignment selectors |
| Decision Tables | ✅ Done | Admin CRUD + evaluation |
| Form Builder | ✅ Done | Full form definition editor |

---

## Remaining Enhancements (Priority Order)

### Sprint 1 — Assignment Processing & Form Rendering

1. **Assignment Form Rendering** — When a user opens an assignment (worklist → case view → step), if the step has a linked `formId`, render the actual form from `FormDefinition` fields as an interactive form (currently shows form field count only).
   - Load `FormDefinition` by id when step card is expanded
   - Generate reactive form controls from `FormField[]`
   - Submit form data via `AssignmentsActions.completeAssignment({ id, formData })`
   - Files: `portal-case-view.component.ts`, new `assignment-form.component.ts`

2. **Assignment Lifecycle Actions** — Wire up Hold/Resume/Reassign buttons in worklist to backend API calls through NgRx effects.
   - Currently the worklist has UI buttons but confirm they dispatch correctly
   - Add confirmation dialogs for Hold/Reassign
   - Files: `portal-worklist.component.ts`, `assignments.effects.ts`

3. **Step Completion with Validation** — When "Complete Step" is clicked, validate required form data, run skip-when rules client-side, and auto-advance to next step.
   - Files: `portal-case-view.component.ts`, `cases.effects.ts`

### Sprint 2 — Case Lifecycle & SLA

4. **Stage Advancement UX** — When all required steps in a process are complete, show a clear "Advance to Next Stage" prompt. Handle `onComplete` modes: `auto_advance`, `wait_for_user`, `resolve_case`.
   - Files: `portal-case-view.component.ts`

5. **SLA Indicators on Cases** — Display SLA countdown, overdue badges, and escalation level on case list and case view.
   - `CaseInstance` already has `slaTargetDate`, `slaDaysRemaining`, `escalationLevel`
   - Add visual indicators (red for overdue, amber for near-due)
   - Files: `portal-case-list.component.ts`, `portal-case-view.component.ts`

6. **Subprocess Handling** — When a step type is `subprocess`, create child case and link `parentCaseId`. Show child case status in parent view.
   - Files: `cases.effects.ts`, `portal-case-view.component.ts`

### Sprint 3 — Admin & Polish

7. **Automation Step Execution** — When engine reaches an `automation` step, trigger webhook and evaluate rules. Display result in case history.
   - Backend webhook execution already exists; wire frontend status display

8. **Decision Step Integration** — When engine reaches a `decision` step, evaluate branches or decision table and display the chosen path in case history.
   - Files: `portal-case-view.component.ts` (history tab)

9. **Attachment Step** — Implement file upload UI for `attachment` step type with category validation, min-files, and file-type restrictions.
   - Files: new `attachment-step.component.ts`, integrate with Documents API

10. **Notification Integration** — Show toast notifications when assignments arrive or cases change status. Mark as read.
    - Wire WebSocket events to snackbar alerts
    - Files: `shell.component.ts`, notification service

### Sprint 4 — Testing & Hardening

11. **E2E Flow Testing** — Create case type → create case → process assignments → advance stages → resolve. Full lifecycle test.

12. **Error Handling** — Add robust error states for API failures across portal views (currently minimal).

13. **Responsive Layout** — Verify portal views work on tablet/mobile. Ensure case view tabs collapse properly on small screens.

---

## Architecture Notes

- **Data Flow**: Angular NgRx → FastAPI `/api/` → MongoDB
- **Stores**: `cases` (CaseTypeDefinition + CaseInstance), `assignments`, `workflows` (flows)
- **No Legacy**: All `Case`, `Task`, `CaseType`, `KanbanBoard` types and their stores/services/components have been removed
- **Form Linking**: Step config panel now uses `<mat-select>` for formId (loads from `DataService.getFormDefinitions()`)
- **Flow Linking**: Process config panel now has `flowId` field with `<mat-select>` (loads from `DataService.getWorkflows()`)
