import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { adminService } from './admin.service';
import { RbacService } from '../rbac/rbac.service';
import { killIdleConnections, getConnectionStats } from '../../database/prisma';

const rbacService = new RbacService();

class AdminController {
  listHrAccounts = asyncHandler(async (_req: Request, res: Response) => {
    const data = await adminService.listHrAccounts();
    res.json({ success: true, data });
  });

  createHrAccount = asyncHandler(async (req: Request, res: Response) => {
    const currentUserId = req.user!.id;
    const data = await adminService.createHrAccount(req.body, currentUserId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.status(201).json({
      success: true,
      data,
      message: 'HR account created successfully',
    });
  });

  assignHrBranch = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { branchId } = req.body;
    const data = await adminService.assignHrBranch(userId, branchId ?? null, req.user!.id);
    res.json({ success: true, data, message: 'Branch assigned successfully' });
  });

  getAdminSettings = asyncHandler(async (_req: Request, res: Response) => {
    const data = await adminService.getAdminSettings();
    res.json({ success: true, data });
  });

  updateHrAccountLimit = asyncHandler(async (req: Request, res: Response) => {
    const currentUserId = req.user!.id;
    const data = await adminService.updateHrAccountLimit(req.body.maxHrAccounts, currentUserId, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({
      success: true,
      data,
      message: 'HR account limit updated successfully',
    });
  });

  listBranches = asyncHandler(async (_req: Request, res: Response) => {
    const data = await adminService.listBranches();
    res.json({ success: true, data });
  });

  createBranch = asyncHandler(async (req: Request, res: Response) => {
    const data = await adminService.createBranch(req.body, req.user!.id);
    res.status(201).json({ success: true, data, message: 'Branch created successfully' });
  });

  updateBranch = asyncHandler(async (req: Request, res: Response) => {
    const data = await adminService.updateBranch(req.params.id, req.body, req.user!.id);
    res.json({ success: true, data, message: 'Branch updated successfully' });
  });

  deleteBranch = asyncHandler(async (req: Request, res: Response) => {
    await adminService.deleteBranch(req.params.id, req.user!.id);
    res.json({ success: true, message: 'Branch deleted successfully' });
  });

  getDashboard = asyncHandler(async (req: Request, res: Response) => {
    const branchId = (req.query.branchId as string) || null;
    const data = await adminService.getAdminDashboard(branchId);
    res.json({ success: true, data });
  });

  // ─── Keycloak User Directory ─────────────────────────────────────────────

  listKeycloakUsers = asyncHandler(async (_req: Request, res: Response) => {
    const data = await adminService.listKeycloakUserDirectory();
    res.json({ success: true, data });
  });

  getKeycloakUserProfile = asyncHandler(async (req: Request, res: Response) => {
    const data = await adminService.getKeycloakUserProfile(req.params.sub);
    res.json({ success: true, data });
  });

  updateKeycloakUserProfile = asyncHandler(async (req: Request, res: Response) => {
    const data = await adminService.updateKeycloakUserProfile(
      req.params.sub,
      req.body,
      req.user!.id
    );
    res.json({ success: true, data, message: 'Profile updated successfully' });
  });

  sendPasswordResetEmail = asyncHandler(async (req: Request, res: Response) => {
    await adminService.sendUserPasswordResetEmail(req.params.sub);
    res.json({ success: true, message: 'Password reset email sent' });
  });

  // ─── Database Connection Management ─────────────────────────────────────────

  getDbConnectionStats = asyncHandler(async (_req: Request, res: Response) => {
    const stats = await getConnectionStats();
    res.json({ success: true, data: stats });
  });

  killIdleDbConnections = asyncHandler(async (_req: Request, res: Response) => {
    const terminated = await killIdleConnections();
    const stats = await getConnectionStats();
    res.json({
      success: true,
      data: { terminated, currentStats: stats },
      message: `Terminated ${terminated} idle connections`,
    });
  });

  // ─── Audit Logs (proxy to RBAC service) ────────────────────────────────────

  getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const filters = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      action: (req.query.action as string) || undefined,
      entityType: (req.query.entityType as string) || undefined,
      userId: (req.query.userId as string) || undefined,
      startDate: (req.query.startDate as string) || undefined,
      endDate: (req.query.endDate as string) || undefined,
    };
    const result = await rbacService.getAuditLogs(filters);
    res.json({
      success: true,
      data: {
        logs: result.logs,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / filters.limit),
        },
      },
    });
  });
}

export const adminController = new AdminController();

