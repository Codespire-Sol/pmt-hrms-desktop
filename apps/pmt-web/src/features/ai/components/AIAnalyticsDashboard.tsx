import {
  useGetAnalyticsUsageQuery,
  useGetCostEstimateQuery,
  useGetDailyTrendsQuery,
  useGetEndpointPerformanceQuery,
  useGetFeedbackSummaryQuery,
} from '../aiApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3,
  Activity,
  DollarSign,
  Zap,
  TrendingUp,
  TrendingDown,
  ThumbsUp,
  Clock,
  Server,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface AIAnalyticsDashboardProps {
  projectId?: string;
  days?: number;
}

export function AIAnalyticsDashboard({
  projectId,
  days = 30,
}: AIAnalyticsDashboardProps) {
  const {
    data: usageStats,
    isLoading: usageLoading,
    error: usageError,
  } = useGetAnalyticsUsageQuery({ projectId });

  const {
    data: costEstimate,
    isLoading: costLoading,
  } = useGetCostEstimateQuery({ projectId });

  const {
    data: dailyTrends,
    isLoading: trendsLoading,
  } = useGetDailyTrendsQuery({ days: 14, projectId });

  const {
    data: endpointPerformance,
    isLoading: perfLoading,
  } = useGetEndpointPerformanceQuery();

  const {
    data: feedbackSummary,
    isLoading: feedbackLoading,
  } = useGetFeedbackSummaryQuery({ days });

  const isLoading =
    usageLoading || costLoading || trendsLoading || perfLoading || feedbackLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading analytics...</span>
      </div>
    );
  }

  if (usageError) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load analytics data</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxTrendRequests = dailyTrends
    ? Math.max(...dailyTrends.trends.map((t) => t.requests), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageStats?.totalRequests.toLocaleString() ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {usageStats?.cacheHitRate
                ? `${Math.round(usageStats.cacheHitRate * 100)}% cache hit rate`
                : 'Last 30 days'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usageStats?.tokenUsage.total.toLocaleString() ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {usageStats?.tokenUsage.input.toLocaleString()} in /{' '}
              {usageStats?.tokenUsage.output.toLocaleString()} out
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Est. Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${costEstimate?.effectiveCost.toFixed(2) ?? '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              ${costEstimate?.cacheSavings.toFixed(2) ?? '0.00'} saved via cache
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
            <ThumbsUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {feedbackSummary
                ? `${Math.round(feedbackSummary.overallAcceptanceRate * 100)}%`
                : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {feedbackSummary?.total ?? 0} total feedbacks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Daily Usage Trends
          </CardTitle>
          <CardDescription>AI requests over the last 14 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dailyTrends?.trends.slice(-7).map((day) => (
              <div key={day.date} className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-20">
                  {new Date(day.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <div className="flex-1">
                  <Progress
                    value={(day.requests / maxTrendRequests) * 100}
                    className="h-2"
                  />
                </div>
                <span className="text-sm font-medium w-16 text-right">
                  {day.requests}
                </span>
                {day.errors > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {day.errors} errors
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Endpoint Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Endpoint Performance
            </CardTitle>
            <CardDescription>Response times and usage by endpoint</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {endpointPerformance?.endpoints.slice(0, 6).map((endpoint) => (
                <div key={endpoint.endpoint} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate max-w-[200px]">
                      {endpoint.endpoint.split('/').pop()}
                    </span>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {endpoint.avgResponseTimeMs}ms avg
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={
                        (endpoint.totalRequests /
                          (endpointPerformance.endpoints[0]?.totalRequests || 1)) *
                        100
                      }
                      className="h-1.5"
                    />
                    <span className="text-xs text-muted-foreground w-12">
                      {endpoint.totalRequests}
                    </span>
                  </div>
                  {endpoint.errorRate > 0 && (
                    <span className="text-xs text-destructive">
                      {(endpoint.errorRate * 100).toFixed(1)}% error rate
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Feedback by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5" />
              Feedback by Suggestion Type
            </CardTitle>
            <CardDescription>Acceptance rates across different AI features</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {feedbackSummary?.byType.map((stat) => {
                const acceptancePercent = Math.round(stat.acceptanceRate * 100);
                const isGood = acceptancePercent >= 70;
                const isModerate = acceptancePercent >= 50 && acceptancePercent < 70;

                return (
                  <div key={stat.type} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">
                        {stat.type.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        {isGood ? (
                          <TrendingUp className="h-3 w-3 text-green-600" />
                        ) : isModerate ? (
                          <TrendingUp className="h-3 w-3 text-yellow-600" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-600" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            isGood
                              ? 'text-green-600'
                              : isModerate
                                ? 'text-yellow-600'
                                : 'text-red-600'
                          }`}
                        >
                          {acceptancePercent}%
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={acceptancePercent}
                      className={`h-1.5 ${
                        isGood
                          ? '[&>div]:bg-green-500'
                          : isModerate
                            ? '[&>div]:bg-yellow-500'
                            : '[&>div]:bg-red-500'
                      }`}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{stat.total} suggestions</span>
                      <span>{stat.acceptedCount} accepted</span>
                    </div>
                  </div>
                );
              })}
              {(!feedbackSummary?.byType || feedbackSummary.byType.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No feedback data available yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Breakdown
          </CardTitle>
          <CardDescription>Estimated API costs based on token usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Input Tokens</p>
              <p className="text-lg font-semibold">
                {costEstimate?.inputTokens.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">
                ${costEstimate?.inputCost.toFixed(4) ?? '0.0000'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Output Tokens</p>
              <p className="text-lg font-semibold">
                {costEstimate?.outputTokens.toLocaleString() ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">
                ${costEstimate?.outputCost.toFixed(4) ?? '0.0000'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Cache Savings</p>
              <p className="text-lg font-semibold text-green-600">
                -${costEstimate?.cacheSavings.toFixed(2) ?? '0.00'}
              </p>
              <p className="text-xs text-muted-foreground">
                From cached responses
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Effective Cost</p>
              <p className="text-lg font-semibold">
                ${costEstimate?.effectiveCost.toFixed(2) ?? '0.00'}
              </p>
              <p className="text-xs text-muted-foreground">
                Total: ${costEstimate?.totalCost.toFixed(2) ?? '0.00'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
