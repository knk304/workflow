import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { User, LoginRequest, RegisterRequest } from '../models';
import { AuthService, LoginResponse, RegisterResponse } from './auth.service';

@Injectable()
export class MockAuthService extends AuthService {
  private currentUser: User | null = null;
  private token: string | null = null;

  login(req: LoginRequest): Observable<{ user: User; token: string; refreshToken: string }> {
    // Mock validation
    if (!req.email || !req.password) {
      return throwError(() => new Error('Invalid credentials'));
    }

    // Mock users - role determined by email
    const roleMap: Record<string, { name: string; role: User['role']; id: string; avatar: string; teamIds: string[] }> = {
      'admin@example.com':   { name: 'Dave Wilson',    role: 'ADMIN',   id: 'user-4', avatar: '👨‍💻', teamIds: ['team-1', 'team-2'] },
      'manager@example.com': { name: 'Alice Johnson',  role: 'MANAGER', id: 'user-1', avatar: '👩‍💼', teamIds: ['team-1'] },
      'worker@example.com':  { name: 'Bob Smith',      role: 'WORKER',  id: 'user-2', avatar: '👨‍🔧', teamIds: ['team-1'] },
      'viewer@example.com':  { name: 'Carol Williams', role: 'VIEWER',  id: 'user-3', avatar: '👩‍🔬', teamIds: ['team-2'] },
    };
    const defaults = { name: 'Alice Johnson', role: 'MANAGER' as User['role'], id: 'user-1', avatar: '👩‍💼', teamIds: ['team-1'] };
    const profile = roleMap[req.email.toLowerCase()] || defaults;

    const mockUser: User = {
      id: profile.id,
      email: req.email,
      name: profile.name,
      role: profile.role,
      teamIds: profile.teamIds,
      avatar: profile.avatar,
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

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
    this.currentUser = null;
  }

  refreshToken(): Observable<string> {
    this.token = 'mock-jwt-token-' + Date.now();
    return of(this.token).pipe(delay(300));
  }

  isAuthenticated(): boolean {
    return this.token !== null && this.currentUser !== null;
  }
}
