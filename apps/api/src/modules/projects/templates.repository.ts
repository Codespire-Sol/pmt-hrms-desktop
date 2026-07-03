import { prisma } from '../../database/prisma';
import { Prisma } from '@prisma/client';
import { ProjectTemplate, CreateTemplateInput } from './projects.types';

// NOTE: The current Prisma schema for ProjectTemplate has a simplified structure.
// This repository assumes the schema will be updated to include all required fields
// (icon, category, isSystem, createdBy, defaultSettings, issueTypes, statuses,
// workflows, labels, priorities, customFields, usageCount, deletedAt).
// Until then, some operations use $queryRaw to work with the actual DB columns.

export class TemplatesRepository {
  async findAll(category?: string): Promise<ProjectTemplate[]> {
    const templates = await prisma.$queryRaw<any[]>`
      SELECT * FROM project_templates
      WHERE deleted_at IS NULL
      ${category ? Prisma.sql`AND category = ${category}` : Prisma.empty}
      ORDER BY is_system DESC, usage_count DESC, name ASC
    `;
    return templates.map(this.formatTemplate);
  }

  async findById(id: string): Promise<ProjectTemplate | null> {
    const templates = await prisma.$queryRaw<any[]>`
      SELECT * FROM project_templates
      WHERE id = ${id}::uuid AND deleted_at IS NULL
    `;
    return templates.length > 0 ? this.formatTemplate(templates[0]) : null;
  }

  async findSystemTemplates(): Promise<ProjectTemplate[]> {
    const templates = await prisma.$queryRaw<any[]>`
      SELECT * FROM project_templates
      WHERE is_system = true AND deleted_at IS NULL
      ORDER BY category ASC, name ASC
    `;
    return templates.map(this.formatTemplate);
  }

  async findByUser(userId: string): Promise<ProjectTemplate[]> {
    const templates = await prisma.$queryRaw<any[]>`
      SELECT * FROM project_templates
      WHERE created_by = ${userId}::uuid AND deleted_at IS NULL
      ORDER BY updated_at DESC
    `;
    return templates.map(this.formatTemplate);
  }

  async create(input: CreateTemplateInput & { createdBy: string }): Promise<ProjectTemplate> {
    const templates = await prisma.$queryRaw<any[]>`
      INSERT INTO project_templates (
        name, description, icon, category, is_system, created_by,
        default_settings, issue_types, statuses, workflows, labels, priorities, custom_fields
      ) VALUES (
        ${input.name},
        ${input.description ?? null},
        ${input.icon || 'folder'},
        ${input.category ?? null},
        false,
        ${input.createdBy}::uuid,
        ${JSON.stringify(input.defaultSettings || {})}::jsonb,
        ${JSON.stringify(input.issueTypes || [])}::jsonb,
        ${JSON.stringify(input.statuses || [])}::jsonb,
        ${JSON.stringify(input.workflows || [])}::jsonb,
        ${JSON.stringify(input.labels || [])}::jsonb,
        ${JSON.stringify(input.priorities || [])}::jsonb,
        ${JSON.stringify(input.customFields || [])}::jsonb
      )
      RETURNING *
    `;
    return this.formatTemplate(templates[0]);
  }

  async update(id: string, input: Partial<CreateTemplateInput>): Promise<ProjectTemplate> {
    // Build SET clauses dynamically
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: any[] = [];

    if (input.name !== undefined) {
      values.push(input.name);
      setClauses.push(`name = $${values.length + 1}`);
    }
    if (input.description !== undefined) {
      values.push(input.description);
      setClauses.push(`description = $${values.length + 1}`);
    }
    if (input.icon !== undefined) {
      values.push(input.icon);
      setClauses.push(`icon = $${values.length + 1}`);
    }
    if (input.category !== undefined) {
      values.push(input.category);
      setClauses.push(`category = $${values.length + 1}`);
    }
    if (input.defaultSettings !== undefined) {
      values.push(JSON.stringify(input.defaultSettings));
      setClauses.push(`default_settings = $${values.length + 1}::jsonb`);
    }
    if (input.issueTypes !== undefined) {
      values.push(JSON.stringify(input.issueTypes));
      setClauses.push(`issue_types = $${values.length + 1}::jsonb`);
    }
    if (input.statuses !== undefined) {
      values.push(JSON.stringify(input.statuses));
      setClauses.push(`statuses = $${values.length + 1}::jsonb`);
    }
    if (input.workflows !== undefined) {
      values.push(JSON.stringify(input.workflows));
      setClauses.push(`workflows = $${values.length + 1}::jsonb`);
    }
    if (input.labels !== undefined) {
      values.push(JSON.stringify(input.labels));
      setClauses.push(`labels = $${values.length + 1}::jsonb`);
    }
    if (input.priorities !== undefined) {
      values.push(JSON.stringify(input.priorities));
      setClauses.push(`priorities = $${values.length + 1}::jsonb`);
    }
    if (input.customFields !== undefined) {
      values.push(JSON.stringify(input.customFields));
      setClauses.push(`custom_fields = $${values.length + 1}::jsonb`);
    }

    const templates = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE project_templates SET ${setClauses.join(', ')} WHERE id = $1::uuid RETURNING *`,
      id,
      ...values,
    );

    return this.formatTemplate(templates[0]);
  }

  async delete(id: string): Promise<void> {
    await prisma.$queryRaw`
      UPDATE project_templates SET deleted_at = NOW() WHERE id = ${id}::uuid
    `;
  }

  async incrementUsageCount(id: string): Promise<void> {
    await prisma.$queryRaw`
      UPDATE project_templates SET usage_count = usage_count + 1 WHERE id = ${id}::uuid
    `;
  }

  async getCategories(): Promise<string[]> {
    const categories = await prisma.$queryRaw<{ category: string }[]>`
      SELECT DISTINCT category FROM project_templates
      WHERE category IS NOT NULL AND deleted_at IS NULL
      ORDER BY category ASC
    `;
    return categories.map((c) => c.category);
  }

  private formatTemplate(row: any): ProjectTemplate {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      icon: row.icon,
      category: row.category,
      isSystem: row.is_system,
      createdBy: row.created_by,
      defaultSettings: typeof row.default_settings === 'string'
        ? JSON.parse(row.default_settings)
        : row.default_settings || {},
      issueTypes: typeof row.issue_types === 'string'
        ? JSON.parse(row.issue_types)
        : row.issue_types || [],
      statuses: typeof row.statuses === 'string'
        ? JSON.parse(row.statuses)
        : row.statuses || [],
      workflows: typeof row.workflows === 'string'
        ? JSON.parse(row.workflows)
        : row.workflows || [],
      labels: typeof row.labels === 'string'
        ? JSON.parse(row.labels)
        : row.labels || [],
      priorities: typeof row.priorities === 'string'
        ? JSON.parse(row.priorities)
        : row.priorities || [],
      customFields: typeof row.custom_fields === 'string'
        ? JSON.parse(row.custom_fields)
        : row.custom_fields || [],
      usageCount: row.usage_count,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
