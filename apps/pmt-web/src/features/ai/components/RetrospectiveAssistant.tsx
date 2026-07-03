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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  RefreshCw,
  Sparkles,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  Clock,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  FileText,
  Play,
  Plus,
  Trash2,
  Smile,
  Meh,
  Frown,
} from 'lucide-react';
import {
  useAnalyzeRetroItemsMutation,
  useGenerateRetroActionsMutation,
  useAnalyzeSprintPerformanceMutation,
  useGenerateRetroSummaryMutation,
  useSuggestRetroTopicsMutation,
  useCompareRetrospectivesMutation,
  useGenerateFacilitationScriptMutation,
  useGetRetroFormatsQuery,
  useGetInsightCategoriesQuery,
} from '../aiApi';
import type {
  RetroInsight,
  RetroActionItem,
  SprintAnalysis,
  RetroSummaryResponse,
  SuggestTopicsResponse,
  FacilitationScriptResponse,
} from '../types';

interface RetroItem {
  id: string;
  category: 'what_went_well' | 'what_to_improve' | 'action_item';
  content: string;
  votes: number;
  author?: string;
}

interface RetrospectiveAssistantProps {
  sprintName?: string;
  sprintData?: Record<string, unknown>;
  teamMembers?: Array<{ id: string; name: string }>;
  onInsightsGenerated?: (insights: RetroInsight[]) => void;
  onActionsGenerated?: (actions: RetroActionItem[]) => void;
}

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  what_went_well: {
    icon: <ThumbsUp className="h-4 w-4" />,
    color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-300',
    label: 'What Went Well',
  },
  what_to_improve: {
    icon: <ThumbsDown className="h-4 w-4" />,
    color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 border-red-300',
    label: 'What to Improve',
  },
  action_item: {
    icon: <Target className="h-4 w-4" />,
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-300',
    label: 'Action Items',
  },
};

const SENTIMENT_ICONS: Record<string, React.ReactNode> = {
  positive: <Smile className="h-5 w-5 text-green-500" />,
  neutral: <Meh className="h-5 w-5 text-yellow-500" />,
  negative: <Frown className="h-5 w-5 text-red-500" />,
};

const IMPORTANCE_COLORS: Record<string, string> = {
  critical: 'bg-red-500 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-green-500 text-white',
};

export function RetrospectiveAssistant({
  sprintName = '',
  sprintData = {},
  teamMembers = [],
  onInsightsGenerated,
  onActionsGenerated,
}: RetrospectiveAssistantProps) {
  const [activeTab, setActiveTab] = useState('items');
  const [items, setItems] = useState<RetroItem[]>([]);
  const [newItemContent, setNewItemContent] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<RetroItem['category']>('what_went_well');
  const [currentSprintName, setCurrentSprintName] = useState(sprintName);
  const [insights, setInsights] = useState<RetroInsight[]>([]);
  const [actions, setActions] = useState<RetroActionItem[]>([]);
  const [sprintAnalysis, setSprintAnalysis] = useState<SprintAnalysis | null>(null);
  const [summary, setSummary] = useState<RetroSummaryResponse | null>(null);
  const [topics, setTopics] = useState<SuggestTopicsResponse | null>(null);
  const [script, setScript] = useState<FacilitationScriptResponse | null>(null);
  const [retroFormat, setRetroFormat] = useState('standard');
  const [timeAvailable, setTimeAvailable] = useState(60);
  const [teamSize, setTeamSize] = useState(teamMembers.length || 5);

  const { data: formats } = useGetRetroFormatsQuery();
  const { data: categories } = useGetInsightCategoriesQuery();
  const [analyzeItems, { isLoading: isAnalyzing }] = useAnalyzeRetroItemsMutation();
  const [generateActions, { isLoading: isGeneratingActions }] = useGenerateRetroActionsMutation();
  const [analyzePerformance, { isLoading: isAnalyzingPerformance }] = useAnalyzeSprintPerformanceMutation();
  const [generateSummary, { isLoading: isGeneratingSummary }] = useGenerateRetroSummaryMutation();
  const [suggestTopics, { isLoading: isSuggestingTopics }] = useSuggestRetroTopicsMutation();
  const [generateScript, { isLoading: isGeneratingScript }] = useGenerateFacilitationScriptMutation();

  const addItem = useCallback(() => {
    if (!newItemContent.trim()) return;

    const newItem: RetroItem = {
      id: `item-${Date.now()}`,
      category: newItemCategory,
      content: newItemContent,
      votes: 0,
    };

    setItems((prev) => [...prev, newItem]);
    setNewItemContent('');
  }, [newItemContent, newItemCategory]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const voteItem = useCallback((id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, votes: Math.max(0, item.votes + delta) } : item
      )
    );
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (items.length === 0) return;

    try {
      const result = await analyzeItems({
        items: items.map((i) => ({
          id: i.id,
          category: i.category,
          content: i.content,
          votes: i.votes,
          author: i.author,
        })),
        sprintContext: sprintData,
      }).unwrap();

      setInsights(result.insights);
      if (onInsightsGenerated) {
        onInsightsGenerated(result.insights);
      }
      setActiveTab('insights');
    } catch (error) {
      console.error('Failed to analyze items:', error);
    }
  }, [items, sprintData, analyzeItems, onInsightsGenerated]);

  const handleGenerateActions = useCallback(async () => {
    if (insights.length === 0) return;

    try {
      const result = await generateActions({
        insights: insights.map((i) => ({
          title: i.title,
          description: i.description,
          category: i.category,
          importance: i.importance,
        })),
        teamMembers,
      }).unwrap();

      setActions(result.actionItems);
      if (onActionsGenerated) {
        onActionsGenerated(result.actionItems);
      }
    } catch (error) {
      console.error('Failed to generate actions:', error);
    }
  }, [insights, teamMembers, generateActions, onActionsGenerated]);

  const handleAnalyzePerformance = useCallback(async () => {
    try {
      const result = await analyzePerformance({
        sprintData,
      }).unwrap();

      setSprintAnalysis(result);
    } catch (error) {
      console.error('Failed to analyze performance:', error);
    }
  }, [sprintData, analyzePerformance]);

  const handleGenerateSummary = useCallback(async () => {
    if (!currentSprintName.trim() || items.length === 0) return;

    try {
      const result = await generateSummary({
        sprintName: currentSprintName,
        items: items.map((i) => ({
          id: i.id,
          category: i.category,
          content: i.content,
          votes: i.votes,
        })),
        sprintData,
        teamMembers,
      }).unwrap();

      setSummary(result);
      setActiveTab('summary');
    } catch (error) {
      console.error('Failed to generate summary:', error);
    }
  }, [currentSprintName, items, sprintData, teamMembers, generateSummary]);

  const handleSuggestTopics = useCallback(async () => {
    if (items.length === 0) return;

    try {
      const result = await suggestTopics({
        items: items.map((i) => ({
          id: i.id,
          category: i.category,
          content: i.content,
          votes: i.votes,
        })),
        timeAvailableMinutes: timeAvailable,
      }).unwrap();

      setTopics(result);
    } catch (error) {
      console.error('Failed to suggest topics:', error);
    }
  }, [items, timeAvailable, suggestTopics]);

  const handleGenerateScript = useCallback(async () => {
    if (!currentSprintName.trim()) return;

    try {
      const result = await generateScript({
        sprintName: currentSprintName,
        teamSize,
        timeMinutes: timeAvailable,
        formatType: retroFormat,
      }).unwrap();

      setScript(result);
    } catch (error) {
      console.error('Failed to generate script:', error);
    }
  }, [currentSprintName, teamSize, timeAvailable, retroFormat, generateScript]);

  const itemsByCategory = items.reduce(
    (acc, item) => {
      acc[item.category] = acc[item.category] || [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, RetroItem[]>
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple-500" />
          Retrospective Assistant
        </CardTitle>
        <CardDescription>
          AI-powered retrospective facilitation and insights
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="items">Items ({items.length})</TabsTrigger>
            <TabsTrigger value="insights" disabled={insights.length === 0}>
              Insights
            </TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="facilitate">Facilitate</TabsTrigger>
          </TabsList>

          {/* Items Tab */}
          <TabsContent value="items" className="space-y-4">
            {/* Sprint Name */}
            <div className="space-y-2">
              <Label htmlFor="sprintName">Sprint Name</Label>
              <Input
                id="sprintName"
                placeholder="e.g., Sprint 12"
                value={currentSprintName}
                onChange={(e) => setCurrentSprintName(e.target.value)}
              />
            </div>

            {/* Add Item */}
            <div className="flex gap-2">
              <Select
                value={newItemCategory}
                onValueChange={(v) => setNewItemCategory(v as RetroItem['category'])}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {config.icon}
                        {config.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Enter feedback..."
                value={newItemContent}
                onChange={(e) => setNewItemContent(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addItem()}
                className="flex-1"
              />
              <Button onClick={addItem} disabled={!newItemContent.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Items by Category */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
                  const categoryItems = itemsByCategory[category] || [];
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2">
                        {config.icon}
                        <span className="font-medium">{config.label}</span>
                        <Badge variant="outline">{categoryItems.length}</Badge>
                      </div>
                      {categoryItems.length > 0 ? (
                        <div className="space-y-2 pl-6">
                          {categoryItems
                            .sort((a, b) => b.votes - a.votes)
                            .map((item) => (
                              <div
                                key={item.id}
                                className={`flex items-center gap-2 p-2 border rounded-lg ${config.color}`}
                              >
                                <div className="flex flex-col items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => voteItem(item.id, 1)}
                                  >
                                    <TrendingUp className="h-3 w-3" />
                                  </Button>
                                  <span className="text-sm font-bold">{item.votes}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => voteItem(item.id, -1)}
                                  >
                                    <TrendingDown className="h-3 w-3" />
                                  </Button>
                                </div>
                                <span className="flex-1 text-sm">{item.content}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeItem(item.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground pl-6">No items yet</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Analyze Button */}
            <Button
              onClick={handleAnalyze}
              disabled={items.length === 0 || isAnalyzing}
              className="w-full"
            >
              {isAnalyzing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Analyze & Generate Insights
            </Button>
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-4">
            {insights.length > 0 && (
              <>
                <Accordion type="single" collapsible className="space-y-2">
                  {insights.map((insight, idx) => (
                    <AccordionItem
                      key={idx}
                      value={String(idx)}
                      className="border rounded-lg px-4"
                    >
                      <AccordionTrigger className="py-3 hover:no-underline">
                        <div className="flex items-center gap-3 w-full pr-4">
                          <Lightbulb className="h-4 w-4 text-yellow-500" />
                          <span className="flex-1 text-left font-medium">{insight.title}</span>
                          <Badge
                            className={IMPORTANCE_COLORS[insight.importance] || 'bg-gray-500'}
                          >
                            {insight.importance}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-4">
                        <div className="space-y-3 pl-8">
                          <p className="text-sm text-muted-foreground">{insight.description}</p>
                          <Badge variant="outline">{insight.category}</Badge>
                          {insight.evidence && insight.evidence.length > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground">Evidence</Label>
                              <ul className="mt-1 space-y-1">
                                {insight.evidence.map((e, eidx) => (
                                  <li key={eidx} className="text-sm text-muted-foreground">
                                    • {e}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {insight.suggestedActions && insight.suggestedActions.length > 0 && (
                            <div>
                              <Label className="text-xs text-muted-foreground">
                                Suggested Actions
                              </Label>
                              <ul className="mt-1 space-y-1">
                                {insight.suggestedActions.map((a, aidx) => (
                                  <li
                                    key={aidx}
                                    className="text-sm text-blue-600 dark:text-blue-400"
                                  >
                                    • {a}
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

                <Button
                  onClick={handleGenerateActions}
                  disabled={isGeneratingActions}
                  className="w-full"
                >
                  {isGeneratingActions ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Target className="h-4 w-4 mr-2" />
                  )}
                  Generate Action Items
                </Button>

                {/* Generated Actions */}
                {actions.length > 0 && (
                  <div className="space-y-3 pt-4">
                    <Separator />
                    <h3 className="font-medium flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Action Items ({actions.length})
                    </h3>
                    <div className="space-y-2">
                      {actions.map((action, idx) => (
                        <div key={idx} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{action.title}</span>
                            <Badge
                              className={IMPORTANCE_COLORS[action.priority] || 'bg-gray-500'}
                            >
                              {action.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {action.description}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            {action.owner && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {action.owner}
                              </span>
                            )}
                            {action.estimatedEffort && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {action.estimatedEffort}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={handleGenerateSummary}
                disabled={items.length === 0 || isGeneratingSummary}
                className="flex-1"
              >
                {isGeneratingSummary ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Generate Full Summary
              </Button>
              <Button
                variant="outline"
                onClick={handleAnalyzePerformance}
                disabled={isAnalyzingPerformance}
              >
                {isAnalyzingPerformance ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <BarChart3 className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Sprint Analysis */}
            {sprintAnalysis && (
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  Sprint Performance
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="border rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {sprintAnalysis.velocityTrend === 'increasing' ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : sprintAnalysis.velocityTrend === 'decreasing' ? (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      ) : null}
                      <span className="font-medium capitalize">{sprintAnalysis.velocityTrend}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Velocity Trend</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <Progress value={sprintAnalysis.completionRate * 100} className="mb-1" />
                    <p className="text-sm font-medium">
                      {Math.round(sprintAnalysis.completionRate * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground">Completion Rate</p>
                  </div>
                  <div className="border rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center">
                      {SENTIMENT_ICONS[sprintAnalysis.teamSentiment] || SENTIMENT_ICONS.neutral}
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">
                      {sprintAnalysis.teamSentiment} Sentiment
                    </p>
                  </div>
                </div>

                {sprintAnalysis.keyAchievements && sprintAnalysis.keyAchievements.length > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <Label className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Key Achievements
                    </Label>
                    <ul className="mt-2 space-y-1">
                      {sprintAnalysis.keyAchievements.map((a, idx) => (
                        <li key={idx} className="text-sm text-green-600 dark:text-green-400">
                          • {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {sprintAnalysis.challenges && sprintAnalysis.challenges.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                    <Label className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Challenges
                    </Label>
                    <ul className="mt-2 space-y-1">
                      {sprintAnalysis.challenges.map((c, idx) => (
                        <li key={idx} className="text-sm text-red-600 dark:text-red-400">
                          • {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Full Summary */}
            {summary && (
              <div className="space-y-4 pt-4">
                <Separator />
                <h3 className="font-medium">{summary.sprintName} Summary</h3>

                {summary.themes && summary.themes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {summary.themes.map((theme, idx) => (
                      <Badge key={idx} variant="secondary">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                )}

                {summary.sentimentBreakdown && (
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(summary.sentimentBreakdown).map(([sentiment, count]) => (
                      <div key={sentiment} className="text-center p-2 border rounded">
                        {SENTIMENT_ICONS[sentiment]}
                        <p className="text-lg font-bold">{count}</p>
                        <p className="text-xs text-muted-foreground capitalize">{sentiment}</p>
                      </div>
                    ))}
                  </div>
                )}

                {summary.recommendations && summary.recommendations.length > 0 && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <Label className="text-sm text-purple-700 dark:text-purple-300">
                      Recommendations
                    </Label>
                    <ul className="mt-2 space-y-1">
                      {summary.recommendations.map((r, idx) => (
                        <li key={idx} className="text-sm text-purple-600 dark:text-purple-400">
                          • {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Facilitate Tab */}
          <TabsContent value="facilitate" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={retroFormat} onValueChange={setRetroFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formats?.formats?.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    )) || (
                      <>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="starfish">Starfish</SelectItem>
                        <SelectItem value="4Ls">4Ls</SelectItem>
                        <SelectItem value="sailboat">Sailboat</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Team Size</Label>
                <Input
                  type="number"
                  min={2}
                  max={20}
                  value={teamSize}
                  onChange={(e) => setTeamSize(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Time (min)</Label>
                <Input
                  type="number"
                  min={15}
                  max={120}
                  value={timeAvailable}
                  onChange={(e) => setTimeAvailable(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSuggestTopics}
                disabled={items.length === 0 || isSuggestingTopics}
                className="flex-1"
              >
                {isSuggestingTopics ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Lightbulb className="h-4 w-4 mr-2" />
                )}
                Suggest Topics
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerateScript}
                disabled={!currentSprintName.trim() || isGeneratingScript}
              >
                {isGeneratingScript ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Script
              </Button>
            </div>

            {/* Topics */}
            {topics && (
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  Suggested Discussion Topics
                </h3>
                <div className="space-y-2">
                  {topics.topics.map((topic, idx) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{topic.title}</span>
                        <Badge variant="outline">
                          <Clock className="h-3 w-3 mr-1" />
                          {topic.timeMinutes} min
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{topic.description}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Total Time</span>
                  <span className="font-bold">{topics.totalTime} minutes</span>
                </div>
              </div>
            )}

            {/* Facilitation Script */}
            {script && (
              <div className="space-y-3 pt-4">
                <Separator />
                <h3 className="font-medium flex items-center gap-2">
                  <Play className="h-4 w-4 text-green-500" />
                  Facilitation Script - {script.format}
                </h3>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-4">
                    {script.sections &&
                      Object.entries(script.sections).map(([sectionName, section]) => (
                        <div key={sectionName} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium capitalize">
                              {sectionName.replace(/_/g, ' ')}
                            </h4>
                            {(section as { durationMinutes?: number }).durationMinutes && (
                              <Badge variant="outline">
                                {(section as { durationMinutes: number }).durationMinutes} min
                              </Badge>
                            )}
                          </div>
                          {(section as { script?: string }).script && (
                            <p className="text-sm text-muted-foreground">
                              {(section as { script: string }).script}
                            </p>
                          )}
                          {(section as { activities?: string[] }).activities && (
                            <ul className="mt-2 space-y-1">
                              {(section as { activities: string[] }).activities.map((a, aidx) => (
                                <li key={aidx} className="text-sm flex items-center gap-2">
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                  {a}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

export default RetrospectiveAssistant;
