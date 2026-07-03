import { useState } from 'react';
import {
  DndContext,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { Plus, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface Issue {
  id: string;
  issueKey?: string;
  title: string;
  statusId?: string;
  status?: { id: string };
  priority?: { name?: string; displayName?: string; color?: string };
  assignee?: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  type?: { name?: string; displayName?: string };
  storyPoints?: number;
}

interface Column {
  id: string;
  name: string;
  color?: string;
}

interface MobileKanbanBoardProps {
  columns: Column[];
  issues: Issue[];
  onIssueMove?: (issueId: string, newStatusId: string) => void;
  onIssueClick?: (issue: Issue) => void;
  onCreateClick?: (statusId: string) => void;
}

const priorityColors: Record<string, string> = {
  highest: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  lowest: 'bg-gray-400',
};

export function MobileKanbanBoard({
  columns,
  issues,
  onIssueMove,
  onIssueClick,
  onCreateClick,
}: MobileKanbanBoardProps) {
  const [activeColumnIndex, setActiveColumnIndex] = useState(0);
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  const activeColumn = columns[activeColumnIndex];
  const columnIssues = issues.filter((issue) => (issue.status?.id || issue.statusId) === activeColumn?.id);

  // Touch sensor with delay to differentiate from scroll
  const sensors = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const issue = issues.find((i) => i.id === event.active.id);
    setActiveIssue(issue || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveIssue(null);

    if (!event.over) return;

    const issueId = event.active.id as string;
    const newStatusId = event.over.id as string;

    if (newStatusId && onIssueMove) {
      onIssueMove(issueId, newStatusId);
    }
  };

  const goToNextColumn = () => {
    if (activeColumnIndex < columns.length - 1) {
      setActiveColumnIndex(activeColumnIndex + 1);
    }
  };

  const goToPreviousColumn = () => {
    if (activeColumnIndex > 0) {
      setActiveColumnIndex(activeColumnIndex - 1);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Column Tabs (Scrollable) */}
      <div className="flex items-center gap-2 px-4 py-3 border-b overflow-x-auto scrollbar-hide">
        {columns.map((column, index) => {
          const count = issues.filter((i) => i.statusId === column.id).length;
          const isActive = index === activeColumnIndex;

          return (
            <button
              key={column.id}
              onClick={() => setActiveColumnIndex(index)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              )}
            >
              {column.color && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: column.color }}
                />
              )}
              <span className="font-medium">{column.name}</span>
              <Badge
                variant={isActive ? 'secondary' : 'outline'}
                className="h-5 min-w-[20px]"
              >
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Column Navigation Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousColumn}
          disabled={activeColumnIndex === 0}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2">
          <span className="font-medium">{activeColumn?.name}</span>
          <span className="text-muted-foreground">
            ({columnIssues.length} issues)
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextColumn}
          disabled={activeColumnIndex === columns.length - 1}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Issues List */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {columnIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <p>No issues in this column</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => onCreateClick?.(activeColumn.id)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Issue
              </Button>
            </div>
          ) : (
            columnIssues.map((issue) => (
              <MobileIssueCard
                key={issue.id}
                issue={issue}
                onClick={() => onIssueClick?.(issue)}
              />
            ))
          )}
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeIssue && (
            <MobileIssueCard issue={activeIssue} isDragging />
          )}
        </DragOverlay>
      </DndContext>

      {/* Quick Add FAB */}
      <button
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform z-40"
        onClick={() => onCreateClick?.(activeColumn.id)}
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* Filter Sheet */}
      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed bottom-20 left-4 h-12 w-12 rounded-full shadow-lg z-40"
          >
            <Filter className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[60vh]">
          <SheetHeader>
            <SheetTitle>Filter Issues</SheetTitle>
          </SheetHeader>
          <div className="py-4">
            {/* Filter options would go here */}
            <p className="text-muted-foreground">Filter options coming soon</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Mobile Issue Card Component
interface MobileIssueCardProps {
  issue: Issue;
  onClick?: () => void;
  isDragging?: boolean;
}

function MobileIssueCard({ issue, onClick, isDragging }: MobileIssueCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: issue.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'p-4 bg-card rounded-lg border shadow-sm active:shadow-md transition-shadow',
        (isDragging || isSortableDragging) && 'opacity-50 shadow-lg',
        'touch-manipulation'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Issue Key and Type */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-muted-foreground">
              {issue.issueKey || ''}
            </span>
            <Badge variant="outline" className="text-xs">
              {issue.type?.displayName || issue.type?.name || 'Unknown'}
            </Badge>
          </div>

          {/* Title */}
          <h3 className="font-medium text-sm line-clamp-2">{issue.title}</h3>
        </div>

        {/* Priority Indicator */}
        <div
          className={cn(
            'w-1.5 h-8 rounded-full',
            priorityColors[issue.priority?.name || 'medium'] || 'bg-gray-400'
          )}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-2">
          {issue.storyPoints !== undefined && (
            <Badge variant="secondary" className="h-5 text-xs">
              {issue.storyPoints} pts
            </Badge>
          )}
        </div>

        {issue.assignee && (
          <Avatar className="h-6 w-6">
            <AvatarImage src={issue.assignee.avatarUrl} />
            <AvatarFallback className="text-xs">
              {issue.assignee.displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

export { MobileIssueCard };
export default MobileKanbanBoard;
