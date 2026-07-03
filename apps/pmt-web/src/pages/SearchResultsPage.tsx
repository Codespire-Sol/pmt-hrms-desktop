import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Search,
  FileText,
  Folder,
  User,
  MessageSquare,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useSearchQuery } from '@/features/search';
import { SearchResult, SearchEntityType } from '@/features/search/types';
import { cn } from '@/lib/utils';

const typeIcons: Record<SearchEntityType, React.ReactNode> = {
  issue: <FileText className="h-5 w-5" />,
  project: <Folder className="h-5 w-5" />,
  user: <User className="h-5 w-5" />,
  comment: <MessageSquare className="h-5 w-5" />,
};

const typeColors: Record<SearchEntityType, string> = {
  issue: 'text-blue-500 bg-blue-500/10',
  project: 'text-purple-500 bg-purple-500/10',
  user: 'text-green-500 bg-green-500/10',
  comment: 'text-yellow-500 bg-yellow-500/10',
};

const typeLabels: Record<SearchEntityType, string> = {
  issue: 'Issue',
  project: 'Project',
  user: 'User',
  comment: 'Comment',
};

function SearchResultCard({ result }: { result: SearchResult }) {
  return (
    <Link to={result.url}>
      <Card className="hover:bg-muted/50 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                typeColors[result.type]
              )}
            >
              {result.avatarUrl ? (
                <img
                  src={result.avatarUrl}
                  alt={result.title}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                typeIcons[result.type]
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {typeLabels[result.type]}
                </Badge>
                {result.issueKey && (
                  <span className="text-xs font-medium text-muted-foreground">
                    {result.issueKey}
                  </span>
                )}
                {result.status && (
                  <Badge
                    variant="outline"
                    style={{
                      borderColor: result.statusColor || undefined,
                      color: result.statusColor || undefined,
                    }}
                    className="text-xs"
                  >
                    {result.status}
                  </Badge>
                )}
              </div>
              <h3 className="font-medium mt-1">{result.title}</h3>
              {result.subtitle && (
                <p className="text-sm text-muted-foreground">{result.subtitle}</p>
              )}
              {result.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {result.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                {result.projectKey && <span>{result.projectKey}</span>}
                <span>
                  Updated {formatDistanceToNow(new Date(result.updatedAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') || '';
  const typeFilter = searchParams.get('type') as SearchEntityType | 'all' | null;
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = 20;

  const [inputValue, setInputValue] = useState(query);

  const { data, isLoading, isFetching } = useSearchQuery(
    {
      query,
      filters: {
        types: typeFilter && typeFilter !== 'all' ? [typeFilter] : undefined,
      },
      limit,
      offset: (page - 1) * limit,
    },
    { skip: !query }
  );

  // Update input when URL changes
  useEffect(() => {
    setInputValue(query);
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      setSearchParams({ q: inputValue.trim(), page: '1' });
    }
  };

  const handleTypeChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === 'all') {
      params.delete('type');
    } else {
      params.set('type', value);
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 0;

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="h-6 w-6" />
          Search Results
        </h1>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search issues, projects, users..."
              className="pl-10"
            />
          </div>
          <Button type="submit">Search</Button>
        </div>
      </form>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter by:</span>
        </div>
        <Select
          value={typeFilter || 'all'}
          onValueChange={handleTypeChange}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="issue">Issues</SelectItem>
            <SelectItem value="project">Projects</SelectItem>
            <SelectItem value="user">Users</SelectItem>
            <SelectItem value="comment">Comments</SelectItem>
          </SelectContent>
        </Select>

        {data && (
          <span className="text-sm text-muted-foreground ml-auto">
            {data.total} result{data.total !== 1 ? 's' : ''} for "{query}"
          </span>
        )}
      </div>

      {/* Results */}
      {!query ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Enter a search term to find issues, projects, and more</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data?.results.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No results found</h3>
          <p>Try adjusting your search terms or filters</p>
        </div>
      ) : (
        <>
          {isFetching && (
            <div className="flex items-center justify-center py-2 mb-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          <div className="space-y-4">
            {data?.results.map((result) => (
              <SearchResultCard key={`${result.type}-${result.id}`} result={result} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground px-4">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={!data?.pagination.hasMore}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
