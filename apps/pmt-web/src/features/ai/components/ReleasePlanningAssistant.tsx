import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertTriangle,
  CalendarIcon,
  RefreshCw,
  Sparkles,
  Package,
  Target,
  Clock,
  Users,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart3,
  Layers,
  ArrowRight,
  Calendar as CalendarIconAlt,
  GitBranch,
  Flag,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  useGenerateReleasePlanMutation,
  useAnalyzeReleaseCapacityMutation,
  useSuggestReleaseScopeMutation,
  useGenerateRoadmapMutation,
  useEstimateReleaseDateMutation,
  useGetReleaseTypesQuery,
} from '../aiApi';
import type {
  ReleaseItem,
  ReleasePhase,
  ReleasePlanResponse,
  CapacityAnalysisResponse,
  ScopeSuggestionResponse,
  RoadmapResponse,
  DateEstimateResponse,
} from '../types';

interface ReleasePlanningAssistantProps {
  projectId: string;
  onPlanApply?: (plan: ReleasePlanResponse) => void;
  onScopeSelect?: (items: ReleaseItem[]) => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-green-500 text-white',
};

const ITEM_STATUS_ICONS: Record<string, React.ReactNode> = {
  included: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  excluded: <XCircle className="h-4 w-4 text-red-500" />,
  optional: <AlertCircle className="h-4 w-4 text-yellow-500" />,
};

export function ReleasePlanningAssistant({
  projectId,
  onPlanApply,
  onScopeSelect,
}: ReleasePlanningAssistantProps) {
  const [activeTab, setActiveTab] = useState('plan');
  const [releaseName, setReleaseName] = useState('');
  const [targetDate, setTargetDate] = useState<Date | undefined>();
  const [targetPoints, setTargetPoints] = useState<number>(50);
  const [quarters, setQuarters] = useState<number>(4);
  const [releasePlan, setReleasePlan] = useState<ReleasePlanResponse | null>(null);
  const [capacityAnalysis, setCapacityAnalysis] = useState<CapacityAnalysisResponse | null>(null);
  const [scopeSuggestion, setScopeSuggestion] = useState<ScopeSuggestionResponse | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const [dateEstimate, setDateEstimate] = useState<DateEstimateResponse | null>(null);

  const { data: releaseTypes } = useGetReleaseTypesQuery();
  const [generatePlan, { isLoading: isGenerating }] = useGenerateReleasePlanMutation();
  const [analyzeCapacity, { isLoading: isAnalyzing }] = useAnalyzeReleaseCapacityMutation();
  const [suggestScope, { isLoading: isSuggesting }] = useSuggestReleaseScopeMutation();
  const [generateRoadmap, { isLoading: isGeneratingRoadmap }] = useGenerateRoadmapMutation();
  const [estimateDate, { isLoading: isEstimating }] = useEstimateReleaseDateMutation();

  const handleGeneratePlan = useCallback(async () => {
    if (!releaseName.trim()) return;

    try {
      const result = await generatePlan({
        projectId,
        releaseName,
        targetDate: targetDate ? format(targetDate, 'yyyy-MM-dd') : undefined,
      }).unwrap();

      setReleasePlan(result);
    } catch (error) {
      console.error('Failed to generate release plan:', error);
    }
  }, [projectId, releaseName, targetDate, generatePlan]);

  const handleAnalyzeCapacity = useCallback(async () => {
    if (!targetDate) return;

    const startDate = new Date();
    try {
      const result = await analyzeCapacity({
        projectId,
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(targetDate, 'yyyy-MM-dd'),
      }).unwrap();

      setCapacityAnalysis(result);
    } catch (error) {
      console.error('Failed to analyze capacity:', error);
    }
  }, [projectId, targetDate, analyzeCapacity]);

  const handleSuggestScope = useCallback(async () => {
    try {
      const result = await suggestScope({
        projectId,
        targetPoints,
      }).unwrap();

      setScopeSuggestion(result);
    } catch (error) {
      console.error('Failed to suggest scope:', error);
    }
  }, [projectId, targetPoints, suggestScope]);

  const handleGenerateRoadmap = useCallback(async () => {
    try {
      const result = await generateRoadmap({
        projectId,
        quarters,
      }).unwrap();

      setRoadmap(result);
    } catch (error) {
      console.error('Failed to generate roadmap:', error);
    }
  }, [projectId, quarters, generateRoadmap]);

  const handleApplyPlan = useCallback(() => {
    if (releasePlan && onPlanApply) {
      onPlanApply(releasePlan);
    }
  }, [releasePlan, onPlanApply]);

  const handleApplyScope = useCallback(() => {
    if (scopeSuggestion && onScopeSelect) {
      onScopeSelect(scopeSuggestion.includedItems);
    }
  }, [scopeSuggestion, onScopeSelect]);

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case 'high':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      case 'low':
        return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-blue-500" />
          Release Planning Assistant
        </CardTitle>
        <CardDescription>
          AI-powered release planning, capacity analysis, and roadmap generation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="plan">Release Plan</TabsTrigger>
            <TabsTrigger value="capacity">Capacity</TabsTrigger>
            <TabsTrigger value="scope">Scope</TabsTrigger>
            <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
          </TabsList>

          {/* Release Plan Tab */}
          <TabsContent value="plan" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="releaseName">Release Name</Label>
                <Input
                  id="releaseName"
                  placeholder="e.g., v2.0.0, Q1 Release"
                  value={releaseName}
                  onChange={(e) => setReleaseName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Target Date (optional)</Label>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={targetDate ? format(targetDate, 'yyyy-MM-dd') : ''}
                    onChange={(e) =>
                      setTargetDate(
                        e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined
                      )
                    }
                    className="w-full"
                  />
                </div>
              </div>
            </div>
            <Button
              onClick={handleGeneratePlan}
              disabled={!releaseName.trim() || isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Release Plan
            </Button>

            {/* Release Plan Results */}
            {releasePlan && (
              <div className="space-y-4 pt-4">
                <Separator />
                <div className="flex items-center justify-between">
                  <h3 className="font-medium flex items-center gap-2">
                    <Target className="h-4 w-4 text-purple-500" />
                    {releasePlan.name ?? releasePlan.releaseName}
                  </h3>
                  <Badge className={getRiskBadgeColor(releasePlan.overallRisk ?? releasePlan.riskAssessment)}>
                    {releasePlan.overallRisk ?? releasePlan.riskAssessment} risk
                  </Badge>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{releasePlan.totalPoints}</p>
                    <p className="text-xs text-muted-foreground">Total Points</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{releasePlan.phases.length}</p>
                    <p className="text-xs text-muted-foreground">Phases</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold">{releasePlan.totalItems}</p>
                    <p className="text-xs text-muted-foreground">Items</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <Progress
                      value={(releasePlan.confidence ?? releasePlan.successProbability) * 100}
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round((releasePlan.confidence ?? releasePlan.successProbability) * 100)}% confidence
                    </p>
                  </div>
                </div>

                {/* Phases */}
                <div>
                  <Label className="text-sm">Release Phases</Label>
                  <Accordion type="single" collapsible className="mt-2">
                    {releasePlan.phases.map((phase, idx) => (
                      <AccordionItem key={phase.id || idx} value={phase.id || String(idx)}>
                        <AccordionTrigger className="py-2">
                          <div className="flex items-center gap-3">
                            <Badge variant="outline">{idx + 1}</Badge>
                            <span>{phase.name}</span>
                            {phase.priority && (
                              <Badge className={PRIORITY_COLORS[phase.priority] || 'bg-gray-500'}>
                                {phase.priority}
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pl-8">
                            <p className="text-sm text-muted-foreground">
                              {phase.description}
                            </p>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {phase.duration}
                              </span>
                              <span className="flex items-center gap-1">
                                <Target className="h-3 w-3" />
                                {phase.totalPoints} points
                              </span>
                            </div>
                            {phase.items && phase.items.length > 0 && (
                              <div className="mt-2">
                                <Label className="text-xs text-muted-foreground">
                                  Included Items
                                </Label>
                                <ul className="mt-1 space-y-1">
                                  {phase.items.map((item, iidx) => (
                                    <li
                                      key={iidx}
                                      className="text-sm flex items-center gap-2"
                                    >
                                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                                      {item.title}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>

                {/* Risks */}
                {releasePlan.risks && releasePlan.risks.length > 0 && (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                    <Label className="text-sm flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
                      <AlertTriangle className="h-4 w-4" />
                      Identified Risks
                    </Label>
                    <ul className="mt-2 space-y-1">
                      {releasePlan.risks.map((risk, idx) => (
                        <li key={idx} className="text-sm text-yellow-600 dark:text-yellow-400">
                          • {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {onPlanApply && (
                  <Button onClick={handleApplyPlan} className="w-full">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Apply Release Plan
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* Capacity Tab */}
          <TabsContent value="capacity" className="space-y-4">
            <div className="space-y-2">
              <Label>Target Release Date</Label>
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={targetDate ? format(targetDate, 'yyyy-MM-dd') : ''}
                  onChange={(e) =>
                    setTargetDate(
                      e.target.value ? new Date(e.target.value + 'T00:00:00') : undefined
                    )
                  }
                  className="w-full"
                  placeholder="Select date for capacity analysis"
                />
              </div>
            </div>
            <Button
              onClick={handleAnalyzeCapacity}
              disabled={!targetDate || isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <BarChart3 className="h-4 w-4 mr-2" />
              )}
              Analyze Capacity
            </Button>

            {/* Capacity Results */}
            {capacityAnalysis && (
              <div className="space-y-4 pt-4">
                <Separator />
                <div className="grid grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-blue-500">
                      {capacityAnalysis.totalCapacity ?? capacityAnalysis.totalCapacityPoints}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Capacity</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-green-500">
                      {capacityAnalysis.availableCapacity ?? capacityAnalysis.availablePoints}
                    </p>
                    <p className="text-sm text-muted-foreground">Available</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-orange-500">
                      {capacityAnalysis.allocatedCapacity ?? capacityAnalysis.allocatedPoints}
                    </p>
                    <p className="text-sm text-muted-foreground">Allocated</p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm">Utilization</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Progress
                      value={
                        capacityAnalysis.utilizationRate != null
                          ? capacityAnalysis.utilizationRate * 100
                          : capacityAnalysis.utilizationPercentage
                      }
                      className="flex-1"
                    />
                    <span className="text-sm font-medium">
                      {Math.round(
                        capacityAnalysis.utilizationRate != null
                          ? capacityAnalysis.utilizationRate * 100
                          : capacityAnalysis.utilizationPercentage
                      )}%
                    </span>
                  </div>
                </div>

                {/* Team Breakdown */}
                {capacityAnalysis.teamBreakdown && (() => {
                  const members = Array.isArray(capacityAnalysis.teamBreakdown)
                    ? capacityAnalysis.teamBreakdown
                    : Object.values(capacityAnalysis.teamBreakdown);
                  return members.length > 0 ? (
                  <div>
                    <Label className="text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Team Breakdown
                    </Label>
                    <div className="mt-2 space-y-2">
                      {members.map((member, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 border rounded"
                        >
                          <span className="text-sm">{member.name}</span>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={(member.utilization ?? member.availability) * 100}
                              className="w-20"
                            />
                            <span className="text-xs text-muted-foreground">
                              {Math.round((member.utilization ?? member.availability) * 100)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  ) : null;
                })()}

                {capacityAnalysis.recommendations && capacityAnalysis.recommendations.length > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <Label className="text-sm text-blue-700 dark:text-blue-300">
                      Recommendations
                    </Label>
                    <ul className="mt-2 space-y-1">
                      {capacityAnalysis.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-sm text-blue-600 dark:text-blue-400">
                          • {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Scope Tab */}
          <TabsContent value="scope" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="targetPoints">Target Story Points</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="targetPoints"
                  type="number"
                  min={1}
                  value={targetPoints}
                  onChange={(e) => setTargetPoints(Number(e.target.value))}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">points</span>
              </div>
            </div>
            <Button
              onClick={handleSuggestScope}
              disabled={isSuggesting}
              className="w-full"
            >
              {isSuggesting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Layers className="h-4 w-4 mr-2" />
              )}
              Suggest Optimal Scope
            </Button>

            {/* Scope Results */}
            {scopeSuggestion && (
              <div className="space-y-4 pt-4">
                <Separator />
                <div className="grid grid-cols-3 gap-4">
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-500">
                      {scopeSuggestion.includedItems.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Included</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-500">
                      {scopeSuggestion.optionalItems?.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Optional</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-gray-500">
                      {scopeSuggestion.excludedItems?.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Excluded</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Total Points</span>
                  <span className="font-bold">{scopeSuggestion.totalPoints}</span>
                </div>

                {/* Included Items */}
                <div>
                  <Label className="text-sm flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Included Items
                  </Label>
                  <ScrollArea className="h-[200px] mt-2">
                    <div className="space-y-2">
                      {scopeSuggestion.includedItems.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="flex items-center justify-between p-2 border rounded hover:bg-muted/50"
                        >
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span className="text-sm">{item.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{item.points ?? item.storyPoints} pts</Badge>
                            <Badge className={PRIORITY_COLORS[item.priority] || 'bg-gray-500'}>
                              {item.priority}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>

                {/* Reasoning */}
                {scopeSuggestion.reasoning && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <Label className="text-sm text-purple-700 dark:text-purple-300">
                      AI Reasoning
                    </Label>
                    <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                      {scopeSuggestion.reasoning}
                    </p>
                  </div>
                )}

                {onScopeSelect && (
                  <Button onClick={handleApplyScope} className="w-full">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Apply Suggested Scope
                  </Button>
                )}
              </div>
            )}
          </TabsContent>

          {/* Roadmap Tab */}
          <TabsContent value="roadmap" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="quarters">Roadmap Duration</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="quarters"
                  type="number"
                  min={1}
                  max={8}
                  value={quarters}
                  onChange={(e) => setQuarters(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">quarters</span>
              </div>
            </div>
            <Button
              onClick={handleGenerateRoadmap}
              disabled={isGeneratingRoadmap}
              className="w-full"
            >
              {isGeneratingRoadmap ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CalendarIconAlt className="h-4 w-4 mr-2" />
              )}
              Generate Roadmap
            </Button>

            {/* Roadmap Results */}
            {roadmap && (
              <div className="space-y-4 pt-4">
                <Separator />
                <h3 className="font-medium flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-blue-500" />
                  {roadmap.name ?? 'Roadmap'}
                </h3>

                <ScrollArea className="h-[400px]">
                  <div className="space-y-6">
                    {(roadmap.quarters ?? []).map((quarter, qidx) => (
                      <div key={qidx} className="relative pl-6 border-l-2 border-muted">
                        <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-primary" />
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{quarter.name}</h4>
                            <Badge variant="outline">{quarter.releases.length} releases</Badge>
                          </div>
                          {quarter.themes && quarter.themes.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {quarter.themes.map((theme, tidx) => (
                                <Badge key={tidx} variant="secondary" className="text-xs">
                                  {theme}
                                </Badge>
                              ))}
                            </div>
                          )}
                          <div className="space-y-2">
                            {quarter.releases.map((release, ridx) => (
                              <div
                                key={ridx}
                                className="p-3 border rounded-lg bg-muted/30"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">{release.name}</span>
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                      {release.targetDate}
                                    </span>
                                  </div>
                                </div>
                                {release.highlights && release.highlights.length > 0 && (
                                  <ul className="mt-2 space-y-1">
                                    {release.highlights.map((hl, hlidx) => (
                                      <li
                                        key={hlidx}
                                        className="text-sm text-muted-foreground flex items-center gap-1"
                                      >
                                        <Flag className="h-3 w-3 text-blue-500" />
                                        {hl}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {roadmap.milestones && roadmap.milestones.length > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <Label className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                      <Flag className="h-4 w-4" />
                      Key Milestones
                    </Label>
                    <ul className="mt-2 space-y-1">
                      {roadmap.milestones.map((milestone, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2"
                        >
                          <ArrowRight className="h-3 w-3" />
                          {milestone}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default ReleasePlanningAssistant;
