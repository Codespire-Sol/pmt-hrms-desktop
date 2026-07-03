import React from 'react';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { MultiSelect } from '../../../components/ui/multi-select';
import type { TriggerType, TriggerConfig } from '../types';

interface TriggerConfigPanelProps {
  triggerType: TriggerType;
  config: TriggerConfig;
  onChange: (config: TriggerConfig) => void;
}

// Common timezone list
const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Australia/Sydney',
];

// Common cron presets
const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at 9 AM', value: '0 9 * * *' },
  { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
  { label: 'First day of month at 9 AM', value: '0 9 1 * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
];

export function TriggerConfigPanel({ triggerType, config, onChange }: TriggerConfigPanelProps) {
  const handleChange = (key: keyof TriggerConfig, value: any) => {
    onChange({ ...config, [key]: value });
  };

  switch (triggerType) {
    case 'issue_created':
    case 'issue_updated':
    case 'issue_assigned':
    case 'issue_commented':
      return (
        <div className="space-y-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Optionally filter which issues trigger this rule:
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Issue Types</Label>
              <Input
                placeholder="e.g., Bug, Task (comma separated)"
                value={config.issueTypes?.join(', ') || ''}
                onChange={(e) =>
                  handleChange(
                    'issueTypes',
                    e.target.value ? e.target.value.split(',').map((s) => s.trim()) : undefined
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Statuses</Label>
              <Input
                placeholder="e.g., Open, In Progress"
                value={config.statuses?.join(', ') || ''}
                onChange={(e) =>
                  handleChange(
                    'statuses',
                    e.target.value ? e.target.value.split(',').map((s) => s.trim()) : undefined
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Priorities</Label>
              <Input
                placeholder="e.g., High, Critical"
                value={config.priorities?.join(', ') || ''}
                onChange={(e) =>
                  handleChange(
                    'priorities',
                    e.target.value ? e.target.value.split(',').map((s) => s.trim()) : undefined
                  )
                }
              />
            </div>
            {triggerType === 'issue_updated' && (
              <div className="space-y-2">
                <Label>Field Changed</Label>
                <Input
                  placeholder="e.g., status, assignee"
                  value={config.fieldChanged?.join(', ') || ''}
                  onChange={(e) =>
                    handleChange(
                      'fieldChanged',
                      e.target.value ? e.target.value.split(',').map((s) => s.trim()) : undefined
                    )
                  }
                />
              </div>
            )}
          </div>
        </div>
      );

    case 'issue_transitioned':
      return (
        <div className="space-y-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Configure which status transitions trigger this rule:
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From Status (optional)</Label>
              <Input
                placeholder="e.g., Open"
                value={config.fromStatus || ''}
                onChange={(e) => handleChange('fromStatus', e.target.value || undefined)}
              />
            </div>
            <div className="space-y-2">
              <Label>To Status (optional)</Label>
              <Input
                placeholder="e.g., In Progress"
                value={config.toStatus || ''}
                onChange={(e) => handleChange('toStatus', e.target.value || undefined)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Issue Types</Label>
              <Input
                placeholder="e.g., Bug, Task"
                value={config.issueTypes?.join(', ') || ''}
                onChange={(e) =>
                  handleChange(
                    'issueTypes',
                    e.target.value ? e.target.value.split(',').map((s) => s.trim()) : undefined
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Priorities</Label>
              <Input
                placeholder="e.g., High, Critical"
                value={config.priorities?.join(', ') || ''}
                onChange={(e) =>
                  handleChange(
                    'priorities',
                    e.target.value ? e.target.value.split(',').map((s) => s.trim()) : undefined
                  )
                }
              />
            </div>
          </div>
        </div>
      );

    case 'scheduled':
      return (
        <div className="space-y-4 pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Configure the schedule for this automation:
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Schedule Preset</Label>
              <Select
                value={
                  CRON_PRESETS.find((p) => p.value === config.cronExpression)?.value || 'custom'
                }
                onValueChange={(v) => {
                  if (v !== 'custom') {
                    handleChange('cronExpression', v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a preset" />
                </SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">Custom cron expression</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cron Expression</Label>
              <Input
                placeholder="e.g., 0 9 * * 1-5"
                value={config.cronExpression || ''}
                onChange={(e) => handleChange('cronExpression', e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Format: minute hour day-of-month month day-of-week
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select
              value={config.timezone || 'UTC'}
              onValueChange={(v) => handleChange('timezone', v)}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'sprint_started':
    case 'sprint_completed':
      return (
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            This rule will trigger when any sprint in this project is{' '}
            {triggerType === 'sprint_started' ? 'started' : 'completed'}.
          </p>
        </div>
      );

    case 'manual':
      return (
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            This rule can only be triggered manually from the automation rules list or via API.
          </p>
        </div>
      );

    default:
      return null;
  }
}
