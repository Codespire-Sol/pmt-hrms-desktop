import { prisma } from '../../database/prisma';

export class IssueHistoryRepository {
  async create(input: any): Promise<any> {
    return prisma.issueHistory.create({
      data: {
        issueId: input.issueId,
        userId: input.userId,
        fieldName: input.fieldName,
        oldValue: input.oldValue,
        newValue: input.newValue,
        oldValueId: input.oldValueId,
        newValueId: input.newValueId,
        changeType: input.changeType,
      },
    });
  }

  async findByIssue(issueId: string, options: any = {}): Promise<any[]> {
    const { limit = 50 } = options;
    const records = await prisma.issueHistory.findMany({
      where: { issueId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map((record) => ({
      ...record,
      userDisplayName: `${record.user.firstName} ${record.user.lastName}`,
    }));
  }
}
