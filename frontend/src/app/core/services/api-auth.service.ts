import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { User, LoginRequest, RegisterRequest } from '../models';
import { AuthService, LoginResponse, RegisterResponse } from './auth.service';
import { environment } from '../../../environments/environment';

@Injectable()
export class ApiAuthService extends AuthService {
  private readonly baseUrl = environment.authApiUrl;
  private readonly tokenKey = environment.tokenKey;
  private readonly refreshTokenKey = environment.refreshTokenKey;

  constructor(private http: HttpClient) {
    super();
  }

  login(req: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/auth/login`, req).pipe(
      tap((res) => {
        localStorage.setItem(this.tokenKey, res.token);
        localStorage.setItem(this.refreshTokenKey, res.refreshToken);
      })
    );
  }

  register(req: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.baseUrl}/auth/register`, req).pipe(
      tap((res) => {
        localStorage.setItem(this.tokenKey, res.token);
      })
    );
  }

  logout(): Observable<void> {
    const token = this.getToken();
    this.clearToken();
    if (token) {
      return this.http.post<void>(`${this.baseUrl}/auth/logout`, {});
    }
    return of(void 0);
  }

  getCurrentUser(): Observable<User | null> {
    const token = this.getToken();
    if (!token) {
      return of(null);
    }
    return this.http.get<User>(`${this.baseUrl}/auth/me`);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  clearToken(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
  }

  refreshToken(): Observable<string> {
    const refresh = localStorage.getItem(this.refreshTokenKey);
    return this.http
      .post<{ token: string }>(`${this.baseUrl}/auth/refresh`, { refreshToken: refresh })
      .pipe(
        map((res) => res.token),
        tap((token) => localStorage.setItem(this.tokenKey, token))
      );
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
