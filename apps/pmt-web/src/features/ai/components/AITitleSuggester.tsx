import { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RefreshCw, Sparkles, Check, Copy, FileText } from 'lucide-react';
import {
  useSuggestTitlesMutation,
  useGenerateDescriptionMutation,
} from '../aiApi';
import type { TitleSuggestion, GenerateDescriptionResponse } from '../types';

interface AITitleSuggesterProps {
  onTitleSelect?: (title: string) => void;
  onDescriptionGenerated?: (description: string, criteria: string[]) => void;
  existingTitles?: string[];
}

const ISSUE_TYPES = [
  { value: 'bug', label: 'Bug' },
  { value: 'task', label: 'Task' },
  { value: 'story', label: 'Story' },
  { value: 'epic', label: 'Epic' },
];

export function AITitleSuggester({
  onTitleSelect,
  onDescriptionGenerated,
  existingTitles = [],
}: AITitleSuggesterProps) {
  const [description, setDescription] = useState('');
  const [issueType, setIssueType] = useState<string>('task');
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([]);
  const [selectedTitle, setSelectedTitle] = useState<string>('');
  const [generatedDescription, setGeneratedDescription] =
    useState<GenerateDescriptionResponse | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [suggestTitles, { isLoading: isSuggesting }] = useSuggestTitlesMutation();
  const [generateDescription, { isLoading: isGeneratingDesc }] =
    useGenerateDescriptionMutation();

  const handleSuggestTitles = useCallback(async () => {
    if (!description.trim()) return;

    try {
      const result = await suggestTitles({
        description,
        issueType,
        existingTitles: existingTitles.slice(0, 10),
        count: 3,
      }).unwrap();

      setSuggestions(result.suggestions);
    } catch (error) {
      console.error('Failed to suggest titles:', error);
    }
  }, [description, issueType, existingTitles, suggestTitles]);

  const handleGenerateDescription = useCallback(async () => {
    if (!selectedTitle.trim()) return;

    try {
      const result = await generateDescription({
        title: selectedTitle,
        issueType,
      }).unwrap();

      setGeneratedDescription(result);
      if (onDescriptionGenerated) {
        onDescriptionGenerated(result.description, result.suggestedAcceptanceCriteria);
      }
    } catch (error) {
      console.error('Failed to generate description:', error);
    }
  }, [selectedTitle, issueType, generateDescription, onDescriptionGenerated]);

  const handleSelectTitle = useCallback(
    (title: string) => {
      setSelectedTitle(title);
      if (onTitleSelect) {
        onTitleSelect(title);
      }
    },
    [onTitleSelect]
  );

  const handleCopy = useCallback(async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          AI Title & Description Generator
        </CardTitle>
        <CardDescription>
          Generate titles from descriptions or descriptions from titles
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Description to Title */}
        <div className="space-y-4 border rounded-lg p-4">
          <h3 className="font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Generate Title from Description
          </h3>

          <div className="space-y-2">
            <Label>Issue Type</Label>
            <Select value={issueType} onValueChange={setIssueType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe what this issue is about..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <Button
            onClick={handleSuggestTitles}
            disabled={!description.trim() || isSuggesting}
          >
            {isSuggesting ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Suggest Titles
          </Button>

          {/* Title Suggestions */}
          {suggestions.length > 0 && (
            <div className="space-y-3">
              <Label>Suggested Titles</Label>
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={`border rounded-md p-3 cursor-pointer transition-colors ${
                    selectedTitle === suggestion.title
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground'
                  }`}
                  onClick={() => handleSelectTitle(suggestion.title)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium">{suggestion.title}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {suggestion.reasoning}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span
                          className={`text-sm font-medium ${getConfidenceColor(
                            suggestion.confidence
                          )}`}
                        >
                          {Math.round(suggestion.confidence * 100)}%
                        </span>
                        <Progress
                          value={suggestion.confidence * 100}
                          className="w-16 h-1"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(suggestion.title, `title-${index}`);
                        }}
                      >
                        {copied === `title-${index}` ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Title to Description */}
        {selectedTitle && (
          <div className="space-y-4 border rounded-lg p-4">
            <h3 className="font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Generate Description from Title
            </h3>

            <div className="bg-muted/50 p-3 rounded-md">
              <Label className="text-xs text-muted-foreground">Selected Title</Label>
              <p className="font-medium">{selectedTitle}</p>
            </div>

            <Button
              onClick={handleGenerateDescription}
              disabled={!selectedTitle || isGeneratingDesc}
            >
              {isGeneratingDesc ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate Description
            </Button>

            {generatedDescription && (
              <div className="space-y-4">
                {/* Generated Description */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Generated Description</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleCopy(generatedDescription.description, 'description')
                      }
                    >
                      {copied === 'description' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="border rounded-md p-3 bg-muted/30">
                    <pre className="whitespace-pre-wrap text-sm">
                      {generatedDescription.description}
                    </pre>
                  </div>
                </div>

                {/* Acceptance Criteria */}
                {generatedDescription.suggestedAcceptanceCriteria.length > 0 && (
                  <div className="space-y-2">
                    <Label>Suggested Acceptance Criteria</Label>
                    <ul className="space-y-1">
                      {generatedDescription.suggestedAcceptanceCriteria.map(
                        (criteria, idx) => (
                          <li
                            key={idx}
                            className="text-sm flex items-start gap-2 p-2 bg-muted/30 rounded"
                          >
                            <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{criteria}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}

                {/* Suggested Labels */}
                {generatedDescription.suggestedLabels.length > 0 && (
                  <div className="space-y-2">
                    <Label>Suggested Labels</Label>
                    <div className="flex flex-wrap gap-2">
                      {generatedDescription.suggestedLabels.map((label, idx) => (
                        <Badge key={idx} variant="secondary">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Questions */}
                {generatedDescription.questions.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-yellow-600">Clarifying Questions</Label>
                    <ul className="space-y-1">
                      {generatedDescription.questions.map((question, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground">
                          - {question}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Related Topics */}
                {generatedDescription.relatedTopics.length > 0 && (
                  <div className="space-y-2">
                    <Label>Related Topics</Label>
                    <div className="flex flex-wrap gap-2">
                      {generatedDescription.relatedTopics.map((topic, idx) => (
                        <Badge key={idx} variant="outline">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AITitleSuggester;
