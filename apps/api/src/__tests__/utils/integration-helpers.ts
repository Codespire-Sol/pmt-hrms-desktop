import request from 'supertest';
import { Express } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../../database/prisma';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Generate a valid JWT token for testing.
// The token mimics Keycloak's payload structure so the mocked
// verifyKeycloakToken (below) returns a proper KeycloakTokenPayload.
export const generateTestToken = (userId: string, email: string = 'test@example.com'): string => {
  return jwt.sign(
    {
      sub: userId,          // Keycloak uses 'sub' for user ID
      userId,               // kept for backwards compat with older tests
      email,
      given_name: 'Test',
      family_name: 'User',
      preferred_username: email,
      jti: uuidv4(),
      realm_access: { roles: ['admin'] },
    },
    JWT_SECRET,
    {
      expiresIn: '1h',
      issuer: 'projectflow-api',
      audience: 'projectflow-app',
    }
  );
};

// Create authenticated request helper
export const authRequest = (app: Express, token: string) => ({
  get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
  post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
  put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
  patch: (url: string) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
  delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
});

// Database test helpers
export const dbHelpers = {
  // Create a test user in the database
  async createUser(data: Partial<DbUser> = {}): Promise<DbUser> {
    const userData = {
      id: uuidv4(),
      email: `test-${Date.now()}@example.com`,
      first_name: 'Test',
      last_name: 'User',
      password_hash: '$2b$10$test.hash',
      is_active: true,
      is_verified: true,
      ...data,
    };

    const user = await prisma.user.upsert({
      where: { id: userData.id },
      update: {},
      create: {
        id: userData.id,
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        passwordHash: userData.password_hash,
        isActive: userData.is_active,
        isVerified: userData.is_verified,
      },
    });

    return {
      id: user.id,
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
      password_hash: user.passwordHash,
      is_active: user.isActive,
      is_verified: user.isVerified,
      created_at: user.createdAt?.toISOString(),
      updated_at: user.updatedAt?.toISOString(),
    } as DbUser;
  },

  // Create a test project
  async createProject(data: Partial<DbProject>): Promise<DbProject> {
    const projectData = {
      id: uuidv4(),
      name: `Test Project ${Date.now()}`,
      key: `TP${Date.now().toString().slice(-4)}`,
      description: 'Test project description',
      is_archived: false,
      ...data,
    };

    const project = await prisma.project.create({
      data: {
        id: projectData.id,
        name: projectData.name,
        key: projectData.key,
        description: projectData.description,
        ownerId: projectData.owner_id!,
      },
    });

    return {
      id: project.id,
      name: project.name,
      key: project.key,
      description: project.description ?? undefined,
      owner_id: project.ownerId,
      is_archived: false,
      created_at: project.createdAt?.toISOString(),
      updated_at: project.updatedAt?.toISOString(),
    } as DbProject;
  },

  // Add user as project member
  async addProjectMember(projectId: string, userId: string, roleId: string): Promise<void> {
    await prisma.projectMember.create({
      data: {
        projectId,
        userId,
        role: roleId as any,
      },
    });
  },

  // Create a test issue
  async createIssue(data: Partial<DbIssue>): Promise<DbIssue> {
    const issueData = {
      id: uuidv4(),
      issue_key: `TEST-${Date.now().toString().slice(-4)}`,
      title: 'Test Issue',
      description: 'Test issue description',
      ...data,
    };

    const issue = await prisma.issue.create({
      data: {
        id: issueData.id,
        title: issueData.title,
        description: issueData.description,
        projectId: issueData.project_id!,
        typeId: issueData.issue_type_id!,
        statusId: issueData.status_id!,
        reporterId: issueData.reporter_id!,
        assigneeId: issueData.assignee_id,
        issueNumber: parseInt(issueData.issue_key.split('-')[1]) || 1,
      },
    });

    return {
      id: issue.id,
      project_id: issue.projectId,
      issue_key: issueData.issue_key,
      title: issue.title,
      description: issue.description ?? undefined,
      issue_type_id: issue.typeId,
      status_id: issue.statusId,
      reporter_id: issue.reporterId,
      assignee_id: issue.assigneeId ?? undefined,
      created_at: issue.createdAt?.toISOString(),
      updated_at: issue.updatedAt?.toISOString(),
    } as DbIssue;
  },

  // Create a test sprint
  async createSprint(data: Partial<DbSprint>): Promise<DbSprint> {
    const sprintData = {
      id: uuidv4(),
      name: `Sprint ${Date.now()}`,
      status: 'planning' as const,
      ...data,
    };

    const sprint = await prisma.sprint.create({
      data: {
        id: sprintData.id,
        name: sprintData.name,
        status: sprintData.status as any,
        projectId: sprintData.project_id!,
        createdBy: sprintData.project_id!, // Placeholder — caller should provide a valid userId via data override
      } as any,
    });

    return {
      id: sprint.id,
      project_id: sprint.projectId,
      name: sprint.name,
      status: sprint.status as any,
      created_at: sprint.createdAt?.toISOString(),
      updated_at: sprint.updatedAt?.toISOString(),
    } as DbSprint;
  },

  // Create a test comment
  async createComment(data: Partial<DbComment>): Promise<DbComment> {
    const commentData = {
      id: uuidv4(),
      content: 'Test comment',
      ...data,
    };

    const comment = await prisma.comment.create({
      data: {
        id: commentData.id,
        content: commentData.content,
        issueId: commentData.issue_id!,
        authorId: commentData.author_id!,
      },
    });

    return {
      id: comment.id,
      issue_id: comment.issueId,
      author_id: comment.authorId,
      content: comment.content,
      created_at: comment.createdAt?.toISOString(),
      updated_at: comment.updatedAt?.toISOString(),
    } as DbComment;
  },

  // Get role by name
  async getRoleByName(name: string): Promise<DbRole | null> {
    const role = await prisma.role.findFirst({ where: { name } });
    if (!role) return null;
    return { id: role.id, name: role.name, description: role.description ?? undefined } as DbRole;
  },

  // Get status by name and project
  async getStatusByName(projectId: string, name: string): Promise<DbStatus | null> {
    const status = await prisma.status.findFirst({
      where: { name, workflow: { projectId } },
    });
    if (!status) return null;
    return {
      id: status.id,
      project_id: projectId,
      name: status.name,
      category: status.category as string,
      position: status.position,
    } as DbStatus;
  },

  // Get issue type by project
  async getIssueTypeByProject(projectId: string): Promise<DbIssueType | null> {
    const type = await prisma.issueType.findFirst({
      where: { projectId },
    });
    if (!type) return null;
    return {
      id: type.id,
      project_id: type.projectId,
      name: type.name,
      icon: type.icon ?? undefined,
    } as DbIssueType;
  },

  // Clean up test data
  async cleanup(tableNames: string[] = []): Promise<void> {
    const defaultTables = [
      'time_logs',
      'comments',
      'issue_links',
      'issue_watchers',
      'issues',
      'sprints',
      'project_members',
      'projects',
      'users',
    ];

    const tables = tableNames.length > 0 ? tableNames : defaultTables;

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
      } catch (error) {
        // Ignore errors for tables that don't exist
      }
    }
  },

  // Truncate specific table
  async truncate(tableName: string): Promise<void> {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE`);
  },
};

// Database types
interface DbUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  avatar_url?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at?: string;
  updated_at?: string;
}

interface DbProject {
  id: string;
  name: string;
  key: string;
  description?: string;
  owner_id: string;
  is_archived: boolean;
  created_at?: string;
  updated_at?: string;
}

interface DbIssue {
  id: string;
  project_id: string;
  issue_key: string;
  title: string;
  description?: string;
  issue_type_id: string;
  status_id: string;
  priority_id?: string;
  reporter_id: string;
  assignee_id?: string;
  due_date?: string;
  story_points?: number;
  created_at?: string;
  updated_at?: string;
}

interface DbSprint {
  id: string;
  project_id: string;
  name: string;
  goal?: string;
  start_date?: string;
  end_date?: string;
  status: 'planning' | 'active' | 'completed';
  created_at?: string;
  updated_at?: string;
}

interface DbComment {
  id: string;
  issue_id: string;
  author_id: string;
  content: string;
  created_at?: string;
  updated_at?: string;
}

interface DbRole {
  id: string;
  name: string;
  description?: string;
}

interface DbStatus {
  id: string;
  project_id: string;
  name: string;
  category: string;
  position: number;
}

interface DbIssueType {
  id: string;
  project_id: string;
  name: string;
  icon?: string;
}

export type { DbUser, DbProject, DbIssue, DbSprint, DbComment, DbRole, DbStatus, DbIssueType };
