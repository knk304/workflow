import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DataService } from '../../core/services/data.service';
import { User, Team } from '../../core/models';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">User Management</h1>
          <p class="text-sm text-gray-500 mt-1">Manage users, roles, and team assignments</p>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <mat-icon class="text-blue-600">people</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ users.length }}</p>
                <p class="text-xs text-gray-500">Total Users</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <mat-icon class="text-purple-600">admin_panel_settings</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ countByRole('ADMIN') }}</p>
                <p class="text-xs text-gray-500">Admins</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <mat-icon class="text-green-600">supervisor_account</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ countByRole('MANAGER') }}</p>
                <p class="text-xs text-gray-500">Managers</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <mat-icon class="text-orange-600">groups</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ teams.length }}</p>
                <p class="text-xs text-gray-500">Teams</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Users Table -->
      <mat-card class="!shadow-sm">
        <mat-card-header class="!p-4 border-b border-gray-100">
          <mat-card-title class="text-lg">All Users</mat-card-title>
        </mat-card-header>
        <mat-card-content class="!p-0">
          @if (isLoading) {
            <div class="flex justify-center py-8">
              <mat-spinner diameter="32"></mat-spinner>
            </div>
          } @else {
            <table mat-table [dataSource]="users" class="w-full">
              <!-- Avatar + Name -->
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef class="!pl-4">User</th>
                <td mat-cell *matCellDef="let user" class="!pl-4">
                  <div class="flex items-center gap-3 py-2">
                    <div class="w-9 h-9 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm">
                      {{ user.avatar || user.name.charAt(0) }}
                    </div>
                    <div>
                      <p class="font-medium text-gray-900 text-sm">{{ user.name }}</p>
                      <p class="text-xs text-gray-500">{{ user.email }}</p>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Role -->
              <ng-container matColumnDef="role">
                <th mat-header-cell *matHeaderCellDef>Role</th>
                <td mat-cell *matCellDef="let user">
                  <mat-chip [ngClass]="roleClass(user.role)">
                    {{ user.role }}
                  </mat-chip>
                </td>
              </ng-container>

              <!-- Teams -->
              <ng-container matColumnDef="teams">
                <th mat-header-cell *matHeaderCellDef>Teams</th>
                <td mat-cell *matCellDef="let user">
                  <div class="flex flex-wrap gap-1">
                    @for (teamId of user.teamIds; track teamId) {
                      <span class="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {{ getTeamName(teamId) }}
                      </span>
                    }
                  </div>
                </td>
              </ng-container>

              <!-- Created -->
              <ng-container matColumnDef="createdAt">
                <th mat-header-cell *matHeaderCellDef>Joined</th>
                <td mat-cell *matCellDef="let user">
                  <span class="text-sm text-gray-600">{{ user.createdAt | date:'mediumDate' }}</span>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="hover:bg-gray-50"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>

      <!-- Teams Section -->
      <mat-card class="!shadow-sm">
        <mat-card-header class="!p-4 border-b border-gray-100">
          <mat-card-title class="text-lg">Teams</mat-card-title>
        </mat-card-header>
        <mat-card-content class="!p-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            @for (team of teams; track team.id) {
              <div class="border border-gray-200 rounded-lg p-4">
                <div class="flex items-center justify-between mb-2">
                  <h3 class="font-semibold text-gray-900">{{ team.name }}</h3>
                  <span class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    {{ team.memberIds.length }} members
                  </span>
                </div>
                @if (team.description) {
                  <p class="text-sm text-gray-600 mb-3">{{ team.description }}</p>
                }
                <div class="flex flex-wrap gap-2">
                  @for (memberId of team.memberIds; track memberId) {
                    <div class="flex items-center gap-1 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                      <mat-icon class="!text-sm !w-4 !h-4">person</mat-icon>
                      {{ getUserName(memberId) }}
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class AdminUsersComponent implements OnInit {
  users: User[] = [];
  teams: Team[] = [];
  isLoading = true;
  displayedColumns = ['name', 'role', 'teams', 'createdAt'];

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getUsers().subscribe((users) => {
      this.users = users;
      this.isLoading = false;
    });
    this.dataService.getTeams().subscribe((teams) => {
      this.teams = teams;
    });
  }

  countByRole(role: string): number {
    return this.users.filter((u) => u.role === role).length;
  }

  getTeamName(teamId: string): string {
    return this.teams.find((t) => t.id === teamId)?.name || teamId;
  }

  getUserName(userId: string): string {
    return this.users.find((u) => u.id === userId)?.name || userId;
  }

  roleClass(role: string): string {
    const classes: Record<string, string> = {
      ADMIN: 'bg-purple-100 text-purple-800',
      MANAGER: 'bg-blue-100 text-blue-800',
      WORKER: 'bg-green-100 text-green-800',
      VIEWER: 'bg-gray-100 text-gray-800',
    };
    return classes[role] || '';
  }
}
