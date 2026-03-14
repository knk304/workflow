import { Component, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule, MatSidenav } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { Store } from '@ngrx/store';
import { selectUser, selectIsAuthenticated } from '@state/auth/auth.selectors';
import { selectUnreadNotificationCount } from '@state/notifications/notifications.selectors';
import * as AuthActions from '@state/auth/auth.actions';
import * as NotificationsActions from '@state/notifications/notifications.actions';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
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
    <mat-toolbar color="primary" class="sticky top-0 z-50">
      <button mat-icon-button (click)="toggleSidebar()" class="hover:bg-white/10 transition-colors">
        <mat-icon>{{ sidebarOpen() ? 'menu_open' : 'menu' }}</mat-icon>
      </button>
      <div class="ml-3 flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <mat-icon class="text-lg">hub</mat-icon>
        </div>
        <span class="font-bold text-lg tracking-tight">Workflow</span>
      </div>
      <span class="flex-1"></span>

      <!-- Notifications Bell -->
      <button
        mat-icon-button
        class="hover:bg-white/10 transition-colors"
        [matBadge]="(unreadCount$ | async) || 0"
        matBadgeColor="warn"
        matBadgeSize="small"
        [routerLink]="['/notifications']"
      >
        <mat-icon>notifications_none</mat-icon>
      </button>

      <!-- User Menu -->
      @let currentUserData = currentUser$ | async;
      @if (currentUserData) {
        <button mat-button [matMenuTriggerFor]="userMenu" class="ml-2 hover:bg-white/10 transition-colors rounded-lg">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
              {{ currentUserData.name.charAt(0) }}
            </div>
            <span class="hidden md:inline text-sm font-medium">{{ currentUserData.name }}</span>
            <mat-icon class="text-base">expand_more</mat-icon>
          </div>
        </button>

        <mat-menu #userMenu="matMenu">
          <div class="px-4 py-3 border-b border-slate-100">
            <p class="text-sm font-semibold text-slate-800">{{ currentUserData.name }}</p>
            <p class="text-xs text-slate-400">{{ currentUserData.email }}</p>
          </div>
          <button mat-menu-item disabled>
            <mat-icon class="text-slate-400">badge</mat-icon>
            <span class="text-slate-500">{{ currentUserData.role }}</span>
          </button>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="onLogout()" class="text-red-600">
            <mat-icon>logout</mat-icon>
            <span>Sign Out</span>
          </button>
        </mat-menu>
      }
    </mat-toolbar>

    <mat-sidenav-container class="h-[calc(100vh-64px)]">
      <mat-sidenav
        #sidenav
        [opened]="sidebarOpen() && !isMobile()"
        [mode]="isMobile() ? 'over' : 'side'"
        class="w-60"
      >
        <div class="py-3">
          <p class="px-5 py-2 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Navigation</p>
          <mat-nav-list class="px-2">
            <a mat-list-item routerLink="/dashboard" routerLinkActive="active" class="nav-item rounded-lg mb-0.5">
              <mat-icon matListItemIcon>dashboard</mat-icon>
              <span matListItemTitle>Dashboard</span>
            </a>
            <a mat-list-item routerLink="/cases" routerLinkActive="active" class="nav-item rounded-lg mb-0.5">
              <mat-icon matListItemIcon>folder_open</mat-icon>
              <span matListItemTitle>Cases</span>
            </a>
            <a mat-list-item routerLink="/tasks" routerLinkActive="active" class="nav-item rounded-lg mb-0.5">
              <mat-icon matListItemIcon>task_alt</mat-icon>
              <span matListItemTitle>My Tasks</span>
            </a>
            <a mat-list-item routerLink="/documents" routerLinkActive="active" class="nav-item rounded-lg mb-0.5">
              <mat-icon matListItemIcon>description</mat-icon>
              <span matListItemTitle>Documents</span>
            </a>
            <a mat-list-item routerLink="/approvals" routerLinkActive="active" class="nav-item rounded-lg mb-0.5">
              <mat-icon matListItemIcon>approval</mat-icon>
              <span matListItemTitle>Approvals</span>
            </a>
          </mat-nav-list>

          <p class="px-5 py-2 mt-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Tools</p>
          <mat-nav-list class="px-2">
            <a mat-list-item routerLink="/workflows" routerLinkActive="active" class="nav-item rounded-lg mb-0.5">
              <mat-icon matListItemIcon>account_tree</mat-icon>
              <span matListItemTitle>Workflow Designer</span>
            </a>
            <a mat-list-item routerLink="/forms" routerLinkActive="active" class="nav-item rounded-lg mb-0.5">
              <mat-icon matListItemIcon>dynamic_form</mat-icon>
              <span matListItemTitle>Form Builder</span>
            </a>
            <a mat-list-item routerLink="/sla" routerLinkActive="active" class="nav-item rounded-lg mb-0.5">
              <mat-icon matListItemIcon>speed</mat-icon>
              <span matListItemTitle>SLA Dashboard</span>
            </a>
          </mat-nav-list>

          @if (currentUserData?.role === 'ADMIN' || currentUserData?.role === 'MANAGER') {
            <p class="px-5 py-2 mt-4 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Administration</p>
            <mat-nav-list class="px-2">
              <a mat-list-item routerLink="/admin/users" routerLinkActive="active" class="nav-item rounded-lg mb-0.5">
                <mat-icon matListItemIcon>people</mat-icon>
                <span matListItemTitle>Users</span>
              </a>
              <a mat-list-item routerLink="/admin/teams" routerLinkActive="active" class="nav-item rounded-lg mb-0.5">
                <mat-icon matListItemIcon>groups</mat-icon>
                <span matListItemTitle>Teams</span>
              </a>
              <a mat-list-item routerLink="/admin/workflows" routerLinkActive="active" class="nav-item rounded-lg mb-0.5">
                <mat-icon matListItemIcon>account_tree</mat-icon>
                <span matListItemTitle>Workflows</span>
              </a>
            </mat-nav-list>
          }
        </div>
      </mat-sidenav>

      <mat-sidenav-content class="p-5 overflow-auto bg-slate-50/80">
        <router-outlet></router-outlet>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .nav-item {
        transition: all 150ms ease;
        border-radius: 8px !important;
      }
      .nav-item:hover {
        background-color: rgba(79, 70, 229, 0.04) !important;
      }
      .nav-item.active {
        background: linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(79, 70, 229, 0.05) 100%) !important;
        border-right: 3px solid #4f46e5;
      }
      .nav-item.active .mat-icon {
        color: #4f46e5 !important;
      }
      .nav-item.active .mdc-list-item__primary-text {
        color: #4f46e5 !important;
        font-weight: 600 !important;
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
      if (user && user.id) {
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
