import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { User, LoginRequest, RegisterRequest } from '../models';

@Injectable({
  providedIn: 'root',
})
export class MockAuthService {
  private currentUser: User | null = null;
  private token: string | null = null;

  login(req: LoginRequest): Observable<{ user: User; token: string; refreshToken: string }> {
    // Mock validation
    if (!req.email || !req.password) {
      return throwError(() => new Error('Invalid credentials'));
    }

    // Mock users - in real app, this would be from backend
    const mockUser: User = {
      id: 'user-1',
      email: req.email,
      name: 'Alice Johnson',
      role: req.email === 'admin@example.com' ? 'ADMIN' : 'MANAGER',
      teamIds: ['team-1'],
      avatar: '👩‍💼',
      createdAt: '2025-01-01T00:00:00.000Z',
    };

    this.currentUser = mockUser;
    this.token = 'mock-jwt-token-' + Date.now();

    return of({
      user: mockUser,
      token: this.token,
      refreshToken: 'mock-refresh-token-' + Date.now(),
    }).pipe(delay(1000));
  }

  register(req: RegisterRequest): Observable<{ user: User; token: string }> {
    if (!req.email || !req.password || !req.name) {
      return throwError(() => new Error('Missing required fields'));
    }

    const newUser: User = {
      id: 'user-' + Date.now(),
      email: req.email,
      name: req.name,
      role: 'VIEWER',
      teamIds: [],
      avatar: '👤',
      createdAt: new Date().toISOString(),
    };

    this.currentUser = newUser;
    this.token = 'mock-jwt-token-' + Date.now();

    return of({
      user: newUser,
      token: this.token,
    }).pipe(delay(1000));
  }

  logout(): Observable<void> {
    this.currentUser = null;
    this.token = null;
    return of(void 0).pipe(delay(500));
  }

  getCurrentUser(): Observable<User | null> {
    return of(this.currentUser).pipe(delay(300));
  }

  getToken(): string | null {
    return this.token;
  }

  refreshToken(): Observable<string> {
    this.token = 'mock-jwt-token-' + Date.now();
    return of(this.token).pipe(delay(300));
  }

  isAuthenticated(): boolean {
    return this.token !== null && this.currentUser !== null;
  }
}
