import { Observable } from 'rxjs';
import { User, LoginRequest, RegisterRequest } from '../models';

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface RegisterResponse {
  user: User;
  token: string;
}

export abstract class AuthService {
  abstract login(req: LoginRequest): Observable<LoginResponse>;
  abstract register(req: RegisterRequest): Observable<RegisterResponse>;
  abstract logout(): Observable<void>;
  abstract getCurrentUser(): Observable<User | null>;
  abstract getToken(): string | null;
  abstract setToken(token: string): void;
  abstract clearToken(): void;
  abstract refreshToken(): Observable<string>;
  abstract isAuthenticated(): boolean;
}
