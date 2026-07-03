import { useIssueModal } from '../../issues/IssueDetailModal';
import { useFindSimilarIssuesQuery } from '../aiApi';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface SimilarIssuesAlertProps {
  title: string;
  description: string;
  projectId: string;
}

export function SimilarIssuesAlert({
  title,
  description,
  projectId,
}: SimilarIssuesAlertProps) {
  const { openIssue } = useIssueModal();
  const { data, isLoading, error } = useFindSimilarIssuesQuery(
    { title, description, projectId, limit: 3 },
    {
      skip: !title || title.length < 10 || !projectId,
    }
  );

  if (!title || title.length < 10) {
    return null;
  }

  if (isLoading) {
    return (
      <Alert className="mt-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle>Checking for similar issues...</AlertTitle>
      </Alert>
    );
  }

  if (error || !data || data.similarIssues.length === 0) {
    return null;
  }

  const highSimilarity = data.similarIssues.filter((i) => i.similarity >= 0.8);
  const isLikelyDuplicate = highSimilarity.length > 0;

  return (
    <Alert
      variant={isLikelyDuplicate ? 'destructive' : 'default'}
      className="mt-4"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {isLikelyDuplicate
          ? 'Potential duplicate detected!'
          : 'Similar issues found'}
      </AlertTitle>
      <AlertDescription>
        <div className="mt-2 space-y-2">
          {data.similarIssues.map((issue) => (
            <div
              key={issue.issueId}
              className="flex items-center justify-between p-2 bg-background rounded border"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {issue.issueKey}
                </Badge>
                <button
                  onClick={() => openIssue(issue.issueId, projectId)}
                  className="text-sm hover:underline bg-transparent border-0 p-0 cursor-pointer text-left"
                >
                  {issue.title}
                </button>
              </div>
              <Badge
                variant={issue.similarity >= 0.8 ? 'destructive' : 'secondary'}
              >
                {Math.round(issue.similarity * 100)}% similar
              </Badge>
            </div>
          ))}
        </div>
        {isLikelyDuplicate && (
          <p className="text-sm mt-3">
            Consider checking these issues before creating a new one.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
