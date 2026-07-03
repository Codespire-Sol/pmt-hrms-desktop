import { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Play, AlertCircle, CheckCircle2, HelpCircle, ChevronDown } from 'lucide-react';
import { useLazyValidateJQLQuery } from '../searchApi';
import { JQL_FIELDS, JQL_OPERATORS, JQL_FUNCTIONS, JQL_KEYWORDS } from '../types';

interface JQLEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute?: () => void;
  placeholder?: string;
  className?: string;
  showExecuteButton?: boolean;
  autoValidate?: boolean;
  disabled?: boolean;
}

interface Suggestion {
  type: 'field' | 'operator' | 'function' | 'keyword' | 'value';
  value: string;
  description?: string;
}

export function JQLEditor({
  value,
  onChange,
  onExecute,
  placeholder = 'Enter JQL query...',
  className,
  showExecuteButton = true,
  autoValidate = true,
  disabled = false,
}: JQLEditorProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const [validateJQL, { data: validationResult, isFetching: isValidating }] = useLazyValidateJQLQuery();

  // Debounced validation
  useEffect(() => {
    if (!autoValidate || !value.trim()) return;

    const timer = setTimeout(() => {
      validateJQL(value);
    }, 500);

    return () => clearTimeout(timer);
  }, [value, autoValidate, validateJQL]);

  const getTokenAtCursor = useCallback((text: string, pos: number): { token: string; start: number } => {
    let start = pos;
    while (start > 0 && !/[\s(),]/.test(text[start - 1])) {
      start--;
    }
    return { token: text.slice(start, pos), start };
  }, []);

  const getContext = useCallback((text: string, pos: number): 'field' | 'operator' | 'value' | 'keyword' => {
    const beforeCursor = text.slice(0, pos).trim();
    const tokens = beforeCursor.split(/\s+/);
    const lastToken = tokens[tokens.length - 1]?.toLowerCase() || '';

    // If we're at the start or after AND/OR, expect a field
    if (!beforeCursor || ['and', 'or', '('].includes(lastToken)) {
      return 'field';
    }

    // If last token is a field name, expect operator
    const isField = JQL_FIELDS.some(f => f.name === lastToken);
    if (isField) {
      return 'operator';
    }

    // If last token is an operator, expect value
    const isOperator = JQL_OPERATORS.some(o => o.name.toLowerCase() === lastToken);
    if (isOperator) {
      return 'value';
    }

    // Check if we're after a value (could be AND/OR/ORDER BY)
    return 'keyword';
  }, []);

  const updateSuggestions = useCallback((text: string, pos: number) => {
    const { token } = getTokenAtCursor(text, pos);
    const context = getContext(text, pos);
    const searchTerm = token.toLowerCase();

    let newSuggestions: Suggestion[] = [];

    if (context === 'field') {
      newSuggestions = JQL_FIELDS
        .filter(f => f.name.toLowerCase().includes(searchTerm))
        .map(f => ({ type: 'field', value: f.name, description: f.description }));
    } else if (context === 'operator') {
      newSuggestions = JQL_OPERATORS
        .filter(o => o.name.toLowerCase().includes(searchTerm))
        .map(o => ({ type: 'operator', value: o.name, description: o.description }));
    } else if (context === 'value') {
      // Suggest functions for value context
      newSuggestions = JQL_FUNCTIONS
        .filter(f => f.name.toLowerCase().includes(searchTerm))
        .map(f => ({ type: 'function', value: f.name, description: f.description }));
    } else if (context === 'keyword') {
      newSuggestions = JQL_KEYWORDS
        .filter(k => k.toLowerCase().includes(searchTerm))
        .map(k => ({ type: 'keyword', value: k }));
    }

    setSuggestions(newSuggestions);
    setSelectedSuggestionIndex(0);
    setShowSuggestions(newSuggestions.length > 0 && isFocused);
  }, [getTokenAtCursor, getContext, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setCursorPosition(e.target.selectionStart || 0);
    updateSuggestions(newValue, e.target.selectionStart || 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => Math.min(prev + 1, suggestions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        applySuggestion(suggestions[selectedSuggestionIndex]);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        applySuggestion(suggestions[selectedSuggestionIndex]);
      }
    } else if (e.key === 'Enter' && e.ctrlKey && onExecute) {
      e.preventDefault();
      onExecute();
    }
  };

  const applySuggestion = (suggestion: Suggestion) => {
    if (!suggestion) return;

    const { start } = getTokenAtCursor(value, cursorPosition);
    const before = value.slice(0, start);
    const after = value.slice(cursorPosition);
    const newValue = before + suggestion.value + (suggestion.type !== 'keyword' ? ' ' : '') + after;

    onChange(newValue);
    setShowSuggestions(false);

    // Move cursor after inserted text
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = start + suggestion.value.length + 1;
        inputRef.current.selectionStart = newPos;
        inputRef.current.selectionEnd = newPos;
        inputRef.current.focus();
      }
    }, 0);
  };

  const handleFocus = () => {
    setIsFocused(true);
    updateSuggestions(value, cursorPosition);
  };

  const handleBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => {
      setIsFocused(false);
      setShowSuggestions(false);
    }, 200);
  };

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'relative flex items-start gap-2 rounded-md border bg-background transition-colors',
          isFocused && 'ring-2 ring-ring ring-offset-2',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'flex-1 min-h-[80px] resize-none bg-transparent py-2 pl-10 pr-24 text-sm font-mono',
            'placeholder:text-muted-foreground focus:outline-none',
            disabled && 'cursor-not-allowed'
          )}
          rows={3}
        />
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {/* Validation status */}
          {autoValidate && value.trim() && (
            <div className="flex items-center">
              {isValidating ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
              ) : validationResult?.valid ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <p className="text-sm text-destructive">{validationResult?.error}</p>
                    {validationResult?.errorPosition !== undefined && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Position: {validationResult.errorPosition}
                      </p>
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}

          {/* Help button */}
          <Popover open={showHelp} onOpenChange={setShowHelp}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <HelpCircle className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96" align="end">
              <JQLHelpContent />
            </PopoverContent>
          </Popover>

          {/* Execute button */}
          {showExecuteButton && onExecute && (
            <Button
              size="sm"
              onClick={onExecute}
              disabled={disabled || !value.trim() || (validationResult && !validationResult.valid)}
            >
              <Play className="h-4 w-4 mr-1" />
              Run
            </Button>
          )}
        </div>
      </div>

      {/* Autocomplete suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
        >
          <ScrollArea className="max-h-64">
            <div className="p-1">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.type}-${suggestion.value}`}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left',
                    'hover:bg-accent hover:text-accent-foreground',
                    index === selectedSuggestionIndex && 'bg-accent text-accent-foreground'
                  )}
                  onClick={() => applySuggestion(suggestion)}
                >
                  <Badge variant="outline" className="text-xs">
                    {suggestion.type}
                  </Badge>
                  <span className="font-mono">{suggestion.value}</span>
                  {suggestion.description && (
                    <span className="ml-auto text-xs text-muted-foreground truncate max-w-[200px]">
                      {suggestion.description}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function JQLHelpContent() {
  const [activeSection, setActiveSection] = useState<'fields' | 'operators' | 'functions'>('fields');

  return (
    <div className="space-y-3">
      <h4 className="font-semibold">JQL Help</h4>
      <p className="text-xs text-muted-foreground">
        Use JQL (Query Language) to search for issues. Press Tab to autocomplete.
      </p>

      <div className="flex gap-1">
        {(['fields', 'operators', 'functions'] as const).map((section) => (
          <Button
            key={section}
            variant={activeSection === section ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActiveSection(section)}
            className="text-xs capitalize"
          >
            {section}
          </Button>
        ))}
      </div>

      <ScrollArea className="h-48">
        {activeSection === 'fields' && (
          <div className="space-y-1">
            {JQL_FIELDS.slice(0, 15).map((field) => (
              <div key={field.name} className="flex items-center justify-between py-1">
                <code className="text-xs bg-muted px-1 rounded">{field.name}</code>
                <span className="text-xs text-muted-foreground">{field.type}</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-2">...and more</p>
          </div>
        )}

        {activeSection === 'operators' && (
          <div className="space-y-1">
            {JQL_OPERATORS.map((op) => (
              <div key={op.name} className="flex items-center justify-between py-1">
                <code className="text-xs bg-muted px-1 rounded">{op.name}</code>
                <span className="text-xs text-muted-foreground">{op.description}</span>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'functions' && (
          <div className="space-y-1">
            {JQL_FUNCTIONS.map((fn) => (
              <div key={fn.name} className="flex items-center justify-between py-1">
                <code className="text-xs bg-muted px-1 rounded">{fn.name}</code>
                <span className="text-xs text-muted-foreground truncate max-w-[150px]">{fn.description}</span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="pt-2 border-t">
        <p className="text-xs font-medium mb-1">Example queries:</p>
        <div className="space-y-1">
          <code className="block text-xs bg-muted p-1 rounded">assignee = currentUser()</code>
          <code className="block text-xs bg-muted p-1 rounded">status = "In Progress" AND priority = High</code>
          <code className="block text-xs bg-muted p-1 rounded">created &gt;= startOfWeek()</code>
        </div>
      </div>
    </div>
  );
}

export default JQLEditor;
