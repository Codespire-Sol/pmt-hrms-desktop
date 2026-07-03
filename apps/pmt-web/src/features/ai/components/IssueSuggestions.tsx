import { useGetIssueSuggestionsQuery } from '../aiApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Check, X, Loader2 } from 'lucide-react';

interface IssueSuggestionsProps {
  title: string;
  description: string;
  projectId: string;
  onAccept: (field: string, value: unknown) => void;
}

interface SuggestionItemProps {
  label: string;
  value: string | number;
  confidence: number;
  reason?: string;
  onAccept: () => void;
  onReject: () => void;
}

function SuggestionItem({
  label,
  value,
  confidence,
  onAccept,
  onReject,
}: SuggestionItemProps) {
  const confidencePercent = Math.round(confidence * 100);
  const confidenceColor =
    confidencePercent >= 80
      ? 'text-green-600'
      : confidencePercent >= 60
        ? 'text-yellow-600'
        : 'text-orange-600';

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground w-24">{label}:</span>
        <Badge variant="outline" className="font-medium">
          {value}
        </Badge>
        <span className={`text-xs ${confidenceColor}`}>
          {confidencePercent}% confident
        </span>
      </div>
      <div className="flex gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 hover:bg-green-100"
          onClick={onAccept}
          title="Accept suggestion"
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 hover:bg-red-100"
          onClick={onReject}
          title="Reject suggestion"
        >
          <X className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    </div>
  );
}

export function IssueSuggestions({
  title,
  description,
  projectId,
  onAccept,
}: IssueSuggestionsProps) {
  const { data, isLoading, isFetching, error } = useGetIssueSuggestionsQuery(
    { title, description, projectId },
    {
      skip: !title || title.length < 10 || !projectId,
    }
  );

  if (!title || title.length < 10) {
    return null;
  }

  if (isLoading || isFetching) {
    return (
      <Card className="mt-4 border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Getting AI suggestions...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null;
  }

  const { suggestions } = data;
  const hasSuggestions =
    suggestions.issueType ||
    suggestions.priority ||
    suggestions.storyPoints ||
    suggestions.labels.length > 0 ||
    suggestions.assignee;

  if (!hasSuggestions) {
    return null;
  }

  return (
    <Card className="mt-4 border-primary/20 bg-primary/5">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Suggestions
          <span className="text-xs text-muted-foreground font-normal">
            ({data.processingTimeMs}ms)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {suggestions.issueType && (
            <SuggestionItem
              label="Type"
              value={suggestions.issueType.value as string}
              confidence={suggestions.issueType.confidence}
              reason={suggestions.issueType.reason}
              onAccept={() => onAccept('typeId', suggestions.issueType?.value)}
              onReject={() => {}}
            />
          )}

          {suggestions.priority && (
            <SuggestionItem
              label="Priority"
              value={suggestions.priority.value as string}
              confidence={suggestions.priority.confidence}
              reason={suggestions.priority.reason}
              onAccept={() => onAccept('priorityId', suggestions.priority?.value)}
              onReject={() => {}}
            />
          )}

          {suggestions.storyPoints && (
            <SuggestionItem
              label="Story Points"
              value={suggestions.storyPoints.value}
              confidence={suggestions.storyPoints.confidence}
              reason={suggestions.storyPoints.reason}
              onAccept={() => onAccept('storyPoints', suggestions.storyPoints?.value)}
              onReject={() => {}}
            />
          )}

          {suggestions.assignee && (
            <SuggestionItem
              label="Assignee"
              value={suggestions.assignee.displayName}
              confidence={suggestions.assignee.confidence}
              reason={suggestions.assignee.reason}
              onAccept={() => onAccept('assigneeId', suggestions.assignee?.userId)}
              onReject={() => {}}
            />
          )}

          {suggestions.labels.length > 0 && (
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-24">Labels:</span>
                <div className="flex gap-1 flex-wrap">
                  {suggestions.labels.map((label) => (
                    <Badge
                      key={label.name}
                      variant="secondary"
                      className="text-xs"
                    >
                      {label.name}
                      <span className="ml-1 text-muted-foreground">
                        {Math.round(label.confidence * 100)}%
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs hover:bg-green-100"
                onClick={() =>
                  onAccept(
                    'labels',
                    suggestions.labels.map((l) => l.name)
                  )
                }
              >
                <Check className="h-3 w-3 mr-1 text-green-600" />
                Accept All
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
