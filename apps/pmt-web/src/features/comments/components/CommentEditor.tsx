import { useState } from 'react';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { Button } from '@/components/ui/button';

interface CommentEditorProps {
  onSubmit: (content: string) => Promise<void>;
  placeholder?: string;
  initialValue?: string;
  onCancel?: () => void;
  submitLabel?: string;
  autoFocus?: boolean;
}

export function CommentEditor({
  onSubmit,
  placeholder = 'Add a comment… (supports rich text, tables, code blocks)',
  initialValue = '',
  onCancel,
  submitLabel = 'Comment',
  autoFocus = false,
}: CommentEditorProps) {
  const [html, setHtml] = useState(initialValue);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEmpty = !html || html === '<p></p>' || html.replace(/<[^>]+>/g, '').trim() === '';

  const handleSubmit = async () => {
    if (isEmpty) return;
    setIsSubmitting(true);
    try {
      await onSubmit(html);
      setHtml('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <RichTextEditor
        value={html}
        onChange={setHtml}
        placeholder={placeholder}
        editable
        minHeight={100}
        autoFocus={autoFocus}
        showToolbar
        compact
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Press Ctrl+Enter to submit
        </span>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} type="button">
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isEmpty || isSubmitting}
            type="button"
          >
            {isSubmitting ? 'Submitting…' : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
