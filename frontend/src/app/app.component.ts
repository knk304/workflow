import { Component, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectIsAuthenticated } from './state/auth/auth.selectors';
import { ShellComponent } from './layout/shell.component';
import * as AuthActions from './state/auth/auth.actions';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterOutlet, ShellComponent],
  template: `
    @if (isAuthenticated$ | async) {
      <app-shell>
        <router-outlet></router-outlet>
      </app-shell>
    } @else {
      <router-outlet></router-outlet>
    }
  `,
  styles: [],
})
export class AppComponent implements OnInit {
  isAuthenticated$ = this.store.select(selectIsAuthenticated);

  constructor(private store: Store) {}

  ngOnInit(): void {
    // Revalidate session with the API if a token exists
    if (localStorage.getItem('auth_token')) {
      this.store.dispatch(AuthActions.getCurrentUser());
    }
  }
}
