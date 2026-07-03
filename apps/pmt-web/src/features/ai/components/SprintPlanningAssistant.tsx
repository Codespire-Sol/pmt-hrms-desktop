import { useState } from 'react';
import {
  Brain,
  Users,
  TrendingUp,
  AlertTriangle,
  ListOrdered,
  RefreshCw,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import {
  useRecommendSprintScopeQuery,
  useAnalyzeWorkloadQuery,
  usePredictCompletionQuery,
  useSuggestIssueOrderQuery,
  useAnalyzeSprintRisksQuery,
  useSuggestReassignmentsQuery,
} from '../aiApi';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';

interface SprintPlanningAssistantProps {
  projectId: string;
  sprintId?: string;
}

export function SprintPlanningAssistant({
  projectId,
  sprintId,
}: SprintPlanningAssistantProps) {
  const [activeTab, setActiveTab] = useState('overview');

  const { data: scopeRec, isLoading: loadingScope, refetch: refetchScope } =
    useRecommendSprintScopeQuery({ projectId });

  const { data: workload, isLoading: loadingWorkload, refetch: refetchWorkload } =
    useAnalyzeWorkloadQuery(
      { projectId, sprintId },
      { skip: !sprintId }
    );

  const { data: prediction, isLoading: loadingPrediction, refetch: refetchPrediction } =
    usePredictCompletionQuery(
      { projectId, sprintId: sprintId! },
      { skip: !sprintId }
    );

  const { data: issueOrder, isLoading: loadingOrder } = useSuggestIssueOrderQuery(
    { projectId, sprintId: sprintId! },
    { skip: !sprintId }
  );

  const { data: risks, isLoading: loadingRisks } = useAnalyzeSprintRisksQuery(
    { projectId, sprintId: sprintId! },
    { skip: !sprintId }
  );

  const { data: reassignments } =
    useSuggestReassignmentsQuery(
      { projectId, sprintId: sprintId! },
      { skip: !sprintId }
    );

  const handleRefreshAll = () => {
    refetchScope();
    if (sprintId) {
      refetchWorkload();
      refetchPrediction();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on_track':
        return 'bg-green-500';
      case 'at_risk':
        return 'bg-yellow-500';
      case 'likely_incomplete':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'high':
        return 'text-orange-600';
      case 'critical':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">AI Planning Assistant</h2>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefreshAll}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="workload">Workload</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
          <TabsTrigger value="order">Order</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Completion Prediction */}
          {sprintId && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Sprint Completion Prediction
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPrediction ? (
                  <Skeleton className="h-24 w-full" />
                ) : prediction ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <div className="text-3xl font-bold">
                          {prediction.completionProbability}%
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Completion Likelihood
                        </p>
                      </div>
                      <Badge
                        className={`${getStatusColor(prediction.predictedStatus)} text-white`}
                      >
                        {prediction.predictedStatus.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <Progress value={prediction.completionProbability} />
                    {prediction.analysis && (
                      <p className="text-sm text-muted-foreground">
                        {prediction.analysis}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No prediction available
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Sprint Scope Recommendation */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Scope Recommendation
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingScope ? (
                <Skeleton className="h-20 w-full" />
              ) : scopeRec ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    Recommended:{' '}
                    <strong>{scopeRec.recommendedPoints} points</strong>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {scopeRec.reasoning}
                  </p>
                  {scopeRec.warnings?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {scopeRec.warnings.map((warning, i) => (
                        <Badge key={i} variant="outline" className="text-yellow-600">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {warning}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No recommendations available
                </p>
              )}
            </CardContent>
          </Card>

          {/* Risk Summary */}
          {sprintId && risks && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Risk Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Overall Risk Level:</span>
                  <Badge
                    variant="outline"
                    className={getRiskLevelColor(risks.riskLevel)}
                  >
                    {risks.riskLevel.toUpperCase()}
                  </Badge>
                </div>
                {risks.bottlenecks?.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    <strong>Bottlenecks:</strong>{' '}
                    {risks.bottlenecks.slice(0, 2).join(', ')}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="workload" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Team Workload Distribution
              </CardTitle>
              <CardDescription>
                Balance score:{' '}
                {workload
                  ? `${Math.round(workload.overallBalanceScore * 100)}%`
                  : 'N/A'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingWorkload ? (
                <Skeleton className="h-32 w-full" />
              ) : workload?.teamWorkload?.length ? (
                <ScrollArea className="h-[250px]">
                  <div className="space-y-3">
                    {workload.teamWorkload.map((member) => (
                      <div key={member.userId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="truncate max-w-[120px]">
                            {member.displayName}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                member.isOverloaded
                                  ? 'destructive'
                                  : member.utilizationPercent < 50
                                    ? 'secondary'
                                    : 'default'
                              }
                            >
                              {member.assignedPoints}/{member.capacityPoints}
                            </Badge>
                            <span className="text-xs text-muted-foreground w-12 text-right">
                              {Math.round(member.utilizationPercent)}%
                            </span>
                          </div>
                        </div>
                        <Progress
                          value={Math.min(member.utilizationPercent, 100)}
                          className={
                            member.isOverloaded
                              ? '[&>div]:bg-red-500'
                              : member.utilizationPercent < 50
                                ? '[&>div]:bg-yellow-500'
                                : ''
                          }
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No workload data available
                </p>
              )}

              {/* Reassignment Suggestions */}
              {(reassignments?.suggestions?.length ?? 0) > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-2">
                    Suggested Reassignments
                  </h4>
                  <div className="space-y-2">
                    {reassignments?.suggestions?.slice(0, 3).map((suggestion, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-xs bg-muted/50 p-2 rounded"
                      >
                        <Badge variant="outline">{suggestion.issueKey}</Badge>
                        <span className="text-muted-foreground">
                          {suggestion.fromMember}
                        </span>
                        <ArrowRight className="h-3 w-3" />
                        <span>{suggestion.toMember}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Sprint Risk Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingRisks ? (
                <Skeleton className="h-40 w-full" />
              ) : risks ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">Risk Level:</span>
                    <Badge
                      variant="outline"
                      className={getRiskLevelColor(risks.riskLevel)}
                    >
                      {risks.riskLevel.toUpperCase()}
                    </Badge>
                  </div>

                  {risks.risks?.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Identified Risks</h4>
                      {risks.risks.map((risk, i) => (
                        <Collapsible key={i}>
                          <CollapsibleTrigger className="flex items-center gap-2 text-sm w-full text-left hover:bg-muted/50 p-2 rounded">
                            <ChevronRight className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-90" />
                            <Badge
                              variant="outline"
                              className={
                                risk.severity === 'high'
                                  ? 'text-red-600'
                                  : risk.severity === 'medium'
                                    ? 'text-yellow-600'
                                    : 'text-green-600'
                              }
                            >
                              {risk.severity}
                            </Badge>
                            <span className="truncate">{risk.description}</span>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="pl-6 py-2">
                            <p className="text-sm text-muted-foreground">
                              <strong>Type:</strong> {risk.type}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              <strong>Mitigation:</strong> {risk.mitigation}
                            </p>
                          </CollapsibleContent>
                        </Collapsible>
                      ))}
                    </div>
                  )}

                  {risks.recommendations?.length > 0 && (
                    <div className="pt-2 border-t">
                      <h4 className="text-sm font-medium mb-2">Recommendations</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {risks.recommendations.map((rec, i) => (
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
                <p className="text-sm text-muted-foreground">
                  Select a sprint to analyze risks
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="order" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ListOrdered className="h-4 w-4" />
                Suggested Issue Order
              </CardTitle>
              <CardDescription>
                Optimal order based on dependencies and priorities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOrder ? (
                <Skeleton className="h-40 w-full" />
              ) : issueOrder?.suggestedOrder?.length ? (
                <div className="space-y-3">
                  <ScrollArea className="h-[250px]">
                    {issueOrder.suggestedOrder.map((item) => (
                      <div
                        key={item.issueId}
                        className="flex items-start gap-3 p-2 hover:bg-muted/50 rounded"
                      >
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          {item.position}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{item.issueKey}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {item.reason}
                          </p>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                  {issueOrder.reasoning && (
                    <p className="text-sm text-muted-foreground pt-2 border-t">
                      {issueOrder.reasoning}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Select a sprint to see suggested issue order
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
