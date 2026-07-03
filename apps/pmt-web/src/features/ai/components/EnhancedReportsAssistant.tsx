import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  useGenerateCreatedResolvedReportMutation,
  useGenerateReportSummaryMutation,
  useCompareReportPeriodsMutation,
  useForecastBacklogMutation,
  useIdentifyBottlenecksMutation,
  useGenerateTeamPerformanceReportMutation,
  useExplainMetricsMutation,
  useSuggestReportVisualizationsMutation,
} from '../aiApi';
import type {
  CreatedResolvedReport,
  ReportDataPoint,
  TrendAnalysis,
  TrendDirection,
  ReportPeriod,
} from '../types';

const REPORT_PERIODS: Array<{ value: ReportPeriod; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const TREND_ICONS: Record<TrendDirection, string> = {
  up: 'Trending Up',
  down: 'Trending Down',
  stable: 'Stable',
};

const TREND_COLORS: Record<TrendDirection, string> = {
  up: 'text-green-600',
  down: 'text-red-600',
  stable: 'text-gray-600',
};

interface EnhancedReportsAssistantProps {
  projectId?: string;
}

export const EnhancedReportsAssistant: React.FC<EnhancedReportsAssistantProps> = ({
  projectId = 'default',
}) => {
  const [activeTab, setActiveTab] = useState('created-resolved');
  const [period, setPeriod] = useState<ReportPeriod>('weekly');
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState<CreatedResolvedReport | null>(null);

  const [generateReport, { isLoading: isGenerating }] =
    useGenerateCreatedResolvedReportMutation();
  const [generateSummary, { data: summaryData, isLoading: isSummarizing }] =
    useGenerateReportSummaryMutation();
  const [comparePeriods, { data: comparisonData, isLoading: isComparing }] =
    useCompareReportPeriodsMutation();
  const [forecastBacklog, { data: forecastData, isLoading: isForecasting }] =
    useForecastBacklogMutation();
  const [identifyBottlenecks, { data: bottlenecksData, isLoading: isIdentifying }] =
    useIdentifyBottlenecksMutation();
  const [generateTeamReport, { data: teamData, isLoading: isGeneratingTeam }] =
    useGenerateTeamPerformanceReportMutation();
  const [explainMetrics, { data: explanationData, isLoading: isExplaining }] =
    useExplainMetricsMutation();
  const [suggestVisualizations, { data: vizData, isLoading: isSuggestingViz }] =
    useSuggestReportVisualizationsMutation();

  // Mock issue data for demo
  const generateMockIssueData = () => {
    const data = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split('T')[0];
      // Simulate created and resolved events
      for (let i = 0; i < Math.floor(Math.random() * 5) + 1; i++) {
        data.push({ date: dateStr, event_type: 'created' });
      }
      for (let i = 0; i < Math.floor(Math.random() * 4) + 1; i++) {
        data.push({ date: dateStr, event_type: 'resolved' });
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return data;
  };

  const handleGenerateReport = async () => {
    const issueData = generateMockIssueData();
    const result = await generateReport({
      projectId,
      period,
      startDate,
      endDate,
      issueData,
      grouping: period === 'weekly' ? 'week' : 'day',
    });
    if ('data' in result && result.data) {
      setReport(result.data.report);
    }
  };

  const handleGenerateSummary = async () => {
    if (!report) return;
    await generateSummary({
      reportData: report,
      audience: 'team',
    });
  };

  const handleForecast = async () => {
    if (!report) return;
    await forecastBacklog({
      historicalData: report.dataPoints,
      forecastDays: 30,
    });
  };

  const handleIdentifyBottlenecks = async () => {
    // Mock workflow data
    const workflowData = [
      { stage: 'To Do', avgDays: 2 },
      { stage: 'In Progress', avgDays: 5 },
      { stage: 'In Review', avgDays: 3 },
    ];
    const resolutionTimes = [
      { issueId: '1', days: 7 },
      { issueId: '2', days: 12 },
      { issueId: '3', days: 5 },
    ];
    await identifyBottlenecks({ workflowData, resolutionTimes });
  };

  const handleGenerateTeamReport = async () => {
    // Mock team data
    const teamData = [
      { userId: '1', name: 'Alice', resolved: 15, avgDays: 3 },
      { userId: '2', name: 'Bob', resolved: 12, avgDays: 4 },
      { userId: '3', name: 'Charlie', resolved: 18, avgDays: 2.5 },
    ];
    await generateTeamReport({ teamData, period: period });
  };

  const handleExplainMetrics = async () => {
    if (!report) return;
    await explainMetrics({
      metrics: {
        totalCreated: report.totalCreated,
        totalResolved: report.totalResolved,
        resolutionRate: report.resolutionRate,
        netChange: report.netChange,
      },
    });
  };

  const handleSuggestVisualizations = async () => {
    if (!report) return;
    await suggestVisualizations({
      dataStructure: {
        dataPoints: report.dataPoints.length,
        metrics: ['created', 'resolved', 'net', 'cumulative_backlog'],
        period: report.period,
      },
      reportPurpose: 'Track issue creation vs resolution trends',
    });
  };

  const renderTrend = (trend: TrendAnalysis, label: string) => (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className={`font-medium ${TREND_COLORS[trend.direction]}`}>
        {TREND_ICONS[trend.direction]} ({trend.percentageChange > 0 ? '+' : ''}
        {trend.percentageChange.toFixed(1)}%)
      </span>
    </div>
  );

  const renderDataPoint = (dp: ReportDataPoint) => (
    <div
      key={dp.date}
      className="grid grid-cols-5 gap-4 py-2 border-b text-sm"
    >
      <span>{dp.date}</span>
      <span className="text-green-600">+{dp.created}</span>
      <span className="text-blue-600">-{dp.resolved}</span>
      <span className={dp.net >= 0 ? 'text-red-600' : 'text-green-600'}>
        {dp.net >= 0 ? '+' : ''}{dp.net}
      </span>
      <span>{dp.cumulativeBacklog}</span>
    </div>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          AI-Enhanced Reports
        </CardTitle>
        <CardDescription>
          Generate insightful reports with AI-powered analysis and recommendations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <Label htmlFor="period">Report Period</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)}>
              <SelectTrigger>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="created-resolved">Created vs Resolved</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
            <TabsTrigger value="bottlenecks">Bottlenecks</TabsTrigger>
            <TabsTrigger value="team">Team Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="created-resolved" className="mt-4 space-y-4">
            <Button onClick={handleGenerateReport} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate Report'}
            </Button>

            {report && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">{report.totalCreated}</p>
                    <p className="text-sm text-muted-foreground">Created</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">{report.totalResolved}</p>
                    <p className="text-sm text-muted-foreground">Resolved</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <p
                      className={`text-3xl font-bold ${
                        report.netChange >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {report.netChange >= 0 ? '+' : ''}{report.netChange}
                    </p>
                    <p className="text-sm text-muted-foreground">Net Change</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold">
                      {(report.resolutionRate * 100).toFixed(0)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Resolution Rate</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  {renderTrend(report.createdTrend, 'Creation Trend')}
                  {renderTrend(report.resolvedTrend, 'Resolution Trend')}
                </div>

                <div>
                  <h4 className="font-medium mb-2">Data Points</h4>
                  <div className="border rounded-lg p-2">
                    <div className="grid grid-cols-5 gap-4 py-2 border-b text-sm font-medium">
                      <span>Date</span>
                      <span>Created</span>
                      <span>Resolved</span>
                      <span>Net</span>
                      <span>Backlog</span>
                    </div>
                    <ScrollArea className="h-[200px]">
                      {report.dataPoints.map(renderDataPoint)}
                    </ScrollArea>
                  </div>
                </div>

                {report.insights.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">AI Insights</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {report.insights.map((insight, i) => (
                        <li key={i} className="text-sm">{insight}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.recommendations.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      <h4 className="font-medium mb-2">Recommendations</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {report.recommendations.map((rec, i) => (
                          <li key={i} className="text-sm">{rec}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleGenerateSummary}
                    disabled={isSummarizing}
                  >
                    {isSummarizing ? 'Generating...' : 'Generate Summary'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExplainMetrics}
                    disabled={isExplaining}
                  >
                    {isExplaining ? 'Explaining...' : 'Explain Metrics'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSuggestVisualizations}
                    disabled={isSuggestingViz}
                  >
                    {isSuggestingViz ? 'Suggesting...' : 'Suggest Charts'}
                  </Button>
                </div>

                {summaryData && summaryData.summary && (
                  <div className="border rounded-lg p-4 bg-muted">
                    <h4 className="font-medium mb-2">Executive Summary</h4>
                    {summaryData.summary.highlights.length > 0 && (
                      <div className="mb-2">
                        <span className="text-sm font-medium text-green-600">Highlights:</span>
                        <ul className="list-disc list-inside text-sm">
                          {summaryData.summary.highlights.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {summaryData.summary.concerns.length > 0 && (
                      <div className="mb-2">
                        <span className="text-sm font-medium text-orange-600">Concerns:</span>
                        <ul className="list-disc list-inside text-sm">
                          {summaryData.summary.concerns.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {summaryData.summary.actionItems.length > 0 && (
                      <div>
                        <span className="text-sm font-medium text-blue-600">Action Items:</span>
                        <ul className="list-disc list-inside text-sm">
                          {summaryData.summary.actionItems.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {explanationData && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Metrics Explained</h4>
                    <div className="space-y-3">
                      {explanationData.explanations.map((exp, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Badge variant={exp.isGood ? 'default' : 'destructive'}>
                            {exp.metric}
                          </Badge>
                          <div>
                            <p className="text-sm">{exp.whatItMeans}</p>
                            <p className="text-xs text-muted-foreground">{exp.context}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="mt-4 font-medium">{explanationData.keyTakeaway}</p>
                  </div>
                )}

                {vizData && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Recommended Visualizations</h4>
                    <div className="space-y-3">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
                        <span className="font-medium">Primary Chart:</span>
                        <p className="text-sm">{vizData.primaryVisualization.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Type: {vizData.primaryVisualization.type} - {vizData.primaryVisualization.reason}
                        </p>
                      </div>
                      {vizData.secondaryVisualizations.map((viz, i) => (
                        <div key={i} className="bg-muted p-3 rounded">
                          <span className="font-medium">{viz.title}</span>
                          <p className="text-xs text-muted-foreground">
                            Type: {viz.type} - {viz.purpose}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="forecast" className="mt-4 space-y-4">
            <Button
              onClick={handleForecast}
              disabled={isForecasting || !report}
            >
              {isForecasting ? 'Forecasting...' : 'Forecast Backlog'}
            </Button>

            {!report && (
              <Alert>
                <AlertDescription>
                  Generate a Created vs Resolved report first to enable forecasting.
                </AlertDescription>
              </Alert>
            )}

            {forecastData && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold">
                      {Math.round((forecastData.confidence || 0) * 100)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Confidence</p>
                  </div>
                  <Separator orientation="vertical" className="h-12" />
                  <p className="text-sm">{forecastData.methodology}</p>
                </div>

                <div className="border rounded-lg p-2">
                  <div className="grid grid-cols-4 gap-4 py-2 border-b text-sm font-medium">
                    <span>Date</span>
                    <span>Predicted</span>
                    <span>Lower Bound</span>
                    <span>Upper Bound</span>
                  </div>
                  <ScrollArea className="h-[200px]">
                    {forecastData.forecast.map((f, i) => (
                      <div key={i} className="grid grid-cols-4 gap-4 py-2 border-b text-sm">
                        <span>{f.date}</span>
                        <span className="font-medium">{f.predictedBacklog}</span>
                        <span className="text-muted-foreground">{f.lowerBound}</span>
                        <span className="text-muted-foreground">{f.upperBound}</span>
                      </div>
                    ))}
                  </ScrollArea>
                </div>

                {forecastData.assumptions.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Assumptions</h4>
                    <ul className="list-disc list-inside text-sm">
                      {forecastData.assumptions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {forecastData.risksToForecast.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      <h4 className="font-medium mb-1">Risks to Forecast</h4>
                      <ul className="list-disc list-inside text-sm">
                        {forecastData.risksToForecast.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="bottlenecks" className="mt-4 space-y-4">
            <Button onClick={handleIdentifyBottlenecks} disabled={isIdentifying}>
              {isIdentifying ? 'Analyzing...' : 'Identify Bottlenecks'}
            </Button>

            {bottlenecksData && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-center">
                    <p className="text-3xl font-bold">
                      {Math.round((bottlenecksData.flowEfficiency || 0) * 100)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Flow Efficiency</p>
                  </div>
                  <Separator orientation="vertical" className="h-12" />
                  <p className="text-sm text-green-600">{bottlenecksData.improvementPotential}</p>
                </div>

                {bottlenecksData.bottlenecks.length > 0 ? (
                  <div className="space-y-3">
                    {bottlenecksData.bottlenecks.map((bn, i) => (
                      <div key={i} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{bn.stage}</span>
                          <Badge
                            variant={
                              bn.impact === 'high'
                                ? 'destructive'
                                : bn.impact === 'medium'
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {bn.impact} impact
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Average time stuck: {bn.avgTimeStuck}
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          Root cause: {bn.rootCause}
                        </p>
                        <p className="text-sm text-green-600">
                          Recommendation: {bn.recommendation}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      No significant bottlenecks detected in your workflow.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="team" className="mt-4 space-y-4">
            <Button onClick={handleGenerateTeamReport} disabled={isGeneratingTeam}>
              {isGeneratingTeam ? 'Generating...' : 'Generate Team Report'}
            </Button>

            {teamData && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold">{teamData.teamSummary.totalResolved}</p>
                    <p className="text-sm text-muted-foreground">Total Resolved</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold">{teamData.teamSummary.avgResolutionTime}</p>
                    <p className="text-sm text-muted-foreground">Avg Resolution Time</p>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold">
                      {Math.round(teamData.teamSummary.collaborationScore * 100)}%
                    </p>
                    <p className="text-sm text-muted-foreground">Collaboration Score</p>
                  </div>
                </div>

                {teamData.memberHighlights.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Team Highlights</h4>
                    <div className="space-y-2">
                      {teamData.memberHighlights.map((member, i) => (
                        <div key={i} className="border rounded-lg p-3">
                          <span className="font-medium">{member.member}</span>
                          <p className="text-sm text-green-600">{member.achievement}</p>
                          <p className="text-sm text-muted-foreground">
                            Growth area: {member.areaForGrowth}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {teamData.teamStrengths.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 text-green-600">Team Strengths</h4>
                      <ul className="list-disc list-inside text-sm">
                        {teamData.teamStrengths.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {teamData.improvementAreas.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 text-orange-600">Areas to Improve</h4>
                      <ul className="list-disc list-inside text-sm">
                        {teamData.improvementAreas.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {teamData.recommendations.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      <h4 className="font-medium mb-1">Recommendations</h4>
                      <ul className="list-disc list-inside text-sm">
                        {teamData.recommendations.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default EnhancedReportsAssistant;
