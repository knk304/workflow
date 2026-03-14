import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormRendererComponent } from './form-renderer.component';
import { FormDefinition } from '../../core/models';
import { DataService } from '../../core/services/data.service';
import { selectUser } from '../../state/auth/auth.selectors';

@Component({
  selector: 'app-form-renderer-page',
  standalone: true,
  imports: [CommonModule, MatProgressBarModule, FormRendererComponent],
  template: `
    <div class="p-6 max-w-3xl mx-auto">
      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      } @else if (formDef()) {
        <app-form-renderer
          [formDefinition]="formDef()!"
          [caseId]="caseId"
          [userRole]="userRole">
        </app-form-renderer>
      } @else {
        <p class="text-gray-500 text-center py-12">Form not found.</p>
      }
    </div>
  `,
})
export class FormRendererPageComponent implements OnInit {
  formDef = signal<FormDefinition | null>(null);
  loading = signal(true);
  caseId = '';
  userRole = '';

  constructor(
    private route: ActivatedRoute,
    private dataService: DataService,
    private store: Store,
  ) {}

  ngOnInit(): void {
    const formId = this.route.snapshot.paramMap.get('formId') || '';
    this.caseId = this.route.snapshot.queryParamMap.get('caseId') || '';

    this.store.select(selectUser).subscribe(user => {
      if (user) this.userRole = user.role;
    });

    this.dataService.getFormDefinitionById(formId).subscribe({
      next: def => {
        this.formDef.set(def);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
