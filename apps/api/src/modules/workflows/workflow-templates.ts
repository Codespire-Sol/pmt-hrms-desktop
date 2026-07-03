export interface WorkflowTemplateStatus {
  name: string;
  displayName: string;
  color: string;
  category: string;
  isInitial?: boolean;
  isFinal?: boolean;
}

export interface WorkflowTemplateTransition {
  from: string;
  to: string;
  name: string;
  /** System roles + project roles allowed. Omit for unrestricted (any user). */
  roleRestriction?: string[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  statuses: WorkflowTemplateStatus[];
  transitions: WorkflowTemplateTransition[];
}

const NON_TERMINAL_STATUSES_SD = [
  'backlog',
  'open',
  'in_progress',
  'dev_done',
  'qa',
  'release_pending',
  'rework',
];

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. Software Development (13-state, matches the hand-drawn schema)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'software_development',
    name: 'Software Development',
    description:
      'Full development lifecycle from backlog through QA and deployment. ' +
      'Includes Hold, Rejected, and Dependency as open side-transitions for any user.',
    statuses: [
      { name: 'backlog',         displayName: 'Backlog',         color: '#9CA3AF', category: 'todo',        isInitial: true },
      { name: 'open',            displayName: 'Open',            color: '#60A5FA', category: 'todo' },
      { name: 'in_progress',     displayName: 'In Progress',     color: '#F59E0B', category: 'in_progress' },
      { name: 'dev_done',        displayName: 'Dev Done',        color: '#10B981', category: 'in_progress' },
      { name: 'qa',              displayName: 'QA',              color: '#8B5CF6', category: 'in_review' },
      { name: 'release_pending', displayName: 'Release Pending', color: '#F97316', category: 'in_review' },
      { name: 'done_deployed',   displayName: 'Done / Deployed', color: '#22C55E', category: 'done',        isFinal: true },
      { name: 'rework',          displayName: 'Rework',          color: '#EF4444', category: 'in_progress' },
      { name: 'rejected',        displayName: 'Rejected',        color: '#DC2626', category: 'done',        isFinal: true },
      { name: 'hold',            displayName: 'On Hold',         color: '#6366F1', category: 'in_progress' },
      { name: 'dependency',      displayName: 'Dependency',      color: '#EC4899', category: 'in_progress' },
    ],
    transitions: [
      // Main flow
      { from: 'backlog',         to: 'open',             name: 'Start Planning' },
      {
        from: 'open', to: 'in_progress', name: 'Start Development',
        roleRestriction: ['admin', 'lead', 'member'],
      },
      {
        from: 'in_progress', to: 'dev_done', name: 'Mark Dev Done',
        roleRestriction: ['admin', 'lead', 'member'],
      },
      {
        from: 'dev_done', to: 'qa', name: 'Send to QA',
        roleRestriction: ['admin', 'lead', 'member'],
      },
      {
        from: 'qa', to: 'release_pending', name: 'Approve for Release',
        roleRestriction: ['admin', 'lead'],
      },
      {
        from: 'release_pending', to: 'done_deployed', name: 'Deploy',
        roleRestriction: ['admin', 'lead'],
      },
      // Rework loop
      {
        from: 'qa', to: 'rework', name: 'Send for Rework',
        roleRestriction: ['admin', 'lead', 'member'],
      },
      {
        from: 'rework', to: 'in_progress', name: 'Resume Development',
        roleRestriction: ['admin', 'lead', 'member'],
      },
      // HOLD — no role restriction, any project member can pause work
      ...NON_TERMINAL_STATUSES_SD.map((from) => ({
        from, to: 'hold', name: 'Put On Hold',
      })),
      // REJECTED — no role restriction, any project member can reject
      ...NON_TERMINAL_STATUSES_SD.map((from) => ({
        from, to: 'rejected', name: 'Reject',
      })),
      // DEPENDENCY — no role restriction, any project member can flag a dependency
      ...NON_TERMINAL_STATUSES_SD.map((from) => ({
        from, to: 'dependency', name: 'Mark as Dependency',
      })),
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Simple (3-stage)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'simple',
    name: 'Simple',
    description: 'Minimal 4-stage workflow — To Do → In Progress → In Review → Done. Good starting point for small projects.',
    statuses: [
      { name: 'todo',        displayName: 'To Do',       color: '#3B82F6', category: 'todo',        isInitial: true },
      { name: 'in_progress', displayName: 'In Progress', color: '#F59E0B', category: 'in_progress' },
      { name: 'in_review',   displayName: 'In Review',   color: '#8B5CF6', category: 'in_review' },
      { name: 'done',        displayName: 'Done',        color: '#22C55E', category: 'done',        isFinal: true },
    ],
    transitions: [
      { from: 'todo',        to: 'in_progress', name: 'Start' },
      { from: 'in_progress', to: 'in_review',   name: 'Submit for Review' },
      { from: 'in_review',   to: 'done',        name: 'Approve' },
      { from: 'in_review',   to: 'in_progress', name: 'Request Changes' },
      { from: 'in_progress', to: 'todo',        name: 'Re-open' },
      { from: 'done',        to: 'todo',        name: 'Reopen' },
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Bug Tracking
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'bug_tracking',
    name: 'Bug Tracking',
    description: "Lifecycle for bug reports: New → Confirmed → In Progress → Fixed → Verified. Includes Won't Fix.",
    statuses: [
      { name: 'new',         displayName: 'New',         color: '#EF4444', category: 'todo',        isInitial: true },
      { name: 'confirmed',   displayName: 'Confirmed',   color: '#F97316', category: 'todo' },
      { name: 'in_progress', displayName: 'In Progress', color: '#F59E0B', category: 'in_progress' },
      { name: 'fixed',       displayName: 'Fixed',       color: '#10B981', category: 'in_progress' },
      { name: 'verified',    displayName: 'Verified',    color: '#22C55E', category: 'done',        isFinal: true },
      { name: 'wont_fix',    displayName: "Won't Fix",   color: '#6B7280', category: 'done',        isFinal: true },
    ],
    transitions: [
      { from: 'new',         to: 'confirmed',   name: 'Confirm Bug' },
      { from: 'confirmed',   to: 'in_progress', name: 'Start Fix' },
      { from: 'in_progress', to: 'fixed',       name: 'Mark Fixed' },
      {
        from: 'fixed', to: 'verified', name: 'Verify Fix',
        roleRestriction: ['admin', 'lead'],
      },
      { from: 'fixed',       to: 'in_progress', name: 'Reopen — Not Fixed' },
      {
        from: 'new', to: 'wont_fix', name: "Won't Fix",
        roleRestriction: ['admin', 'lead'],
      },
      {
        from: 'confirmed', to: 'wont_fix', name: "Won't Fix",
        roleRestriction: ['admin', 'lead'],
      },
    ],
  },
];

/** Fast lookup by template id */
export function findTemplate(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}
