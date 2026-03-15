import { Component, OnInit, OnDestroy, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import {
  CdkDragDrop,
  copyArrayItem,
  moveItemInArray,
  DragDropModule,
} from '@angular/cdk/drag-drop';
import { Store } from '@ngrx/store';
import { selectKanbanBoard } from '../../state/tasks/tasks.selectors';
import * as TasksActions from '../../state/tasks/tasks.actions';
import { Task, KanbanBoard, User } from '../../core/models';
import { WebSocketService } from '../../core/services/websocket.service';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'app-task-kanban',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatBadgeModule,
    MatSnackBarModule,
    DragDropModule,
  ],
  template: `
    <div class="kanban-container p-6 bg-gradient-to-br from-[#EAF4FB] to-[#F5F7FA] min-h-screen">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-4xl font-bold text-gray-800">Task Kanban Board</h1>
        <p class="text-gray-600 mt-2">Drag tasks to update status. Double-click to edit.</p>
      </div>

      <!-- Filters -->
      <div class="bg-white rounded-lg shadow-sm p-4 mb-6 flex gap-4">
        <mat-form-field>
          <mat-label>View</mat-label>
          <mat-select [(ngModel)]="viewFilter">
            <mat-option value="all">All Tasks</mat-option>
            <mat-option value="my">My Tasks</mat-option>
            <mat-option value="team">Team Tasks</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field>
          <mat-label>Filter by Priority</mat-label>
          <mat-select [(ngModel)]="priorityFilter">
            <mat-option value="">All Priorities</mat-option>
            <mat-option value="critical">Critical</mat-option>
            <mat-option value="high">High</mat-option>
            <mat-option value="medium">Medium</mat-option>
            <mat-option value="low">Low</mat-option>
          </mat-select>
        </mat-form-field>

        <button mat-stroked-button (click)="resetFilters()">
          <mat-icon>clear</mat-icon>
          Clear Filters
        </button>
      </div>

      <!-- Kanban Board -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        @for (column of kanbanColumns; track column.status) {
          <div class="bg-white rounded-lg shadow-sm overflow-hidden">
            <!-- Column Header -->
            <div
              class="p-4 font-semibold text-white flex items-center justify-between"
              [ngClass]="columnHeaderClass(column.status)"
            >
              <div class="flex items-center gap-2">
                <mat-icon class="text-lg">{{ columnIcon(column.status) }}</mat-icon>
                <span>{{ column.label }}</span>
              </div>
              <span
                [matBadge]="getTasksForColumn(column.status).length"
                matBadgeColor="accent"
                class="text-white"
              ></span>
            </div>

            <!-- Drop Zone -->
            <div
              cdkDropList
              #dropZone="cdkDropList"
              [id]="column.status"
              [cdkDropListData]="getTasksForColumn(column.status)"
              [cdkDropListSortingDisabled]="false"
              cdkDropListConnectedTo="[#pendingDropZone, #inProgressDropZone, #reviewDropZone, #doneDropZone, #blockedDropZone]"
              class="p-4 min-h-96 space-y-2"
              (cdkDropListDropped)="onDrop($event, column.status)"
            >
              @for (task of getTasksForColumn(column.status); track task.id) {
                <div
                  cdkDrag
                  [cdkDragData]="task"
                  class="bg-white border-l-4 rounded p-3 cursor-move hover:shadow-md transition-shadow"
                  [ngClass]="taskBorderClass(task.priority)"
                  (dblclick)="editTask(task)"
                >
                  <!-- Task Card -->
                  <div class="space-y-2">
                    <!-- Title -->
                    <h4 class="font-semibold text-sm text-gray-800 line-clamp-2">{{ task.title }}</h4>

                    <!-- Description -->
                    <p class="text-xs text-gray-600 line-clamp-2">{{ task.description }}</p>

                    <!-- Meta Info -->
                    <div class="flex items-center justify-between gap-2">
                      <!-- Assignee Avatar -->
                      <div class="flex items-center gap-2">
                        @if (task.assigneeId) {
                          <div
                            class="w-6 h-6 rounded-full bg-[#056DAE] text-white flex items-center justify-center text-xs font-bold"
                            [title]="task.assigneeId"
                          >
                            {{ task.assigneeId.charAt(0) }}
                          </div>
                        }
                        <span class="text-xs text-gray-600">{{ task.caseId }}</span>
                      </div>

                      <!-- Priority Badge -->
                      <span
                        class="text-xs px-2 py-1 rounded-full font-semibold"
                        [ngClass]="priorityBadgeClass(task.priority)"
                      >
                        {{ task.priority.charAt(0).toUpperCase() }}
                      </span>
                    </div>

                    <!-- Due Date -->
                    <div class="flex items-center gap-1 text-xs" [ngClass]="dueDateClass(task.dueDate)">
                      <mat-icon class="text-xs">schedule</mat-icon>
                      <span>{{ task.dueDate | date: 'MMM d' }}</span>
                    </div>

                    <!-- Checklist Progress -->
                    @if (task.checklist && task.checklist.length > 0) {
                      <div class="text-xs">
                        <div class="bg-gray-200 rounded-full h-1 overflow-hidden">
                          <div
                            class="bg-green-500 h-full"
                            [style.width.%]="getChecklistProgress(task)"
                          ></div>
                        </div>
                        <span class="text-gray-600">
                          {{ getChecklistCompletedCount(task) }}/{{ task.checklist.length }}
                        </span>
                      </div>
                    }

                    <!-- Hover Actions -->
                    <div cdkDragPlaceholder class="bg-gray-100 border-2 border-dashed border-gray-300 rounded p-3"></div>
                  </div>
                </div>
              }

              <!-- Empty State -->
              @if (getTasksForColumn(column.status).length === 0) {
                <div class="text-center py-8">
                  <mat-icon class="text-gray-300 text-4xl">drag_indicator</mat-icon>
                  <p class="text-gray-400 text-sm mt-2">No tasks</p>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Task Edit Modal -->
      @if (selectedTask) {
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" (click)="closeModal()">
          <mat-card class="w-full max-w-lg" (click)="$event.stopPropagation()">
            <mat-card-header>
              <mat-card-title class="flex items-center gap-2">
                <mat-icon class="text-[#056DAE]">edit</mat-icon>
                @if (editingKanbanTask()) {
                  Edit Task
                } @else {
                  Task Details
                }
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              @if (editingKanbanTask()) {
                <form [formGroup]="editTaskForm" (ngSubmit)="saveKanbanTaskEdit()" class="space-y-4 mt-4">
                  <mat-form-field class="w-full">
                    <mat-label>Title</mat-label>
                    <input matInput formControlName="title">
                  </mat-form-field>
                  <mat-form-field class="w-full">
                    <mat-label>Description</mat-label>
                    <textarea matInput formControlName="description" rows="3"></textarea>
                  </mat-form-field>
                  <div class="grid grid-cols-2 gap-4">
                    <mat-form-field>
                      <mat-label>Status</mat-label>
                      <mat-select formControlName="status">
                        <mat-option value="pending">Pending</mat-option>
                        <mat-option value="in_progress">In Progress</mat-option>
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
                  <mat-form-field class="w-full">
                    <mat-label>Due Date</mat-label>
                    <input matInput type="date" formControlName="dueDate">
                  </mat-form-field>
                  <mat-form-field class="w-full">
                    <mat-label>Assign To</mat-label>
                    <mat-select formControlName="assigneeId">
                      <mat-option value="">Unassigned</mat-option>
                      @for (u of allUsers; track u.id) {
                        <mat-option [value]="u.id">{{ u.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </form>
              } @else {
                <div class="space-y-4 mt-4">
                  <p class="text-gray-700">{{ selectedTask.description }}</p>
                  <div class="grid grid-cols-2 gap-4">
                    <div>
                      <p class="text-xs font-semibold text-gray-500 uppercase">Status</p>
                      <p class="text-sm font-medium mt-1">{{ selectedTask.status | uppercase }}</p>
                    </div>
                    <div>
                      <p class="text-xs font-semibold text-gray-500 uppercase">Priority</p>
                      <span class="text-xs px-2 py-1 rounded-full font-semibold mt-1 inline-block"
                            [ngClass]="priorityBadgeClass(selectedTask.priority)">
                        {{ selectedTask.priority | uppercase }}
                      </span>
                    </div>
                  </div>
                  <div class="grid grid-cols-2 gap-4">
                    @if (selectedTask.dueDate) {
                      <div>
                        <p class="text-xs font-semibold text-gray-500 uppercase">Due Date</p>
                        <p class="text-sm mt-1">{{ selectedTask.dueDate | date: 'mediumDate' }}</p>
                      </div>
                    }
                    <div>
                      <p class="text-xs font-semibold text-gray-500 uppercase">Assigned To</p>
                      <p class="text-sm mt-1">{{ getUserName(selectedTask.assigneeId) }}</p>
                    </div>
                  </div>
                </div>
              }
            </mat-card-content>
            <mat-card-actions class="flex justify-end gap-2 px-4 pb-4">
              @if (editingKanbanTask()) {
                <button mat-stroked-button (click)="editingKanbanTask.set(false)">Cancel</button>
                <button mat-raised-button color="primary" (click)="saveKanbanTaskEdit()" [disabled]="editTaskForm.invalid">
                  <mat-icon>save</mat-icon> Save
                </button>
              } @else {
                <button mat-button (click)="closeModal()">Close</button>
                <button mat-raised-button color="primary" (click)="startKanbanTaskEdit()">
                  <mat-icon>edit</mat-icon> Edit
                </button>
              }
            </mat-card-actions>
          </mat-card>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .kanban-container {
      max-width: 1600px;
      margin: 0 auto;
    }

    .line-clamp-2 {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-preview) {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .cdk-drag-placeholder {
      opacity: 0.4;
    }

    .cdk-drag-preview {
      box-shadow: 0 5px 5px -3px rgba(0, 0, 0, 0.2), 0 8px 10px 1px rgba(0, 0, 0, 0.14),
        0 3px 14px 2px rgba(0, 0, 0, 0.12);
      border-radius: 8px;
    }

    mat-icon.text-xs {
      width: 16px;
      height: 16px;
      font-size: 16px;
      line-height: 16px;
    }
  `],
})
export class TaskKanbanComponent implements OnInit {
  kanbanColumns = [
    { status: 'pending', label: 'Pending' },
    { status: 'in_progress', label: 'In Progress' },
    { status: 'review', label: 'Review' },
    { status: 'done', label: 'Done' },
    { status: 'blocked', label: 'Blocked' },
  ];

  kanbanBoard: KanbanBoard = {
    pending: [],
    inProgress: [],
    review: [],
    done: [],
    blocked: [],
  };

  viewFilter = 'all';
  priorityFilter = '';
  selectedTask: Task | null = null;
  editingKanbanTask = signal(false);
  editTaskForm: FormGroup;
  allUsers: User[] = [];

  constructor(private store: Store, private wsService: WebSocketService, private fb: FormBuilder, private snackBar: MatSnackBar, private dataService: DataService) {
    this.editTaskForm = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      status: [''],
      priority: ['medium'],
      dueDate: [''],
      assigneeId: [''],
    });
    // Listen for live task updates via WebSocket
    effect(() => {
      const msg = this.wsService.lastMessage();
      if (msg?.type === 'task_updated') {
        this.store.dispatch(TasksActions.loadKanbanBoard({}));
      }
    });
  }

  ngOnInit(): void {
    this.store.dispatch(TasksActions.loadKanbanBoard({}));

    this.store.select(selectKanbanBoard).subscribe(board => {
      if (board) {
        this.kanbanBoard = board;
      }
    });

    this.dataService.getUsers().subscribe(users => {
      this.allUsers = users;
    });
  }

  getTasksForColumn(status: string): Task[] {
    const tasks = this.kanbanBoard[status as keyof KanbanBoard] || [];

    let filtered = tasks;

    if (this.viewFilter === 'my') {
      filtered = filtered.filter(t => t.assigneeId === 'user-1');
    }

    if (this.priorityFilter) {
      filtered = filtered.filter(t => t.priority === this.priorityFilter);
    }

    return filtered;
  }

  onDrop(event: CdkDragDrop<Task[]>, newStatus: string): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Move item from previous container
      const item = event.previousContainer.data[event.previousIndex];
      event.previousContainer.data.splice(event.previousIndex, 1);
      event.container.data.splice(event.currentIndex, 0, item);

      // Update the task status in the store
      const task = event.container.data[event.currentIndex];
      this.store.dispatch(
        TasksActions.updateTaskStatus({
          taskId: task.id,
          status: newStatus,
        })
      );

      // Broadcast task update via WebSocket
      this.wsService.send({
        type: 'task_updated',
        data: { taskId: task.id, status: newStatus },
      });
    }
  }

  editTask(task: Task): void {
    this.selectedTask = task;
    this.editingKanbanTask.set(false);
  }

  closeModal(): void {
    this.selectedTask = null;
    this.editingKanbanTask.set(false);
  }

  startKanbanTaskEdit(): void {
    if (!this.selectedTask) return;
    this.editTaskForm.patchValue({
      title: this.selectedTask.title,
      description: this.selectedTask.description,
      status: this.selectedTask.status,
      priority: this.selectedTask.priority,
      dueDate: this.selectedTask.dueDate ? this.selectedTask.dueDate.substring(0, 10) : '',
      assigneeId: this.selectedTask.assigneeId || '',
    });
    this.editingKanbanTask.set(true);
  }

  saveKanbanTaskEdit(): void {
    if (!this.selectedTask || this.editTaskForm.invalid) return;
    const val = this.editTaskForm.value;
    const orig = this.selectedTask;
    const updates: Partial<Task> = {};

    if (val.title !== orig.title) updates.title = val.title;
    if (val.description !== orig.description) updates.description = val.description;
    if (val.status !== orig.status) updates.status = val.status;
    if (val.priority !== orig.priority) updates.priority = val.priority;
    const origDate = orig.dueDate ? orig.dueDate.substring(0, 10) : '';
    if (val.dueDate !== origDate) updates.dueDate = val.dueDate || undefined;
    if ((val.assigneeId || '') !== (orig.assigneeId || '')) updates.assigneeId = val.assigneeId || undefined;

    if (Object.keys(updates).length === 0) {
      this.snackBar.open('No changes to save', 'OK', { duration: 2000 });
      this.closeModal();
      return;
    }

    this.store.dispatch(TasksActions.updateTask({ taskId: orig.id, updates }));
    this.snackBar.open('Saving task...', 'OK', { duration: 2000 });
    this.closeModal();
    // Reload kanban board after save
    setTimeout(() => this.store.dispatch(TasksActions.loadKanbanBoard({})), 1000);
  }

  resetFilters(): void {
    this.viewFilter = 'all';
    this.priorityFilter = '';
  }

  columnHeaderClass(status: string): string {
    const classes: Record<string, string> = {
      pending: 'bg-gray-500',
      in_progress: 'bg-[#056DAE]',
      review: 'bg-orange-500',
      done: 'bg-green-500',
      blocked: 'bg-red-500',
    };
    return classes[status] || 'bg-gray-500';
  }

  columnIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: 'schedule',
      in_progress: 'play_circle_filled',
      review: 'visibility',
      done: 'check_circle',
      blocked: 'block',
    };
    return icons[status] || 'circle';
  }

  taskBorderClass(priority: string): string {
    return {
      critical: 'border-red-500',
      high: 'border-orange-500',
      medium: 'border-yellow-500',
      low: 'border-green-500',
    }[priority] || 'border-gray-300';
  }

  priorityBadgeClass(priority: string): string {
    return {
      critical: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-green-100 text-green-800',
    }[priority] || 'bg-gray-100 text-gray-800';
  }

  dueDateClass(dueDate: string | undefined): string {
    if (!dueDate) return 'text-gray-600';
    const today = new Date();
    const taskDate = new Date(dueDate);

    if (taskDate < today) {
      return 'text-red-600';
    }
    if (taskDate.getTime() - today.getTime() < 86400000 * 3) {
      return 'text-orange-600';
    }
    return 'text-gray-600';
  }

  getChecklistProgress(task: Task): number {
    if (!task.checklist || task.checklist.length === 0) return 0;
    const completed = task.checklist.filter(item => item.checked).length;
    return (completed / task.checklist.length) * 100;
  }

  getChecklistCompletedCount(task: Task): number {
    if (!task.checklist) return 0;
    return task.checklist.filter(item => item.checked).length;
  }

  getUserName(userId: string | undefined): string {
    if (!userId) return 'Unassigned';
    const user = this.allUsers.find(u => u.id === userId);
    return user?.name || userId;
  }
}
