import { Component, Input, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { DataService } from '../../core/services/data.service';
import { Comment, Mention } from '../../core/models';

@Component({
  selector: 'app-comments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatDividerModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  template: `
    <div class="comments-container space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-800">Comments ({{ comments.length }})</h3>
        <button mat-icon-button (click)="toggleCommentForm()">
          <mat-icon>{{ showCommentForm ? 'close' : 'add' }}</mat-icon>
        </button>
      </div>

      <!-- Add Comment Form -->
      @if (showCommentForm) {
        <div class="bg-blue-50 rounded-lg p-4 space-y-3">
          <form [formGroup]="commentForm" (ngSubmit)="onAddComment()">
            <mat-form-field class="w-full">
              <mat-label>Add a comment...</mat-label>
              <textarea
                matInput
                formControlName="text"
                rows="3"
                placeholder="Type @mention to notify team members"
                [matAutocomplete]="mentionAuto"
              ></textarea>
              <mat-icon matIconSuffix>comment</mat-icon>
            </mat-form-field>

            <!-- Mention Autocomplete -->
            <mat-autocomplete #mentionAuto="matAutocomplete" [displayWith]="displayMentionFn">
              @for (user of filteredMembers; track user.id) {
                <mat-option (onSelectionChange)="insertMention(user)">
                  <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs">
                      {{ user.name.charAt(0) }}
                    </div>
                    <span>{{ user.name }}</span> 
                  </div>
                </mat-option>
              }
            </mat-autocomplete>

            <!-- Form Actions -->
            <div class="flex gap-2 justify-end pt-2">
              <button mat-stroked-button type="button" (click)="toggleCommentForm()">
                Cancel
              </button>
              <button mat-raised-button color="primary" type="submit" [disabled]="!commentForm.valid">
                <mat-icon>send</mat-icon>
                Post Comment
              </button>
            </div>
          </form>
        </div>
      }

      <!-- Comments List -->
      <div class="space-y-4">
        @if (comments.length > 0) {
          @for (comment of comments; track comment.id) {
            <div class="border-l-2 border-gray-300 pl-4 pb-4">
              <!-- Comment Header -->
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <!-- Avatar -->
                  <div class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold text-sm">
                    {{ comment.author.name.charAt(0) }}
                  </div>
                  <!-- Author & Time -->
                  <div>
                    <p class="font-semibold text-sm text-gray-800">{{ comment.author.name }}</p>
                    <p class="text-xs text-gray-600" [title]="comment.createdAt | date: 'medium'">
                      {{ getRelativeTime(comment.createdAt) }}
                    </p>
                  </div>
                </div>

                <!-- Comment Actions -->
                <div class="flex gap-1">
                  @if (canEditComment(comment)) {
                    <button mat-icon-button matTooltip="Edit" (click)="editComment(comment)" size="small">
                      <mat-icon class="text-sm">edit</mat-icon>
                    </button>
                  }
                  @if (canDeleteComment(comment)) {
                    <button mat-icon-button matTooltip="Delete" (click)="deleteComment(comment)" size="small">
                      <mat-icon class="text-sm">delete</mat-icon>
                    </button>
                  }
                </div>
              </div>

              <!-- Comment Body -->
              @if (editingCommentId === comment.id) {
                <form [formGroup]="editCommentForm" (ngSubmit)="onSaveEditedComment(comment)" class="space-y-2 mb-2">
                  <mat-form-field class="w-full">
                    <textarea matInput formControlName="text" rows="3"></textarea>
                  </mat-form-field>
                  <div class="flex gap-2 justify-end">
                    <button mat-stroked-button type="button" (click)="cancelEditComment()">Cancel</button>
                    <button mat-raised-button color="primary" type="submit">Save</button>
                  </div>
                </form>
              } @else {
                <p class="text-sm text-gray-700 mb-2 leading-relaxed">
                  {{ renderedCommentText(comment.text) }}
                </p>
              }

              <!-- Mentions -->
              @if (comment.mentions && comment.mentions.length > 0) {
                <div class="flex flex-wrap gap-1 mb-2">
                  @for (mention of comment.mentions; track mention.id) {
                    <mat-chip>
                      <mat-icon matChipAvatar class="text-xs">person</mat-icon>
                      {{ mention.user.name }}
                    </mat-chip>
                  }
                </div>
              }

              <!-- Reactions & Replies -->
              <div class="flex gap-4 text-xs text-gray-600">
                <button class="hover:text-blue-600 flex items-center gap-1">
                  <mat-icon class="text-sm">favorite_border</mat-icon>
                  <span>Reaction</span>
                </button>
                <button class="hover:text-blue-600 flex items-center gap-1" (click)="toggleReplyForm(comment.id)">
                  <mat-icon class="text-sm">reply</mat-icon>
                  <span>Reply</span>
                </button>
              </div>

              <!-- Replies -->
              @if (comment.replies && comment.replies.length > 0) {
                <div class="mt-3 space-y-2 bg-gray-50 rounded p-3">
                  @for (reply of comment.replies; track reply.id) {
                    <div class="border-l border-gray-200 pl-3">
                      <div class="flex items-center gap-2 mb-1">
                        <div class="w-6 h-6 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-bold">
                          {{ reply.author.name.charAt(0) }}
                        </div>
                        <span class="text-xs font-semibold">{{ reply.author.name }}</span>
                        <span class="text-xs text-gray-600">{{ getRelativeTime(reply.createdAt) }}</span>
                      </div>
                      <p class="text-xs text-gray-700">{{ reply.text }}</p>
                    </div>
                  }
                </div>
              }

              <!-- Reply Form -->
              @if (replyingToCommentId === comment.id) {
                <form [formGroup]="replyForm" (ngSubmit)="onAddReply(comment)" class="mt-3 space-y-2">
                  <mat-form-field class="w-full">
                    <mat-label>Reply...</mat-label>
                    <textarea matInput formControlName="text" rows="2"></textarea>
                  </mat-form-field>
                  <div class="flex gap-2 justify-end">
                    <button mat-stroked-button type="button" (click)="toggleReplyForm('')">Cancel</button>
                    <button mat-raised-button color="primary" type="submit" [disabled]="!replyForm.valid">
                      Reply
                    </button>
                  </div>
                </form>
              }
            </div>
          }
        } @else {
          <div class="text-center py-8">
            <mat-icon class="text-gray-300 text-4xl">comment</mat-icon>
            <p class="text-gray-500 mt-2">No comments yet. Be the first to comment!</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .comments-container {
      max-width: 800px;
    }

    mat-chip-avatar {
      margin-right: 8px;
    }

    .text-xs {
      font-size: 0.75rem;
    }

    .text-sm {
      font-size: 0.875rem;
    }
  `],
})
export class CommentsComponent implements OnInit {
  @Input() contextId: string = ''; // Case ID or Task ID
  @Input() contextType: 'case' | 'task' = 'case';
  @ViewChild('commentInput') commentInput!: ElementRef;

  comments: Comment[] = [];
  commentForm: FormGroup;
  editCommentForm: FormGroup;
  replyForm: FormGroup;
  showCommentForm = false;
  editingCommentId: string | null = null;
  replyingToCommentId: string | null = null;
  filteredMembers: any[] = [];

  private availableMembers = [
    { id: 'user-1', name: 'Alice Johnson' },
    { id: 'user-2', name: 'Bob Smith' },
    { id: 'user-3', name: 'Carol White' },
    { id: 'user-4', name: 'Dave Brown' },
  ];

  constructor(
    private formBuilder: FormBuilder,
    private dataService: DataService,
    private store: Store
  ) {
    this.commentForm = this.formBuilder.group({
      text: ['', [Validators.required, Validators.minLength(1)]],
    });

    this.editCommentForm = this.formBuilder.group({
      text: ['', [Validators.required, Validators.minLength(1)]],
    });

    this.replyForm = this.formBuilder.group({
      text: ['', [Validators.required, Validators.minLength(1)]],
    });
  }

  ngOnInit(): void {
    this.loadComments();
    this.filteredMembers = this.availableMembers;
  }

  loadComments(): void {
    // In a real app, this would fetch comments from the backend
    // For now, using mock data
    this.dataService.getComments().subscribe(comments => {
      this.comments = comments;
    });
  }

  toggleCommentForm(): void {
    this.showCommentForm = !this.showCommentForm;
    if (this.showCommentForm) {
      setTimeout(() => this.commentInput.nativeElement.focus(), 100);
    }
  }

  onAddComment(): void {
    if (!this.commentForm.valid) return;

    const commentText = this.commentForm.get('text')?.value;
    const mentions = this.extractMentions(commentText);

    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      contextId: this.contextId,
      contextType: this.contextType,
      text: commentText,
      author: {
        id: 'user-1',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        role: 'MANAGER',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      mentions: mentions,
      replies: [],
    };

    this.comments.unshift(newComment);
    this.commentForm.reset();
    this.showCommentForm = false;

    // Dispatch action to store
    // this.store.dispatch(TasksActions.addComment({ comment: newComment }));
  }

  onAddReply(parentComment: Comment): void {
    if (!this.replyForm.valid) return;

    const replyText = this.replyForm.get('text')?.value;

    const reply: Comment = {
      id: `reply-${Date.now()}`,
      contextId: this.contextId,
      contextType: this.contextType,
      text: replyText,
      author: {
        id: 'user-1',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        role: 'MANAGER',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      mentions: [],
      replies: [],
    };

    if (!parentComment.replies) {
      parentComment.replies = [];
    }
    parentComment.replies.push(reply);
    this.replyForm.reset();
    this.replyingToCommentId = null;
  }

  editComment(comment: Comment): void {
    this.editingCommentId = comment.id;
    this.editCommentForm.patchValue({ text: comment.text });
  }

  onSaveEditedComment(comment: Comment): void {
    if (!this.editCommentForm.valid) return;

    comment.text = this.editCommentForm.get('text')?.value;
    comment.updatedAt = new Date();
    this.editingCommentId = null;
  }

  cancelEditComment(): void {
    this.editingCommentId = null;
    this.editCommentForm.reset();
  }

  deleteComment(comment: Comment): void {
    if (confirm('Are you sure you want to delete this comment?')) {
      this.comments = this.comments.filter(c => c.id !== comment.id);
    }
  }

  toggleReplyForm(commentId: string): void {
    if (this.replyingToCommentId === commentId) {
      this.replyingToCommentId = null;
      this.replyForm.reset();
    } else {
      this.replyingToCommentId = commentId;
    }
  }

  insertMention(user: any): void {
    const currentText = this.commentForm.get('text')?.value || '';
    const mentionText = `@${user.name} `;
    this.commentForm.patchValue({ text: currentText + mentionText });
  }

  displayMentionFn(): string {
    return '';
  }

  extractMentions(text: string): Mention[] {
    const mentionRegex = /@(\w+)/g;
    const mentions: Mention[] = [];
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionedName = match[1];
      const user = this.availableMembers.find(u =>
        u.name.toLowerCase().includes(mentionedName.toLowerCase())
      );

      if (user) {
        mentions.push({
          id: user.id,
          user: user,
          position: match.index,
        });
      }
    }

    return mentions;
  }

  renderedCommentText(text: string): string {
    return text.replace(/@(\w+)/g, '<strong>@$1</strong>');
  }

  canEditComment(comment: Comment): boolean {
    // User can edit their own comments
    return comment.author.id === 'user-1';
  }

  canDeleteComment(comment: Comment): boolean {
    // User can delete their own comments or admins can delete any
    return comment.author.id === 'user-1';
  }

  getRelativeTime(date: Date): string {
    const now = new Date();
    const commentDate = new Date(date);
    const seconds = Math.floor((now.getTime() - commentDate.getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;

    return commentDate.toLocaleDateString();
  }
}
