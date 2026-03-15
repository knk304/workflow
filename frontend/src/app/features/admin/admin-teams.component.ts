import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DataService } from '../../core/services/data.service';
import { User, Team } from '../../core/models';

@Component({
  selector: 'app-admin-teams',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  template: `
    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Team Management</h1>
          <p class="text-sm text-gray-500 mt-1">Manage teams, members, and assignments</p>
        </div>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <mat-icon class="text-blue-600">groups</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ teams.length }}</p>
                <p class="text-xs text-gray-500">Total Teams</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <mat-icon class="text-green-600">people</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ totalMembers }}</p>
                <p class="text-xs text-gray-500">Total Members</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <mat-icon class="text-orange-600">person_off</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ unassignedUsers }}</p>
                <p class="text-xs text-gray-500">Unassigned Users</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      @if (isLoading) {
        <div class="flex justify-center py-8">
          <mat-spinner diameter="32"></mat-spinner>
        </div>
      } @else {
        <!-- Teams Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          @for (team of teams; track team.id) {
            <mat-card class="!shadow-sm">
              <mat-card-header class="!p-4 border-b border-gray-100">
                <div class="flex items-center justify-between w-full">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <mat-icon class="text-indigo-600">groups</mat-icon>
                    </div>
                    <div>
                      <mat-card-title class="!text-base !font-semibold">{{ team.name }}</mat-card-title>
                      @if (team.description) {
                        <p class="text-xs text-gray-500 mt-0.5">{{ team.description }}</p>
                      }
                    </div>
                  </div>
                  <span class="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">
                    {{ team.memberIds.length }} {{ team.memberIds.length === 1 ? 'member' : 'members' }}
                  </span>
                </div>
              </mat-card-header>
              <mat-card-content class="!p-4">
                @if (team.memberIds.length === 0) {
                  <p class="text-sm text-gray-400 italic">No members assigned</p>
                } @else {
                  <div class="space-y-2">
                    @for (memberId of team.memberIds; track memberId) {
                      @let member = getUserById(memberId);
                      @if (member) {
                        <div class="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                          <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-xs">
                              {{ member.avatar || member.name.charAt(0) }}
                            </div>
                            <div>
                              <p class="text-sm font-medium text-gray-900">{{ member.name }}</p>
                              <p class="text-xs text-gray-500">{{ member.email }}</p>
                            </div>
                          </div>
                          <mat-chip [ngClass]="roleClass(member.role)" class="!text-xs">
                            {{ member.role }}
                          </mat-chip>
                        </div>
                      }
                    }
                  </div>
                }
              </mat-card-content>
            </mat-card>
          }
        </div>

        <!-- Unassigned Users -->
        @if (getUnassignedUsers().length > 0) {
          <mat-card class="!shadow-sm">
            <mat-card-header class="!p-4 border-b border-gray-100">
              <mat-card-title class="text-lg">Unassigned Users</mat-card-title>
            </mat-card-header>
            <mat-card-content class="!p-4">
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                @for (user of getUnassignedUsers(); track user.id) {
                  <div class="flex items-center gap-3 py-2 px-3 rounded-lg bg-yellow-50 border border-yellow-100">
                    <div class="w-8 h-8 rounded-full bg-yellow-500 text-white flex items-center justify-center font-bold text-xs">
                      {{ user.avatar || user.name.charAt(0) }}
                    </div>
                    <div>
                      <p class="text-sm font-medium text-gray-900">{{ user.name }}</p>
                      <p class="text-xs text-gray-500">{{ user.role }}</p>
                    </div>
                  </div>
                }
              </div>
            </mat-card-content>
          </mat-card>
        }
      }
    </div>
  `,
})
export class AdminTeamsComponent implements OnInit {
  teams: Team[] = [];
  users: User[] = [];
  isLoading = true;
  totalMembers = 0;
  unassignedUsers = 0;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getTeams().subscribe((teams) => {
      this.teams = teams;
      const allMemberIds = new Set(teams.flatMap((t) => t.memberIds));
      this.totalMembers = allMemberIds.size;
      this.checkLoading();
    });
    this.dataService.getUsers().subscribe((users) => {
      this.users = users;
      this.checkLoading();
    });
  }

  private checkLoading(): void {
    if (this.teams.length >= 0 && this.users.length >= 0 && this.isLoading) {
      // Both loaded
      if (this.teams !== null && this.users !== null) {
        const assignedIds = new Set(this.teams.flatMap((t) => t.memberIds));
        this.unassignedUsers = this.users.filter((u) => !assignedIds.has(u.id)).length;
        this.isLoading = false;
      }
    }
  }

  getUserById(userId: string): User | undefined {
    return this.users.find((u) => u.id === userId);
  }

  getUnassignedUsers(): User[] {
    const assignedIds = new Set(this.teams.flatMap((t) => t.memberIds));
    return this.users.filter((u) => !assignedIds.has(u.id));
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
