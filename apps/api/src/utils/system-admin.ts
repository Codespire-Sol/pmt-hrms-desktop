import { Request, Response, NextFunction } from 'express';
import { ApiError } from './ApiError';
import { prisma } from '../database/prisma';

export async function isSystemAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      },
    },
  });

  if (!user) return false;

  const isAdminRole = user.role?.name === 'admin';
  const hasAdminPermission = user.role?.rolePermissions?.some(
    (rp) => rp.permission.name === 'admin.settings' || rp.permission.name === 'projects.read_all'
  ) || false;

  return isAdminRole || hasAdminPermission;
}

/** Express middleware that allows only system admins through. */
export async function requireSystemAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    next(ApiError.unauthorized('Authentication required'));
    return;
  }
  const isAdmin = await isSystemAdmin(userId);
  if (!isAdmin) {
    next(ApiError.forbidden('System administrator access required', 'ADMIN_REQUIRED'));
    return;
  }
  next();
}
