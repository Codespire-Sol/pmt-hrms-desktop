import { WebhookEventPayload, WebhookEventType } from '../webhooks/webhooks.types';
import { AdaptiveCard, TeamsWebhookPayload } from './teams.types';

// Brand color for cards
const ACCENT_COLOR = '#1268ff';

const EVENT_COLORS: Partial<Record<WebhookEventType, string>> = {
  'issue.created':      '#52c41a',  // green
  'issue.updated':      '#1890ff',  // blue
  'issue.deleted':      '#ff4d4f',  // red
  'issue.transitioned': '#722ed1',  // purple
  'issue.assigned':     '#13c2c2',  // cyan
  'issue.commented':    '#fa8c16',  // orange
  'sprint.started':     '#52c41a',
  'sprint.completed':   '#1268ff',
  'sprint.created':     '#13c2c2',
  'sprint.deleted':     '#ff4d4f',
  'project.updated':    '#1890ff',
  'project.member_added':   '#52c41a',
  'project.member_removed': '#ff4d4f',
  'board.issue_moved':  '#722ed1',
  'comment.created':    '#fa8c16',
  'comment.updated':    '#fa8c16',
  'comment.deleted':    '#ff4d4f',
  'attachment.created': '#13c2c2',
  'attachment.deleted': '#ff4d4f',
};

const EVENT_EMOJIS: Partial<Record<WebhookEventType, string>> = {
  'issue.created':          '🆕',
  'issue.updated':          '✏️',
  'issue.deleted':          '🗑️',
  'issue.transitioned':     '🔄',
  'issue.assigned':         '👤',
  'issue.commented':        '💬',
  'sprint.started':         '🚀',
  'sprint.completed':       '🏁',
  'sprint.created':         '📋',
  'sprint.deleted':         '🗑️',
  'project.updated':        '⚙️',
  'project.member_added':   '👋',
  'project.member_removed': '👋',
  'board.issue_moved':      '↔️',
  'comment.created':        '💬',
  'comment.updated':        '✏️',
  'comment.deleted':        '🗑️',
  'attachment.created':     '📎',
  'attachment.deleted':     '🗑️',
};

const EVENT_TITLES: Partial<Record<WebhookEventType, string>> = {
  'issue.created':          'Issue Created',
  'issue.updated':          'Issue Updated',
  'issue.deleted':          'Issue Deleted',
  'issue.transitioned':     'Issue Status Changed',
  'issue.assigned':         'Issue Assigned',
  'issue.commented':        'Comment Added',
  'sprint.started':         'Sprint Started',
  'sprint.completed':       'Sprint Completed',
  'sprint.created':         'Sprint Created',
  'sprint.deleted':         'Sprint Deleted',
  'project.updated':        'Project Updated',
  'project.member_added':   'Member Added',
  'project.member_removed': 'Member Removed',
  'board.issue_moved':      'Issue Moved on Board',
  'comment.created':        'Comment Created',
  'comment.updated':        'Comment Updated',
  'comment.deleted':        'Comment Deleted',
  'attachment.created':     'Attachment Added',
  'attachment.deleted':     'Attachment Deleted',
};

/**
 * Build a Teams Adaptive Card for a webhook event payload.
 * Returns a TeamsWebhookPayload ready to POST to the incoming webhook URL.
 */
export function buildAdaptiveCard(
  payload: WebhookEventPayload,
  includeIssueDetails = true,
  frontendBaseUrl = 'https://app.projectflow.ai'
): TeamsWebhookPayload {
  const { event, projectName, actor, data } = payload;
  const _color = EVENT_COLORS[event] || ACCENT_COLOR;
  const emoji = EVENT_EMOJIS[event] || '🔔';
  const title = EVENT_TITLES[event] || event;

  const card: AdaptiveCard = {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    msteams: { width: 'Full' },
    body: [
      // Header bar (colored strip + title)
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'auto',
            items: [
              {
                type: 'Image',
                url: `${frontendBaseUrl}/Favicon.png`,
                size: 'Small',
                style: 'RoundedCorners',
                altText: 'ProjectFlow',
              },
            ],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              {
                type: 'TextBlock',
                text: `**${emoji} ${title}**`,
                wrap: true,
                size: 'Medium',
                weight: 'Bolder',
                color: 'Accent',
              },
              {
                type: 'TextBlock',
                text: projectName ? `in **${projectName}**` : 'ProjectFlow AI',
                wrap: true,
                spacing: 'None',
                isSubtle: true,
                size: 'Small',
              },
            ],
          },
        ],
      },
    ],
    actions: [],
  };

  // Add event-specific body content
  const bodySection = buildEventBody(event, data, includeIssueDetails, frontendBaseUrl);
  if (bodySection.length > 0) {
    card.body.push({ type: 'Container', separator: true, items: bodySection });
  }

  // Footer: actor + timestamp
  card.body.push({
    type: 'ColumnSet',
    separator: true,
    columns: [
      {
        type: 'Column',
        width: 'stretch',
        items: [
          {
            type: 'TextBlock',
            text: actor ? `By **${actor.displayName}**` : 'System',
            wrap: true,
            size: 'Small',
            isSubtle: true,
          },
        ],
      },
      {
        type: 'Column',
        width: 'auto',
        items: [
          {
            type: 'TextBlock',
            text: `{{DATE(${payload.timestamp},SHORT)}} {{TIME(${payload.timestamp})}}`,
            wrap: true,
            size: 'Small',
            isSubtle: true,
          },
        ],
      },
    ],
  });

  // Add "View" action if issue data present
  const issueUrl = buildIssueUrl(event, data, frontendBaseUrl, payload.projectId);
  if (issueUrl) {
    card.actions!.push({
      type: 'Action.OpenUrl',
      title: 'View in ProjectFlow',
      url: issueUrl,
    });
  }

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: card,
      },
    ],
  };
}

function buildEventBody(
  event: WebhookEventType,
  data: any,
  includeDetails: boolean,
  _baseUrl: string
): any[] {
  if (!data || !includeDetails) return [];

  const items: any[] = [];

  // Issue events
  if (event.startsWith('issue.') || event === 'comment.created' || event === 'comment.updated' || event === 'board.issue_moved') {
    if (data.issueKey || data.title) {
      items.push({
        type: 'TextBlock',
        text: data.issueKey ? `**[${data.issueKey}]** ${data.title || ''}` : data.title,
        wrap: true,
        weight: 'Bolder',
      });
    }

    const facts: Array<{ title: string; value: string }> = [];

    if (data.type) facts.push({ title: 'Type', value: data.type });
    if (data.priority) facts.push({ title: 'Priority', value: data.priority });
    if (data.status || data.toStatus) facts.push({ title: 'Status', value: data.status || data.toStatus });
    if (data.fromStatus && data.toStatus) {
      // Override status for transition events
      facts[facts.length - 1] = { title: 'Status', value: `${data.fromStatus} → ${data.toStatus}` };
    }
    if (data.assignee?.displayName) facts.push({ title: 'Assignee', value: data.assignee.displayName });

    if (facts.length > 0) {
      items.push({ type: 'FactSet', facts });
    }

    // Comment text preview
    if (event === 'issue.commented' || event === 'comment.created') {
      const commentText = data.comment || data.content;
      if (commentText) {
        const preview = String(commentText).replace(/[*_~`#]/g, '').substring(0, 200);
        items.push({
          type: 'TextBlock',
          text: preview + (commentText.length > 200 ? '...' : ''),
          wrap: true,
          isSubtle: true,
          size: 'Small',
        });
      }
    }

    // Assignment event: show who was assigned
    if (event === 'issue.assigned' && data.assignee) {
      items.push({
        type: 'TextBlock',
        text: `Assigned to **${data.assignee.displayName || data.assignee}**`,
        wrap: true,
        isSubtle: true,
      });
    }
  }

  // Sprint events
  if (event.startsWith('sprint.')) {
    if (data.sprintName || data.name) {
      items.push({
        type: 'TextBlock',
        text: `**${data.sprintName || data.name}**`,
        wrap: true,
        weight: 'Bolder',
      });
    }

    const facts: Array<{ title: string; value: string }> = [];
    if (data.startDate) facts.push({ title: 'Start Date', value: new Date(data.startDate).toLocaleDateString() });
    if (data.endDate) facts.push({ title: 'End Date', value: new Date(data.endDate).toLocaleDateString() });
    if (data.issueCount !== undefined) facts.push({ title: 'Issues', value: String(data.issueCount) });
    if (data.completedIssues !== undefined) facts.push({ title: 'Completed', value: String(data.completedIssues) });

    if (facts.length > 0) {
      items.push({ type: 'FactSet', facts });
    }
  }

  // Project events
  if (event.startsWith('project.')) {
    if (event === 'project.member_added' || event === 'project.member_removed') {
      const memberName = data.member?.displayName || data.memberName;
      if (memberName) {
        items.push({
          type: 'TextBlock',
          text: event === 'project.member_added'
            ? `**${memberName}** joined the project`
            : `**${memberName}** was removed from the project`,
          wrap: true,
        });
      }
    }
  }

  return items;
}

function buildIssueUrl(
  event: WebhookEventType,
  data: any,
  baseUrl: string,
  projectId: string
): string | null {
  if (!data) return null;

  if (data.issueId) {
    return `${baseUrl}/issues/${data.issueId}`;
  }

  if (data.sprintId) {
    return `${baseUrl}/projects/${projectId}/sprints`;
  }

  if (event.startsWith('project.')) {
    return `${baseUrl}/projects/${projectId}`;
  }

  return null;
}

/**
 * Build a test/hello card for connection verification.
 */
export function buildTestCard(projectName?: string): TeamsWebhookPayload {
  const card: AdaptiveCard = {
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    type: 'AdaptiveCard',
    version: '1.4',
    msteams: { width: 'Full' },
    body: [
      {
        type: 'ColumnSet',
        columns: [
          {
            type: 'Column',
            width: 'auto',
            items: [
              { type: 'TextBlock', text: '✅', size: 'ExtraLarge' },
            ],
          },
          {
            type: 'Column',
            width: 'stretch',
            items: [
              {
                type: 'TextBlock',
                text: '**Connection Successful!**',
                wrap: true,
                size: 'Large',
                weight: 'Bolder',
                color: 'Good',
              },
              {
                type: 'TextBlock',
                text: projectName
                  ? `ProjectFlow AI notifications for **${projectName}** are now connected to this channel.`
                  : 'ProjectFlow AI notifications are now connected to this channel.',
                wrap: true,
                spacing: 'None',
              },
            ],
          },
        ],
      },
      {
        type: 'TextBlock',
        separator: true,
        text: 'You will receive Adaptive Card notifications here for the events you have subscribed to.',
        wrap: true,
        isSubtle: true,
        size: 'Small',
      },
    ],
  };

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: card,
      },
    ],
  };
}
