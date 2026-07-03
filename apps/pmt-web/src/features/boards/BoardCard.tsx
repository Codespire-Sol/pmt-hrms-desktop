import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Flag,
  MoreHorizontal,
  Tag,
  Bug,
  CheckCircle2,
  CheckSquare2,
  HelpCircle,
  AlertCircle,
  Zap,
  Play,
  Hexagon,
  Link2,
  CircleDot,
  Trash2,
  Archive,
  Copy,
  Tags,
  Layers,
  BookOpen,
  GitCommit,
  Sparkles,
  Wrench,
} from 'lucide-react';
import type { MenuProps } from 'antd';
import { Card, Typography, Badge, Avatar, Space, Tooltip, Popover, Dropdown, Button, Modal, message, Tag as AntTag } from 'antd';
import type { Issue } from '../issues/issuesApi';
import { useDeleteIssueMutation } from '../issues/issuesApi';
import { CardPreview } from './components/CardPreview';
import { QuickEditPopover } from './components/QuickEditPopover';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';
import { normalizeAvatarUrl } from '@/lib/utils';

const { Text } = Typography;

export interface BoardCardFieldVisibility {
  showWorkType: boolean;
  showIssueKey: boolean;
  showEpic: boolean;
  showDueDate: boolean;
  showLinkedItems: boolean;
  showAssignee: boolean;
  showPriority: boolean;
  showLabels: boolean;
  showStoryPoints: boolean;
}

interface BoardCardProps {
  issue: Issue;
  isDragging?: boolean;
  enablePreview?: boolean;
  projectId?: string;
  onQuickEdit?: () => void;
  canDrag?: boolean;
  fieldVisibility?: BoardCardFieldVisibility;
  isFlagged?: boolean;
  onToggleFlag?: (issueId: string) => void;
  onAddLabel?: (issue: Issue) => void;
  onLinkIssue?: (issue: Issue) => void;
  onClick?: (issue: Issue) => void;
}

const COLORS = {
  primary: '#0052cc',
  textPrimary: '#172b4d',
  textSecondary: '#6b778c',
  border: '#dfe1e6',
  cardBg: '#ffffff',
  cardBgFlagged: '#f0f4ff',
  danger: '#de350b',
};

const ICON_MAP: Record<string, any> = {
  // Existing icon names (stored as icon field in issue types)
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
  // Type-name aliases for ergonomic fallback resolution
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

const DEFAULT_FIELD_VISIBILITY: BoardCardFieldVisibility = {
  showWorkType: true,
  showIssueKey: true,
  showEpic: true,
  showDueDate: true,
  showLinkedItems: false,
  showAssignee: true,
  showPriority: true,
  showLabels: false,
  showStoryPoints: true,
};

export function BoardCard({
  issue,
  isDragging = false,
  enablePreview = true,
  projectId,
  onQuickEdit,
  canDrag = true,
  fieldVisibility,
  isFlagged = false,
  onToggleFlag,
  onAddLabel,
  onLinkIssue,
  onClick,
}: BoardCardProps) {
  const { hasPermission: canDeleteIssue } = usePermissionGuard('issues.delete');
  const [deleteIssue, { isLoading: isDeleting }] = useDeleteIssueMutation();

  const visibleFields = fieldVisibility || DEFAULT_FIELD_VISIBILITY;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isCurrentlyDragging,
  } = useSortable({
    id: issue.id,
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'highest':
        return '#de350b';
      case 'high':
        return '#ff5630';
      case 'medium':
        return '#ffab00';
      case 'low':
        return '#36b37e';
      case 'lowest':
        return '#4c8dff';
      default:
        return '#6b778c';
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getIcon = (iconName?: string, typeName?: string) => {
    if (iconName) {
      const byIcon = ICON_MAP[iconName];
      if (byIcon) return byIcon;
    }
    // Fallback: resolve by type name (e.g. "Epic" → Layers)
    if (typeName) {
      const byType = ICON_MAP[typeName];
      if (byType) return byType;
    }
    return Tag;
  };

  const copyIssueLink = async () => {
    try {
      const issueUrl = `${window.location.origin}/projects/${projectId}/issues/${issue.id}`;
      await navigator.clipboard.writeText(issueUrl);
      message.success('Issue link copied');
    } catch {
      message.error('Failed to copy link');
    }
  };

  const copyIssueKey = async () => {
    try {
      await navigator.clipboard.writeText(issue.issueKey);
      message.success('Issue key copied');
    } catch {
      message.error('Failed to copy key');
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete issue?',
      content: `This will permanently delete ${issue.issueKey}.`,
      okText: 'Delete',
      okButtonProps: { danger: true, loading: isDeleting },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteIssue(issue.id).unwrap();
          message.success('Issue deleted');
          onQuickEdit?.();
        } catch {
          message.error('Failed to delete issue');
        }
      },
    });
  };

  const actionItems: MenuProps['items'] = [
    {
      key: 'move',
      label: 'Move work item',
      icon: <CircleDot size={14} />,
      disabled: true,
    },
    {
      key: 'change-status',
      label: 'Change status',
      icon: <CircleDot size={14} />,
      disabled: true,
    },
    { type: 'divider' },
    {
      key: 'copy-link',
      label: 'Copy link',
      icon: <Copy size={14} />,
      onClick: copyIssueLink,
    },
    {
      key: 'copy-key',
      label: 'Copy key',
      icon: <Copy size={14} />,
      onClick: copyIssueKey,
    },
    {
      key: 'flag',
      label: isFlagged ? 'Remove flag' : 'Add flag',
      icon: <Flag size={14} color={isFlagged ? '#f97316' : undefined} />,
      onClick: () => onToggleFlag?.(issue.id),
    },
    {
      key: 'add-label',
      label: 'Add label',
      icon: <Tags size={14} />,
      onClick: () => {
        if (onAddLabel) {
          onAddLabel(issue);
          return;
        }
        message.info('Label action can be connected to your labels modal.');
      },
    },
    {
      key: 'link-work-item',
      label: 'Link work item',
      icon: <Link2 size={14} />,
      onClick: () => {
        if (onLinkIssue) {
          onLinkIssue(issue);
          return;
        }
        message.info('Link action can be connected to issue linking dialog.');
      },
    },
    {
      key: 'archive',
      label: 'Archive',
      icon: <Archive size={14} />,
      onClick: () => message.info('Archive action can be connected when endpoint is available.'),
    },
    ...(canDeleteIssue
      ? [
        {
          key: 'delete',
          label: 'Delete',
          icon: <Trash2 size={14} />,
          danger: true,
          onClick: handleDelete,
        },
      ]
      : []),
  ];

  const TypeIcon = getIcon(issue.type?.icon, issue.type?.name);

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        opacity: isCurrentlyDragging || isDragging ? 0.45 : 1,
        cursor: !canDrag ? 'default' : isCurrentlyDragging || isDragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      {...(canDrag ? listeners : {})}
      {...(canDrag ? attributes : {})}
    >
      <Card
        style={{
          borderRadius: 8,
          border: `1px solid ${isFlagged ? '#ff8f1f' : COLORS.border}`,
          boxShadow: isFlagged ? '0 4px 14px rgba(255, 143, 31, 0.15)' : 'none',
          backgroundColor: isFlagged ? '#fff9f2' : COLORS.cardBg,
          transition: 'all 0.2s cubic-bezier(0.2, 0, 0, 1)',
        }}
        bodyStyle={{ padding: '12px' }}
        className="jira-kanban-card group"
        onClick={() => onClick?.(issue)}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div
            style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
          >
            <Text
              strong
              style={{
                fontSize: '14px',
                lineHeight: '1.4',
                color: COLORS.textPrimary,
                display: 'block',
                fontWeight: 500,
              }}
            >
              {issue.title}
            </Text>
          </div>

          <div
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {projectId && (
              <QuickEditPopover issue={issue} projectId={projectId} onUpdate={onQuickEdit} />
            )}
            <Dropdown
              trigger={['click']}
              menu={{ items: actionItems }}
              placement="bottomRight"
              overlayStyle={{ minWidth: 200 }}
            >
              <Button
                type="text"
                size="small"
                icon={<MoreHorizontal size={14} color={COLORS.textSecondary} />}
                style={{ width: 24, height: 24, color: COLORS.textSecondary }}
              />
            </Dropdown>
          </div>
        </div>

        {/* Epic tag */}
        {visibleFields.showEpic && (issue as any).epic && (
          <div style={{ marginTop: 6 }}>
            <AntTag
              style={{
                fontSize: 10,
                padding: '0 5px',
                borderRadius: 3,
                margin: 0,
                lineHeight: '16px',
                height: 16,
                backgroundColor: `${(issue as any).epic.color || '#6366f1'}22`,
                borderColor: `${(issue as any).epic.color || '#6366f1'}66`,
                color: (issue as any).epic.color || '#6366f1',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
              }}
            >
              {(issue as any).epic.name}
            </AntTag>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <TypeIcon size={14} color={issue.type.color || COLORS.primary} strokeWidth={2.5} />
              <Text
                style={{
                  fontSize: '12px',
                  color: COLORS.textSecondary,
                  fontWeight: 600,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                }}
              >
                {issue.issueKey}
              </Text>
            </div>

            {visibleFields.showPriority && issue.priority && (
              <Tooltip title={issue.priority.displayName || issue.priority.name}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: getPriorityColor(issue.priority.name),
                  flexShrink: 0,
                }} />
              </Tooltip>
            )}

            {isFlagged && (
              <Tooltip title="Flagged">
                <Flag size={12} color="#ff8f1f" fill="#ff8f1f" />
              </Tooltip>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {visibleFields.showStoryPoints && issue.storyPoints != null && (
              <Badge
                count={`${issue.storyPoints}`}
                style={{
                  backgroundColor: '#dfe1e6',
                  color: '#172b4d',
                  fontSize: '11px',
                  fontWeight: 700,
                  boxShadow: 'none',
                  borderRadius: '10px',
                  minWidth: '20px',
                  height: '20px',
                  lineHeight: '20px',
                  padding: '0 6px',
                  border: 'none',
                }}
              />
            )}

            {visibleFields.showAssignee && issue.assignee && (
              <Tooltip title={issue.assignee.displayName}>
                <Avatar
                  size={24}
                  src={normalizeAvatarUrl(issue.assignee.avatarUrl)}
                  style={{ backgroundColor: COLORS.primary, border: 'none' }}
                >
                  {getInitials(issue.assignee.displayName)}
                </Avatar>
              </Tooltip>
            )}
          </div>
        </div>
      </Card>
      <style>{`
        .jira-kanban-card {
          cursor: pointer !important;
        }
        .jira-kanban-card:hover {
          border-color: ${COLORS.border} !important;
          background-color: #ebecf0 !important;
          box-shadow: 0 1px 1px rgba(9, 30, 66, 0.25), 0 0 1px 0 rgba(9, 30, 66, 0.31) !important;
        }
      `}</style>
    </div>
  );
}
