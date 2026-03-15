import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngrx/store';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { Document as WfDocument } from '../../core/models';
import * as DocumentsActions from '../../state/documents/documents.actions';
import { environment } from '../../../environments/environment';
import {
  selectDocumentsList,
  selectDocumentsLoading,
  selectDocumentsUploading,
} from '../../state/documents/documents.selectors';

@Component({
  selector: 'app-documents',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatTableModule,
    MatTooltipModule,
    MatMenuModule,
    MatDialogModule,
  ],
  template: `
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold">Documents</h1>
          <p class="text-gray-500">Manage case documents and file attachments</p>
        </div>
        <div class="flex items-center gap-3">
          <mat-form-field class="!w-64">
            <mat-icon matPrefix>search</mat-icon>
            <input matInput placeholder="Search documents..." [(ngModel)]="searchTerm"
                   (ngModelChange)="filterDocuments()">
          </mat-form-field>
        </div>
      </div>

      <!-- Upload Zone -->
      <mat-card class="mb-6">
        <mat-card-content class="p-6">
          <div class="border-2 border-dashed rounded-lg p-8 text-center transition-colors"
               [class.border-[#056DAE]]="isDragOver()"
               [class.bg-[#EAF4FB]]="isDragOver()"
               [class.border-gray-300]="!isDragOver()"
               (dragover)="onDragOver($event)"
               (dragleave)="isDragOver.set(false)"
               (drop)="onDrop($event)">
            <mat-icon class="!text-5xl !w-12 !h-12 mb-3 text-gray-400">cloud_upload</mat-icon>
            <p class="text-lg font-medium mb-2">Drag & drop files here</p>
            <p class="text-sm text-gray-500 mb-4">or click to browse</p>
            <input type="file" #fileInput class="hidden" multiple
                   (change)="onFileSelected($event)">
            <button mat-raised-button color="primary" (click)="fileInput.click()">
              <mat-icon>attach_file</mat-icon> Browse Files
            </button>

            <div class="mt-4 grid grid-cols-2 gap-4 max-w-md mx-auto">
              <mat-form-field>
                <mat-label>Case ID</mat-label>
                <input matInput [(ngModel)]="uploadCaseId" placeholder="CASE-2026-00001">
              </mat-form-field>
              <mat-form-field>
                <mat-label>Description</mat-label>
                <input matInput [(ngModel)]="uploadDescription" placeholder="Optional description">
              </mat-form-field>
            </div>
          </div>

          @if (isUploading$ | async) {
            <mat-progress-bar mode="indeterminate" class="mt-4"></mat-progress-bar>
          }
        </mat-card-content>
      </mat-card>

      <!-- Document List -->
      @if (isLoading$ | async) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @for (doc of filteredDocuments(); track doc.id) {
          <mat-card class="hover:shadow-md transition-shadow">
            <mat-card-content class="p-4">
              <div class="flex items-start gap-3">
                <div class="p-2 rounded-lg" [ngClass]="getFileIconBg(doc.contentType)">
                  <mat-icon class="!text-2xl !w-6 !h-6" [ngClass]="getFileIconColor(doc.contentType)">
                    {{ getFileIcon(doc.contentType) }}
                  </mat-icon>
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="font-medium text-sm truncate" [matTooltip]="doc.filename">
                    {{ doc.filename }}
                  </h4>
                  <p class="text-xs text-gray-500 mt-1">{{ formatSize(doc.sizeBytes) }}</p>
                  <p class="text-xs text-gray-400">v{{ doc.version }} · {{ getRelativeTime(doc.uploadedAt) }}</p>
                </div>
                <button mat-icon-button [matMenuTriggerFor]="docMenu">
                  <mat-icon>more_vert</mat-icon>
                </button>
                <mat-menu #docMenu="matMenu">
                  <button mat-menu-item (click)="previewDoc(doc)">
                    <mat-icon>visibility</mat-icon> Preview
                  </button>
                  <button mat-menu-item (click)="downloadDoc(doc)">
                    <mat-icon>download</mat-icon> Download
                  </button>
                  <button mat-menu-item (click)="viewVersions(doc)">
                    <mat-icon>history</mat-icon> Version History
                  </button>
                  <button mat-menu-item (click)="deleteDoc(doc.id)" class="!text-red-600">
                    <mat-icon>delete</mat-icon> Delete
                  </button>
                </mat-menu>
              </div>

              @if (doc.description) {
                <p class="text-xs text-gray-600 mt-3">{{ doc.description }}</p>
              }

              @if (doc.tags.length) {
                <div class="mt-3 flex flex-wrap gap-1">
                  @for (tag of doc.tags; track tag) {
                    <span class="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{{ tag }}</span>
                  }
                </div>
              }

              <div class="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span>Case: {{ doc.caseId }}</span>
                @if (doc.isCurrent) {
                  <span class="text-green-600 font-medium">Current</span>
                }
              </div>
            </mat-card-content>
          </mat-card>
        }
      </div>

      @if (filteredDocuments().length === 0 && !(isLoading$ | async)) {
        <div class="text-center py-12 text-gray-400">
          <mat-icon class="!text-5xl !w-12 !h-12 mb-3">folder_open</mat-icon>
          <p>No documents found</p>
        </div>
      }

      <!-- Preview Overlay -->
      @if (previewDocument()) {
        <div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
             (click)="closePreview()">
          <div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col m-4"
               (click)="$event.stopPropagation()">
            <div class="flex items-center justify-between p-4 border-b">
              <h3 class="font-semibold">{{ previewDocument()!.filename }}</h3>
              <button mat-icon-button (click)="closePreview()">
                <mat-icon>close</mat-icon>
              </button>
            </div>
            <div class="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px]">
              @if (isPreviewableImage(previewDocument()!.contentType)) {
                <img [src]="getPreviewUrl(previewDocument()!)"
                     [alt]="previewDocument()!.filename"
                     class="max-w-full max-h-[70vh] object-contain">
              } @else if (previewDocument()!.contentType.includes('pdf')) {
                <iframe [src]="getPreviewUrl(previewDocument()!)"
                        class="w-full h-[70vh] border-0"
                        title="PDF Preview"></iframe>
              } @else {
                <div class="text-center text-gray-400">
                  <mat-icon class="!text-5xl !w-12 !h-12 mb-3">insert_drive_file</mat-icon>
                  <p>Preview not available for this file type</p>
                  <button mat-raised-button color="primary" class="mt-4" (click)="downloadDoc(previewDocument()!)">
                    <mat-icon>download</mat-icon> Download
                  </button>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class DocumentsComponent implements OnInit {
  documents$ = this.store.select(selectDocumentsList);
  isLoading$ = this.store.select(selectDocumentsLoading);
  isUploading$ = this.store.select(selectDocumentsUploading);

  isDragOver = signal(false);
  filteredDocuments = signal<WfDocument[]>([]);
  previewDocument = signal<WfDocument | null>(null);
  searchTerm = '';
  uploadCaseId = '';
  uploadDescription = '';
  private apiUrl = environment.apiUrl;

  private allDocuments: WfDocument[] = [];

  constructor(private store: Store, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.store.dispatch(DocumentsActions.loadDocuments({}));
    this.documents$.subscribe(docs => {
      this.allDocuments = docs;
      this.filterDocuments();
    });
  }

  filterDocuments(): void {
    if (!this.searchTerm.trim()) {
      this.filteredDocuments.set(this.allDocuments);
    } else {
      const term = this.searchTerm.toLowerCase();
      this.filteredDocuments.set(
        this.allDocuments.filter(d =>
          d.filename.toLowerCase().includes(term) ||
          d.description?.toLowerCase().includes(term) ||
          d.tags.some(t => t.toLowerCase().includes(term))
        )
      );
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const files = event.dataTransfer?.files;
    if (files) this.uploadFiles(files);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.uploadFiles(input.files);
  }

  private uploadFiles(files: FileList): void {
    const caseId = this.uploadCaseId || 'CASE-2026-00001';
    for (let i = 0; i < files.length; i++) {
      this.store.dispatch(DocumentsActions.uploadDocument({
        caseId,
        file: files[i],
        description: this.uploadDescription || undefined,
      }));
    }
    this.snackBar.open(`Uploading ${files.length} file(s)...`, 'OK', { duration: 2000 });
  }

  deleteDoc(id: string): void {
    this.store.dispatch(DocumentsActions.deleteDocument({ id }));
    this.snackBar.open('Document deleted', 'OK', { duration: 2000 });
  }

  viewVersions(doc: WfDocument): void {
    this.store.dispatch(DocumentsActions.loadVersions({ id: doc.id }));
    this.snackBar.open(`Loading versions for ${doc.filename}`, 'OK', { duration: 2000 });
  }

  getFileIcon(contentType: string): string {
    if (!contentType) return 'insert_drive_file';
    if (contentType.includes('pdf')) return 'picture_as_pdf';
    if (contentType.includes('image')) return 'image';
    if (contentType.includes('spreadsheet') || contentType.includes('excel')) return 'table_chart';
    if (contentType.includes('word') || contentType.includes('document')) return 'description';
    return 'insert_drive_file';
  }

  getFileIconBg(contentType: string): string {
    if (!contentType) return 'bg-[#EAF4FB]';
    if (contentType.includes('pdf')) return 'bg-red-50';
    if (contentType.includes('image')) return 'bg-purple-50';
    if (contentType.includes('spreadsheet') || contentType.includes('excel')) return 'bg-green-50';
    return 'bg-[#EAF4FB]';
  }

  getFileIconColor(contentType: string): string {
    if (!contentType) return 'text-[#056DAE]';
    if (contentType.includes('pdf')) return 'text-red-500';
    if (contentType.includes('image')) return 'text-purple-500';
    if (contentType.includes('spreadsheet') || contentType.includes('excel')) return 'text-green-500';
    return 'text-[#056DAE]';
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  getRelativeTime(date: string): string {
    const now = new Date();
    const d = new Date(date);
    const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }

  // ─── Preview & Download ─────────────────────────
  previewDoc(doc: WfDocument): void {
    this.previewDocument.set(doc);
  }

  closePreview(): void {
    this.previewDocument.set(null);
  }

  isPreviewableImage(contentType: string): boolean {
    return contentType.startsWith('image/');
  }

  getPreviewUrl(doc: WfDocument): string {
    return `${this.apiUrl}/api/documents/${doc.id}/download`;
  }

  downloadDoc(doc: WfDocument): void {
    const url = this.getPreviewUrl(doc);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.filename;
    a.click();
  }
}
