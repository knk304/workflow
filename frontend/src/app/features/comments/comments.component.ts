import { Component, Input, OnInit, OnChanges, OnDestroy, SimpleChanges, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Comment, Mention, User } from '../../core/models';
import * as CommentsActions from '../../state/comments/comments.actions';
import { selectComments, selectCommentsLoading } from '../../state/comments/comments.selectors';
import { selectUser } from '../../state/auth/auth.selectors';
import { WebSocketService } from '../../core/services/websocket.service';

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
    MatDividerModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="comments-container space-y-4">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-gray-800">
          Comments ({{ (comments$ | async)?.length || 0 }})
        </h3>
        <button mat-icon-button (click)="toggleCommentForm()">
          <mat-icon>{{ showCommentForm ? 'close' : 'add' }}</mat-icon>
        </button>
      </div>

      <!-- Loading -->
      @if (isLoading$ | async) {
        <div class="flex justify-center py-4">
          <mat-spinner diameter="32"></mat-spinner>
        </div>
      }

      <!-- Add Comment Form -->
      @if (showCommentForm) {
        <div class="bg-[#EAF4FB] rounded-lg p-4 space-y-3">
          <form [formGroup]="commentForm" (ngSubmit)="onAddComment()">
            <mat-form-field class="w-full">
              <mat-label>Add a comment...</mat-label>
              <textarea
                matInput
                formControlName="text"
                rows="3"
                placeholder="Type your comment here..."
              ></textarea>
              <mat-icon matIconSuffix>comment</mat-icon>
            </mat-form-field>

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
        @if ((comments$ | async); as comments) {
          @if (comments.length > 0) {
            @for (comment of comments; track comment.id) {
              <div class="border-l-2 border-gray-300 pl-4 pb-4">
                <!-- Comment Header -->
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-[#056DAE] text-white flex items-center justify-center font-bold text-sm">
                      {{ comment.userAvatar || comment.userName.charAt(0) }}
                    </div>
                    <div>
                      <p class="font-semibold text-sm text-gray-800">{{ comment.userName }}</p>
                      <p class="text-xs text-gray-600" [title]="comment.createdAt">
                        {{ getRelativeTime(comment.createdAt) }}
                      </p>
                    </div>
                  </div>

                  <div class="flex gap-1">
                    @if (canEditComment(comment)) {
                      <button mat-icon-button matTooltip="Edit" (click)="editComment(comment)">
                        <mat-icon class="text-sm">edit</mat-icon>
                      </button>
                    }
                  </div>
                </div>

                <!-- Comment Body -->
                @if (editingCommentId === comment.id) {
                  <form [formGroup]="editCommentForm" (ngSubmit)="cancelEditComment()" class="space-y-2 mb-2">
                    <mat-form-field class="w-full">
                      <textarea matInput formControlName="text" rows="3"></textarea>
                    </mat-form-field>
                    <div class="flex gap-2 justify-end">
                      <button mat-stroked-button type="button" (click)="cancelEditComment()">Cancel</button>
                      <button mat-raised-button color="primary" type="submit">Save</button>
                    </div>
                  </form>
                } @else {
                  <p class="text-sm text-gray-700 mb-2 leading-relaxed">{{ comment.text }}</p>
                }

                <!-- Mentions -->
                @if (comment.mentions && comment.mentions.length > 0) {
                  <div class="flex flex-wrap gap-1 mb-2">
                    @for (mention of comment.mentions; track mention.userId) {
                      <mat-chip>
                        <mat-icon matChipAvatar class="text-xs">person</mat-icon>
                        {{ mention.userName }}
                      </mat-chip>
                    }
                  </div>
                }

                <!-- Reply button -->
                <div class="flex gap-4 text-xs text-gray-600">
                  <button class="hover:text-[#056DAE] flex items-center gap-1" (click)="toggleReplyForm(comment.id)">
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
                            {{ reply.userAvatar || reply.userName.charAt(0) }}
                          </div>
                          <span class="text-xs font-semibold">{{ reply.userName }}</span>
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
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .comments-container { max-width: 800px; }
  `],
})
export class CommentsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() caseId: string = '';
  @Input() taskId: string = '';

  comments$: Observable<Comment[]>;
  isLoading$: Observable<boolean>;
  currentUser: User | null = null;
  private destroy$ = new Subject<void>();

  commentForm: FormGroup;
  editCommentForm: FormGroup;
  replyForm: FormGroup;
  showCommentForm = false;
  editingCommentId: string | null = null;
  replyingToCommentId: string | null = null;

  constructor(
    private formBuilder: FormBuilder,
    private store: Store,
    private wsService: WebSocketService,
  ) {
    this.comments$ = this.store.select(selectComments);
    this.isLoading$ = this.store.select(selectCommentsLoading);

    this.commentForm = this.formBuilder.group({
      text: ['', [Validators.required, Validators.minLength(1)]],
    });
    this.editCommentForm = this.formBuilder.group({
      text: ['', [Validators.required, Validators.minLength(1)]],
    });
    this.replyForm = this.formBuilder.group({
      text: ['', [Validators.required, Validators.minLength(1)]],
    });

    // Listen for live comment updates via WebSocket
    effect(() => {
      const msg = this.wsService.lastMessage();
      if (msg?.type === 'comment_added' && this.caseId) {
        this.loadComments();
      }
    });
  }

  ngOnInit(): void {
    this.store.select(selectUser).pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.currentUser = user;
    });
    this.loadComments();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['caseId'] || changes['taskId']) {
      this.loadComments();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadComments(): void {
    if (this.caseId || this.taskId) {
      this.store.dispatch(
        CommentsActions.loadComments({
          caseId: this.caseId || undefined,
          taskId: this.taskId || undefined,
        })
      );
    }
  }

  toggleCommentForm(): void {
    this.showCommentForm = !this.showCommentForm;
  }

  onAddComment(): void {
    if (!this.commentForm.valid || !this.currentUser) return;

    const commentText = this.commentForm.get('text')?.value;
    const mentions = this.extractMentions(commentText);

    this.store.dispatch(
      CommentsActions.addComment({
        comment: {
          caseId: this.caseId || undefined,
          taskId: this.taskId || undefined,
          userId: this.currentUser.id,
          userName: this.currentUser.name,
          userAvatar: this.currentUser.avatar,
          text: commentText,
          mentions,
        },
      })
    );

    // Broadcast comment via WebSocket for real-time updates
    this.wsService.send({
      type: 'comment_added',
      data: { text: commentText, userName: this.currentUser.name },
    });

    this.commentForm.reset();
    this.showCommentForm = false;
  }

  onAddReply(parentComment: Comment): void {
    if (!this.replyForm.valid || !this.currentUser) return;

    const replyText = this.replyForm.get('text')?.value;

    this.store.dispatch(
      CommentsActions.addComment({
        comment: {
          caseId: this.caseId || undefined,
          taskId: this.taskId || undefined,
          parentId: parentComment.id,
          userId: this.currentUser.id,
          userName: this.currentUser.name,
          userAvatar: this.currentUser.avatar,
          text: replyText,
          mentions: [],
        },
      })
    );

    this.replyForm.reset();
    this.replyingToCommentId = null;
  }

  editComment(comment: Comment): void {
    this.editingCommentId = comment.id;
    this.editCommentForm.patchValue({ text: comment.text });
  }

  cancelEditComment(): void {
    this.editingCommentId = null;
    this.editCommentForm.reset();
  }

  toggleReplyForm(commentId: string): void {
    if (this.replyingToCommentId === commentId) {
      this.replyingToCommentId = null;
      this.replyForm.reset();
    } else {
      this.replyingToCommentId = commentId;
    }
  }

  extractMentions(text: string): Mention[] {
    const mentionRegex = /@(\w+\s?\w*)/g;
    const mentions: Mention[] = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push({ userId: '', userName: match[1].trim() });
    }
    return mentions;
  }

  canEditComment(comment: Comment): boolean {
    return this.currentUser?.id === comment.userId;
  }

  getRelativeTime(dateStr: string): string {
    const now = new Date();
    const commentDate = new Date(dateStr);
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
