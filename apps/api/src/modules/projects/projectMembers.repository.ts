import { prisma } from '../../database/prisma';
import { ProjectMember } from './projects.types';
import { normalizeMediaUrl } from '../../utils/media-url';

export class ProjectMembersRepository {
  async create(input: { projectId: string; userId: string; role: string; invitedBy: string }): Promise<ProjectMember> {
    const member = await prisma.projectMember.create({
      data: {
        projectId: input.projectId,
        userId: input.userId,
        role: input.role as any,
        invitedBy: input.invitedBy,
      },
    });
    return member as unknown as ProjectMember;
  }

  async findByProjectAndUser(projectId: string, userId: string): Promise<ProjectMember | null> {
    const member = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId },
      },
    });
    return (member as unknown as ProjectMember) || null;
  }

  async findByProject(projectId: string): Promise<any[]> {
    const members = await prisma.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    // Fetch PMT-scoped roles for all members from system_settings
    const userIds = members.map((m) => m.userId);
    const pmtRoleByUserId = new Map<string, { id: string; displayName: string }>();

    if (userIds.length > 0) {
      const settingKeys = userIds.map((uid) => `user_role:pmt:${uid}`);
      const rows = await prisma.$queryRawUnsafe<Array<{ setting_key: string; setting_value: any }>>(
        `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${settingKeys.map((_, i) => `$${i + 1}`).join(', ')})`,
        ...settingKeys,
      );

      if (rows.length > 0) {
        const roleIds = rows
          .map((r) => {
            const val = typeof r.setting_value === 'string' ? JSON.parse(r.setting_value) : r.setting_value;
            return typeof val?.roleId === 'string' ? val.roleId : null;
          })
          .filter((id): id is string => Boolean(id));

        const roles = roleIds.length
          ? await prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true, displayName: true } })
          : [];
        const roleMap = new Map(roles.map((r) => [r.id, r]));

        for (const row of rows) {
          const val = typeof row.setting_value === 'string' ? JSON.parse(row.setting_value) : row.setting_value;
          const roleId = typeof val?.roleId === 'string' ? val.roleId : null;
          if (!roleId) continue;
          const role = roleMap.get(roleId);
          if (!role) continue;
          const uid = row.setting_key.replace('user_role:pmt:', '');
          pmtRoleByUserId.set(uid, role);
        }
      }
    }

    // Enrich with employee details (designation/department) to match Users list data
    const employeeByUserId = new Map<string, { designation: string | null; department: string | null; status: string | null }>();
    if (userIds.length > 0) {
      const empRows = await prisma.$queryRawUnsafe<Array<{ user_id: string; designation: string | null; department: string | null; status: string | null }>>(
        `SELECT user_id, designation, department, status::text as status FROM employees WHERE deleted_at IS NULL AND user_id IN (${userIds.map((_, i) => `$${i + 1}::uuid`).join(', ')})`,
        ...userIds,
      );
      for (const row of empRows) {
        employeeByUserId.set(row.user_id, row);
      }
    }

    return members.map((m) => {
      const emp = employeeByUserId.get(m.userId);
      return {
        id: m.id,
        projectId: m.projectId,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        pmtRole: pmtRoleByUserId.get(m.userId) ?? null,
        user: {
          id: m.user.id,
          email: m.user.email,
          displayName: `${m.user.firstName} ${m.user.lastName}`,
          avatarUrl: normalizeMediaUrl(m.user.avatarUrl),
          designation: emp?.designation ?? null,
          department: emp?.department ?? null,
        },
      };
    });
  }

  async updateRole(id: string, role: string): Promise<ProjectMember> {
    const member = await prisma.projectMember.update({
      where: { id },
      data: { role: role as any },
    });
    return member as unknown as ProjectMember;
  }

  async delete(id: string): Promise<void> {
    await prisma.projectMember.delete({
      where: { id },
    });
  }
}
