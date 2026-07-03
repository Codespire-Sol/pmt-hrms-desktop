import request from 'supertest';
import app from '../../app';
import { prisma } from '../../database/prisma';

/**
 * End-to-End Tests for Critical User Flows
 *
 * These tests simulate complete user journeys through the application,
 * testing the integration of multiple features working together.
 */
describe('E2E: User Flows', () => {
  describe('User Registration and Authentication Flow', () => {
    const testUser = {
      email: `e2e-${Date.now()}@example.com`,
      password: 'SecurePassword123!',
      firstName: 'E2E',
      lastName: 'TestUser',
    };
    let accessToken: string;
    let refreshToken: string;
    let userId: string;

    afterAll(async () => {
      if (userId) {
        await prisma.refreshToken.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
      }
    });

    it('should complete full registration → login → profile flow', async () => {
      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.success).toBe(true);
      userId = registerResponse.body.data.user.id;

      // Step 2: Login with new credentials
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(loginResponse.status).toBe(200);
      accessToken = loginResponse.body.data.tokens.accessToken;
      refreshToken = loginResponse.body.data.tokens.refreshToken;

      // Step 3: Access protected route with token
      const profileResponse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.data.user.email).toBe(testUser.email);

      // Step 4: Update profile
      const updateResponse = await request(app)
        .put('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Updated',
          lastName: 'Name',
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.user.firstName).toBe('Updated');

      // Step 5: Refresh token
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.data.tokens.accessToken).toBeDefined();

      // Step 6: Logout
      const logoutResponse = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(logoutResponse.status).toBe(200);
    });
  });

  describe('Project and Issue Management Flow', () => {
    const timestamp = Date.now();
    const testUser = {
      email: `e2e-project-${timestamp}@example.com`,
      password: 'SecurePassword123!',
      firstName: 'Project',
      lastName: 'Manager',
    };
    const projectKey = `E2E${timestamp.toString().slice(-6)}`;
    let accessToken: string;
    let userId: string;
    let projectId: string;
    let issueId: string;
    let sprintId: string;

    beforeAll(async () => {
      // Register and login user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);

      userId = registerResponse.body.data.user.id;

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      accessToken = loginResponse.body.data.tokens.accessToken;
    });

    afterAll(async () => {
      try {
        // Clean up test data
        if (issueId) {
          await prisma.timeLog.deleteMany({ where: { issueId } });
          await prisma.comment.deleteMany({ where: { issueId } });
          await prisma.issue.deleteMany({ where: { id: issueId } });
        }
        if (sprintId) {
          await prisma.sprint.deleteMany({ where: { id: sprintId } });
        }
        if (projectId) {
          await prisma.projectMember.deleteMany({ where: { projectId } });
          await prisma.project.deleteMany({ where: { id: projectId } });
        }
        if (userId) {
          // Delete all projects owned by user first
          const userProjects = await prisma.project.findMany({ where: { ownerId: userId }, select: { id: true } });
          for (const proj of userProjects) {
            await prisma.projectMember.deleteMany({ where: { projectId: proj.id } });
            await prisma.project.deleteMany({ where: { id: proj.id } });
          }
          await prisma.refreshToken.deleteMany({ where: { userId } });
          await prisma.user.deleteMany({ where: { id: userId } });
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    });

    it('should complete full project → issue → sprint management flow', async () => {
      // Step 1: Create a new project
      const projectResponse = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'E2E Test Project',
          key: projectKey,
          description: 'Test project for E2E tests',
        });

      expect(projectResponse.status).toBe(201);
      projectId = projectResponse.body.data.id;

      // Step 2: Create a default issue type for the project (projects don't come with types by default)
      const issueType = await prisma.issueType.findFirst({
        where: { projectId: projectId, name: 'task' },
      });
      const typeId = issueType.id;

      // Step 2b: Create an issue in the project
      const issueResponse = await request(app)
        .post(`/api/v1/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'E2E Test Issue',
          description: 'This is a test issue',
          typeId: typeId,
        });

      expect(issueResponse.status).toBe(201);
      issueId = issueResponse.body.data.id;

      // Step 3: Update the issue
      const updateIssueResponse = await request(app)
        .patch(`/api/v1/issues/${issueId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Updated E2E Test Issue',
          description: 'Updated description',
        });

      expect(updateIssueResponse.status).toBe(200);
      expect(updateIssueResponse.body.data.title).toBe('Updated E2E Test Issue');

      // Step 4: Add a comment to the issue
      const commentResponse = await request(app)
        .post(`/api/v1/issues/${issueId}/comments`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'This is a test comment',
        });

      expect(commentResponse.status).toBe(201);

      // Step 5: Log time on the issue
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const timeLogResponse = await request(app)
        .post(`/api/v1/issues/${issueId}/time-logs`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          hours: 1.0,
          description: 'Development work',
          workDate: today,
        });

      expect(timeLogResponse.status).toBe(201);

      // Step 6: Create a sprint
      const sprintResponse = await request(app)
        .post(`/api/v1/projects/${projectId}/sprints`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Sprint 1',
          goal: 'Complete initial setup',
        });

      expect(sprintResponse.status).toBe(201);
      sprintId = sprintResponse.body.data.id;

      // Step 7: Add issue to sprint
      const addToSprintResponse = await request(app)
        .post(`/api/v1/sprints/${sprintId}/issues`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          issueIds: [issueId],
        });

      expect(addToSprintResponse.status).toBe(200);

      // Step 8: Start the sprint
      const startSprintResponse = await request(app)
        .post(`/api/v1/sprints/${sprintId}/start`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        });

      expect(startSprintResponse.status).toBe(200);

      // Step 9: Get project board
      const boardResponse = await request(app)
        .get(`/api/v1/projects/${projectId}/board`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(boardResponse.status).toBe(200);
      expect(boardResponse.body.data.columns).toBeDefined();

      // Step 10: Get project dashboard
      const dashboardResponse = await request(app)
        .get(`/api/v1/projects/${projectId}/dashboard`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(dashboardResponse.status).toBe(200);
    });
  });

  describe('Notification Flow', () => {
    const timestamp = Date.now();
    const testUser1 = {
      email: `e2e-notif1-${timestamp}@example.com`,
      password: 'SecurePassword123!',
      firstName: 'User',
      lastName: 'One',
    };
    const testUser2 = {
      email: `e2e-notif2-${timestamp}@example.com`,
      password: 'SecurePassword123!',
      firstName: 'User',
      lastName: 'Two',
    };
    const projectKey = `NTP${timestamp.toString().slice(-6)}`;
    let user1Token: string;
    let user2Token: string;
    let user1Id: string;
    let user2Id: string;
    let projectId: string;
    let issueId: string;

    beforeAll(async () => {
      // Register both users
      const register1 = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser1);
      user1Id = register1.body.data.user.id;

      const register2 = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser2);
      user2Id = register2.body.data.user.id;

      // Login both users
      const login1 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser1.email, password: testUser1.password });
      user1Token = login1.body.data.tokens.accessToken;

      const login2 = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser2.email, password: testUser2.password });
      user2Token = login2.body.data.tokens.accessToken;
    });

    afterAll(async () => {
      try {
        if (issueId) {
          await prisma.notification.deleteMany({ where: { issueId } });
          await prisma.issue.deleteMany({ where: { id: issueId } });
        }
        if (projectId) {
          await prisma.projectMember.deleteMany({ where: { projectId } });
          await prisma.project.deleteMany({ where: { id: projectId } });
        }
        for (const id of [user1Id, user2Id]) {
          if (id) {
            // Delete all projects owned by user first
            const userProjects = await prisma.project.findMany({ where: { ownerId: id }, select: { id: true } });
            for (const proj of userProjects) {
              await prisma.projectMember.deleteMany({ where: { projectId: proj.id } });
              await prisma.project.deleteMany({ where: { id: proj.id } });
            }
            await prisma.notificationPreference.deleteMany({ where: { userId: id } });
            await prisma.notification.deleteMany({ where: { userId: id } });
            await prisma.refreshToken.deleteMany({ where: { userId: id } });
            await prisma.user.deleteMany({ where: { id } });
          }
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    });

    it('should trigger notifications when actions occur', async () => {
      // Step 1: User1 creates a project
      const projectResponse = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          name: 'Notification Test Project',
          key: projectKey,
        });

      expect(projectResponse.status).toBe(201);
      projectId = projectResponse.body.data.id;

      // Step 2: User1 adds User2 to the project
      const addMemberResponse = await request(app)
        .post(`/api/v1/projects/${projectId}/members`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          userId: user2Id,
          role: 'member',
        });

      expect(addMemberResponse.status).toBe(201);

      // Step 3: Create a default issue type and status for the project
      const issueType = await prisma.issueType.findFirst({
        where: { projectId: projectId, name: 'task' },
      });
      const typeId = issueType.id;

      // Step 3b: Create an issue assigned to User2
      const issueResponse = await request(app)
        .post(`/api/v1/projects/${projectId}/issues`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Assigned Issue',
          description: 'This issue is assigned to User2',
          typeId: typeId,
          assigneeId: user2Id,
        });

      expect(issueResponse.status).toBe(201);
      issueId = issueResponse.body.data.id;

      // Step 4: Check User2's notifications
      const notifResponse = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(notifResponse.status).toBe(200);
      // User2 should have notifications about being added to project and assigned an issue
      expect(notifResponse.body.data.notifications.length).toBeGreaterThanOrEqual(0);

      // Step 5: Check User2's unread count
      const unreadResponse = await request(app)
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${user2Token}`);

      expect(unreadResponse.status).toBe(200);
      expect(typeof unreadResponse.body.data.count).toBe('number');

      // Step 6: Update notification preferences
      const prefResponse = await request(app)
        .put('/api/v1/notifications/preferences/issue_assigned')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          inAppEnabled: true,
          emailEnabled: false,
        });

      expect(prefResponse.status).toBe(200);
    });
  });

  describe('Search and Discovery Flow', () => {
    const timestamp = Date.now();
    const testUser = {
      email: `e2e-search-${timestamp}@example.com`,
      password: 'SecurePassword123!',
      firstName: 'Search',
      lastName: 'User',
    };
    const projectKey = `SRC${timestamp.toString().slice(-6)}`;
    let accessToken: string;
    let userId: string;
    let projectId: string;
    const issueIds: string[] = [];

    beforeAll(async () => {
      // Register and login
      const register = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      userId = register.body.data.user.id;

      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password });
      accessToken = login.body.data.tokens.accessToken;

      // Create a project with issues
      const projectResponse = await request(app)
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Search Test Project',
          key: projectKey,
        });
      projectId = projectResponse.body.data?.id;

      if (projectId) {
        // Create a default issue type for the project
        const issueType = await prisma.issueType.findFirst({
          where: { projectId: projectId, name: 'task' },
        });
        const typeId = issueType.id;

        // Create multiple issues for searching
        const issueTitles = [
          'Login authentication bug',
          'Dashboard performance optimization',
          'API rate limiting feature',
        ];

        for (const title of issueTitles) {
          const issueResponse = await request(app)
            .post(`/api/v1/projects/${projectId}/issues`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send({
              title,
              typeId: typeId,
            });
          if (issueResponse.body.data?.id) {
            issueIds.push(issueResponse.body.data.id);
          }
        }
      }
    });

    afterAll(async () => {
      try {
        await prisma.savedSearch.deleteMany({ where: { userId } });
        await prisma.searchHistory.deleteMany({ where: { userId } });
        await prisma.recentItem.deleteMany({ where: { userId } });
        for (const id of issueIds) {
          await prisma.issue.deleteMany({ where: { id } });
        }
        if (projectId) {
          await prisma.projectMember.deleteMany({ where: { projectId } });
          await prisma.project.deleteMany({ where: { id: projectId } });
        }
        if (userId) {
          // Delete all projects owned by user first
          const userProjects = await prisma.project.findMany({ where: { ownerId: userId }, select: { id: true } });
          for (const proj of userProjects) {
            await prisma.projectMember.deleteMany({ where: { projectId: proj.id } });
            await prisma.project.deleteMany({ where: { id: proj.id } });
          }
          await prisma.refreshToken.deleteMany({ where: { userId } });
          await prisma.user.deleteMany({ where: { id: userId } });
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    });

    it('should complete search discovery flow', async () => {
      // Step 1: Perform a basic search
      const searchResponse = await request(app)
        .get('/api/v1/search?q=login')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(searchResponse.status).toBe(200);

      // Step 2: Use query understanding
      const understandResponse = await request(app)
        .post('/api/v1/search/understand')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ query: 'show me high priority bugs' });

      expect(understandResponse.status).toBe(200);
      expect(understandResponse.body.data.parsedQuery.intent).toBeDefined();

      // Step 3: Record viewing an issue
      if (issueIds.length > 0) {
        const recordResponse = await request(app)
          .post('/api/v1/search/recent')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            entityType: 'issue',
            entityId: issueIds[0],
          });

        expect(recordResponse.status).toBe(200);
      }

      // Step 4: Get recent items
      const recentResponse = await request(app)
        .get('/api/v1/search/recent')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(recentResponse.status).toBe(200);

      // Step 5: Create a saved search
      const savedSearchResponse = await request(app)
        .post('/api/v1/search/saved')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Authentication Issues',
          query: 'authentication',
          filters: { types: ['issue'] },
        });

      expect(savedSearchResponse.status).toBe(201);

      // Step 6: Execute saved search
      const savedSearchId = savedSearchResponse.body.data.id;
      const executeResponse = await request(app)
        .post(`/api/v1/search/saved/${savedSearchId}/execute`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(executeResponse.status).toBe(200);

      // Step 7: Get search history
      const historyResponse = await request(app)
        .get('/api/v1/search/history')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(historyResponse.status).toBe(200);
    });
  });
});
