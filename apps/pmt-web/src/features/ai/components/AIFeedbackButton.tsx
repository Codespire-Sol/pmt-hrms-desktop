import { useState } from 'react';
import { useRecordFeedbackMutation } from '../aiApi';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { ThumbsUp, ThumbsDown, Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIFeedbackButtonProps {
  suggestionType: string;
  suggestionId: string;
  onFeedbackSubmitted?: (accepted: boolean) => void;
  showRating?: boolean;
  size?: 'sm' | 'md';
}

export function AIFeedbackButton({
  suggestionType,
  suggestionId,
  onFeedbackSubmitted,
  showRating = true,
  size = 'sm',
}: AIFeedbackButtonProps) {
  const [recordFeedback, { isLoading }] = useRecordFeedbackMutation();
  const [isOpen, setIsOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [feedbackGiven, setFeedbackGiven] = useState<'accepted' | 'rejected' | null>(null);

  const handleFeedback = async (accepted: boolean) => {
    try {
      await recordFeedback({
        suggestionType,
        suggestionId,
        accepted,
        rating: rating ?? undefined,
        comment: comment || undefined,
      }).unwrap();

      setFeedbackGiven(accepted ? 'accepted' : 'rejected');
      setIsOpen(false);
      onFeedbackSubmitted?.(accepted);
    } catch (error) {
      console.error('Failed to record feedback:', error);
    }
  };

  const buttonSize = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  if (feedbackGiven) {
    return (
      <div className="flex items-center gap-1">
        {feedbackGiven === 'accepted' ? (
          <ThumbsUp className={cn(iconSize, 'text-green-600')} />
        ) : (
          <ThumbsDown className={cn(iconSize, 'text-red-600')} />
        )}
        <span className="text-xs text-muted-foreground">Thanks!</span>
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <div className="flex gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className={cn(buttonSize, 'hover:bg-green-50')}
            onClick={(e) => {
              e.stopPropagation();
              handleFeedback(true);
            }}
            disabled={isLoading}
            title="This was helpful"
          >
            {isLoading ? (
              <Loader2 className={cn(iconSize, 'animate-spin')} />
            ) : (
              <ThumbsUp className={cn(iconSize, 'text-muted-foreground hover:text-green-600')} />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={cn(buttonSize, 'hover:bg-red-50')}
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }}
            disabled={isLoading}
            title="This wasn't helpful"
          >
            <ThumbsDown className={cn(iconSize, 'text-muted-foreground hover:text-red-600')} />
          </Button>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-sm">Help us improve</h4>
            <p className="text-xs text-muted-foreground">
              What could be better about this suggestion?
            </p>
          </div>

          {showRating && (
            <div>
              <label className="text-xs text-muted-foreground">Rating</label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button
                    key={value}
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => setRating(value)}
                  >
                    <Star
                      className={cn(
                        'h-4 w-4',
                        rating && value <= rating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground'
                      )}
                    />
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground">
              Comments (optional)
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us how we can do better..."
              className="mt-1 h-20 resize-none text-sm"
              maxLength={500}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleFeedback(false)}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Submit Feedback
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
