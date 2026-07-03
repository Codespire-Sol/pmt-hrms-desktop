import { useState } from 'react';
import { useIssueModal } from '../../issues/IssueDetailModal';
import { ChevronDown, ChevronRight, Calendar, User2, Plus } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../../../components/ui/collapsible';
import { cn } from '../../../lib/utils';
import type { BoardColumn } from '../boardsApi';
import type { Issue } from '../../issues/issuesApi';

interface BoardListViewProps {
  columns: BoardColumn[];
  projectId: string;
  onCreateIssue?: (statusId: string) => void;
}

interface IssueRowProps {
  issue: Issue;
  projectId: string;
}

function IssueRow({ issue, projectId }: IssueRowProps) {
  const { openIssue } = useIssueModal();
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const isOverdue = issue.dueDate && new Date(issue.dueDate) < new Date();

  return (
    <TableRow className="hover:bg-muted/50 cursor-pointer" onClick={() => openIssue(issue.id, projectId)}>
      <TableCell className="font-medium">
        <span className="text-primary hover:underline">
          {issue.issueKey}
        </span>
      </TableCell>
      <TableCell className="max-w-md">
        <span className="hover:text-primary transition-colors">
          {issue.title}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {issue.type?.displayName || issue.type?.name || 'Unknown'}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="text-xs"
          style={{
            backgroundColor: `${issue.priority?.color || '#9ca3af'}15`,
            borderColor: issue.priority?.color || '#9ca3af',
            color: issue.priority?.color || '#6b7280',
          }}
        >
          {issue.priority?.displayName || issue.priority?.name || 'None'}
        </Badge>
      </TableCell>
      <TableCell>
        {issue.assignee ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={issue.assignee.avatarUrl || undefined} />
              <AvatarFallback className="text-xs">
                {issue.assignee.displayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm truncate max-w-[100px]">
              {issue.assignee.displayName}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm flex items-center gap-1">
            <User2 className="h-3 w-3" />
            Unassigned
          </span>
        )}
      </TableCell>
      <TableCell>
        <span
          className={cn(
            'text-sm flex items-center gap-1',
            isOverdue && 'text-destructive'
          )}
        >
          <Calendar className="h-3 w-3" />
          {formatDate(issue.dueDate)}
        </span>
      </TableCell>
      <TableCell className="text-right text-sm text-muted-foreground">
        {issue.storyPoints ?? '-'}
      </TableCell>
    </TableRow>
  );
}

interface StatusGroupProps {
  column: BoardColumn;
  projectId: string;
  defaultOpen?: boolean;
  onCreateIssue?: (statusId: string) => void;
}

function StatusGroup({ column, projectId, defaultOpen = true, onCreateIssue }: StatusGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full py-3 px-4 hover:bg-muted/50 rounded-lg transition-colors">
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: column.color || '#6b7280' }}
        />
        <span className="font-medium">{column.name}</span>
        <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
          {column.issues.length}
        </Badge>
        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onCreateIssue?.(column.id);
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {column.issues.length > 0 ? (
          <div className="border rounded-lg overflow-hidden ml-6 mb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Key</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead className="w-[100px]">Priority</TableHead>
                  <TableHead className="w-[150px]">Assignee</TableHead>
                  <TableHead className="w-[100px]">Due Date</TableHead>
                  <TableHead className="w-[60px] text-right">Points</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {column.issues.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} projectId={projectId} />
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="ml-6 mb-4 py-8 border border-dashed rounded-lg text-center text-muted-foreground">
            No issues in this status
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function BoardListView({ columns, projectId, onCreateIssue }: BoardListViewProps) {
  const totalIssues = columns.reduce((sum, col) => sum + col.issues.length, 0);
  const { openIssue } = useIssueModal();

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground mb-4">
        {totalIssues} issue{totalIssues !== 1 ? 's' : ''} across {columns.length} statuses
      </div>
      {columns.map((column, index) => (
        <StatusGroup
          key={column.id}
          column={column}
          projectId={projectId}
          defaultOpen={index < 3}
          onCreateIssue={onCreateIssue}
        />
      ))}
    </div>
  );
}
