import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { routes } from './app.routes';
import { appReducers } from './state/app.state';
import { AuthEffects } from './state/auth/auth.effects';
import { CasesEffects } from './state/cases/cases.effects';
import { NotificationsEffects } from './state/notifications/notifications.effects';
import { CommentsEffects } from './state/comments/comments.effects';
import { WorkflowsEffects } from './state/workflows/workflows.effects';
import { ApprovalsEffects } from './state/approvals/approvals.effects';
import { DocumentsEffects } from './state/documents/documents.effects';
import { AssignmentsEffects } from './state/assignments/assignments.effects';
import { CaseTypesEffects } from './state/case-types/case-types.effects';
import { DecisionTablesEffects } from './state/decision-tables/decision-tables.effects';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { serviceProviders } from './core/services/service-providers';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withInterceptors([jwtInterceptor])),

    // Service providers (mock or API based on environment)
    ...serviceProviders,

    // NgRx Store Configuration
    importProvidersFrom([
      StoreModule.forRoot(appReducers, {
        runtimeChecks: {
          strictStateImmutability: true,
          strictActionImmutability: true,
          strictStateSerializability: true,
          strictActionSerializability: true,
          strictActionWithinNgZone: true,
          strictActionTypeUniqueness: true,
        },
      }),

      // Effects
      EffectsModule.forRoot([
        AuthEffects,
        CasesEffects,
        NotificationsEffects,
        CommentsEffects,
        WorkflowsEffects,
        ApprovalsEffects,
        DocumentsEffects,
        AssignmentsEffects,
        CaseTypesEffects,
        DecisionTablesEffects,
      ]),

      // Store Devtools (only in development)
      environment.production
        ? []
        : StoreDevtoolsModule.instrument({
            maxAge: 25, // Retain last 25 states
            logOnly: environment.production, // Restrict extension to log-only mode
          }),
    ]),
  ],
};
