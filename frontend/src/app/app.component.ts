import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Store } from '@ngrx/store';
import { selectIsAuthenticated } from './state/auth/auth.selectors';
import { ShellComponent } from './layout/shell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ShellComponent],
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
export class AppComponent {
  isAuthenticated$ = this.store.select(selectIsAuthenticated);

  constructor(private store: Store) {}
}
