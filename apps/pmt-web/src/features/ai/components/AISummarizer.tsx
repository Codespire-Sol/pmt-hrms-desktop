/**
 * AI Summarizer Component
 * Provides AI-powered summarization for issues, threads, and bulk content.
 */

import React, { useState, useCallback } from 'react';
import {
  useSummarizeIssueMutation,
  useSummarizeThreadMutation,
  useSummarizeBulkMutation,
  useGenerateDailyDigestMutation,
  useGetSummaryLengthsQuery,
  useGetSummaryFormatsQuery,
} from '../aiApi';
import type {
  SummaryLength,
  SummaryFormat,
  IssueSummaryResponse,
  ThreadSummaryResponse,
  BulkSummaryResponse,
  DailyDigestResponse,
} from '../types';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  MessageSquare,
  Layers,
  Calendar,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Users,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

// ==================== Types ====================

interface Comment {
  author: string;
  content: string;
  createdAt?: string;
}

interface Issue {
  key?: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
}

interface IssueSummarizerProps {
  title: string;
  description?: string;
  comments?: Comment[];
  status?: string;
  metadata?: Record<string, unknown>;
  onSummaryGenerated?: (summary: IssueSummaryResponse) => void;
}

interface ThreadSummarizerProps {
  comments: Comment[];
  issueContext?: { title: string; status: string };
  onSummaryGenerated?: (summary: ThreadSummaryResponse) => void;
}

interface BulkSummarizerProps {
  issues: Issue[];
  context?: string;
  onSummaryGenerated?: (summary: BulkSummaryResponse) => void;
}

interface DailyDigestGeneratorProps {
  projectName: string;
  issuesUpdated?: Array<{ key: string; title: string }>;
  issuesCreated?: Array<{ key: string; title: string }>;
  issuesCompleted?: Array<{ key: string; title: string }>;
  onDigestGenerated?: (digest: DailyDigestResponse) => void;
}

// ==================== Issue Summarizer ====================

export const IssueSummarizer: React.FC<IssueSummarizerProps> = ({
  title,
  description = '',
  comments = [],
  status,
  metadata,
  onSummaryGenerated,
}) => {
  const [selectedLength, setSelectedLength] = useState<SummaryLength>('standard');
  const [selectedFormat, setSelectedFormat] = useState<SummaryFormat>('prose');
  const [summary, setSummary] = useState<IssueSummaryResponse | null>(null);

  const { data: lengthOptions } = useGetSummaryLengthsQuery();
  const { data: formatOptions } = useGetSummaryFormatsQuery();
  const [summarize, { isLoading, error }] = useSummarizeIssueMutation();

  const handleSummarize = useCallback(async () => {
    try {
      const result = await summarize({
        title,
        description,
        comments: comments.map((c) => ({
          author: c.author,
          content: c.content,
          createdAt: c.createdAt,
        })),
        status,
        metadata,
        length: selectedLength,
        format: selectedFormat,
      }).unwrap();

      setSummary(result);
      onSummaryGenerated?.(result);
    } catch (err) {
      console.error('Failed to summarize issue:', err);
    }
  }, [title, description, comments, status, metadata, selectedLength, selectedFormat, summarize, onSummaryGenerated]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Issue Summary
        </CardTitle>
        <CardDescription>Generate an AI-powered summary of this issue</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Options */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Length</label>
            <Select value={selectedLength} onValueChange={(v) => setSelectedLength(v as SummaryLength)}>
              <SelectTrigger>
                <SelectValue placeholder="Select length" />
              </SelectTrigger>
              <SelectContent>
                {lengthOptions?.lengths.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label} - {opt.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Format</label>
            <Select value={selectedFormat} onValueChange={(v) => setSelectedFormat(v as SummaryFormat)}>
              <SelectTrigger>
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                {formatOptions?.formats.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label} - {opt.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={handleSummarize} disabled={isLoading} className="w-full">
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating Summary...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Summary
            </>
          )}
        </Button>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            Failed to generate summary. Please try again.
          </div>
        )}

        {/* Summary Result */}
        {summary && (
          <div className="space-y-4 mt-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <h4 className="font-semibold mb-2">Summary</h4>
              <p className="text-sm text-muted-foreground">{summary.summary}</p>
            </div>

            {summary.keyPoints.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Key Points</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {summary.keyPoints.map((point, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-4">
              <div className="flex-1">
                <h4 className="font-semibold mb-2 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Status
                </h4>
                <p className="text-sm text-muted-foreground">{summary.currentStatus}</p>
                {summary.timeInStatus && (
                  <p className="text-xs text-muted-foreground mt-1">Time in status: {summary.timeInStatus}</p>
                )}
              </div>
            </div>

            {summary.blockers.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Blockers
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {summary.blockers.map((blocker, idx) => (
                    <li key={idx} className="text-destructive/80">
                      {blocker}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.nextSteps.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1">
                  <ArrowRight className="h-4 w-4" />
                  Next Steps
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {summary.nextSteps.map((step, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span>Confidence: {Math.round(summary.confidence * 100)}%</span>
              <span>Generated in {summary.processingTimeMs}ms</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ==================== Thread Summarizer ====================

export const ThreadSummarizer: React.FC<ThreadSummarizerProps> = ({
  comments,
  issueContext,
  onSummaryGenerated,
}) => {
  const [selectedLength, setSelectedLength] = useState<SummaryLength>('standard');
  const [summary, setSummary] = useState<ThreadSummaryResponse | null>(null);

  const { data: lengthOptions } = useGetSummaryLengthsQuery();
  const [summarize, { isLoading, error }] = useSummarizeThreadMutation();

  const handleSummarize = useCallback(async () => {
    if (comments.length === 0) return;

    try {
      const result = await summarize({
        comments: comments.map((c) => ({
          author: c.author,
          content: c.content,
          createdAt: c.createdAt,
        })),
        issueContext,
        length: selectedLength,
      }).unwrap();

      setSummary(result);
      onSummaryGenerated?.(result);
    } catch (err) {
      console.error('Failed to summarize thread:', err);
    }
  }, [comments, issueContext, selectedLength, summarize, onSummaryGenerated]);

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return 'text-green-500';
      case 'negative':
        return 'text-red-500';
      case 'mixed':
        return 'text-yellow-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Thread Summary
        </CardTitle>
        <CardDescription>
          Summarize the discussion from {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Summary Length</label>
            <Select value={selectedLength} onValueChange={(v) => setSelectedLength(v as SummaryLength)}>
              <SelectTrigger>
                <SelectValue placeholder="Select length" />
              </SelectTrigger>
              <SelectContent>
                {lengthOptions?.lengths.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSummarize} disabled={isLoading || comments.length === 0}>
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Summarizing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Summarize Thread
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            Failed to summarize thread. Please try again.
          </div>
        )}

        {summary && (
          <div className="space-y-4 mt-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Discussion Summary</h4>
                <Badge variant="outline" className={getSentimentColor(summary.sentiment)}>
                  {summary.sentiment} sentiment
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{summary.summary}</p>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Participants: {summary.participants.join(', ')}
              </span>
            </div>

            <Separator />

            {summary.keyDecisions.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Key Decisions
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {summary.keyDecisions.map((decision, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {decision}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.actionItems.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1">
                  <ArrowRight className="h-4 w-4 text-blue-500" />
                  Action Items
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {summary.actionItems.map((item, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.unresolvedQuestions.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                  Unresolved Questions
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {summary.unresolvedQuestions.map((question, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {question}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span>Confidence: {Math.round(summary.confidence * 100)}%</span>
              <span>Generated in {summary.processingTimeMs}ms</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ==================== Bulk Summarizer ====================

export const BulkSummarizer: React.FC<BulkSummarizerProps> = ({
  issues,
  context,
  onSummaryGenerated,
}) => {
  const [groupBy, setGroupBy] = useState<'status' | 'priority' | 'assignee' | 'type'>('status');
  const [summary, setSummary] = useState<BulkSummaryResponse | null>(null);

  const [summarize, { isLoading, error }] = useSummarizeBulkMutation();

  const handleSummarize = useCallback(async () => {
    if (issues.length === 0) return;

    try {
      const result = await summarize({
        issues: issues.map((i) => ({
          key: i.key,
          title: i.title,
          status: i.status,
          priority: i.priority,
        })),
        context,
        groupBy,
      }).unwrap();

      setSummary(result);
      onSummaryGenerated?.(result);
    } catch (err) {
      console.error('Failed to summarize bulk issues:', err);
    }
  }, [issues, context, groupBy, summarize, onSummaryGenerated]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Bulk Summary
        </CardTitle>
        <CardDescription>
          Generate an executive summary of {issues.length} issue{issues.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Group By</label>
            <Select
              value={groupBy}
              onValueChange={(v) => setGroupBy(v as 'status' | 'priority' | 'assignee' | 'type')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select grouping" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="priority">Priority</SelectItem>
                <SelectItem value="assignee">Assignee</SelectItem>
                <SelectItem value="type">Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleSummarize} disabled={isLoading || issues.length === 0}>
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Summary
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            Failed to generate summary. Please try again.
          </div>
        )}

        {summary && (
          <div className="space-y-4 mt-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <h4 className="font-semibold mb-2">Executive Summary</h4>
              <p className="text-sm text-muted-foreground">{summary.overallSummary}</p>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-2 bg-background rounded">
                <div className="text-2xl font-bold">{summary.statistics.total}</div>
                <div className="text-xs text-muted-foreground">Total Issues</div>
              </div>
              <div className="text-center p-2 bg-background rounded">
                <div className="text-2xl font-bold">{Object.keys(summary.byStatus).length}</div>
                <div className="text-xs text-muted-foreground">Statuses</div>
              </div>
              <div className="text-center p-2 bg-background rounded">
                <div className="text-2xl font-bold">{summary.keyThemes.length}</div>
                <div className="text-xs text-muted-foreground">Themes</div>
              </div>
            </div>

            <Separator />

            {/* By Status */}
            {Object.keys(summary.byStatus).length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">By Status</h4>
                <div className="space-y-2">
                  {Object.entries(summary.byStatus).map(([status, text]) => (
                    <div key={status} className="text-sm">
                      <Badge variant="outline" className="mr-2">
                        {status}
                      </Badge>
                      <span className="text-muted-foreground">{String(text)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* By Priority */}
            {Object.keys(summary.byPriority).length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">By Priority</h4>
                <div className="space-y-2">
                  {Object.entries(summary.byPriority).map(([priority, text]) => (
                    <div key={priority} className="text-sm">
                      <Badge variant="outline" className="mr-2">
                        {priority}
                      </Badge>
                      <span className="text-muted-foreground">{String(text)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.keyThemes.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  Key Themes
                </h4>
                <div className="flex flex-wrap gap-2">
                  {summary.keyThemes.map((theme, idx) => (
                    <Badge key={idx} variant="secondary">
                      {theme}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {summary.blockers.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Blockers & Risks
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {summary.blockers.map((blocker, idx) => (
                    <li key={idx} className="text-destructive/80">
                      {blocker}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {summary.highlights.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Highlights
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {summary.highlights.map((highlight, idx) => (
                    <li key={idx} className="text-green-600/80">
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span>Confidence: {Math.round(summary.confidence * 100)}%</span>
              <span>Generated in {summary.processingTimeMs}ms</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ==================== Daily Digest Generator ====================

export const DailyDigestGenerator: React.FC<DailyDigestGeneratorProps> = ({
  projectName,
  issuesUpdated = [],
  issuesCreated = [],
  issuesCompleted = [],
  onDigestGenerated,
}) => {
  const [digest, setDigest] = useState<DailyDigestResponse | null>(null);

  const [generate, { isLoading, error }] = useGenerateDailyDigestMutation();

  const handleGenerate = useCallback(async () => {
    try {
      const result = await generate({
        projectName,
        issuesUpdated,
        issuesCreated,
        issuesCompleted,
      }).unwrap();

      setDigest(result);
      onDigestGenerated?.(result);
    } catch (err) {
      console.error('Failed to generate daily digest:', err);
    }
  }, [projectName, issuesUpdated, issuesCreated, issuesCompleted, generate, onDigestGenerated]);

  const totalActivity = issuesUpdated.length + issuesCreated.length + issuesCompleted.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Daily Digest
        </CardTitle>
        <CardDescription>
          Generate a daily summary for {projectName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Activity Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-2 bg-muted rounded">
            <div className="text-xl font-bold text-green-600">{issuesCompleted.length}</div>
            <div className="text-xs text-muted-foreground">Completed</div>
          </div>
          <div className="text-center p-2 bg-muted rounded">
            <div className="text-xl font-bold text-blue-600">{issuesCreated.length}</div>
            <div className="text-xs text-muted-foreground">Created</div>
          </div>
          <div className="text-center p-2 bg-muted rounded">
            <div className="text-xl font-bold text-yellow-600">{issuesUpdated.length}</div>
            <div className="text-xs text-muted-foreground">Updated</div>
          </div>
        </div>

        <Button onClick={handleGenerate} disabled={isLoading || totalActivity === 0} className="w-full">
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating Digest...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Daily Digest
            </>
          )}
        </Button>

        {totalActivity === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            No activity to summarize. Add some issues to generate a digest.
          </p>
        )}

        {error && (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            Failed to generate digest. Please try again.
          </div>
        )}

        {digest && (
          <div className="space-y-4 mt-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <h3 className="text-lg font-bold">{digest.headline}</h3>
              <p className="text-sm text-muted-foreground mt-2">{digest.summary}</p>
            </div>

            <Separator />

            {digest.completedHighlights.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Completed Highlights
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {digest.completedHighlights.map((item, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {digest.newItems.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1 text-blue-600">
                  <FileText className="h-4 w-4" />
                  New Items
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {digest.newItems.map((item, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {digest.activeWork.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Active Work
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {digest.activeWork.map((item, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {digest.needsAttention.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-1 text-yellow-600">
                  <AlertTriangle className="h-4 w-4" />
                  Needs Attention
                </h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {digest.needsAttention.map((item, idx) => (
                    <li key={idx} className="text-yellow-600/80">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-xs text-muted-foreground pt-2 border-t">
              Generated in {digest.processingTimeMs}ms
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ==================== Combined Summarizer Component ====================

interface AISummarizerProps {
  // Issue data (optional)
  issue?: {
    title: string;
    description?: string;
    status?: string;
    metadata?: Record<string, unknown>;
  };
  // Comments for thread summarization
  comments?: Comment[];
  // Issues for bulk summarization
  issues?: Issue[];
  // Project info for daily digest
  projectName?: string;
  dailyActivity?: {
    updated: Array<{ key: string; title: string }>;
    created: Array<{ key: string; title: string }>;
    completed: Array<{ key: string; title: string }>;
  };
  // Default tab
  defaultTab?: 'issue' | 'thread' | 'bulk' | 'digest';
  // Callbacks
  onIssueSummary?: (summary: IssueSummaryResponse) => void;
  onThreadSummary?: (summary: ThreadSummaryResponse) => void;
  onBulkSummary?: (summary: BulkSummaryResponse) => void;
  onDailyDigest?: (digest: DailyDigestResponse) => void;
}

export const AISummarizer: React.FC<AISummarizerProps> = ({
  issue,
  comments = [],
  issues = [],
  projectName = 'Project',
  dailyActivity,
  defaultTab = 'issue',
  onIssueSummary,
  onThreadSummary,
  onBulkSummary,
  onDailyDigest,
}) => {
  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="issue" className="flex items-center gap-1">
          <FileText className="h-4 w-4" />
          Issue
        </TabsTrigger>
        <TabsTrigger value="thread" className="flex items-center gap-1">
          <MessageSquare className="h-4 w-4" />
          Thread
        </TabsTrigger>
        <TabsTrigger value="bulk" className="flex items-center gap-1">
          <Layers className="h-4 w-4" />
          Bulk
        </TabsTrigger>
        <TabsTrigger value="digest" className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          Digest
        </TabsTrigger>
      </TabsList>

      <ScrollArea className="h-[600px] mt-4">
        <TabsContent value="issue">
          {issue ? (
            <IssueSummarizer
              title={issue.title}
              description={issue.description}
              comments={comments}
              status={issue.status}
              metadata={issue.metadata}
              onSummaryGenerated={onIssueSummary}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No issue selected. Provide issue data to generate a summary.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="thread">
          {comments.length > 0 ? (
            <ThreadSummarizer
              comments={comments}
              issueContext={issue ? { title: issue.title, status: issue.status || 'Unknown' } : undefined}
              onSummaryGenerated={onThreadSummary}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No comments available. Add comments to summarize the discussion thread.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="bulk">
          {issues.length > 0 ? (
            <BulkSummarizer issues={issues} onSummaryGenerated={onBulkSummary} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No issues available. Provide a list of issues to generate a bulk summary.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="digest">
          <DailyDigestGenerator
            projectName={projectName}
            issuesUpdated={dailyActivity?.updated}
            issuesCreated={dailyActivity?.created}
            issuesCompleted={dailyActivity?.completed}
            onDigestGenerated={onDailyDigest}
          />
        </TabsContent>
      </ScrollArea>
    </Tabs>
  );
};

export default AISummarizer;
