import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Loader2,
  FileText,
  Folder,
  User,
  ArrowRight,
  Command,
} from 'lucide-react';
import { useLazyQuickSearchQuery } from '../searchApi';
import { SearchResult, SearchEntityType } from '../types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const typeIcons: Record<SearchEntityType, React.ReactNode> = {
  issue: <FileText className="h-4 w-4" />,
  project: <Folder className="h-4 w-4" />,
  user: <User className="h-4 w-4" />,
  comment: <FileText className="h-4 w-4" />,
};

const typeColors: Record<SearchEntityType, string> = {
  issue: 'text-blue-500',
  project: 'text-purple-500',
  user: 'text-green-500',
  comment: 'text-yellow-500',
};

interface SearchResultItemProps {
  result: SearchResult;
  isActive: boolean;
  onClick: () => void;
}

function SearchResultItem({ result, isActive, onClick }: SearchResultItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
        isActive ? 'bg-primary/10' : 'hover:bg-muted/50'
      )}
    >
      <div className={cn('flex-shrink-0', typeColors[result.type])}>
        {result.avatarUrl ? (
          <img
            src={result.avatarUrl}
            alt={result.title}
            className="w-8 h-8 rounded-full"
          />
        ) : (
          <div
            className={cn(
              'w-8 h-8 rounded flex items-center justify-center bg-muted',
              typeColors[result.type]
            )}
          >
            {typeIcons[result.type]}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{result.title}</span>
          {result.status && (
            <Badge
              variant="outline"
              style={{
                borderColor: result.statusColor || undefined,
                color: result.statusColor || undefined,
              }}
              className="text-[10px] px-1 py-0"
            >
              {result.status}
            </Badge>
          )}
        </div>
        {result.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
        )}
      </div>
      <ArrowRight
        className={cn(
          'h-4 w-4 flex-shrink-0 transition-opacity',
          isActive ? 'opacity-100' : 'opacity-0'
        )}
      />
    </button>
  );
}

interface GlobalSearchProps {
  onClose?: () => void;
}

export function GlobalSearch({ onClose }: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [triggerSearch, { data: results, isLoading, isFetching }] =
    useLazyQuickSearchQuery();

  // Debounced search
  useEffect(() => {
    if (query.length < 2) return;

    const timer = setTimeout(() => {
      triggerSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, triggerSearch]);

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    } else {
      setQuery('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Flatten results for navigation
  const allResults: SearchResult[] = results
    ? [...results.issues, ...results.projects, ...results.users]
    : [];

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, allResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && allResults[activeIndex]) {
        e.preventDefault();
        handleSelect(allResults[activeIndex]);
      }
    },
    [allResults, activeIndex]
  );

  const handleSelect = (result: SearchResult) => {
    navigate(result.url);
    setIsOpen(false);
    onClose?.();
  };

  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground border rounded-lg hover:bg-muted/50 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[15%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-xl z-50">
        <div className="bg-popover border rounded-lg shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search issues, projects, users..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
            {(isLoading || isFetching) && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <button onClick={handleClose}>
              <X className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {query.length < 2 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Type at least 2 characters to search
              </div>
            ) : isLoading && !results ? (
              <div className="px-4 py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : allResults.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No results found for "{query}"
              </div>
            ) : (
              <div className="py-2">
                {/* Issues */}
                {results?.issues && results.issues.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase">
                      Issues
                    </div>
                    {results.issues.map((result, index) => (
                      <SearchResultItem
                        key={result.id}
                        result={result}
                        isActive={index === activeIndex}
                        onClick={() => handleSelect(result)}
                      />
                    ))}
                  </div>
                )}

                {/* Projects */}
                {results?.projects && results.projects.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase">
                      Projects
                    </div>
                    {results.projects.map((result, index) => (
                      <SearchResultItem
                        key={result.id}
                        result={result}
                        isActive={
                          index + (results?.issues?.length || 0) === activeIndex
                        }
                        onClick={() => handleSelect(result)}
                      />
                    ))}
                  </div>
                )}

                {/* Users */}
                {results?.users && results.users.length > 0 && (
                  <div>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase">
                      Users
                    </div>
                    {results.users.map((result, index) => (
                      <SearchResultItem
                        key={result.id}
                        result={result}
                        isActive={
                          index +
                            (results?.issues?.length || 0) +
                            (results?.projects?.length || 0) ===
                          activeIndex
                        }
                        onClick={() => handleSelect(result)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↵</kbd>
                Select
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>
                Close
              </span>
            </div>
            {allResults.length > 0 && (
              <button
                onClick={() => {
                  navigate(`/search?q=${encodeURIComponent(query)}`);
                  handleClose();
                }}
                className="text-primary hover:underline"
              >
                View all results
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
