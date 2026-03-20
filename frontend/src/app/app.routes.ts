import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/auth/login.component';
import { RegisterComponent } from './features/auth/register.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { CaseListComponent } from './features/cases/case-list.component';
import { CaseDetailComponent } from './features/cases/case-detail.component';
import { CaseCreateComponent } from './features/cases/case-create.component';
import { TaskKanbanComponent } from './features/tasks/task-kanban.component';
import { AdminUsersComponent } from './features/admin/admin-users.component';
import { AdminTeamsComponent } from './features/admin/admin-teams.component';
import { AdminWorkflowsComponent } from './features/admin/admin-workflows.component';
import { AdminCaseTypesComponent } from './features/admin/admin-case-types.component';
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
      {
        path: 'cases',
        component: CaseListComponent,
        data: { title: 'Cases' },
      },
      {
        path: 'cases/new',
        component: CaseCreateComponent,
        data: { title: 'Create Case' },
      },
      {
        path: 'cases/:id',
        component: CaseDetailComponent,
        data: { title: 'Case Details' },
      },
      {
        path: 'tasks',
        component: TaskKanbanComponent,
        data: { title: 'Task Kanban' },
      },
      // Phase 2 routes
      {
        path: 'workflows',
        component: WorkflowDesignerComponent,
        data: { title: 'Workflow Designer' },
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
            path: 'workflows',
            component: AdminWorkflowsComponent,
            data: { title: 'Workflow Management' },
          },
          {
            path: 'case-types',
            component: AdminCaseTypesComponent,
            data: { title: 'Case Type Management' },
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
