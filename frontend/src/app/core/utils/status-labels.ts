const STATUS_LABELS: Record<string, string> = {
  // Case statuses
  open: 'Open',
  in_progress: 'In Progress',
  pending: 'Pending',
  resolved_completed: 'Resolved',
  resolved_cancelled: 'Cancelled',
  resolved_rejected: 'Rejected',
  withdrawn: 'Withdrawn',

  // Step / Item statuses
  completed: 'Completed',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
  waiting: 'Waiting',

  // Assignment statuses
  on_hold: 'On Hold',

  // Approval statuses
  approved: 'Approved',
  rejected: 'Rejected',
  delegated: 'Delegated',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
