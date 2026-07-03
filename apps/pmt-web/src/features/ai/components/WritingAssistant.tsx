import { Wand2, Loader2 } from 'lucide-react';
import {
  useImproveTextMutation,
  useGenerateAcceptanceCriteriaMutation,
} from '../aiApi';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface WritingAssistantProps {
  text: string;
  onTextChange: (text: string) => void;
  type?: 'description' | 'comment';
  title?: string;
  disabled?: boolean;
}

const styleOptions = [
  { value: 'clearer' as const, label: 'Make clearer', description: 'Fix ambiguities and improve readability' },
  { value: 'concise' as const, label: 'Make concise', description: 'Remove unnecessary words' },
  { value: 'detailed' as const, label: 'Add detail', description: 'Expand on key points' },
  { value: 'professional' as const, label: 'Professional tone', description: 'Make more formal' },
];

export function WritingAssistant({
  text,
  onTextChange,
  type = 'description',
  title = '',
  disabled = false,
}: WritingAssistantProps) {
  const [improveText, { isLoading: isImproving }] = useImproveTextMutation();
  const [generateAC, { isLoading: isGeneratingAC }] =
    useGenerateAcceptanceCriteriaMutation();

  const isLoading = isImproving || isGeneratingAC;

  const handleImprove = async (style: 'clearer' | 'concise' | 'detailed' | 'professional') => {
    if (!text || text.length < 10) return;

    try {
      const result = await improveText({ text, style }).unwrap();
      onTextChange(result.improvedText);
    } catch (error) {
      console.error('Failed to improve text:', error);
    }
  };

  const handleGenerateAC = async () => {
    if (!text || text.length < 10) return;

    try {
      const result = await generateAC({
        title: title || 'Issue',
        description: text,
      }).unwrap();

      const criteriaText = result.criteria
        .map((c, i) => `${i + 1}. ${c}`)
        .join('\n');

      onTextChange(text + '\n\n## Acceptance Criteria\n' + criteriaText);
    } catch (error) {
      console.error('Failed to generate acceptance criteria:', error);
    }
  };

  const isDisabled = disabled || !text || text.length < 10 || isLoading;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={isDisabled}
          className="h-8 gap-1"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">AI Assist</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {styleOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleImprove(option.value)}
            disabled={isLoading}
          >
            <div>
              <div className="font-medium">{option.label}</div>
              <div className="text-xs text-muted-foreground">
                {option.description}
              </div>
            </div>
          </DropdownMenuItem>
        ))}

        {type === 'description' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleGenerateAC} disabled={isLoading}>
              <div>
                <div className="font-medium">Generate acceptance criteria</div>
                <div className="text-xs text-muted-foreground">
                  Add testable requirements
                </div>
              </div>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
