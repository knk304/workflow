import { Injectable, inject } from '@angular/core';
import {
  CanActivate,
  CanActivateChild,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  CanActivateFn,
} from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { MockAuthService } from '../services/mock-auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate, CanActivateChild {
  constructor(
    private authService: MockAuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.authService.getCurrentUser().pipe(
      map((user) => {
        if (user) {
          // Check role if required
          const requiredRoles = route.data['roles'] as string[];
          if (requiredRoles && !requiredRoles.includes(user.role)) {
            this.router.navigate(['/unauthorized']);
            return false;
          }
          return true;
        } else {
          this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
          return false;
        }
      })
    );
  }

  canActivateChild(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.canActivate(route, state);
  }
}

@Injectable({
  providedIn: 'root',
})
export class RoleGuard implements CanActivate {
  constructor(
    private authService: MockAuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot): Observable<boolean> {
    return this.authService.getCurrentUser().pipe(
      map((user) => {
        if (!user) {
          this.router.navigate(['/login']);
          return false;
        }

        const requiredRoles = route.data['roles'] as string[];
        if (requiredRoles && !requiredRoles.includes(user.role)) {
          this.router.navigate(['/unauthorized']);
          return false;
        }

        return true;
      })
    );
  }
}

// Functional guard export for standalone routing
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(MockAuthService);
  const router = inject(Router);

  return authService.getCurrentUser().pipe(
    map((user) => {
      if (user) {
        // Check role if required
        const requiredRoles = route.data['roles'] as string[];
        if (requiredRoles && !requiredRoles.includes(user.role)) {
          router.navigate(['/unauthorized']);
          return false;
        }
        return true;
      } else {
        router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
        return false;
      }
    })
  );
};
