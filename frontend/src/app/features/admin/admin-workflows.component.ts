import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { RouterLink } from '@angular/router';
import { DataService } from '../../core/services/data.service';
import { Workflow, CaseType } from '../../core/models';

@Component({
  selector: 'app-admin-workflows',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSlideToggleModule,
    RouterLink,
  ],
  template: `
    <div class="space-y-6">
      <!-- Page Header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Workflow Management</h1>
          <p class="text-sm text-gray-500 mt-1">Manage workflow definitions and activation status</p>
        </div>
        <a mat-raised-button color="primary" routerLink="/workflows">
          <mat-icon>add</mat-icon>
          Open Designer
        </a>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-[#d0e8f7] flex items-center justify-center">
                <mat-icon class="text-[#056DAE]">account_tree</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ workflows.length }}</p>
                <p class="text-xs text-gray-500">Total Workflows</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <mat-icon class="text-green-600">check_circle</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ activeCount }}</p>
                <p class="text-xs text-gray-500">Active</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <mat-icon class="text-gray-600">pause_circle</mat-icon>
              </div>
              <div>
                <p class="text-2xl font-bold text-gray-900">{{ workflows.length - activeCount }}</p>
                <p class="text-xs text-gray-500">Inactive</p>
              </div>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      @if (isLoading) {
        <div class="flex justify-center py-8">
          <mat-spinner diameter="32"></mat-spinner>
        </div>
      } @else if (workflows.length === 0) {
        <mat-card class="!shadow-sm">
          <mat-card-content class="!p-12 text-center">
            <mat-icon class="!text-5xl text-gray-300 mb-3">account_tree</mat-icon>
            <p class="text-gray-500 mb-4">No workflows defined yet</p>
            <a mat-raised-button color="primary" routerLink="/workflows">Create First Workflow</a>
          </mat-card-content>
        </mat-card>
      } @else {
        <!-- Workflows List -->
        <div class="space-y-4">
          @for (wf of workflows; track wf.id) {
            <mat-card class="!shadow-sm">
              <mat-card-content class="!p-5">
                <div class="flex items-start justify-between">
                  <div class="flex items-start gap-4">
                    <div class="w-11 h-11 rounded-lg flex items-center justify-center"
                         [ngClass]="wf.isActive ? 'bg-green-100' : 'bg-gray-100'">
                      <mat-icon [ngClass]="wf.isActive ? 'text-green-600' : 'text-gray-400'">account_tree</mat-icon>
                    </div>
                    <div>
                      <div class="flex items-center gap-2 mb-1">
                        <h3 class="font-semibold text-gray-900">{{ wf.name }}</h3>
                        <span class="text-xs px-2 py-0.5 rounded-full font-medium"
                              [ngClass]="wf.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'">
                          {{ wf.isActive ? 'Active' : 'Inactive' }}
                        </span>
                        <span class="text-xs bg-[#EAF4FB] text-[#003B70] px-2 py-0.5 rounded-full">
                          v{{ wf.version }}
                        </span>
                      </div>
                      <p class="text-sm text-gray-600 mb-2">{{ wf.description }}</p>
                      <div class="flex items-center gap-4 text-xs text-gray-400">
                        <span class="flex items-center gap-1">
                          <mat-icon class="!text-sm !w-4 !h-4">category</mat-icon>
                          {{ getCaseTypeName(wf.caseTypeId) }}
                        </span>
                        <span class="flex items-center gap-1">
                          <mat-icon class="!text-sm !w-4 !h-4">hub</mat-icon>
                          {{ wf.definition.nodes.length }} nodes
                        </span>
                        <span class="flex items-center gap-1">
                          <mat-icon class="!text-sm !w-4 !h-4">timeline</mat-icon>
                          {{ wf.definition.edges.length }} connections
                        </span>
                        <span class="flex items-center gap-1">
                          <mat-icon class="!text-sm !w-4 !h-4">schedule</mat-icon>
                          Updated {{ wf.updatedAt || wf.createdAt | date:'mediumDate' }}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <a mat-icon-button matTooltip="Open in Designer" routerLink="/workflows" class="text-gray-400 hover:text-[#056DAE]">
                      <mat-icon>edit</mat-icon>
                    </a>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
})
export class AdminWorkflowsComponent implements OnInit {
  workflows: Workflow[] = [];
  caseTypes: CaseType[] = [];
  isLoading = true;
  activeCount = 0;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getWorkflows().subscribe((wfs) => {
      this.workflows = wfs;
      this.activeCount = wfs.filter((w) => w.isActive).length;
      this.isLoading = false;
    });
    this.dataService.getCaseTypes().subscribe((ct) => {
      this.caseTypes = ct;
    });
  }

  getCaseTypeName(caseTypeId: string): string {
    return this.caseTypes.find((ct) => ct.id === caseTypeId)?.name || caseTypeId;
  }
}
