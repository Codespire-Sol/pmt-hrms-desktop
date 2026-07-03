import { useState } from 'react';
import {
  useGetSlackStatusQuery,
  useDisconnectSlackMutation,
  useLazyGetSlackOAuthUrlQuery,
  useListSlackChannelsQuery,
  useGetChannelConfigsQuery,
  useConfigureChannelMutation,
  useRemoveChannelMutation,
  useSendTestNotificationMutation,
} from '../slackApi';
import {
  SlackEventType,
  SLACK_EVENT_LABELS,
  ALL_SLACK_EVENTS,
  DEFAULT_SLACK_EVENTS,
} from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Loader2,
  AlertCircle,
  CheckCircle,
  Hash,
  Trash2,
  Plus,
  Send,
  ExternalLink,
  Unlink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Slack logo SVG component
function SlackLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.271 0a2.528 2.528 0 0 1-2.521 2.521 2.528 2.528 0 0 1-2.521-2.521V2.522A2.528 2.528 0 0 1 15.164 0a2.528 2.528 0 0 1 2.521 2.522v6.312zm-2.521 10.122a2.528 2.528 0 0 1 2.521 2.522A2.528 2.528 0 0 1 15.164 24a2.528 2.528 0 0 1-2.521-2.522v-2.522h2.521zm0-1.271a2.528 2.528 0 0 1-2.521-2.521 2.528 2.528 0 0 1 2.521-2.521h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.521h-6.313z" />
    </svg>
  );
}

interface SlackIntegrationPanelProps {
  projectId: string;
}

export function SlackIntegrationPanel({ projectId }: SlackIntegrationPanelProps) {
  const { toast } = useToast();
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [selectedEvents, setSelectedEvents] = useState<SlackEventType[]>(DEFAULT_SLACK_EVENTS);

  const {
    data: status,
    isLoading: statusLoading,
    error: statusError,
  } = useGetSlackStatusQuery(projectId);

  const { data: channelsData } = useListSlackChannelsQuery(projectId, {
    skip: !status?.connected,
  });

  const { data: configsData } = useGetChannelConfigsQuery(projectId, {
    skip: !status?.connected,
  });

  const [getOAuthUrl] = useLazyGetSlackOAuthUrlQuery();
  const [disconnectSlack, { isLoading: disconnecting }] = useDisconnectSlackMutation();
  const [configureChannel, { isLoading: configuring }] = useConfigureChannelMutation();
  const [removeChannel, { isLoading: removing }] = useRemoveChannelMutation();
  const [sendTestNotification, { isLoading: sendingTest }] = useSendTestNotificationMutation();

  const handleConnect = async () => {
    try {
      const redirectUri = `${window.location.origin}/integrations/slack/callback`;
      const result = await getOAuthUrl({ projectId, redirectUri }).unwrap();
      window.location.href = result.url;
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to initiate Slack connection',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectSlack(projectId).unwrap();
      toast({
        title: 'Disconnected',
        description: 'Slack workspace has been disconnected',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect Slack',
        variant: 'destructive',
      });
    }
  };

  const handleAddChannel = async () => {
    if (!selectedChannel || selectedEvents.length === 0) return;

    const channel = channelsData?.channels.find((c) => c.id === selectedChannel);
    if (!channel) return;

    try {
      await configureChannel({
        projectId,
        channelId: channel.id,
        channelName: channel.name,
        events: selectedEvents,
      }).unwrap();

      setSelectedChannel('');
      setSelectedEvents(DEFAULT_SLACK_EVENTS);

      toast({
        title: 'Channel Added',
        description: `#${channel.name} will now receive notifications`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to configure channel',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveChannel = async (channelConfigId: string) => {
    try {
      await removeChannel({ projectId, channelConfigId }).unwrap();
      toast({
        title: 'Channel Removed',
        description: 'Channel will no longer receive notifications',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove channel',
        variant: 'destructive',
      });
    }
  };

  const handleSendTest = async (channelId: string, event: SlackEventType) => {
    try {
      await sendTestNotification({ projectId, channelId, event }).unwrap();
      toast({
        title: 'Test Sent',
        description: 'Check your Slack channel for the test notification',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send test notification',
        variant: 'destructive',
      });
    }
  };

  const toggleEvent = (event: SlackEventType) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading integration status...</span>
      </div>
    );
  }

  if (statusError) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load Slack integration status</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SlackLogo className="h-8 w-8 text-[#4A154B]" />
              <div>
                <CardTitle>Slack Integration</CardTitle>
                <CardDescription>
                  Connect your Slack workspace to receive notifications
                </CardDescription>
              </div>
            </div>
            {status?.connected ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {status?.connected && status.workspace ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div>
                  <p className="font-medium">{status.workspace.teamName}</p>
                  <p className="text-sm text-muted-foreground">
                    Connected since{' '}
                    {new Date(status.workspace.installedAt).toLocaleDateString()}
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={disconnecting}>
                      {disconnecting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Unlink className="h-4 w-4 mr-2" />
                      )}
                      Disconnect
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Slack?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove all Slack notifications for this project.
                        You can reconnect at any time.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDisconnect}>
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <SlackLogo className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Connect your Slack workspace to start receiving notifications
              </p>
              <Button onClick={handleConnect}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect to Slack
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel Configuration */}
      {status?.connected && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Notification Channels</CardTitle>
              <CardDescription>
                Choose which Slack channels receive notifications and for which events
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Existing Channels */}
              <div className="space-y-3 mb-6">
                {configsData?.configs.map((config) => (
                  <div
                    key={config.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{config.channelName}</p>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {config.events.map((event) => (
                            <Badge key={event} variant="secondary" className="text-xs">
                              {SLACK_EVENT_LABELS[event].label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSendTest(config.channelId, config.events[0])}
                        disabled={sendingTest}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveChannel(config.id)}
                        disabled={removing}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {(!configsData?.configs || configsData.configs.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No channels configured yet
                  </p>
                )}
              </div>

              {/* Add New Channel */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Add Channel</h4>
                <div className="space-y-4">
                  <div>
                    <Label>Channel</Label>
                    <Select value={selectedChannel} onValueChange={setSelectedChannel}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select a channel" />
                      </SelectTrigger>
                      <SelectContent>
                        {channelsData?.channels
                          .filter(
                            (c) =>
                              !configsData?.configs.some((cfg) => cfg.channelId === c.id)
                          )
                          .map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>
                              # {channel.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Events</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {ALL_SLACK_EVENTS.map((event) => (
                        <div key={event} className="flex items-center space-x-2">
                          <Checkbox
                            id={event}
                            checked={selectedEvents.includes(event)}
                            onCheckedChange={() => toggleEvent(event)}
                          />
                          <label
                            htmlFor={event}
                            className="text-sm cursor-pointer"
                          >
                            {SLACK_EVENT_LABELS[event].label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleAddChannel}
                    disabled={!selectedChannel || selectedEvents.length === 0 || configuring}
                  >
                    {configuring ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Add Channel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Slash Commands */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Slash Commands</CardTitle>
              <CardDescription>
                Use these commands in Slack to interact with codeSpire solutions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <code className="text-sm font-mono">/pf-create [title] - [description]</code>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create a new issue directly from Slack
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <code className="text-sm font-mono">/pf-search [query]</code>
                  <p className="text-sm text-muted-foreground mt-1">
                    Search for issues by keyword
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <code className="text-sm font-mono">/pf-my-issues</code>
                  <p className="text-sm text-muted-foreground mt-1">
                    View your assigned issues
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <code className="text-sm font-mono">/pf-help</code>
                  <p className="text-sm text-muted-foreground mt-1">
                    Show available commands
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
