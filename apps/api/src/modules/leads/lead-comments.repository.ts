import { prisma } from '../../database/prisma';

export interface LeadComment {
  id: string;
  leadId: string;
  content: string;
  authorName: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export class LeadCommentsRepository {
  async create(leadId: string, content: string, authorName: string, userId: string): Promise<LeadComment> {
    const row = await prisma.leadComment.create({
      data: { leadId, content, authorName, createdBy: userId },
    });
    return this.map(row);
  }

  async findByLeadId(leadId: string): Promise<LeadComment[]> {
    const rows = await prisma.leadComment.findMany({
      where: { leadId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.map(r));
  }

  async findById(id: string): Promise<LeadComment | null> {
    const row = await prisma.leadComment.findUnique({ where: { id } });
    return row ? this.map(row) : null;
  }

  async delete(id: string): Promise<void> {
    await prisma.leadComment.delete({ where: { id } });
  }

  private map(row: any): LeadComment {
    return {
      id: row.id,
      leadId: row.leadId,
      content: row.content,
      authorName: row.authorName,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
