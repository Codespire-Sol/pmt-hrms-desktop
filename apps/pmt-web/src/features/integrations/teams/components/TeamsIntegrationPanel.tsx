import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  useGetTeamsStatusQuery,
  useConnectTeamsMutation,
  useUpdateTeamsConfigMutation,
  useToggleTeamsMutation,
  useTestTeamsMutation,
  useDisconnectTeamsMutation,
} from '../teamsApi';
import {
  EVENT_CATEGORIES,
  EVENT_LABELS,
  type WebhookEventType,
} from '@/features/webhooks/types';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

const DEFAULT_EVENTS: WebhookEventType[] = [
  'issue.created',
  'issue.transitioned',
  'issue.assigned',
  'issue.commented',
  'sprint.started',
  'sprint.completed',
];

// Adaptive Card preview (static HTML mockup shown in the config dialog)
function AdaptiveCardPreview() {
  return (
    <div
      style={{
        border: '1px solid #e1e1e1',
        borderRadius: 8,
        overflow: 'hidden',
        fontSize: 13,
        fontFamily: 'Segoe UI, sans-serif',
        background: '#fff',
      }}
    >
      {/* Card header */}
      <div style={{ background: '#f3f2f1', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 6, background: '#1268ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 11, fontWeight: 700,
        }}>PF</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1268ff' }}>🆕 Issue Created</div>
          <div style={{ color: '#605e5c', fontSize: 11 }}>in <strong>My Project</strong></div>
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #edebe9' }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>[PROJ-42] Fix login page crash on mobile</div>
        <table style={{ fontSize: 12, color: '#605e5c', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ paddingRight: 12, fontWeight: 600 }}>Type</td><td>Bug</td></tr>
            <tr><td style={{ paddingRight: 12, fontWeight: 600 }}>Priority</td><td>High</td></tr>
            <tr><td style={{ paddingRight: 12, fontWeight: 600 }}>Assignee</td><td>Jane Smith</td></tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid #edebe9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#605e5c', fontSize: 11 }}>By <strong>John Doe</strong></span>
        <span style={{ color: '#605e5c', fontSize: 11 }}>Today 14:32</span>
      </div>

      {/* Action button */}
      <div style={{ padding: '8px 14px', borderTop: '1px solid #edebe9' }}>
        <button style={{
          background: '#1268ff', color: '#fff', border: 'none', borderRadius: 4,
          padding: '6px 14px', fontSize: 12, cursor: 'default', fontWeight: 600,
        }}>
          View in ProjectFlow
        </button>
      </div>
    </div>
  );
}

interface TeamsIntegrationPanelProps {
  projectId: string;
}

export function TeamsIntegrationPanel({ projectId }: TeamsIntegrationPanelProps) {
  const { toast } = useToast();
  const { hasPermission: canUpdateProject } = usePermissionGuard('projects.update');
  const { hasPermission: canDeleteProject } = usePermissionGuard('projects.delete');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEventType[]>(DEFAULT_EVENTS);
  const [includeIssueDetails, setIncludeIssueDetails] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const { data: status, isLoading } = useGetTeamsStatusQuery(projectId);

  const [connectTeams, { isLoading: isConnecting }] = useConnectTeamsMutation();
  const [updateTeamsConfig, { isLoading: isUpdating }] = useUpdateTeamsConfigMutation();
  const [toggleTeams] = useToggleTeamsMutation();
  const [testTeams] = useTestTeamsMutation();
  const [disconnectTeams, { isLoading: isDisconnecting }] = useDisconnectTeamsMutation();

  const config = status?.config;
  const isSaving = isConnecting || isUpdating;

  useEffect(() => {
    if (config) {
      setWebhookUrl(config.webhookUrl);
      setSelectedEvents(config.events);
      setIncludeIssueDetails(config.includeIssueDetails);
    } else {
      setWebhookUrl('');
      setSelectedEvents(DEFAULT_EVENTS);
      setIncludeIssueDetails(true);
    }
  }, [config]);

  const toggleEvent = (event: WebhookEventType, checked: boolean) => {
    setSelectedEvents((current) =>
      checked ? [...current, event] : current.filter((value) => value !== event)
    );
  };

  const toggleCategory = (events: WebhookEventType[], checked: boolean) => {
    setSelectedEvents((current) => {
      if (checked) return Array.from(new Set([...current, ...events]));
      return current.filter((value) => !events.includes(value));
    });
  };

  const handleSave = async () => {
    if (!webhookUrl.trim()) {
      toast({ title: 'Webhook URL required', description: 'Paste the Microsoft Teams incoming webhook URL.', variant: 'destructive' });
      return;
    }
    if (selectedEvents.length === 0) {
      toast({ title: 'Select at least one event', description: 'Choose the events you want to send to Teams.', variant: 'destructive' });
      return;
    }

    try {
      if (config) {
        await updateTeamsConfig({
          projectId,
          input: { webhookUrl: webhookUrl.trim(), events: selectedEvents, includeIssueDetails },
        }).unwrap();
        toast({ title: 'Teams configuration updated', description: 'Adaptive Card notifications are configured.' });
      } else {
        await connectTeams({
          projectId,
          input: { webhookUrl: webhookUrl.trim(), events: selectedEvents, includeIssueDetails, validate: true },
        }).unwrap();
        toast({ title: 'Microsoft Teams connected', description: 'Adaptive Card notifications are now enabled.' });
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast({
        title: 'Failed to save Teams configuration',
        description: error?.data?.error?.message || error?.data?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleToggle = async () => {
    if (!config) return;
    try {
      await toggleTeams({ projectId, isEnabled: !config.isEnabled }).unwrap();
      toast({ title: config.isEnabled ? 'Teams notifications disabled' : 'Teams notifications enabled' });
    } catch {
      toast({ title: 'Failed to update status', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const handleTest = async () => {
    try {
      const result = await testTeams(projectId).unwrap();
      toast({ title: 'Test message sent', description: result.message || 'Check your Teams channel for an Adaptive Card.' });
    } catch (error: any) {
      toast({
        title: 'Test failed',
        description: error?.data?.error?.message || 'Unable to deliver test notification to Teams.',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectTeams(projectId).unwrap();
      toast({ title: 'Microsoft Teams disconnected', description: 'Channel notifications have been removed.' });
    } catch {
      toast({ title: 'Failed to disconnect', description: 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Microsoft Teams</CardTitle>
        <CardDescription>
          Send rich Adaptive Card notifications to your Teams channel using incoming webhooks.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Create an Incoming Webhook connector in your Teams channel, then paste the webhook URL below.
          Notifications are delivered as interactive Adaptive Cards with issue details and quick-action buttons.
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {config ? (
            <>
              <Badge variant={config.isEnabled ? 'default' : 'secondary'}>
                {config.isEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Badge variant="outline">{config.events.length} events</Badge>
              <Badge variant="outline" className="text-xs">Adaptive Cards</Badge>
              {config.updatedAt && (
                <span className="text-xs text-muted-foreground">
                  Updated {new Date(config.updatedAt).toLocaleString()}
                </span>
              )}
            </>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDialogOpen(true)} disabled={!canUpdateProject}>
            {config ? 'Edit configuration' : 'Connect Teams'}
          </Button>
          {config && (
            <>
              <Button variant="outline" onClick={handleToggle} disabled={!canUpdateProject}>
                {config.isEnabled ? 'Disable' : 'Enable'}
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={!canUpdateProject}>
                Send test card
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={!canDeleteProject || isDisconnecting}
              >
                Disconnect
              </Button>
            </>
          )}
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Microsoft Teams Configuration</DialogTitle>
              <DialogDescription>
                Notifications will be delivered as Adaptive Cards with issue details and a "View in ProjectFlow" button.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {/* Webhook URL */}
              <div className="space-y-2">
                <Label htmlFor="teams-webhook-url">Incoming Webhook URL</Label>
                <Input
                  id="teams-webhook-url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://outlook.office.com/webhook/..."
                />
                <p className="text-xs text-muted-foreground">
                  In Microsoft Teams, go to channel → More options → Connectors → Incoming Webhook → Configure.
                  Copy the generated URL and paste it here.
                </p>
              </div>

              {/* Options */}
              <div className="space-y-3">
                <Label>Card Options</Label>
                <div className="flex items-center gap-3">
                  <Switch
                    id="include-details"
                    checked={includeIssueDetails}
                    onCheckedChange={setIncludeIssueDetails}
                  />
                  <Label htmlFor="include-details" className="font-normal cursor-pointer">
                    Include issue details (type, priority, assignee, status)
                  </Label>
                </div>
              </div>

              {/* Adaptive Card Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Notification Preview</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setShowPreview((v) => !v)}
                  >
                    {showPreview ? 'Hide preview' : 'Show preview'}
                  </Button>
                </div>
                {showPreview && (
                  <div className="rounded-lg border p-3 bg-slate-50">
                    <p className="text-xs text-muted-foreground mb-3">
                      This is how your Teams notifications will appear (Adaptive Card format):
                    </p>
                    <AdaptiveCardPreview />
                  </div>
                )}
              </div>

              {/* Events */}
              <div className="space-y-2">
                <Label>Events to notify</Label>
                <p className="text-sm text-muted-foreground">
                  Choose which events should send Adaptive Cards to the Teams channel.
                </p>
                <Accordion type="multiple" className="border rounded-lg">
                  {Object.entries(EVENT_CATEGORIES).map(([key, { label, events }]) => {
                    const allSelected = events.every((event) => selectedEvents.includes(event));
                    const someSelected =
                      events.some((event) => selectedEvents.includes(event)) && !allSelected;

                    return (
                      <AccordionItem key={key} value={key}>
                        <AccordionTrigger className="px-4">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={allSelected}
                              ref={(ref) => {
                                if (ref) (ref as any).indeterminate = someSelected;
                              }}
                              onCheckedChange={(checked) => toggleCategory(events, !!checked)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span>{label}</span>
                            <span className="text-xs text-muted-foreground">
                              ({events.filter((e) => selectedEvents.includes(e)).length}/{events.length})
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="grid grid-cols-2 gap-2">
                            {events.map((event) => (
                              <div key={event} className="flex items-center gap-2">
                                <Checkbox
                                  id={`teams-${event}`}
                                  checked={selectedEvents.includes(event)}
                                  onCheckedChange={(checked) => toggleEvent(event, !!checked)}
                                />
                                <Label htmlFor={`teams-${event}`} className="text-sm font-normal">
                                  {EVENT_LABELS[event]}
                                </Label>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>

              {!config && (
                <div className="rounded-md bg-blue-50 border border-blue-200 p-3 text-xs text-blue-700">
                  <strong>Note:</strong> When you click "Save configuration", a test Adaptive Card will be sent
                  to your Teams channel to verify the webhook URL is valid before saving.
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSave} disabled={isSaving || isLoading}>
                {isSaving ? 'Saving...' : 'Save configuration'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default TeamsIntegrationPanel;
