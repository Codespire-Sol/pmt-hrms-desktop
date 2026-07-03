import { Router } from 'express';
import { ProjectsController } from './projects.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { requireSystemAdmin } from '../../middleware/rbac.middleware';
import { categoriesController } from './categories.controller';
import { requirePermission } from '../../middleware/rbac.middleware';
import { TemplatesController } from './templates.controller';
import { ProjectContextController } from './project-context.controller';
const router = Router();
const projectsController = new ProjectsController();
const templatesController = new TemplatesController();
const projectContextController = new ProjectContextController();

// All routes require authentication
router.use(authenticate);

// Category routes (must be before /:projectId routes to avoid conflicts)
router.get('/categories', categoriesController.getCategories);
router.get('/categories/slug/:slug', categoriesController.getCategoryBySlug);
router.get('/categories/:id', categoriesController.getCategory);
router.post('/categories', requirePermission('admin.settings'), categoriesController.createCategory);
router.put('/categories/reorder', requirePermission('admin.settings'), categoriesController.reorderCategories);
router.put('/categories/:id', requirePermission('admin.settings'), categoriesController.updateCategory);
router.put('/categories/:id/toggle', requirePermission('admin.settings'), categoriesController.toggleCategoryActive);
router.delete('/categories/:id', requirePermission('admin.settings'), categoriesController.deleteCategory);

// Template routes (must be before /:projectId routes to avoid conflicts)
router.get('/templates', templatesController.getTemplates);
router.get('/templates/system', templatesController.getSystemTemplates);
router.get('/templates/my', templatesController.getUserTemplates);
router.get('/templates/categories', templatesController.getCategories);
router.get('/templates/:templateId', templatesController.getTemplate);
router.post('/templates', templatesController.createTemplate);
router.patch('/templates/:templateId', templatesController.updateTemplate);
router.delete('/templates/:templateId', templatesController.deleteTemplate);
router.post('/from-template', templatesController.createProjectFromTemplate);

// Projects
router.post('/', projectsController.createProject);
router.get('/', projectsController.getProjects);
// Static admin routes before /:projectId to avoid param conflicts
router.delete('/purge-all', requirePermission('admin.settings'), projectsController.purgeAllProjects);
router.get('/:projectId', projectsController.getProject);
router.patch('/:projectId', projectsController.updateProject);
router.post('/:projectId/archive', projectsController.archiveProject);
router.delete('/:projectId', projectsController.deleteProject);
router.delete('/:projectId/purge', requirePermission('admin.settings'), projectsController.hardDeleteProject);

// Admin routes
router.post('/migrate-workflows', requireSystemAdmin(), projectsController.migrateWorkflows);

// Project context (consolidated reference data for issue detail page)
router.get('/:projectId/context', projectContextController.getProjectContext);

// Project Members
router.get('/:projectId/members', projectsController.getProjectMembers);
router.post('/:projectId/members', projectsController.addProjectMember);
router.patch('/:projectId/members/:memberId', projectsController.updateMemberRole);
router.delete('/:projectId/members/:memberId', projectsController.removeProjectMember);

export default router;
