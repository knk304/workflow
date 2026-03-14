import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { Store } from '@ngrx/store';
import { selectUser, selectIsAuthenticated } from '../../state/auth/auth.selectors';
import { selectUnreadNotificationCount } from '../../state/notifications/notifications.selectors';
import * as AuthActions from '../../state/auth/auth.actions';
import * as NotificationsActions from '../../state/notifications/notifications.actions';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterOutlet,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
  ],
  template: `
    <mat-toolbar color="primary" class="sticky top-0 shadow-md">
      <button mat-icon-button (click)="toggleSidebar()">
        <mat-icon>menu</mat-icon>
      </button>
      <span class="ml-4 font-bold text-xl">Workflow Platform</span>
      <span class="flex-1"></span>

      <!-- Notifications Bell -->
      <button
        mat-icon-button
        [matBadge]="unreadCount$ | async"
        matBadgeColor="warn"
        matBadgeSize="small"
        [routerLink]="['/notifications']"
      >
        <mat-icon>notifications</mat-icon>
      </button>

      <!-- User Menu -->
      @if (currentUser$ | async as user) {
        <button mat-icon-button [matMenuTriggerFor]="userMenu">
          <span class="mr-2">{{ user.avatar }} {{ user.name }}</span>
          <mat-icon>arrow_drop_down</mat-icon>
        </button>

        <mat-menu #userMenu="matMenu">
          <button mat-menu-item disabled>
            <mat-icon>person</mat-icon>
            <span>{{ user.email }}</span>
          </button>
          <button mat-menu-item disabled>
            <mat-icon>security</mat-icon>
            <span>{{ user.role }}</span>
          </button>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="onLogout()">
            <mat-icon>logout</mat-icon>
            <span>Logout</span>
          </button>
        </mat-menu>
      }
    </mat-toolbar>

    <mat-sidenav-container class="h-[calc(100vh-64px)]">
      <mat-sidenav
        #sidenav
        [opened]="sidebarOpen() && !isMobile()"
        [mode]="isMobile() ? 'over' : 'side'"
        class="w-64"
      >
        <mat-nav-list>
          <h2 mat-subheader>Main</h2>
          <mat-list-item routerLink="/dashboard" routerLinkActive="active">
            <mat-icon matListItemIcon>dashboard</mat-icon>
            <span matListItemTitle>Dashboard</span>
          </mat-list-item>
          <mat-list-item routerLink="/cases" routerLinkActive="active">
            <mat-icon matListItemIcon>folder</mat-icon>
            <span matListItemTitle>Cases</span>
          </mat-list-item>
          <mat-list-item routerLink="/tasks" routerLinkActive="active">
            <mat-icon matListItemIcon>task_alt</mat-icon>
            <span matListItemTitle>My Tasks</span>
          </mat-list-item>

          @if ((currentUser$ | async)?.role === 'ADMIN' || (currentUser$ | async)?.role === 'MANAGER') {
            <h2 mat-subheader class="mt-4">Administration</h2>
            <mat-list-item routerLink="/admin/users" routerLinkActive="active">
              <mat-icon matListItemIcon>people</mat-icon>
              <span matListItemTitle>Users</span>
            </mat-list-item>
            <mat-list-item routerLink="/admin/teams" routerLinkActive="active">
              <mat-icon matListItemIcon>groups</mat-icon>
              <span matListItemTitle>Teams</span>
            </mat-list-item>
            <mat-list-item routerLink="/admin/workflows" routerLinkActive="active">
              <mat-icon matListItemIcon>workspaces</mat-icon>
              <span matListItemTitle>Workflows</span>
            </mat-list-item>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="p-4 overflow-auto">
        <router-outlet></router-outlet>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      mat-nav-list {
        padding-top: 0;
      }
      mat-list-item.active {
        background-color: rgba(63, 81, 181, 0.1);
      }
    `,
  ],
})
export class ShellComponent implements OnInit {
  @ViewChild(MatSidenav) sidenav!: MatSidenav;

  currentUser$ = this.store.select(selectUser);
  isAuthenticated$ = this.store.select(selectIsAuthenticated);
  unreadCount$ = this.store.select(selectUnreadNotificationCount);

  sidebarOpen = signal(true);
  isMobile = signal(window.innerWidth < 768);

  constructor(
    private store: Store,
    private router: Router
  ) {
    window.addEventListener('resize', () => {
      this.isMobile.set(window.innerWidth < 768);
    });
  }

  ngOnInit(): void {
    // Load initial data
    this.currentUser$.subscribe((user) => {
      if (user) {
        this.store.dispatch(
          NotificationsActions.loadNotifications({ userId: user.id })
        );
        this.store.dispatch(
          NotificationsActions.loadNotifications({
            userId: user.id,
          })
        );
      }
    });
  }

  toggleSidebar(): void {
    if (this.isMobile()) {
      this.sidenav.toggle();
    } else {
      this.sidebarOpen.update((v) => !v);
    }
  }

  onLogout(): void {
    this.store.dispatch(AuthActions.logout());
  }
}
