import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../../app';
import { prisma } from '../../database/prisma';
import { generateTestToken } from '../utils/integration-helpers';

describe('Timesheet API Integration Tests', () => {
  const timestamp = Date.now();
  const memberUserId = uuidv4();
  const leadUserId = uuidv4();
  const outsiderUserId = uuidv4();
  const projectId = uuidv4();
  const workflowId = uuidv4();
  const statusId = uuidv4();
  const issueTypeId = uuidv4();
  const issueId = uuidv4();

  const memberToken = generateTestToken(memberUserId, `timesheet-member-${timestamp}@example.com`);
  const leadToken = generateTestToken(leadUserId, `timesheet-lead-${timestamp}@example.com`);
  const outsiderToken = generateTestToken(outsiderUserId, `timesheet-outsider-${timestamp}@example.com`);

  const today = new Date().toISOString().split('T')[0];
  let memberLogId = '';
  let memberSnakeLogId = '';
  let leadLogId = '';
  let legacyLogId = '';

  beforeAll(async () => {
    await prisma.user.createMany({
      data: [
        {
          id: memberUserId,
          email: `timesheet-member-${timestamp}@example.com`,
          firstName: 'Timesheet',
          lastName: 'Member',
          passwordHash: '$2b$12$test.hash',
          isActive: true,
          isVerified: true,
        },
        {
          id: leadUserId,
          email: `timesheet-lead-${timestamp}@example.com`,
          firstName: 'Timesheet',
          lastName: 'Lead',
          passwordHash: '$2b$12$test.hash',
          isActive: true,
          isVerified: true,
        },
        {
          id: outsiderUserId,
          email: `timesheet-outsider-${timestamp}@example.com`,
          firstName: 'Timesheet',
          lastName: 'Outsider',
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
        name: 'Timesheet Project',
        key: `TS${String(timestamp).slice(-4)}`,
        ownerId: leadUserId,
      },
    });

    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: memberUserId, role: 'member' },
        { projectId, userId: leadUserId, role: 'lead' },
      ],
      skipDuplicates: true,
    });

    await prisma.workflow.create({
      data: {
        id: workflowId,
        projectId,
        name: 'Timesheet Workflow',
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
        id: issueTypeId,
        projectId,
        name: 'task',
        displayName: 'Task',
        isSubtask: false,
        position: 0,
      },
    });

    await prisma.issue.create({
      data: {
        id: issueId,
        projectId,
        issueNumber: 1,
        typeId: issueTypeId,
        statusId,
        title: 'Timesheet Issue',
        reporterId: memberUserId,
        originalEstimateHours: 8,
        remainingEstimateHours: 8,
      },
    });
  });

  afterAll(async () => {
    await prisma.project.deleteMany({
      where: {
        id: projectId,
      },
    });

    await prisma.user.deleteMany({
      where: {
        id: {
          in: [memberUserId, leadUserId, outsiderUserId],
        },
      },
    });
  });

  it('should create a timesheet log via camelCase payload', async () => {
    const response = await request(app)
      .post('/api/v1/timesheet/log')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        issueId,
        workDate: today,
        hoursWorked: 2,
        notes: 'Initial implementation',
        isBillable: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Time log created successfully');
    expect(response.body.data.log.issueId).toBe(issueId);
    expect(response.body.data.log.hoursWorked).toBe(2);
    memberLogId = response.body.data.log.id;
  });

  it('should keep legacy issue-scoped time log endpoint working', async () => {
    const response = await request(app)
      .post(`/api/v1/issues/${issueId}/time-logs`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        hours: 1.25,
        description: 'Legacy endpoint coverage',
        workDate: today,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.issue_id).toBe(issueId);
    expect(response.body.data.hours).toBe(1.25);
    legacyLogId = response.body.data.id;
  });

  it('should create a timesheet log via snake_case payload aliases', async () => {
    const response = await request(app)
      .post('/api/v1/timesheet/log')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        issue_id: issueId,
        date: today,
        hours_worked: 1.5,
        notes: 'Follow-up work',
        is_billable: false,
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.log.hoursWorked).toBe(1.5);
    expect(response.body.data.log.isBillable).toBe(false);
    memberSnakeLogId = response.body.data.log.id;
  });

  it('should return day-wise history with totals', async () => {
    const response = await request(app)
      .get('/api/v1/timesheet/history')
      .query({ startDate: today, endDate: today })
      .set('Authorization', `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.period.startDate).toBe(today);
    expect(response.body.data.period.endDate).toBe(today);
    expect(response.body.data.totals.totalWorkedHours).toBeGreaterThan(0);
    expect(Array.isArray(response.body.data.dayBuckets)).toBe(true);
  });

  it('should filter history by issue and billable flag', async () => {
    const response = await request(app)
      .get('/api/v1/timesheet/history')
      .query({
        startDate: today,
        endDate: today,
        issueId,
        isBillable: true,
      })
      .set('Authorization', `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.filters.issueId).toBe(issueId);
    expect(response.body.data.filters.isBillable).toBe(true);
    expect(response.body.data.logs).toEqual([]);
  });

  it('should keep legacy /timesheet endpoint working', async () => {
    const response = await request(app)
      .get('/api/v1/timesheet')
      .query({ startDate: today, endDate: today })
      .set('Authorization', `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.startDate).toBe(today);
    expect(response.body.data.endDate).toBe(today);
    expect(Array.isArray(response.body.data.days)).toBe(true);
  });

  it('should return summary with dual variance metrics', async () => {
    const response = await request(app)
      .get('/api/v1/timesheet/summary')
      .query({ startDate: today, endDate: today })
      .set('Authorization', `Bearer ${memberToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.kpis).toBeDefined();
    expect(response.body.data.variance.vsExpected).toBeDefined();
    expect(response.body.data.variance.vsEstimated).toBeDefined();
  });

  it('should allow owner to update own timesheet log', async () => {
    const response = await request(app)
      .put(`/api/v1/timesheet/log/${memberLogId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        hoursWorked: 2.5,
        notes: 'Updated effort',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.hoursWorked).toBe(2.5);
  });

  it('should allow lead to update member log in project scope', async () => {
    const response = await request(app)
      .put(`/api/v1/timesheet/log/${memberLogId}`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({
        notes: 'Lead reviewed log',
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('should prevent outsider from updating member log', async () => {
    const response = await request(app)
      .put(`/api/v1/timesheet/log/${memberLogId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({
        notes: 'Unauthorized edit',
      });

    expect(response.status).toBe(403);
  });

  it('should support lead override delete for member logs', async () => {
    const leadCreated = await request(app)
      .post('/api/v1/timesheet/log')
      .set('Authorization', `Bearer ${leadToken}`)
      .send({
        issueId,
        workDate: today,
        hoursWorked: 1,
        notes: 'Lead own log',
      });
    leadLogId = leadCreated.body.data.log.id;

    const deleteMemberLog = await request(app)
      .delete(`/api/v1/timesheet/log/${memberSnakeLogId}`)
      .set('Authorization', `Bearer ${leadToken}`);

    expect(deleteMemberLog.status).toBe(200);
    expect(deleteMemberLog.body.success).toBe(true);

    const deleteLeadOwnLog = await request(app)
      .delete(`/api/v1/timesheet/log/${leadLogId}`)
      .set('Authorization', `Bearer ${leadToken}`);

    expect(deleteLeadOwnLog.status).toBe(200);
    expect(deleteLeadOwnLog.body.success).toBe(true);

    const cleanupLegacy = await request(app)
      .delete(`/api/v1/time-logs/${legacyLogId}`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(cleanupLegacy.status).toBe(200);
    expect(cleanupLegacy.body.success).toBe(true);
  });
});
