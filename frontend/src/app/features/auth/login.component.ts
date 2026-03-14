import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectError, selectIsLoading } from '../../state/auth/auth.selectors';
import * as AuthActions from '../../state/auth/auth.actions';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="login-container min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-4">
      <mat-card class="w-full max-w-md shadow-2xl">
        <mat-card-header class="bg-blue-600 text-white p-6 mb-6">
          <div class="text-center">
            <h1 class="text-3xl font-bold">Workflow Platform</h1>
            <p class="text-sm mt-2">Case & Task Management System</p>
          </div>
        </mat-card-header>

        <mat-card-content class="p-6">
          <form [formGroup]="loginForm" (ngSubmit)="onLogin()">
            <!-- Email Field -->
            <mat-form-field class="w-full mb-4">
              <mat-label>Email</mat-label>
              <input
                matInput
                formControlName="email"
                type="email"
                placeholder="you@example.com"
              />
              <mat-icon matIconSuffix>email</mat-icon>
              @if (loginForm.get('email')?.hasError('required') && submitted()) {
                <mat-error>Email is required</mat-error>
              }
              @if (loginForm.get('email')?.hasError('email') && submitted()) {
                <mat-error>Enter a valid email</mat-error>
              }
            </mat-form-field>
            

            <!-- Password Field -->
            <mat-form-field class="w-full mb-6">
              <mat-label>Password</mat-label>
              <input
                matInput
                formControlName="password"
                [type]="showPassword() ? 'text' : 'password'"
                placeholder="••••••••"
              />
              <button
                mat-icon-button
                matIconSuffix
                (click)="showPassword.set(!showPassword())"
                type="button"
              >
                <mat-icon>{{ showPassword() ? 'visibility' : 'visibility_off' }}</mat-icon>
              </button>
              @if (loginForm.get('password')?.hasError('required') && submitted()) {
                <mat-error>Password is required</mat-error>
              }
            </mat-form-field>

            <!-- Error Message -->
            @let errorMsg = error$ | async;
            @if (errorMsg) {
              <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {{ errorMsg }}
              </div>
            }

            <!-- Submit Button -->
            <button
              mat-raised-button
              color="primary"
              type="submit"
              class="w-full mb-4"
              [disabled]="(isLoading$ | async) || false"
            >
              @if (isLoading$ | async) {
                <mat-spinner diameter="20" class="mr-2"></mat-spinner>
                Logging in...
              } @else {
                Sign In
              }
            </button>

            <!-- Demo Credentials -->
            <div class="bg-blue-50 border-l-4 border-blue-400 p-4 mb-4">
              <p class="text-sm font-bold text-gray-700">Demo Credentials:</p>
                <p class="text-xs text-gray-600 mt-1">Email: alice&#64;example.com</p>
              <p class="text-xs text-gray-600">Password: demo123</p>
            </div>
          </form>

          <!-- Register Link -->
          <div class="text-center text-sm text-gray-600 mt-4">
            Don't have an account?
            <a routerLink="/register" class="text-blue-600 font-bold hover:underline">
              Sign up here
            </a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      mat-spinner {
        display: inline-block;
      }
    `,
  ],
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  submitted = signal(false);
  showPassword = signal(false);
  isLoading$ = this.store.select(selectIsLoading);
  error$ = this.store.select(selectError);

  constructor(
    private fb: FormBuilder,
    private store: Store,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  onLogin(): void {
    this.submitted.set(true);
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      this.store.dispatch(
        AuthActions.login({
          email,
          password,
        })
      );
    }
  }
}
