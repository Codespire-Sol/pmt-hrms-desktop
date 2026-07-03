import { PrismaClient } from '@prisma/client';
import {
  JQLQuery,
  JQLClause,
  JQLCondition,
  JQLValue,
  JQLFunction,
  JQLContext,
  JQL_FIELD_MAPPINGS,
  JQL_FUNCTIONS,
} from './jql.types';

interface ExecutionResult {
  sql: string;
  bindings: any[];
}

export class JQLExecutor {
  private context: JQLContext;
  private prisma: PrismaClient;
  private paramCounter: number = 0;
  private bindings: any[] = [];

  constructor(prisma: PrismaClient, context: JQLContext) {
    this.prisma = prisma;
    this.context = context;
  }

  /**
   * Execute a JQL query and return issues
   */
  async execute(query: JQLQuery, projectId?: string): Promise<{ issues: any[]; total: number }> {
    this.paramCounter = 0;
    this.bindings = [];

    // Build WHERE conditions
    const conditions: string[] = [];

    if (projectId) {
      this.paramCounter++;
      conditions.push(`i.project_id = $${this.paramCounter}`);
      this.bindings.push(projectId);
    }

    if (query.where) {
      const whereSQL = this.buildWhereSQL(query.where);
      if (whereSQL) {
        conditions.push(whereSQL);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build ORDER BY
    let orderClause = '';
    if (query.orderBy && query.orderBy.length > 0) {
      const orderParts: string[] = [];
      for (const orderItem of query.orderBy) {
        const fieldMapping = JQL_FIELD_MAPPINGS[orderItem.field];
        if (fieldMapping) {
          const column = fieldMapping.table
            ? `${fieldMapping.table}.${fieldMapping.column}`
            : `i.${fieldMapping.column}`;
          const direction = orderItem.direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
          orderParts.push(`${column} ${direction}`);
        }
      }
      if (orderParts.length > 0) {
        orderClause = `ORDER BY ${orderParts.join(', ')}`;
      }
    } else {
      orderClause = 'ORDER BY i.created_at DESC';
    }

    // Count query
    const countSQL = `SELECT COUNT(*) as count FROM issues i ${whereClause}`;
    const countResult = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(countSQL, ...this.bindings);
    const total = Number(countResult[0]?.count ?? 0);

    // Main query with joins
    const selectSQL = `
      SELECT
        i.*,
        it.name as type_name,
        it.display_name as type_display_name,
        it.icon as type_icon,
        it.color as type_color,
        s.name as status_name,
        s.display_name as status_display_name,
        s.color as status_color,
        s.category as status_category,
        p.name as priority_name,
        p.display_name as priority_display_name,
        p.icon as priority_icon,
        p.color as priority_color,
        assignee.display_name as assignee_display_name,
        assignee.avatar_url as assignee_avatar_url,
        reporter.display_name as reporter_display_name,
        reporter.email as reporter_email,
        reporter.avatar_url as reporter_avatar_url,
        proj.name as project_name,
        proj.key as project_key
      FROM issues i
      LEFT JOIN issue_types it ON i.type_id = it.id
      LEFT JOIN statuses s ON i.status_id = s.id
      LEFT JOIN issue_priorities p ON i.priority_id = p.id
      LEFT JOIN users assignee ON i.assignee_id = assignee.id
      LEFT JOIN users reporter ON i.reporter_id = reporter.id
      LEFT JOIN projects proj ON i.project_id = proj.id
      ${whereClause}
      ${orderClause}
    `;

    const issues = await this.prisma.$queryRawUnsafe<any[]>(selectSQL, ...this.bindings);

    return { issues: this.transformIssues(issues), total };
  }

  /**
   * Build SQL for a JQL query (for debugging/caching)
   */
  buildSQL(query: JQLQuery): ExecutionResult {
    this.paramCounter = 0;
    this.bindings = [];

    const whereClause = query.where ? this.buildWhereSQL(query.where) : '';
    const orderClause = query.orderBy ? this.buildOrderSQL(query.orderBy) : '';

    let sql = 'SELECT i.* FROM issues i';
    if (whereClause) {
      sql += ` WHERE ${whereClause}`;
    }
    if (orderClause) {
      sql += ` ORDER BY ${orderClause}`;
    }

    return { sql, bindings: this.bindings };
  }

  private buildWhereSQL(clause: JQLClause): string {
    if (clause.type === 'condition' && clause.condition) {
      return this.buildConditionSQL(clause.condition);
    }

    if (clause.type === 'group' && clause.clauses) {
      const parts = clause.clauses.map(c => this.buildWhereSQL(c)).filter(Boolean);
      if (parts.length === 0) return '';
      const operator = clause.logicalOperator || 'AND';
      return `(${parts.join(` ${operator} `)})`;
    }

    return '';
  }

  private buildConditionSQL(condition: JQLCondition): string {
    const fieldMapping = JQL_FIELD_MAPPINGS[condition.field];
    if (!fieldMapping) {
      throw new Error(`Unknown field: ${condition.field}`);
    }

    // Handle table-based fields (components, labels, watchers, voters) with subqueries
    if (fieldMapping.table) {
      return this.buildSubqueryConditionSQL(condition, fieldMapping);
    }

    const column = `i.${fieldMapping.column}`;
    const value = this.resolveValue(condition.value, fieldMapping.type);
    const negate = condition.negate || false;

    switch (condition.operator) {
      case '=':
        if (value === null) {
          return negate ? `${column} IS NOT NULL` : `${column} IS NULL`;
        }
        this.paramCounter++;
        this.bindings.push(value);
        return negate
          ? `${column} != $${this.paramCounter}`
          : `${column} = $${this.paramCounter}`;

      case '!=':
        if (value === null) {
          return negate ? `${column} IS NULL` : `${column} IS NOT NULL`;
        }
        this.paramCounter++;
        this.bindings.push(value);
        return negate
          ? `${column} = $${this.paramCounter}`
          : `${column} != $${this.paramCounter}`;

      case '>':
        this.paramCounter++;
        this.bindings.push(value);
        return negate
          ? `${column} <= $${this.paramCounter}`
          : `${column} > $${this.paramCounter}`;

      case '<':
        this.paramCounter++;
        this.bindings.push(value);
        return negate
          ? `${column} >= $${this.paramCounter}`
          : `${column} < $${this.paramCounter}`;

      case '>=':
        this.paramCounter++;
        this.bindings.push(value);
        return negate
          ? `${column} < $${this.paramCounter}`
          : `${column} >= $${this.paramCounter}`;

      case '<=':
        this.paramCounter++;
        this.bindings.push(value);
        return negate
          ? `${column} > $${this.paramCounter}`
          : `${column} <= $${this.paramCounter}`;

      case '~':
        this.paramCounter++;
        this.bindings.push(`%${value}%`);
        return negate
          ? `${column} NOT ILIKE $${this.paramCounter}`
          : `${column} ILIKE $${this.paramCounter}`;

      case '!~':
        this.paramCounter++;
        this.bindings.push(`%${value}%`);
        return negate
          ? `${column} ILIKE $${this.paramCounter}`
          : `${column} NOT ILIKE $${this.paramCounter}`;

      case 'IN':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => {
            this.paramCounter++;
            return `$${this.paramCounter}`;
          });
          this.bindings.push(...value);
          return negate
            ? `${column} NOT IN (${placeholders.join(', ')})`
            : `${column} IN (${placeholders.join(', ')})`;
        }
        return 'FALSE';

      case 'NOT IN':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => {
            this.paramCounter++;
            return `$${this.paramCounter}`;
          });
          this.bindings.push(...value);
          return negate
            ? `${column} IN (${placeholders.join(', ')})`
            : `${column} NOT IN (${placeholders.join(', ')})`;
        }
        return 'TRUE';

      case 'IS':
        if (value === null) {
          return negate ? `${column} IS NOT NULL` : `${column} IS NULL`;
        }
        return 'TRUE';

      case 'IS NOT':
        if (value === null) {
          return negate ? `${column} IS NULL` : `${column} IS NOT NULL`;
        }
        return 'TRUE';

      default:
        throw new Error(`Unsupported operator: ${condition.operator}`);
    }
  }

  private buildSubqueryConditionSQL(
    condition: JQLCondition,
    fieldMapping: { column: string; table?: string; type: string }
  ): string {
    const value = this.resolveValue(condition.value, fieldMapping.type);
    const table = fieldMapping.table!;
    const column = fieldMapping.column;
    const negate = condition.negate || false;

    let subqueryCondition: string;

    switch (condition.operator) {
      case '=':
      case 'IN':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => {
            this.paramCounter++;
            return `$${this.paramCounter}`;
          });
          this.bindings.push(...value);
          subqueryCondition = `${column} IN (${placeholders.join(', ')})`;
        } else {
          this.paramCounter++;
          this.bindings.push(value);
          subqueryCondition = `${column} = $${this.paramCounter}`;
        }
        return negate
          ? `NOT EXISTS (SELECT 1 FROM ${table} WHERE ${table}.issue_id = i.id AND ${subqueryCondition})`
          : `EXISTS (SELECT 1 FROM ${table} WHERE ${table}.issue_id = i.id AND ${subqueryCondition})`;

      case '!=':
      case 'NOT IN':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => {
            this.paramCounter++;
            return `$${this.paramCounter}`;
          });
          this.bindings.push(...value);
          subqueryCondition = `${column} IN (${placeholders.join(', ')})`;
        } else {
          this.paramCounter++;
          this.bindings.push(value);
          subqueryCondition = `${column} = $${this.paramCounter}`;
        }
        // For != / NOT IN, we invert: check that the subquery does NOT exist
        return negate
          ? `EXISTS (SELECT 1 FROM ${table} WHERE ${table}.issue_id = i.id AND ${subqueryCondition})`
          : `NOT EXISTS (SELECT 1 FROM ${table} WHERE ${table}.issue_id = i.id AND ${subqueryCondition})`;

      default:
        throw new Error(`Unsupported operator for relation field: ${condition.operator}`);
    }
  }

  private resolveValue(value: JQLValue, fieldType: string): any {
    if (value === null) return null;

    // Handle function
    if (typeof value === 'object' && 'name' in value && !Array.isArray(value)) {
      const func = value as JQLFunction;
      const jqlFunction = JQL_FUNCTIONS[func.name];
      if (!jqlFunction) {
        throw new Error(`Unknown function: ${func.name}`);
      }
      return jqlFunction(func.args, this.context);
    }

    // Handle array
    if (Array.isArray(value)) {
      return value.map(v => this.resolveValue(v, fieldType));
    }

    // Handle date strings for date fields
    if (fieldType === 'date' && typeof value === 'string') {
      // Parse relative dates like "-1d", "+2w", etc.
      const relativeDateMatch = value.match(/^([+-]?\d+)([dwmyh])$/i);
      if (relativeDateMatch) {
        const amount = parseInt(relativeDateMatch[1], 10);
        const unit = relativeDateMatch[2].toLowerCase();
        const date = new Date();

        switch (unit) {
          case 'h': date.setHours(date.getHours() + amount); break;
          case 'd': date.setDate(date.getDate() + amount); break;
          case 'w': date.setDate(date.getDate() + amount * 7); break;
          case 'm': date.setMonth(date.getMonth() + amount); break;
          case 'y': date.setFullYear(date.getFullYear() + amount); break;
        }

        return date;
      }

      // Try to parse as date
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Handle UUID lookups for name-based values
    if (fieldType === 'uuid' && typeof value === 'string') {
      // If it looks like a UUID, return as-is
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        return value;
      }
      // Otherwise, it's a name that needs to be looked up - return as-is for now
      // The actual lookup should be done in the service layer
      return value;
    }

    return value;
  }

  private buildOrderSQL(orderBy: { field: string; direction: string }[]): string {
    return orderBy
      .map(item => {
        const fieldMapping = JQL_FIELD_MAPPINGS[item.field];
        if (fieldMapping) {
          const column = fieldMapping.table
            ? `${fieldMapping.table}.${fieldMapping.column}`
            : `i.${fieldMapping.column}`;
          const direction = item.direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
          return `${column} ${direction}`;
        }
        return '';
      })
      .filter(Boolean)
      .join(', ');
  }

  private transformIssues(rows: any[]): any[] {
    return rows.map(row => ({
      id: row.id,
      projectId: row.project_id,
      issueKey: row.issue_key,
      issueNumber: row.issue_number,
      title: row.title,
      description: row.description,
      type: {
        id: row.type_id,
        name: row.type_name,
        displayName: row.type_display_name,
        icon: row.type_icon,
        color: row.type_color,
      },
      status: {
        id: row.status_id,
        name: row.status_name,
        displayName: row.status_display_name,
        color: row.status_color,
        category: row.status_category,
      },
      priority: row.priority_id ? {
        id: row.priority_id,
        name: row.priority_name,
        displayName: row.priority_display_name,
        icon: row.priority_icon,
        color: row.priority_color,
      } : null,
      assignee: row.assignee_id ? {
        id: row.assignee_id,
        displayName: row.assignee_display_name,
        avatarUrl: row.assignee_avatar_url,
      } : null,
      reporter: {
        id: row.reporter_id,
        displayName: row.reporter_display_name,
        email: row.reporter_email,
        avatarUrl: row.reporter_avatar_url,
      },
      project: {
        id: row.project_id,
        name: row.project_name,
        key: row.project_key,
      },
      storyPoints: row.story_points,
      dueDate: row.due_date,
      startDate: row.start_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}
