import {
  workflowsRepository,
  Workflow,
  Status,
  StatusTransition,
} from './workflows.repository';
import { WORKFLOW_TEMPLATES, findTemplate } from './workflow-templates';
import { transitionConditionsService } from './transition-conditions.service';
import { prisma } from '../../database/prisma';

export interface WorkflowWithStatuses extends Workflow {
  statuses: Status[];
  transitions: StatusTransition[];
}

class WorkflowsService {
  /**
   * Ensure the global default workflow exists and has the standard statuses seeded.
   * Called on startup / first load to guarantee the default is fully populated.
   */
  async ensureDefaultWorkflow(): Promise<void> {
    const workflow = await workflowsRepository.findOrCreateGlobalDefault();
    const statuses = await workflowsRepository.findStatusesByWorkflow(workflow.id);

    // 7-status simplified workflow
    const EXPECTED = [
      { name: 'todo',            displayName: 'To Do',           color: '#94a3b8', category: 'todo'        as const, isInitial: true,  isFinal: false, position: 0 },
      { name: 'in_progress',     displayName: 'In Progress',     color: '#3b82f6', category: 'in_progress' as const, isInitial: false, isFinal: false, position: 1 },
      { name: 'dev_done',        displayName: 'Dev Done',        color: '#8b5cf6', category: 'dev_done'    as const, isInitial: false, isFinal: false, position: 2 },
      { name: 'testing',         displayName: 'Testing',         color: '#f59e0b', category: 'testing'     as const, isInitial: false, isFinal: false, position: 3 },
      { name: 'completed',       displayName: 'Completed',       color: '#22c55e', category: 'done'        as const, isInitial: false, isFinal: true,  position: 4 },
      { name: 'on_hold',         displayName: 'On Hold',         color: '#6b7280', category: 'todo'        as const, isInitial: false, isFinal: false, position: 5 },
      { name: 'rejected',        displayName: 'Rejected',        color: '#991b1b', category: 'done'        as const, isInitial: false, isFinal: true,  position: 6 },
    ];

    // Simplified transition definitions
    const TRANSITION_DEFS = [
      // Main flow
      ['todo',            'in_progress',     'Start Progress'  ],
      ['in_progress',     'dev_done',        'Dev Done'        ],
      ['dev_done',        'testing',         'Send to Testing' ],
      ['testing',         'completed',       'Complete'        ],
      // Rework
      ['testing',         'in_progress',     'Rework'          ],
      ['dev_done',        'in_progress',     'Rework'          ],
      // Hold / Reject
      ['todo',            'on_hold',         'Put On Hold'     ],
      ['in_progress',     'on_hold',         'Put On Hold'     ],
      ['on_hold',         'todo',            'Resume'          ],
      ['todo',            'rejected',        'Reject'          ],
      ['rejected',        'todo',            'Reopen'          ],
    ] satisfies [string, string, string][];

    const expectedNames = new Set(EXPECTED.map((s) => s.name));
    const existingByName = new Map(statuses.map((s) => [s.name, s]));
    const allStatusesPresent = EXPECTED.every((s) => existingByName.has(s.name));

    // Migrate statuses if needed
    if (!allStatusesPresent) {
      // Best-effort: remove old statuses not in the expected set
      for (const status of statuses) {
        if (!expectedNames.has(status.name)) {
          try {
            await workflowsRepository.deleteStatus(status.id);
          } catch {
            // Status is still in use — leave it in place
          }
        }
      }
    }

    // Build name→id map (reload after potential deletions/creates)
    const current = await workflowsRepository.findStatusesByWorkflow(workflow.id);
    const statusMap = new Map<string, string>();
    for (const s of current) statusMap.set(s.name, s.id);

    // Create any missing expected statuses
    for (const expected of EXPECTED) {
      if (!statusMap.has(expected.name)) {
        const created = await workflowsRepository.createStatus({
          workflowId: workflow.id,
          name: expected.name,
          displayName: expected.displayName,
          color: expected.color,
          category: expected.category,
          isInitial: expected.isInitial,
          isFinal: expected.isFinal,
          position: expected.position,
        });
        statusMap.set(expected.name, created.id);
      }
    }

    // Build the expected transition list
    const transitions = TRANSITION_DEFS
      .map(([from, to, name]) => {
        const fromId = statusMap.get(from);
        const toId   = statusMap.get(to);
        return (fromId && toId) ? { fromStatusId: fromId, toStatusId: toId, name } : null;
      })
      .filter((t): t is { fromStatusId: string; toStatusId: string; name: string } => t !== null);

    // Only reset transitions if the count differs (avoids unnecessary writes)
    const existing = await workflowsRepository.findTransitionsByWorkflow(workflow.id);
    if (existing.length !== transitions.length) {
      await workflowsRepository.setTransitions(workflow.id, transitions);
    }
  }

  /**
   * Get all workflows (optionally filtered by project).
   * Always includes the global default workflow exactly once.
   */
  async getWorkflows(projectId?: string): Promise<Workflow[]> {
    // Ensure the global default exists and is seeded before returning the list
    await this.ensureDefaultWorkflow();
    const workflows = await workflowsRepository.findAll(projectId);

    // Deduplicate: if the same workflow appears multiple times keep only first occurrence
    const seen = new Set<string>();
    return workflows.filter((w) => {
      if (seen.has(w.id)) return false;
      seen.add(w.id);
      return true;
    });
  }

  /**
   * Get a workflow by ID with all its statuses and transitions
   */
  async getWorkflow(workflowId: string): Promise<WorkflowWithStatuses> {
    const workflow = await workflowsRepository.findById(workflowId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const [statuses, transitions] = await Promise.all([
      workflowsRepository.findStatusesByWorkflow(workflowId),
      workflowsRepository.findTransitionsByWorkflow(workflowId),
    ]);

    return { ...workflow, statuses, transitions };
  }

  /**
   * Get the workflow for a specific project.
   * Resolution order: project-specific → global default → any default
   */
  async getProjectWorkflow(projectId: string): Promise<WorkflowWithStatuses> {
    let workflow = await workflowsRepository.findByProject(projectId);

    if (!workflow) {
      workflow = await workflowsRepository.findDefault();
    }

    if (!workflow) {
      throw new Error('No workflow found');
    }

    const [statuses, transitions] = await Promise.all([
      workflowsRepository.findStatusesByWorkflow(workflow.id),
      workflowsRepository.findTransitionsByWorkflow(workflow.id),
    ]);

    return { ...workflow, statuses, transitions };
  }

  /**
   * Assign a global workflow to a project.
   * Replaces any existing project-specific workflow by:
   *  1. Finding the current project workflow(s) and unlinking/deleting them (if no issues)
   *  2. Duplicating the selected global workflow with projectId = this project
   */
  async assignWorkflowToProject(projectId: string, globalWorkflowId: string): Promise<WorkflowWithStatuses> {
    // Verify source workflow exists
    const source = await workflowsRepository.findById(globalWorkflowId);
    if (!source) {
      throw new Error('Source workflow not found');
    }

    // Collect existing project-specific workflow statuses (for issue migration)
    const existingWorkflows = await prisma.workflow.findMany({
      where: { projectId },
      select: {
        id: true,
        statuses: { select: { id: true, name: true, category: true } },
      },
    });

    // Build old statusId → status info map (for migrating issues)
    const oldStatusMap = new Map<string, { name: string; category: string }>();
    for (const w of existingWorkflows) {
      for (const s of w.statuses) {
        oldStatusMap.set(s.id, { name: s.name, category: s.category });
      }
    }

    // Duplicate the global workflow for this project first (to get new status IDs)
    const newWorkflow = await workflowsRepository.duplicate(globalWorkflowId, source.name, projectId);
    const newStatuses = await workflowsRepository.findStatusesByWorkflow(newWorkflow.id);

    // Build a lookup: status name → new status id, and category → first new status id
    const newStatusByName = new Map(newStatuses.map((s) => [s.name, s.id]));
    const newStatusByCategory = new Map<string, string>();
    for (const s of newStatuses) {
      if (!newStatusByCategory.has(s.category)) {
        newStatusByCategory.set(s.category, s.id);
      }
    }

    // Migrate all project issues: reassign statusId from old to new workflow statuses
    const issuesInProject = await prisma.issue.findMany({
      where: { projectId, deletedAt: null },
      select: { id: true, statusId: true },
    });

    for (const issue of issuesInProject) {
      const oldInfo = oldStatusMap.get(issue.statusId);
      if (!oldInfo) continue; // Issue already on new workflow status

      // Try to find matching status by name, then by category, then first status
      const newStatusId =
        newStatusByName.get(oldInfo.name) ??
        newStatusByCategory.get(oldInfo.category) ??
        newStatuses[0]?.id;

      if (newStatusId && newStatusId !== issue.statusId) {
        await prisma.issue.update({
          where: { id: issue.id },
          data: { statusId: newStatusId },
        });
      }
    }

    // Remove old project workflows (safe to delete now since issues are migrated)
    for (const w of existingWorkflows) {
      try {
        await workflowsRepository.delete(w.id);
      } catch {
        // Still has references (e.g. board columns) — just unlink from project
        await prisma.workflow.update({
          where: { id: w.id },
          data: { projectId: null },
        });
      }
    }

    return this.getWorkflow(newWorkflow.id);
  }

  /**
   * Create a new workflow (optionally from a built-in template or by copying an existing one)
   */
  async createWorkflow(data: {
    name: string;
    description?: string;
    projectId?: string | null;
    copyFromId?: string;
    fromTemplate?: string;
  }): Promise<WorkflowWithStatuses> {
    if (data.fromTemplate) {
      return this.createFromTemplate(data.fromTemplate, data.name, data.description, data.projectId ?? undefined);
    }

    let workflow: Workflow;

    if (data.copyFromId) {
      workflow = await workflowsRepository.duplicate(
        data.copyFromId,
        data.name,
        data.projectId ?? null
      );
    } else {
      workflow = await workflowsRepository.create({
        name: data.name,
        description: data.description,
        projectId: data.projectId ?? null,
      });
    }

    return this.getWorkflow(workflow.id);
  }

  /**
   * Get the list of built-in workflow templates
   */
  getTemplates(): Array<{
    id: string;
    name: string;
    description: string;
    statusCount: number;
    transitionCount: number;
  }> {
    return WORKFLOW_TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      statusCount: t.statuses.length,
      transitionCount: t.transitions.length,
    }));
  }

  /**
   * Create a workflow pre-populated from a built-in template.
   */
  async createFromTemplate(
    templateId: string,
    name: string,
    description?: string,
    projectId?: string
  ): Promise<WorkflowWithStatuses> {
    const template = findTemplate(templateId);
    if (!template) {
      throw new Error(`Workflow template '${templateId}' not found`);
    }

    const workflow = await workflowsRepository.create({
      name,
      description: description ?? template.description,
      projectId: projectId ?? null,
    });

    const statusNameToId = new Map<string, string>();
    for (const statusDef of template.statuses) {
      const status = await workflowsRepository.createStatus({
        workflowId: workflow.id,
        name: statusDef.name,
        displayName: statusDef.displayName,
        color: statusDef.color,
        category: statusDef.category,
        isInitial: statusDef.isInitial ?? false,
        isFinal: statusDef.isFinal ?? false,
      });
      statusNameToId.set(statusDef.name, status.id);
    }

    for (const transitionDef of template.transitions) {
      const fromStatusId = statusNameToId.get(transitionDef.from);
      const toStatusId = statusNameToId.get(transitionDef.to);

      if (!fromStatusId || !toStatusId) continue;

      const transition = await workflowsRepository.createTransition({
        workflowId: workflow.id,
        fromStatusId,
        toStatusId,
        name: transitionDef.name,
      });

      if (transitionDef.roleRestriction && transitionDef.roleRestriction.length > 0) {
        await transitionConditionsService.createCondition(transition.id, {
          name: 'Role Restriction',
          description: `Allowed roles: ${transitionDef.roleRestriction.join(', ')}`,
          type: 'project_role',
          config: { roles: transitionDef.roleRestriction, operator: 'any' },
          isBlocking: true,
          errorMessage: `Role not permitted. Required: ${transitionDef.roleRestriction.join(' or ')}`,
          executionOrder: 1,
        });
      }
    }

    return this.getWorkflow(workflow.id);
  }

  /**
   * Update a workflow
   */
  async updateWorkflow(
    workflowId: string,
    data: Partial<{ name: string; description: string; isActive: boolean }>
  ): Promise<WorkflowWithStatuses> {
    await workflowsRepository.update(workflowId, data);
    return this.getWorkflow(workflowId);
  }

  /**
   * Delete a workflow (cannot delete the default workflow)
   */
  async deleteWorkflow(workflowId: string): Promise<{ message: string }> {
    const workflow = await workflowsRepository.findById(workflowId);
    if (!workflow) throw new Error('Workflow not found');
    if (workflow.isDefault) throw new Error('Cannot delete the default workflow');

    // Repository will throw descriptive errors (e.g., issues in use)
    await workflowsRepository.delete(workflowId);
    return { message: 'Workflow deleted successfully' };
  }

  // ==================== STATUS OPERATIONS ====================

  async getStatuses(workflowId: string): Promise<Status[]> {
    return workflowsRepository.findStatusesByWorkflow(workflowId);
  }

  async createStatus(data: {
    workflowId: string;
    name: string;
    displayName: string;
    description?: string;
    color?: string;
    category: string;
    wipLimit?: number;
    isInitial?: boolean;
    isFinal?: boolean;
  }): Promise<Status> {
    const workflow = await workflowsRepository.findById(data.workflowId);
    if (!workflow) throw new Error('Workflow not found');

    const existingStatuses = await workflowsRepository.findStatusesByWorkflow(data.workflowId);
    if (existingStatuses.some((s) => s.name.toLowerCase() === data.name.toLowerCase())) {
      throw new Error('Status name already exists in this workflow');
    }

    return workflowsRepository.createStatus(data);
  }

  async updateStatus(
    statusId: string,
    data: Partial<{
      name: string;
      displayName: string;
      description: string;
      color: string;
      category: string;
      wipLimit: number | null;
      isInitial: boolean;
      isFinal: boolean;
    }>
  ): Promise<Status> {
    const status = await workflowsRepository.findStatusById(statusId);
    if (!status) throw new Error('Status not found');
    return workflowsRepository.updateStatus(statusId, data);
  }

  async deleteStatus(statusId: string): Promise<{ message: string }> {
    const status = await workflowsRepository.findStatusById(statusId);
    if (!status) throw new Error('Status not found');

    // Allow deleting initial/final statuses from admin panel — only block if it's the ONLY initial status
    // and if workflow has issues. The repository will check if issues exist.

    try {
      await workflowsRepository.deleteStatus(statusId);
      return { message: 'Status deleted successfully' };
    } catch (error: any) {
      throw new Error(error.message || 'Failed to delete status');
    }
  }

  async reorderStatuses(workflowId: string, statusIds: string[]): Promise<Status[]> {
    await workflowsRepository.reorderStatuses(workflowId, statusIds);
    return workflowsRepository.findStatusesByWorkflow(workflowId);
  }

  // ==================== TRANSITION OPERATIONS ====================

  async getTransitions(workflowId: string): Promise<StatusTransition[]> {
    return workflowsRepository.findTransitionsByWorkflow(workflowId);
  }

  async getAvailableTransitions(statusId: string): Promise<Status[]> {
    const transitions = await workflowsRepository.findTransitionsFrom(statusId);
    const targetStatuses = await Promise.all(
      transitions.map((t) => workflowsRepository.findStatusById(t.toStatusId))
    );
    return targetStatuses.filter((s): s is Status => s !== null);
  }

  async addTransition(data: {
    workflowId: string;
    fromStatusId: string;
    toStatusId: string;
    name?: string;
  }): Promise<StatusTransition> {
    const [fromStatus, toStatus] = await Promise.all([
      workflowsRepository.findStatusById(data.fromStatusId),
      workflowsRepository.findStatusById(data.toStatusId),
    ]);

    if (!fromStatus || fromStatus.workflowId !== data.workflowId) {
      throw new Error('Invalid source status');
    }
    if (!toStatus || toStatus.workflowId !== data.workflowId) {
      throw new Error('Invalid target status');
    }

    return workflowsRepository.createTransition({
      workflowId: data.workflowId,
      fromStatusId: data.fromStatusId,
      toStatusId: data.toStatusId,
      name: data.name || undefined,
    });
  }

  async removeTransition(transitionId: string): Promise<{ message: string }> {
    const deleted = await workflowsRepository.deleteTransition(transitionId);
    if (!deleted) throw new Error('Transition not found');
    return { message: 'Transition removed successfully' };
  }

  async setTransitions(
    workflowId: string,
    transitions: { fromStatusId: string; toStatusId: string; name?: string }[]
  ): Promise<StatusTransition[]> {
    await workflowsRepository.setTransitions(workflowId, transitions);
    return workflowsRepository.findTransitionsByWorkflow(workflowId);
  }

  async isTransitionAllowed(fromStatusId: string, toStatusId: string): Promise<boolean> {
    const transitions = await workflowsRepository.findTransitionsFrom(fromStatusId);
    return transitions.some((t) => t.toStatusId === toStatusId);
  }
}

export const workflowsService = new WorkflowsService();
