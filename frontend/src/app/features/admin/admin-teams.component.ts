import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DataService } from '../../core/services/data.service';
import { User, Team } from '../../core/models';

@Component({
  selector: 'app-admin-teams',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Team Management</h1>
          <p class="text-sm text-gray-500 mt-1">Manage teams, members, and assignments</p>
        </div>
        <button mat-raised-button color="primary" (click)="openAddDialog()" data-cy="add-team-btn">
          <mat-icon>group_add</mat-icon>
          Add Team
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-[#d0e8f7] flex items-center justify-center">
                <mat-icon class="text-[#056DAE]">groups</mat-icon>
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
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6" data-cy="teams-grid">
          @for (team of teams; track team.id) {
            <mat-card class="!shadow-sm" data-cy="team-card">
              <mat-card-header class="!p-4 border-b border-gray-100">
                <div class="flex items-center justify-between w-full">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-[#d0e8f7] flex items-center justify-center">
                      <mat-icon class="text-[#056DAE]">groups</mat-icon>
                    </div>
                    <div>
                      <mat-card-title class="!text-base !font-semibold">{{ team.name }}</mat-card-title>
                      @if (team.description) {
                        <p class="text-xs text-gray-500 mt-0.5">{{ team.description }}</p>
                      }
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs bg-[#EAF4FB] text-[#003B70] px-2.5 py-1 rounded-full font-medium">
                      {{ team.memberIds.length }} {{ team.memberIds.length === 1 ? 'member' : 'members' }}
                    </span>
                    <button mat-icon-button matTooltip="Edit Team" (click)="openEditDialog(team)" data-cy="edit-team-btn">
                      <mat-icon class="text-[#056DAE] !text-xl">edit</mat-icon>
                    </button>
                    <button mat-icon-button matTooltip="Delete Team" (click)="confirmDelete(team)" data-cy="delete-team-btn">
                      <mat-icon class="text-red-500 !text-xl">delete</mat-icon>
                    </button>
                  </div>
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
                            <div class="w-8 h-8 rounded-full bg-[#056DAE] text-white flex items-center justify-center font-bold text-xs">
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

      <!-- Add/Edit Team Dialog -->
      @if (showDialog()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-cy="team-dialog">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div class="p-6 border-b border-gray-100">
              <h2 class="text-lg font-semibold text-gray-900">{{ editingTeam ? 'Edit Team' : 'Add New Team' }}</h2>
            </div>
            <div class="p-6 space-y-4">
              <mat-form-field class="w-full">
                <mat-label>Team Name</mat-label>
                <input matInput [(ngModel)]="formName" data-cy="team-name-input" />
              </mat-form-field>
              <mat-form-field class="w-full">
                <mat-label>Description</mat-label>
                <textarea matInput [(ngModel)]="formDescription" rows="3" data-cy="team-desc-input"></textarea>
              </mat-form-field>
              <mat-form-field class="w-full">
                <mat-label>Members</mat-label>
                <mat-select [(ngModel)]="formMemberIds" multiple data-cy="team-members-select">
                  @for (user of users; track user.id) {
                    <mat-option [value]="user.id">{{ user.name }} ({{ user.role }})</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              @if (formError) {
                <p class="text-sm text-red-600" data-cy="team-form-error">{{ formError }}</p>
              }
            </div>
            <div class="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button mat-button (click)="closeDialog()" data-cy="team-cancel-btn">Cancel</button>
              <button mat-raised-button color="primary" (click)="saveTeam()" [disabled]="isSaving()" data-cy="team-save-btn">
                {{ isSaving() ? 'Saving...' : (editingTeam ? 'Update' : 'Create') }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Delete Confirmation -->
      @if (showDeleteConfirm()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-cy="team-delete-confirm">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div class="p-6">
              <h2 class="text-lg font-semibold text-gray-900 mb-2">Delete Team</h2>
              <p class="text-gray-600">Are you sure you want to delete <strong>{{ deletingTeam?.name }}</strong>? Members will be unassigned.</p>
            </div>
            <div class="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button mat-button (click)="showDeleteConfirm.set(false)" data-cy="team-delete-cancel-btn">Cancel</button>
              <button mat-raised-button color="warn" (click)="deleteTeam()" data-cy="team-delete-confirm-btn">Delete</button>
            </div>
          </div>
        </div>
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

  // Dialog state
  showDialog = signal(false);
  showDeleteConfirm = signal(false);
  isSaving = signal(false);
  editingTeam: Team | null = null;
  deletingTeam: Team | null = null;

  // Form fields
  formName = '';
  formDescription = '';
  formMemberIds: string[] = [];
  formError = '';

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
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
    if (this.teams !== null && this.users !== null && this.users.length >= 0 && this.teams.length >= 0) {
      const assignedIds = new Set(this.teams.flatMap((t) => t.memberIds));
      this.unassignedUsers = this.users.filter((u) => !assignedIds.has(u.id)).length;
      this.isLoading = false;
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
      MANAGER: 'bg-[#d0e8f7] text-[#003B70]',
      WORKER: 'bg-green-100 text-green-800',
      VIEWER: 'bg-gray-100 text-gray-800',
    };
    return classes[role] || '';
  }

  openAddDialog(): void {
    this.editingTeam = null;
    this.formName = '';
    this.formDescription = '';
    this.formMemberIds = [];
    this.formError = '';
    this.showDialog.set(true);
  }

  openEditDialog(team: Team): void {
    this.editingTeam = team;
    this.formName = team.name;
    this.formDescription = team.description || '';
    this.formMemberIds = [...team.memberIds];
    this.formError = '';
    this.showDialog.set(true);
  }

  closeDialog(): void {
    this.showDialog.set(false);
    this.editingTeam = null;
  }

  saveTeam(): void {
    if (!this.formName.trim()) {
      this.formError = 'Team name is required';
      return;
    }

    this.isSaving.set(true);
    this.formError = '';

    if (this.editingTeam) {
      this.dataService.updateTeam(this.editingTeam.id, {
        name: this.formName,
        description: this.formDescription || undefined,
        memberIds: this.formMemberIds,
      }).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeDialog();
          this.loadData();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.formError = err.error?.detail || 'Failed to update team';
        },
      });
    } else {
      this.dataService.createTeam({
        name: this.formName,
        description: this.formDescription || undefined,
        memberIds: this.formMemberIds,
      }).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeDialog();
          this.loadData();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.formError = err.error?.detail || 'Failed to create team';
        },
      });
    }
  }

  confirmDelete(team: Team): void {
    this.deletingTeam = team;
    this.showDeleteConfirm.set(true);
  }

  deleteTeam(): void {
    if (!this.deletingTeam) return;
    this.dataService.deleteTeam(this.deletingTeam.id).subscribe({
      next: () => {
        this.showDeleteConfirm.set(false);
        this.deletingTeam = null;
        this.loadData();
      },
      error: () => {
        this.showDeleteConfirm.set(false);
      },
    });
  }
}
