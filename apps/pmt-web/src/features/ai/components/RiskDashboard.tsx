import { useState } from 'react';
import {
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Clock,
  RefreshCw,
  AlertOctagon,
  Activity,
  ChevronRight,
} from 'lucide-react';
import {
  useGetProjectRisksQuery,
  useGetAtRiskIssuesQuery,
  useGetVelocityTrendsQuery,
  useGetWorkflowBottlenecksQuery,
} from '../aiApi';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface RiskDashboardProps {
  projectId: string;
  sprintId?: string;
}

export function RiskDashboard({ projectId, sprintId }: RiskDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const {
    data: risks,
    isLoading: loadingRisks,
    refetch: refetchRisks,
  } = useGetProjectRisksQuery({ projectId });

  const {
    data: atRiskIssues,
    isLoading: loadingAtRisk,
    refetch: refetchAtRisk,
  } = useGetAtRiskIssuesQuery({ projectId, sprintId });

  const {
    data: velocityTrends,
    isLoading: loadingVelocity,
    refetch: refetchVelocity,
  } = useGetVelocityTrendsQuery({ projectId });

  const {
    data: bottlenecks,
    isLoading: loadingBottlenecks,
    refetch: refetchBottlenecks,
  } = useGetWorkflowBottlenecksQuery({ projectId, sprintId });

  const handleRefreshAll = () => {
    refetchRisks();
    refetchAtRisk();
    refetchVelocity();
    refetchBottlenecks();
  };

  const riskLevelColor: Record<string, string> = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  };

  const riskLevelTextColor: Record<string, string> = {
    low: 'text-green-600',
    medium: 'text-yellow-600',
    high: 'text-orange-600',
    critical: 'text-red-600',
  };

  const trendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case 'stable':
        return <Activity className="h-4 w-4 text-blue-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Risk Dashboard</h2>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefreshAll}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="issues">At-Risk Issues</TabsTrigger>
          <TabsTrigger value="velocity">Velocity</TabsTrigger>
          <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Overall Risk Score */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Risk Assessment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRisks ? (
                <Skeleton className="h-24 w-full" />
              ) : risks ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-3xl font-bold">{risks.riskScore}</span>
                      <span className="text-muted-foreground">/100</span>
                    </div>
                    <Badge
                      className={`${riskLevelColor[risks.overallRiskLevel]} text-white`}
                    >
                      {risks.overallRiskLevel.toUpperCase()}
                    </Badge>
                  </div>
                  <Progress value={risks.riskScore} className="h-2" />
                  <p className="text-sm text-muted-foreground">{risks.summary}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No risk data available
                </p>
              )}
            </CardContent>
          </Card>

          {/* Risk Categories */}
          {risks?.risks && risks.risks.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Identified Risks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {risks.risks.slice(0, 4).map((risk, i) => (
                    <Collapsible key={i}>
                      <CollapsibleTrigger className="flex items-center gap-2 text-sm w-full text-left hover:bg-muted/50 p-2 rounded">
                        <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                        <Badge variant="outline" className="shrink-0">
                          {risk.type}
                        </Badge>
                        <span className="truncate flex-1">{risk.description}</span>
                        <Badge
                          variant="outline"
                          className={riskLevelTextColor[risk.impact]}
                        >
                          {risk.impact}
                        </Badge>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pl-6 py-2 space-y-2">
                        <p className="text-xs text-muted-foreground">
                          <strong>Probability:</strong>{' '}
                          {Math.round(risk.probability * 100)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <strong>Affected Areas:</strong>{' '}
                          {risk.affectedAreas.join(', ')}
                        </p>
                        <p className="text-xs text-primary">
                          <strong>Recommendation:</strong> {risk.recommendation}
                        </p>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {atRiskIssues?.totalCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">At-Risk Issues</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {velocityTrends?.averageVelocity
                      ? Math.round(velocityTrends.averageVelocity)
                      : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">Avg Velocity</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {bottlenecks?.analysis
                      ? `${Math.round(bottlenecks.analysis.flowEfficiency * 100)}%`
                      : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">Flow Efficiency</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" />
                At-Risk Issues ({atRiskIssues?.totalCount || 0})
              </CardTitle>
              <CardDescription>
                Issues that may miss their deadlines
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingAtRisk ? (
                <Skeleton className="h-48 w-full" />
              ) : atRiskIssues?.atRiskIssues?.length ? (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {atRiskIssues.atRiskIssues.map((issue) => (
                      <a
                        key={issue.id}
                        href={`/issues/${issue.id}`}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 border"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-primary">
                              {issue.issueKey}
                            </span>
                            <Badge
                              variant={
                                issue.riskAssessment.riskLevel === 'critical'
                                  ? 'destructive'
                                  : issue.riskAssessment.riskLevel === 'high'
                                    ? 'default'
                                    : 'secondary'
                              }
                            >
                              {issue.riskAssessment.riskScore}%
                            </Badge>
                          </div>
                          <p className="text-sm truncate mt-1">{issue.title}</p>
                          {issue.dueDate && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Due: {new Date(issue.dueDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <Badge
                            variant="outline"
                            className={riskLevelTextColor[issue.riskAssessment.riskLevel]}
                          >
                            {issue.riskAssessment.riskLevel}
                          </Badge>
                        </div>
                      </a>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertOctagon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No at-risk issues detected</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="velocity" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Velocity Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingVelocity ? (
                <Skeleton className="h-32 w-full" />
              ) : velocityTrends ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Average Velocity
                      </p>
                      <div className="text-2xl font-bold">
                        {Math.round(velocityTrends.averageVelocity)} pts/sprint
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {trendIcon(velocityTrends.trend)}
                      <span className="text-sm capitalize">
                        {velocityTrends.trend}
                        {velocityTrends.trendPercentage && (
                          <span className="text-muted-foreground ml-1">
                            ({velocityTrends.trendPercentage > 0 ? '+' : ''}
                            {velocityTrends.trendPercentage.toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {velocityTrends.forecastNextSprint && (
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="text-sm">
                        <strong>Forecast:</strong> Next sprint estimated at{' '}
                        <span className="text-primary font-semibold">
                          {velocityTrends.forecastNextSprint} points
                        </span>
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Reliability Score</span>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={velocityTrends.reliabilityScore * 100}
                        className="w-24 h-2"
                      />
                      <span>
                        {Math.round(velocityTrends.reliabilityScore * 100)}%
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    {velocityTrends.analysis}
                  </p>

                  {velocityTrends.recommendations?.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-sm font-medium mb-2">Recommendations</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {velocityTrends.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Not enough data for velocity analysis
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bottlenecks" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Workflow Bottlenecks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingBottlenecks ? (
                <Skeleton className="h-32 w-full" />
              ) : bottlenecks ? (
                <div className="space-y-4">
                  {bottlenecks.bottleneckStatus && (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Primary Bottleneck
                        </p>
                        <div className="text-lg font-semibold">
                          {bottlenecks.bottleneckStatus}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={riskLevelTextColor[bottlenecks.bottleneckSeverity]}
                      >
                        {bottlenecks.bottleneckSeverity}
                      </Badge>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <div className="text-xl font-bold">
                        {Math.round(bottlenecks.analysis.flowEfficiency * 100)}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Flow Efficiency
                      </p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg text-center">
                      <div className="text-xl font-bold">
                        {bottlenecks.analysis.estimatedCycleTime} days
                      </div>
                      <p className="text-xs text-muted-foreground">Cycle Time</p>
                    </div>
                  </div>

                  {bottlenecks.analysis.congestedStatuses.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Congested Statuses</p>
                      <div className="flex flex-wrap gap-2">
                        {bottlenecks.analysis.congestedStatuses.map((status, i) => (
                          <Badge key={i} variant="outline">
                            {status}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground">
                    {bottlenecks.summary}
                  </p>

                  {bottlenecks.recommendations?.length > 0 && (
                    <div className="pt-2 border-t">
                      <p className="text-sm font-medium mb-2">Recommendations</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {bottlenecks.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No bottleneck data available
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
