import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { CaseTypeDefinition, StepDefinition } from '@core/models';
import { DataService } from '@core/services/data.service';
import { IntakeFormComponent } from './shared/intake-form.component';
import * as CasesActions from '@state/cases/cases.actions';
import {
  selectCaseTypeDefinitions,
  selectCasesLoading,
  selectCasesError,
  selectSelectedCaseInstance,
} from '@state/cases/cases.selectors';

@Component({
  selector: 'app-portal-case-intake',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    IntakeFormComponent,
  ],
  template: `
    <div class="-m-5 min-h-[calc(100vh-108px)] bg-gradient-to-b from-slate-50 to-white">

      <!-- ── Confirmation Screen ── -->
      @if (submitted()) {
        <div class="max-w-lg mx-auto px-4 py-20 text-center">
          <div class="w-20 h-20 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-6 shadow-sm">
            <mat-icon class="!text-5xl text-emerald-600">check_circle</mat-icon>
          </div>
          <h1 class="text-2xl font-bold text-slate-800 mb-2">Case Created Successfully</h1>
          <p class="text-sm text-slate-500 mb-8">Your submission has been received and assigned to the processing queue.</p>

          <div class="inline-block px-8 py-5 bg-white border border-slate-200 rounded-2xl shadow-sm mb-8">
            <p class="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Case Number</p>
            <p class="text-3xl font-bold text-primary-600 tracking-wide">{{ submittedCaseId() }}</p>
          </div>

          @if (caseType) {
            <div class="mb-8 p-4 bg-white border border-slate-100 rounded-xl text-left text-sm text-slate-600 space-y-2 shadow-sm">
              <div class="flex items-center gap-2 mb-2">
                <mat-icon class="text-primary-400 !text-lg">{{ caseType.icon || 'folder' }}</mat-icon>
                <span class="font-semibold text-slate-700">{{ caseType.name }}</span>
              </div>
              <p class="text-xs text-slate-500 leading-relaxed">{{ caseType.description }}</p>
              <div class="pt-2 border-t border-slate-100 flex gap-4 text-xs text-slate-400">
                <span>{{ caseType.stages.length }} stages</span>
                <span>Submitted {{ currentTime() | date:'shortTime' }}</span>
              </div>
            </div>
          }

          <div class="flex justify-center gap-3">
            <button mat-stroked-button (click)="startOver()">
              <mat-icon class="!text-base mr-1">add</mat-icon> Submit Another
            </button>
            <button mat-raised-button color="primary" routerLink="/portal/cases">
              <mat-icon class="!text-base mr-1">list</mat-icon> Back to Cases
            </button>
          </div>
        </div>

      } @else {

        <!-- ── Top Bar ── -->
        <div class="bg-white border-b border-slate-200 sticky -top-5 z-10 shadow-sm">
          <div class="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
            <button mat-icon-button routerLink="/portal/cases/new" class="shrink-0">
              <mat-icon>arrow_back</mat-icon>
            </button>
            <div class="flex-1 min-w-0">
              @if (caseType) {
                <div class="flex items-center gap-2">
                  <div class="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                    <mat-icon class="text-primary-500 !text-lg">{{ caseType.icon || 'folder' }}</mat-icon>
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <h1 class="text-sm font-bold text-slate-800 truncate">{{ caseType.name }}</h1>
                      <span class="shrink-0 text-[9px] px-2 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full font-semibold">INTAKE</span>
                    </div>
                    @if (caseType.description) {
                      <p class="text-[11px] text-slate-400 mt-0.5 truncate">{{ caseType.description }}</p>
                    }
                  </div>
                </div>
              } @else {
                <div class="h-5 w-40 bg-slate-100 rounded animate-pulse"></div>
              }
            </div>
          </div>
        </div>

        <!-- ── Body ── -->
        <div class="max-w-3xl mx-auto px-6 py-8">

          @if (loadingType()) {
            <div class="flex flex-col items-center justify-center py-24">
              <mat-spinner diameter="36"></mat-spinner>
              <span class="mt-4 text-sm text-slate-500">Loading intake form...</span>
            </div>

          } @else if (!caseType) {
            <div class="text-center py-20">
              <mat-icon class="!text-5xl text-slate-300">search_off</mat-icon>
              <p class="mt-3 text-slate-500">Case type not found.</p>
              <button mat-stroked-button routerLink="/portal/cases/new" class="mt-4">Go Back</button>
            </div>

          } @else {
            <mat-card class="!rounded-2xl !shadow-sm border border-slate-100">
              <mat-card-content class="!p-8">

                <!-- Error -->
                @if (error$ | async; as error) {
                  <div class="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                    <mat-icon class="!text-base text-red-500">error_outline</mat-icon>
                    {{ error }}
                  </div>
                }

                <app-intake-form
                  [steps]="intakeSteps"
                  [stepFieldsMap]="stepFieldsMap"
                  [form]="intakeForm"
                  [stageName]="getIntakeStageName()"
                  [loading]="intakeLoading()">
                </app-intake-form>

                <!-- Actions -->
                <div class="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
                  <button mat-button routerLink="/portal/cases/new" class="text-slate-500">
                    <mat-icon class="!text-base mr-1">arrow_back</mat-icon>
                    Cancel
                  </button>
                  <button mat-raised-button color="primary"
                          (click)="submit()"
                          class="!px-6 !py-1"
                          [disabled]="intakeForm.invalid || intakeSteps.length === 0 || (isLoading$ | async) || intakeLoading()">
                    @if (isLoading$ | async) {
                      <ng-container>
                        <mat-spinner diameter="16" class="inline-block mr-2"></mat-spinner>
                        Submitting...
                      </ng-container>
                    } @else {
                      <ng-container>
                        <mat-icon class="!text-base mr-1">send</mat-icon>
                        Submit Intake
                      </ng-container>
                    }
                  </button>
                </div>

              </mat-card-content>
            </mat-card>

            <!-- Info footer -->
            <p class="text-center text-[11px] text-slate-400 mt-5">
              Your submission will be routed to the processing queue. A case number will be assigned immediately.
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class PortalCaseIntakeComponent implements OnInit {
  caseType: CaseTypeDefinition | null = null;
  intakeSteps: StepDefinition[] = [];
  stepFieldsMap: Record<string, any[]> = {};
  intakeForm: FormGroup;

  loadingType = signal(true);
  intakeLoading = signal(false);
  submitted = signal(false);
  submittedCaseId = signal('');
  currentTime = signal(new Date());

  isLoading$: Observable<boolean> = this.store.select(selectCasesLoading);
  error$: Observable<string | null> = this.store.select(selectCasesError);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private store: Store,
    private fb: FormBuilder,
    private dataService: DataService,
  ) {
    this.intakeForm = this.fb.group({});
  }

  ngOnInit(): void {
    const caseTypeId = this.route.snapshot.paramMap.get('caseTypeId');
    if (!caseTypeId) {
      this.router.navigate(['/portal/cases/new']);
      return;
    }

    this.store.dispatch(CasesActions.loadCaseTypeDefinitions());
    this.store.select(selectCaseTypeDefinitions)
      .pipe(filter(types => types.length > 0), take(1))
      .subscribe(types => {
        const ct = types.find(t => t.id === caseTypeId);
        if (!ct || !ct.intakeEnabled) {
          this.router.navigate(['/portal/cases/new']);
          return;
        }
        this.caseType = ct;
        this.loadingType.set(false);
        this.buildIntakeForm(ct);
      });
  }

  getIntakeStageName(): string {
    if (!this.caseType) return 'Intake';
    const primaries = this.caseType.stages
      .filter(s => s.stageType === 'primary')
      .sort((a, b) => a.order - b.order);
    return primaries[0]?.name || 'Intake';
  }

  private buildIntakeForm(ct: CaseTypeDefinition): void {
    const stage1 = ct.stages
      .filter(s => s.stageType === 'primary')
      .sort((a, b) => a.order - b.order)[0];

    if (!stage1) {
      this.intakeSteps = [];
      this.stepFieldsMap = {};
      return;
    }

    const candidates: StepDefinition[] = [];
    for (const proc of stage1.processes) {
      for (const step of proc.steps) {
        if (step.type === 'assignment') {
          const inlineFields: any[] = step.config?.['formFields'] || [];
          const formId: string | undefined = step.config?.['formId'];
          if (inlineFields.length > 0 || formId) {
            candidates.push(step);
          }
        }
      }
    }

    if (candidates.length === 0) {
      this.intakeSteps = [];
      this.stepFieldsMap = {};
      return;
    }

    this.intakeLoading.set(true);

    const resolveAll = candidates.map(step => {
      const inlineFields: any[] = step.config?.['formFields'] || [];
      if (inlineFields.length > 0) {
        return Promise.resolve({ step, fields: inlineFields });
      }
      const formId: string = step.config?.['formId'] || '';
      return new Promise<{ step: StepDefinition; fields: any[] }>(resolve => {
        this.dataService.getFormDefinitionById(formId).pipe(take(1)).subscribe({
          next: (form) => resolve({ step, fields: form.fields || [] }),
          error: () => resolve({ step, fields: [] }),
        });
      });
    });

    Promise.all(resolveAll).then(results => {
      this.stepFieldsMap = {};
      this.intakeSteps = [];
      for (const { step, fields } of results) {
        if (fields.length > 0) {
          this.stepFieldsMap[step.id] = fields;
          this.intakeSteps.push(step);
        }
      }
      this.rebuildFormControls();
      this.intakeLoading.set(false);
    });
  }

  private rebuildFormControls(): void {
    const controls: Record<string, FormControl> = {};
    for (const step of this.intakeSteps) {
      const fields = this.stepFieldsMap[step.id] || [];
      for (const field of fields) {
        const key = step.id + '__' + (field.label || '').replace(/\s+/g, '_').toLowerCase();
        const validators: any[] = [];
        if (field.validation?.required) validators.push(Validators.required);
        if (field.validation?.minLength) validators.push(Validators.minLength(field.validation.minLength));
        if (field.validation?.maxLength) validators.push(Validators.maxLength(field.validation.maxLength));
        if (field.type === 'email') validators.push(Validators.email);
        const defaultVal = field.type === 'boolean' || field.type === 'checkbox' ? false : (field.defaultValue ?? '');
        controls[key] = new FormControl(defaultVal, validators);
      }
    }
    this.intakeForm = this.fb.group(controls);
  }

  submit(): void {
    if (this.intakeForm.invalid || !this.caseType) return;

    const intakeFormData: Record<string, any> = {};
    for (const step of this.intakeSteps) {
      const stepData: Record<string, any> = {};
      const fields = this.stepFieldsMap[step.id] || [];
      for (const field of fields) {
        const key = step.id + '__' + (field.label || '').replace(/\s+/g, '_').toLowerCase();
        stepData[field.label] = this.intakeForm.get(key)?.value;
      }
      intakeFormData[step.id] = stepData;
    }

    this.store.dispatch(
      CasesActions.createCaseInstance({
        request: {
          caseTypeId: this.caseType.id,
          intakeFormData,
        },
      })
    );

    this.store
      .select(selectSelectedCaseInstance)
      .pipe(filter(inst => inst !== null), take(1))
      .subscribe(inst => {
        if (inst) {
          this.currentTime.set(new Date());
          this.submittedCaseId.set(inst.id);
          this.submitted.set(true);
        }
      });
  }

  startOver(): void {
    this.router.navigate(['/portal/cases/new']);
  }
}
