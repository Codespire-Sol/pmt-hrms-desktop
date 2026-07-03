import { useState } from 'react';
import {
  useGetProjectConfigQuery,
  useUpdateProjectConfigMutation,
  useResetProjectConfigMutation,
  useGetFeatureAvailabilityQuery,
  useCheckRateLimitQuery,
} from '../aiApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Settings,
  Sparkles,
  MessageSquare,
  PenTool,
  Calendar,
  TrendingUp,
  Copy,
  Users,
  RefreshCw,
  Loader2,
  AlertCircle,
  Check,
  Save,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AIConfigPanelProps {
  projectId: string;
  userId?: string;
}

const FEATURE_INFO: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; label: string; description: string }
> = {
  suggestions: {
    icon: Sparkles,
    label: 'AI Suggestions',
    description: 'Get AI-powered suggestions for issue fields',
  },
  nlpParsing: {
    icon: MessageSquare,
    label: 'Natural Language Parsing',
    description: 'Create issues from natural language input',
  },
  writingAssist: {
    icon: PenTool,
    label: 'Writing Assistant',
    description: 'Improve text, generate acceptance criteria, summarize',
  },
  planning: {
    icon: Calendar,
    label: 'Sprint Planning',
    description: 'AI-assisted sprint scope and workload analysis',
  },
  predictions: {
    icon: TrendingUp,
    label: 'Predictive Analytics',
    description: 'Risk analysis, completion predictions, velocity trends',
  },
  similarIssues: {
    icon: Copy,
    label: 'Similar Issues Detection',
    description: 'Find potentially duplicate or related issues',
  },
  standupGeneration: {
    icon: Users,
    label: 'Standup Generation',
    description: 'Auto-generate daily standup summaries',
  },
};

export function AIConfigPanel({ projectId, userId }: AIConfigPanelProps) {
  const { toast } = useToast();
  const [pendingChanges, setPendingChanges] = useState<{
    enabled?: boolean;
    features?: Record<string, boolean>;
    limits?: Record<string, number>;
  }>({});

  const {
    data: config,
    isLoading: configLoading,
    error: configError,
  } = useGetProjectConfigQuery(projectId);

  const { data: availability } = useGetFeatureAvailabilityQuery(projectId);

  const { data: rateLimit } = useCheckRateLimitQuery(
    { projectId, userId: userId ?? '' },
    { skip: !userId }
  );

  const [updateConfig, { isLoading: updateLoading }] = useUpdateProjectConfigMutation();
  const [resetConfig, { isLoading: resetLoading }] = useResetProjectConfigMutation();

  const handleFeatureToggle = (feature: string, enabled: boolean) => {
    setPendingChanges((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: enabled,
      },
    }));
  };

  const handleEnableToggle = (enabled: boolean) => {
    setPendingChanges((prev) => ({
      ...prev,
      enabled,
    }));
  };

  const handleLimitChange = (limit: string, value: number) => {
    setPendingChanges((prev) => ({
      ...prev,
      limits: {
        ...prev.limits,
        [limit]: value,
      },
    }));
  };

  const saveChanges = async () => {
    if (Object.keys(pendingChanges).length === 0) return;

    try {
      await updateConfig({
        projectId,
        ...pendingChanges,
      }).unwrap();

      setPendingChanges({});
      toast({
        title: 'Configuration saved',
        description: 'AI settings have been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save configuration changes.',
        variant: 'destructive',
      });
    }
  };

  const handleReset = async () => {
    try {
      await resetConfig(projectId).unwrap();
      setPendingChanges({});
      toast({
        title: 'Configuration reset',
        description: 'AI settings have been reset to defaults.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reset configuration.',
        variant: 'destructive',
      });
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading configuration...</span>
      </div>
    );
  }

  if (configError || !config) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load AI configuration</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasChanges = Object.keys(pendingChanges).length > 0;
  const currentEnabled = pendingChanges.enabled ?? config.enabled;
  const currentFeatures = { ...config.features, ...pendingChanges.features };
  const currentLimits = { ...config.limits, ...pendingChanges.limits };

  return (
    <div className="space-y-6">
      {/* Master Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              <CardTitle>AI Features</CardTitle>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="ai-enabled" className="text-sm">
                  {currentEnabled ? 'Enabled' : 'Disabled'}
                </Label>
                <Switch
                  id="ai-enabled"
                  checked={currentEnabled}
                  onCheckedChange={handleEnableToggle}
                />
              </div>
              <Badge variant={currentEnabled ? 'default' : 'secondary'}>
                {currentEnabled ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
          <CardDescription>
            Control AI-powered features for this project
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Rate Limits Status */}
      {rateLimit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Usage Limits</CardTitle>
            <CardDescription>Current rate limit status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">User Requests Today</span>
                  <span>
                    {rateLimit.user.used} / {rateLimit.user.limit}
                  </span>
                </div>
                <Progress
                  value={(rateLimit.user.used / rateLimit.user.limit) * 100}
                  className={
                    rateLimit.user.remaining < 10 ? '[&>div]:bg-yellow-500' : ''
                  }
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Project Requests Today</span>
                  <span>
                    {rateLimit.project.used} / {rateLimit.project.limit}
                  </span>
                </div>
                <Progress
                  value={(rateLimit.project.used / rateLimit.project.limit) * 100}
                  className={
                    rateLimit.project.remaining < 100 ? '[&>div]:bg-yellow-500' : ''
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Resets at {new Date(rateLimit.resetTime).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Feature Toggles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Feature Settings</CardTitle>
          <CardDescription>Enable or disable individual AI features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(FEATURE_INFO).map(([key, info]) => {
              const Icon = info.icon;
              const featureKey = key as keyof typeof config.features;
              const isEnabled = currentFeatures[featureKey];
              const availabilityStatus = availability?.features[key];

              return (
                <div
                  key={key}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{info.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {info.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {availabilityStatus && !availabilityStatus.enabled && (
                      <Badge variant="outline" className="text-xs">
                        {availabilityStatus.reason}
                      </Badge>
                    )}
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleFeatureToggle(key, checked)}
                      disabled={!currentEnabled}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Rate Limits Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Rate Limits</CardTitle>
          <CardDescription>Configure usage limits for AI features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-limit">Requests per User per Day</Label>
              <Input
                id="user-limit"
                type="number"
                min={1}
                max={10000}
                value={currentLimits.requestsPerUserPerDay}
                onChange={(e) =>
                  handleLimitChange('requestsPerUserPerDay', parseInt(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-limit">Requests per Project per Day</Label>
              <Input
                id="project-limit"
                type="number"
                min={1}
                max={100000}
                value={currentLimits.requestsPerProjectPerDay}
                onChange={(e) =>
                  handleLimitChange('requestsPerProjectPerDay', parseInt(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="input-tokens">Max Input Tokens</Label>
              <Input
                id="input-tokens"
                type="number"
                min={100}
                max={100000}
                value={currentLimits.maxInputTokens}
                onChange={(e) =>
                  handleLimitChange('maxInputTokens', parseInt(e.target.value))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="output-tokens">Max Output Tokens</Label>
              <Input
                id="output-tokens"
                type="number"
                min={100}
                max={100000}
                value={currentLimits.maxOutputTokens}
                onChange={(e) =>
                  handleLimitChange('maxOutputTokens', parseInt(e.target.value))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={resetLoading}>
              {resetLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Reset to Defaults
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset AI Configuration?</AlertDialogTitle>
              <AlertDialogDescription>
                This will reset all AI feature settings and rate limits to their
                default values. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>
                Reset Configuration
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex gap-2">
          {hasChanges && (
            <Button
              variant="outline"
              onClick={() => setPendingChanges({})}
            >
              Discard Changes
            </Button>
          )}
          <Button
            onClick={saveChanges}
            disabled={!hasChanges || updateLoading}
          >
            {updateLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : hasChanges ? (
              <Save className="h-4 w-4 mr-2" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            {hasChanges ? 'Save Changes' : 'Saved'}
          </Button>
        </div>
      </div>
    </div>
  );
}
