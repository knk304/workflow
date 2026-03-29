import { Injectable } from '@angular/core';

export type SummarySectionId = 'overview' | 'stages' | 'approvals' | 'data' | 'participants' | 'comments';

export interface SummarySectionConfig {
  id: SummarySectionId;
  label: string;
  visible: boolean;
  order: number;
}

export interface OutcomeReportLayout {
  /** Optional custom title shown in the summary header */
  headerTitle?: string;
  /** Sections to render — order and visibility are configurable */
  sections: SummarySectionConfig[];
  /** Case data keys to highlight prominently at the top of the Data section */
  highlightFields?: string[];
  /** Case data keys to hide from the Data section */
  hideFields?: string[];
}

const DEFAULT_SECTIONS: SummarySectionConfig[] = [
  { id: 'overview',      label: 'Overview',          visible: true, order: 0 },
  { id: 'data',          label: 'Data Fields',        visible: true, order: 1 },
  { id: 'approvals',     label: 'Approval Trail',     visible: true, order: 2 },
  { id: 'stages',        label: 'Stage Timeline',     visible: true, order: 3 },
  { id: 'comments',      label: 'Comments History',   visible: true, order: 4 },
  { id: 'participants',  label: 'Participants',        visible: true, order: 5 },
];

/**
 * Service that provides customizable summary layouts per case type.
 *
 * Usage — register a custom layout at app startup or in a feature module:
 *
 * ```ts
 * constructor(private summaryLayout: OutcomeReportLayoutService) {
 *   summaryLayout.registerLayout('onboarding', {
 *     headerTitle: 'Employee Onboarding Summary',
 *     highlightFields: ['department', 'start_date'],
 *     hideFields: ['internal_notes'],
 *     sections: [
 *       { id: 'overview',      label: 'Onboarding Overview', visible: true,  order: 0 },
 *       { id: 'stages',        label: 'Onboarding Stages',   visible: true,  order: 1 },
 *       { id: 'approvals',     label: 'Approval Chain',      visible: true,  order: 2 },
 *       { id: 'participants',  label: 'Team Members',         visible: true,  order: 3 },
 *       { id: 'data',          label: 'Employee Details',     visible: true,  order: 4 },
 *       { id: 'comments',      label: 'Notes & Comments',     visible: false, order: 5 },
 *     ],
 *   });
 * }
 * ```
 */
@Injectable({ providedIn: 'root' })
export class OutcomeReportLayoutService {
  private layouts = new Map<string, OutcomeReportLayout>();

  /** Register a custom layout for a specific case type ID or slug */
  registerLayout(caseTypeId: string, layout: OutcomeReportLayout): void {
    this.layouts.set(caseTypeId, layout);
  }

  /** Remove a previously registered layout */
  removeLayout(caseTypeId: string): void {
    this.layouts.delete(caseTypeId);
  }

  /** Get the full layout config for a case type (falls back to default) */
  getLayout(caseTypeId: string): OutcomeReportLayout {
    return this.layouts.get(caseTypeId) || this.defaultLayout();
  }

  /** Get only visible sections, sorted by order */
  getVisibleSections(caseTypeId: string): SummarySectionConfig[] {
    const layout = this.getLayout(caseTypeId);
    return layout.sections
      .filter(s => s.visible)
      .sort((a, b) => a.order - b.order);
  }

  private defaultLayout(): OutcomeReportLayout {
    return { sections: [...DEFAULT_SECTIONS] };
  }
}
