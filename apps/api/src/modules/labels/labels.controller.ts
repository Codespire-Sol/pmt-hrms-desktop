import { Request, Response } from 'express';
import { prisma } from '../../database/prisma';
import { ApiError } from '../../utils/ApiError';

export class LabelsController {
  getProjectLabels = async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const labels = await prisma.label.findMany({
      where: { projectId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true, description: true },
    });
    res.json({ success: true, data: labels });
  };

  createLabel = async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { name, color, description } = req.body;

    if (!name?.trim()) {
      throw ApiError.badRequest('Label name is required');
    }

    const existing = await prisma.label.findUnique({
      where: { projectId_name: { projectId, name: name.trim() } },
    });
    if (existing) {
      throw ApiError.conflict('A label with this name already exists in this project');
    }

    const label = await prisma.label.create({
      data: {
        projectId,
        name: name.trim(),
        color: color || '#6b7280',
        description: description || null,
      },
      select: { id: true, name: true, color: true, description: true },
    });
    res.status(201).json({ success: true, data: label });
  };

  updateLabel = async (req: Request, res: Response) => {
    const { projectId, labelId } = req.params;
    const { name, color, description } = req.body;

    const label = await prisma.label.findFirst({ where: { id: labelId, projectId } });
    if (!label) throw ApiError.notFound('Label not found');

    const updated = await prisma.label.update({
      where: { id: labelId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(color !== undefined && { color }),
        ...(description !== undefined && { description }),
      },
      select: { id: true, name: true, color: true, description: true },
    });
    res.json({ success: true, data: updated });
  };

  deleteLabel = async (req: Request, res: Response) => {
    const { projectId, labelId } = req.params;
    const label = await prisma.label.findFirst({ where: { id: labelId, projectId } });
    if (!label) throw ApiError.notFound('Label not found');

    await prisma.label.delete({ where: { id: labelId } });
    res.json({ success: true, message: 'Label deleted' });
  };
}
