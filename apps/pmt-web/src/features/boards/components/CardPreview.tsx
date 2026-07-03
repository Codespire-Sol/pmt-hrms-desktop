import { useIssueModal } from '../../issues/IssueDetailModal';
import { Badge } from '../../../components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Separator } from '../../../components/ui/separator';
import {
  Calendar,
  Flag,
  User,
  Clock,
  Tag,
  FileText,
  ExternalLink,
  Bug,
  CheckCircle2,
  CheckSquare2,
  HelpCircle,
  AlertCircle,
  Zap,
  Play,
  Hexagon,
  Layers,
  BookOpen,
  GitCommit,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { Issue } from '../../issues/issuesApi';

interface CardPreviewProps {
  issue: Issue;
}

const ICON_MAP: Record<string, any> = {
  // Existing icon names
  Tag,
  Bug,
  CheckCircle2,
  CheckSquare2,
  HelpCircle,
  AlertCircle,
  Zap,
  Play,
  Hexagon,
  // New professional icons
  Layers,
  BookOpen,
  GitCommit,
  Sparkles,
  Wrench,
  // Type-name aliases
  Epic: Layers,
  Story: BookOpen,
  UserStory: BookOpen,
  Subtask: GitCommit,
  Task: CheckSquare2,
  Enhancement: Sparkles,
  Feature: Sparkles,
  Operations: Wrench,
  Ops: Wrench,
};

const getIcon = (iconName?: string, typeName?: string) => {
  if (iconName) {
    const byIcon = ICON_MAP[iconName];
    if (byIcon) return byIcon;
  }
  if (typeName) {
    const byType = ICON_MAP[typeName];
    if (byType) return byType;
  }
  return Tag;
};

export function CardPreview({ issue }: CardPreviewProps) {
  const { openIssue } = useIssueModal();
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'highest':
        return 'text-red-600 bg-red-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-blue-600 bg-blue-50';
      case 'lowest':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-400 bg-gray-50';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return formatDate(dateStr);
  };

  const truncateDescription = (desc?: string, maxLength = 150) => {
    if (!desc) return null;
    // Strip HTML tags if descriptionHtml is used
    const plainText = desc.replace(/<[^>]*>/g, '');
    if (plainText.length <= maxLength) return plainText;
    return plainText.substring(0, maxLength).trim() + '...';
  };

  return (
    <div className="space-y-3">
      {/* Header with issue key and type */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant="secondary"
            className="text-xs font-medium"
            style={{
              backgroundColor: `${issue.type?.color || '#94a3b8'}20`,
              color: issue.type?.color || '#475569',
              borderColor: issue.type?.color || '#94a3b8',
            }}
          >
            {(() => {
              const Icon = getIcon(issue.type?.icon, issue.type?.name);
              return <Icon className="mr-1 h-3 w-3" style={{ strokeWidth: 2.5 }} />;
            })()}
            {issue.type?.displayName || issue.type?.name || 'Unknown'}
          </Badge>
          <button
            onClick={() => openIssue(issue.id)}
            className="text-sm font-mono text-primary hover:underline flex items-center gap-1 bg-transparent border-0 p-0 cursor-pointer"
          >
            {issue.issueKey}
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>

        {issue.priority && (
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(issue.priority.name)}`}
          >
            <Flag className="h-3 w-3" />
            {issue.priority.displayName || issue.priority.name}
          </div>
        )}
      </div>

      {/* Title */}
      <h4 className="font-semibold text-sm leading-snug">{issue.title}</h4>

      {/* Description preview */}
      {issue.description && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <FileText className="h-3 w-3 mt-0.5 shrink-0" />
          <p className="line-clamp-2">
            {truncateDescription(issue.descriptionHtml || issue.description)}
          </p>
        </div>
      )}

      <Separator />

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Status */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Status:</span>
          <Badge
            variant="outline"
            className="text-xs"
            style={{
              backgroundColor: `${issue.status?.color || '#94a3b8'}20`,
              color: issue.status?.color || '#475569',
              borderColor: issue.status?.color || '#94a3b8',
            }}
          >
            {issue.status?.displayName || issue.status?.name || 'Unknown'}
          </Badge>
        </div>

        {/* Story Points */}
        {issue.storyPoints !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Points:</span>
            <Badge variant="secondary" className="text-xs">
              {issue.storyPoints} SP
            </Badge>
          </div>
        )}

        {/* Due Date */}
        {issue.dueDate && (
          <div className="flex items-center gap-2">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span
              className={
                new Date(issue.dueDate) < new Date()
                  ? 'text-red-600 font-medium'
                  : ''
              }
            >
              {formatDate(issue.dueDate)}
            </span>
          </div>
        )}

        {/* Updated */}
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{getRelativeTime(issue.updatedAt)}</span>
        </div>
      </div>

      {/* Labels */}
      {issue.labels && issue.labels.length > 0 && (
        <div className="flex items-start gap-2">
          <Tag className="h-3 w-3 text-muted-foreground mt-0.5" />
          <div className="flex flex-wrap gap-1">
            {issue.labels.slice(0, 4).map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                className="text-xs"
                style={{
                  backgroundColor: `${label.color}20`,
                  borderColor: label.color,
                  color: label.color,
                }}
              >
                {label.name}
              </Badge>
            ))}
            {issue.labels.length > 4 && (
              <Badge variant="secondary" className="text-xs">
                +{issue.labels.length - 4}
              </Badge>
            )}
          </div>
        </div>
      )}

      <Separator />

      {/* People */}
      <div className="flex items-center justify-between">
        {/* Assignee */}
        <div className="flex items-center gap-2">
          {issue.assignee ? (
            <>
              <Avatar className="h-5 w-5">
                <AvatarImage
                  src={issue.assignee.avatarUrl}
                  alt={issue.assignee.displayName}
                />
                <AvatarFallback className="text-[10px]">
                  {getInitials(issue.assignee.displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs">{issue.assignee.displayName}</span>
            </>
          ) : (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>Unassigned</span>
            </div>
          )}
        </div>

        {/* Reporter */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>by</span>
          <Avatar className="h-4 w-4">
            <AvatarImage
              src={issue.reporter?.avatarUrl}
              alt={issue.reporter?.displayName || 'Reporter'}
            />
            <AvatarFallback className="text-[8px]">
              {getInitials(issue.reporter?.displayName || 'R')}
            </AvatarFallback>
          </Avatar>
          <span>{issue.reporter?.displayName || 'Reporter'}</span>
        </div>
      </div>
    </div>
  );
}
