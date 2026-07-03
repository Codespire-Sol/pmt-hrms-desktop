import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../../app';
import { prisma } from '../../database/prisma';
import { generateTestToken } from '../utils/integration-helpers';

describe('Board Columns API Integration Tests', () => {
  const timestamp = Date.now();
  const leadUserId = uuidv4();
  const memberUserId = uuidv4();
  const projectId = uuidv4();
  const workflowId = uuidv4();
  let firstColumnId = '';
  let secondColumnId = '';

  const leadToken = generateTestToken(leadUserId, `board-lead-${timestamp}@example.com`);
  const memberToken = generateTestToken(memberUserId, `board-member-${timestamp}@example.com`);

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: leadUserId,
          email: `board-lead-${timestamp}@example.com`,
          firstName: 'Board',
          lastName: 'Lead',
          passwordHash: '$2b$12$test.hash',
          isActive: true,
          isVerified: true,
        },
        {
          id: memberUserId,
          email: `board-member-${timestamp}@example.com`,
          firstName: 'Board',
          lastName: 'Member',
          passwordHash: '$2b$12$test.hash',
          isActive: true,
          isVerified: true,
        },
      ],
      skipDuplicates: true,
    });

    await prisma.project.create({
      data: {
        id: projectId,
        name: 'Board Columns Project',
        key: `BC${String(timestamp).slice(-4)}`,
        ownerId: leadUserId,
      },
    });

    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: leadUserId, role: 'lead' },
        { projectId, userId: memberUserId, role: 'member' },
      ],
      skipDuplicates: true,
    });

    await prisma.workflow.create({
      data: {
        id: workflowId,
        projectId,
        name: 'Board Columns Workflow',
        isDefault: false,
      },
    });
  });

  afterAll(async () => {
    await prisma.project.deleteMany({
      where: { id: projectId },
    });
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [leadUserId, memberUserId],
        },
      },
    });
  });

  it('should allow lead to create a board column', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/board/columns`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({
        name: 'testing',
        displayName: 'Testing',
        category: 'todo',
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Board column created');
    expect(response.body.data.workflowId).toBe(workflowId);
    expect(response.body.data.displayName).toBe('Testing');
    firstColumnId = response.body.data.id;
  });

  it('should allow lead to reorder board columns', async () => {
    const secondCreate = await request(app)
      .post(`/api/v1/projects/${projectId}/board/columns`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({
        name: 'review',
        displayName: 'Review',
        category: 'in_progress',
      });

    expect(secondCreate.status).toBe(201);
    secondColumnId = secondCreate.body.data.id;

    const reorder = await request(app)
      .post(`/api/v1/projects/${projectId}/board/columns/reorder`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({
        statusIds: [secondColumnId, firstColumnId],
      });

    expect(reorder.status).toBe(200);
    expect(reorder.body.success).toBe(true);
    expect(reorder.body.message).toBe('Board columns reordered');
    expect(reorder.body.data[0].id).toBe(secondColumnId);
  });

  it('should allow lead to delete a board column', async () => {
    const response = await request(app)
      .delete(`/api/v1/projects/${projectId}/board/columns/${secondColumnId}`)
      .set('Authorization', `Bearer ${leadToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Board column deleted successfully');
  });

  it('should deny member from creating a board column', async () => {
    const response = await request(app)
      .post(`/api/v1/projects/${projectId}/board/columns`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        name: 'member_column',
        displayName: 'Member Column',
      });

    expect(response.status).toBe(403);
  });

  it('should deny member from deleting a board column', async () => {
    const response = await request(app)
      .delete(`/api/v1/projects/${projectId}/board/columns/${firstColumnId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(response.status).toBe(403);
  });
});
