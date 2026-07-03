import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Search,
  Sparkles,
  Code,
  Copy,
  Check,
  RefreshCw,
  HelpCircle,
  AlertTriangle,
  ChevronDown,
  History,
  Lightbulb,
  X,
} from 'lucide-react';
import {
  useParseNLQueryMutation,
  useGetQueryCompletionsMutation,
  useExplainJQLMutation,
  useGetQueryExamplesQuery,
  useValidateJQLMutation,
  useGetSupportedJQLFieldsQuery,
} from '../aiApi';
import type { ParseQueryResponse, QueryClause } from '../types';

interface NaturalLanguageSearchProps {
  onSearch?: (jql: string, query: string) => void;
  projectId?: string;
  projectContext?: Record<string, unknown>;
  placeholder?: string;
}

interface SearchHistoryItem {
  query: string;
  jql: string;
  timestamp: number;
}

export function NaturalLanguageSearch({
  onSearch,
  projectId,
  projectContext,
  placeholder = 'Search issues... (e.g., "my open bugs" or "high priority this week")',
}: NaturalLanguageSearchProps) {
  const [query, setQuery] = useState('');
  const [parsedResult, setParsedResult] = useState<ParseQueryResponse | null>(null);
  const [jqlMode, setJqlMode] = useState(false);
  const [jql, setJql] = useState('');
  const [copied, setCopied] = useState(false);
  const [showCompletions, setShowCompletions] = useState(false);
  const [completions, setCompletions] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: examples } = useGetQueryExamplesQuery();
  const { data: fieldsInfo } = useGetSupportedJQLFieldsQuery();

  const [parseQuery, { isLoading: isParsing }] = useParseNLQueryMutation();
  const [getCompletions, { isLoading: isLoadingCompletions }] = useGetQueryCompletionsMutation();
  const [explainJQL, { isLoading: isExplaining }] = useExplainJQLMutation();
  const [validateJQL] = useValidateJQLMutation();

  // Load search history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('nlSearchHistory');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved).slice(0, 10));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Save search history
  const saveToHistory = useCallback((q: string, jqlResult: string) => {
    const newHistory = [
      { query: q, jql: jqlResult, timestamp: Date.now() },
      ...searchHistory.filter((h) => h.query !== q),
    ].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('nlSearchHistory', JSON.stringify(newHistory));
  }, [searchHistory]);

  // Fetch completions with debounce
  useEffect(() => {
    if (query.length < 3 || jqlMode) {
      setCompletions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const result = await getCompletions({
          partialQuery: query,
          projectContext,
        }).unwrap();
        setCompletions(result.completions);
        setShowCompletions(result.completions.length > 0);
      } catch {
        setCompletions([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, jqlMode, projectContext, getCompletions]);

  const handleSearch = useCallback(async () => {
    if (jqlMode) {
      // Direct JQL search
      if (onSearch && jql.trim()) {
        onSearch(jql, jql);
        saveToHistory(jql, jql);
      }
      return;
    }

    if (!query.trim()) return;

    try {
      const result = await parseQuery({
        query,
        projectId,
        projectContext,
      }).unwrap();

      setParsedResult(result);
      setJql(result.jql);

      if (onSearch && result.jql) {
        onSearch(result.jql, query);
        saveToHistory(query, result.jql);
      }
    } catch (error) {
      console.error('Failed to parse query:', error);
    }
  }, [query, jql, jqlMode, projectId, projectContext, parseQuery, onSearch, saveToHistory]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSearch();
        setShowCompletions(false);
      } else if (e.key === 'Escape') {
        setShowCompletions(false);
        setShowHistory(false);
      }
    },
    [handleSearch]
  );

  const handleSelectCompletion = useCallback((completion: string) => {
    setQuery(completion);
    setShowCompletions(false);
    inputRef.current?.focus();
  }, []);

  const handleSelectHistory = useCallback((item: SearchHistoryItem) => {
    setQuery(item.query);
    setJql(item.jql);
    setShowHistory(false);
    inputRef.current?.focus();
  }, []);

  const handleCopy = useCallback(async () => {
    if (parsedResult?.jql) {
      await navigator.clipboard.writeText(parsedResult.jql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [parsedResult]);

  const toggleJqlMode = useCallback(() => {
    setJqlMode(!jqlMode);
    if (!jqlMode && parsedResult?.jql) {
      setJql(parsedResult.jql);
    }
  }, [jqlMode, parsedResult]);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const renderClause = (clause: QueryClause, index: number) => {
    const value = Array.isArray(clause.value)
      ? clause.value.join(', ')
      : clause.value;

    return (
      <Badge key={index} variant="secondary" className="font-mono text-xs">
        {clause.field} {clause.operator} {clause.isFunction ? value : `"${value}"`}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Search className="h-5 w-5 text-purple-500" />
            Smart Search
          </span>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={jqlMode ? 'default' : 'outline'}
                    size="sm"
                    onClick={toggleJqlMode}
                  >
                    <Code className="h-4 w-4 mr-1" />
                    JQL
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {jqlMode ? 'Switch to natural language' : 'Switch to JQL mode'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-2">
                  <h4 className="font-medium">Search Examples</h4>
                  <ScrollArea className="h-48">
                    <div className="space-y-2">
                      {examples?.examples.slice(0, 10).map((ex, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded hover:bg-muted cursor-pointer"
                          onClick={() => {
                            setQuery(ex.naturalLanguage);
                            setJql(ex.jql);
                          }}
                        >
                          <p className="text-sm font-medium">{ex.naturalLanguage}</p>
                          <p className="text-xs text-muted-foreground font-mono">{ex.jql}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardTitle>
        <CardDescription>
          {jqlMode
            ? 'Enter JQL query directly'
            : 'Search using natural language - AI will convert to JQL'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              {jqlMode ? (
                <Input
                  ref={inputRef}
                  value={jql}
                  onChange={(e) => setJql(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder='status = "In Progress" AND assignee = currentUser()'
                  className="font-mono text-sm"
                />
              ) : (
                <Input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => query.length === 0 && setShowHistory(true)}
                  placeholder={placeholder}
                />
              )}

              {/* History Dropdown */}
              {showHistory && searchHistory.length > 0 && !jqlMode && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50">
                  <div className="p-2">
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <History className="h-4 w-4" />
                        Recent Searches
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setShowHistory(false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {searchHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded hover:bg-muted cursor-pointer"
                        onClick={() => handleSelectHistory(item)}
                      >
                        <p className="text-sm">{item.query}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completions Dropdown */}
              {showCompletions && completions.length > 0 && !jqlMode && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-50">
                  <div className="p-2">
                    <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" />
                      Suggestions
                    </div>
                    {completions.map((completion, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded hover:bg-muted cursor-pointer text-sm"
                        onClick={() => handleSelectCompletion(completion)}
                      >
                        {completion}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <Button onClick={handleSearch} disabled={isParsing || (!query.trim() && !jql.trim())}>
              {isParsing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Parsed Result */}
        {parsedResult && !jqlMode && (
          <div className="space-y-3 border rounded-lg p-4">
            {/* Confidence */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Confidence</span>
              <div className="flex items-center gap-2">
                <Progress
                  value={parsedResult.confidence * 100}
                  className="w-24 h-2"
                />
                <span
                  className={`text-sm font-medium ${getConfidenceColor(
                    parsedResult.confidence
                  )}`}
                >
                  {Math.round(parsedResult.confidence * 100)}%
                </span>
              </div>
            </div>

            {/* Interpretation */}
            <div>
              <Label className="text-xs text-muted-foreground">Interpretation</Label>
              <p className="text-sm">{parsedResult.interpretation}</p>
            </div>

            {/* JQL Result */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs text-muted-foreground">Generated JQL</Label>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="bg-muted/50 p-2 rounded font-mono text-sm overflow-x-auto">
                {parsedResult.jql}
              </div>
            </div>

            {/* Query Clauses */}
            {parsedResult.clauses.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Query Clauses</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {parsedResult.clauses.map((clause, idx) => renderClause(clause, idx))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {parsedResult.suggestions.length > 0 && parsedResult.confidence < 0.8 && (
              <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-950 rounded text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-700 dark:text-yellow-300">
                    Query may be ambiguous
                  </p>
                  <ul className="text-yellow-600 dark:text-yellow-400 mt-1">
                    {parsedResult.suggestions.map((suggestion, idx) => (
                      <li key={idx}>- {suggestion}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Examples */}
        {!parsedResult && !jqlMode && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Try these examples</Label>
            <div className="flex flex-wrap gap-2">
              {[
                'my open issues',
                'high priority bugs',
                'updated this week',
                'unassigned tasks',
              ].map((example) => (
                <Badge
                  key={example}
                  variant="outline"
                  className="cursor-pointer hover:bg-muted"
                  onClick={() => setQuery(example)}
                >
                  {example}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default NaturalLanguageSearch;
