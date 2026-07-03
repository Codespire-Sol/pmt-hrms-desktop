import { useState, useCallback } from 'react';
import { Loader2, Sparkles, Wand2, AlertCircle, Check, X } from 'lucide-react';

import { useDebounce } from '@/hooks/useDebounce';
import { useParseNaturalLanguageMutation } from '../aiApi';
import type { ParsedIssue } from '../types';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NaturalLanguageInputProps {
  projectId: string;
  onParsed: (issue: ParsedIssue) => void;
  onCancel?: () => void;
  placeholder?: string;
  minLength?: number;
}

export function NaturalLanguageInput({
  projectId,
  onParsed,
  onCancel,
  placeholder = 'Describe the issue in natural language...\n\nExamples:\n- "Create a high priority bug for login not working on mobile"\n- "Add a task to update the user documentation by Friday"\n- "Fix the checkout validation - users can submit empty cart"',
  minLength = 15,
}: NaturalLanguageInputProps) {
  const [text, setText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [parseNaturalLanguage, { isLoading, data, error, reset }] =
    useParseNaturalLanguageMutation();

  const debouncedText = useDebounce(text, 800);
  const canParse = debouncedText.length >= minLength;

  const handleParse = useCallback(async () => {
    if (!canParse) return;

    try {
      await parseNaturalLanguage({
        text,
        projectId,
      }).unwrap();

      setShowPreview(true);
    } catch (err) {
      console.error('Failed to parse:', err);
    }
  }, [text, projectId, canParse, parseNaturalLanguage]);

  const handleAccept = () => {
    if (data?.parsedIssue) {
      onParsed(data.parsedIssue);
      handleReset();
    }
  };

  const handleReset = () => {
    setText('');
    setShowPreview(false);
    reset();
  };

  const confidencePercent = data ? Math.round(data.confidence * 100) : 0;
  const confidenceColor =
    confidencePercent >= 80
      ? 'text-green-600'
      : confidencePercent >= 60
        ? 'text-yellow-600'
        : 'text-orange-600';

  return (
    <div className="space-y-4">
      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (showPreview) {
              setShowPreview(false);
              reset();
            }
          }}
          placeholder={placeholder}
          className="min-h-[120px] pr-20"
          disabled={isLoading}
        />

        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {text.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {text.length} chars
            </span>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleParse}
                  disabled={!canParse || isLoading}
                  className="gap-1"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                  Parse
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {canParse
                    ? 'Parse natural language into issue'
                    : `Enter at least ${minLength} characters`}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>Failed to parse text. Please try again.</span>
        </div>
      )}

      {showPreview && data?.parsedIssue && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Parsed Issue
              </CardTitle>
              <div className="flex items-center gap-2">
                <Progress value={confidencePercent} className="w-16 h-1.5" />
                <span className={`text-xs font-medium ${confidenceColor}`}>
                  {confidencePercent}% confidence
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Title</label>
              <p className="font-medium">{data.parsedIssue.title}</p>
            </div>

            {data.parsedIssue.description && (
              <div>
                <label className="text-xs text-muted-foreground">
                  Description
                </label>
                <p className="text-sm whitespace-pre-wrap">
                  {data.parsedIssue.description}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                Type: {data.parsedIssue.issueType}
              </Badge>
              {data.parsedIssue.priority && (
                <Badge
                  variant={
                    data.parsedIssue.priority === 'critical'
                      ? 'destructive'
                      : data.parsedIssue.priority === 'high'
                        ? 'default'
                        : 'secondary'
                  }
                >
                  Priority: {data.parsedIssue.priority}
                </Badge>
              )}
              {data.parsedIssue.storyPoints && (
                <Badge variant="secondary">
                  {data.parsedIssue.storyPoints} pts
                </Badge>
              )}
              {data.parsedIssue.assigneeHint && (
                <Badge variant="outline">
                  Assign to: {data.parsedIssue.assigneeHint}
                </Badge>
              )}
              {data.parsedIssue.dueDateHint && (
                <Badge variant="outline">
                  Due: {data.parsedIssue.dueDateHint}
                </Badge>
              )}
            </div>

            {data.parsedIssue.labels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.parsedIssue.labels.map((label) => (
                  <Badge key={label} variant="secondary" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCancel}
                >
                  Cancel
                </Button>
              )}
              <Button type="button" size="sm" onClick={handleAccept}>
                <Check className="h-4 w-4 mr-1" />
                Use This
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Type a description of the issue you want to create. AI will extract the
        title, type, priority, and other fields automatically.
      </p>
    </div>
  );
}
