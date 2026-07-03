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
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Lightbulb,
  Clock,
  ExternalLink,
  Copy,
  AlertTriangle,
  Search,
  FileText,
  User,
  ArrowRight,
} from 'lucide-react';
import {
  useFindSimilarResolvedIssuesMutation,
  useGenerateResolutionSuggestionMutation,
  useCheckForDuplicateMutation,
  useGetFullResolutionAnalysisMutation,
  useGetResolutionCategoriesQuery,
} from '../aiApi';
import type {
  SimilarResolvedIssue,
  ResolutionSuggestion,
  FullResolutionAnalysisResponse,
} from '../types';

interface ResolutionAssistantProps {
  issueId?: string;
  initialTitle?: string;
  initialDescription?: string;
  projectId?: string;
  onResolutionApply?: (suggestion: ResolutionSuggestion) => void;
  onDuplicateFound?: (duplicateId: string) => void;
  onAssigneeSelect?: (userId: string, displayName: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  bug: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  configuration: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  documentation: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  feature: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  performance: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  security: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
};

export function ResolutionAssistant({
  issueId,
  initialTitle = '',
  initialDescription = '',
  projectId,
  onResolutionApply,
  onDuplicateFound,
  onAssigneeSelect,
}: ResolutionAssistantProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [similarIssues, setSimilarIssues] = useState<SimilarResolvedIssue[]>([]);
  const [fullAnalysis, setFullAnalysis] = useState<FullResolutionAnalysisResponse | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<{
    isDuplicate: boolean;
    duplicateOf?: string | null;
    confidence: number;
  } | null>(null);
  const [copiedStep, setCopiedStep] = useState<string | null>(null);

  const { data: categoriesData } = useGetResolutionCategoriesQuery();
  const [findSimilar, { isLoading: isFindingSimlar }] = useFindSimilarResolvedIssuesMutation();
  const [generateSuggestion, { isLoading: isGenerating }] = useGenerateResolutionSuggestionMutation();
  const [checkDuplicate, { isLoading: isCheckingDuplicate }] = useCheckForDuplicateMutation();
  const [getFullAnalysis, { isLoading: isAnalyzing }] = useGetFullResolutionAnalysisMutation();

  const isLoading = isFindingSimlar || isGenerating || isCheckingDuplicate || isAnalyzing;

  const handleFindSimilar = useCallback(async () => {
    if (!title.trim()) return;

    try {
      const result = await findSimilar({
        title,
        description,
        projectId,
        limit: 5,
        minSimilarity: 0.5,
      }).unwrap();

      setSimilarIssues(result.similarIssues);
    } catch (error) {
      console.error('Failed to find similar issues:', error);
    }
  }, [title, description, projectId, findSimilar]);

  const handleCheckDuplicate = useCallback(async () => {
    if (!title.trim()) return;

    try {
      const result = await checkDuplicate({
        title,
        description,
        projectId,
      }).unwrap();

      setDuplicateResult({
        isDuplicate: result.isDuplicate,
        duplicateOf: result.duplicateOf,
        confidence: result.similarityScore,
      });

      if (result.isDuplicate && result.duplicateOf && onDuplicateFound) {
        onDuplicateFound(result.duplicateOf);
      }
    } catch (error) {
      console.error('Failed to check for duplicate:', error);
    }
  }, [title, description, projectId, checkDuplicate, onDuplicateFound]);

  const handleFullAnalysis = useCallback(async () => {
    if (!title.trim()) return;

    try {
      const result = await getFullAnalysis({
        issueId: issueId || 'new',
        title,
        description,
        projectId,
      }).unwrap();

      setFullAnalysis(result);
      setSimilarIssues(result.similarIssues);
      if (result.isPotentialDuplicate) {
        setDuplicateResult({
          isDuplicate: result.isPotentialDuplicate,
          duplicateOf: result.duplicateOf,
          confidence: 1,
        });
      }
    } catch (error) {
      console.error('Failed to get full analysis:', error);
    }
  }, [title, description, projectId, issueId, getFullAnalysis]);

  const handleCopyStep = useCallback((stepId: string, action: string) => {
    navigator.clipboard.writeText(action);
    setCopiedStep(stepId);
    setTimeout(() => setCopiedStep(null), 2000);
  }, []);

  const handleApplySuggestion = useCallback(() => {
    if (fullAnalysis?.suggestedResolution && onResolutionApply) {
      onResolutionApply(fullAnalysis.suggestedResolution);
    }
  }, [fullAnalysis, onResolutionApply]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getSimilarityBadgeVariant = (similarity: number): 'default' | 'secondary' | 'outline' => {
    if (similarity >= 0.8) return 'default';
    if (similarity >= 0.6) return 'secondary';
    return 'outline';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Resolution Assistant
        </CardTitle>
        <CardDescription>
          Find similar resolved issues and get AI-powered resolution suggestions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Issue Title</Label>
            <Input
              id="title"
              placeholder="Enter issue title to find similar resolved issues..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe the issue for better matching..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleFullAnalysis}
              disabled={!title.trim() || isLoading}
              className="flex-1"
            >
              {isAnalyzing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Full Analysis
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleFindSimilar}
                    disabled={!title.trim() || isLoading}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Find Similar Only</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={handleCheckDuplicate}
                    disabled={!title.trim() || isLoading}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Check for Duplicate</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Duplicate Warning */}
        {duplicateResult?.isDuplicate && duplicateResult.duplicateOf && (
          <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-orange-700 dark:text-orange-300">
                Potential Duplicate Detected
              </h4>
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">
                This issue may be a duplicate of:{' '}
                <span className="font-medium">{duplicateResult.duplicateOf}</span>
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Progress value={duplicateResult.confidence * 100} className="w-24 h-2" />
                <span className={`text-sm font-medium ${getConfidenceColor(duplicateResult.confidence)}`}>
                  {Math.round(duplicateResult.confidence * 100)}% match
                </span>
              </div>
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto mt-2 text-orange-600 dark:text-orange-400"
                onClick={() => onDuplicateFound?.(duplicateResult.duplicateOf!)}
              >
                View Original Issue
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Results Section */}
        {(similarIssues.length > 0 || fullAnalysis) && (
          <div className="space-y-4 pt-4">
            <Separator />

            {/* Similar Resolved Issues */}
            {similarIssues.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  Similar Resolved Issues ({similarIssues.length})
                </h3>
                <ScrollArea className="h-[300px]">
                  <Accordion type="single" collapsible className="space-y-2">
                    {similarIssues.map((issue, idx) => (
                      <AccordionItem
                        key={issue.issueId}
                        value={issue.issueId}
                        className="border rounded-lg px-4"
                      >
                        <AccordionTrigger className="py-3 hover:no-underline">
                          <div className="flex items-start justify-between w-full pr-4">
                            <div className="text-left">
                              <div className="flex items-center gap-2">
                                <Badge variant={getSimilarityBadgeVariant(issue.similarityScore)}>
                                  {Math.round(issue.similarityScore * 100)}% match
                                </Badge>
                                {idx === 0 && (
                                  <Badge variant="secondary" className="text-xs">
                                    Best Match
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium mt-1">{issue.title}</p>
                              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>Resolved in {issue.resolutionTimeHours != null ? `${issue.resolutionTimeHours}h` : 'N/A'}</span>
                                {issue.resolvedBy && (
                                  <>
                                    <span>•</span>
                                    <User className="h-3 w-3" />
                                    <span>{issue.resolvedBy}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <div className="space-y-3">
                            {issue.resolutionCategory && (
                              <Badge className={CATEGORY_COLORS[issue.resolutionCategory] || 'bg-gray-100 text-gray-700'}>
                                {issue.resolutionCategory}
                              </Badge>
                            )}
                            {issue.resolution && (
                              <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
                                <Label className="text-xs text-green-600 dark:text-green-400">
                                  Resolution
                                </Label>
                                <p className="text-sm mt-1">{issue.resolution}</p>
                              </div>
                            )}
                            {issue.tags && issue.tags.length > 0 && (
                              <div>
                                <Label className="text-xs text-muted-foreground">
                                  Tags
                                </Label>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {issue.tags.map((tag, kidx) => (
                                    <Badge key={kidx} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() => window.open(`/issues/${issue.issueId}`, '_blank')}
                            >
                              View Full Issue
                              <ExternalLink className="h-3 w-3 ml-2" />
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </ScrollArea>
              </div>
            )}

            {/* AI Resolution Suggestion */}
            {fullAnalysis?.suggestedResolution && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    AI Resolution Suggestion
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Confidence</span>
                    <Progress
                      value={fullAnalysis.suggestedResolution.confidenceScore * 100}
                      className="w-20 h-2"
                    />
                    <span
                      className={`text-sm font-medium ${getConfidenceColor(
                        fullAnalysis.suggestedResolution.confidenceScore
                      )}`}
                    >
                      {Math.round(fullAnalysis.suggestedResolution.confidenceScore * 100)}%
                    </span>
                  </div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg space-y-4">
                  <div>
                    <Label className="text-xs text-purple-600 dark:text-purple-400">
                      Summary
                    </Label>
                    <p className="text-sm mt-1">{fullAnalysis.suggestedResolution.summary}</p>
                  </div>

                  {fullAnalysis.suggestedResolution.steps.length > 0 && (
                    <div>
                      <Label className="text-xs text-purple-600 dark:text-purple-400">
                        Resolution Steps
                      </Label>
                      <div className="space-y-2 mt-2">
                        {fullAnalysis.suggestedResolution.steps.map((step, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 bg-white dark:bg-gray-900 p-3 rounded-lg"
                          >
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-medium">
                              {step.order || idx + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium">{step.action}</p>
                              {step.details && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {step.details}
                                </p>
                              )}
                            </div>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopyStep(String(idx), step.action)}
                                  >
                                    {copiedStep === String(idx) ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <Copy className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Copy Step</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {fullAnalysis.suggestedResolution.estimatedTimeHours != null && (
                    <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400">
                      <Clock className="h-4 w-4" />
                      Estimated time: {fullAnalysis.suggestedResolution.estimatedTimeHours}h
                    </div>
                  )}

                  {fullAnalysis.suggestedResolution.potentialRisks && fullAnalysis.suggestedResolution.potentialRisks.length > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                      <div>
                        {fullAnalysis.suggestedResolution.potentialRisks.map((risk, idx) => (
                          <p key={idx} className="text-sm text-yellow-700 dark:text-yellow-300">
                            {risk}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {onResolutionApply && (
                  <Button onClick={handleApplySuggestion} className="w-full">
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Apply Resolution Steps
                  </Button>
                )}
              </div>
            )}

            {/* Suggested Assignee */}
            {fullAnalysis?.recommendedAssignee && (
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  Suggested Expert
                </h3>
                <div
                  className="border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors"
                  onClick={() =>
                    onAssigneeSelect?.(
                      fullAnalysis.recommendedAssignee!,
                      fullAnalysis.recommendedAssignee!
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{fullAnalysis.recommendedAssignee}</p>
                      <p className="text-sm text-muted-foreground">
                        Recommended based on resolution history
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            )}

            {/* Processing Time */}
            {fullAnalysis?.processingTimeMs && (
              <p className="text-xs text-muted-foreground text-right">
                Analysis completed in {fullAnalysis.processingTimeMs}ms
              </p>
            )}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && similarIssues.length === 0 && !fullAnalysis && title.trim() && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Click "Full Analysis" to find similar issues and get resolution suggestions</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ResolutionAssistant;
