import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DataService } from '../../core/services/data.service';
import { User, Team } from '../../core/models';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">User Management</h1>
          <p class="text-sm text-gray-500 mt-1">Manage users, roles, and team assignments</p>
        </div>
        <button mat-raised-button color="primary" (click)="openAddDialog()" data-cy="add-user-btn">
          <mat-icon>person_add</mat-icon>
          Add User
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-[#d0e8f7] flex items-center justify-center">
                <mat-icon class="text-[#056DAE]">people</mat-icon>
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
            <table mat-table [dataSource]="users" class="w-full" data-cy="users-table">
              <!-- Avatar + Name -->
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef class="!pl-4">User</th>
                <td mat-cell *matCellDef="let user" class="!pl-4">
                  <div class="flex items-center gap-3 py-2">
                    <div class="w-9 h-9 rounded-full bg-[#056DAE] text-white flex items-center justify-center font-bold text-sm">
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

              <!-- Actions -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="!text-right !pr-4">Actions</th>
                <td mat-cell *matCellDef="let user" class="!text-right !pr-4">
                  <button mat-icon-button matTooltip="Edit User" (click)="openEditDialog(user)" data-cy="edit-user-btn">
                    <mat-icon class="text-[#056DAE]">edit</mat-icon>
                  </button>
                  <button mat-icon-button matTooltip="Delete User" (click)="confirmDelete(user)" data-cy="delete-user-btn">
                    <mat-icon class="text-red-500">delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="hover:bg-gray-50"></tr>
            </table>
          }
        </mat-card-content>
      </mat-card>

      <!-- Add/Edit User Dialog -->
      @if (showDialog()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-cy="user-dialog">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div class="p-6 border-b border-gray-100">
              <h2 class="text-lg font-semibold text-gray-900">{{ editingUser ? 'Edit User' : 'Add New User' }}</h2>
            </div>
            <div class="p-6 space-y-4">
              <mat-form-field class="w-full">
                <mat-label>Full Name</mat-label>
                <input matInput [(ngModel)]="formName" data-cy="user-name-input" />
              </mat-form-field>
              <mat-form-field class="w-full">
                <mat-label>Email</mat-label>
                <input matInput type="email" [(ngModel)]="formEmail" [disabled]="!!editingUser" data-cy="user-email-input" />
              </mat-form-field>
              @if (!editingUser) {
                <mat-form-field class="w-full">
                  <mat-label>Password</mat-label>
                  <input matInput type="password" [(ngModel)]="formPassword" data-cy="user-password-input" />
                </mat-form-field>
              }
              <mat-form-field class="w-full">
                <mat-label>Role</mat-label>
                <mat-select [(ngModel)]="formRole" data-cy="user-role-select">
                  @for (role of roles; track role) {
                    <mat-option [value]="role">{{ role }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field class="w-full">
                <mat-label>Teams</mat-label>
                <mat-select [(ngModel)]="formTeamIds" multiple data-cy="user-teams-select">
                  @for (team of teams; track team.id) {
                    <mat-option [value]="team.id">{{ team.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              @if (formError) {
                <p class="text-sm text-red-600" data-cy="user-form-error">{{ formError }}</p>
              }
            </div>
            <div class="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button mat-button (click)="closeDialog()" data-cy="user-cancel-btn">Cancel</button>
              <button mat-raised-button color="primary" (click)="saveUser()" [disabled]="isSaving()" data-cy="user-save-btn">
                {{ isSaving() ? 'Saving...' : (editingUser ? 'Update' : 'Create') }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Delete Confirmation -->
      @if (showDeleteConfirm()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-cy="delete-confirm-dialog">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div class="p-6">
              <h2 class="text-lg font-semibold text-gray-900 mb-2">Delete User</h2>
              <p class="text-gray-600">Are you sure you want to delete <strong>{{ deletingUser?.name }}</strong>? This will deactivate their account.</p>
            </div>
            <div class="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button mat-button (click)="showDeleteConfirm.set(false)" data-cy="delete-cancel-btn">Cancel</button>
              <button mat-raised-button color="warn" (click)="deleteUser()" data-cy="delete-confirm-btn">Delete</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminUsersComponent implements OnInit {
  users: User[] = [];
  teams: Team[] = [];
  isLoading = true;
  displayedColumns = ['name', 'role', 'teams', 'createdAt', 'actions'];
  roles = ['ADMIN', 'MANAGER', 'WORKER', 'VIEWER'];

  // Dialog state
  showDialog = signal(false);
  showDeleteConfirm = signal(false);
  isSaving = signal(false);
  editingUser: User | null = null;
  deletingUser: User | null = null;

  // Form fields
  formName = '';
  formEmail = '';
  formPassword = '';
  formRole = 'WORKER';
  formTeamIds: string[] = [];
  formError = '';

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
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
      MANAGER: 'bg-[#d0e8f7] text-[#003B70]',
      WORKER: 'bg-green-100 text-green-800',
      VIEWER: 'bg-gray-100 text-gray-800',
    };
    return classes[role] || '';
  }

  openAddDialog(): void {
    this.editingUser = null;
    this.formName = '';
    this.formEmail = '';
    this.formPassword = '';
    this.formRole = 'WORKER';
    this.formTeamIds = [];
    this.formError = '';
    this.showDialog.set(true);
  }

  openEditDialog(user: User): void {
    this.editingUser = user;
    this.formName = user.name;
    this.formEmail = user.email;
    this.formPassword = '';
    this.formRole = user.role;
    this.formTeamIds = [...user.teamIds];
    this.formError = '';
    this.showDialog.set(true);
  }

  closeDialog(): void {
    this.showDialog.set(false);
    this.editingUser = null;
  }

  saveUser(): void {
    if (!this.formName.trim() || !this.formEmail.trim()) {
      this.formError = 'Name and email are required';
      return;
    }
    if (!this.editingUser && this.formPassword.length < 6) {
      this.formError = 'Password must be at least 6 characters';
      return;
    }

    this.isSaving.set(true);
    this.formError = '';

    if (this.editingUser) {
      this.dataService.updateUser(this.editingUser.id, {
        name: this.formName,
        role: this.formRole,
        teamIds: this.formTeamIds,
      }).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeDialog();
          this.loadData();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.formError = err.error?.detail || 'Failed to update user';
        },
      });
    } else {
      this.dataService.createUser({
        email: this.formEmail,
        password: this.formPassword,
        name: this.formName,
        role: this.formRole,
        teamIds: this.formTeamIds,
      }).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeDialog();
          this.loadData();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.formError = err.error?.detail || 'Failed to create user';
        },
      });
    }
  }

  confirmDelete(user: User): void {
    this.deletingUser = user;
    this.showDeleteConfirm.set(true);
  }

  deleteUser(): void {
    if (!this.deletingUser) return;
    this.dataService.deleteUser(this.deletingUser.id).subscribe({
      next: () => {
        this.showDeleteConfirm.set(false);
        this.deletingUser = null;
        this.loadData();
      },
      error: () => {
        this.showDeleteConfirm.set(false);
      },
    });
  }
}
