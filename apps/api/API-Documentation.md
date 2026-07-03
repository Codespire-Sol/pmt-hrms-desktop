# Project Management Tool API Documentation

## Base URL
```
http://localhost:4000/api/v1
```

## Authentication
Most endpoints require authentication using Bearer tokens (JWT). Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Authentication Endpoints

### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "token": "jwt-token"
  }
}
```

### POST /auth/login
Authenticate user and return JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "token": "jwt-token",
    "refreshToken": "refresh-token"
  }
}
```

### POST /auth/refresh
Refresh JWT token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "refresh-token"
}
```

### POST /auth/logout
Logout user and invalidate token.

**Headers:** `Authorization: Bearer <token>`

### GET /auth/me
Get current user profile.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "avatar": "avatar-url",
    "role": "user"
  }
}
```

---

## Projects Endpoints

### GET /projects
Get all projects the user has access to.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `search`: Search term
- `category`: Filter by category
- `status`: Filter by status (active, archived, on_hold)

**Response:**
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "uuid",
        "name": "Project Name",
        "key": "PROJ",
        "description": "Project description",
        "leadId": "uuid",
        "category": "Development",
        "status": "active",
        "visibility": "private",
        "startDate": "2024-01-01",
        "targetEndDate": "2024-12-31",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "totalPages": 5
    }
  }
}
```

### POST /projects
Create a new project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "New Project",
  "key": "NEW",
  "description": "Project description",
  "leadId": "uuid",
  "category": "Development",
  "visibility": "private",
  "startDate": "2024-01-01",
  "targetEndDate": "2024-12-31"
}
```

### GET /projects/:projectId
Get a specific project by ID.

**Headers:** `Authorization: Bearer <token>`

### PATCH /projects/:projectId
Update project details.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Updated Project Name",
  "description": "Updated description",
  "leadId": "uuid",
  "category": "Development",
  "status": "active",
  "visibility": "private"
}
```

### POST /projects/:projectId/archive
Archive a project.

**Headers:** `Authorization: Bearer <token>`

### DELETE /projects/:projectId
Delete a project.

**Headers:** `Authorization: Bearer <token>`

---

## Project Categories

### GET /projects/categories
Get all project categories.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Development",
      "description": "Software development projects",
      "color": "#007ACC",
      "icon": "code",
      "position": 1,
      "isActive": true,
      "projectCount": 15
    }
  ]
}
```

### GET /projects/categories/slug/:slug
Get category by slug.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/categories/:id
Get a specific category by ID.

**Headers:** `Authorization: Bearer <token>`

### POST /projects/categories
Create a new category (admin only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Research",
  "description": "Research and development projects",
  "color": "#FF6B35",
  "icon": "science",
  "position": 2
}
```

### PUT /projects/categories/reorder
Reorder categories (admin only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "categoryIds": ["uuid1", "uuid2", "uuid3"]
}
```

### PUT /projects/categories/:id
Update a category (admin only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Updated Category",
  "description": "Updated description",
  "color": "#28A745",
  "icon": "folder",
  "isActive": true,
  "position": 1
}
```

### PUT /projects/categories/:id/toggle
Toggle category active status (admin only).

**Headers:** `Authorization: Bearer <token>`

### DELETE /projects/categories/:id
Delete a category (admin only).

**Headers:** `Authorization: Bearer <token>`

---

## Project Templates

### GET /projects/templates
Get all project templates.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `category`: Filter by category

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Agile Project",
      "description": "Standard agile project setup",
      "category": "Development",
      "isSystem": false,
      "createdBy": "uuid",
      "projectCount": 25,
      "settings": {
        "workflow": "agile",
        "issueTypes": ["Story", "Task", "Bug"],
        "defaultAssignee": null
      }
    }
  ]
}
```

### GET /projects/templates/system
Get system templates.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/templates/my
Get user-created templates.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/templates/categories
Get template categories.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/templates/:templateId
Get a specific template.

**Headers:** `Authorization: Bearer <token>`

### POST /projects/templates
Create a new template.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Custom Template",
  "description": "My custom project template",
  "category": "Development",
  "settings": {
    "workflow": "kanban",
    "issueTypes": ["Task", "Bug"],
    "columns": ["To Do", "In Progress", "Done"]
  }
}
```

### PATCH /projects/templates/:templateId
Update a template.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Updated Template",
  "description": "Updated description"
}
```

### DELETE /projects/templates/:templateId
Delete a template.

**Headers:** `Authorization: Bearer <token>`

### POST /projects/from-template
Create a project from a template.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "templateId": "uuid",
  "name": "New Project",
  "key": "NEW",
  "description": "Project created from template"
}
```

---

## Admin Routes

### POST /projects/migrate-workflows
Migrate workflows (system admin only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "fromWorkflowId": "uuid",
  "toWorkflowId": "uuid",
  "projectId": "uuid"
}
```

---

## Project Members

### GET /projects/:projectId/members
Get all members of a project.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "projectId": "uuid",
      "role": "admin",
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "avatar": "avatar-url"
      },
      "joinedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /projects/:projectId/members
Add a member to a project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "userId": "uuid",
  "role": "member"
}
```

### PATCH /projects/:projectId/members/:memberId
Update member role.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "role": "admin"
}
```

### DELETE /projects/:projectId/members/:memberId
Remove a member from a project.

**Headers:** `Authorization: Bearer <token>`

---

## Issues Endpoints

### GET /issues
Get issues (global endpoint).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `search`: Search term
- `status`: Filter by status
- `priority`: Filter by priority
- `assignee`: Filter by assignee ID
- `project`: Filter by project ID

### GET /projects/:projectId/issues
Get issues for a specific project.

**Headers:** `Authorization: Bearer <token>`

### POST /projects/:projectId/issues
Create a new issue in a project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Issue Title",
  "description": "Issue description",
  "type": "task",
  "status": "todo",
  "priority": "medium",
  "assigneeId": "uuid",
  "reporterId": "uuid",
  "estimatedHours": 8,
  "dueDate": "2024-12-31"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "key": "PROJ-123",
    "title": "Issue Title",
    "description": "Issue description",
    "type": "task",
    "status": "todo",
    "priority": "medium",
    "assigneeId": "uuid",
    "reporterId": "uuid",
    "projectId": "uuid",
    "estimatedHours": 8,
    "timeSpent": 0,
    "dueDate": "2024-12-31",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
}
```

### GET /issues/:issueId
Get a specific issue by ID.

**Headers:** `Authorization: Bearer <token>`

### PATCH /issues/:issueId
Update an issue.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "status": "in_progress",
  "priority": "high",
  "assigneeId": "uuid"
}
```

### DELETE /issues/:issueId
Delete an issue.

**Headers:** `Authorization: Bearer <token>`

### POST /issues/:issueId/clone
Clone an issue.

**Headers:** `Authorization: Bearer <token>`

---

## Issue Links

### GET /issues/:issueId/links
Get links for an issue.

**Headers:** `Authorization: Bearer <token>`

### POST /issues/:issueId/links
Add a link between issues.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "targetIssueId": "uuid",
  "linkType": "blocks"
}
```

### DELETE /issues/:issueId/links/:linkId
Delete an issue link.

**Headers:** `Authorization: Bearer <token>`

---

## Sub-tasks

### GET /issues/:issueId/subtasks
Get sub-tasks for an issue.

**Headers:** `Authorization: Bearer <token>`

### GET /issues/:issueId/subtasks/progress
Get sub-task progress summary.

**Headers:** `Authorization: Bearer <token>`

---

## Voting

### POST /issues/:issueId/votes
Add vote to an issue.

**Headers:** `Authorization: Bearer <token>`

### DELETE /issues/:issueId/votes
Remove vote from an issue.

**Headers:** `Authorization: Bearer <token>`

### GET /issues/:issueId/voters
Get voters for an issue.

**Headers:** `Authorization: Bearer <token>`

### GET /issues/me/voted
Get issues voted by current user.

**Headers:** `Authorization: Bearer <token>`

---

## Watchers

### POST /issues/:issueId/watchers
Add watcher to an issue.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "userId": "uuid"
}
```

### DELETE /issues/:issueId/watchers
Remove watcher from an issue.

**Headers:** `Authorization: Bearer <token>`

### GET /issues/:issueId/watchers
Get watchers for an issue.

**Headers:** `Authorization: Bearer <token>`

### GET /issues/me/watched
Get issues watched by current user.

**Headers:** `Authorization: Bearer <token>`

---

## Boards Endpoints

### GET /projects/:projectId/board
Get board data for a project.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `view`: Board view type (kanban, timeline, etc.)
- `swimlane`: Swimlane configuration

**Response:**
```json
{
  "success": true,
  "data": {
    "columns": [
      {
        "id": "uuid",
        "name": "To Do",
        "status": "todo",
        "wipLimit": 5,
        "issues": [
          {
            "id": "uuid",
            "key": "PROJ-123",
            "title": "Issue Title",
            "status": "todo",
            "priority": "medium",
            "assignee": {
              "id": "uuid",
              "firstName": "John",
              "lastName": "Doe",
              "avatar": "avatar-url"
            }
          }
        ]
      }
    ]
  }
}
```

### GET /projects/:projectId/board/list
Get list view of project issues.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/board/timeline
Get timeline/Gantt view of project issues.

**Headers:** `Authorization: Bearer <token>`

---

## Users Endpoints

### GET /users/me
Get current user profile.

**Headers:** `Authorization: Bearer <token>`

### PATCH /users/me
Update current user profile.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "user@example.com",
  "timezone": "UTC",
  "language": "en"
}
```

### POST /users/me/avatar/upload
Upload user avatar.

**Headers:** `Authorization: Bearer <token>`

**Request:** `multipart/form-data` with `avatar` file

### DELETE /users/me/avatar
Delete user avatar.

**Headers:** `Authorization: Bearer <token>`

### GET /users/me/preferences
Get user preferences.

**Headers:** `Authorization: Bearer <token>`

### PATCH /users/me/preferences
Update user preferences.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "theme": "dark",
  "language": "en",
  "timezone": "UTC",
  "notifications": {
    "email": true,
    "push": false
  }
}
```

### GET /users/search
Search users for mentions.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `q`: Search query

### GET /users
List users (admin/team view).

**Headers:** `Authorization: Bearer <token>`

### GET /users/:userId
Get specific user by ID.

**Headers:** `Authorization: Bearer <token>`

### GET /search/quick
Quick search for command palette/autocomplete.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `q`: Search query
- `limit`: Results limit (default: 10)

### GET /search/issues
Search issues only.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `q`: Search query
- `projectId`: Filter by project
- `status`: Filter by status

### GET /search/projects
Search projects only.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `q`: Search query

### GET /search/users
Search users only.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `q`: Search query

### POST /search/natural
Natural language search using AI.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "query": "Show me high priority bugs assigned to me",
  "context": {
    "projectId": "uuid"
  }
}
```

### POST /search/semantic
Semantic search using embeddings.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "query": "Login authentication issues",
  "threshold": 0.7,
  "limit": 20
}
```

### POST /search/understand
Understand and parse search query.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "query": "bugs created last week priority high"
}
```

### POST /search/parse
Parse search query into structured format.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "query": "project = PROJ AND status = 'In Progress'"
}
```

### POST /search/ai-ranked
AI-powered ranked search results.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "query": "performance issues",
  "context": "user_recent_activity",
  "limit": 10
}
```

### GET /search/recent
Get recent items for current user.

**Headers:** `Authorization: Bearer <token>`

### POST /search/recent
Record a recent item access.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "entityType": "issue",
  "entityId": "uuid",
  "entityTitle": "PROJ-123: Login Bug"
}
```

### DELETE /search/recent
Clear recent items for current user.

**Headers:** `Authorization: Bearer <token>`

### GET /search/history
Get search history for current user.

**Headers:** `Authorization: Bearer <token>`

### DELETE /search/history
Clear search history for current user.

**Headers:** `Authorization: Bearer <token>`

### GET /search/saved
Get saved searches for current user.

**Headers:** `Authorization: Bearer <token>`

### POST /search/saved
Create a saved search.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "My High Priority Bugs",
  "query": "priority = High AND assignee = currentUser()",
  "description": "High priority bugs assigned to me"
}
```

### GET /search/saved/:id
Get a specific saved search.

**Headers:** `Authorization: Bearer <token>`

### PATCH /search/saved/:id
Update a saved search.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Updated Search Name",
  "query": "priority = High AND status = 'In Progress'"
}
```

### DELETE /search/saved/:id
Delete a saved search.

**Headers:** `Authorization: Bearer <token>`

### POST /search/saved/:id/execute
Execute a saved search.

**Headers:** `Authorization: Bearer <token>`

---

## Attachments Endpoints

### GET /attachments/config
Get upload configuration (allowed types, limits).

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "maxFileSize": 26214400,
    "maxFiles": 10,
    "allowedTypes": [
      "image/jpeg",
      "image/png",
      "application/pdf",
      "text/plain"
    ]
  }
}
```

### POST /issues/:issueId/attachments
Upload attachments to an issue.

**Headers:** `Authorization: Bearer <token>`

**Request:** `multipart/form-data` with files array

**Query Parameters:**
- `description`: Optional description for files

### GET /issues/:issueId/attachments
Get attachments for an issue.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "filename": "screenshot.png",
      "originalName": "bug-screenshot.png",
      "mimeType": "image/png",
      "size": 1024000,
      "url": "https://example.com/attachments/uuid",
      "uploadedBy": "uuid",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /comments/:commentId/attachments
Upload attachments to a comment.

**Headers:** `Authorization: Bearer <token>`

**Request:** `multipart/form-data` with files array

### GET /comments/:commentId/attachments
Get attachments for a comment.

**Headers:** `Authorization: Bearer <token>`

### GET /attachments/:attachmentId
Get attachment metadata.

**Headers:** `Authorization: Bearer <token>`

### GET /attachments/:attachmentId/download
Get attachment download URL.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://example.com/attachments/uuid/download?token=...",
    "expiresAt": "2024-01-01T01:00:00Z"
  }
}
```

### DELETE /attachments/:attachmentId
Delete an attachment.

**Headers:** `Authorization: Bearer <token>`

### POST /attachments/:attachmentId/versions
Upload a new version of an attachment.

**Headers:** `Authorization: Bearer <token>`

**Request:** `multipart/form-data` with file

### GET /attachments/:attachmentId/versions
Get version history for an attachment.

**Headers:** `Authorization: Bearer <token>`

### GET /attachments/:attachmentId/versions/latest
Get the latest version of an attachment.

**Headers:** `Authorization: Bearer <token>`

### POST /attachments/:attachmentId/versions/:versionId/revert
Revert attachment to a specific version.

**Headers:** `Authorization: Bearer <token>`

---

## Comments Endpoints

### GET /comments/:entityType/:entityId
Get comments for an entity.

**Headers:** `Authorization: Bearer <token>`

**Path Parameters:**
- `entityType`: Type of entity (issue, project, etc.)
- `entityId`: ID of the entity

### POST /comments/:entityType/:entityId
Add a comment to an entity.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "Comment content",
  "mentions": ["uuid"]
}
```

### PATCH /comments/:commentId
Update a comment.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "content": "Updated comment content"
}
```

### DELETE /comments/:commentId
Delete a comment.

**Headers:** `Authorization: Bearer <token>`

---

## Attachments Endpoints

### POST /attachments
Upload an attachment.

**Headers:** `Authorization: Bearer <token>`

**Request:** `multipart/form-data` with file and metadata

### GET /attachments/:attachmentId
Get attachment metadata.

**Headers:** `Authorization: Bearer <token>`

### GET /attachments/:attachmentId/download
Download an attachment.

**Headers:** `Authorization: Bearer <token>`

### DELETE /attachments/:attachmentId
Delete an attachment.

**Headers:** `Authorization: Bearer <token>`

---

## Notifications Endpoints

### GET /notifications
Get user notifications.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `read`: Filter by read status (true/false)

### PATCH /notifications/:notificationId/read
Mark notification as read.

**Headers:** `Authorization: Bearer <token>`

### PATCH /notifications/read-all
Mark all notifications as read.

**Headers:** `Authorization: Bearer <token>`

### DELETE /notifications/:notificationId
Delete a notification.

**Headers:** `Authorization: Bearer <token>`

---

## Search Endpoints

### GET /search
Global search across projects and issues.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `q`: Search query
- `type`: Search type (issues, projects, users, all)
- `page`: Page number
- `limit`: Items per page

---

## Time Tracking Endpoints

### GET /time-logs
Get time logs for current user.

**Headers:** `Authorization: Bearer <token>`

### POST /time-logs
Create a time log entry.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "issueId": "uuid",
  "timeSpent": 3600,
  "description": "Work done on feature",
  "date": "2024-01-01"
}
```

### GET /issues/:issueId/time-logs
Get time logs for a specific issue.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/time-report
Get time tracking report for a project.

**Headers:** `Authorization: Bearer <token>`

---

## Time Tracking Endpoints

### GET /time-logs
Get time logs for current user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `startDate`: Filter by start date
- `endDate`: Filter by end date
- `projectId`: Filter by project

### POST /time-logs
Create a time log entry.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "issueId": "uuid",
  "timeSpent": 3600,
  "description": "Work done on feature",
  "date": "2024-01-01"
}
```

### GET /time-logs/:timeLogId
Get a specific time log.

**Headers:** `Authorization: Bearer <token>`

### PATCH /time-logs/:timeLogId
Update a time log.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "timeSpent": 7200,
  "description": "Updated description"
}
```

### DELETE /time-logs/:timeLogId
Delete a time log.

**Headers:** `Authorization: Bearer <token>`

### GET /issues/:issueId/time-logs
Get time logs for a specific issue.

**Headers:** `Authorization: Bearer <token>`

### POST /issues/:issueId/time-logs
Log time for a specific issue.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "timeSpent": 3600,
  "description": "Fixed bug",
  "date": "2024-01-01"
}
```

### GET /issues/:issueId/time-logs/summary
Get time summary for an issue.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/time-report
Get time tracking report for a project.

**Headers:** `Authorization: Bearer <token>`

### GET /timer/active
Get active timer for current user.

**Headers:** `Authorization: Bearer <token>`

### POST /timer/start
Start a timer.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "issueId": "uuid",
  "description": "Working on feature"
}
```

### POST /timer/stop
Stop the active timer.

**Headers:** `Authorization: Bearer <token>`

### POST /timer/pause
Pause the active timer.

**Headers:** `Authorization: Bearer <token>`

### POST /timer/resume
Resume the paused timer.

**Headers:** `Authorization: Bearer <token>`

### GET /timesheet
Get timesheet for current user.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `startDate`: Start date
- `endDate`: End date
- `projectId`: Filter by project

### GET /time-reports/user/:userId?
Get time report for a user.

**Headers:** `Authorization: Bearer <token>`

### GET /time-logs/export
Export time logs.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `format`: Export format (csv, xlsx)
- `startDate`: Start date
- `endDate`: End date

---

## Notifications Endpoints

### GET /notifications
Get current user's notifications.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `read`: Filter by read status (true/false)
- `type`: Filter by notification type

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "issue_assigned",
      "title": "Issue Assigned",
      "message": "You have been assigned to PROJ-123",
      "read": false,
      "createdAt": "2024-01-01T00:00:00Z",
      "data": {
        "issueId": "uuid",
        "issueKey": "PROJ-123"
      }
    }
  ]
}
```

### GET /notifications/unread-count
Get unread notification count.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

### GET /notifications/types
Get available notification types.

**Headers:** `Authorization: Bearer <token>`

### POST /notifications/mark-read
Mark specific notifications as read.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "notificationIds": ["uuid1", "uuid2"]
}
```

### POST /notifications/mark-all-read
Mark all notifications as read.

**Headers:** `Authorization: Bearer <token>`

### GET /notifications/preferences
Get notification preferences.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "email": {
      "issue_assigned": true,
      "issue_updated": false,
      "comment_added": true
    },
    "push": {
      "issue_assigned": true,
      "issue_updated": true,
      "comment_added": false
    }
  }
}
```

### PUT /notifications/preferences
Update multiple notification preferences.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "email": {
    "issue_assigned": false,
    "issue_updated": true
  },
  "push": {
    "issue_assigned": true,
    "comment_added": true
  }
}
```

### PUT /notifications/preferences/:type
Update a single notification preference.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "email": true,
  "push": false
}
```

### GET /notifications/push/vapid-key
Get VAPID public key for push notifications.

**Headers:** `Authorization: Bearer <token>`

### GET /notifications/push/subscriptions
Get push notification subscriptions.

**Headers:** `Authorization: Bearer <token>`

### POST /notifications/push/subscribe
Subscribe to push notifications.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "endpoint": "https://fcm.googleapis.com/fcm/send/...",
  "keys": {
    "p256dh": "public-key",
    "auth": "auth-key"
  }
}
```

### DELETE /notifications/push/unsubscribe
Unsubscribe from push notifications.

**Headers:** `Authorization: Bearer <token>`

### DELETE /notifications/push/unsubscribe-all
Unsubscribe from all push notifications.

**Headers:** `Authorization: Bearer <token>`

### POST /notifications/push/test
Send test push notification.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Test Notification",
  "message": "This is a test notification"
}
```

### GET /issues/:issueId/activity
Get activity feed for an issue.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `type`: Activity type filter

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "type": "comment_added",
      "author": {
        "id": "uuid",
        "name": "John Doe",
        "avatar": "avatar-url"
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "data": {
        "commentId": "uuid",
        "comment": "Fixed the login issue"
      }
    }
  ]
}
```

### POST /comments/:commentId/reactions
Add a reaction to a comment.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "emoji": "👍"
}
```

### DELETE /comments/:commentId/reactions/:emoji
Remove a reaction from a comment.

**Headers:** `Authorization: Bearer <token>`

### GET /comments/reactions/emojis
Get allowed emojis for reactions.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": ["👍", "👎", "❤️", "😊", "🎉", "🤔", "👀"]
}
```

---

## Boards Endpoints

### GET /projects/:projectId/board
Get main board data for a project.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `view`: Board view type (kanban, swimlane)
- `swimlane`: Swimlane configuration

**Response:**
```json
{
  "success": true,
  "data": {
    "columns": [
      {
        "id": "uuid",
        "name": "To Do",
        "status": "todo",
        "wipLimit": 5,
        "issues": [...]
      }
    ],
    "swimlanes": [...]
  }
}
```

### GET /projects/:projectId/board/list
Get list view of project issues.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `sort`: Sort field
- `order`: Sort order (asc/desc)

### GET /projects/:projectId/board/timeline
Get timeline/Gantt view of project issues.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `startDate`: Start date for timeline
- `endDate`: End date for timeline
- `groupBy`: Group by field (assignee, version, etc.)

### PATCH /projects/:projectId/board/columns/:statusId
Update column WIP limit.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "wipLimit": 3
}
```

### GET /projects/:projectId/board/columns/:statusId/wip-check
Check WIP limit for a column.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `issueId`: Issue ID to check if it can be moved

**Response:**
```json
{
  "success": true,
  "data": {
    "canMove": false,
    "currentCount": 5,
    "limit": 5,
    "message": "Column is at WIP limit"
  }
}
```

---

## Bulk Operations

### POST /issues/bulk/update
Bulk update issues.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "issueIds": ["uuid1", "uuid2"],
  "updates": {
    "status": "in_progress",
    "priority": "high"
  }
}
```

### POST /issues/bulk/delete
Bulk delete issues.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "issueIds": ["uuid1", "uuid2"]
}
```

### POST /issues/bulk/move
Bulk move issues to another project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "issueIds": ["uuid1", "uuid2"],
  "targetProjectId": "uuid"
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  }
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Invalid request data
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `CONFLICT`: Resource conflict
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server error

---

## Rate Limiting

API endpoints are rate-limited to prevent abuse. Standard limits:
- Authentication endpoints: 5 requests per minute
- General endpoints: 100 requests per minute
- File uploads: 10 requests per minute

Rate limit headers are included in responses:
- `X-RateLimit-Limit`: Request limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time (Unix timestamp)

---

## Pagination

List endpoints support pagination with the following query parameters:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)

Paginated responses include pagination metadata:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  }
}
```

---

## Sprints Endpoints

### GET /projects/:projectId/sprints
Get all sprints for a project.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `status`: Filter by status (active, planned, completed)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Sprint 1",
      "goal": "Complete user authentication",
      "state": "active",
      "startDate": "2024-01-01",
      "endDate": "2024-01-14",
      "completeDate": null,
      "projectId": "uuid",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /projects/:projectId/sprints
Create a new sprint.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Sprint 2",
  "goal": "Implement dashboard",
  "startDate": "2024-01-15",
  "endDate": "2024-01-28"
}
```

### GET /projects/:projectId/backlog
Get project backlog (issues not in sprints).

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/velocity
Get project velocity metrics.

**Headers:** `Authorization: Bearer <token>`

### GET /sprints/:sprintId
Get a specific sprint.

**Headers:** `Authorization: Bearer <token>`

### PATCH /sprints/:sprintId
Update sprint details.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Updated Sprint Name",
  "goal": "Updated goal",
  "startDate": "2024-01-15",
  "endDate": "2024-01-28"
}
```

### DELETE /sprints/:sprintId
Delete a sprint.

**Headers:** `Authorization: Bearer <token>`

### POST /sprints/:sprintId/start
Start a sprint.

**Headers:** `Authorization: Bearer <token>`

### POST /sprints/:sprintId/complete
Complete a sprint.

**Headers:** `Authorization: Bearer <token>`

### POST /sprints/:sprintId/issues
Add issues to a sprint.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "issueIds": ["uuid1", "uuid2"]
}
```

### DELETE /sprints/:sprintId/issues/:issueId
Remove an issue from a sprint.

**Headers:** `Authorization: Bearer <token>`

### GET /sprints/:sprintId/burndown
Get sprint burndown chart data.

**Headers:** `Authorization: Bearer <token>`

### GET /sprints/:sprintId/burnup
Get sprint burnup chart data.

**Headers:** `Authorization: Bearer <token>`

### GET /sprints/:sprintId/over-commitment
Check for sprint over-commitment.

**Headers:** `Authorization: Bearer <token>`

---

## Workflows Endpoints

### GET /workflows
Get all workflows.

**Headers:** `Authorization: Bearer <token>`

### POST /workflows
Create a new workflow.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Bug Workflow",
  "description": "Workflow for bug tracking",
  "projectId": "uuid"
}
```

### GET /workflows/:workflowId
Get a specific workflow.

**Headers:** `Authorization: Bearer <token>`

### PATCH /workflows/:workflowId
Update workflow.

**Headers:** `Authorization: Bearer <token>`

### DELETE /workflows/:workflowId
Delete workflow.

**Headers:** `Authorization: Bearer <token>`

### GET /workflows/:workflowId/statuses
Get workflow statuses.

**Headers:** `Authorization: Bearer <token>`

### POST /workflows/:workflowId/statuses
Create a workflow status.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "In Progress",
  "category": "in_progress",
  "color": "#blue"
}
```

### POST /workflows/:workflowId/statuses/reorder
Reorder workflow statuses.

**Headers:** `Authorization: Bearer <token>`

### PATCH /workflows/statuses/:statusId
Update a workflow status.

**Headers:** `Authorization: Bearer <token>`

### DELETE /workflows/statuses/:statusId
Delete a workflow status.

**Headers:** `Authorization: Bearer <token>`

### GET /workflows/:workflowId/transitions
Get workflow transitions.

**Headers:** `Authorization: Bearer <token>`

### POST /workflows/:workflowId/transitions
Add a workflow transition.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Start Progress",
  "fromStatusId": "uuid",
  "toStatusId": "uuid",
  "type": "global"
}
```

### PUT /workflows/:workflowId/transitions
Set workflow transitions.

**Headers:** `Authorization: Bearer <token>`

### DELETE /workflows/transitions/:transitionId
Remove a workflow transition.

**Headers:** `Authorization: Bearer <token>`

### GET /workflows/statuses/:statusId/available-transitions
Get available transitions for a status.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/workflow
Get project-specific workflow.

**Headers:** `Authorization: Bearer <token>`

---

## Custom Fields Endpoints

### GET /custom-fields
Get all global custom fields.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `type`: Filter by field type
- `search`: Search by field name

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Business Value",
      "type": "number",
      "description": "Business value score",
      "isRequired": false,
      "isGlobal": true,
      "options": null,
      "defaultValue": null
    }
  ]
}
```

### POST /custom-fields
Create a new global custom field.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Business Value",
  "type": "number",
  "description": "Business value score",
  "isRequired": false,
  "defaultValue": 0
}
```

### GET /custom-fields/:fieldId
Get a specific custom field.

**Headers:** `Authorization: Bearer <token>`

### PATCH /custom-fields/:fieldId
Update a custom field.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Updated Field Name",
  "description": "Updated description"
}
```

### DELETE /custom-fields/:fieldId
Delete a custom field.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/custom-fields
Get custom fields for a project.

**Headers:** `Authorization: Bearer <token>`

### POST /projects/:projectId/custom-fields
Create a custom field for a project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Business Value",
  "type": "number",
  "description": "Business value score",
  "required": false
}
```

### POST /projects/:projectId/custom-fields/reorder
Reorder custom fields.

**Headers:** `Authorization: Bearer <token>`

### GET /issues/:issueId/custom-fields
Get custom field values for an issue.

**Headers:** `Authorization: Bearer <token>`

### PUT /issues/:issueId/custom-fields
Set multiple custom field values for an issue.

**Headers:** `Authorization: Bearer <token>`

### PUT /issues/:issueId/custom-fields/:fieldId
Set a specific custom field value for an issue.

**Headers:** `Authorization: Bearer <token>`

### DELETE /issues/:issueId/custom-fields/:fieldId
Delete a custom field value for an issue.

**Headers:** `Authorization: Bearer <token>`

---

## Components Endpoints

### GET /projects/:projectId/components
Get components for a project.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Frontend",
      "description": "UI components",
      "leadId": "uuid",
      "projectId": "uuid",
      "issueCount": 15
    }
  ]
}
```

### POST /projects/:projectId/components
Create a component for a project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Backend",
  "description": "API components",
  "leadId": "uuid"
}
```

### DELETE /components/:componentId/issues
Remove an issue from a component.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `issueId`: Issue ID to remove

---

## Versions Endpoints

### GET /versions
Get all versions.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: Page number
- `limit`: Items per page
- `projectId`: Filter by project
- `status`: Filter by status (unreleased, released, archived)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "v1.0.0",
      "description": "First major release",
      "projectId": "uuid",
      "status": "released",
      "releaseDate": "2024-01-01T00:00:00Z",
      "issueCount": 25
    }
  ]
}
```

### POST /versions
Create a new version.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "v1.1.0",
  "description": "Feature update release",
  "projectId": "uuid",
  "releaseDate": "2024-02-01T00:00:00Z"
}
```

### GET /projects/:projectId/versions
Get versions for a project.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "v1.0.0",
      "description": "First major release",
      "status": "released",
      "releaseDate": "2024-01-01T00:00:00Z",
      "issueCount": 25
    }
  ]
}
```

### POST /projects/:projectId/versions
Create a version for a project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "v1.1.0",
  "description": "Feature update release",
  "releaseDate": "2024-02-01T00:00:00Z"
}
```

### POST /projects/:projectId/versions/reorder
Reorder project versions.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "versionIds": ["uuid1", "uuid2", "uuid3"]
}
```

### GET /versions/:versionId
Get a specific version.

**Headers:** `Authorization: Bearer <token>`

### PATCH /versions/:versionId
Update a version.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Updated Version Name",
  "description": "Updated description",
  "releaseDate": "2024-02-15T00:00:00Z"
}
```

### DELETE /versions/:versionId
Delete a version.

**Headers:** `Authorization: Bearer <token>`

### POST /versions/:versionId/release
Release a version.

**Headers:** `Authorization: Bearer <token>`

### POST /versions/:versionId/archive
Archive a version.

**Headers:** `Authorization: Bearer <token>`

### POST /versions/:versionId/unarchive
Unarchive a version.

**Headers:** `Authorization: Bearer <token>`

### GET /versions/:versionId/issues
Get issues in a version.

**Headers:** `Authorization: Bearer <token>`

---

## Security Levels Endpoints

### GET /projects/:projectId/security-levels
Get security levels for a project.

**Headers:** `Authorization: Bearer <token>`

### POST /projects/:projectId/security-levels
Create a security level for a project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Internal",
  "description": "Internal access only",
  "level": 1
}
```

### POST /projects/:projectId/security-levels/reorder
Reorder security levels.

**Headers:** `Authorization: Bearer <token>`

### GET /security-levels/:levelId
Get a specific security level.

**Headers:** `Authorization: Bearer <token>`

### PATCH /security-levels/:levelId
Update a security level.

**Headers:** `Authorization: Bearer <token>`

### DELETE /security-levels/:levelId
Delete a security level.

**Headers:** `Authorization: Bearer <token>`

---

## Dashboard Endpoints

### GET /dashboard
Get user dashboard.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "assignedIssues": [...],
    "recentActivity": [...],
    "dueSoonIssues": [...],
    "widgets": [...]
  }
}
```

### GET /dashboard/full
Get full user dashboard with all widgets.

**Headers:** `Authorization: Bearer <token>`

### GET /dashboard/assigned-issues
Get issues assigned to current user.

**Headers:** `Authorization: Bearer <token>`

### GET /dashboard/recent-activity
Get recent activity for current user.

**Headers:** `Authorization: Bearer <token>`

### GET /dashboard/due-soon
Get issues due soon for current user.

**Headers:** `Authorization: Bearer <token>`

### GET /dashboard/preferences
Get dashboard preferences.

**Headers:** `Authorization: Bearer <token>`

### PATCH /dashboard/preferences
Update dashboard preferences.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "widgets": [
    {
      "id": "assigned-issues",
      "position": { "x": 0, "y": 0, "w": 6, "h": 4 },
      "config": { "limit": 10 }
    }
  ]
}
```

### POST /dashboard/preferences/reset
Reset dashboard preferences to defaults.

**Headers:** `Authorization: Bearer <token>`

### POST /dashboard/shares
Share dashboard with other users.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "userId": "uuid",
  "permission": "view"
}
```

### GET /dashboard/shared-with-me
Get dashboards shared with current user.

**Headers:** `Authorization: Bearer <token>`

### GET /dashboard/shared/:token
Get shared dashboard by token.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/dashboard
Get project dashboard.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/dashboard/full
Get full project dashboard.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/dashboard/preferences
Get project dashboard preferences.

**Headers:** `Authorization: Bearer <token>`

### PATCH /projects/:projectId/dashboard/preferences
Update project dashboard preferences.

**Headers:** `Authorization: Bearer <token>`

---

## Reports Endpoints

### GET /reports/time-tracking
Get time tracking report.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `projectId`: Filter by project
- `userId`: Filter by user
- `startDate`: Start date
- `endDate`: End date

### GET /reports/time-tracking/export
Export time tracking report.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/reports/sprint
Get sprint report for a project.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/reports/team-workload
Get team workload report.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/reports/distribution
Get issue distribution report.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/reports/estimate-actual
Get estimate vs actual report.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/reports/cumulative-flow
Get cumulative flow diagram.

**Headers:** `Authorization: Bearer <token>`

### GET /projects/:projectId/reports/cycle-time
Get cycle time analytics.

**Headers:** `Authorization: Bearer <token>`

### GET /sprints/:sprintId/reports/burndown
Get sprint burndown report.

**Headers:** `Authorization: Bearer <token>`

---

## Scheduled Reports

### GET /reports/scheduled
Get scheduled reports.

**Headers:** `Authorization: Bearer <token>`

### POST /reports/scheduled
Create a scheduled report.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Weekly Status Report",
  "type": "time-tracking",
  "schedule": "0 9 * * 1",
  "recipients": ["user@example.com"],
  "filters": {
    "projectId": "uuid",
    "dateRange": "last-7-days"
  }
}
```

### GET /reports/scheduled/:reportId
Get a specific scheduled report.

**Headers:** `Authorization: Bearer <token>`

### PATCH /reports/scheduled/:reportId
Update a scheduled report.

**Headers:** `Authorization: Bearer <token>`

### DELETE /reports/scheduled/:reportId
Delete a scheduled report.

**Headers:** `Authorization: Bearer <token>`

### GET /reports/scheduled/:reportId/history
Get execution history for a scheduled report.

**Headers:** `Authorization: Bearer <token>`

### POST /reports/scheduled/:reportId/send
Send scheduled report now.

**Headers:** `Authorization: Bearer <token>`

### POST /reports/scheduled/:reportId/toggle
Toggle scheduled report active/inactive.

**Headers:** `Authorization: Bearer <token>`

---

## AI Endpoints

### GET /ai/health
Health check for AI service.

### POST /ai/issues/suggest
Get AI-powered issue suggestions.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "User login issue",
  "description": "Users cannot login to the system",
  "projectId": "uuid"
}
```

### POST /ai/issues/similar
Find similar issues using AI.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "Login problem",
  "description": "Cannot access account",
  "projectId": "uuid",
  "limit": 5
}
```

### POST /ai/issues/parse
Parse natural language into structured issue data.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "text": "Fix the login bug that prevents users from accessing their dashboard",
  "projectId": "uuid"
}
```

### POST /ai/issues/estimate-points
Estimate story points for an issue.

**Headers:** `Authorization: Bearer <token>`

### POST /ai/issues/suggest-assignee
Suggest best assignee for an issue.

**Headers:** `Authorization: Bearer <token>`

### GET /ai/issues/team-expertise/:projectId
Get team expertise analysis.

**Headers:** `Authorization: Bearer <token>`

### POST /ai/writing/improve
Improve text quality using AI.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "text": "The thing is broken",
  "context": "issue_description",
  "tone": "professional"
}
```

### POST /ai/writing/acceptance-criteria
Generate acceptance criteria.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "title": "User Authentication",
  "description": "Implement login system"
}
```

### POST /ai/writing/summarize
Summarize text using AI.

**Headers:** `Authorization: Bearer <token>`

### POST /ai/planning/sprint-scope
Get AI-recommended sprint scope.

**Headers:** `Authorization: Bearer <token>`

### POST /ai/planning/workload-analysis
Analyze team workload.

**Headers:** `Authorization: Bearer <token>`

### POST /ai/planning/predict-completion
Predict sprint completion date.

**Headers:** `Authorization: Bearer <token>`

### POST /ai/predictions/project-risks
Analyze project risks.

**Headers:** `Authorization: Bearer <token>`

### POST /ai/predictions/issue-completion
Predict issue completion probability.

**Headers:** `Authorization: Bearer <token>`

### POST /ai/meeting-notes/parse
Parse meeting notes into actionable items.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "notes": "Meeting notes text...",
  "meetingType": "sprint-planning"
}
```

---

## Slack Integration Endpoints

### POST /integrations/slack/webhooks/command
Handle Slack slash commands.

### POST /integrations/slack/webhooks/interaction
Handle Slack interactions.

### GET /integrations/slack/:projectId/oauth-url
Get Slack OAuth URL for project.

**Headers:** `Authorization: Bearer <token>`

### POST /integrations/slack/:projectId/install
Install Slack integration for project.

**Headers:** `Authorization: Bearer <token>`

### DELETE /integrations/slack/:projectId/disconnect
Disconnect Slack integration.

**Headers:** `Authorization: Bearer <token>`

### GET /integrations/slack/:projectId/status
Get Slack integration status.

**Headers:** `Authorization: Bearer <token>`

### GET /integrations/slack/:projectId/channels
List available Slack channels.

**Headers:** `Authorization: Bearer <token>`

### POST /integrations/slack/:projectId/channel-configs
Configure Slack channel notifications.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "channelId": "C1234567890",
  "events": ["issue.created", "issue.updated"],
  "filters": {
    "projectId": "uuid"
  }
}
```

---

## GitHub Integration Endpoints

### POST /integrations/github/webhooks
Handle GitHub webhooks.

### GET /integrations/github/:projectId/installation-url
Get GitHub app installation URL.

**Headers:** `Authorization: Bearer <token>`

### GET /integrations/github/:projectId/status
Get GitHub integration status.

**Headers:** `Authorization: Bearer <token>`

### POST /integrations/github/:projectId/connect
Connect GitHub repository to project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "repositoryId": "123456",
  "installationId": "7890"
}
```

### GET /integrations/github/issues/:issueId/code-activity
Get code activity for an issue.

**Headers:** `Authorization: Bearer <token>`

---

## Calendar Integration Endpoints

### GET /integrations/calendar/oauth-url
Get calendar OAuth URL.

**Headers:** `Authorization: Bearer <token>`

### POST /integrations/calendar/connect
Handle calendar OAuth callback.

**Headers:** `Authorization: Bearer <token>`

### GET /integrations/calendar/status
Get calendar integration status.

**Headers:** `Authorization: Bearer <token>`

### GET /integrations/calendar/calendars
List available calendars.

**Headers:** `Authorization: Bearer <token>`

### POST /integrations/calendar/calendars/select
Select calendar for sync.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "calendarId": "primary",
  "syncEvents": true
}
```

### POST /integrations/calendar/sync/issue
Sync issue due date to calendar.

**Headers:** `Authorization: Bearer <token>`

---

## RBAC (Role-Based Access Control) Endpoints

### GET /rbac/me/permissions
Get current user's permissions.

**Headers:** `Authorization: Bearer <token>`

### GET /rbac/roles
Get all roles.

**Headers:** `Authorization: Bearer <token>`

### GET /rbac/roles/:roleId
Get a specific role.

**Headers:** `Authorization: Bearer <token>`

### POST /rbac/roles
Create a new role (admin only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Project Manager",
  "description": "Can manage projects",
  "system": false
}
```

### PUT /rbac/roles/:roleId
Update a role (admin only).

**Headers:** `Authorization: Bearer <token>`

### DELETE /rbac/roles/:roleId
Delete a role (admin only).

**Headers:** `Authorization: Bearer <token>`

### GET /rbac/permissions
Get all permissions (admin only).

**Headers:** `Authorization: Bearer <token>`

### GET /rbac/users
Get users with their roles (admin only).

**Headers:** `Authorization: Bearer <token>`

### POST /rbac/users/:userId/role
Assign role to user (admin only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "roleId": "uuid"
}
```

### DELETE /rbac/users/:userId/role
Remove role from user (admin only).

**Headers:** `Authorization: Bearer <token>`

---

## Automation Endpoints

### GET /automation/fields
Get available fields for automation rules.

**Headers:** `Authorization: Bearer <token>`

### GET /automation/triggers
Get available trigger types.

**Headers:** `Authorization: Bearer <token>`

### GET /automation/actions
Get available action types.

**Headers:** `Authorization: Bearer <token>`

### POST /automation/projects/:projectId/rules
Create an automation rule.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Auto-assign bugs",
  "description": "Assign bug reports to QA team",
  "trigger": {
    "type": "issue_created",
    "conditions": [
      {
        "field": "issueType",
        "operator": "equals",
        "value": "Bug"
      }
    ]
  },
  "actions": [
    {
      "type": "assign_issue",
      "parameters": {
        "assigneeId": "uuid"
      }
    }
  ],
  "enabled": true
}
```

### GET /automation/projects/:projectId/rules
Get automation rules for a project.

**Headers:** `Authorization: Bearer <token>`

### GET /automation/rules/:ruleId
Get a specific automation rule.

**Headers:** `Authorization: Bearer <token>`

### PATCH /automation/rules/:ruleId
Update an automation rule.

**Headers:** `Authorization: Bearer <token>`

### DELETE /automation/rules/:ruleId
Delete an automation rule.

**Headers:** `Authorization: Bearer <token>`

### POST /automation/rules/:ruleId/toggle
Toggle automation rule enabled/disabled.

**Headers:** `Authorization: Bearer <token>`

### POST /automation/rules/:ruleId/trigger
Manually trigger an automation rule.

**Headers:** `Authorization: Bearer <token>`

---

## Reference Data Endpoints

### GET /reference/issue-types
Get available issue types.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Bug",
      "description": "Software bug",
      "icon": "bug",
      "color": "#red"
    },
    {
      "id": "uuid",
      "name": "Story",
      "description": "User story",
      "icon": "story",
      "color": "#blue"
    }
  ]
}
```

### GET /reference/priorities
Get available priorities.

**Headers:** `Authorization: Bearer <token>`

### GET /reference/statuses
Get available statuses.

**Headers:** `Authorization: Bearer <token>`

### GET /reference/labels
Get available labels.

**Headers:** `Authorization: Bearer <token>`

### POST /reference/issue-types
Create a new issue type (admin only).

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Task",
  "description": "General task",
  "icon": "task",
  "color": "#green"
}
```

---

## Search and Filters Endpoints

### GET /search
Global search across entities.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `q`: Search query
- `type`: Entity type (issues, projects, users)
- `page`: Page number
- `limit`: Results per page

### POST /search/filters
Create a saved filter.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "My High Priority Bugs",
  "description": "High priority bugs assigned to me",
  "jql": "priority = High AND assignee = currentUser() AND type = Bug",
  "isPublic": false
}
```

### GET /search/filters
Get saved filters.

**Headers:** `Authorization: Bearer <token>`

### GET /search/filters/:filterId
Get a specific saved filter.

**Headers:** `Authorization: Bearer <token>`

### PATCH /search/filters/:filterId
Update a saved filter.

**Headers:** `Authorization: Bearer <token>`

### DELETE /search/filters/:filterId
Delete a saved filter.

**Headers:** `Authorization: Bearer <token>`

### GET /search/filters/:filterId/execute
Execute a saved filter.

**Headers:** `Authorization: Bearer <token>`

### POST /search/filters/jql/execute
Execute JQL query.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "jql": "project = PROJ AND status = 'In Progress'",
  "page": 1,
  "limit": 50
}
```

---

## Screens Endpoints

### GET /screens/fields/system
Get system fields reference.

**Headers:** `Authorization: Bearer <token>`

### GET /screens/for-issue
Get screen configuration for an issue.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `issueTypeId`: Issue type ID
- `projectId`: Project ID

### POST /screens
Create a new screen.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Bug Screen",
  "description": "Screen for bug issues"
}
```

### GET /screens
Get all screens.

**Headers:** `Authorization: Bearer <token>`

### GET /screens/:screenId
Get a specific screen.

**Headers:** `Authorization: Bearer <token>`

### PATCH /screens/:screenId
Update a screen.

**Headers:** `Authorization: Bearer <token>`

### DELETE /screens/:screenId
Delete a screen.

**Headers:** `Authorization: Bearer <token>`

---

## WIP (Work In Progress) Limits Endpoints

### GET /wip/boards/:boardId/wip-settings
Get WIP settings for a board.

**Headers:** `Authorization: Bearer <token>`

### PATCH /wip/boards/:boardId/wip-settings
Update WIP settings for a board.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "enabled": true,
  "defaultLimit": 5,
  "strictMode": false
}
```

### GET /wip/boards/:boardId/wip-limits
Get WIP limits for board columns.

**Headers:** `Authorization: Bearer <token>`

### PATCH /wip/columns/:columnId/wip-limit
Update WIP limit for a column.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "limit": 3
}
```

### GET /wip/boards/:boardId/wip-status
Get WIP status for a board.

**Headers:** `Authorization: Bearer <token>`

### GET /wip/boards/:boardId/can-move
Check if issue can be moved (WIP check).

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `issueId`: Issue ID
- `targetColumnId`: Target column ID

---

## Workflow Configuration Endpoints

### GET /workflow-config/condition-types
Get available condition types.

**Headers:** `Authorization: Bearer <token>`

### GET /workflow-config/validator-types
Get available validator types.

**Headers:** `Authorization: Bearer <token>`

### POST /workflow-config/transitions/:transitionId/conditions
Create transition condition.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "type": "permission_condition",
  "parameters": {
    "permission": "assign_issue"
  }
}
```

### GET /workflow-config/transitions/:transitionId/conditions
Get transition conditions.

**Headers:** `Authorization: Bearer <token>`

### POST /workflow-config/transitions/:transitionId/approval
Set approval configuration for transition.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "required": true,
  "approvers": ["uuid1", "uuid2"],
  "minApprovals": 2
}
```

### POST /workflow-config/issues/:issueId/transitions/:transitionId/request-approval
Request approval for issue transition.

**Headers:** `Authorization: Bearer <token>`

### POST /workflow-config/approvals/:approvalId/respond
Respond to approval request.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "decision": "approved",
  "comment": "Looks good to me"
}
```

---

## Webhooks Endpoints

### GET /webhooks/events
Get available webhook events.

**Headers:** `Authorization: Bearer <token>`

### POST /webhooks/projects/:projectId/webhooks
Create a webhook for a project.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "name": "Issue Updates",
  "url": "https://example.com/webhook",
  "events": ["issue.created", "issue.updated"],
  "secret": "webhook-secret",
  "active": true
}
```

### GET /webhooks/projects/:projectId/webhooks
Get webhooks for a project.

**Headers:** `Authorization: Bearer <token>`

### GET /webhooks/webhooks/:webhookId
Get a specific webhook.

**Headers:** `Authorization: Bearer <token>`

### PATCH /webhooks/webhooks/:webhookId
Update a webhook.

**Headers:** `Authorization: Bearer <token>`

### DELETE /webhooks/webhooks/:webhookId
Delete a webhook.

**Headers:** `Authorization: Bearer <token>`

### POST /webhooks/webhooks/:webhookId/test
Test a webhook.

**Headers:** `Authorization: Bearer <token>`

### GET /webhooks/webhooks/:webhookId/deliveries
Get webhook delivery logs.

**Headers:** `Authorization: Bearer <token>`

---

## Static Files

### GET /uploads/:filename
Serve uploaded files statically.

**Headers:** No authentication required for public files

**Path Parameters:**
- `filename`: Name of the file to serve

**Example:**
```
GET /uploads/avatar_1234567890.jpg
```

**Response:** Direct file content with appropriate MIME type

---

## Health Check

### GET /health
Check API health status.

**Response:**
```json
{
  "success": true,
  "message": "Server is healthy",
  "environment": "development",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

---

*This documentation covers all API endpoints available in the project management tool application. Each endpoint includes the HTTP method, URL path, required headers, request/response examples, and query parameters where applicable.*
