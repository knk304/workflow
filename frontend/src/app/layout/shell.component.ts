import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { Store } from '@ngrx/store';
import { selectUser, selectIsAuthenticated } from '@state/auth/auth.selectors';
import { selectUnreadNotificationCount } from '@state/notifications/notifications.selectors';
import { selectPendingApprovals } from '@state/approvals/approvals.selectors';
import * as AuthActions from '@state/auth/auth.actions';
import * as NotificationsActions from '@state/notifications/notifications.actions';
import * as ApprovalsActions from '@state/approvals/approvals.actions';
import { SemanticSearchComponent } from '../features/ai/search-bar/semantic-search.component';
import { CopilotPanelComponent } from '../features/ai/copilot-panel/copilot-panel.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    SemanticSearchComponent,
    CopilotPanelComponent,
  ],
  template: `
    @let currentUserData = currentUser$ | async;

    <!-- Primary Toolbar -->
    <mat-toolbar color="primary" class="sticky top-0 z-50">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
          <mat-icon class="text-lg">hub</mat-icon>
        </div>
        <span class="font-bold text-lg tracking-tight">Case Management</span>
      </div>
      <span class="flex-1"></span>

      <!-- Semantic Search -->
      <app-semantic-search class="hidden md:block flex-1 max-w-md mx-4"></app-semantic-search>

      <!-- Notifications Bell -->
      <button
        mat-icon-button
        class="hover:bg-white/10 transition-colors"
        [matBadge]="(unreadCount$ | async) || 0"
        matBadgeColor="warn"
        matBadgeSize="small"
      >
        <mat-icon>notifications_none</mat-icon>
      </button>

      <!-- User Menu -->
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

    <!-- Top Navigation Bar -->
    <nav class="top-nav sticky top-16 z-40 bg-white border-b border-slate-200 shadow-sm">
      <div class="flex items-center gap-1 px-4 h-11 overflow-x-auto">
        <!-- Dashboard -->
        <a routerLink="/dashboard" routerLinkActive="nav-active" class="nav-link">
          <mat-icon class="nav-icon">dashboard</mat-icon>
          <span>Dashboard</span>
        </a>

        <!-- Documents -->
        <a routerLink="/documents" routerLinkActive="nav-active" class="nav-link">
          <mat-icon class="nav-icon">description</mat-icon>
          <span>Documents</span>
        </a>

        <!-- Approvals -->
        <a routerLink="/approvals" routerLinkActive="nav-active" class="nav-link"
           [matBadge]="(pendingCount$ | async) || null"
           matBadgeColor="warn"
           matBadgeSize="small">
          <mat-icon class="nav-icon">approval</mat-icon>
          <span>Approvals</span>
        </a>

        <!-- Portal Dropdown -->
        <button [matMenuTriggerFor]="portalMenu" class="nav-link" [class.nav-active]="isPortalActive">
          <mat-icon class="nav-icon">space_dashboard</mat-icon>
          <span>Portal</span>
          <mat-icon class="text-base !w-4 !h-4 ml-0.5">arrow_drop_down</mat-icon>
        </button>
        <mat-menu #portalMenu="matMenu">
          <a mat-menu-item routerLink="/portal" [routerLinkActiveOptions]="{exact: true}" routerLinkActive="menu-active">
            <mat-icon>space_dashboard</mat-icon>
            <span>Portal Home</span>
          </a>
          <a mat-menu-item routerLink="/portal/worklist" routerLinkActive="menu-active">
            <mat-icon>assignment_ind</mat-icon>
            <span>Worklist</span>
          </a>
          <a mat-menu-item routerLink="/portal/cases" routerLinkActive="menu-active">
            <mat-icon>cases</mat-icon>
            <span>Case Instances</span>
          </a>
        </mat-menu>

        <!-- Tools Dropdown (ADMIN / MANAGER) -->
        @if (currentUserData?.role === 'ADMIN' || currentUserData?.role === 'MANAGER') {
          <button [matMenuTriggerFor]="toolsMenu" class="nav-link" [class.nav-active]="isToolsActive">
            <mat-icon class="nav-icon">build</mat-icon>
            <span>Tools</span>
            <mat-icon class="text-base !w-4 !h-4 ml-0.5">arrow_drop_down</mat-icon>
          </button>
          <mat-menu #toolsMenu="matMenu">
            <a mat-menu-item routerLink="/flows" routerLinkActive="menu-active">
              <mat-icon>account_tree</mat-icon>
              <span>Flow Designer</span>
            </a>
            <a mat-menu-item routerLink="/forms" routerLinkActive="menu-active">
              <mat-icon>dynamic_form</mat-icon>
              <span>Form Builder</span>
            </a>
            <a mat-menu-item routerLink="/sla" routerLinkActive="menu-active">
              <mat-icon>speed</mat-icon>
              <span>SLA Dashboard</span>
            </a>
          </mat-menu>
        }

        <!-- Admin Dropdown -->
        @if (currentUserData?.role === 'ADMIN') {
          <button [matMenuTriggerFor]="adminMenu" class="nav-link" [class.nav-active]="isAdminActive">
            <mat-icon class="nav-icon">admin_panel_settings</mat-icon>
            <span>Admin</span>
            <mat-icon class="text-base !w-4 !h-4 ml-0.5">arrow_drop_down</mat-icon>
          </button>
          <mat-menu #adminMenu="matMenu">
            <a mat-menu-item routerLink="/admin/users" routerLinkActive="menu-active">
              <mat-icon>people</mat-icon>
              <span>Users</span>
            </a>
            <a mat-menu-item routerLink="/admin/teams" routerLinkActive="menu-active">
              <mat-icon>groups</mat-icon>
              <span>Teams</span>
            </a>
            <a mat-menu-item routerLink="/admin/case-types" routerLinkActive="menu-active">
              <mat-icon>category</mat-icon>
              <span>Case Types</span>
            </a>
            <a mat-menu-item routerLink="/admin/decision-tables" routerLinkActive="menu-active">
              <mat-icon>table_chart</mat-icon>
              <span>Decision Tables</span>
            </a>
            <a mat-menu-item routerLink="/admin/audit-logs" routerLinkActive="menu-active">
              <mat-icon>history</mat-icon>
              <span>Audit Logs</span>
            </a>
          </mat-menu>
        } @else if (currentUserData?.role === 'MANAGER') {
          <button [matMenuTriggerFor]="adminMenu" class="nav-link" [class.nav-active]="isAdminActive">
            <mat-icon class="nav-icon">admin_panel_settings</mat-icon>
            <span>Admin</span>
            <mat-icon class="text-base !w-4 !h-4 ml-0.5">arrow_drop_down</mat-icon>
          </button>
          <mat-menu #adminMenu="matMenu">
            <a mat-menu-item routerLink="/admin/teams" routerLinkActive="menu-active">
              <mat-icon>groups</mat-icon>
              <span>Teams</span>
            </a>
          </mat-menu>
        }
      </div>
    </nav>

    <!-- Main Content -->
    <main class="h-[calc(100vh-108px)] p-5 overflow-auto bg-slate-50/80">
      <router-outlet></router-outlet>
    </main>

    <!-- AI Copilot FAB + Panel -->
    <app-copilot-panel></app-copilot-panel>
  `,
  styles: [
    `
      .top-nav {
        scrollbar-width: none;
      }
      .top-nav::-webkit-scrollbar {
        display: none;
      }
      .nav-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 12px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        color: #475569;
        white-space: nowrap;
        cursor: pointer;
        border: none;
        background: none;
        transition: all 150ms ease;
        text-decoration: none;
        height: 32px;
      }
      .nav-link:hover {
        background-color: #f1f5f9;
        color: #0f172a;
      }
      .nav-link.nav-active,
      .nav-link.nav-active:hover {
        background-color: rgba(5, 109, 174, 0.1);
        color: #056DAE;
      }
      .nav-icon {
        font-size: 16px !important;
        width: 16px !important;
        height: 16px !important;
      }
      .menu-active {
        background-color: rgba(5, 109, 174, 0.08) !important;
        color: #056DAE !important;
      }
      .menu-active .mat-icon {
        color: #056DAE !important;
      }
    `,
  ],
})
export class ShellComponent implements OnInit {
  currentUser$ = this.store.select(selectUser);
  isAuthenticated$ = this.store.select(selectIsAuthenticated);
  unreadCount$ = this.store.select(selectUnreadNotificationCount);
  pendingCount$ = this.store.select(selectPendingApprovals).pipe(
    map(list => list.length || null)
  );

  isPortalActive = false;
  isToolsActive = false;
  isAdminActive = false;

  constructor(
    private store: Store,
    private router: Router
  ) {
    this.router.events.subscribe(() => {
      const url = this.router.url;
      this.isPortalActive = url.startsWith('/portal');
      this.isToolsActive = url.startsWith('/flows') || url.startsWith('/forms') || url.startsWith('/sla');
      this.isAdminActive = url.startsWith('/admin');
    });
  }

  ngOnInit(): void {
    this.store.dispatch(ApprovalsActions.loadApprovals({}));
    this.currentUser$.subscribe((user) => {
      if (user && user.id) {
        this.store.dispatch(
          NotificationsActions.loadNotifications({ userId: user.id })
        );
      }
    });
  }

  onLogout(): void {
    this.store.dispatch(AuthActions.logout());
  }
}
