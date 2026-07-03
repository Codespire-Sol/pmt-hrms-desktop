import { v4 as uuidv4 } from 'uuid';

// Test data factory for generating test fixtures

export const createTestUser = (overrides: Partial<TestUser> = {}): TestUser => ({
  id: uuidv4(),
  email: `test-${Date.now()}@example.com`,
  displayName: 'Test User',
  passwordHash: '$2b$10$test.hash.here',
  avatarUrl: null,
  isActive: true,
  isEmailVerified: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createTestProject = (overrides: Partial<TestProject> = {}): TestProject => ({
  id: uuidv4(),
  name: `Test Project ${Date.now()}`,
  key: `TP${Date.now().toString().slice(-4)}`,
  description: 'A test project',
  ownerId: uuidv4(),
  isArchived: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createTestIssue = (overrides: Partial<TestIssue> = {}): TestIssue => ({
  id: uuidv4(),
  projectId: uuidv4(),
  issueKey: `TEST-${Date.now().toString().slice(-4)}`,
  title: 'Test Issue',
  description: 'A test issue description',
  issueTypeId: uuidv4(),
  statusId: uuidv4(),
  priorityId: null,
  reporterId: uuidv4(),
  assigneeId: null,
  dueDate: null,
  storyPoints: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createTestSprint = (overrides: Partial<TestSprint> = {}): TestSprint => ({
  id: uuidv4(),
  projectId: uuidv4(),
  name: 'Sprint 1',
  goal: 'Complete sprint goals',
  startDate: null,
  endDate: null,
  status: 'planning',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createTestComment = (overrides: Partial<TestComment> = {}): TestComment => ({
  id: uuidv4(),
  issueId: uuidv4(),
  authorId: uuidv4(),
  content: 'Test comment content',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const createTestNotification = (overrides: Partial<TestNotification> = {}): TestNotification => ({
  id: uuidv4(),
  userId: uuidv4(),
  type: 'issue_assigned',
  title: 'Test Notification',
  message: 'Test notification message',
  actorId: null,
  issueId: null,
  commentId: null,
  projectId: null,
  metadata: {},
  isRead: false,
  readAt: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

// Type definitions
interface TestUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  avatarUrl: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TestProject {
  id: string;
  name: string;
  key: string;
  description: string | null;
  ownerId: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface TestIssue {
  id: string;
  projectId: string;
  issueKey: string;
  title: string;
  description: string | null;
  issueTypeId: string;
  statusId: string;
  priorityId: string | null;
  reporterId: string;
  assigneeId: string | null;
  dueDate: string | null;
  storyPoints: number | null;
  createdAt: string;
  updatedAt: string;
}

interface TestSprint {
  id: string;
  projectId: string;
  name: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  status: 'planning' | 'active' | 'completed';
  createdAt: string;
  updatedAt: string;
}

interface TestComment {
  id: string;
  issueId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface TestNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  actorId: string | null;
  issueId: string | null;
  commentId: string | null;
  projectId: string | null;
  metadata: Record<string, any>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

// Export types
export type { TestUser, TestProject, TestIssue, TestSprint, TestComment, TestNotification };
