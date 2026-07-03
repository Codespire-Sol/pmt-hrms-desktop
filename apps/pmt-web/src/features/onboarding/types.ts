/**
 * Onboarding Types
 *
 * Type definitions for user onboarding flow.
 */

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  action?: OnboardingAction;
  illustration?: string;
  tips?: string[];
}

export type OnboardingAction =
  | 'welcome'
  | 'create_project'
  | 'invite_members'
  | 'create_issue'
  | 'explore_board'
  | 'explore_ai'
  | 'complete';

export interface OnboardingProgress {
  currentStep: number;
  completedSteps: string[];
  skipped: boolean;
  startedAt: string;
  completedAt?: string;
}

export interface OnboardingState {
  isActive: boolean;
  progress: OnboardingProgress;
  showTutorial: boolean;
}

export interface OnboardingTooltip {
  target: string;
  title: string;
  content: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  step?: number;
}

export interface FeatureHighlight {
  id: string;
  title: string;
  description: string;
  element: string;
  seen: boolean;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to codeSpire solutions',
    description:
      'AI-powered project management that helps your team work smarter, not harder.',
    action: 'welcome',
    tips: [
      'codeSpire solutions uses AI to help you write better issues',
      'Get smart suggestions for assignments and estimates',
      'Natural language search finds what you need fast',
    ],
  },
  {
    id: 'create-project',
    title: 'Create Your First Project',
    description:
      'Projects organize all your work. Create one to start tracking issues, sprints, and progress.',
    action: 'create_project',
    tips: [
      'Use a clear, descriptive project name',
      'Add a project key for quick issue references (e.g., PROJ-123)',
      'You can customize workflows later',
    ],
  },
  {
    id: 'invite-team',
    title: 'Invite Your Team',
    description:
      'Collaboration is better together. Invite teammates to join your project.',
    action: 'invite_members',
    tips: [
      'Assign roles to control permissions',
      'Team members get real-time notifications',
      '@mention teammates in comments',
    ],
  },
  {
    id: 'create-issue',
    title: 'Create Your First Issue',
    description:
      'Issues track individual pieces of work. Try creating one with natural language!',
    action: 'create_issue',
    tips: [
      'Type naturally and AI will structure your issue',
      'AI suggests priority and estimates automatically',
      'Link related issues to track dependencies',
    ],
  },
  {
    id: 'explore-board',
    title: 'Explore the Kanban Board',
    description:
      'Visualize your workflow with drag-and-drop boards. See progress at a glance.',
    action: 'explore_board',
    tips: [
      'Drag issues between columns to update status',
      'Filter by assignee, label, or priority',
      'Real-time updates keep everyone in sync',
    ],
  },
  {
    id: 'explore-ai',
    title: 'Discover AI Features',
    description:
      "Let AI help with suggestions, planning, and predictions. It's like having an extra team member.",
    action: 'explore_ai',
    tips: [
      'Ask questions in natural language',
      'Get sprint planning suggestions',
      'Identify risks before they become blockers',
    ],
  },
];
