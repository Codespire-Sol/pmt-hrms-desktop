import request from 'supertest';
import app from '../../app';
import { prisma } from '../../database/prisma';
import { v4 as uuidv4 } from 'uuid';
import { generateTestToken } from '../utils/integration-helpers';

describe('Search API Integration Tests', () => {
  const testUserId = uuidv4();
  const testProjectId = uuidv4();
  const timestamp = Date.now();
  const projectKey = `STP${timestamp.toString().slice(-6)}`;
  const testUser = {
    id: testUserId,
    email: `searchtest-${timestamp}@example.com`,
    first_name: 'Search',
    last_name: 'Test User',
    password_hash: '$2b$12$test.hash',
    is_active: true,
    is_verified: true,
  };

  let authToken: string;
  let savedSearchId: string;
  const issueIds: string[] = [];

  beforeAll(async () => {
    // Create test user
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        email: testUser.email,
        firstName: testUser.first_name,
        lastName: testUser.last_name,
        passwordHash: testUser.password_hash,
        isActive: testUser.is_active,
        isVerified: testUser.is_verified,
      },
    });
    authToken = generateTestToken(testUserId, testUser.email);

    // Create test project
    await prisma.project.upsert({
      where: { id: testProjectId },
      update: {},
      create: {
        id: testProjectId,
        name: 'Search Test Project',
        key: projectKey,
        ownerId: testUserId,
      },
    });

    // Add user as project member
    try {
      await prisma.projectMember.create({
        data: {
          projectId: testProjectId,
          userId: testUserId,
          role: 'admin' as any,
        },
      });
    } catch (e: any) {
      if (e.code !== 'P2002') throw e;
    }

    // Create issue type for the project
    const issueTypeId = uuidv4();
    try {
      await prisma.issueType.create({
        data: {
          id: issueTypeId,
          projectId: testProjectId,
          name: 'bug',
          displayName: 'Bug',
          description: 'A bug to be fixed',
          icon: 'bug',
          color: '#E53935',
        },
      });
    } catch (e: any) {
      if (e.code !== 'P2002') throw e;
    }

    // Get a default status from an existing workflow
    const status = await prisma.status.findFirst();

    if (status) {
      // Create test issues
      const issues = [
        {
          id: uuidv4(),
          projectId: testProjectId,
          issueNumber: 1,
          title: 'Login authentication bug',
          description: 'Users cannot login',
          typeId: issueTypeId,
          statusId: status.id,
          reporterId: testUserId,
        },
        {
          id: uuidv4(),
          projectId: testProjectId,
          issueNumber: 2,
          title: 'Dashboard performance issue',
          description: 'Dashboard loads slowly',
          typeId: issueTypeId,
          statusId: status.id,
          reporterId: testUserId,
        },
      ];

      for (const issue of issues) {
        try {
          await prisma.issue.create({ data: issue });
          issueIds.push(issue.id);
        } catch (e) {
          // Ignore if already exists
        }
      }
    }
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await prisma.savedSearch.deleteMany({ where: { userId: testUserId } });
      await prisma.searchHistory.deleteMany({ where: { userId: testUserId } });
      await prisma.recentItem.deleteMany({ where: { userId: testUserId } });
      if (issueIds.length > 0) {
        await prisma.issue.deleteMany({ where: { id: { in: issueIds } } });
      }
      await prisma.issueType.deleteMany({ where: { projectId: testProjectId } });
      await prisma.projectMember.deleteMany({ where: { projectId: testProjectId } });
      await prisma.project.deleteMany({ where: { id: testProjectId } });
      await prisma.user.deleteMany({ where: { id: testUserId } });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('GET /api/v1/search', () => {
    it('should search across entities', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toBeDefined();
      expect(Array.isArray(response.body.data.results)).toBe(true);
    });

    it('should return empty results for short queries', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=a')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.results).toEqual([]);
    });

    it('should filter by entity types', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=test&types=issue')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.data.results.forEach((result: any) => {
        expect(result.type).toBe('issue');
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=test&limit=5&offset=0')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.limit).toBe(5);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/v1/search?q=test');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/search/quick', () => {
    it('should return quick search results', async () => {
      const response = await request(app)
        .get('/api/v1/search/quick?q=login')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('issues');
      expect(response.body.data).toHaveProperty('projects');
      expect(response.body.data).toHaveProperty('users');
    });
  });

  describe('POST /api/v1/search/understand', () => {
    it('should parse natural language queries', async () => {
      const response = await request(app)
        .post('/api/v1/search/understand')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: 'show me high priority bugs' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.parsedQuery).toBeDefined();
      expect(response.body.data.parsedQuery.intent).toBeDefined();
    });

    it('should extract filters from query', async () => {
      const response = await request(app)
        .post('/api/v1/search/understand')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: 'my assigned bugs in progress' });

      expect(response.status).toBe(200);
      expect(response.body.data.parsedQuery.extractedFilters).toBeDefined();
    });

    it('should include processing time', async () => {
      const response = await request(app)
        .post('/api/v1/search/understand')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: 'test query' });

      expect(response.status).toBe(200);
      expect(typeof response.body.data.processingTimeMs).toBe('number');
    });
  });

  describe('POST /api/v1/search/ai-ranked', () => {
    it('should return AI-ranked search results', async () => {
      const response = await request(app)
        .post('/api/v1/search/ai-ranked')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: 'authentication issue' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toBeDefined();
      expect(response.body.data.parsedQuery).toBeDefined();
    });

    it('should include relevance scores', async () => {
      const response = await request(app)
        .post('/api/v1/search/ai-ranked')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: 'login bug' });

      expect(response.status).toBe(200);
      response.body.data.results.forEach((result: any) => {
        expect(typeof result.relevanceScore).toBe('number');
        expect(result.rankingFactors).toBeDefined();
      });
    });
  });

  describe('Recent Items', () => {
    describe('POST /api/v1/search/recent', () => {
      it('should record recent item', async () => {
        const response = await request(app)
          .post('/api/v1/search/recent')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            entityType: 'project',
            entityId: testProjectId,
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    describe('GET /api/v1/search/recent', () => {
      it('should return recent items', async () => {
        const response = await request(app)
          .get('/api/v1/search/recent')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.items)).toBe(true);
      });

      it('should filter by entity type', async () => {
        const response = await request(app)
          .get('/api/v1/search/recent?types=project')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        response.body.data.items.forEach((item: any) => {
          expect(item.entityType).toBe('project');
        });
      });
    });

    describe('DELETE /api/v1/search/recent', () => {
      it('should clear recent items', async () => {
        const response = await request(app)
          .delete('/api/v1/search/recent')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Search History', () => {
    describe('GET /api/v1/search/history', () => {
      it('should return search history', async () => {
        // First, perform a search to add to history
        await request(app)
          .get('/api/v1/search?q=test query for history')
          .set('Authorization', `Bearer ${authToken}`);

        const response = await request(app)
          .get('/api/v1/search/history')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.history)).toBe(true);
      });
    });

    describe('DELETE /api/v1/search/history', () => {
      it('should clear search history', async () => {
        const response = await request(app)
          .delete('/api/v1/search/history')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Saved Searches', () => {
    describe('POST /api/v1/search/saved', () => {
      it('should create saved search', async () => {
        const response = await request(app)
          .post('/api/v1/search/saved')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'My Bugs',
            query: 'bugs',
            filters: { types: ['issue'] },
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.id).toBeDefined();
        savedSearchId = response.body.data.id;
      });

      it('should validate required fields', async () => {
        const response = await request(app)
          .post('/api/v1/search/saved')
          .set('Authorization', `Bearer ${authToken}`)
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe('GET /api/v1/search/saved', () => {
      it('should return saved searches', async () => {
        const response = await request(app)
          .get('/api/v1/search/saved')
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data.searches)).toBe(true);
      });
    });

    describe('GET /api/v1/search/saved/:id', () => {
      it('should return specific saved search', async () => {
        const response = await request(app)
          .get(`/api/v1/search/saved/${savedSearchId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.id).toBe(savedSearchId);
      });

      it('should return 404 for non-existent search', async () => {
        const response = await request(app)
          .get(`/api/v1/search/saved/${uuidv4()}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(404);
      });
    });

    describe('PATCH /api/v1/search/saved/:id', () => {
      it('should update saved search', async () => {
        const response = await request(app)
          .patch(`/api/v1/search/saved/${savedSearchId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Updated Bugs Search',
          });

        expect(response.status).toBe(200);
        expect(response.body.data.name).toBe('Updated Bugs Search');
      });
    });

    describe('POST /api/v1/search/saved/:id/execute', () => {
      it('should execute saved search', async () => {
        const response = await request(app)
          .post(`/api/v1/search/saved/${savedSearchId}/execute`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.results).toBeDefined();
      });
    });

    describe('DELETE /api/v1/search/saved/:id', () => {
      it('should delete saved search', async () => {
        const response = await request(app)
          .delete(`/api/v1/search/saved/${savedSearchId}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});
