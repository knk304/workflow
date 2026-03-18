import { Component, OnInit, OnDestroy, signal, ViewChild, TemplateRef } from '@angular/core';
import { AiSummaryCardComponent } from '../ai/summary-card/ai-summary-card.component';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Store } from '@ngrx/store';
import { of, Observable, Subject } from 'rxjs';
import { map, takeUntil, switchMap } from 'rxjs/operators';
import { selectCasesList, selectSelectedCase } from '../../state/cases/cases.selectors';
import * as CasesActions from '../../state/cases/cases.actions';
import * as TasksActions from '../../state/tasks/tasks.actions';
import { Case, Task, TransitionOption, CaseType, FormDefinition, FormField, User, Document as WfDocument } from '../../core/models';
import { CommentsComponent } from '../comments/comments.component';
import { AuditLogComponent } from '../audit/audit-log.component';
import { WebSocketService } from '../../core/services/websocket.service';
import { DataService } from '../../core/services/data.service';
import { selectUser, selectToken } from '../../state/auth/auth.selectors';

@Component({
  selector: 'app-case-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatListModule,
    MatDividerModule,
    MatExpansionModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
    CommentsComponent,
    AuditLogComponent,
    AiSummaryCardComponent,
  ],
  template: `
    @let caseData = case$ | async;
    @if (caseData) {
      <div class="case-detail-container animate-fade-in">
        <!-- Breadcrumb & Back -->
        <div class="flex items-center gap-2 mb-6 text-sm text-slate-500">
          <a routerLink="/cases" class="hover:text-[#056DAE] transition-colors flex items-center gap-1">
            <mat-icon class="text-base">arrow_back</mat-icon>
            Cases
          </a>
          <mat-icon class="text-base">chevron_right</mat-icon>
          <span class="text-slate-800 font-medium">{{ caseData.id }}</span>
        </div>

        <!-- Header Card -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div class="flex items-center gap-4">
              <!-- Case icon -->
              <div class="w-14 h-14 rounded-xl flex items-center justify-center"
                   [ngClass]="statusBg(caseData.status)">
                <mat-icon class="text-3xl" [ngClass]="statusColor(caseData.status)">
                  {{ statusIcon(caseData.status) }}
                </mat-icon>
              </div>
              <div>
                <h1 class="text-2xl font-bold text-slate-900 tracking-tight">{{ caseData.id }}</h1>
                <p class="text-slate-500 mt-0.5">
                  {{ getPrimaryFieldValue(caseData) }}
                  <span class="mx-1.5 text-slate-300">|</span>
                  <span class="wf-badge wf-badge--neutral">{{ caseData.type | uppercase }}</span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <!-- Presence Indicator -->
              @if (wsService.connected()) {
                <div class="flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded-full">
                  <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span class="text-xs text-green-700 font-medium">Live</span>
                  @for (viewer of wsService.presenceUsers(); track viewer.id) {
                    <div class="w-6 h-6 rounded-full bg-[#056DAE] text-white flex items-center justify-center text-[10px] font-bold -ml-1 ring-2 ring-white"
                         [matTooltip]="viewer.name">
                      {{ viewer.name.charAt(0) }}
                    </div>
                  }
                </div>
              }
              <span class="wf-badge" [ngClass]="statusBadge(caseData.status)">
                <span class="w-2 h-2 rounded-full inline-block" [ngClass]="statusDot(caseData.status)"></span>
                {{ caseData.status | uppercase }}
              </span>
              <span class="wf-badge" [ngClass]="priorityBadgeClass(caseData.priority)">
                {{ caseData.priority | uppercase }}
              </span>
            </div>
          </div>
        </div>

        <!-- Stage Journey -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-base font-semibold text-slate-800 flex items-center gap-2">
              <mat-icon class="text-[#056DAE]">route</mat-icon>
              Case Journey
            </h3>
            <span class="text-xs font-semibold text-[#056DAE] bg-[#EAF4FB] px-3 py-1 rounded-full">
              {{ getProgressPercentage(caseData.stages) | number:'1.0-0' }}% Complete
            </span>
          </div>

          <!-- Stage Steps -->
          <div class="flex items-start justify-between relative">
            <!-- Connector line behind circles -->
            <div class="absolute top-5 left-[5%] right-[5%] h-0.5 bg-slate-200 z-0"></div>
            <div class="absolute top-5 left-[5%] h-0.5 bg-[#056DAE] z-0 transition-all duration-500"
                 [style.width.%]="getProgressPercentage(caseData.stages) * 0.9"></div>

            @for (stage of stages; track stage.name) {
              <div class="flex flex-col items-center z-10 flex-1">
                <!-- Circle -->
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ring-4 ring-white"
                     [ngClass]="stageCircleClass(caseData.stages, stage.name)">
                  @if (isStageCompleted(caseData.stages, stage.name)) {
                    <mat-icon class="text-lg">check</mat-icon>
                  } @else if (isStageActive(caseData.stage, stage.name)) {
                    <mat-icon class="text-lg animate-pulse">fiber_manual_record</mat-icon>
                  } @else {
                    <span>{{ stage.order }}</span>
                  }
                </div>
                <!-- Label -->
                <span class="text-[11px] font-semibold mt-2 text-center leading-tight"
                      [ngClass]="isStageCompleted(caseData.stages, stage.name) ? 'text-emerald-700' :
                                 isStageActive(caseData.stage, stage.name) ? 'text-[#003B70]' : 'text-slate-400'">
                  {{ stage.name | uppercase }}
                </span>
              </div>
            }
          </div>

          <!-- Progress Bar -->
          <div class="mt-5">
            <mat-progress-bar
              mode="determinate"
              [value]="getProgressPercentage(caseData.stages)"
            ></mat-progress-bar>
          </div>
        </div>

        <!-- Main Content Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left: Tabs (2 cols) -->
          <div class="lg:col-span-2">
            <mat-tab-group animationDuration="200ms">
              <!-- Details Tab -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <div class="flex items-center gap-2 py-1">
                    <mat-icon>description</mat-icon>
                    <span>Details</span>
                  </div>
                </ng-template>

                <div class="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                  <form [formGroup]="detailsForm" (ngSubmit)="saveChanges()" class="space-y-5">
                    <!-- Dynamic fields from case data -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                      @for (field of dynamicFields; track field.key) {
                        <mat-form-field class="w-full">
                          <mat-label>{{ field.label }}</mat-label>
                          @if (field.type === 'select' && field.options) {
                            <mat-select [formControlName]="field.key" [disabled]="!editing()">
                              @for (opt of field.options; track opt) {
                                <mat-option [value]="opt">{{ opt }}</mat-option>
                              }
                            </mat-select>
                          } @else if (field.type === 'number') {
                            <input matInput type="number" [formControlName]="field.key" [readonly]="!editing()" />
                          } @else if (field.type === 'textarea') {
                            <textarea matInput [formControlName]="field.key" rows="3" [readonly]="!editing()"></textarea>
                          } @else {
                            <input matInput [formControlName]="field.key" [readonly]="!editing()" />
                          }
                          @if (field.icon) {
                            <mat-icon matIconPrefix>{{ field.icon }}</mat-icon>
                          }
                        </mat-form-field>
                      }

                      <mat-form-field class="w-full">
                        <mat-label>Status</mat-label>
                        <mat-select formControlName="status" [disabled]="!editing()">
                          <mat-option value="open">Open</mat-option>
                          <mat-option value="in_progress">In Progress</mat-option>
                          <mat-option value="pending">Pending</mat-option>
                          <mat-option value="resolved">Resolved</mat-option>
                          <mat-option value="withdrawn">Withdrawn</mat-option>
                        </mat-select>
                        <mat-icon matIconPrefix>flag</mat-icon>
                      </mat-form-field>

                      <mat-form-field class="w-full">
                        <mat-label>Priority</mat-label>
                        <mat-select formControlName="priority" [disabled]="!editing()">
                          <mat-option value="critical">Critical</mat-option>
                          <mat-option value="high">High</mat-option>
                          <mat-option value="medium">Medium</mat-option>
                          <mat-option value="low">Low</mat-option>
                        </mat-select>
                        <mat-icon matIconPrefix>priority_high</mat-icon>
                      </mat-form-field>
                    </div>

                    <mat-form-field class="w-full">
                      <mat-label>Notes</mat-label>
                      <textarea matInput formControlName="notes" rows="4" [readonly]="!editing()"></textarea>
                      <mat-icon matIconPrefix>notes</mat-icon>
                    </mat-form-field>

                    @if (editing()) {
                      <div class="flex gap-3 pt-2">
                        <button mat-raised-button color="primary" type="submit">
                          <mat-icon>save</mat-icon>
                          Save Changes
                        </button>
                        <button mat-stroked-button type="button" (click)="cancelEdit()">
                          <mat-icon>undo</mat-icon>
                          Cancel
                        </button>
                      </div>
                    }
                  </form>
                </div>
              </mat-tab>

              <!-- Tasks Tab -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <div class="flex items-center gap-2 py-1">
                    <mat-icon>task_alt</mat-icon>
                    <span>Tasks</span>
                    @if (tasks.length > 0) {
                      <span class="ml-1 bg-[#d0e8f7] text-[#003B70] text-[11px] font-bold px-2 py-0.5 rounded-full">
                        {{ tasks.length }}
                      </span>
                    }
                  </div>
                </ng-template>

                <div class="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                  <!-- Create Task Form -->
                  @if (showCreateTask()) {
                    <div class="mb-6 p-5 bg-slate-50 rounded-xl border border-slate-200 animate-fade-in">
                      <h4 class="text-sm font-semibold text-slate-700 mb-4">New Task</h4>
                      <form [formGroup]="createTaskForm" (ngSubmit)="submitCreateTask()" class="space-y-4">
                        <mat-form-field class="w-full">
                          <mat-label>Title</mat-label>
                          <input matInput formControlName="title" placeholder="Task title">
                        </mat-form-field>
                        <mat-form-field class="w-full">
                          <mat-label>Description</mat-label>
                          <textarea matInput formControlName="description" rows="2" placeholder="Task description"></textarea>
                        </mat-form-field>
                        <div class="grid grid-cols-3 gap-4">
                          <mat-form-field>
                            <mat-label>Priority</mat-label>
                            <mat-select formControlName="priority">
                              <mat-option value="low">Low</mat-option>
                              <mat-option value="medium">Medium</mat-option>
                              <mat-option value="high">High</mat-option>
                              <mat-option value="critical">Critical</mat-option>
                            </mat-select>
                          </mat-form-field>
                          <mat-form-field>
                            <mat-label>Due Date</mat-label>
                            <input matInput type="date" formControlName="dueDate">
                          </mat-form-field>
                          <mat-form-field>
                            <mat-label>Assign To</mat-label>
                            <mat-select formControlName="assigneeId">
                              <mat-option value="">Unassigned</mat-option>
                              @for (u of allUsers; track u.id) {
                                <mat-option [value]="u.id">{{ u.name }}</mat-option>
                              }
                            </mat-select>
                          </mat-form-field>
                        </div>
                        <div class="flex justify-end gap-3">
                          <button mat-stroked-button type="button" (click)="showCreateTask.set(false)">Cancel</button>
                          <button mat-raised-button color="primary" type="submit" [disabled]="createTaskForm.invalid">
                            <mat-icon>add</mat-icon> Create
                          </button>
                        </div>
                      </form>
                    </div>
                  }

                  @if (tasks.length > 0) {
                    <div class="flex justify-end mb-4">
                      <button mat-stroked-button color="primary" (click)="showCreateTask.set(true)">
                        <mat-icon>add</mat-icon> Create Task
                      </button>
                    </div>
                    <div class="space-y-3">
                      @for (task of tasks; track task.id) {
                        @if (editingTask()?.id === task.id) {
                          <!-- Inline Edit Form -->
                          <div class="p-4 rounded-lg border-2 border-[#056DAE] bg-[#EAF4FB]/30 animate-fade-in">
                            <form [formGroup]="editTaskForm" (ngSubmit)="saveTaskEdit(task.id)" class="space-y-3">
                              <mat-form-field class="w-full">
                                <mat-label>Title</mat-label>
                                <input matInput formControlName="title">
                              </mat-form-field>
                              <mat-form-field class="w-full">
                                <mat-label>Description</mat-label>
                                <textarea matInput formControlName="description" rows="2"></textarea>
                              </mat-form-field>
                              <div class="grid grid-cols-2 gap-3">
                                <mat-form-field>
                                  <mat-label>Status</mat-label>
                                  <mat-select formControlName="status">
                                    <mat-option value="pending">Pending</mat-option>
                                    <mat-option value="in_progress">In Progress</mat-option>
                                    <mat-option value="review">Review</mat-option>
                                    <mat-option value="completed">Completed</mat-option>
                                    <mat-option value="blocked">Blocked</mat-option>
                                  </mat-select>
                                </mat-form-field>
                                <mat-form-field>
                                  <mat-label>Priority</mat-label>
                                  <mat-select formControlName="priority">
                                    <mat-option value="low">Low</mat-option>
                                    <mat-option value="medium">Medium</mat-option>
                                    <mat-option value="high">High</mat-option>
                                    <mat-option value="critical">Critical</mat-option>
                                  </mat-select>
                                </mat-form-field>
                              </div>
                              <div class="grid grid-cols-2 gap-3">
                                <mat-form-field>
                                  <mat-label>Due Date</mat-label>
                                  <input matInput type="date" formControlName="dueDate">
                                </mat-form-field>
                                <mat-form-field>
                                  <mat-label>Assign To</mat-label>
                                  <mat-select formControlName="assigneeId">
                                    <mat-option value="">Unassigned</mat-option>
                                    @for (u of allUsers; track u.id) {
                                      <mat-option [value]="u.id">{{ u.name }}</mat-option>
                                    }
                                  </mat-select>
                                </mat-form-field>
                              </div>
                              <div class="flex justify-end gap-3">
                                <button mat-stroked-button type="button" (click)="cancelTaskEdit()">Cancel</button>
                                <button mat-raised-button color="primary" type="submit" [disabled]="editTaskForm.invalid">
                                  <mat-icon>save</mat-icon> Save
                                </button>
                              </div>
                            </form>
                          </div>
                        } @else {
                          <div class="group flex items-start gap-4 p-4 rounded-lg border border-slate-100 hover:border-[#a1d1ef] hover:bg-[#EAF4FB]/30 transition-all duration-200 cursor-pointer"
                               (click)="startEditTask(task)">
                            <!-- Status Icon -->
                            <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                 [ngClass]="taskStatusBg(task.status)">
                              <mat-icon class="text-lg" [ngClass]="taskStatusColor(task.status)">
                                {{ taskStatusIcon(task.status) }}
                              </mat-icon>
                            </div>
                            <!-- Content -->
                            <div class="flex-1 min-w-0">
                              <h4 class="font-semibold text-slate-800 text-sm">{{ task.title }}</h4>
                              <p class="text-xs text-slate-500 mt-0.5 truncate">{{ task.description }}</p>
                              <div class="flex items-center gap-2 mt-2">
                                @if (task.assigneeId) {
                                  <span class="inline-flex items-center gap-1 text-[11px] text-slate-600 bg-[#EAF4FB] px-2 py-0.5 rounded-full">
                                    <mat-icon class="text-xs">person</mat-icon>
                                    {{ getUserName(task.assigneeId) }}
                                  </span>
                                }
                                @if (task.dueDate) {
                                  <span class="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                                    <mat-icon class="text-xs">schedule</mat-icon>
                                    {{ task.dueDate | date: 'mediumDate' }}
                                  </span>
                                }
                                <span class="wf-badge text-[10px]" [ngClass]="priorityBadgeClass(task.priority)">
                                  {{ task.priority | uppercase }}
                                </span>
                              </div>
                            </div>
                            <!-- Edit Icon -->
                            <mat-icon class="text-slate-300 group-hover:text-[#056DAE] transition-colors"
                                      matTooltip="Click to edit">
                              edit
                            </mat-icon>
                          </div>
                        }
                      }
                    </div>
                  } @else {
                    <div class="text-center py-12">
                      <mat-icon class="text-5xl text-slate-200">task_alt</mat-icon>
                      <p class="text-slate-400 mt-3 text-sm">No tasks for this case yet</p>
                      <button mat-stroked-button color="primary" class="mt-4" (click)="showCreateTask.set(true)">
                        <mat-icon>add</mat-icon> Create Task
                      </button>
                    </div>
                  }
                </div>
              </mat-tab>

              <!-- Documents Tab -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <div class="flex items-center gap-2 py-1">
                    <mat-icon>description</mat-icon>
                    <span>Documents</span>
                    @if (documents.length > 0) {
                      <span class="ml-1 bg-purple-100 text-purple-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                        {{ documents.length }}
                      </span>
                    }
                  </div>
                </ng-template>

                <div class="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                  <!-- Upload Zone -->
                  <div class="mb-6 p-5 bg-slate-50 rounded-xl border border-dashed border-slate-300 hover:border-[#056DAE] hover:bg-[#EAF4FB]/30 transition-colors"
                       (dragover)="onDocumentDragOver($event)"
                       (dragleave)="docDragOver.set(false)"
                       (drop)="onDocumentDrop($event, caseData.id)">
                    <div class="flex items-center justify-center gap-3">
                      <mat-icon class="text-slate-400">cloud_upload</mat-icon>
                      <div class="text-left">
                        <p class="text-sm font-medium text-slate-700">Drag documents here or
                          <button type="button" mat-button color="primary" class="!p-0 !h-auto !min-w-0 inline"
                                  (click)="docFileInput.click()">
                            browse
                          </button>
                        </p>
                        <p class="text-xs text-slate-500">Supported formats: PDF, DOC, DOCX, XLS, XLSX</p>
                      </div>
                      <input type="file" #docFileInput class="hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                             (change)="onDocumentSelected($event, caseData.id)">
                    </div>
                  </div>

                  <!-- Documents List -->
                  @if (documents.length > 0) {
                    <div class="space-y-3">
                      @for (doc of documents; track doc.id) {
                        <div class="flex items-start gap-4 p-4 rounded-lg border border-slate-100 hover:border-[#a1d1ef] hover:bg-[#EAF4FB]/30 transition-all duration-200">
                          <!-- File Icon -->
                          <div class="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple-50">
                            <mat-icon class="text-purple-600">{{ getDocumentIcon(doc.contentType) }}</mat-icon>
                          </div>
                          <!-- Content -->
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                              <h4 class="font-semibold text-slate-800 text-sm truncate">{{ doc.filename }}</h4>
                              @if (doc.version > 1) {
                                <span class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">
                                  v{{ doc.version }}
                                </span>
                              }
                            </div>
                            <p class="text-xs text-slate-500 mt-0.5">
                              {{ formatFileSize(doc.sizeBytes) }} • Uploaded by {{ getUserName(doc.uploadedBy) }}
                            </p>
                            <p class="text-xs text-slate-400 mt-1">{{ doc.uploadedAt | date: 'mediumDate' }}</p>
                            @if (doc.tags && doc.tags.length > 0) {
                              <div class="flex gap-1 mt-2 flex-wrap">
                                @for (tag of doc.tags; track tag) {
                                  <span class="inline-flex text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                    {{ tag }}
                                  </span>
                                }
                              </div>
                            }
                          </div>
                          <!-- Actions -->
                          <div class="flex items-center gap-2 flex-shrink-0">
                            <button mat-icon-button class="w-9 h-9" matTooltip="Download"
                                    (click)="downloadDocument(doc)">
                              <mat-icon class="text-slate-400 hover:text-[#056DAE]">download</mat-icon>
                            </button>
                            <button mat-icon-button class="w-9 h-9" matTooltip="Delete"
                                    (click)="deleteDocument(doc)">
                              <mat-icon class="text-slate-400 hover:text-red-500">delete</mat-icon>
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  } @else {
                    <div class="text-center py-12">
                      <mat-icon class="text-5xl text-slate-200">description</mat-icon>
                      <p class="text-slate-400 mt-3 text-sm">No documents attached to this case yet</p>
                    </div>
                  }
                </div>
              </mat-tab>

              <!-- Activity Tab -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <div class="flex items-center gap-2 py-1">
                    <mat-icon>history</mat-icon>
                    <span>Activity</span>
                  </div>
                </ng-template>

                <div class="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                  <app-audit-log [entityId]="caseData.id"></app-audit-log>
                </div>
              </mat-tab>

              <!-- Comments Tab -->
              <mat-tab>
                <ng-template mat-tab-label>
                  <div class="flex items-center gap-2 py-1">
                    <mat-icon>chat_bubble_outline</mat-icon>
                    <span>Comments</span>
                  </div>
                </ng-template>

                <div class="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6">
                  <app-comments [caseId]="caseData.id"></app-comments>
                </div>
              </mat-tab>
            </mat-tab-group>
          </div>

          <!-- Right: Summary Sidebar -->
          <div class="space-y-5">
            <!-- AI Summary Card -->
            <app-ai-summary-card [caseId]="caseData.id"></app-ai-summary-card>

            <!-- Case Info Card -->
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div class="bg-slate-50 px-5 py-3 border-b border-slate-200">
                <h4 class="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <mat-icon class="text-base text-slate-400">info</mat-icon>
                  Case Information
                </h4>
              </div>
              <div class="divide-y divide-slate-100">
                <div class="px-5 py-3">
                  <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Case ID</p>
                  <p class="text-sm font-mono text-slate-800 mt-0.5">{{ caseData.id }}</p>
                </div>
                <div class="px-5 py-3">
                  <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Type</p>
                  <p class="text-sm text-slate-800 mt-0.5">{{ caseData.type | uppercase }}</p>
                </div>
                <div class="px-5 py-3">
                  <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Current Stage</p>
                  <span class="wf-badge mt-1" [ngClass]="stageBadgeClass(caseData.stage)">
                    {{ caseData.stage | uppercase }}
                  </span>
                </div>
                <div class="px-5 py-3">
                  <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Assigned To</p>
                  <div class="flex items-center gap-2 mt-1">
                    <div class="w-6 h-6 rounded-full bg-[#d0e8f7] text-[#056DAE] flex items-center justify-center text-xs font-bold">
                      {{ (caseData.assignedTo?.name || 'U').charAt(0) }}
                    </div>
                    <span class="text-sm text-slate-800 flex-1">{{ caseData.assignedTo?.name || 'Unassigned' }}</span>
                    <button mat-icon-button class="w-7 h-7" matTooltip="Change Assignee"
                            (click)="openAssigneeDialog()">
                      <mat-icon class="text-base text-slate-400 hover:text-[#056DAE]">swap_horiz</mat-icon>
                    </button>
                  </div>
                </div>
                <div class="px-5 py-3">
                  <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Created</p>
                  <p class="text-sm text-slate-800 mt-0.5">{{ caseData.createdAt | date: 'mediumDate' }}</p>
                </div>
                <div class="px-5 py-3">
                  <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Last Updated</p>
                  <p class="text-sm text-slate-800 mt-0.5">{{ caseData.updatedAt | date: 'mediumDate' }}</p>
                </div>
              </div>
            </div>

            <!-- SLA Card -->
            @if (caseData.sla) {
              <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="bg-slate-50 px-5 py-3 border-b border-slate-200">
                  <h4 class="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <mat-icon class="text-base text-slate-400">timer</mat-icon>
                    SLA Tracking
                  </h4>
                </div>
                <div class="p-5 space-y-4">
                  <div>
                    <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Target Resolution</p>
                    <p class="text-sm text-slate-800 mt-0.5">{{ caseData.sla.targetResolutionDate | date: 'mediumDate' }}</p>
                  </div>
                  <div>
                    <p class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Days Remaining</p>
                    <div class="flex items-center gap-2 mt-1">
                      <div class="text-2xl font-bold" [ngClass]="slaColor(caseData.sla.daysRemaining ?? 0)">
                        {{ caseData.sla.daysRemaining ?? 0 }}
                      </div>
                      <span class="text-xs text-slate-500">days left</span>
                    </div>
                  </div>
                  @if (caseData.sla.escalated) {
                    <div class="flex items-center gap-2 bg-red-50 text-red-700 px-3 py-2 rounded-lg text-xs font-semibold">
                      <mat-icon class="text-base">warning</mat-icon>
                      Escalated (Level {{ caseData.sla.escalationLevel }})
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Quick Actions -->
            <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div class="bg-slate-50 px-5 py-3 border-b border-slate-200">
                <h4 class="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <mat-icon class="text-base text-slate-400">bolt</mat-icon>
                  Quick Actions
                </h4>
              </div>
              <div class="p-4 space-y-2">
                <button mat-stroked-button class="w-full justify-start" (click)="toggleEdit()">
                  <mat-icon class="text-[#056DAE]">{{ editing() ? 'edit_off' : 'edit' }}</mat-icon>
                  <span class="ml-1">{{ editing() ? 'Cancel Edit' : 'Edit Case' }}</span>
                </button>
                <button mat-stroked-button class="w-full justify-start" (click)="openTransitionDialog()">
                  <mat-icon class="text-purple-500">swap_horiz</mat-icon>
                  <span class="ml-1">Transition Stage</span>
                </button>
                <button mat-stroked-button class="w-full justify-start" (click)="openAssigneeDialog()">
                  <mat-icon class="text-amber-500">person_add</mat-icon>
                  <span class="ml-1">Change Assignee</span>
                </button>
                <button mat-stroked-button class="w-full justify-start" (click)="scrollToComments()">
                  <mat-icon class="text-cyan-500">chat_bubble_outline</mat-icon>
                  <span class="ml-1">Add Comment</span>
                </button>
                <button mat-stroked-button class="w-full justify-start text-red-600" (click)="closeCase()">
                  <mat-icon>archive</mat-icon>
                  <span class="ml-1">Close Case</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    } @else {
      <!-- Empty State -->
      <div class="flex flex-col items-center justify-center py-24 animate-fade-in">
        <div class="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <mat-icon class="text-4xl text-slate-300">search_off</mat-icon>
        </div>
        <h2 class="text-lg font-semibold text-slate-700">Case Not Found</h2>
        <p class="text-slate-400 text-sm mt-1">The case you're looking for doesn't exist or has been removed.</p>
        <button mat-raised-button color="primary" routerLink="/cases" class="mt-6">
          <mat-icon>arrow_back</mat-icon>
          Back to Cases
        </button>
      </div>
    }

    <!-- Transition Dialog -->
    <ng-template #transitionDialogTpl>
      <div class="p-6 min-w-[420px]">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
            <mat-icon class="text-purple-500">swap_horiz</mat-icon>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-slate-800">Stage Transition</h3>
            <p class="text-xs text-slate-400">Move this case to the next stage</p>
          </div>
        </div>
        @if (availableTransitions().length > 0) {
          <div class="space-y-3">
            @for (t of availableTransitions(); track t.action) {
              <button mat-raised-button class="w-full" [color]="t.action === 'reject' ? 'warn' : 'primary'"
                      (click)="performTransition(t.action, caseId!)">
                <mat-icon>{{ t.action === 'reject' ? 'undo' : t.action === 'complete' ? 'check_circle' : 'arrow_forward' }}</mat-icon>
                <span class="ml-1 capitalize">{{ t.action }}</span>
                <span class="text-xs opacity-75 ml-1">(→ {{ t.to | uppercase }})</span>
              </button>
            }
          </div>
          <mat-form-field class="w-full mt-4">
            <mat-label>Transition Notes (optional)</mat-label>
            <textarea matInput [(ngModel)]="transitionNotes" rows="2"></textarea>
          </mat-form-field>
        } @else {
          <div class="text-center py-6">
            <mat-icon class="text-4xl text-slate-200">block</mat-icon>
            <p class="text-slate-400 text-sm mt-2">No transitions available for your role at this stage.</p>
          </div>
        }
      </div>
    </ng-template>

    <!-- Assignee Dialog -->
    <ng-template #assigneeDialogTpl>
      <div class="p-6 min-w-[420px]">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <mat-icon class="text-amber-500">person_add</mat-icon>
          </div>
          <div>
            <h3 class="text-lg font-semibold text-slate-800">Change Assignee</h3>
            <p class="text-xs text-slate-400">Reassign this case to another user</p>
          </div>
        </div>
        @if (allUsers.length > 0) {
          <div class="max-h-72 overflow-y-auto space-y-1">
            @for (u of allUsers; track u.id) {
              <button class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-[#EAF4FB] transition-colors"
                      [ngClass]="{'bg-[#EAF4FB] ring-1 ring-[#056DAE]': currentCase?.assignedTo?.id === u.id}"
                      (click)="changeAssignee(u.id, caseId!)">
                <div class="w-9 h-9 rounded-full bg-[#d0e8f7] text-[#056DAE] flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {{ u.name.charAt(0) }}
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-slate-800 truncate">{{ u.name }}</p>
                  <p class="text-[11px] text-slate-400 truncate">{{ u.email }} · {{ u.role }}</p>
                </div>
                @if (currentCase?.assignedTo?.id === u.id) {
                  <mat-icon class="text-[#056DAE] text-base flex-shrink-0">check_circle</mat-icon>
                }
              </button>
            }
          </div>
        } @else {
          <div class="text-center py-6">
            <mat-icon class="text-4xl text-slate-200">group_off</mat-icon>
            <p class="text-slate-400 text-sm mt-2">No users available.</p>
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    :host {
      display: block;
    }
    .case-detail-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }
  `],
})
export class CaseDetailComponent implements OnInit, OnDestroy {
  case$!: Observable<Case | undefined>;
  detailsForm: FormGroup;
  createTaskForm: FormGroup;
  tasks: Task[] = [];
  showCreateTask = signal(false);
  editing = signal(false);
  editingTask = signal<Task | null>(null);
  availableTransitions = signal<TransitionOption[]>([]);
  transitionNotes = '';
  dynamicFields: { key: string; label: string; type: string; icon?: string; options?: string[] }[] = [];
  allUsers: User[] = [];
  editTaskForm!: FormGroup;
  @ViewChild('transitionDialogTpl') transitionDialogTpl!: TemplateRef<any>;
  @ViewChild('assigneeDialogTpl') assigneeDialogTpl!: TemplateRef<any>;
  caseId: string | null = null;
  private destroy$ = new Subject<void>();
  currentCase: Case | null = null;

  stages: { name: string; order: number }[] = [];
  documents: WfDocument[] = [];
  docDragOver = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private store: Store,
    private formBuilder: FormBuilder,
    private snackBar: MatSnackBar,
    private dataService: DataService,
    public wsService: WebSocketService,
    private dialog: MatDialog,
  ) {
    this.detailsForm = this.formBuilder.group({
      status: [''],
      priority: [''],
      notes: [''],
    });
    this.createTaskForm = this.formBuilder.group({
      title: ['', Validators.required],
      description: [''],
      priority: ['medium'],
      dueDate: [''],
      assigneeId: [''],
    });
    this.editTaskForm = this.formBuilder.group({
      title: ['', Validators.required],
      description: [''],
      status: [''],
      priority: ['medium'],
      dueDate: [''],
      assigneeId: [''],
    });
  }

  ngOnInit(): void {
    const caseId = this.route.snapshot.paramMap.get('id');
    this.caseId = caseId;

    if (caseId) {
      this.store.dispatch(CasesActions.loadCaseById({ id: caseId }));
    }

    this.case$ = this.store.select(selectSelectedCase).pipe(
      switchMap(selected => {
        if (selected && selected.id === caseId) return of(selected);
        return this.store.select(selectCasesList).pipe(
          map(cases => cases.find(c => c.id === caseId))
        );
      }),
    );

    this.case$.pipe(takeUntil(this.destroy$)).subscribe(selectedCase => {
      if (selectedCase) {
        this.currentCase = selectedCase;
        this.buildDynamicForm(selectedCase);
        this.updateForm(selectedCase);
        this.loadStagesFromCaseType(selectedCase.type);
        this.loadAvailableTransitions();
      }
    });

    if (caseId) {
      this.loadTasks(caseId);
      this.loadDocuments(caseId);
    }

    // Load users for assignee picker
    this.dataService.getUsers().pipe(takeUntil(this.destroy$)).subscribe(users => {
      this.allUsers = users;
    });

    if (caseId) {
      this.store.select(selectToken).pipe(takeUntil(this.destroy$)).subscribe(token => {
        if (token) {
          this.wsService.connect(caseId, token);
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.wsService.disconnect();
  }

  // ─── Dynamic Form ────────────────────────────
  private buildDynamicForm(case_: Case): void {
    if (this.dynamicFields.length > 0) return; // Already built

    const fields = case_.fields || {};

    // First try to load FormDefinition for this case type (gives proper labels/types)
    this.dataService.getCaseTypes().pipe(takeUntil(this.destroy$)).subscribe(caseTypes => {
      const ct = caseTypes.find(t => t.slug === case_.type);
      if (ct) {
        this.dataService.getFormDefinitions(ct.id).pipe(takeUntil(this.destroy$)).subscribe(forms => {
          const formDef = forms.find(f => f.stage === 'intake' && f.isActive !== false);
          if (formDef && formDef.fields.length > 0) {
            // Use FormDefinition for labels, types, icons
            this.dynamicFields = formDef.fields
              .sort((a, b) => a.order - b.order)
              .filter(f => fields[f.id] !== undefined)
              .map(f => ({
                key: f.id,
                label: f.label,
                type: f.type === 'select' ? 'select' : f.type === 'number' ? 'number' : f.type === 'textarea' ? 'textarea' : 'text',
                icon: this.guessFieldIcon(f.id, f.label),
                options: f.validation?.options,
              }));
            // Also add any case fields not in the form definition
            for (const key of Object.keys(fields)) {
              if (!this.dynamicFields.some(d => d.key === key)) {
                this.dynamicFields.push({ key, label: this.formatLabel(key), type: typeof fields[key] === 'number' ? 'number' : 'text' });
              }
            }
          } else {
            // Fall back to fieldsSchema or raw keys
            this.buildDynamicFieldsFromSchema(ct, fields);
          }
          this.addDynamicControls(fields);
        });
      } else {
        this.buildDynamicFieldsFallback(fields);
        this.addDynamicControls(fields);
      }
    });

    // Initial fallback from raw keys (shows immediately, then updated from API)
    this.buildDynamicFieldsFallback(fields);
    this.addDynamicControls(fields);
  }

  private buildDynamicFieldsFromSchema(ct: CaseType, fields: Record<string, any>): void {
    const iconMap: Record<string, string> = {
      applicantName: 'person', loanAmount: 'payments', loanType: 'category',
      applicantIncome: 'account_balance', interestRate: 'percent', loanTerm: 'date_range',
    };
    if (ct.fieldsSchema && Object.keys(ct.fieldsSchema).length > 0) {
      this.dynamicFields = Object.entries(ct.fieldsSchema).map(([key, schema]) => ({
        key,
        label: (schema as any).label || this.formatLabel(key),
        type: (schema as any).type === 'number' ? 'number' : (schema as any).type === 'select' ? 'select' : 'text',
        icon: iconMap[key],
        options: (schema as any).options,
      }));
    } else {
      this.buildDynamicFieldsFallback(fields);
    }
  }

  private buildDynamicFieldsFallback(fields: Record<string, any>): void {
    this.dynamicFields = Object.keys(fields).map(key => ({
      key,
      label: this.formatLabel(key),
      type: typeof fields[key] === 'number' ? 'number' : 'text',
      icon: this.guessFieldIcon(key, key),
    }));
  }

  private addDynamicControls(fields: Record<string, any>): void {
    for (const key of Object.keys(fields)) {
      if (!this.detailsForm.contains(key)) {
        this.detailsForm.addControl(key, new FormControl(fields[key] ?? ''));
      }
    }
  }

  private guessFieldIcon(id: string, label: string): string {
    const lbl = (id + ' ' + label).toLowerCase();
    if (lbl.includes('name') || lbl.includes('applicant')) return 'person';
    if (lbl.includes('amount') || lbl.includes('loan') && lbl.includes('amount')) return 'payments';
    if (lbl.includes('type') || lbl.includes('category')) return 'category';
    if (lbl.includes('income') || lbl.includes('salary')) return 'account_balance';
    if (lbl.includes('email')) return 'email';
    if (lbl.includes('date')) return 'event';
    if (lbl.includes('purpose')) return 'description';
    return '';
  }

  getPrimaryFieldValue(caseData: Case): string {
    if (!caseData?.fields) return '';
    // Try common name-like keys first
    const nameKeys = ['applicantName', 'f-name', 'name', 'fullName', 'clientName'];
    for (const key of nameKeys) {
      if (caseData.fields[key]) return String(caseData.fields[key]);
    }
    // Fall back to first string field value
    for (const val of Object.values(caseData.fields)) {
      if (typeof val === 'string' && val.length > 0 && val.length < 100) return val;
    }
    return caseData.type;
  }

  private formatLabel(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
  }

  // ─── Dynamic Stages ─────────────────────────
  private loadStagesFromCaseType(caseTypeSlug: string): void {
    if (this.stages.length > 0) return;
    this.dataService.getCaseTypes().pipe(takeUntil(this.destroy$)).subscribe(caseTypes => {
      const ct = caseTypes.find(t => t.slug === caseTypeSlug);
      if (ct) {
        this.stages = ct.stages.map((name, i) => ({ name, order: i + 1 }));
      }
    });
  }

  // ─── Transitions ─────────────────────────────
  private loadAvailableTransitions(): void {
    if (!this.caseId) return;
    this.dataService.getAvailableTransitions(this.caseId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (transitions) => this.availableTransitions.set(transitions),
        error: () => this.availableTransitions.set([]),
      });
  }

  openTransitionDialog(): void {
    this.dialog.open(this.transitionDialogTpl, { width: '480px', autoFocus: false });
  }

  openAssigneeDialog(): void {
    this.dialog.open(this.assigneeDialogTpl, { width: '480px', autoFocus: false });
  }

  performTransition(action: string, caseId: string): void {
    this.store.dispatch(CasesActions.transitionCase({
      caseId,
      action,
      notes: this.transitionNotes || undefined,
    }));
    this.snackBar.open(`Transitioning: ${action}...`, 'OK', { duration: 3000 });
    this.transitionNotes = '';
    this.dialog.closeAll();
  }

  // ─── Edit / Save ─────────────────────────────
  toggleEdit(): void {
    if (this.editing()) {
      this.cancelEdit();
    } else {
      this.editing.set(true);
    }
  }

  cancelEdit(): void {
    this.editing.set(false);
    if (this.currentCase) {
      this.updateForm(this.currentCase);
    }
  }

  saveChanges(): void {
    if (!this.caseId || !this.currentCase) return;
    const formVal = this.detailsForm.value;

    // Separate system fields from case fields
    const { status, priority, notes, ...fieldValues } = formVal;
    const updates: Partial<Case> = {};
    if (status !== this.currentCase.status) updates.status = status;
    if (priority !== this.currentCase.priority) updates.priority = priority;
    if (notes !== (this.currentCase.notes || '')) updates.notes = notes;

    // Check if any case fields changed
    const changedFields: Record<string, any> = {};
    for (const [key, val] of Object.entries(fieldValues)) {
      if (this.currentCase.fields[key] !== val) {
        changedFields[key] = val;
      }
    }
    if (Object.keys(changedFields).length > 0) {
      updates.fields = { ...this.currentCase.fields, ...changedFields };
    }

    if (Object.keys(updates).length === 0) {
      this.snackBar.open('No changes to save', 'OK', { duration: 2000 });
      return;
    }

    this.store.dispatch(CasesActions.updateCase({ caseId: this.caseId, updates }));
    this.snackBar.open('Saving changes...', 'OK', { duration: 2000 });
    this.editing.set(false);
  }

  // ─── Quick Actions ───────────────────────────
  closeCase(): void {
    if (!this.caseId) return;
    this.store.dispatch(CasesActions.updateCase({
      caseId: this.caseId,
      updates: { status: 'withdrawn' as any },
    }));
    this.snackBar.open('Closing case...', 'OK', { duration: 2000 });
  }

  changeAssignee(userId: string, caseId: string): void {
    this.store.dispatch(CasesActions.updateCase({
      caseId,
      updates: { ownerId: userId } as any,
    }));
    const user = this.allUsers.find(u => u.id === userId);
    this.snackBar.open(`Reassigning to ${user?.name || userId}...`, 'OK', { duration: 2000 });
    this.dialog.closeAll();
  }

  scrollToComments(): void {
    const tabs = document.querySelector('mat-tab-group');
    if (tabs) {
      tabs.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // ─── Tasks ───────────────────────────────────
  submitCreateTask(): void {
    if (this.createTaskForm.invalid || !this.caseId) return;
    const val = this.createTaskForm.value;
    this.store.dispatch(TasksActions.createTask({
      task: {
        caseId: this.caseId,
        title: val.title,
        description: val.description || '',
        priority: val.priority || 'medium',
        dueDate: val.dueDate || undefined,
        assigneeId: val.assigneeId || undefined,
      },
    }));
    this.snackBar.open('Creating task...', 'OK', { duration: 2000 });
    this.createTaskForm.reset({ priority: 'medium' });
    this.showCreateTask.set(false);
    setTimeout(() => this.loadTasks(this.caseId!), 1000);
  }

  startEditTask(task: Task): void {
    this.editingTask.set(task);
    this.editTaskForm.patchValue({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.substring(0, 10) : '',
      assigneeId: task.assigneeId || '',
    });
  }

  cancelTaskEdit(): void {
    this.editingTask.set(null);
    this.editTaskForm.reset();
  }

  saveTaskEdit(taskId: string): void {
    if (this.editTaskForm.invalid) return;
    const val = this.editTaskForm.value;
    const updates: Partial<Task> = {};
    const orig = this.editingTask();
    if (!orig) return;

    if (val.title !== orig.title) updates.title = val.title;
    if (val.description !== orig.description) updates.description = val.description;
    if (val.status !== orig.status) updates.status = val.status;
    if (val.priority !== orig.priority) updates.priority = val.priority;
    const origDate = orig.dueDate ? orig.dueDate.substring(0, 10) : '';
    if (val.dueDate !== origDate) updates.dueDate = val.dueDate || undefined;
    if ((val.assigneeId || '') !== (orig.assigneeId || '')) updates.assigneeId = val.assigneeId || undefined;

    if (Object.keys(updates).length === 0) {
      this.snackBar.open('No changes to save', 'OK', { duration: 2000 });
      this.editingTask.set(null);
      return;
    }

    this.store.dispatch(TasksActions.updateTask({ taskId, updates }));
    this.snackBar.open('Saving task...', 'OK', { duration: 2000 });
    this.editingTask.set(null);
    if (this.caseId) {
      setTimeout(() => this.loadTasks(this.caseId!), 1000);
    }
  }

  private loadTasks(caseId: string): void {
    this.dataService.getTasks({ caseId }).pipe(takeUntil(this.destroy$)).subscribe(tasks => {
      this.tasks = tasks;
    });
  }

  // ─── Form Population ────────────────────────
  updateForm(case_: Case): void {
    const patch: Record<string, any> = {
      status: case_.status,
      priority: case_.priority,
      notes: case_.notes || '',
    };
    // Populate dynamic field values
    if (case_.fields) {
      for (const [key, val] of Object.entries(case_.fields)) {
        patch[key] = val;
      }
    }
    this.detailsForm.patchValue(patch);
  }

  // ─── Stage Journey Helpers ───────────────────
  isStageCompleted(stageHistory: any[], stageName: string): boolean {
    return stageHistory.some(s => s.name === stageName && s.status === 'completed');
  }

  isStageActive(currentStage: string, stageName: string): boolean {
    return currentStage === stageName;
  }

  getProgressPercentage(stageHistory: any[]): number {
    if (this.stages.length === 0) return 0;
    const completedCount = stageHistory.filter(s => s.status === 'completed').length;
    return (completedCount / this.stages.length) * 100;
  }

  stageCircleClass(stageHistory: any[], stageName: string): string {
    if (this.isStageCompleted(stageHistory, stageName)) {
      return 'bg-emerald-500 text-white shadow-sm shadow-emerald-200';
    }
    const currentStage = this.currentCase?.stage;
    if (currentStage && this.isStageActive(currentStage, stageName)) {
      return 'bg-[#056DAE] text-white shadow-sm shadow-[#a1d1ef]';
    }
    return 'bg-slate-100 text-slate-400';
  }

  statusIcon(status: string): string {
    const icons: Record<string, string> = {
      open: 'folder_open',
      in_progress: 'play_circle',
      pending: 'hourglass_empty',
      resolved: 'check_circle',
      withdrawn: 'cancel',
    };
    return icons[status] || 'help';
  }

  statusColor(status: string): string {
    return {
      open: 'text-[#056DAE]',
      in_progress: 'text-purple-600',
      pending: 'text-amber-600',
      resolved: 'text-emerald-600',
      withdrawn: 'text-red-600',
    }[status] || 'text-slate-600';
  }

  statusBg(status: string): string {
    return {
      open: 'bg-[#EAF4FB]',
      in_progress: 'bg-purple-50',
      pending: 'bg-amber-50',
      resolved: 'bg-emerald-50',
      withdrawn: 'bg-red-50',
    }[status] || 'bg-slate-50';
  }

  statusBadge(status: string): string {
    return {
      open: 'wf-badge--info',
      in_progress: 'wf-badge--purple',
      pending: 'wf-badge--warning',
      resolved: 'wf-badge--success',
      withdrawn: 'wf-badge--danger',
    }[status] || 'wf-badge--neutral';
  }

  statusDot(status: string): string {
    return {
      open: 'bg-[#056DAE]',
      in_progress: 'bg-purple-500',
      pending: 'bg-amber-500',
      resolved: 'bg-emerald-500',
      withdrawn: 'bg-red-500',
    }[status] || 'bg-slate-500';
  }

  stageColor(stage: string): string {
    const colors: Record<string, string> = {
      intake: 'text-[#056DAE]',
      documents: 'text-purple-600',
      underwriting: 'text-amber-600',
      approval: 'text-orange-600',
      disbursement: 'text-emerald-600',
    };
    return colors[stage] || 'text-slate-600';
  }

  stageBadgeClass(stage: string): string {
    const classes: Record<string, string> = {
      intake: 'wf-badge--info',
      documents: 'wf-badge--purple',
      underwriting: 'wf-badge--warning',
      approval: 'wf-badge--danger',
      disbursement: 'wf-badge--success',
    };
    return classes[stage] || 'wf-badge--neutral';
  }

  taskStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: 'schedule',
      in_progress: 'play_circle',
      review: 'visibility',
      completed: 'check_circle',
      blocked: 'block',
    };
    return icons[status] || 'circle';
  }

  taskStatusColor(status: string): string {
    return {
      pending: 'text-slate-500',
      in_progress: 'text-[#056DAE]',
      review: 'text-orange-600',
      completed: 'text-emerald-600',
      blocked: 'text-red-600',
    }[status] || 'text-slate-500';
  }

  taskStatusBg(status: string): string {
    return {
      pending: 'bg-slate-100',
      in_progress: 'bg-[#EAF4FB]',
      review: 'bg-orange-50',
      completed: 'bg-emerald-50',
      blocked: 'bg-red-50',
    }[status] || 'bg-slate-100';
  }

  priorityBadgeClass(priority: string): string {
    return {
      critical: 'wf-badge--danger',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-amber-100 text-amber-800',
      low: 'wf-badge--success',
    }[priority] || 'wf-badge--neutral';
  }

  auditLogBorder(action: string): string {
    return {
      create: 'border-[#056DAE]',
      update: 'border-amber-400',
      transition: 'border-purple-400',
      comment: 'border-emerald-400',
    }[action] || 'border-slate-400';
  }

  auditDotColor(action: string): string {
    return {
      create: 'bg-[#056DAE] ring-[#d0e8f7]',
      update: 'bg-amber-400 ring-amber-100',
      transition: 'bg-purple-400 ring-purple-100',
      comment: 'bg-emerald-400 ring-emerald-100',
    }[action] || 'bg-slate-400 ring-slate-100';
  }

  slaColor(daysRemaining: number): string {
    if (daysRemaining < 1) return 'text-red-600';
    if (daysRemaining < 3) return 'text-amber-600';
    return 'text-emerald-600';
  }

  getUserName(userId: string): string {
    const user = this.allUsers.find(u => u.id === userId);
    return user?.name || userId;
  }

  // ─── Documents ───────────────────────────────
  private loadDocuments(caseId: string): void {
    this.dataService.getDocuments(caseId).pipe(takeUntil(this.destroy$)).subscribe(docs => {
      this.documents = docs;
    });
  }

  onDocumentDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.docDragOver.set(true);
  }

  onDocumentDrop(event: DragEvent, caseId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.docDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.uploadDocuments(Array.from(files), caseId);
    }
  }

  onDocumentSelected(event: Event, caseId: string): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadDocuments(Array.from(input.files), caseId);
    }
  }

  uploadDocuments(files: File[], caseId: string): void {
    files.forEach(file => {
      this.dataService.uploadDocument(caseId, file).pipe(takeUntil(this.destroy$)).subscribe({
        next: (doc) => {
          this.documents.push(doc);
          this.snackBar.open(`Document "${file.name}" uploaded`, 'OK', { duration: 2000 });
        },
        error: () => {
          this.snackBar.open(`Failed to upload "${file.name}"`, 'OK', { duration: 2000 });
        },
      });
    });
  }

  getDocumentIcon(contentType: string): string {
    const icons: Record<string, string> = {
      'application/pdf': 'picture_as_pdf',
      'application/msword': 'description',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'description',
      'application/vnd.ms-excel': 'table_chart',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'table_chart',
      'text/plain': 'text_snippet',
      'image/jpeg': 'image',
      'image/png': 'image',
    };
    return icons[contentType] || 'description';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  downloadDocument(doc: WfDocument): void {
    this.dataService.downloadDocument(doc.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.filename;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.snackBar.open('Failed to download document', 'OK', { duration: 2000 });
      },
    });
  }

  deleteDocument(doc: WfDocument): void {
    if (confirm(`Delete document "${doc.filename}"?`)) {
      this.dataService.deleteDocument(doc.id).pipe(takeUntil(this.destroy$)).subscribe({
        next: () => {
          this.documents = this.documents.filter(d => d.id !== doc.id);
          this.snackBar.open('Document deleted', 'OK', { duration: 2000 });
        },
        error: () => {
          this.snackBar.open('Failed to delete document', 'OK', { duration: 2000 });
        },
      });
    }
  }
}
