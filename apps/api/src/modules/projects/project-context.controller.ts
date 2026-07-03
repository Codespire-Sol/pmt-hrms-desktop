import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { ProjectsService } from './projects.service';
import { VersionsService } from '../versions/versions.service';
import { EpicsService } from '../epics/epics.service';
import { workflowsService } from '../workflows/workflows.service';
import { prisma } from '../../database/prisma';

const projectsService = new ProjectsService();
const versionsService = new VersionsService();
const epicsService = new EpicsService();

export class ProjectContextController {
  /**
   * GET /projects/:projectId/context
   * Returns consolidated project reference data in a single response.
   * Replaces 5 separate calls: members, labels, versions, epics, workflow.
   */
  getProjectContext = asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const userId = req.user!.id;

    const [membersResult, labels, versions, epics, workflow] = await Promise.all([
      projectsService.getProjectMembers(projectId, userId),
      prisma.label.findMany({
        where: { projectId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, color: true, description: true },
      }),
      versionsService.getProjectVersions(projectId, {}, userId),
      epicsService.getProjectEpics(projectId, {}, userId),
      workflowsService.getProjectWorkflow(projectId).catch(() => null),
    ]);

    res.json({
      success: true,
      data: {
        members: membersResult.members,
        labels,
        versions,
        epics,
        workflow,
      },
    });
  });
}
