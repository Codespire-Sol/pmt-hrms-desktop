import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../../app';
import { prisma } from '../../database/prisma';
import { generateTestToken } from '../utils/integration-helpers';

describe('Issue Subtask API Integration Tests', () => {
  const timestamp = Date.now();

  const memberUserId = uuidv4();
  const outsiderUserId = uuidv4();
  const projectId = uuidv4();
  const workflowId = uuidv4();
  const statusId = uuidv4();
  const parentTypeId = uuidv4();
  const subtaskTypeId = uuidv4();
  const parentIssueId = uuidv4();

  const noSubtaskProjectId = uuidv4();
  const noSubtaskWorkflowId = uuidv4();
  const noSubtaskStatusId = uuidv4();
  const noSubtaskParentTypeId = uuidv4();
  const noSubtaskParentIssueId = uuidv4();

  const memberToken = generateTestToken(memberUserId, `subtask-member-${timestamp}@example.com`);
  const outsiderToken = generateTestToken(outsiderUserId, `subtask-outsider-${timestamp}@example.com`);

  beforeAll(async () => {
    await prisma.user.upsert({
      where: { id: memberUserId },
      update: {},
      create: {
        id: memberUserId,
        email: `subtask-member-${timestamp}@example.com`,
        firstName: 'Subtask',
        lastName: 'Member',
        passwordHash: '$2b$12$test.hash',
        isActive: true,
        isVerified: true,
      },
    });

    await prisma.user.upsert({
      where: { id: outsiderUserId },
      update: {},
      create: {
        id: outsiderUserId,
        email: `subtask-outsider-${timestamp}@example.com`,
        firstName: 'Subtask',
        lastName: 'Outsider',
        passwordHash: '$2b$12$test.hash',
        isActive: true,
        isVerified: true,
      },
    });

    await prisma.project.create({
      data: {
        id: projectId,
        name: 'Subtask Test Project',
        key: `ST${String(timestamp).slice(-4)}`,
        ownerId: memberUserId,
      },
    });

    await prisma.projectMember.create({
      data: {
        projectId,
        userId: memberUserId,
        role: 'admin',
      },
    });

    await prisma.workflow.create({
      data: {
        id: workflowId,
        projectId,
        name: 'Subtask Test Workflow',
        isDefault: false,
      },
    });

    await prisma.status.create({
      data: {
        id: statusId,
        workflowId,
        name: 'todo',
        displayName: 'To Do',
        category: 'todo',
        isInitial: true,
        position: 0,
      },
    });

    await prisma.issueType.create({
      data: {
        id: parentTypeId,
        projectId,
        name: 'task',
        displayName: 'Task',
        isSubtask: false,
        position: 0,
      },
    });

    await prisma.issueType.create({
      data: {
        id: subtaskTypeId,
        projectId,
        name: 'subtask',
        displayName: 'Sub-task',
        isSubtask: true,
        position: 1,
      },
    });

    await prisma.issue.create({
      data: {
        id: parentIssueId,
        projectId,
        issueNumber: 1,
        typeId: parentTypeId,
        statusId,
        title: 'Parent Issue',
        reporterId: memberUserId,
      },
    });

    await prisma.project.create({
      data: {
        id: noSubtaskProjectId,
        name: 'No Subtask Type Project',
        key: `NS${String(timestamp).slice(-4)}`,
        ownerId: memberUserId,
      },
    });

    await prisma.projectMember.create({
      data: {
        projectId: noSubtaskProjectId,
        userId: memberUserId,
        role: 'admin',
      },
    });

    await prisma.workflow.create({
      data: {
        id: noSubtaskWorkflowId,
        projectId: noSubtaskProjectId,
        name: 'No Subtask Workflow',
        isDefault: false,
      },
    });

    await prisma.status.create({
      data: {
        id: noSubtaskStatusId,
        workflowId: noSubtaskWorkflowId,
        name: 'todo',
        displayName: 'To Do',
        category: 'todo',
        isInitial: true,
        position: 0,
      },
    });

    await prisma.issueType.create({
      data: {
        id: noSubtaskParentTypeId,
        projectId: noSubtaskProjectId,
        name: 'task',
        displayName: 'Task',
        isSubtask: false,
        position: 0,
      },
    });

    await prisma.issue.create({
      data: {
        id: noSubtaskParentIssueId,
        projectId: noSubtaskProjectId,
        issueNumber: 1,
        typeId: noSubtaskParentTypeId,
        statusId: noSubtaskStatusId,
        title: 'Parent Without Subtask Type',
        reporterId: memberUserId,
      },
    });
  });

  afterAll(async () => {
    await prisma.project.deleteMany({
      where: {
        id: {
          in: [projectId, noSubtaskProjectId],
        },
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [memberUserId, outsiderUserId],
        },
      },
    });
  });

  it('should create a subtask under an issue', async () => {
    const response = await request(app)
      .post(`/api/v1/issues/${parentIssueId}/subtasks`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Created subtask',
        description: 'Child item',
        assigneeId: memberUserId,
        storyPoints: 2,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Subtask created successfully');
    expect(response.body.data.parentId).toBe(parentIssueId);
    expect(response.body.data.type.id).toBe(subtaskTypeId);

    const saved = await prisma.issue.findUnique({ where: { id: response.body.data.id } });
    expect(saved).not.toBeNull();
    expect(saved?.parentId).toBe(parentIssueId);
    expect(saved?.typeId).toBe(subtaskTypeId);
  });

  it('should require authentication', async () => {
    const response = await request(app)
      .post(`/api/v1/issues/${parentIssueId}/subtasks`)
      .send({
        title: 'Unauthorized subtask',
      });

    expect(response.status).toBe(401);
  });

  it('should deny non-member access', async () => {
    const response = await request(app)
      .post(`/api/v1/issues/${parentIssueId}/subtasks`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        title: 'Forbidden subtask',
      });

    expect(response.status).toBe(403);
  });

  it('should return 404 when parent issue does not exist', async () => {
    const response = await request(app)
      .post(`/api/v1/issues/${uuidv4()}/subtasks`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Missing parent',
      });

    expect(response.status).toBe(404);
  });

  it('should reject nested subtasks', async () => {
    const nestedParentId = uuidv4();
    await prisma.issue.create({
      data: {
        id: nestedParentId,
        projectId,
        issueNumber: 1000,
        typeId: subtaskTypeId,
        statusId,
        title: 'Existing subtask parent',
        reporterId: memberUserId,
        parentId: parentIssueId,
      },
    });

    const response = await request(app)
      .post(`/api/v1/issues/${nestedParentId}/subtasks`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Nested child',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should return 400 when project has no subtask issue type', async () => {
    const response = await request(app)
      .post(`/api/v1/issues/${noSubtaskParentIssueId}/subtasks`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'No type configured',
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('should reject typeId and parentId in request body', async () => {
    const response = await request(app)
      .post(`/api/v1/issues/${parentIssueId}/subtasks`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Invalid payload',
        typeId: uuidv4(),
        parentId: uuidv4(),
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });
});
