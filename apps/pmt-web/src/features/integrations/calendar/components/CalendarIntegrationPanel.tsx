import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Calendar,
  Check,
  X,
  Settings,
  AlertTriangle,
  RefreshCw,
  CalendarDays,
  Clock,
  Info,
} from 'lucide-react';
import {
  useGetCalendarStatusQuery,
  useLazyGetOAuthUrlQuery,
  useConnectCalendarMutation,
  useUpdateCalendarSettingsMutation,
  useDisconnectCalendarMutation,
  useLazyListCalendarsQuery,
  useSelectCalendarMutation,
} from '../calendarApi';
import {
  CalendarProvider,
  CalendarListItem,
  CALENDAR_PROVIDERS,
  SYNC_FEATURE_LABELS,
} from '../types';

export function CalendarIntegrationPanel() {
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showCalendarSelect, setShowCalendarSelect] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<CalendarProvider | null>(null);

  const { data: status, isLoading, refetch } = useGetCalendarStatusQuery();
  const [getOAuthUrl] = useLazyGetOAuthUrlQuery();
  const [connectCalendar] = useConnectCalendarMutation();
  const [updateSettings, { isLoading: isUpdating }] = useUpdateCalendarSettingsMutation();
  const [disconnectCalendar, { isLoading: isDisconnecting }] = useDisconnectCalendarMutation();
  const [listCalendars, { data: calendars, isLoading: isLoadingCalendars }] =
    useLazyListCalendarsQuery();
  const [selectCalendar, { isLoading: isSelectingCalendar }] = useSelectCalendarMutation();

  const handleConnect = async (provider: CalendarProvider) => {
    try {
      setSelectedProvider(provider);
      const result = await getOAuthUrl({
        provider,
        returnUrl: window.location.href,
      }).unwrap();

      // Open OAuth in popup
      const popup = window.open(result.url, `${provider}-calendar-auth`, 'width=600,height=700');

      // Listen for the OAuth callback message from the popup
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data?.type === 'calendar-oauth-callback') {
          window.removeEventListener('message', handleMessage);
          try {
            await connectCalendar({
              code: event.data.code,
              provider,
              state: event.data.state,
            }).unwrap();
          } catch (err) {
            console.error('Failed to connect calendar:', err);
          }
          refetch();
          setSelectedProvider(null);
        } else if (event.data?.type === 'calendar-oauth-error') {
          window.removeEventListener('message', handleMessage);
          console.error('OAuth error:', event.data.error);
          setSelectedProvider(null);
        }
      };
      window.addEventListener('message', handleMessage);

      // Fallback: clean up if popup is closed without completing
      const checkClosed = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkClosed);
          // Give postMessage a moment to arrive before cleanup
          setTimeout(() => {
            window.removeEventListener('message', handleMessage);
            setSelectedProvider(null);
          }, 500);
        }
      }, 1000);
    } catch (err) {
      console.error('Failed to get OAuth URL:', err);
      setSelectedProvider(null);
    }
  };

  const handleToggleSyncDueDates = async (enabled: boolean) => {
    try {
      await updateSettings({ syncDueDates: enabled }).unwrap();
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleToggleSyncSprints = async (enabled: boolean) => {
    try {
      await updateSettings({ syncSprints: enabled }).unwrap();
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    try {
      await updateSettings({ enabled }).unwrap();
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectCalendar().unwrap();
      setShowDisconnectDialog(false);
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  };

  const handleOpenCalendarSelect = async () => {
    try {
      await listCalendars().unwrap();
      setShowCalendarSelect(true);
    } catch (err) {
      console.error('Failed to list calendars:', err);
    }
  };

  const handleSelectCalendar = async (calendar: CalendarListItem) => {
    try {
      await selectCalendar({
        calendarId: calendar.id,
        calendarName: calendar.name,
      }).unwrap();
      setShowCalendarSelect(false);
    } catch (err) {
      console.error('Failed to select calendar:', err);
    }
  };

  const getProviderIcon = (provider: CalendarProvider | null) => {
    if (provider === 'google') {
      return (
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      );
    } else if (provider === 'outlook') {
      return (
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path fill="#0078D4" d="M24 12l-12-8v5.333L0 4v16l12-5.333V20z" />
          <path fill="#0078D4" d="M12 9.333L0 4v16l12-5.333z" opacity="0.5" />
        </svg>
      );
    }
    return <Calendar className="h-5 w-5" />;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-6 w-40" />
          </div>
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              <CardTitle>Calendar Integration</CardTitle>
            </div>
            <Badge variant={status?.connected ? 'default' : 'secondary'}>
              {status?.connected ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <X className="h-3 w-3 mr-1" />
                  Not Connected
                </>
              )}
            </Badge>
          </div>
          <CardDescription>
            Sync issue due dates and sprint dates to your calendar.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {status?.connected ? (
            <div className="space-y-6">
              {/* Connected Calendar Info */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getProviderIcon(status.provider)}
                  <div>
                    <div className="font-medium">{status.calendarName}</div>
                    <div className="text-sm text-muted-foreground">
                      {status.provider === 'google' ? 'Google Calendar' : 'Outlook Calendar'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleOpenCalendarSelect}>
                    Change Calendar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDisconnectDialog(true)}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>

              {/* Sync Settings */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Sync Settings
                </h4>

                <div className="space-y-4 pl-6">
                  {/* Enable/Disable */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Calendar Sync</Label>
                      <p className="text-sm text-muted-foreground">
                        Turn calendar sync on or off
                      </p>
                    </div>
                    <Switch
                      checked={status.enabled}
                      onCheckedChange={handleToggleEnabled}
                      disabled={isUpdating}
                    />
                  </div>

                  {status.enabled && (
                    <>
                      {/* Sync Due Dates */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            {SYNC_FEATURE_LABELS.syncDueDates.label}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {SYNC_FEATURE_LABELS.syncDueDates.description}
                          </p>
                        </div>
                        <Switch
                          checked={status.syncDueDates}
                          onCheckedChange={handleToggleSyncDueDates}
                          disabled={isUpdating}
                        />
                      </div>

                      {/* Sync Sprints */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {SYNC_FEATURE_LABELS.syncSprints.label}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {SYNC_FEATURE_LABELS.syncSprints.description}
                          </p>
                        </div>
                        <Switch
                          checked={status.syncSprints}
                          onCheckedChange={handleToggleSyncSprints}
                          disabled={isUpdating}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Info Alert */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>How it works</AlertTitle>
                <AlertDescription>
                  <ul className="text-sm space-y-1 mt-2">
                    <li>- Issue due dates create all-day calendar events</li>
                    <li>- Sprint dates appear as multi-day events</li>
                    <li>- Events include reminders (1 hour and 24 hours before)</li>
                    <li>- Updates sync automatically when issues/sprints change</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Not Connected State */}
              <div className="text-center py-6">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="font-medium mb-2">Connect Your Calendar</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  Sync issue due dates and sprint dates to your calendar to never miss a deadline.
                </p>
              </div>

              {/* Provider Selection */}
              <div className="grid grid-cols-2 gap-4">
                {CALENDAR_PROVIDERS.map((provider) => (
                  <button
                    key={provider.id}
                    className="flex flex-col items-center p-6 border rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
                    onClick={() => handleConnect(provider.id)}
                    disabled={selectedProvider !== null}
                  >
                    {getProviderIcon(provider.id)}
                    <span className="font-medium mt-3">{provider.name}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {provider.description}
                    </span>
                    {selectedProvider === provider.id && (
                      <RefreshCw className="h-4 w-4 mt-2 animate-spin" />
                    )}
                  </button>
                ))}
              </div>

              {/* Features List */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Features</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Sync issue due dates as calendar events
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Add sprint dates to your calendar
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Automatic reminders before due dates
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Real-time sync when issues are updated
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Choose which calendar to sync to
                  </li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disconnect Dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Disconnect Calendar?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will stop syncing due dates and sprints to your calendar. Existing calendar
              events will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Calendar Selection Dialog */}
      <AlertDialog open={showCalendarSelect} onOpenChange={setShowCalendarSelect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Select Calendar</AlertDialogTitle>
            <AlertDialogDescription>
              Choose which calendar to sync your issues and sprints to.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            {isLoadingCalendars ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : calendars && calendars.length > 0 ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {calendars.map((calendar) => (
                  <button
                    key={calendar.id}
                    className="flex items-center justify-between w-full p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectCalendar(calendar)}
                    disabled={isSelectingCalendar}
                  >
                    <div className="flex items-center gap-3">
                      {calendar.backgroundColor && (
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: calendar.backgroundColor }}
                        />
                      )}
                      <div className="text-left">
                        <div className="font-medium">{calendar.name}</div>
                        {calendar.primary && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Primary
                          </Badge>
                        )}
                      </div>
                    </div>
                    {status?.calendarName === calendar.name && (
                      <Check className="h-5 w-5 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No calendars available
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default CalendarIntegrationPanel;
