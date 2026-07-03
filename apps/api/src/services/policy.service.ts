import { prisma } from '../database/prisma';
import { RbacService } from '../modules/rbac/rbac.service';

const rbacService = new RbacService();

interface PermissionContext {
  userId: string;
  permission: string;
  projectId?: string;
}

type RuleDecision = 'allow' | 'deny' | null;

export class PolicyService {
  private async getProjectRole(userId: string, projectId: string): Promise<string | null> {
    const membership = await prisma.projectMember.findFirst({
      where: { projectId, userId },
      select: { role: true },
    });
    if (membership?.role) {
      return membership.role;
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: { ownerId: true, leadId: true },
    });
    if (!project) {
      return null;
    }
    if (project.ownerId === userId) {
      return 'admin';
    }
    if (project.leadId === userId) {
      return 'lead';
    }
    return null;
  }

  private async getPrincipalContext(userId: string, projectId?: string): Promise<{
    systemRoleName: string | null;
    projectRole: string | null;
    groupIds: string[];
  }> {
    const [user, projectRole, groupMemberships] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          role: {
            select: { name: true },
          },
        },
      }),
      projectId ? this.getProjectRole(userId, projectId) : Promise.resolve(null),
      prisma.userGroupMember.findMany({
        where: {
          userId,
          group: projectId
            ? {
                OR: [{ projectId }, { projectId: null as any }],
              }
            : undefined,
        },
        select: { groupId: true },
      }),
    ]);

    return {
      systemRoleName: user?.role?.name || null,
      projectRole,
      groupIds: groupMemberships.map((m) => m.groupId),
    };
  }

  private evaluateRuleMatch(
    principalType: string,
    principalId: string,
    ctx: {
      userId: string;
      systemRoleName: string | null;
      projectRole: string | null;
      groupIds: string[];
    }
  ): boolean {
    switch (principalType) {
      case 'user':
        return principalId === ctx.userId;
      case 'user_role':
        return principalId === ctx.systemRoleName;
      case 'project_role':
        return principalId === ctx.projectRole;
      case 'group':
        return ctx.groupIds.includes(principalId);
      default:
        return false;
    }
  }

  private evaluateRules(
    rules: Array<{
      permissionName: string;
      principalType: string;
      principalId: string;
      effect: string;
      isEnabled?: boolean;
    }>,
    permission: string,
    principalCtx: {
      userId: string;
      systemRoleName: string | null;
      projectRole: string | null;
      groupIds: string[];
    }
  ): RuleDecision {
    const candidates = rules.filter(
      (rule) =>
        (rule.isEnabled ?? true) &&
        (rule.permissionName === permission || rule.permissionName === '*') &&
        this.evaluateRuleMatch(rule.principalType, rule.principalId, principalCtx)
    );

    if (candidates.length === 0) {
      return null;
    }

    if (candidates.some((rule) => rule.effect === 'deny')) {
      return 'deny';
    }
    if (candidates.some((rule) => rule.effect === 'allow')) {
      return 'allow';
    }
    return null;
  }

  private async fallbackPermissionCheck({ userId, permission, projectId }: PermissionContext): Promise<boolean> {
    const [hasSystem, hasProject] = await Promise.all([
      rbacService.hasPermission(userId, permission),
      projectId ? rbacService.hasProjectPermission(userId, projectId, permission) : Promise.resolve(false),
    ]);
    return hasSystem || hasProject;
  }

  async hasPermission(input: PermissionContext): Promise<boolean> {
    const { userId, permission, projectId } = input;

    if (!projectId) {
      return this.fallbackPermissionCheck(input);
    }

    const assignment = await prisma.projectPermissionScheme.findUnique({
      where: { projectId },
      include: {
        permissionScheme: {
          include: { rules: true },
        },
      },
    });

    if (!assignment?.permissionScheme || assignment.permissionScheme.status !== 'active') {
      return this.fallbackPermissionCheck(input);
    }

    const principalCtx = await this.getPrincipalContext(userId, projectId);
    const decision = this.evaluateRules(
      assignment.permissionScheme.rules.map((rule) => ({
        permissionName: rule.permissionName,
        principalType: rule.principalType,
        principalId: rule.principalId,
        effect: rule.effect,
      })),
      permission,
      {
        userId,
        systemRoleName: principalCtx.systemRoleName,
        projectRole: principalCtx.projectRole,
        groupIds: principalCtx.groupIds,
      }
    );

    if (decision === null) {
      return this.fallbackPermissionCheck(input);
    }

    return decision === 'allow';
  }
}

export const policyService = new PolicyService();
