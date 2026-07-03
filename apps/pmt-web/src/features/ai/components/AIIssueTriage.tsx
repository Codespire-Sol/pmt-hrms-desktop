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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  User,
  Tag,
  Clock,
  Zap,
  Target,
  Users,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import {
  useTriageIssueMutation,
  useGetTriageCategoriesQuery,
} from '../aiApi';
import type { TriageResultResponse, AssigneeCandidate } from '../types';

interface AIIssueTriageProps {
  onTriageComplete?: (result: TriageResultResponse) => void;
  onAssigneeSelect?: (userId: string, displayName: string) => void;
  onLabelsSelect?: (labels: string[]) => void;
  onPrioritySelect?: (priority: string) => void;
  projectContext?: Record<string, unknown>;
  projectId?: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  bug: <AlertCircle className="h-4 w-4 text-red-500" />,
  feature: <Sparkles className="h-4 w-4 text-blue-500" />,
  enhancement: <Zap className="h-4 w-4 text-purple-500" />,
  security: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  performance: <Clock className="h-4 w-4 text-yellow-500" />,
  documentation: <Tag className="h-4 w-4 text-green-500" />,
};

const URGENCY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
};

const COMPLEXITY_LABELS: Record<string, string> = {
  trivial: '< 1 hour',
  simple: '1-4 hours',
  moderate: '1-3 days',
  complex: '1-2 weeks',
  very_complex: '> 2 weeks',
};

export function AIIssueTriage({
  onTriageComplete,
  onAssigneeSelect,
  onLabelsSelect,
  onPrioritySelect,
  projectContext,
  projectId,
}: AIIssueTriageProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [triageResult, setTriageResult] = useState<TriageResultResponse | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);

  const { data: categoriesData } = useGetTriageCategoriesQuery();
  const [triageIssue, { isLoading }] = useTriageIssueMutation();

  const handleTriage = useCallback(async () => {
    if (!title.trim()) return;

    try {
      const result = await triageIssue({
        title,
        description,
        projectId,
        projectContext,
        includeAssignment: true,
      }).unwrap();

      setTriageResult(result);
      if (onTriageComplete) {
        onTriageComplete(result);
      }
    } catch (error) {
      console.error('Failed to triage issue:', error);
    }
  }, [title, description, projectId, projectContext, triageIssue, onTriageComplete]);

  const handleSelectAssignee = useCallback(
    (assignee: AssigneeCandidate) => {
      setSelectedAssignee(assignee.userId);
      if (onAssigneeSelect) {
        onAssigneeSelect(assignee.userId, assignee.displayName);
      }
    },
    [onAssigneeSelect]
  );

  const handleApplyLabels = useCallback(() => {
    if (triageResult && onLabelsSelect) {
      onLabelsSelect(triageResult.suggestedLabels);
    }
  }, [triageResult, onLabelsSelect]);

  const handleApplyPriority = useCallback(() => {
    if (triageResult && onPrioritySelect) {
      onPrioritySelect(triageResult.suggestedPriority);
    }
  }, [triageResult, onPrioritySelect]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getWorkloadColor = (workload: string) => {
    switch (workload) {
      case 'low':
        return 'bg-green-100 text-green-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'high':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-purple-500" />
          AI Issue Triage
        </CardTitle>
        <CardDescription>
          Automatically classify issues and suggest the best assignee
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Section */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Issue Title</Label>
            <Input
              id="title"
              placeholder="Enter issue title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe the issue..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <Button onClick={handleTriage} disabled={!title.trim() || isLoading}>
            {isLoading ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Analyze & Triage
          </Button>
        </div>

        {/* Results Section */}
        {triageResult && (
          <div className="space-y-4 pt-4">
            <Separator />

            {/* Classification */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Classification
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Confidence</span>
                  <Progress
                    value={triageResult.classification.confidence * 100}
                    className="w-20 h-2"
                  />
                  <span
                    className={`text-sm font-medium ${getConfidenceColor(
                      triageResult.classification.confidence
                    )}`}
                  >
                    {Math.round(triageResult.classification.confidence * 100)}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Category */}
                <div className="border rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {CATEGORY_ICONS[triageResult.classification.category] || (
                      <Tag className="h-4 w-4" />
                    )}
                    <span className="font-medium capitalize">
                      {triageResult.classification.category}
                    </span>
                  </div>
                </div>

                {/* Urgency */}
                <div className="border rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground">Urgency</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        URGENCY_COLORS[triageResult.classification.urgency] || 'bg-gray-500'
                      }`}
                    />
                    <span className="font-medium capitalize">
                      {triageResult.classification.urgency}
                    </span>
                  </div>
                </div>

                {/* Complexity */}
                <div className="border rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground">Complexity</Label>
                  <div className="mt-1">
                    <span className="font-medium capitalize">
                      {triageResult.classification.complexity.replace('_', ' ')}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {COMPLEXITY_LABELS[triageResult.classification.complexity]}
                    </p>
                  </div>
                </div>

                {/* Effort */}
                <div className="border rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground">Est. Effort</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {triageResult.classification.estimatedEffort}
                    </span>
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              {triageResult.classification.reasoning && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm">{triageResult.classification.reasoning}</p>
                </div>
              )}

              {/* Required Skills */}
              {triageResult.classification.requiredSkills.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Required Skills</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {triageResult.classification.requiredSkills.map((skill, idx) => (
                      <Badge key={idx} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Suggested Assignees */}
            {triageResult.suggestedAssignees.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  Suggested Assignees
                </h3>
                <div className="space-y-2">
                  {triageResult.suggestedAssignees.map((assignee, idx) => (
                    <div
                      key={assignee.userId}
                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                        selectedAssignee === assignee.userId
                          ? 'border-primary bg-primary/5'
                          : 'hover:border-muted-foreground'
                      }`}
                      onClick={() => handleSelectAssignee(assignee)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {assignee.displayName
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{assignee.displayName}</span>
                              {idx === 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  Best Match
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge
                                className={`text-xs ${getWorkloadColor(assignee.currentWorkload)}`}
                              >
                                {assignee.currentWorkload} workload
                              </Badge>
                              {assignee.expertiseMatch.slice(0, 2).map((skill, skillIdx) => (
                                <Badge key={skillIdx} variant="outline" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <Progress value={assignee.matchScore * 100} className="w-12 h-2" />
                            <span
                              className={`text-sm font-medium ${getConfidenceColor(
                                assignee.matchScore
                              )}`}
                            >
                              {Math.round(assignee.matchScore * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      {assignee.reasoning && (
                        <p className="text-sm text-muted-foreground mt-2">{assignee.reasoning}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Routing Suggestion */}
            {triageResult.routingSuggestion && (
              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <ArrowRight className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  {triageResult.routingSuggestion}
                </span>
              </div>
            )}

            {/* Labels and Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Suggested Labels</Label>
                  {onLabelsSelect && (
                    <Button variant="ghost" size="sm" onClick={handleApplyLabels}>
                      Apply
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {triageResult.suggestedLabels.map((label, idx) => (
                    <Badge key={idx} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Suggested Priority</Label>
                  {onPrioritySelect && (
                    <Button variant="ghost" size="sm" onClick={handleApplyPriority}>
                      Apply
                    </Button>
                  )}
                </div>
                <Badge
                  className={`${
                    URGENCY_COLORS[triageResult.suggestedPriority]
                  } text-white capitalize`}
                >
                  {triageResult.suggestedPriority}
                </Badge>
              </div>
            </div>

            {/* Warnings */}
            {triageResult.warnings.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  {triageResult.warnings.map((warning, idx) => (
                    <p key={idx} className="text-sm text-yellow-700 dark:text-yellow-300">
                      {warning}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AIIssueTriage;
