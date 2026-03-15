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
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DataService } from '../../core/services/data.service';
import { CaseType, Workflow } from '../../core/models';

@Component({
  selector: 'app-admin-case-types',
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
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Case Type Management</h1>
          <p class="text-sm text-gray-500 mt-1">Map case types to workflows — each workflow defines the stages and linked forms</p>
        </div>
        <button mat-raised-button color="primary" (click)="openAddDialog()" data-cy="add-case-type-btn">
          <mat-icon>add_circle</mat-icon>
          Add Case Type
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-[#d0e8f7] flex items-center justify-center">
                <mat-icon class="text-[#056DAE]">category</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ caseTypes.length }}</p>
                <p class="text-xs text-gray-500">Total Case Types</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <mat-icon class="text-green-600">link</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ countLinked() }}</p>
                <p class="text-xs text-gray-500">Linked to Workflow</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <mat-icon class="text-orange-600">account_tree</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ workflows.length }}</p>
                <p class="text-xs text-gray-500">Available Workflows</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Case Types Table -->
      <mat-card class="!shadow-sm">
        <mat-card-header class="!p-4 border-b border-gray-100">
          <mat-card-title class="text-lg">All Case Types</mat-card-title>
        </mat-card-header>
        <mat-card-content class="!p-0">
          @if (isLoading) {
            <div class="flex justify-center py-8">
              <mat-spinner diameter="32"></mat-spinner>
            </div>
          } @else if (caseTypes.length === 0) {
            <div class="text-center py-12 text-gray-500">
              <mat-icon class="!text-5xl !w-12 !h-12 mb-3 text-gray-300">category</mat-icon>
              <p class="font-medium">No case types configured</p>
              <p class="text-sm mt-1">Create your first case type and link it to a workflow</p>
            </div>
          } @else {
            <table mat-table [dataSource]="caseTypes" class="w-full" data-cy="case-types-table">
              <!-- Name -->
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef class="!pl-4">Name</th>
                <td mat-cell *matCellDef="let ct" class="!pl-4">
                  <div class="py-2">
                    <p class="font-medium text-gray-900 text-sm">{{ ct.name }}</p>
                    <p class="text-xs text-gray-500">{{ ct.description }}</p>
                  </div>
                </td>
              </ng-container>

              <!-- Slug -->
              <ng-container matColumnDef="slug">
                <th mat-header-cell *matHeaderCellDef>Slug</th>
                <td mat-cell *matCellDef="let ct">
                  <span class="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">{{ ct.slug }}</span>
                </td>
              </ng-container>

              <!-- Workflow -->
              <ng-container matColumnDef="workflow">
                <th mat-header-cell *matHeaderCellDef>Workflow</th>
                <td mat-cell *matCellDef="let ct">
                  @if (ct.workflowId) {
                    <mat-chip class="bg-[#d0e8f7] text-[#003B70]">
                      <mat-icon class="!text-sm mr-1">account_tree</mat-icon>
                      {{ getWorkflowName(ct.workflowId) }}
                    </mat-chip>
                  } @else {
                    <span class="text-xs text-gray-400 italic">Not linked</span>
                  }
                </td>
              </ng-container>

              <!-- Stages -->
              <ng-container matColumnDef="stages">
                <th mat-header-cell *matHeaderCellDef>Stages</th>
                <td mat-cell *matCellDef="let ct">
                  <div class="flex flex-wrap gap-1">
                    @for (stage of ct.stages; track stage; let i = $index) {
                      <span class="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                        {{ i + 1 }}. {{ stage }}
                      </span>
                    }
                    @if (ct.stages.length === 0) {
                      <span class="text-xs text-gray-400 italic">From workflow</span>
                    }
                  </div>
                </td>
              </ng-container>

              <!-- Actions -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="!text-right !pr-4">Actions</th>
                <td mat-cell *matCellDef="let ct" class="!text-right !pr-4">
                  <button mat-icon-button matTooltip="Edit" (click)="openEditDialog(ct)" data-cy="edit-case-type-btn">
                    <mat-icon class="text-[#056DAE]">edit</mat-icon>
                  </button>
                  <button mat-icon-button matTooltip="Delete" (click)="confirmDelete(ct)" data-cy="delete-case-type-btn">
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

      <!-- Add/Edit Dialog -->
      @if (showDialog()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-cy="case-type-dialog">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div class="p-6 border-b border-gray-100">
              <h2 class="text-lg font-semibold text-gray-900">{{ editingCaseType ? 'Edit Case Type' : 'Add New Case Type' }}</h2>
              <p class="text-sm text-gray-500 mt-1">Link a workflow to automatically derive stages and form mappings</p>
            </div>
            <div class="p-6 space-y-4">
              <mat-form-field class="w-full">
                <mat-label>Name</mat-label>
                <input matInput [(ngModel)]="formName" placeholder="e.g. Loan Origination" data-cy="ct-name-input" />
              </mat-form-field>
              <mat-form-field class="w-full">
                <mat-label>Slug</mat-label>
                <input matInput [(ngModel)]="formSlug" placeholder="e.g. loan_origination" data-cy="ct-slug-input" />
                <mat-hint>Unique identifier (lowercase, underscores)</mat-hint>
              </mat-form-field>
              <mat-form-field class="w-full">
                <mat-label>Description</mat-label>
                <textarea matInput [(ngModel)]="formDescription" rows="2" placeholder="Brief description" data-cy="ct-desc-input"></textarea>
              </mat-form-field>
              <mat-form-field class="w-full">
                <mat-label>Workflow</mat-label>
                <mat-select [(ngModel)]="formWorkflowId" data-cy="ct-workflow-select">
                  <mat-option value="">— None —</mat-option>
                  @for (wf of workflows; track wf.id) {
                    <mat-option [value]="wf.id">
                      <div class="flex items-center gap-2">
                        <mat-icon class="!text-base">account_tree</mat-icon>
                        {{ wf.name }}
                      </div>
                    </mat-option>
                  }
                </mat-select>
                <mat-hint>Stages and form links will come from the selected workflow</mat-hint>
              </mat-form-field>
              @if (formError) {
                <p class="text-sm text-red-600" data-cy="ct-form-error">{{ formError }}</p>
              }
            </div>
            <div class="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button mat-button (click)="closeDialog()" data-cy="ct-cancel-btn">Cancel</button>
              <button mat-raised-button color="primary" (click)="saveCaseType()" [disabled]="isSaving()" data-cy="ct-save-btn">
                {{ isSaving() ? 'Saving...' : (editingCaseType ? 'Update' : 'Create') }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Delete Confirmation -->
      @if (showDeleteConfirm()) {
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-cy="ct-delete-confirm">
          <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div class="p-6">
              <h2 class="text-lg font-semibold text-gray-900 mb-2">Delete Case Type</h2>
              <p class="text-gray-600">Are you sure you want to delete <strong>{{ deletingCaseType?.name }}</strong>? Existing cases of this type will not be affected.</p>
            </div>
            <div class="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button mat-button (click)="showDeleteConfirm.set(false)" data-cy="ct-delete-cancel-btn">Cancel</button>
              <button mat-raised-button color="warn" (click)="deleteCaseType()" data-cy="ct-delete-confirm-btn">Delete</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AdminCaseTypesComponent implements OnInit {
  caseTypes: CaseType[] = [];
  workflows: Workflow[] = [];
  isLoading = true;
  displayedColumns = ['name', 'slug', 'workflow', 'stages', 'actions'];

  // Dialog state
  showDialog = signal(false);
  showDeleteConfirm = signal(false);
  isSaving = signal(false);
  editingCaseType: CaseType | null = null;
  deletingCaseType: CaseType | null = null;

  // Form fields
  formName = '';
  formSlug = '';
  formDescription = '';
  formWorkflowId = '';
  formError = '';

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading = true;
    this.dataService.getCaseTypes().subscribe((types) => {
      this.caseTypes = types;
      this.isLoading = false;
    });
    this.dataService.getWorkflows().subscribe((wfs) => {
      this.workflows = wfs;
    });
  }

  countLinked(): number {
    return this.caseTypes.filter((ct) => ct.workflowId).length;
  }

  getWorkflowName(workflowId: string): string {
    return this.workflows.find((w) => w.id === workflowId)?.name || workflowId;
  }

  openAddDialog(): void {
    this.editingCaseType = null;
    this.formName = '';
    this.formSlug = '';
    this.formDescription = '';
    this.formWorkflowId = '';
    this.formError = '';
    this.showDialog.set(true);
  }

  openEditDialog(ct: CaseType): void {
    this.editingCaseType = ct;
    this.formName = ct.name;
    this.formSlug = ct.slug;
    this.formDescription = ct.description;
    this.formWorkflowId = ct.workflowId || '';
    this.formError = '';
    this.showDialog.set(true);
  }

  closeDialog(): void {
    this.showDialog.set(false);
    this.editingCaseType = null;
  }

  saveCaseType(): void {
    if (!this.formName.trim() || !this.formSlug.trim()) {
      this.formError = 'Name and slug are required';
      return;
    }

    this.isSaving.set(true);
    this.formError = '';

    if (this.editingCaseType) {
      this.dataService.updateCaseType(this.editingCaseType.id, {
        name: this.formName,
        slug: this.formSlug,
        description: this.formDescription,
        workflowId: this.formWorkflowId || undefined,
      }).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeDialog();
          this.loadData();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.formError = err.error?.detail || 'Failed to update case type';
        },
      });
    } else {
      this.dataService.createCaseType({
        name: this.formName,
        slug: this.formSlug,
        description: this.formDescription,
        workflowId: this.formWorkflowId || undefined,
      }).subscribe({
        next: () => {
          this.isSaving.set(false);
          this.closeDialog();
          this.loadData();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.formError = err.error?.detail || 'Failed to create case type';
        },
      });
    }
  }

  confirmDelete(ct: CaseType): void {
    this.deletingCaseType = ct;
    this.showDeleteConfirm.set(true);
  }

  deleteCaseType(): void {
    if (!this.deletingCaseType) return;
    this.dataService.deleteCaseType(this.deletingCaseType.id).subscribe({
      next: () => {
        this.showDeleteConfirm.set(false);
        this.deletingCaseType = null;
        this.loadData();
      },
      error: () => {
        this.showDeleteConfirm.set(false);
      },
    });
  }
}
