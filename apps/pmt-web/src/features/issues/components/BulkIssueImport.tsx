import { useState, useMemo } from 'react';
import {
  Loader2,
  Sparkles,
  FileText,
  Check,
  X,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

import { useParseBulkIssuesMutation } from '@/features/ai/aiApi';
import { useCreateIssueMutation } from '../issuesApi';
import type { BulkParsedIssue } from '@/features/ai/types';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

interface BulkIssueImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  issueTypes: { id: string; name: string }[];
  priorities: { id: string; name: string }[];
  onSuccess?: () => void;
}

interface ParsedIssueWithSelection extends BulkParsedIssue {
  selected: boolean;
  isExpanded: boolean;
}

export function BulkIssueImport({
  open,
  onOpenChange,
  projectId,
  issueTypes,
  priorities,
  onSuccess,
}: BulkIssueImportProps) {
  const { hasPermission: canCreateIssue } = usePermissionGuard('issues.create');
  const [text, setText] = useState('');
  const [parsedIssues, setParsedIssues] = useState<ParsedIssueWithSelection[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);

  const [parseBulkIssues, { isLoading: isParsing, error: parseError }] =
    useParseBulkIssuesMutation();
  const [createIssue] = useCreateIssueMutation();

  const selectedCount = useMemo(
    () => parsedIssues.filter((i) => i.selected).length,
    [parsedIssues]
  );

  const handleParse = async () => {
    if (text.trim().length < 10) return;

    try {
      const result = await parseBulkIssues({
        text,
        projectId,
      }).unwrap();

      setParsedIssues(
        result.parsedIssues.map((issue) => ({
          ...issue,
          selected: true,
          isExpanded: false,
        }))
      );
      setShowPreview(true);
      setErrors([]);
    } catch (err) {
      console.error('Failed to parse:', err);
    }
  };

  const toggleIssue = (index: number) => {
    setParsedIssues((prev) =>
      prev.map((issue, i) =>
        i === index ? { ...issue, selected: !issue.selected } : issue
      )
    );
  };

  const toggleExpand = (index: number) => {
    setParsedIssues((prev) =>
      prev.map((issue, i) =>
        i === index ? { ...issue, isExpanded: !issue.isExpanded } : issue
      )
    );
  };

  const toggleAll = (selected: boolean) => {
    setParsedIssues((prev) => prev.map((issue) => ({ ...issue, selected })));
  };

  const handleCreateAll = async () => {
    const selectedIssues = parsedIssues.filter((i) => i.selected);
    if (selectedIssues.length === 0) return;

    setIsCreating(true);
    setCreationProgress(0);
    setErrors([]);

    const newErrors: string[] = [];
    let completed = 0;

    for (const issue of selectedIssues) {
      try {
        // Find matching type and priority IDs
        const typeMatch = issueTypes.find(
          (t) => t.name.toLowerCase() === issue.issueType.toLowerCase()
        );
        const priorityMatch = issue.priority
          ? priorities.find(
              (p) => p.name.toLowerCase() === issue.priority?.toLowerCase()
            )
          : undefined;

        await createIssue({
          projectId,
          data: {
            title: issue.title,
            description: issue.description,
            typeId: typeMatch?.id || issueTypes[0]?.id,
            priorityId: priorityMatch?.id,
            storyPoints: issue.storyPoints,
          },
        }).unwrap();
      } catch (err) {
        newErrors.push(`Failed to create: ${issue.title}`);
      }

      completed++;
      setCreationProgress((completed / selectedIssues.length) * 100);
    }

    setIsCreating(false);
    setErrors(newErrors);

    if (newErrors.length === 0) {
      handleReset();
      onSuccess?.();
    }
  };

  const handleReset = () => {
    setText('');
    setParsedIssues([]);
    setShowPreview(false);
    setErrors([]);
    setCreationProgress(0);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  if (!canCreateIssue) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Bulk Issue Import
          </DialogTitle>
          <DialogDescription>
            Paste a list of issues and let AI parse them into structured issues.
          </DialogDescription>
        </DialogHeader>

        {!showPreview ? (
          <div className="space-y-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Paste multiple issues here. Supported formats:

- Numbered list:
1. Fix login bug on mobile Safari
2. Add password reset functionality
3. Update user profile page design

- Bullet points:
- Create API endpoint for notifications
- Add email templates for welcome messages
- Fix cart total calculation

- Plain text (one per line):
Users can't upload images over 5MB
Dashboard loading is slow
Add dark mode toggle`}
              className="min-h-[250px] font-mono text-sm"
              disabled={isParsing}
            />

            {parseError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Failed to parse issues. Please try again.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleParse}
                disabled={text.trim().length < 10 || isParsing}
              >
                {isParsing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Parsing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Parse Issues
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedCount === parsedIssues.length}
                  onCheckedChange={(checked) => toggleAll(checked === true)}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedCount} of {parsedIssues.length} issues selected
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>
                Edit Input
              </Button>
            </div>

            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-2">
                {parsedIssues.map((issue, index) => (
                  <Collapsible
                    key={index}
                    open={issue.isExpanded}
                    onOpenChange={() => toggleExpand(index)}
                  >
                    <div
                      className={`border rounded-lg p-3 ${
                        issue.selected
                          ? 'border-primary/30 bg-primary/5'
                          : 'opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={issue.selected}
                          onCheckedChange={() => toggleIssue(index)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <CollapsibleTrigger className="flex items-center gap-1 hover:text-primary">
                              {issue.isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </CollapsibleTrigger>
                            <span className="font-medium truncate">
                              {issue.title}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {issue.issueType}
                            </Badge>
                            {issue.priority && (
                              <Badge
                                variant={
                                  issue.priority === 'critical'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                                className="text-xs"
                              >
                                {issue.priority}
                              </Badge>
                            )}
                            {issue.storyPoints && (
                              <Badge variant="secondary" className="text-xs">
                                {issue.storyPoints} pts
                              </Badge>
                            )}
                            <span
                              className={`text-xs ${
                                issue.confidence >= 0.8
                                  ? 'text-green-600'
                                  : issue.confidence >= 0.6
                                    ? 'text-yellow-600'
                                    : 'text-orange-600'
                              }`}
                            >
                              {Math.round(issue.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <CollapsibleContent>
                        <div className="mt-3 pl-7 text-sm text-muted-foreground">
                          {issue.description || 'No description'}
                          {issue.labels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {issue.labels.map((label) => (
                                <Badge
                                  key={label}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {label}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>

            {errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside">
                    {errors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {isCreating && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Creating issues...</span>
                  <span>{Math.round(creationProgress)}%</span>
                </div>
                <Progress value={creationProgress} />
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleReset} disabled={isCreating}>
                <X className="mr-2 h-4 w-4" />
                Reset
              </Button>
              <Button
                onClick={handleCreateAll}
                disabled={selectedCount === 0 || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Create {selectedCount} Issues
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
