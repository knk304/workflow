import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { AdminUsersComponent } from './features/admin/admin-users.component';
import { AdminTeamsComponent } from './features/admin/admin-teams.component';
import { AdminCaseTypeDefinitionsComponent } from './features/admin/admin-case-type-definitions/admin-case-type-definitions.component';
import { CaseTypeDesignerComponent } from './features/admin/case-type-designer/case-type-designer.component';
import { AdminDecisionTablesComponent } from './features/admin/admin-decision-tables/admin-decision-tables.component';
import { DecisionTableEditorComponent } from './features/admin/decision-table-editor/decision-table-editor.component';
import { WorkflowDesignerComponent } from './features/workflows/workflow-designer.component';
import { ApprovalsComponent } from './features/approvals/approvals.component';
import { DocumentsComponent } from './features/documents/documents.component';
import { SLADashboardComponent } from './features/sla/sla-dashboard.component';
import { FormBuilderComponent } from './features/forms/form-builder.component';
import { FormRendererPageComponent } from './features/forms/form-renderer-page.component';
import { PortalDashboardComponent } from './features/portal/portal-dashboard.component';
import { PortalCaseListComponent } from './features/portal/portal-case-list.component';
import { PortalCaseCreateComponent } from './features/portal/portal-case-create.component';
import { PortalCaseViewComponent } from './features/portal/portal-case-view.component';
import { PortalWorklistComponent } from './features/portal/portal-worklist.component';

export const routes: Routes = [
  // Auth Routes (public)
  {
    path: 'login',
    component: LoginComponent,
    data: { title: 'Login' },
  },
  {
    path: 'register',
    component: RegisterComponent,
    data: { title: 'Register' },
  },

  // Protected Routes
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        component: DashboardComponent,
        data: { title: 'Dashboard' },
      },
      // Flow Designer (formerly Workflow Designer)
      {
        path: 'flows',
        component: WorkflowDesignerComponent,
        data: { title: 'Flow Designer' },
      },
      {
        path: 'approvals',
        component: ApprovalsComponent,
        data: { title: 'Approvals' },
      },
      {
        path: 'documents',
        component: DocumentsComponent,
        data: { title: 'Documents' },
      },
      {
        path: 'sla',
        component: SLADashboardComponent,
        data: { title: 'SLA Dashboard' },
      },
      {
        path: 'forms',
        component: FormBuilderComponent,
        data: { title: 'Form Builder' },
      },
      {
        path: 'forms/:formId/fill',
        component: FormRendererPageComponent,
        data: { title: 'Fill Form' },
      },
      // Worker Portal routes
      {
        path: 'portal',
        children: [
          { path: '', component: PortalDashboardComponent, data: { title: 'Worker Portal' } },
          { path: 'cases', component: PortalCaseListComponent, data: { title: 'Case Instances' } },
          { path: 'cases/new', component: PortalCaseCreateComponent, data: { title: 'Create Case' } },
          { path: 'cases/:id', component: PortalCaseViewComponent, data: { title: 'Case View' } },
          { path: 'worklist', component: PortalWorklistComponent, data: { title: 'Worklist' } },
        ],
      },
      {
        path: 'admin',
        children: [
          { path: '', redirectTo: 'users', pathMatch: 'full' },
          {
            path: 'users',
            component: AdminUsersComponent,
            data: { title: 'User Management' },
          },
          {
            path: 'teams',
            component: AdminTeamsComponent,
            data: { title: 'Team Management' },
          },
          {
            path: 'case-types',
            component: AdminCaseTypeDefinitionsComponent,
            data: { title: 'Case Type Definitions' },
          },
          {
            path: 'case-types/new/designer',
            component: CaseTypeDesignerComponent,
            data: { title: 'New Case Type Designer' },
          },
          {
            path: 'case-types/:id/designer',
            component: CaseTypeDesignerComponent,
            data: { title: 'Case Type Designer' },
          },
          {
            path: 'decision-tables',
            component: AdminDecisionTablesComponent,
            data: { title: 'Decision Tables' },
          },
          {
            path: 'decision-tables/new',
            component: DecisionTableEditorComponent,
            data: { title: 'New Decision Table' },
          },
          {
            path: 'decision-tables/:id',
            component: DecisionTableEditorComponent,
            data: { title: 'Decision Table Editor' },
          },
        ],
      },
    ],
  },

  // Wildcard route (must be last)
  {
    path: '**',
    redirectTo: 'login',
  },
];
