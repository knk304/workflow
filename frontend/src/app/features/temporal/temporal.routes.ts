import { Routes } from '@angular/router';
import { TemporalDashboardComponent } from './temporal-dashboard/temporal-dashboard.component';
import { TemporalWorkflowListComponent } from './temporal-workflow-list/temporal-workflow-list.component';
import { TemporalWorkflowDetailComponent } from './temporal-workflow-detail/temporal-workflow-detail.component';

export const TEMPORAL_ROUTES: Routes = [
  { path: '', component: TemporalDashboardComponent, data: { title: 'Temporal Dashboard' } },
  { path: 'workflows', component: TemporalWorkflowListComponent, data: { title: 'Workflows' } },
  { path: 'workflows/:id', component: TemporalWorkflowDetailComponent, data: { title: 'Workflow Detail' } },
];
