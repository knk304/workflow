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
import {
  selectUnreadNotificationCount,
  selectNotificationsList,
} from '@state/notifications/notifications.selectors';
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
        class="hover:bg-white/10 transition-colors relative"
        [matMenuTriggerFor]="notifMenu"
      >
        <mat-icon>{{ (unreadCount$ | async) ? 'notifications' : 'notifications_none' }}</mat-icon>
        @if (unreadCount$ | async; as count) {
          <span class="absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none px-0.5">
            {{ count > 99 ? '99+' : count }}
          </span>
        }
      </button>

      <mat-menu #notifMenu="matMenu" class="notif-menu">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-2.5 border-b border-slate-100" (click)="$event.stopPropagation()">
          <span class="text-sm font-semibold text-slate-800">Notifications</span>
          @if (unreadCount$ | async) {
            <button class="text-xs text-indigo-600 font-medium hover:text-indigo-800 transition-colors" (click)="markAllRead()">
              Mark all read
            </button>
          }
        </div>

        <!-- List -->
        @if (notifications$ | async; as notifs) {
          @if (notifs.length === 0) {
            <div class="flex flex-col items-center justify-center py-8 px-6 text-center" (click)="$event.stopPropagation()">
              <mat-icon class="text-4xl text-slate-200 mb-2">notifications_none</mat-icon>
              <p class="text-sm text-slate-400">You're all caught up!</p>
            </div>
          } @else {
            <div class="max-h-80 overflow-y-auto">
              @for (n of notifs.slice(0, 10); track n.id) {
                <div
                  class="flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 border-b border-slate-50"
                  [ngClass]="!n.isRead ? 'bg-indigo-50' : ''"
                  (click)="onNotifClick(n)"
                >
                  <!-- type icon -->
                  <div class="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                       [ngClass]="notifIconBg(n.type)">
                    <mat-icon class="!text-base !w-4 !h-4" [ngClass]="notifIconColor(n.type)">{{ notifIcon(n.type) }}</mat-icon>
                  </div>
                  <!-- content -->
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-2">
                      <p class="text-xs font-semibold text-slate-800 leading-tight" [class.font-bold]="!n.isRead">{{ n.title }}</p>
                      @if (!n.isRead) {
                        <span class="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-1"></span>
                      }
                    </div>
                    <p class="text-xs text-slate-500 mt-0.5 line-clamp-2">{{ n.message }}</p>
                    <p class="text-[10px] text-slate-400 mt-1">{{ relativeTime(n.createdAt) }}</p>
                  </div>
                </div>
              }
            </div>
            <!-- Footer -->
            <div class="px-4 py-2 border-t border-slate-100" (click)="$event.stopPropagation()">
              <p class="text-[10px] text-slate-400 text-center">Showing {{ notifs.length > 10 ? 10 : notifs.length }} of {{ notifs.length }}</p>
            </div>
          }
        }
      </mat-menu>

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
      <div class="flex items-center gap-2 px-4 h-12 overflow-x-auto">

        <!-- My Work (Portal Worklist) -->
        <a routerLink="/portal/worklist" routerLinkActive="nav-active" class="nav-link">
          <mat-icon class="nav-icon">assignment_ind</mat-icon>
          <span>My Work</span>
        </a>

        <!-- Cases Dropdown -->
        <button [matMenuTriggerFor]="casesMenu" class="nav-link" [class.nav-active]="isPortalActive">
          <mat-icon class="nav-icon">folder_open</mat-icon>
          <span>Cases</span>
          <mat-icon class="text-base !w-4 !h-4 ml-0.5">arrow_drop_down</mat-icon>
        </button>
        <mat-menu #casesMenu="matMenu">
          <a mat-menu-item routerLink="/portal" [routerLinkActiveOptions]="{exact: true}" routerLinkActive="menu-active">
            <mat-icon>space_dashboard</mat-icon>
            <span>Overview</span>
          </a>
          <a mat-menu-item routerLink="/portal/cases" routerLinkActive="menu-active">
            <mat-icon>cases</mat-icon>
            <span>All Cases</span>
          </a>
          <a mat-menu-item routerLink="/portal/cases/new" routerLinkActive="menu-active">
            <mat-icon>add_circle_outline</mat-icon>
            <span>New Case</span>
          </a>
          <mat-divider></mat-divider>
          <a mat-menu-item routerLink="/portal/flows" routerLinkActive="menu-active">
            <mat-icon>list_alt</mat-icon>
            <span>All Requests</span>
          </a>
          <a mat-menu-item routerLink="/portal/flows/new" routerLinkActive="menu-active">
            <mat-icon>add_circle_outline</mat-icon>
            <span>Create Request</span>
          </a>
        </mat-menu>

        <!-- Approvals -->
        <a routerLink="/approvals" routerLinkActive="nav-active" class="nav-link">
          <mat-icon class="nav-icon">how_to_reg</mat-icon>
          <span>Approvals</span>
          @if (pendingCount$ | async; as count) {
            <span class="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold leading-none px-1">
              {{ count }}
            </span>
          }
        </a>

        <!-- Documents -->
        <a routerLink="/documents" routerLinkActive="nav-active" class="nav-link">
          <mat-icon class="nav-icon">folder_copy</mat-icon>
          <span>Documents</span>
        </a>

        <!-- Dashboard -->
        <a routerLink="/dashboard" routerLinkActive="nav-active" class="nav-link">
          <mat-icon class="nav-icon">bar_chart</mat-icon>
          <span>Analytics</span>
        </a>

        <!-- Design Dropdown (ADMIN / MANAGER) -->
        @if (currentUserData?.role === 'ADMIN' || currentUserData?.role === 'MANAGER') {
          <button [matMenuTriggerFor]="designMenu" class="nav-link" [class.nav-active]="isToolsActive">
            <mat-icon class="nav-icon">design_services</mat-icon>
            <span>Design</span>
            <mat-icon class="text-base !w-4 !h-4 ml-0.5">arrow_drop_down</mat-icon>
          </button>
          <mat-menu #designMenu="matMenu">
            <a mat-menu-item routerLink="/admin/case-types" routerLinkActive="menu-active">
              <mat-icon>category</mat-icon>
              <span>Case Type Designer</span>
            </a>
            <a mat-menu-item routerLink="/flows" routerLinkActive="menu-active">
              <mat-icon>account_tree</mat-icon>
              <span>Flow Designer</span>
            </a>
            <a mat-menu-item routerLink="/forms" routerLinkActive="menu-active">
              <mat-icon>dynamic_form</mat-icon>
              <span>Form Builder</span>
            </a>
            <a mat-menu-item routerLink="/admin/decision-tables" routerLinkActive="menu-active">
              <mat-icon>table_chart</mat-icon>
              <span>Decision Tables</span>
            </a>
            <a mat-menu-item routerLink="/sla" routerLinkActive="menu-active">
              <mat-icon>speed</mat-icon>
              <span>SLA Monitor</span>
            </a>
          </mat-menu>
        }

        <!-- Admin Dropdown -->
        @if (currentUserData?.role === 'ADMIN') {
          <button [matMenuTriggerFor]="adminMenu" class="nav-link" [class.nav-active]="isAdminActive">
            <mat-icon class="nav-icon">manage_accounts</mat-icon>
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
            <a mat-menu-item routerLink="/admin/audit-logs" routerLinkActive="menu-active">
              <mat-icon>history</mat-icon>
              <span>Audit Logs</span>
            </a>
            <a mat-menu-item routerLink="/admin/mail-config" routerLinkActive="menu-active">
              <mat-icon>email</mat-icon>
              <span>Email Notifications</span>
            </a>
            <mat-divider></mat-divider>
            <a mat-menu-item routerLink="/temporal" routerLinkActive="menu-active">
              <mat-icon>schema</mat-icon>
              <span>Temporal Workflows</span>
            </a>
          </mat-menu>
        } @else if (currentUserData?.role === 'MANAGER') {
          <button [matMenuTriggerFor]="adminMenu" class="nav-link" [class.nav-active]="isAdminActive">
            <mat-icon class="nav-icon">manage_accounts</mat-icon>
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
        padding: 4px 14px;
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
  notifications$ = this.store.select(selectNotificationsList);
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
      this.isToolsActive = url.startsWith('/flows') || url.startsWith('/forms') || url.startsWith('/sla') || url.startsWith('/admin/case-types') || url.startsWith('/admin/decision-tables');
      this.isAdminActive = url.startsWith('/admin/users') || url.startsWith('/admin/teams') || url.startsWith('/admin/audit-logs') || url.startsWith('/admin/mail-');
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

  markAllRead(): void {
    this.store.dispatch(NotificationsActions.markAllAsRead());
  }

  onNotifClick(n: { id: string; isRead: boolean; entityType: string; entityId: string }): void {
    if (!n.isRead) {
      this.store.dispatch(NotificationsActions.markAsRead({ notificationId: n.id }));
    }
    if (n.entityType === 'case') {
      this.router.navigate(['/portal/cases', n.entityId]);
    }
  }

  notifIcon(type: string): string {
    return {
      assignment:    'assignment_ind',
      mention:       'alternate_email',
      status_change: 'swap_horiz',
      sla_warning:   'timer',
      comment:       'chat_bubble_outline',
    }[type] ?? 'notifications';
  }

  notifIconBg(type: string): string {
    return {
      assignment:    'bg-indigo-100',
      mention:       'bg-cyan-100',
      status_change: 'bg-emerald-100',
      sla_warning:   'bg-amber-100',
      comment:       'bg-slate-100',
    }[type] ?? 'bg-slate-100';
  }

  notifIconColor(type: string): string {
    return {
      assignment:    'text-indigo-600',
      mention:       'text-cyan-600',
      status_change: 'text-emerald-600',
      sla_warning:   'text-amber-600',
      comment:       'text-slate-600',
    }[type] ?? 'text-slate-500';
  }

  relativeTime(iso: string): string {
    const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours   = Math.floor(minutes / 60);
    const days    = Math.floor(hours / 24);
    if (seconds < 60)  return 'just now';
    if (minutes < 60)  return `${minutes}m ago`;
    if (hours   < 24)  return `${hours}h ago`;
    if (days    <  7)  return `${days}d ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
