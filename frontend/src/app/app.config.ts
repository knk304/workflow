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
import { TasksEffects } from './state/tasks/tasks.effects';
import { NotificationsEffects } from './state/notifications/notifications.effects';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    provideHttpClient(withInterceptors([jwtInterceptor])),

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
        TasksEffects,
        NotificationsEffects,
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
