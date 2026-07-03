import React from 'react';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Switch } from '../../../components/ui/switch';
import type { Action, ActionConfig } from '../types';

interface ActionConfigPanelProps {
  action: Action;
  onChange: (action: Action) => void;
}

export function ActionConfigPanel({ action, onChange }: ActionConfigPanelProps) {
  const updateConfig = (key: keyof ActionConfig, value: any) => {
    onChange({
      ...action,
      config: { ...action.config, [key]: value },
    });
  };

  switch (action.type) {
    case 'set_field':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Field Name</Label>
            <Input
              placeholder="e.g., priority, labels"
              value={action.config.field || ''}
              onChange={(e) => updateConfig('field', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Value</Label>
            <Input
              placeholder="New value"
              value={action.config.value || ''}
              onChange={(e) => updateConfig('value', e.target.value)}
            />
          </div>
        </div>
      );

    case 'transition_issue':
      return (
        <div className="space-y-2">
          <Label>Target Status</Label>
          <Input
            placeholder="e.g., In Progress, Done"
            value={action.config.statusId || ''}
            onChange={(e) => updateConfig('statusId', e.target.value)}
          />
        </div>
      );

    case 'assign_issue':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Assignment Type</Label>
            <Select
              value={action.config.assigneeType || 'specific'}
              onValueChange={(v) => updateConfig('assigneeType', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="specific">Specific User</SelectItem>
                <SelectItem value="reporter">Reporter</SelectItem>
                <SelectItem value="project_lead">Project Lead</SelectItem>
                <SelectItem value="component_lead">Component Lead</SelectItem>
                <SelectItem value="unassigned">Unassign</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {action.config.assigneeType === 'specific' && (
            <div className="space-y-2">
              <Label>User ID</Label>
              <Input
                placeholder="User ID"
                value={action.config.assigneeId || ''}
                onChange={(e) => updateConfig('assigneeId', e.target.value)}
              />
            </div>
          )}
        </div>
      );

    case 'add_comment':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Comment</Label>
            <Textarea
              placeholder="Enter comment text..."
              value={action.config.comment || ''}
              onChange={(e) => updateConfig('comment', e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Supports variables: {'{'}issue.key{'}'}, {'{'}issue.summary{'}'}, {'{'}user.name{'}'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={action.config.isInternal || false}
              onCheckedChange={(v) => updateConfig('isInternal', v)}
            />
            <Label>Internal comment (only visible to team)</Label>
          </div>
        </div>
      );

    case 'add_label':
    case 'remove_label':
      return (
        <div className="space-y-2">
          <Label>Label Name</Label>
          <Input
            placeholder="e.g., urgent, needs-review"
            value={action.config.labelName || ''}
            onChange={(e) => updateConfig('labelName', e.target.value)}
          />
        </div>
      );

    case 'add_watcher':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Watcher Type</Label>
            <Select
              value={action.config.userType || 'specific'}
              onValueChange={(v) => updateConfig('userType', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="specific">Specific User</SelectItem>
                <SelectItem value="reporter">Reporter</SelectItem>
                <SelectItem value="assignee">Assignee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {action.config.userType === 'specific' && (
            <div className="space-y-2">
              <Label>User ID</Label>
              <Input
                placeholder="User ID"
                value={action.config.userId || ''}
                onChange={(e) => updateConfig('userId', e.target.value)}
              />
            </div>
          )}
        </div>
      );

    case 'send_notification':
    case 'send_email':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Recipients</Label>
              <Select
                value={action.config.recipientType || 'assignee'}
                onValueChange={(v) => updateConfig('recipientType', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="specific">Specific Users</SelectItem>
                  <SelectItem value="assignee">Assignee</SelectItem>
                  <SelectItem value="reporter">Reporter</SelectItem>
                  <SelectItem value="watchers">Watchers</SelectItem>
                  <SelectItem value="project_members">Project Members</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {action.config.recipientType === 'specific' && (
              <div className="space-y-2">
                <Label>User IDs (comma separated)</Label>
                <Input
                  placeholder="user1-id, user2-id"
                  value={action.config.recipients?.join(', ') || ''}
                  onChange={(e) =>
                    updateConfig(
                      'recipients',
                      e.target.value ? e.target.value.split(',').map((s) => s.trim()) : []
                    )
                  }
                />
              </div>
            )}
          </div>
          {action.type === 'send_email' && (
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                placeholder="Email subject"
                value={action.config.subject || ''}
                onChange={(e) => updateConfig('subject', e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea
              placeholder="Notification message..."
              value={action.config.message || ''}
              onChange={(e) => updateConfig('message', e.target.value)}
              rows={3}
            />
          </div>
        </div>
      );

    case 'call_webhook':
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                placeholder="https://example.com/webhook"
                value={action.config.webhookUrl || ''}
                onChange={(e) => updateConfig('webhookUrl', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>HTTP Method</Label>
              <Select
                value={action.config.method || 'POST'}
                onValueChange={(v) => updateConfig('method', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Headers (JSON)</Label>
            <Textarea
              placeholder='{"Authorization": "Bearer token"}'
              value={
                action.config.headers ? JSON.stringify(action.config.headers, null, 2) : ''
              }
              onChange={(e) => {
                try {
                  const headers = e.target.value ? JSON.parse(e.target.value) : undefined;
                  updateConfig('headers', headers);
                } catch {
                  // Invalid JSON, don't update
                }
              }}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Body (JSON)</Label>
            <Textarea
              placeholder='{"key": "value"}'
              value={action.config.body ? JSON.stringify(action.config.body, null, 2) : ''}
              onChange={(e) => {
                try {
                  const body = e.target.value ? JSON.parse(e.target.value) : undefined;
                  updateConfig('body', body);
                } catch {
                  // Invalid JSON, don't update
                }
              }}
              rows={3}
            />
          </div>
        </div>
      );

    case 'create_subtask':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Subtask Title</Label>
            <Input
              placeholder="e.g., Code Review for {issue.key}"
              value={action.config.subtaskTitle || ''}
              onChange={(e) => updateConfig('subtaskTitle', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Subtask Type ID (optional)</Label>
            <Input
              placeholder="Issue type ID"
              value={action.config.subtaskTypeId || ''}
              onChange={(e) => updateConfig('subtaskTypeId', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="Subtask description..."
              value={action.config.subtaskDescription || ''}
              onChange={(e) => updateConfig('subtaskDescription', e.target.value)}
              rows={2}
            />
          </div>
        </div>
      );

    case 'link_issue':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Link Type</Label>
            <Select
              value={action.config.linkType || 'relates_to'}
              onValueChange={(v) => updateConfig('linkType', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relates_to">Relates To</SelectItem>
                <SelectItem value="blocks">Blocks</SelectItem>
                <SelectItem value="is_blocked_by">Is Blocked By</SelectItem>
                <SelectItem value="duplicates">Duplicates</SelectItem>
                <SelectItem value="is_duplicated_by">Is Duplicated By</SelectItem>
                <SelectItem value="clones">Clones</SelectItem>
                <SelectItem value="is_cloned_by">Is Cloned By</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Target Issue (ID or JQL)</Label>
            <Input
              placeholder="Issue ID or JQL query"
              value={action.config.targetIssueId || action.config.targetIssueJql || ''}
              onChange={(e) => updateConfig('targetIssueId', e.target.value)}
            />
          </div>
        </div>
      );

    case 'log_work':
      return (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Time Spent</Label>
            <Input
              placeholder="e.g., 1h 30m"
              value={action.config.timeSpent || ''}
              onChange={(e) => updateConfig('timeSpent', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input
              placeholder="Work description"
              value={action.config.workDescription || ''}
              onChange={(e) => updateConfig('workDescription', e.target.value)}
            />
          </div>
        </div>
      );

    case 'set_due_date':
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Due Date Type</Label>
            <Select
              value={action.config.dueDateType || 'relative'}
              onValueChange={(v) => updateConfig('dueDateType', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relative">Relative (days from now)</SelectItem>
                <SelectItem value="specific">Specific Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {action.config.dueDateType === 'specific' ? (
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={action.config.dueDate || ''}
                onChange={(e) => updateConfig('dueDate', e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Days from Now</Label>
              <Input
                type="number"
                placeholder="e.g., 7"
                value={action.config.relativeDays ?? ''}
                onChange={(e) =>
                  updateConfig('relativeDays', e.target.value ? parseInt(e.target.value) : undefined)
                }
              />
            </div>
          )}
        </div>
      );

    default:
      return (
        <p className="text-sm text-muted-foreground">
          No additional configuration needed for this action type.
        </p>
      );
  }
}
