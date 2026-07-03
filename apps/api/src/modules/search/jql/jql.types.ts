export type JQLOperator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | '~'    // contains
  | '!~'   // does not contain
  | 'IN'
  | 'NOT IN'
  | 'IS'
  | 'IS NOT'
  | 'WAS'
  | 'WAS NOT'
  | 'CHANGED';

export type JQLLogicalOperator = 'AND' | 'OR';

export type JQLOrderDirection = 'ASC' | 'DESC';

export interface JQLFunction {
  name: string;
  args: string[];
}

export type JQLValue = string | number | boolean | null | JQLFunction | JQLValue[];

export interface JQLCondition {
  field: string;
  operator: JQLOperator;
  value: JQLValue;
  negate?: boolean;
}

export interface JQLClause {
  type: 'condition' | 'group';
  condition?: JQLCondition;
  clauses?: JQLClause[];
  logicalOperator?: JQLLogicalOperator;
}

export interface JQLOrderBy {
  field: string;
  direction: JQLOrderDirection;
}

export interface JQLQuery {
  where?: JQLClause;
  orderBy?: JQLOrderBy[];
}

export interface JQLParseResult {
  success: boolean;
  query?: JQLQuery;
  error?: string;
  errorPosition?: number;
}

// Field mappings from JQL field names to database columns
export const JQL_FIELD_MAPPINGS: Record<string, { column: string; table?: string; type: 'string' | 'number' | 'date' | 'uuid' | 'array' | 'boolean' }> = {
  // Issue fields
  'project': { column: 'project_id', type: 'uuid' },
  'type': { column: 'type_id', type: 'uuid' },
  'issuetype': { column: 'type_id', type: 'uuid' },
  'status': { column: 'status_id', type: 'uuid' },
  'priority': { column: 'priority_id', type: 'uuid' },
  'assignee': { column: 'assignee_id', type: 'uuid' },
  'reporter': { column: 'reporter_id', type: 'uuid' },
  'sprint': { column: 'sprint_id', type: 'uuid' },
  'parent': { column: 'parent_id', type: 'uuid' },
  'summary': { column: 'title', type: 'string' },
  'title': { column: 'title', type: 'string' },
  'description': { column: 'description', type: 'string' },
  'created': { column: 'created_at', type: 'date' },
  'updated': { column: 'updated_at', type: 'date' },
  'duedate': { column: 'due_date', type: 'date' },
  'due': { column: 'due_date', type: 'date' },
  'startdate': { column: 'start_date', type: 'date' },
  'resolution': { column: 'resolution', type: 'string' },
  'resolutiondate': { column: 'resolution_date', type: 'date' },
  'resolved': { column: 'resolution_date', type: 'date' },
  'storypoints': { column: 'story_points', type: 'number' },
  'story_points': { column: 'story_points', type: 'number' },
  'originalestimate': { column: 'original_estimate_hours', type: 'number' },
  'remainingestimate': { column: 'remaining_estimate_hours', type: 'number' },
  'timespent': { column: 'time_spent_hours', type: 'number' },
  'fixversion': { column: 'fix_version_id', type: 'uuid' },
  'affectedversion': { column: 'affected_version_id', type: 'uuid' },
  'component': { column: 'component_id', table: 'issue_components', type: 'uuid' },
  'label': { column: 'label_id', table: 'issue_labels', type: 'uuid' },
  'watcher': { column: 'user_id', table: 'issue_watchers', type: 'uuid' },
  'voter': { column: 'user_id', table: 'issue_votes', type: 'uuid' },
  'securitylevel': { column: 'security_level_id', type: 'uuid' },
  // Text search
  'text': { column: 'text_search', type: 'string' },
};

// Functions that can be used in JQL
export const JQL_FUNCTIONS: Record<string, (args: string[], context: JQLContext) => any> = {
  'currentUser': (_args, context) => context.currentUserId,
  'currentLogin': (_args, context) => context.currentUserId,
  'now': () => new Date(),
  'today': () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  },
  'startOfDay': (args) => {
    const offset = args[0] ? parseInt(args[0]) : 0;
    const d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(0, 0, 0, 0);
    return d;
  },
  'endOfDay': (args) => {
    const offset = args[0] ? parseInt(args[0]) : 0;
    const d = new Date();
    d.setDate(d.getDate() + offset);
    d.setHours(23, 59, 59, 999);
    return d;
  },
  'startOfWeek': (args) => {
    const offset = args[0] ? parseInt(args[0]) : 0;
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day + (offset * 7));
    d.setHours(0, 0, 0, 0);
    return d;
  },
  'endOfWeek': (args) => {
    const offset = args[0] ? parseInt(args[0]) : 0;
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day + 6 + (offset * 7));
    d.setHours(23, 59, 59, 999);
    return d;
  },
  'startOfMonth': (args) => {
    const offset = args[0] ? parseInt(args[0]) : 0;
    const d = new Date();
    d.setMonth(d.getMonth() + offset, 1);
    d.setHours(0, 0, 0, 0);
    return d;
  },
  'endOfMonth': (args) => {
    const offset = args[0] ? parseInt(args[0]) : 0;
    const d = new Date();
    d.setMonth(d.getMonth() + offset + 1, 0);
    d.setHours(23, 59, 59, 999);
    return d;
  },
  'membersOf': (args) => {
    // Returns project members - needs to be resolved during query execution
    return { type: 'membersOf', project: args[0] };
  },
  'componentsLeadBy': (args, context) => {
    // Returns components led by user - needs to be resolved during query execution
    return { type: 'componentsLeadBy', user: args[0] || context.currentUserId };
  },
};

export interface JQLContext {
  currentUserId: string;
  projectId?: string;
}
