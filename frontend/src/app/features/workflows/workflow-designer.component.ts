import { Component, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule} from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  WorkflowValidationResult,
  FormDefinition,
} from '../../core/models';
import { DataService } from '../../core/services/data.service';
import * as WorkflowsActions from '../../state/workflows/workflows.actions';
import {
  selectWorkflowsList,
  selectWorkflowsLoading,
  selectSelectedWorkflow,
  selectWorkflowValidation,
} from '../../state/workflows/workflows.selectors';

@Component({
  selector: 'app-workflow-designer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    MatMenuModule,
  ],
  template: `
    <div class="flex h-full">
      <!-- Sidebar: Workflow list + node palette -->
      <aside class="w-64 bg-white border-r flex flex-col">
        <div class="p-4 border-b">
          <h3 class="text-lg font-semibold mb-3">Flows</h3>
          <button mat-raised-button color="primary" class="w-full" (click)="newWorkflow()">
            <mat-icon>add</mat-icon> New Flow
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          @for (wf of workflows$ | async; track wf.id) {
            <div class="p-3 mb-2 rounded cursor-pointer transition-colors"
                 [class.bg-[#EAF4FB]]="selectedWorkflowId() === wf.id"
                 [class.border-l-4]="selectedWorkflowId() === wf.id"
                 [class.border-[#056DAE]]="selectedWorkflowId() === wf.id"
                 [class.hover:bg-gray-50]="selectedWorkflowId() !== wf.id"
                 (click)="selectWorkflow(wf)">
              <div class="font-medium text-sm">{{ wf.name }}</div>
              <div class="text-xs text-gray-500">v{{ wf.version }} · {{ wf.isActive ? 'Active' : 'Draft' }}</div>
            </div>
          }
        </div>

        <!-- Node Palette -->
        <div class="p-4 border-t">
          <h4 class="text-sm font-semibold mb-2 text-gray-600">NODE PALETTE</h4>
          @for (nodeType of nodeTypes; track nodeType.type) {
            <div class="flex items-center gap-2 p-2 mb-1 rounded cursor-grab bg-gray-50 hover:bg-gray-100 text-sm"
                 (click)="addNode(nodeType.type)">
              <span class="text-lg">{{ nodeType.icon }}</span>
              <span>{{ nodeType.label }}</span>
            </div>
          }
        </div>
      </aside>

      <!-- Main Canvas Area -->
      <main class="flex-1 flex flex-col bg-gray-50">
        <!-- Toolbar -->
        <mat-toolbar class="!bg-white border-b !h-12 !min-h-[48px]">
          @if (editingWorkflow()) {
            <mat-form-field class="mr-4 !mt-4">
              <input matInput [(ngModel)]="workflowName" placeholder="Flow name" class="!text-sm">
            </mat-form-field>
            <button mat-icon-button matTooltip="Undo" (click)="undo()" [disabled]="!canUndo()">
              <mat-icon>undo</mat-icon>
            </button>
            <button mat-icon-button matTooltip="Redo" (click)="redo()" [disabled]="!canRedo()">
              <mat-icon>redo</mat-icon>
            </button>
            <button mat-icon-button matTooltip="Save" (click)="saveWorkflow()">
              <mat-icon>save</mat-icon>
            </button>
            <button mat-icon-button matTooltip="Validate" (click)="validateWorkflow()">
              <mat-icon>check_circle</mat-icon>
            </button>
            <button mat-icon-button matTooltip="Delete" color="warn" (click)="deleteWorkflow()">
              <mat-icon>delete</mat-icon>
            </button>
            <span class="flex-1"></span>
            @if (autoSaveStatus()) {
              <span class="text-xs text-gray-400 mr-3">{{ autoSaveStatus() }}</span>
            }
            @if (validationResult()) {
              <mat-chip-set>
                @if (validationResult()!.valid) {
                  <mat-chip class="!bg-green-100 !text-green-800">✓ Valid</mat-chip>
                } @else {
                  <mat-chip class="!bg-red-100 !text-red-800">
                    {{ validationResult()!.errors.length }} error(s)
                  </mat-chip>
                }
              </mat-chip-set>
            }
          } @else {
            <span class="text-gray-400">Select or create a flow to begin</span>
          }
        </mat-toolbar>

        <!-- Canvas -->
        <div class="flex-1 overflow-auto p-6 relative" #canvas
             (click)="deselectNode()">

          @if (!editingWorkflow()) {
            <div class="flex items-center justify-center h-full text-gray-400">
              <div class="text-center">
                <mat-icon class="!text-6xl !w-16 !h-16 mb-4">account_tree</mat-icon>
                <p class="text-lg">Visual Flow Designer</p>
                <p class="text-sm">Create or select a flow from the sidebar</p>
              </div>
            </div>
          } @else {
            <!-- SVG Layer for edges -->
            <svg class="absolute inset-0 pointer-events-none" style="width: 100%; height: 100%;">
              @for (edge of canvasEdges(); track edge.id) {
                <line
                  [attr.x1]="getNodeCenter(edge.source).x"
                  [attr.y1]="getNodeCenter(edge.source).y"
                  [attr.x2]="getNodeCenter(edge.target).x"
                  [attr.y2]="getNodeCenter(edge.target).y"
                  stroke="#94a3b8"
                  stroke-width="2"
                  marker-end="url(#arrowhead)"
                />
                @if (edge.label) {
                  <text
                    [attr.x]="(getNodeCenter(edge.source).x + getNodeCenter(edge.target).x) / 2"
                    [attr.y]="(getNodeCenter(edge.source).y + getNodeCenter(edge.target).y) / 2 - 8"
                    text-anchor="middle"
                    class="text-xs fill-gray-500"
                  >{{ edge.label }}</text>
                }
              }
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
                </marker>
              </defs>
            </svg>

            <!-- Nodes -->
            @for (node of canvasNodes(); track node.id) {
              <div class="absolute cursor-move select-none"
                   [style.left.px]="node.position.x"
                   [style.top.px]="node.position.y"
                   (click)="selectNode(node, $event)"
                   (mousedown)="startDrag(node, $event)">
                <div class="rounded-lg shadow-md border-2 min-w-[140px] p-3 text-center transition-all"
                     [class.border-[#056DAE]]="selectedNodeId() === node.id"
                     [class.border-gray-200]="selectedNodeId() !== node.id"
                     [ngClass]="getNodeStyle(node.type)">
                  <div class="text-lg mb-1">{{ getNodeIcon(node.type) }}</div>
                  <div class="text-sm font-medium">{{ node.label }}</div>
                  <div class="text-xs text-gray-500 mt-1">{{ node.type }}</div>
                  @if (node.assigneeRole) {
                    <div class="text-xs text-[#056DAE] mt-1">{{ node.assigneeRole }}</div>
                  }
                  @if (node.formId) {
                    <div class="text-xs mt-1 flex items-center justify-center gap-0.5 text-emerald-600">
                      <mat-icon class="!text-xs !w-3 !h-3">dynamic_form</mat-icon>
                      {{ getFormName(node.formId) }}
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Connection mode indicator -->
            @if (connectingFrom()) {
              <div class="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#003B70] text-white px-4 py-2 rounded-full shadow-lg text-sm z-50">
                Click a target node to connect · Press Escape to cancel
              </div>
            }
          }
        </div>

        <!-- Node Properties Panel -->
        @if (selectedNodeId() && editingWorkflow()) {
          <div class="border-t bg-white p-4">
            <div class="flex items-center gap-4 mb-3">
              <h4 class="font-semibold text-sm">Node Properties</h4>
              <span class="flex-1"></span>
              <button mat-icon-button matTooltip="Connect to..." (click)="startConnection()">
                <mat-icon>trending_flat</mat-icon>
              </button>
              <button mat-icon-button matTooltip="Delete node" color="warn" (click)="deleteNode()">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </div>
            <div class="grid grid-cols-4 gap-4">
              <mat-form-field>
                <mat-label>Label</mat-label>
                <input matInput [value]="getSelectedNode()?.label || ''" (input)="updateNodeLabel($event)">
              </mat-form-field>
              <mat-form-field>
                <mat-label>Type</mat-label>
                <mat-select [value]="getSelectedNode()?.type" (selectionChange)="updateNodeType($event.value)">
                  @for (nt of nodeTypes; track nt.type) {
                    <mat-option [value]="nt.type">{{ nt.icon }} {{ nt.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field>
                <mat-label>Assignee Role</mat-label>
                <mat-select [value]="getSelectedNode()?.assigneeRole || ''" (selectionChange)="updateNodeRole($event.value)">
                  <mat-option value="">None</mat-option>
                  <mat-option value="ADMIN">Admin</mat-option>
                  <mat-option value="MANAGER">Manager</mat-option>
                  <mat-option value="WORKER">Worker</mat-option>
                </mat-select>
              </mat-form-field>
              @if (isFormLinkableNode()) {
                <mat-form-field>
                  <mat-label>Linked Form</mat-label>
                  <mat-select [value]="getSelectedNode()?.formId || ''" (selectionChange)="updateNodeFormId($event.value)">
                    <mat-option value="">None</mat-option>
                    @for (form of availableForms(); track form.id) {
                      <mat-option [value]="form.id">
                        {{ form.name }}
                        @if (form.stage) {
                          <span class="text-xs text-gray-400 ml-1">({{ form.stage }})</span>
                        }
                      </mat-option>
                    }
                  </mat-select>
                  <mat-hint>Select a form to present at this flow step</mat-hint>
                </mat-form-field>
              }
            </div>

            <!-- Validation errors -->
            @if (validationResult() && !validationResult()!.valid) {
              <div class="mt-3">
                @for (err of validationResult()!.errors; track err.message) {
                  <div class="text-red-600 text-xs flex items-center gap-1 mb-1">
                    <mat-icon class="!text-xs !w-4 !h-4">error</mat-icon>
                    {{ err.message }}
                  </div>
                }
              </div>
            }
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; height: calc(100vh - 64px); }
  `],
})
export class WorkflowDesignerComponent implements OnInit, OnDestroy {
  workflows$ = this.store.select(selectWorkflowsList);

  selectedWorkflowId = signal<string | null>(null);
  editingWorkflow = signal<Workflow | null>(null);
  canvasNodes = signal<WorkflowNode[]>([]);
  canvasEdges = signal<WorkflowEdge[]>([]);
  selectedNodeId = signal<string | null>(null);
  connectingFrom = signal<string | null>(null);
  validationResult = signal<WorkflowValidationResult | null>(null);
  autoSaveStatus = signal<string>('');
  availableForms = signal<FormDefinition[]>([]);
  workflowName = '';

  private dragTarget: WorkflowNode | null = null;
  private dragOffset = { x: 0, y: 0 };

  // Undo/Redo
  private undoStack: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }[] = [];
  private redoStack: { nodes: WorkflowNode[]; edges: WorkflowEdge[] }[] = [];
  canUndo = signal(false);
  canRedo = signal(false);

  // Auto-save
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  nodeTypes = [
    { type: 'start' as NodeType, label: 'Start', icon: '▶' },
    { type: 'end' as NodeType, label: 'End', icon: '⏹' },
    { type: 'task' as NodeType, label: 'Task', icon: '📋' },
    { type: 'decision' as NodeType, label: 'Decision', icon: '◆' },
    { type: 'parallel' as NodeType, label: 'Parallel', icon: '⫘' },
    { type: 'subprocess' as NodeType, label: 'Subprocess', icon: '📦' },
  ];

  constructor(
    private store: Store,
    private snackBar: MatSnackBar,
    private dataService: DataService,
  ) {}

  ngOnInit(): void {
    this.store.dispatch(WorkflowsActions.loadWorkflows());

    this.store.select(selectWorkflowValidation).subscribe(result => {
      if (result) this.validationResult.set(result);
    });

    // Load all form definitions for linking
    this.dataService.getFormDefinitions().subscribe(forms => {
      this.availableForms.set(forms);
    });
  }

  selectWorkflow(wf: Workflow): void {
    this.selectedWorkflowId.set(wf.id);
    this.editingWorkflow.set(wf);
    this.canvasNodes.set([...wf.definition.nodes]);
    this.canvasEdges.set([...wf.definition.edges]);
    this.workflowName = wf.name;
    this.validationResult.set(null);
    this.selectedNodeId.set(null);
  }

  newWorkflow(): void {
    const startNode: WorkflowNode = {
      id: `n-${Date.now()}-1`,
      type: 'start',
      label: 'Start',
      position: { x: 100, y: 200 },
    };
    const endNode: WorkflowNode = {
      id: `n-${Date.now()}-2`,
      type: 'end',
      label: 'End',
      position: { x: 500, y: 200 },
    };

    this.editingWorkflow.set({
      id: '',
      name: 'New Flow',
      description: '',
      caseTypeId: '',
      definition: { nodes: [startNode, endNode], edges: [] },
      version: 1,
      isActive: false,
      createdBy: '',
      createdAt: new Date().toISOString(),
    });
    this.canvasNodes.set([startNode, endNode]);
    this.canvasEdges.set([]);
    this.workflowName = 'New Flow';
    this.selectedWorkflowId.set(null);
    this.validationResult.set(null);
  }

  addNode(type: NodeType): void {
    if (!this.editingWorkflow()) return;
    this.pushUndoState();
    const node: WorkflowNode = {
      id: `n-${Date.now()}`,
      type,
      label: this.nodeTypes.find(nt => nt.type === type)?.label || type,
      position: { x: 200 + Math.random() * 300, y: 100 + Math.random() * 200 },
    };
    this.canvasNodes.update(nodes => [...nodes, node]);
  }

  selectNode(node: WorkflowNode, event: MouseEvent): void {
    event.stopPropagation();
    if (this.connectingFrom()) {
      // Complete connection
      const sourceId = this.connectingFrom()!;
      if (sourceId !== node.id) {
        this.pushUndoState();
        const edge: WorkflowEdge = {
          id: `e-${Date.now()}`,
          source: sourceId,
          target: node.id,
        };
        this.canvasEdges.update(edges => [...edges, edge]);
      }
      this.connectingFrom.set(null);
      return;
    }
    this.selectedNodeId.set(node.id);
  }

  deselectNode(): void {
    this.selectedNodeId.set(null);
    this.connectingFrom.set(null);
  }

  startDrag(node: WorkflowNode, event: MouseEvent): void {
    event.preventDefault();
    this.dragTarget = node;
    this.dragOffset = {
      x: event.clientX - node.position.x,
      y: event.clientY - node.position.y,
    };

    const onMove = (e: MouseEvent) => {
      if (!this.dragTarget) return;
      const x = Math.max(0, e.clientX - this.dragOffset.x);
      const y = Math.max(0, e.clientY - this.dragOffset.y);
      this.canvasNodes.update(nodes =>
        nodes.map(n => n.id === this.dragTarget!.id ? { ...n, position: { x, y } } : n)
      );
    };

    const onUp = () => {
      this.dragTarget = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  startConnection(): void {
    if (this.selectedNodeId()) {
      this.connectingFrom.set(this.selectedNodeId());
    }
  }

  deleteNode(): void {
    const nodeId = this.selectedNodeId();
    if (!nodeId) return;
    this.pushUndoState();
    this.canvasNodes.update(nodes => nodes.filter(n => n.id !== nodeId));
    this.canvasEdges.update(edges => edges.filter(e => e.source !== nodeId && e.target !== nodeId));
    this.selectedNodeId.set(null);
  }

  getSelectedNode(): WorkflowNode | undefined {
    return this.canvasNodes().find(n => n.id === this.selectedNodeId());
  }

  updateNodeLabel(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.canvasNodes.update(nodes =>
      nodes.map(n => n.id === this.selectedNodeId() ? { ...n, label: value } : n)
    );
  }

  updateNodeType(type: NodeType): void {
    this.canvasNodes.update(nodes =>
      nodes.map(n => n.id === this.selectedNodeId() ? { ...n, type } : n)
    );
  }

  updateNodeRole(role: string): void {
    this.canvasNodes.update(nodes =>
      nodes.map(n => n.id === this.selectedNodeId() ? { ...n, assigneeRole: role || undefined } : n)
    );
  }

  updateNodeFormId(formId: string): void {
    this.pushUndoState();
    this.canvasNodes.update(nodes =>
      nodes.map(n => n.id === this.selectedNodeId() ? { ...n, formId: formId || undefined } : n)
    );
  }

  isFormLinkableNode(): boolean {
    const node = this.getSelectedNode();
    return !!node && (node.type === 'task' || node.type === 'subprocess');
  }

  getFormName(formId: string): string {
    const form = this.availableForms().find(f => f.id === formId);
    return form?.name || 'Unknown form';
  }

  getNodeCenter(nodeId: string): { x: number; y: number } {
    const node = this.canvasNodes().find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    return { x: node.position.x + 70, y: node.position.y + 40 };
  }

  getNodeIcon(type: NodeType): string {
    return this.nodeTypes.find(nt => nt.type === type)?.icon || '?';
  }

  getNodeStyle(type: NodeType): string {
    const styles: Record<string, string> = {
      start: 'bg-green-50 border-green-300',
      end: 'bg-red-50 border-red-300',
      task: 'bg-white',
      decision: 'bg-yellow-50 border-yellow-300',
      parallel: 'bg-purple-50 border-purple-300',
      subprocess: 'bg-[#EAF4FB] border-[#0A8AD2]',
    };
    return styles[type] || 'bg-white';
  }

  saveWorkflow(): void {
    const wf = this.editingWorkflow();
    if (!wf) return;

    const definition = { nodes: this.canvasNodes(), edges: this.canvasEdges() };

    if (wf.id) {
      this.store.dispatch(WorkflowsActions.updateWorkflow({
        id: wf.id,
        updates: { name: this.workflowName, definition },
      }));
    } else {
      this.store.dispatch(WorkflowsActions.createWorkflow({
        workflow: { name: this.workflowName, definition, caseTypeId: '', description: '' },
      }));
    }
    this.snackBar.open('Flow saved', 'OK', { duration: 2000 });
  }

  validateWorkflow(): void {
    const wf = this.editingWorkflow();
    if (wf?.id) {
      this.store.dispatch(WorkflowsActions.validateWorkflow({ id: wf.id }));
    } else {
      // Local validation for unsaved workflows
      const nodes = this.canvasNodes();
      const edges = this.canvasEdges();
      const errors: { field: string; message: string }[] = [];

      if (!nodes.some(n => n.type === 'start')) errors.push({ field: 'nodes', message: 'Flow must have a Start node' });
      if (!nodes.some(n => n.type === 'end')) errors.push({ field: 'nodes', message: 'Flow must have an End node' });

      const nodeIds = new Set(nodes.map(n => n.id));
      edges.forEach(e => {
        if (!nodeIds.has(e.source)) errors.push({ field: 'edges', message: `Edge references missing source: ${e.source}` });
        if (!nodeIds.has(e.target)) errors.push({ field: 'edges', message: `Edge references missing target: ${e.target}` });
      });

      this.validationResult.set({ valid: errors.length === 0, errors });
    }
  }

  deleteWorkflow(): void {
    const wf = this.editingWorkflow();
    if (!wf?.id) return;
    this.store.dispatch(WorkflowsActions.deleteWorkflow({ id: wf.id }));
    this.editingWorkflow.set(null);
    this.selectedWorkflowId.set(null);
    this.canvasNodes.set([]);
    this.canvasEdges.set([]);
    this.snackBar.open('Flow deleted', 'OK', { duration: 2000 });
  }

  // ─── Undo / Redo ──────────────────────────────
  private pushUndoState(): void {
    this.undoStack.push({
      nodes: this.canvasNodes().map(n => ({ ...n, position: { ...n.position } })),
      edges: this.canvasEdges().map(e => ({ ...e })),
    });
    this.redoStack = [];
    this.canUndo.set(true);
    this.canRedo.set(false);
    this.scheduleAutoSave();
  }

  undo(): void {
    if (!this.undoStack.length) return;
    this.redoStack.push({
      nodes: this.canvasNodes().map(n => ({ ...n, position: { ...n.position } })),
      edges: this.canvasEdges().map(e => ({ ...e })),
    });
    const state = this.undoStack.pop()!;
    this.canvasNodes.set(state.nodes);
    this.canvasEdges.set(state.edges);
    this.canUndo.set(this.undoStack.length > 0);
    this.canRedo.set(true);
  }

  redo(): void {
    if (!this.redoStack.length) return;
    this.undoStack.push({
      nodes: this.canvasNodes().map(n => ({ ...n, position: { ...n.position } })),
      edges: this.canvasEdges().map(e => ({ ...e })),
    });
    const state = this.redoStack.pop()!;
    this.canvasNodes.set(state.nodes);
    this.canvasEdges.set(state.edges);
    this.canUndo.set(true);
    this.canRedo.set(this.redoStack.length > 0);
  }

  // ─── Auto-save (debounced 3 s) ─────────────────
  private scheduleAutoSave(): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveStatus.set('Unsaved changes...');
    this.autoSaveTimer = setTimeout(() => {
      const wf = this.editingWorkflow();
      if (wf?.id) {
        const definition = { nodes: this.canvasNodes(), edges: this.canvasEdges() };
        this.store.dispatch(WorkflowsActions.updateWorkflow({
          id: wf.id,
          updates: { name: this.workflowName, definition },
        }));
        this.autoSaveStatus.set('Auto-saved');
        setTimeout(() => this.autoSaveStatus.set(''), 2000);
      }
    }, 3000);
  }

  ngOnDestroy(): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
  }
}
