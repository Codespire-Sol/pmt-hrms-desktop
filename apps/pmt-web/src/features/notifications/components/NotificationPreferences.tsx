import { useState } from 'react';
import { Bell, Mail, Loader2, Check } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useGetPreferencesQuery,
  useUpdatePreferencesMutation,
} from '../notificationsApi';
import { NotificationPreference, UpdatePreferenceInput } from '../types';

interface PreferenceRowProps {
  preference: NotificationPreference;
  onChange: (type: string, field: 'inAppEnabled' | 'emailEnabled', value: boolean) => void;
  disabled?: boolean;
}

function PreferenceRow({ preference, onChange, disabled }: PreferenceRowProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b last:border-b-0">
      <div className="flex-1">
        <h4 className="text-sm font-medium">{preference.label}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">{preference.description}</p>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <Switch
            checked={preference.inAppEnabled}
            onCheckedChange={(checked) =>
              onChange(preference.notificationType, 'inAppEnabled', checked)
            }
            disabled={disabled}
          />
        </div>

        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <Switch
            checked={preference.emailEnabled}
            onCheckedChange={(checked) =>
              onChange(preference.notificationType, 'emailEnabled', checked)
            }
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

export function NotificationPreferences() {
  const { data: preferences = [], isLoading } = useGetPreferencesQuery();
  const [updatePreferences, { isLoading: isSaving }] = useUpdatePreferencesMutation();

  const [localPreferences, setLocalPreferences] = useState<Record<string, NotificationPreference>>(
    {}
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [saved, setSaved] = useState(false);

  // Initialize local preferences from API data
  const mergedPreferences = preferences.map((pref) => ({
    ...pref,
    ...(localPreferences[pref.notificationType] || {}),
  }));

  const handleChange = (
    type: string,
    field: 'inAppEnabled' | 'emailEnabled',
    value: boolean
  ) => {
    const current = localPreferences[type] || preferences.find((p) => p.notificationType === type);
    setLocalPreferences((prev) => ({
      ...prev,
      [type]: {
        ...current!,
        [field]: value,
      },
    }));
    setHasChanges(true);
    setSaved(false);
  };

  const handleSave = async () => {
    const updates: UpdatePreferenceInput[] = Object.entries(localPreferences).map(
      ([type, pref]) => ({
        notificationType: type as any,
        inAppEnabled: pref.inAppEnabled,
        emailEnabled: pref.emailEnabled,
      })
    );

    if (updates.length === 0) return;

    try {
      await updatePreferences(updates).unwrap();
      setLocalPreferences({});
      setHasChanges(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  const handleReset = () => {
    setLocalPreferences({});
    setHasChanges(false);
  };

  // Toggle all in-app or email notifications
  const handleToggleAll = (field: 'inAppEnabled' | 'emailEnabled', value: boolean) => {
    const updates: Record<string, NotificationPreference> = {};
    for (const pref of preferences) {
      updates[pref.notificationType] = {
        ...pref,
        ...(localPreferences[pref.notificationType] || {}),
        [field]: value,
      };
    }
    setLocalPreferences(updates);
    setHasChanges(true);
    setSaved(false);
  };

  const allInAppEnabled = mergedPreferences.every((p) => p.inAppEnabled);
  const allEmailEnabled = mergedPreferences.every((p) => p.emailEnabled);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Choose how you want to be notified about activity in your projects.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Header row with toggle all */}
        <div className="flex items-center justify-between pb-4 border-b mb-2">
          <div className="text-sm font-medium text-muted-foreground">Notification Type</div>
          <div className="flex items-center gap-6">
            <button
              onClick={() => handleToggleAll('inAppEnabled', !allInAppEnabled)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Bell className="h-4 w-4" />
              <span>In-App</span>
            </button>
            <button
              onClick={() => handleToggleAll('emailEnabled', !allEmailEnabled)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="h-4 w-4" />
              <span>Email</span>
            </button>
          </div>
        </div>

        {/* Preference rows */}
        <div className="divide-y">
          {mergedPreferences.map((pref) => (
            <PreferenceRow
              key={pref.notificationType}
              preference={pref}
              onChange={handleChange}
              disabled={isSaving}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check className="h-4 w-4" />
                Preferences saved
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!hasChanges || isSaving}
            >
              Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Preferences'
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
