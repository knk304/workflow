import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import {
  FlowDefinition, FlowNode, FlowEdge, FlowNodeType,
  FlowFieldType, FlowField, FlowFieldOption, DecisionCondition, FormDefinition,
} from '@core/models';
import { DataService } from '@core/services/data.service';
import { FlowNodeFormEditorComponent, FormEditorDialogData } from './flow-node-form-editor.component';

@Component({
  selector: 'app-workflow-designer',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule, MatToolbarModule,
    MatSelectModule, MatFormFieldModule, MatInputModule, MatChipsModule,
    MatSnackBarModule, MatTooltipModule, MatDividerModule, MatProgressBarModule,
    MatDialogModule,
  ],
  template: `
    <div class="flex h-full">

      <!-- ===== Left Sidebar ===== -->
      @if (leftPanelOpen()) {
        <aside class="bg-white border-r flex flex-col" style="width:250px;min-width:250px;">
          <div class="p-3 border-b flex items-center justify-between">
            <h3 class="text-sm font-semibold">Flows</h3>
            <button mat-icon-button class="wf-left-panel-toggle !w-7 !h-7" matTooltip="Hide panel" (click)="leftPanelOpen.set(false)">
              <mat-icon class="!text-base">chevron_left</mat-icon>
            </button>
          </div>
          <div class="p-2 border-b">
            <button mat-raised-button color="primary" class="w-full !h-8 !text-xs" (click)="newFlow()">
              <mat-icon class="!text-sm !w-4 !h-4">add</mat-icon> New Flow
            </button>
          </div>

          <!-- Flow list -->
          <div class="flex-1 overflow-y-auto p-2 min-h-0">
            @if (loading()) {
              <mat-progress-bar mode="indeterminate" class="mb-2"></mat-progress-bar>
            }
            @for (f of flows(); track f.id) {
              <div class="p-2 mb-1 rounded cursor-pointer transition-colors text-xs"
                   [class.bg-[#EAF4FB]]="selectedFlowId() === f.id"
                   [class.border-l-4]="selectedFlowId() === f.id"
                   [class.border-[#056DAE]]="selectedFlowId() === f.id"
                   (click)="selectFlow(f)">
                <div class="font-medium truncate">{{ f.name }}</div>
                <div class="text-[10px] text-gray-500 flex items-center gap-1">
                  <span class="capitalize">{{ f.category }}</span>
                  <span class="text-gray-300">|</span>
                  <span>{{ f.isActive ? 'Active' : 'Draft' }}</span>
                </div>
              </div>
            }
          </div>

          <!-- Node Palette -->
          <div class="p-3 border-t shrink-0">
            <h4 class="text-[10px] font-semibold mb-1.5 text-gray-500 tracking-wider">NODE PALETTE</h4>
            <div class="max-h-[260px] overflow-y-auto">
              @for (nt of nodeTypes; track nt.type) {
                <div class="flex items-center gap-1.5 px-2 py-1 mb-0.5 rounded cursor-pointer bg-gray-50 hover:bg-gray-100 text-xs"
                     [class.opacity-40]="!editingFlow()"
                     (click)="addNode(nt.type)">
                  <mat-icon class="!text-sm !w-4 !h-4" [ngClass]="nt.color">{{ nt.icon }}</mat-icon>
                  <span>{{ nt.label }}</span>
                </div>
              }
            </div>
          </div>
        </aside>
      } @else {
        <div class="bg-white border-r flex flex-col items-center pt-2" style="width:36px;">
          <button mat-icon-button class="wf-right-panel-toggle !w-7 !h-7" matTooltip="Show panel" (click)="leftPanelOpen.set(true)">
            <mat-icon class="!text-base">chevron_right</mat-icon>
          </button>
        </div>
      }

      <!-- ===== Canvas Area ===== -->
      <main class="flex-1 flex flex-col bg-gray-50 min-w-0">
        <!-- Toolbar -->
        <div class="wf-toolbar bg-white border-b flex items-center gap-1 px-2" style="height:48px;min-height:48px;">
          @if (editingFlow()) {
            <mat-form-field class="toolbar-field" subscriptSizing="dynamic" style="width:180px;">
              <input matInput [(ngModel)]="flowName" placeholder="Flow name">
            </mat-form-field>
            <mat-form-field class="toolbar-field" subscriptSizing="dynamic" style="width:110px;">
              <mat-select [(ngModel)]="flowCategory">
                @for (cat of categories; track cat.value) {
                  <mat-option [value]="cat.value">{{ cat.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <div class="w-px h-5 bg-gray-200 mx-1"></div>
            <button mat-icon-button class="!w-8 !h-8" matTooltip="Undo (Ctrl+Z)" (click)="undo()" [disabled]="!canUndo()">
              <mat-icon class="!text-lg">undo</mat-icon>
            </button>
            <button mat-icon-button class="!w-8 !h-8" matTooltip="Redo (Ctrl+Y)" (click)="redo()" [disabled]="!canRedo()">
              <mat-icon class="!text-lg">redo</mat-icon>
            </button>
            <button mat-icon-button class="!w-8 !h-8" matTooltip="Save (Ctrl+S)" (click)="saveFlow()">
              <mat-icon class="!text-lg">save</mat-icon>
            </button>
            <button mat-icon-button class="!w-8 !h-8"
                    [matTooltip]="editingFlow()!.isActive ? 'Set to Draft' : 'Set to Active'"
                    (click)="toggleActive()">
              <mat-icon class="!text-lg" [class.text-green-600]="editingFlow()!.isActive">
                {{ editingFlow()!.isActive ? 'toggle_on' : 'toggle_off' }}
              </mat-icon>
            </button>
            <button mat-icon-button class="!w-8 !h-8" matTooltip="Delete flow" color="warn" (click)="deleteFlow()">
              <mat-icon class="!text-lg">delete</mat-icon>
            </button>
            <span class="flex-1"></span>
            @if (autoSaveStatus()) {
              <span class="text-[10px] text-gray-400 mr-2">{{ autoSaveStatus() }}</span>
            }
            <span class="text-[10px] px-2 py-0.5 rounded-full mr-1"
                  [class.bg-green-100]="editingFlow()!.isActive"
                  [class.text-green-700]="editingFlow()!.isActive"
                  [class.bg-gray-100]="!editingFlow()!.isActive"
                  [class.text-gray-500]="!editingFlow()!.isActive">
              {{ editingFlow()!.isActive ? 'Active' : 'Draft' }}
            </span>
          } @else {
            <span class="text-gray-400 text-sm">Select or create a flow to begin</span>
          }
        </div>

        <!-- Canvas -->
        <div class="flex-1 overflow-hidden relative select-none"
             (mousedown)="startPan($event)" (click)="deselectNode()">
          <div class="absolute inset-0" [style.transform]="'translate(' + panX() + 'px,' + panY() + 'px)'">
          @if (!editingFlow()) {
            <div class="flex items-center justify-center text-gray-400" style="width:100vw;height:calc(100vh - 64px - 48px);">
              <div class="text-center">
                <mat-icon class="!text-6xl !w-16 !h-16 mb-4">account_tree</mat-icon>
                <p class="text-lg font-medium">Unified Flow Designer</p>
                <p class="text-sm mt-1">Design process flows, questionnaires, approvals, and any workflow</p>
                <p class="text-xs mt-2 text-gray-300">Select a flow or click New Flow</p>
              </div>
            </div>
          } @else {
            <!-- SVG edge layer -->
            <svg class="absolute" style="left:0;top:0;width:6000px;height:4000px;pointer-events:none;">
              <defs>
                <marker id="ah" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0,10 3.5,0 7" fill="#94a3b8"/>
                </marker>
              </defs>
              @for (edge of canvasEdges(); track edge.id) {
                <line [attr.x1]="nc(edge.source).x" [attr.y1]="nc(edge.source).y"
                      [attr.x2]="nc(edge.target).x" [attr.y2]="nc(edge.target).y"
                      stroke="#94a3b8" stroke-width="2" marker-end="url(#ah)"/>
                @if (edge.label) {
                  <text [attr.x]="(nc(edge.source).x+nc(edge.target).x)/2"
                        [attr.y]="(nc(edge.source).y+nc(edge.target).y)/2 - 8"
                        text-anchor="middle" font-size="10" fill="#64748b">{{ edge.label }}</text>
                }
              }
            </svg>

            <!-- Nodes -->
            @for (node of canvasNodes(); track node.id) {
              <div class="absolute cursor-move"
                   [style.left.px]="node.position.x" [style.top.px]="node.position.y"
                   (click)="selectNode(node, $event)"
                   (mousedown)="startDrag(node, $event)">
                <div class="rounded-lg shadow-sm border-2 min-w-[120px] p-2 text-center transition-all"
                     [class.ring-2]="selectedNodeId() === node.id"
                     [class.ring-[#056DAE]]="selectedNodeId() === node.id"
                     [ngClass]="nodeStyle(node.type)">
                  <mat-icon class="!text-xl" [ngClass]="nodeIconColor(node.type)">{{ nodeIcon(node.type) }}</mat-icon>
                  <div class="text-xs font-medium leading-tight mt-0.5">{{ node.label }}</div>
                  <div class="text-[10px] text-gray-400">{{ node.type }}</div>
                  @if (node.fields.length) {
                    <div class="text-[10px] text-blue-500">{{ node.fields.length }} field{{ node.fields.length === 1 ? '' : 's' }}</div>
                  }
                  @if (node.conditions.length) {
                    <div class="text-[10px] text-yellow-600">{{ node.conditions.length }} branch{{ node.conditions.length === 1 ? '' : 'es' }}</div>
                  }
                  @if (node.config?.['assigneeRole']) {
                    <div class="text-[10px] text-[#056DAE]">{{ node.config!['assigneeRole'] }}</div>
                  }
                </div>
              </div>
            }

            @if (connectingFrom()) {
              <div class="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#003B70] text-white px-4 py-2 rounded-full shadow-lg text-sm z-50">
                Click a target node to connect &middot; Escape to cancel
              </div>
            }
          }
          </div>
        </div>
      </main>

      <!-- ===== Right Panel: Node Properties ===== -->
      @if (selectedNodeId() && editingFlow()) {
        <aside class="wf-right-panel bg-white border-l flex flex-col overflow-y-auto relative"
               [style.width.px]="rightPanelWidth()">
          <div class="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#056DAE]/20 z-10"
               (mousedown)="startResizeRight($event)"></div>

          <!-- Panel header -->
          <div class="p-3 border-b flex items-center justify-between sticky top-0 bg-white z-10 shrink-0">
            <h4 class="text-xs font-semibold text-gray-700 truncate flex items-center gap-1">
              <mat-icon class="!text-sm" [ngClass]="nodeIconColor(getNode()?.type || 'task')">{{ nodeIcon(getNode()?.type || 'task') }}</mat-icon>
              {{ getNode()?.label || 'Node Properties' }}
            </h4>
            <div class="flex items-center gap-0.5 shrink-0">
              <button mat-icon-button class="!w-6 !h-6" matTooltip="Wider" (click)="expandRightPanel()">
                <mat-icon class="!text-sm">chevron_left</mat-icon>
              </button>
              <button mat-icon-button class="!w-6 !h-6" matTooltip="Narrower" (click)="shrinkRightPanel()">
                <mat-icon class="!text-sm">chevron_right</mat-icon>
              </button>
              <button mat-icon-button class="!w-6 !h-6" matTooltip="Connect to..." (click)="startConnection()">
                <mat-icon class="!text-sm">trending_flat</mat-icon>
              </button>
              <button mat-icon-button class="!w-6 !h-6" matTooltip="Delete node" color="warn" (click)="deleteNode()">
                <mat-icon class="!text-sm">delete_outline</mat-icon>
              </button>
            </div>
          </div>

          <div class="p-3 space-y-2 overflow-y-auto flex-1">

            <!-- Common: Label + Type -->
            <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
              <mat-label>Label</mat-label>
              <input matInput [value]="getNode()?.label || ''" (input)="updateLabel($event)">
            </mat-form-field>
            <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
              <mat-label>Node Type</mat-label>
              <mat-select [value]="getNode()?.type" (selectionChange)="updateType($event.value)">
                <mat-select-trigger>
                  <span class="inline-flex items-center gap-1">
                    <mat-icon class="!text-sm !w-4 !h-4 align-middle" [ngClass]="nodeIconColor(getNode()?.type || 'task')">{{ nodeIcon(getNode()?.type || 'task') }}</mat-icon>
                    <span>{{ nodeLabel(getNode()?.type || 'task') }}</span>
                  </span>
                </mat-select-trigger>
                @for (nt of nodeTypes; track nt.type) {
                  <mat-option [value]="nt.type">
                    <div class="flex items-center gap-1.5">
                      <mat-icon class="!text-sm !w-4 !h-4" [ngClass]="nt.color">{{ nt.icon }}</mat-icon>
                      <span>{{ nt.label }}</span>
                    </div>
                  </mat-option>
                }
              </mat-select>
            </mat-form-field>

            <!-- TASK / SUBPROCESS / APPROVAL settings -->
            @if (getNode()?.type === 'task' || getNode()?.type === 'subprocess' || getNode()?.type === 'approval') {
              <mat-divider></mat-divider>
              <p class="text-[10px] font-semibold text-gray-500 tracking-wider pt-1">
                {{ getNode()?.type === 'approval' ? 'APPROVAL' : 'TASK' }} SETTINGS
              </p>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Assignee Role</mat-label>
                <mat-select [value]="getNode()?.config?.['assigneeRole'] || ''"
                            (selectionChange)="updateConfig('assigneeRole', $event.value)">
                  <mat-option value="">None</mat-option>
                  <mat-option value="ADMIN">Admin</mat-option>
                  <mat-option value="MANAGER">Manager</mat-option>
                  <mat-option value="WORKER">Worker</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Linked Form</mat-label>
                <mat-select [value]="getNode()?.config?.['formId'] || ''"
                            (selectionChange)="updateConfig('formId', $event.value)">
                  <mat-option value="">None</mat-option>
                  @for (form of availableForms(); track form.id) {
                    <mat-option [value]="form.id">{{ form.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Instructions</mat-label>
                <textarea matInput rows="2" [value]="getNode()?.content || ''"
                          (input)="updateContent($event)"></textarea>
              </mat-form-field>
              @if (getNode()?.type === 'approval') {
                <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                  <mat-label>Approval Type</mat-label>
                  <mat-select [value]="getNode()?.config?.['approvalType'] || 'single'"
                              (selectionChange)="updateConfig('approvalType', $event.value)">
                    <mat-option value="single">Single Approver</mat-option>
                    <mat-option value="unanimous">Unanimous (all must approve)</mat-option>
                    <mat-option value="majority">Majority Vote</mat-option>
                  </mat-select>
                </mat-form-field>
              }
            }

            <!-- NOTIFICATION settings -->
            @if (getNode()?.type === 'notification') {
              <mat-divider></mat-divider>
              <p class="text-[10px] font-semibold text-gray-500 tracking-wider pt-1">NOTIFICATION SETTINGS</p>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Channel</mat-label>
                <mat-select [value]="getNode()?.config?.['channel'] || 'email'"
                            (selectionChange)="updateConfig('channel', $event.value)">
                  <mat-option value="email">Email</mat-option>
                  <mat-option value="in_app">In-App</mat-option>
                  <mat-option value="sms">SMS</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Recipient Role</mat-label>
                <mat-select [value]="getNode()?.config?.['recipientRole'] || ''"
                            (selectionChange)="updateConfig('recipientRole', $event.value)">
                  <mat-option value="">Owner</mat-option>
                  <mat-option value="ADMIN">Admin</mat-option>
                  <mat-option value="MANAGER">Manager</mat-option>
                  <mat-option value="WORKER">Worker</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Message Template</mat-label>
                <textarea matInput rows="3" [value]="getNode()?.content || ''"
                          (input)="updateContent($event)"></textarea>
              </mat-form-field>
            }

            <!-- TIMER settings -->
            @if (getNode()?.type === 'timer') {
              <mat-divider></mat-divider>
              <p class="text-[10px] font-semibold text-gray-500 tracking-wider pt-1">TIMER SETTINGS</p>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Wait Duration (minutes)</mat-label>
                <input matInput type="number" [value]="getNode()?.config?.['durationMinutes'] || 0"
                       (input)="updateConfig('durationMinutes', $any($event.target).value)">
              </mat-form-field>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Timer Type</mat-label>
                <mat-select [value]="getNode()?.config?.['timerType'] || 'delay'"
                            (selectionChange)="updateConfig('timerType', $event.value)">
                  <mat-option value="delay">Fixed Delay</mat-option>
                  <mat-option value="deadline">Deadline (date/time)</mat-option>
                  <mat-option value="sla">SLA Based</mat-option>
                </mat-select>
              </mat-form-field>
            }

            <!-- DISPLAY content -->
            @if (getNode()?.type === 'display') {
              <mat-divider></mat-divider>
              <p class="text-[10px] font-semibold text-gray-500 tracking-wider pt-1">DISPLAY CONTENT</p>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Message / Content</mat-label>
                <textarea matInput rows="4" [value]="getNode()?.content || ''"
                          (input)="updateContent($event)"></textarea>
              </mat-form-field>
            }

            <!-- CUSTOM FORM settings (alert box + form fields) -->
            @if (getNode()?.type === 'question') {
              <mat-divider></mat-divider>

              <!-- Alert / Info Box -->
              <div class="flex items-center justify-between pt-1">
                <p class="text-[10px] font-semibold text-gray-500 tracking-wider">ALERT / INFO BOX</p>
              </div>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Alert Message (shown to worker)</mat-label>
                <textarea matInput rows="2" [value]="getNode()?.config?.['alertMessage'] || ''"
                          placeholder="Enter an alert or info message..."
                          (input)="updateConfig('alertMessage', $any($event.target).value)"></textarea>
              </mat-form-field>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Alert Type</mat-label>
                <mat-select [value]="getNode()?.config?.['alertType'] || 'info'"
                            (selectionChange)="updateConfig('alertType', $event.value)">
                  <mat-option value="info">Info</mat-option>
                  <mat-option value="warning">Warning</mat-option>
                  <mat-option value="error">Error / Critical</mat-option>
                  <mat-option value="success">Success</mat-option>
                </mat-select>
              </mat-form-field>
              @if (getNode()?.config?.['alertMessage']) {
                <div class="rounded border px-3 py-2 text-xs flex items-start gap-2"
                     [ngClass]="{
                       'bg-blue-50 border-blue-200 text-blue-800': getNode()?.config?.['alertType'] === 'info' || !getNode()?.config?.['alertType'],
                       'bg-yellow-50 border-yellow-200 text-yellow-800': getNode()?.config?.['alertType'] === 'warning',
                       'bg-red-50 border-red-200 text-red-800': getNode()?.config?.['alertType'] === 'error',
                       'bg-green-50 border-green-200 text-green-800': getNode()?.config?.['alertType'] === 'success'
                     }">
                  <mat-icon class="!text-sm !w-4 !h-4 shrink-0 mt-0.5">
                    {{ getNode()?.config?.['alertType'] === 'warning' ? 'warning' :
                       getNode()?.config?.['alertType'] === 'error' ? 'error' :
                       getNode()?.config?.['alertType'] === 'success' ? 'check_circle' : 'info' }}
                  </mat-icon>
                  <span>{{ getNode()?.config?.['alertMessage'] }}</span>
                </div>
              }

              <mat-divider class="!my-2"></mat-divider>

              <!-- Form Source Mode Toggle -->
              <p class="text-[10px] font-semibold text-gray-500 tracking-wider pt-1 mb-1">FORM SOURCE</p>
              <div class="flex w-full rounded border border-gray-300 overflow-hidden mb-2 text-xs">
                <button type="button"
                  class="flex-1 flex items-center justify-center gap-1 py-1.5 transition-colors"
                  [class.bg-[#056DAE]]="(getNode()?.config?.['formSource'] || 'custom') === 'linked'"
                  [class.text-white]="(getNode()?.config?.['formSource'] || 'custom') === 'linked'"
                  [class.bg-white]="(getNode()?.config?.['formSource'] || 'custom') !== 'linked'"
                  [class.text-gray-600]="(getNode()?.config?.['formSource'] || 'custom') !== 'linked'"
                  (click)="updateConfig('formSource', 'linked')">
                  <mat-icon class="!text-sm !w-4 !h-4 leading-none">link</mat-icon>
                  <span>Linked Form</span>
                </button>
                <button type="button"
                  class="flex-1 flex items-center justify-center gap-1 py-1.5 border-l border-gray-300 transition-colors"
                  [class.bg-[#056DAE]]="(getNode()?.config?.['formSource'] || 'custom') === 'custom'"
                  [class.text-white]="(getNode()?.config?.['formSource'] || 'custom') === 'custom'"
                  [class.bg-white]="(getNode()?.config?.['formSource'] || 'custom') !== 'custom'"
                  [class.text-gray-600]="(getNode()?.config?.['formSource'] || 'custom') !== 'custom'"
                  (click)="updateConfig('formSource', 'custom')">
                  <mat-icon class="!text-sm !w-4 !h-4 leading-none">edit_note</mat-icon>
                  <span>Custom Fields</span>
                </button>
              </div>

              <!-- Option 1: Linked Form (select from form builder) -->
              @if ((getNode()?.config?.['formSource'] || 'custom') === 'linked') {
                <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                  <mat-label>Select Form</mat-label>
                  <mat-select [value]="getNode()?.config?.['formId'] || ''"
                              (selectionChange)="updateConfig('formId', $event.value)">
                    <mat-option value="">-- None --</mat-option>
                    @for (form of availableForms(); track form.id) {
                      <mat-option [value]="form.id">{{ form.name }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                @if (getNode()?.config?.['formId']) {
                  <div class="flex items-center gap-1.5 px-2 py-1.5 rounded bg-blue-50 border border-blue-200 text-xs text-blue-800">
                    <mat-icon class="!text-xs !w-3.5 !h-3.5 shrink-0">check_circle</mat-icon>
                    <span class="truncate">{{ getLinkedFormName(getNode()?.config?.['formId']) }}</span>
                  </div>
                } @else {
                  <p class="text-[10px] text-gray-400 text-center py-2">No form linked yet</p>
                }
              }

              <!-- Option 2: Custom inline fields -->
              @if ((getNode()?.config?.['formSource'] || 'custom') === 'custom') {
                <div class="flex items-center justify-between">
                  <p class="text-[10px] font-semibold text-gray-500 tracking-wider">FIELDS</p>
                  <button mat-raised-button color="primary" class="!h-6 !text-[10px] !px-2" (click)="openFormEditor()">
                    <mat-icon class="!text-xs !w-3 !h-3 mr-0.5">edit</mat-icon> Edit Form
                  </button>
                </div>
                @if (getNode()?.fields?.length) {
                  <div class="space-y-1 mt-1">
                    @for (field of getNode()!.fields; track field.id) {
                      <div class="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-50 border text-xs">
                        <mat-icon class="!text-xs !w-3 !h-3 text-[#056DAE]">{{ fieldTypeIcon(field.type) }}</mat-icon>
                        <span class="flex-1 truncate">{{ field.label }}</span>
                        <span class="text-[10px] text-gray-400">{{ field.type }}</span>
                        @if (field.validation.required) {
                          <span class="text-red-500 text-[10px] font-bold">*</span>
                        }
                      </div>
                    }
                  </div>
                } @else {
                  <p class="text-[10px] text-gray-400 text-center py-3">
                    No fields yet &mdash; click "Edit Form" to add
                  </p>
                }
              }
            }
0
            <!-- DECISION conditions editor -->
            @if (getNode()?.type === 'decision') {
              <mat-divider></mat-divider>
              <div class="flex items-center justify-between pt-1">
                <p class="text-[10px] font-semibold text-gray-500 tracking-wider">CONDITIONS</p>
                <button mat-icon-button class="!w-6 !h-6" matTooltip="Add condition" (click)="addCondition()">
                  <mat-icon class="!text-sm">add</mat-icon>
                </button>
              </div>
              @for (cond of (getNode()?.conditions || []); track cond.id) {
                <div class="border rounded p-2 space-y-1.5 bg-yellow-50">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] text-gray-500">Branch</span>
                    <button mat-icon-button class="!w-5 !h-5" (click)="removeCondition(cond.id)">
                      <mat-icon class="!text-xs text-red-400">close</mat-icon>
                    </button>
                  </div>
                  <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                    <mat-label>Field (from question node)</mat-label>
                    <mat-select [value]="cond.fieldId"
                                (selectionChange)="updateCondition(cond.id, 'fieldId', $event.value)">
                      <mat-option value="">-- select field --</mat-option>
                      @for (qn of getQuestionNodes(); track qn.id) {
                        <mat-optgroup [label]="qn.label">
                          @for (f of qn.fields; track f.id) {
                            <mat-option [value]="f.id">{{ f.label }} ({{ f.type }})</mat-option>
                          }
                        </mat-optgroup>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                    <mat-label>Operator</mat-label>
                    <mat-select [value]="cond.operator"
                                (selectionChange)="updateCondition(cond.id, 'operator', $event.value)">
                      <mat-option value="equals">equals</mat-option>
                      <mat-option value="not_equals">not equals</mat-option>
                      <mat-option value="contains">contains</mat-option>
                      <mat-option value="gt">greater than</mat-option>
                      <mat-option value="lt">less than</mat-option>
                      <mat-option value="in">in list</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                    <mat-label>Value</mat-label>
                    <input matInput [value]="cond.value"
                           (blur)="updateCondition(cond.id, 'value', $any($event.target).value)">
                  </mat-form-field>
                  <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                    <mat-label>Route to node</mat-label>
                    <mat-select [value]="cond.targetNodeId"
                                (selectionChange)="updateCondition(cond.id, 'targetNodeId', $event.value)">
                      <mat-option value="">-- none --</mat-option>
                      @for (n of canvasNodes(); track n.id) {
                        @if (n.id !== selectedNodeId()) {
                          <mat-option [value]="n.id">{{ n.label }} ({{ n.type }})</mat-option>
                        }
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
              }
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Default route (no match)</mat-label>
                <mat-select [value]="getNode()?.defaultTarget || ''"
                            (selectionChange)="updateDefaultTarget($event.value)">
                  <mat-option value="">-- none --</mat-option>
                  @for (n of canvasNodes(); track n.id) {
                    @if (n.id !== selectedNodeId()) {
                      <mat-option [value]="n.id">{{ n.label }} ({{ n.type }})</mat-option>
                    }
                  }
                </mat-select>
              </mat-form-field>
            }

            <!-- PARALLEL config -->
            @if (getNode()?.type === 'parallel') {
              <mat-divider></mat-divider>
              <p class="text-[10px] font-semibold text-gray-500 tracking-wider pt-1">PARALLEL GATEWAY</p>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Join Type</mat-label>
                <mat-select [value]="getNode()?.config?.['joinType'] || 'all'"
                            (selectionChange)="updateConfig('joinType', $event.value)">
                  <mat-option value="all">Wait for all branches</mat-option>
                  <mat-option value="any">First branch completes</mat-option>
                </mat-select>
              </mat-form-field>
            }

            <!-- EXTERNAL API CALL config -->
            @if (getNode()?.type === 'api_call') {
              <mat-divider></mat-divider>
              <p class="text-[10px] font-semibold text-gray-500 tracking-wider pt-1">API REQUEST</p>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Execution Mode</mat-label>
                <mat-select [value]="getNode()?.config?.['apiMode'] || 'automatic'"
                            (selectionChange)="updateConfig('apiMode', $event.value)">
                  <mat-option value="automatic">Automatic (execute on enter)</mat-option>
                  <mat-option value="manual">Manual (user triggers)</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>HTTP Method</mat-label>
                <mat-select [value]="getNode()?.config?.['apiMethod'] || 'GET'"
                            (selectionChange)="updateConfig('apiMethod', $event.value)">
                  <mat-option value="GET">GET</mat-option>
                  <mat-option value="POST">POST</mat-option>
                  <mat-option value="PUT">PUT</mat-option>
                  <mat-option value="PATCH">PATCH</mat-option>
                  <mat-option value="DELETE">DELETE</mat-option>
                </mat-select>
              </mat-form-field>
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>URL</mat-label>
                <input matInput [value]="getNode()?.config?.['apiUrl'] || ''"
                       placeholder="https://api.example.com/endpoint"
                       (blur)="updateConfig('apiUrl', $any($event.target).value)">
              </mat-form-field>

              <!-- Headers -->
              <div class="flex items-center justify-between pt-1">
                <p class="text-[10px] font-semibold text-gray-500 tracking-wider">HEADERS</p>
                <button mat-icon-button class="!w-6 !h-6" matTooltip="Add header" (click)="addApiHeader()">
                  <mat-icon class="!text-sm">add</mat-icon>
                </button>
              </div>
              @for (header of getNode()?.config?.['apiHeaders'] || []; track $index) {
                <div class="flex items-center gap-1 mb-1">
                  <mat-form-field class="flex-1 dense-field" subscriptSizing="dynamic">
                    <input matInput [value]="header.key" placeholder="Header name"
                           (blur)="updateApiHeader($index, 'key', $any($event.target).value)">
                  </mat-form-field>
                  <mat-form-field class="flex-1 dense-field" subscriptSizing="dynamic">
                    <input matInput [value]="header.value" placeholder="Value"
                           (blur)="updateApiHeader($index, 'value', $any($event.target).value)">
                  </mat-form-field>
                  <button mat-icon-button class="!w-5 !h-5 shrink-0" (click)="removeApiHeader($index)">
                    <mat-icon class="!text-xs text-red-400">close</mat-icon>
                  </button>
                </div>
              }

              <!-- Request Body -->
              @if (getNode()?.config?.['apiMethod'] !== 'GET') {
                <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                  <mat-label>Request Body (JSON)</mat-label>
                  <textarea matInput rows="3"
                            [value]="getNode()?.config?.['apiBody'] || ''"
                            placeholder='{"key": "{response.fieldId}"}'
                            (blur)="updateConfig('apiBody', $any($event.target).value)"></textarea>
                </mat-form-field>
              }

              <!-- Response Mapping -->
              <div class="flex items-center justify-between pt-1">
                <p class="text-[10px] font-semibold text-gray-500 tracking-wider">RESPONSE MAPPING</p>
                <button mat-icon-button class="!w-6 !h-6" matTooltip="Add mapping" (click)="addApiResponseMapping()">
                  <mat-icon class="!text-sm">add</mat-icon>
                </button>
              </div>
              <p class="text-[9px] text-gray-400 -mt-1 mb-1">Extract values using &#123;response.path&#125; syntax</p>
              @for (mapping of getNode()?.config?.['apiResponseMappings'] || []; track $index) {
                <div class="flex items-center gap-1 mb-1">
                  <mat-form-field class="flex-1 dense-field" subscriptSizing="dynamic">
                    <input matInput [value]="mapping.expression" placeholder="{response.data.email}"
                           (blur)="updateApiResponseMapping($index, 'expression', $any($event.target).value)">
                  </mat-form-field>
                  <mat-form-field class="flex-1 dense-field" subscriptSizing="dynamic">
                    <input matInput [value]="mapping.variableName" placeholder="Variable name"
                           (blur)="updateApiResponseMapping($index, 'variableName', $any($event.target).value)">
                  </mat-form-field>
                  <button mat-icon-button class="!w-5 !h-5 shrink-0" (click)="removeApiResponseMapping($index)">
                    <mat-icon class="!text-xs text-red-400">close</mat-icon>
                  </button>
                </div>
              }

              <!-- Description / Notes -->
              <mat-form-field class="w-full dense-field" subscriptSizing="dynamic">
                <mat-label>Description</mat-label>
                <textarea matInput rows="2" [value]="getNode()?.content || ''"
                          (input)="updateContent($event)"></textarea>
              </mat-form-field>
            }

            <!-- Outgoing edges -->
            @if (selectedEdges().length) {
              <mat-divider></mat-divider>
              <h5 class="text-[10px] font-semibold text-gray-500 tracking-wider pt-1">OUTGOING EDGES</h5>
              @for (edge of selectedEdges(); track edge.id) {
                <div class="flex items-center gap-1 mb-1">
                  <span class="text-[10px] text-gray-400 shrink-0 truncate" style="max-width:80px;">
                    <mat-icon class="!text-[10px] !w-3 !h-3 align-middle">arrow_forward</mat-icon>
                    {{ nodeLabelById(edge.target) }}
                  </span>
                  <mat-form-field class="flex-1 dense-field" subscriptSizing="dynamic">
                    <input matInput [value]="edge.label || ''" placeholder="edge label"
                           (input)="updateEdgeLabel(edge.id, $event)">
                  </mat-form-field>
                  <button mat-icon-button class="!w-5 !h-5 shrink-0" matTooltip="Remove edge"
                          (click)="removeEdge(edge.id)">
                    <mat-icon class="!text-xs text-red-400">close</mat-icon>
                  </button>
                </div>
              }
            }
          </div>
        </aside>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: calc(100vh - 64px); }

    /* Zero out ALL icon-button and icon padding within this component */
    :host ::ng-deep .mdc-icon-button { padding: 0 !important; }
    :host ::ng-deep mat-icon { padding: 0 !important; }

    /* Right-panel icons: uniform 18px inside 24px buttons */
    :host ::ng-deep .wf-right-panel mat-icon {
      font-size: 16px !important;
      width: 24px !important;
      height: 24px !important;
      line-height: 18px !important;
    }

    /* Right-panel form fields — label clearly floated above value */
    :host ::ng-deep .dense-field .mat-mdc-text-field-wrapper { min-height: 48px !important; }
    :host ::ng-deep .dense-field .mat-mdc-form-field-infix { min-height: 48px !important; padding-top: 20px !important; padding-bottom: 6px !important; }
    :host ::ng-deep .dense-field .mat-mdc-floating-label { font-size: 12px; }
    :host ::ng-deep .dense-field input.mat-mdc-input-element,
    :host ::ng-deep .dense-field textarea.mat-mdc-input-element { font-size: 12px; }
    :host ::ng-deep .dense-field .mat-mdc-select-trigger { font-size: 12px; }
    :host ::ng-deep .dense-field .mat-mdc-select-value { font-size: 12px; }

    /* Toolbar form fields — no floating label, fully centered */
    .toolbar-field { margin: 0 !important; }
    :host ::ng-deep .toolbar-field .mat-mdc-text-field-wrapper {
      height: 34px !important; min-height: 34px !important;
      padding: 0 8px !important;
      display: flex !important; align-items: center !important;
    }
    :host ::ng-deep .toolbar-field .mat-mdc-form-field-flex { align-items: center !important; height: 100% !important; }
    :host ::ng-deep .toolbar-field .mat-mdc-form-field-infix {
      padding: 0 !important; min-height: unset !important;
      border-top: none !important;
      display: flex !important; align-items: center !important;
    }
    :host ::ng-deep .toolbar-field .mat-mdc-floating-label { display: none !important; }
    :host ::ng-deep .toolbar-field .mat-mdc-form-field-subscript-wrapper { display: none !important; }
    :host ::ng-deep .toolbar-field .mdc-line-ripple { display: none !important; }
    :host ::ng-deep .toolbar-field input.mat-mdc-input-element { font-size: 13px; font-weight: 500; padding: 0 !important; }
    :host ::ng-deep .toolbar-field .mat-mdc-select-trigger { font-size: 13px; font-weight: 500; }
  `],
})
export class WorkflowDesignerComponent implements OnInit, OnDestroy {

  // -- State --
  flows = signal<FlowDefinition[]>([]);
  selectedFlowId = signal<string | null>(null);
  editingFlow = signal<FlowDefinition | null>(null);
  canvasNodes = signal<FlowNode[]>([]);
  canvasEdges = signal<FlowEdge[]>([]);
  selectedNodeId = signal<string | null>(null);
  connectingFrom = signal<string | null>(null);
  leftPanelOpen = signal(true);
  rightPanelWidth = signal(300);
  loading = signal(false);
  autoSaveStatus = signal('');
  canUndo = signal(false);
  canRedo = signal(false);
  availableForms = signal<FormDefinition[]>([]);
  panX = signal(0);
  panY = signal(0);
  private isPanning = false;
  private panStart = { x: 0, y: 0 };
  private panStartOffset = { x: 0, y: 0 };

  flowName = '';
  flowCategory = 'general';

  private undoStack: { nodes: FlowNode[]; edges: FlowEdge[] }[] = [];
  private redoStack: { nodes: FlowNode[]; edges: FlowEdge[] }[] = [];
  private dragTarget: FlowNode | null = null;
  private dragOffset = { x: 0, y: 0 };
  private autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

  // -- Node type config (Material icons) --
  nodeTypes: { type: FlowNodeType; label: string; icon: string; color: string }[] = [
    { type: 'start',        label: 'Start',        icon: 'play_circle',         color: 'text-green-600' },
    { type: 'end',          label: 'End',           icon: 'stop_circle',         color: 'text-red-600' },
    { type: 'question',     label: 'Custom Form',  icon: 'help_outline',        color: 'text-blue-600' },
    { type: 'decision',     label: 'Decision',      icon: 'call_split',          color: 'text-yellow-600' },
    { type: 'display',      label: 'Display',       icon: 'chat_bubble_outline', color: 'text-indigo-600' },
    { type: 'task',         label: 'Task',          icon: 'task_alt',            color: 'text-gray-600' },
    { type: 'approval',     label: 'Approval',      icon: 'verified',            color: 'text-emerald-600' },
    { type: 'notification', label: 'Notification',  icon: 'notifications',       color: 'text-orange-500' },
    { type: 'timer',        label: 'Timer / Wait',  icon: 'schedule',            color: 'text-cyan-600' },
    { type: 'parallel',     label: 'Parallel',      icon: 'fork_right',          color: 'text-purple-600' },
    { type: 'subprocess',   label: 'Subprocess',    icon: 'widgets',             color: 'text-[#056DAE]' },
    { type: 'api_call',     label: 'External API',  icon: 'cloud',               color: 'text-teal-600' },
  ];

  fieldTypes: { type: FlowFieldType; label: string }[] = [
    { type: 'text', label: 'Text' },
    { type: 'textarea', label: 'Textarea' },
    { type: 'number', label: 'Number' },
    { type: 'date', label: 'Date' },
    { type: 'select', label: 'Select (dropdown)' },
    { type: 'radio', label: 'Radio buttons' },
    { type: 'checkbox', label: 'Checkbox' },
    { type: 'multi_select', label: 'Multi-select' },
    { type: 'file', label: 'File upload' },
    { type: 'alert', label: 'Alert / Info Box' },
  ];

  categories = [
    { value: 'general', label: 'General' },
    { value: 'process', label: 'Process' },
    { value: 'questionnaire', label: 'Questionnaire' },
    { value: 'health', label: 'Health' },
    { value: 'hr', label: 'HR' },
    { value: 'finance', label: 'Finance' },
    { value: 'compliance', label: 'Compliance' },
  ];

  constructor(
    private dataService: DataService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
  ) {}

  ngOnInit(): void {
    this.loadFlows();
    this.dataService.getFormDefinitions().subscribe(forms => this.availableForms.set(forms));
    window.addEventListener('keydown', this.onKeyDown);
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.deselectNode();
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); this.redo(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); this.saveFlow(); }
  };

  // == Data ==
  loadFlows(): void {
    this.loading.set(true);
    this.dataService.getFlowDefinitions().subscribe({
      next: flows => { this.flows.set(flows); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  selectFlow(flow: FlowDefinition): void {
    this.selectedFlowId.set(flow.id);
    this.editingFlow.set(flow);
    this.canvasNodes.set(flow.definition.nodes.map(n => ({
      ...n, fields: n.fields ?? [], conditions: n.conditions ?? [],
    })));
    this.canvasEdges.set([...flow.definition.edges]);
    this.flowName = flow.name;
    this.flowCategory = flow.category;
    this.selectedNodeId.set(null);
    this.undoStack = []; this.redoStack = [];
    this.canUndo.set(false); this.canRedo.set(false);
    this.panX.set(0); this.panY.set(0);
  }

  newFlow(): void {
    const s: FlowNode = { id: `n-${Date.now()}-s`, type: 'start', label: 'Start', position: { x: 80, y: 200 }, fields: [], conditions: [] };
    const e: FlowNode = { id: `n-${Date.now()}-e`, type: 'end', label: 'End', position: { x: 480, y: 200 }, fields: [], conditions: [] };
    this.editingFlow.set({
      id: '', name: 'New Flow', description: '', category: 'general',
      definition: { nodes: [s, e], edges: [] },
      version: 1, isActive: false, createdBy: '', createdAt: new Date().toISOString(),
    });
    this.canvasNodes.set([s, e]);
    this.canvasEdges.set([]);
    this.flowName = 'New Flow';
    this.flowCategory = 'general';
    this.selectedFlowId.set(null);
    this.undoStack = []; this.redoStack = [];
  }

  saveFlow(): void {
    const flow = this.editingFlow();
    if (!flow) return;
    if (this.autoSaveTimer) { clearTimeout(this.autoSaveTimer); this.autoSaveTimer = null; }
    const payload: Partial<FlowDefinition> = {
      name: this.flowName, category: this.flowCategory,
      description: flow.description, isActive: flow.isActive,
      definition: { nodes: this.canvasNodes(), edges: this.canvasEdges() },
    };
    if (flow.id) {
      this.dataService.updateFlowDefinition(flow.id, payload).subscribe({
        next: updated => {
          this.flows.update(list => list.map(f => f.id === updated.id ? updated : f));
          this.editingFlow.set(updated);
          this.autoSaveStatus.set('Saved');
          setTimeout(() => this.autoSaveStatus.set(''), 3000);
        },
        error: () => this.snackBar.open('Save failed', 'Dismiss', { duration: 3000 }),
      });
    } else {
      this.dataService.createFlowDefinition(payload).subscribe({
        next: created => {
          this.flows.update(list => [...list, created]);
          this.editingFlow.set(created);
          this.selectedFlowId.set(created.id);
          this.autoSaveStatus.set('Created');
          setTimeout(() => this.autoSaveStatus.set(''), 3000);
        },
        error: () => this.snackBar.open('Create failed', 'Dismiss', { duration: 3000 }),
      });
    }
  }

  toggleActive(): void {
    const flow = this.editingFlow();
    if (!flow) return;
    this.editingFlow.update(f => f ? { ...f, isActive: !f.isActive } : f);
  }

  deleteFlow(): void {
    const flow = this.editingFlow();
    if (!flow) return;
    if (!flow.id) { this.editingFlow.set(null); this.selectedFlowId.set(null); return; }
    if (!confirm(`Delete "${flow.name}"? This cannot be undone.`)) return;
    this.dataService.deleteFlowDefinition(flow.id).subscribe({
      next: () => {
        this.flows.update(list => list.filter(f => f.id !== flow.id));
        this.editingFlow.set(null); this.selectedFlowId.set(null);
        this.snackBar.open('Flow deleted', 'OK', { duration: 2000 });
      },
    });
  }

  // == Canvas ==
  addNode(type: FlowNodeType): void {
    if (!this.editingFlow()) return;
    this.pushUndoState();
    const label = this.nodeTypes.find(n => n.type === type)?.label || type;
    const node: FlowNode = {
      id: `n-${Date.now()}`, type, label,
      position: { x: 180 + Math.random() * 350, y: 80 + Math.random() * 250 },
      fields: [], conditions: [],
    };
    this.canvasNodes.update(nodes => [...nodes, node]);
    this.scheduleAutoSave();
  }

  selectNode(node: FlowNode, event: MouseEvent): void {
    event.stopPropagation();
    if (this.connectingFrom()) {
      const src = this.connectingFrom()!;
      if (src !== node.id) {
        this.pushUndoState();
        this.canvasEdges.update(edges => [...edges, { id: `e-${Date.now()}`, source: src, target: node.id }]);
      }
      this.connectingFrom.set(null);
      return;
    }
    this.selectedNodeId.set(node.id);
  }

  deselectNode(): void { this.selectedNodeId.set(null); this.connectingFrom.set(null); }
  startConnection(): void { if (this.selectedNodeId()) this.connectingFrom.set(this.selectedNodeId()); }

  // == Canvas pan (drag empty space to scroll) ==
  startPan(event: MouseEvent): void {
    // Only pan on the canvas background, not on nodes/buttons
    const target = event.target as HTMLElement;
    if (target.closest('.cursor-move') || target.closest('button') || target.closest('mat-icon') || target.closest('mat-form-field')) return;
    this.isPanning = true;
    this.panStart = { x: event.clientX, y: event.clientY };
    this.panStartOffset = { x: this.panX(), y: this.panY() };
    event.preventDefault();
    const onMove = (e: MouseEvent) => {
      if (!this.isPanning) return;
      this.panX.set(this.panStartOffset.x + (e.clientX - this.panStart.x));
      this.panY.set(this.panStartOffset.y + (e.clientY - this.panStart.y));
    };
    const onUp = () => {
      this.isPanning = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  deleteNode(): void {
    const id = this.selectedNodeId(); if (!id) return;
    this.pushUndoState();
    this.canvasNodes.update(ns => ns.filter(n => n.id !== id));
    this.canvasEdges.update(es => es.filter(e => e.source !== id && e.target !== id));
    this.selectedNodeId.set(null);
  }

  startDrag(node: FlowNode, event: MouseEvent): void {
    event.preventDefault();
    this.dragTarget = node;
    this.dragOffset = { x: event.clientX - node.position.x, y: event.clientY - node.position.y };
    const onMove = (e: MouseEvent) => {
      if (!this.dragTarget) return;
      this.canvasNodes.update(ns => ns.map(n => n.id === this.dragTarget!.id
        ? { ...n, position: { x: Math.max(0, e.clientX - this.dragOffset.x), y: Math.max(0, e.clientY - this.dragOffset.y) } } : n));
    };
    const onUp = () => {
      this.dragTarget = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // == Node helpers ==
  getNode(): FlowNode | undefined { return this.canvasNodes().find(n => n.id === this.selectedNodeId()); }
  selectedEdges(): FlowEdge[] { return this.canvasEdges().filter(e => e.source === this.selectedNodeId()); }
  nodeLabelById(id: string): string { return this.canvasNodes().find(n => n.id === id)?.label || id; }

  nc(nodeId: string): { x: number; y: number } {
    const nd = this.canvasNodes().find(n => n.id === nodeId);
    return nd ? { x: nd.position.x + 65, y: nd.position.y + 42 } : { x: 0, y: 0 };
  }

  nodeIcon(type: FlowNodeType): string {
    return this.nodeTypes.find(nt => nt.type === type)?.icon || 'circle';
  }

  nodeIconColor(type: FlowNodeType): string {
    return this.nodeTypes.find(nt => nt.type === type)?.color || 'text-gray-600';
  }

  nodeLabel(type: FlowNodeType): string {
    return this.nodeTypes.find(nt => nt.type === type)?.label || type;
  }

  nodeStyle(type: FlowNodeType): string {
    const map: Record<string, string> = {
      start: 'bg-green-50 border-green-300',
      end: 'bg-red-50 border-red-300',
      question: 'bg-blue-50 border-blue-300',
      decision: 'bg-yellow-50 border-yellow-300',
      display: 'bg-indigo-50 border-indigo-300',
      task: 'bg-white border-gray-200',
      approval: 'bg-emerald-50 border-emerald-300',
      notification: 'bg-orange-50 border-orange-300',
      timer: 'bg-cyan-50 border-cyan-300',
      parallel: 'bg-purple-50 border-purple-300',
      subprocess: 'bg-[#EAF4FB] border-[#0A8AD2]',
    };
    return map[type] || 'bg-white border-gray-200';
  }

  getLinkedFormName(formId: string | undefined): string {
    if (!formId) return '';
    return this.availableForms().find(f => f.id === formId)?.name ?? formId;
  }

  fieldTypeIcon(type: FlowFieldType): string {
    const map: Record<string, string> = {
      text: 'short_text', textarea: 'notes', number: 'pin',
      date: 'calendar_today', select: 'arrow_drop_down_circle',
      radio: 'radio_button_checked', checkbox: 'check_box',
      multi_select: 'checklist', file: 'attach_file',
      alert: 'info',
    };
    return map[type] || 'text_fields';
  }

  /** Get all question nodes that have fields (for decision condition dropdowns) */
  getQuestionNodes(): FlowNode[] {
    return this.canvasNodes().filter(n => n.type === 'question' && n.fields.length > 0);
  }

  // == Node property updates ==
  private patchNode(patch: Partial<FlowNode>): void {
    this.canvasNodes.update(ns => ns.map(n => n.id === this.selectedNodeId() ? { ...n, ...patch } : n));
    this.scheduleAutoSave();
  }

  updateLabel(e: Event): void { this.patchNode({ label: (e.target as HTMLInputElement).value }); }
  updateType(type: FlowNodeType): void { this.patchNode({ type }); }
  updateContent(e: Event): void { this.patchNode({ content: (e.target as HTMLTextAreaElement).value }); }
  updateConfig(key: string, value: string): void {
    const node = this.getNode();
    this.patchNode({ config: { ...(node?.config || {}), [key]: value || undefined } });
  }
  updateDefaultTarget(target: string): void { this.patchNode({ defaultTarget: target || undefined }); }

  addApiHeader(): void {
    const node = this.getNode();
    if (!node) return;
    const headers = [...(node.config?.['apiHeaders'] || []), { key: '', value: '' }];
    this.patchNode({ config: { ...(node.config || {}), apiHeaders: headers } });
  }

  updateApiHeader(index: number, field: 'key' | 'value', value: string): void {
    const node = this.getNode();
    if (!node) return;
    const headers = [...(node.config?.['apiHeaders'] || [])];
    headers[index] = { ...headers[index], [field]: value };
    this.patchNode({ config: { ...(node.config || {}), apiHeaders: headers } });
  }

  removeApiHeader(index: number): void {
    const node = this.getNode();
    if (!node) return;
    const headers = (node.config?.['apiHeaders'] || []).filter((_: any, i: number) => i !== index);
    this.patchNode({ config: { ...(node.config || {}), apiHeaders: headers } });
  }

  addApiResponseMapping(): void {
    const node = this.getNode();
    if (!node) return;
    const mappings = [...(node.config?.['apiResponseMappings'] || []), { expression: '', variableName: '' }];
    this.patchNode({ config: { ...(node.config || {}), apiResponseMappings: mappings } });
  }

  updateApiResponseMapping(index: number, field: 'expression' | 'variableName', value: string): void {
    const node = this.getNode();
    if (!node) return;
    const mappings = [...(node.config?.['apiResponseMappings'] || [])];
    mappings[index] = { ...mappings[index], [field]: value };
    this.patchNode({ config: { ...(node.config || {}), apiResponseMappings: mappings } });
  }

  removeApiResponseMapping(index: number): void {
    const node = this.getNode();
    if (!node) return;
    const mappings = (node.config?.['apiResponseMappings'] || []).filter((_: any, i: number) => i !== index);
    this.patchNode({ config: { ...(node.config || {}), apiResponseMappings: mappings } });
  }

  updateEdgeLabel(edgeId: string, e: Event): void {
    const value = (e.target as HTMLInputElement).value;
    this.canvasEdges.update(edges => edges.map(ed => ed.id === edgeId ? { ...ed, label: value || undefined } : ed));
    this.scheduleAutoSave();
  }

  removeEdge(edgeId: string): void {
    this.pushUndoState();
    this.canvasEdges.update(edges => edges.filter(e => e.id !== edgeId));
  }

  // == Form editor dialog ==
  openFormEditor(): void {
    const node = this.getNode();
    if (!node) return;
    const dialogRef = this.dialog.open(FlowNodeFormEditorComponent, {
      data: { node, allNodes: this.canvasNodes() } as FormEditorDialogData,
      width: '900px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'form-editor-dialog',
      autoFocus: false,
    });
    dialogRef.afterClosed().subscribe((fields: FlowField[] | null) => {
      if (fields) {
        this.pushUndoState();
        this.patchNode({ fields });
      }
    });
  }

  // == Condition editing ==
  addCondition(): void {
    const node = this.getNode(); if (!node) return;
    const cond: DecisionCondition = { id: `c-${Date.now()}`, label: 'Condition', fieldId: '', operator: 'equals', value: '', targetNodeId: '' };
    this.patchNode({ conditions: [...(node.conditions || []), cond] });
  }

  updateCondition(condId: string, key: string, value: any): void {
    const node = this.getNode(); if (!node) return;
    this.patchNode({ conditions: node.conditions.map(c => c.id === condId ? { ...c, [key]: value } : c) });
  }

  removeCondition(condId: string): void {
    const node = this.getNode(); if (!node) return;
    this.patchNode({ conditions: node.conditions.filter(c => c.id !== condId) });
  }

  // == Undo / Redo ==
  pushUndoState(): void {
    this.undoStack.push({ nodes: structuredClone(this.canvasNodes()), edges: structuredClone(this.canvasEdges()) });
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
    this.canUndo.set(true); this.canRedo.set(false);
  }

  undo(): void {
    if (!this.undoStack.length) return;
    this.redoStack.push({ nodes: structuredClone(this.canvasNodes()), edges: structuredClone(this.canvasEdges()) });
    const s = this.undoStack.pop()!;
    this.canvasNodes.set(s.nodes); this.canvasEdges.set(s.edges);
    this.canUndo.set(this.undoStack.length > 0); this.canRedo.set(true);
  }

  redo(): void {
    if (!this.redoStack.length) return;
    this.undoStack.push({ nodes: structuredClone(this.canvasNodes()), edges: structuredClone(this.canvasEdges()) });
    const s = this.redoStack.pop()!;
    this.canvasNodes.set(s.nodes); this.canvasEdges.set(s.edges);
    this.canUndo.set(true); this.canRedo.set(this.redoStack.length > 0);
  }

  scheduleAutoSave(): void {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveStatus.set('Unsaved...');
    this.autoSaveTimer = setTimeout(() => this.saveFlow(), 8000);
  }

  // == Right panel resize ==
  expandRightPanel(): void { this.rightPanelWidth.update(w => Math.min(w + 80, 620)); }
  shrinkRightPanel(): void { this.rightPanelWidth.update(w => Math.max(w - 80, 220)); }

  startResizeRight(event: MouseEvent): void {
    event.preventDefault();
    const startX = event.clientX, startW = this.rightPanelWidth();
    const onMove = (e: MouseEvent) => this.rightPanelWidth.set(Math.max(220, Math.min(620, startW + (startX - e.clientX))));
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
}

