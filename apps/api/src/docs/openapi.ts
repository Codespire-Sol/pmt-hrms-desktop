import swaggerJsdoc from 'swagger-jsdoc';
import { Router, Request, Response } from 'express';

/**
 * OpenAPI Documentation Configuration
 *
 * Auto-generates API documentation from JSDoc comments
 * and serves Swagger UI for interactive exploration.
 */

// ============================================
// OPENAPI SPECIFICATION
// ============================================

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'ProjectFlow API',
    version: '1.0.0',
    description: `
# ProjectFlow API Documentation

AI-powered project management platform API documentation.

## Authentication

All endpoints (except auth) require a valid JWT token in the Authorization header:

\`\`\`
Authorization: Bearer <your_token>
\`\`\`

## Rate Limiting

- Standard endpoints: 100 requests/minute
- Auth endpoints: 5 requests/15 minutes
- AI endpoints: 20 requests/minute

## Response Format

All responses follow a standard format:

### Success Response
\`\`\`json
{
  "success": true,
  "data": { ... }
}
\`\`\`

### Error Response
\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  }
}
\`\`\`
    `,
    contact: {
      name: 'ProjectFlow Support',
      email: 'support@projectflow.com',
      url: 'https://projectflow.com/support',
    },
    license: {
      name: 'Elastic License 2.0',
      url: 'https://www.elastic.co/licensing/elastic-license',
    },
  },
  servers: [
    {
      url: 'https://api.projectflow.com/api/v1',
      description: 'Production server',
    },
    {
      url: 'https://staging-api.projectflow.com/api/v1',
      description: 'Staging server',
    },
    {
      url: 'http://localhost:3000/api/v1',
      description: 'Local development',
    },
  ],
  tags: [
    { name: 'Authentication', description: 'User authentication and authorization' },
    { name: 'Projects', description: 'Project management operations' },
    { name: 'Issues', description: 'Issue tracking and management' },
    { name: 'Sprints', description: 'Sprint planning and management' },
    { name: 'Boards', description: 'Kanban board operations' },
    { name: 'Comments', description: 'Issue comments and discussions' },
    { name: 'Attachments', description: 'File attachments' },
    { name: 'Users', description: 'User management' },
    { name: 'Notifications', description: 'User notifications' },
    { name: 'AI', description: 'AI-powered features' },
    { name: 'Reports', description: 'Analytics and reports' },
    { name: 'Search', description: 'Search functionality' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token',
      },
    },
    schemas: {
      // Common schemas
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid input data' },
              details: { type: 'object' },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 100 },
          totalPages: { type: 'integer', example: 5 },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          avatar: { type: 'string', format: 'uri', nullable: true },
          role: { type: 'string', enum: ['admin', 'user', 'viewer'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Project: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          key: { type: 'string', example: 'PROJ' },
          description: { type: 'string', nullable: true },
          ownerId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['active', 'archived'] },
          visibility: { type: 'string', enum: ['private', 'team', 'public'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Issue: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          key: { type: 'string', example: 'PROJ-123' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          type: { type: 'string', enum: ['bug', 'task', 'story', 'epic'] },
          status: { type: 'string' },
          priority: { type: 'string', enum: ['lowest', 'low', 'medium', 'high', 'highest'] },
          assigneeId: { type: 'string', format: 'uuid', nullable: true },
          reporterId: { type: 'string', format: 'uuid' },
          projectId: { type: 'string', format: 'uuid' },
          sprintId: { type: 'string', format: 'uuid', nullable: true },
          estimate: { type: 'number', nullable: true },
          dueDate: { type: 'string', format: 'date', nullable: true },
          labels: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Sprint: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          goal: { type: 'string', nullable: true },
          projectId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['planning', 'active', 'completed'] },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Comment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          content: { type: 'string' },
          issueId: { type: 'string', format: 'uuid' },
          authorId: { type: 'string', format: 'uuid' },
          author: { $ref: '#/components/schemas/User' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      // AI Schemas
      AIEnhancedIssue: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          suggestedType: { type: 'string' },
          suggestedPriority: { type: 'string' },
          suggestedLabels: { type: 'array', items: { type: 'string' } },
          estimatedHours: { type: 'number' },
          acceptanceCriteria: { type: 'array', items: { type: 'string' } },
        },
      },
      AIAssignment: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
          userName: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          reason: { type: 'string' },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
            example: {
              success: false,
              error: {
                code: 'UNAUTHORIZED',
                message: 'Authentication required',
              },
            },
          },
        },
      },
      Forbidden: {
        description: 'Permission denied',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      RateLimited: {
        description: 'Rate limit exceeded',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
    parameters: {
      PageParam: {
        name: 'page',
        in: 'query',
        description: 'Page number',
        schema: { type: 'integer', default: 1, minimum: 1 },
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        description: 'Items per page',
        schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
      },
      SortParam: {
        name: 'sort',
        in: 'query',
        description: 'Sort field and direction (e.g., createdAt:desc)',
        schema: { type: 'string' },
      },
      FieldsParam: {
        name: 'fields',
        in: 'query',
        description: 'Comma-separated list of fields to return',
        schema: { type: 'string' },
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: [
    './src/modules/**/routes.ts',
    './src/modules/**/controller.ts',
    './src/routes/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);

// ============================================
// DOCUMENTATION ROUTER
// ============================================

export function createDocsRouter(): Router {
  const router = Router();

  // Serve OpenAPI spec as JSON
  router.get('/openapi.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // Serve OpenAPI spec as YAML
  router.get('/openapi.yaml', (req: Request, res: Response) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const yaml = require('js-yaml');
    res.setHeader('Content-Type', 'text/yaml');
    res.send(yaml.dump(swaggerSpec));
  });

  // Swagger UI HTML
  router.get('/', (req: Request, res: Response) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ProjectFlow API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { font-size: 2rem; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: 'StandaloneLayout',
        deepLinking: true,
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        syntaxHighlight: {
          activate: true,
          theme: 'monokai'
        }
      });
    };
  </script>
</body>
</html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  // Redoc alternative UI
  router.get('/redoc', (req: Request, res: Response) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ProjectFlow API Documentation - ReDoc</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
  </style>
</head>
<body>
  <redoc spec-url='/api/docs/openapi.json'></redoc>
  <script src="https://cdn.jsdelivr.net/npm/redoc@2.1.3/bundles/redoc.standalone.js"></script>
</body>
</html>
    `;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  return router;
}

// ============================================
// API ENDPOINT DOCUMENTATION EXAMPLES
// ============================================

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login with email and password
 *     description: Authenticate user and receive JWT tokens
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 */

/**
 * @openapi
 * /projects:
 *   get:
 *     tags: [Projects]
 *     summary: List all projects
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SortParam'
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */

/**
 * @openapi
 * /ai/enhance-issue:
 *   post:
 *     tags: [AI]
 *     summary: Enhance issue with AI
 *     description: Use AI to improve issue title, description, and suggest metadata
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 description: Natural language description of the issue
 *               projectId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Enhanced issue details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/AIEnhancedIssue'
 */

export default { swaggerSpec, createDocsRouter };
