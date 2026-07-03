import { prisma } from '../../database/prisma';
import { Lead, CreateLeadInput, UpdateLeadInput } from './leads.types';

export class LeadsRepository {
  async create(input: CreateLeadInput, userId: string): Promise<Lead> {
    const count = await prisma.lead.count();
    const leadKey = `LEAD-${count + 1}`;

    const row = await prisma.lead.create({
      data: {
        leadKey,
        name: input.name,
        company: input.company ?? null,
        source: input.source ?? null,
        status: input.status ?? 'new',
        remarks: input.remarks ?? null,
        followUpDate: input.followUpDate ?? null,
        createdBy: userId,
      },
    });

    return this.map(row);
  }

  async findById(id: string): Promise<Lead | null> {
    const row = await prisma.lead.findUnique({ where: { id } });
    return row ? this.map(row) : null;
  }

  async findAll(): Promise<Lead[]> {
    const rows = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.map(row));
  }

  async update(id: string, input: UpdateLeadInput): Promise<Lead> {
    const row = await prisma.lead.update({
      where: { id },
      data: {
        name: input.name,
        company: input.company,
        source: input.source,
        status: input.status,
        remarks: input.remarks,
        followUpDate: input.followUpDate,
      },
    });
    return this.map(row);
  }

  async delete(id: string): Promise<void> {
    await prisma.lead.delete({ where: { id } });
  }

  private map(row: any): Lead {
    return {
      id: row.id,
      leadKey: row.leadKey,
      name: row.name,
      company: row.company,
      source: row.source,
      status: row.status,
      remarks: row.remarks,
      followUpDate: row.followUpDate,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
