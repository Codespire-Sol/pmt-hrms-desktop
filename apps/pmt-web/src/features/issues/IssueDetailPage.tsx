import { useMemo, useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useIssueModal } from './IssueDetailModal';
import {
  ArrowLeft,
  Trash2,
  MoreHorizontal,
  Share2,
  Eye,
  Copy,
  Plus,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Settings,
  AlertCircle,
  Download,
  Tag,
  X,
  Paperclip,
  ExternalLink,
  Clock,
  Calendar,
  User,
  Layers,
  Flag,
  Hash,
  GitBranch,
  GitCommit,
  ChevronDown,
  ChevronUp,
  Zap,
  RotateCw,
} from 'lucide-react';
import {
  useGetIssueQuery,
  useUpdateIssueMutation,
  useDeleteIssueMutation,
  useCloneIssueMutation,
  useMoveIssuesMutation,
  useCreateSubtaskMutation,
  useAddWatcherMutation,
  useRemoveWatcherMutation,
} from './issuesApi';
import { useGetProjectContextQuery, useGetProjectsQuery } from '@/features/projects/projectsApi';
import { useGetBoardQuery } from '@/features/boards/boardsApi';
import { useCreateLabelMutation } from '@/features/labels/labelsApi';
import { CommentsList } from '@/features/comments/components/CommentsList';
import { useGetActivityQuery } from '@/features/comments/commentsApi';
import { AttachmentList } from '@/features/attachments/components/AttachmentList';
import { FileUpload } from '@/features/attachments/components/FileUpload';
import { IssueLinksList } from './components/IssueLinksList';
import { LogTimeDialog } from '@/features/time-tracking/components/LogTimeDialog';
import { TimeLogList } from '@/features/time-tracking/components/TimeLogList';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { CodeActivity } from '@/features/integrations/github/components/CodeActivity';
import { useGetRepositoryStatusQuery, useCreateBranchMutation as useCreateGitHubBranchMutation } from '@/features/integrations/github/githubApi';
import { useGetRepositoryStatusQuery as useGetGitLabRepositoryStatusQuery, useCreateBranchMutation as useCreateGitLabBranchMutation } from '@/features/integrations/gitlab/gitlabApi';
import { formatDistanceToNow } from 'date-fns';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';
import { normalizeAvatarUrl } from '@/lib/utils';
import {
  Typography,
  Button,
  Space,
  Skeleton,
  Empty,
  Tabs,
  Tag as AntTag,
  Select,
  Input,
  Divider,
  Avatar,
  Dropdown,
  Modal,
  message as antMessage,
  Tooltip,
  DatePicker,
  Popover,
  type MenuProps,
} from 'antd';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ─── Design tokens ────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#1268ff',
  success: '#10b981',
  warning: '#faad14',
  danger: '#ff4d4f',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  bgHover: '#f4f5f7',
  bgLight: '#f9fafb',
  shadow: '0 8px 16px rgba(16, 24, 40, 0.06)',
};

const isUuid = (v?: string | null) =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatActivityValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (['string', 'number', 'boolean'].includes(typeof value)) return String(value);
  if (Array.isArray(value)) return value.map(formatActivityValue).filter(Boolean).join(', ');
  if (typeof value === 'object')
    return value.displayName || value.name || value.title || value.id || JSON.stringify(value);
  return String(value);
};

const LABEL_COLORS = [
  '#6b7280','#ef4444','#f97316','#eab308','#22c55e',
  '#14b8a6','#3b82f6','#8b5cf6','#ec4899','#06b6d4',
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Activity / history feed */
const ActivityList = ({ activities, initialLimit = 3, pageSize = 10 }: { activities: any[]; initialLimit?: number; pageSize?: number }) => {
  const [visibleCount, setVisibleCount] = useState(initialLimit);
  if (!activities?.length)
    return <Text type="secondary" style={{ fontSize: 13, padding: 16, display: 'block' }}>No history yet.</Text>;
  const visible = activities.slice(0, visibleCount);
  const remaining = activities.length - visibleCount;
  const nextLoad = Math.min(remaining, pageSize);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {visible.map((e: any) => (
        <div key={e.id} style={{ display: 'flex', gap: 12 }}>
          <Avatar size={24} src={normalizeAvatarUrl(e.user?.avatarUrl)} style={{ backgroundColor: COLORS.primary, flexShrink: 0 }}>
            {e.user?.displayName?.charAt(0).toUpperCase()}
          </Avatar>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <Text strong style={{ fontSize: 13 }}>{e.user?.displayName}</Text>
              <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>{e.action?.replace(/_/g, ' ')}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                · {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
              </Text>
            </div>
            {(e.oldValue !== undefined || e.newValue !== undefined) && (
              <div style={{ marginTop: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                {e.oldValue ? <Text delete style={{ color: COLORS.textSecondary }}>{formatActivityValue(e.oldValue)}</Text> : null}
                {e.oldValue && e.newValue ? <Text type="secondary">→</Text> : null}
                {e.newValue ? <Text strong>{formatActivityValue(e.newValue)}</Text> : null}
              </div>
            )}
          </div>
        </div>
      ))}
      {remaining > 0 && (
        <Button type="link" size="small" style={{ padding: 0, height: 'auto', fontSize: 13 }}
          onClick={() => setVisibleCount((c) => c + pageSize)}>
          View {nextLoad} more ({remaining} remaining)
        </Button>
      )}
    </div>
  );
};

/** Sidebar field row */
const SidebarField = ({
  label, children, icon, editable = true, COLORS: C,
}: {
  label: string; children: React.ReactNode; icon?: React.ReactNode; editable?: boolean; COLORS: typeof COLORS;
}) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '130px 1fr',
        alignItems: 'center',
        padding: '6px 8px',
        borderRadius: 6,
        transition: 'background 0.15s',
        backgroundColor: hovered && editable ? C.bgHover : 'transparent',
        minHeight: 36,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon && <span style={{ color: C.textSecondary, flexShrink: 0 }}>{icon}</span>}
        <Text style={{ fontSize: 13, color: C.textSecondary, fontWeight: 500 }}>{label}</Text>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>{children}</div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
export function IssueDetailPage({
  projectId: propProjectId,
  issueId: propIssueId,
  onBack,
}: {
  projectId?: string;
  issueId?: string;
  onBack?: () => void;
}) {
  const params = useParams<{ projectId: string; issueId: string }>();
  const projectId = propProjectId || params.projectId!;
  const issueId = propIssueId || params.issueId!;
  const navigate = useNavigate();
  const location = useLocation();
  const isFullPage = /\/projects\/[^/]+\/issues\/[^/]+/.test(location.pathname);
  const { openIssue, closeIssue } = useIssueModal();

  // ── UI state ────────────────────────────────────────────────────────────────
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editedDesc, setEditedDesc] = useState('');
  // Debounce ref for description auto-save (avoids API call on every keystroke)
  const descSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [attachRefreshKey, setAttachRefreshKey] = useState(0);
  const [isLogTimeOpen, setIsLogTimeOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveTargetProjectId, setMoveTargetProjectId] = useState('');
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  // label creator state
  const [labelPopoverOpen, setLabelPopoverOpen] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6b7280');
  // optimistic label selection — holds the user's selection until server data arrives
  const [localLabelIds, setLocalLabelIds] = useState<string[] | null>(null);
  // field visibility (settings popover)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fieldVisibility, setFieldVisibility] = useState({
    assignee: true, priority: true, dueDate: true, startDate: true,
    labels: true, sprint: true, storyPoints: true, reporter: true,
  });
  const toggleField = (key: keyof typeof fieldVisibility) =>
    setFieldVisibility((prev) => ({ ...prev, [key]: !prev[key] }));

  // ── Permissions ─────────────────────────────────────────────────────────────
  const { hasPermission: canUpdateIssue } = usePermissionGuard(['issues.update'], 'any');
  const { hasPermission: canUpdateOwnIssue } = usePermissionGuard(['issues.update_own'], 'any');
  const { hasPermission: canAssignIssue } = usePermissionGuard(['issues.assign'], 'any');
  const { hasPermission: canDeleteIssue } = usePermissionGuard('issues.delete');
  const { hasPermission: canLogTime } = usePermissionGuard('time.log');
  const { hasPermission: canViewIssues } = usePermissionGuard(
    ['issues.read','issues.create','issues.update','issues.update_own','issues.delete','issues.assign'], 'any'
  );
  const canUpdateDesc = canUpdateIssue;
  const canReassign = canAssignIssue || canUpdateIssue;

  // ── Data queries ─────────────────────────────────────────────────────────────
  const { data: issue, isLoading, error } = useGetIssueQuery({
    issueId: issueId!,
    include: ['subtaskProgress', 'attachments', 'timeLogs'],
  });
  const { data: boardData } = useGetBoardQuery({ projectId }, { skip: !projectId });
  const { data: activityData } = useGetActivityQuery({ issueId: issueId!, page: 1, limit: 100 }, { skip: !issueId });
  // Consolidated project reference data (members, labels, versions, epics, workflow)
  const { data: projectContext } = useGetProjectContextQuery(projectId!, { skip: !projectId });
  const membersData = projectContext?.members;
  const versionsData = projectContext?.versions;
  const epicsData = projectContext?.epics;
  const projectLabels = projectContext?.labels || [];
  const projectWorkflow = projectContext?.workflow;
  // Subtasks, watchers, subtaskProgress, attachments, timeLogs are embedded in the issue response
  const subtasks = issue?.children || [];
  const subtaskProgress = issue?.subtaskProgress;
  const watchersData = issue?.watchers;
  const { data: projectsData } = useGetProjectsQuery({});
  const { data: githubStatus } = useGetRepositoryStatusQuery(projectId!, { skip: !projectId });
  const { data: gitlabStatus } = useGetGitLabRepositoryStatusQuery(projectId!, { skip: !projectId });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const [updateIssue, { isLoading: isUpdating }] = useUpdateIssueMutation();
  const [deleteIssue, { isLoading: isDeleting }] = useDeleteIssueMutation();
  const [cloneIssue] = useCloneIssueMutation();
  const [moveIssues] = useMoveIssuesMutation();
  const [createSubtask, { isLoading: isCreatingSubtask }] = useCreateSubtaskMutation();
  const [addWatcher] = useAddWatcherMutation();
  const [removeWatcher] = useRemoveWatcherMutation();
  const [createLabel, { isLoading: isCreatingLabel }] = useCreateLabelMutation();
  const [createGitHubBranch, { isLoading: isCreatingGHBranch }] = useCreateGitHubBranchMutation();
  const [createGitLabBranch, { isLoading: isCreatingGLBranch }] = useCreateGitLabBranchMutation();

  const epicOptions = useMemo(() => {
    return (epicsData || []).map(ep => ({
      id: ep.id, name: ep.name, color: ep.color,
    }));
  }, [epicsData]);

  // ── Development panel state ──────────────────────────────────────────────────
  const [devExpanded, setDevExpanded] = useState<'branch' | 'commit' | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchRef, setNewBranchRef] = useState('main');

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleCreateBranch = async () => {
    if (!issue || !newBranchName.trim()) return;
    const name = newBranchName.trim();
    const ref = newBranchRef.trim() || 'main';
    try {
      if (githubStatus?.connected && githubStatus.repository?.id) {
        await createGitHubBranch({
          repositoryId: githubStatus.repository.id,
          data: { issueId: issue.id, branchName: name },
        }).unwrap();
      } else if (gitlabStatus?.connected) {
        await createGitLabBranch({ projectId, name, ref, issueId: issue.id }).unwrap();
      }
      antMessage.success(`Branch "${name}" created`);
      setDevExpanded(null);
      setNewBranchName('');
      setNewBranchRef('main');
    } catch (err: any) {
      antMessage.error(err?.data?.error?.message || 'Failed to create branch');
    }
  };

  const patch = async (data: Record<string, any>, successMsg?: string) => {
    if (!issue) return;
    try {
      await updateIssue({ issueId: issue.id, data }).unwrap();
      if (successMsg) antMessage.success(successMsg);
    } catch {
      antMessage.error('Update failed');
    }
  };

  const handleDescSave = async () => {
    await patch({ description: editedDesc }, 'Description updated');
    setIsEditingDesc(false);
  };

  const handleCreateSubtask = async () => {
    if (!newSubtaskTitle.trim() || !issue) return;
    try {
      await createSubtask({ issueId: issue.id, data: { title: newSubtaskTitle } }).unwrap();
      setNewSubtaskTitle(''); setIsAddingSubtask(false);
      antMessage.success('Subtask created');
    } catch { antMessage.error('Failed to create subtask'); }
  };

  const handleClone = async () => {
    if (!issue) return;
    try {
      const cloned = await cloneIssue(issue.id).unwrap();
      antMessage.success('Issue cloned');
      navigate(`/projects/${cloned.projectId}/issues/${cloned.id}`);
    } catch { antMessage.error('Failed to clone'); }
  };

  const handleMove = async () => {
    if (!issue || !moveTargetProjectId) return;
    try {
      await moveIssues({ issueIds: [issue.id], targetProjectId: moveTargetProjectId }).unwrap();
      antMessage.success('Issue moved');
      setShowMoveModal(false);
      navigate(`/projects/${moveTargetProjectId}/issues`);
    } catch { antMessage.error('Failed to move'); }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete Issue',
      icon: <AlertCircle color={COLORS.danger} style={{ marginRight: 12 }} />,
      content: 'This action cannot be undone.',
      okText: 'Delete', okType: 'danger', cancelText: 'Cancel',
      okButtonProps: { loading: isDeleting },
      onOk: async () => {
        try {
          await deleteIssue(issueId!).unwrap();
          antMessage.success('Issue deleted');
          navigate(`/projects/${projectId}/issues`);
        } catch { antMessage.error('Failed to delete'); }
      },
    });
  };

  const isWatching = watchersData?.isWatching ?? false;
  const watcherCount = watchersData?.watcherCount ?? issue?.watcherCount ?? 0;
  const watchersList: any[] = watchersData?.watchers ?? [];

  const handleToggleWatch = async () => {
    if (!issue) return;
    try {
      if (isWatching) { await removeWatcher({ issueId: issue.id }).unwrap(); antMessage.success('Unwatched'); }
      else { await addWatcher({ issueId: issue.id }).unwrap(); antMessage.success('Watching'); }
    } catch { antMessage.error('Failed'); }
  };

  const handleExport = () => {
    if (!issue) return;
    const lines = [
      `Issue: ${issue.issueKey}`,
      `Title: ${issue.title}`,
      `Status: ${issue.status?.displayName}`,
      `Priority: ${issue.priority?.displayName || 'None'}`,
      `Assignee: ${issue.assignee?.displayName || 'Unassigned'}`,
      `Reporter: ${issue.reporter?.displayName}`,
      `Sprint: ${issue.sprint?.name || 'None'}`,
      `Epic: ${issue.epic?.name || 'None'}`,
      `Story Points: ${issue.storyPoints ?? 'None'}`,
      `Due Date: ${issue.dueDate ? new Date(issue.dueDate).toLocaleDateString() : 'None'}`,
      `Start Date: ${issue.startDate ? new Date(issue.startDate).toLocaleDateString() : 'None'}`,
      `Labels: ${issue.labels?.map(l => l.name).join(', ') || 'None'}`,
      ``,
      `Description:`,
      issue.description || '(no description)',
      ``,
      `Created: ${new Date(issue.createdAt).toLocaleString()}`,
      `Updated: ${new Date(issue.updatedAt).toLocaleString()}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${issue.issueKey}.txt`; a.click();
    URL.revokeObjectURL(url);
    antMessage.success('Issue exported');
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    try {
      const label = await createLabel({ projectId, name: newLabelName.trim(), color: newLabelColor }).unwrap();
      const currentIds = (issue?.labels || []).map((l: any) => l.id);
      await patch({ labels: [...currentIds, label.id] });
      setNewLabelName(''); setNewLabelColor('#6b7280'); setLabelPopoverOpen(false);
      antMessage.success('Label created & added');
    } catch (e: any) {
      antMessage.error(e?.data?.message || 'Failed to create label');
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────────
  // Prefer workflow statuses as the canonical list; fall back to board columns
  const workflowStatuses = projectWorkflow?.statuses || [];
  const boardStatuses = (boardData as any)?.columns || (boardData as any)?.filters?.statuses || [];
  // Always use actual board columns for the status sidebar dropdown
  const boardColumnStatuses = useMemo(() => {
    const cols = boardStatuses.map((s: any) => ({ id: s.id, displayName: s.displayName || s.name, color: s.color || '#6b7280' }));
    // If the issue's current status isn't in board columns, prepend it so the Select shows its name
    if (issue?.status && !cols.some((c: any) => c.id === issue.status.id)) {
      cols.unshift({ id: issue.status.id, displayName: issue.status.name || issue.status.displayName || issue.status.id, color: issue.status.color || '#6b7280' });
    }
    return cols;
  }, [boardStatuses, issue?.status]);
  const allStatusOptions = workflowStatuses.length
    ? workflowStatuses.map((s: any) => ({ id: s.id, displayName: s.displayName, color: s.color || '#6b7280' }))
    : boardStatuses.map((s: any) => ({ id: s.id, displayName: s.displayName || s.name, color: s.color || '#6b7280' }));

  // Workflow-enforced status transitions:
  // If a project workflow exists AND the issue has a current status, show only
  // the statuses that are reachable via defined transitions from the current status.
  // Always include the current status so the dropdown shows the current value.
  // Statuses that should always be reachable from any status (universal statuses)
  const UNIVERSAL_STATUS_KEYWORDS = ['hold', 'on_hold', 'dependency', 'rejected'];
  const statusSelectOptions = (() => {
    const currentStatusId = issue?.status?.id;
    const currentStatusOpt = issue?.status
      ? { id: issue.status.id, displayName: issue.status.displayName || issue.status.name, color: issue.status.color || '#6b7280' }
      : null;

    if (projectWorkflow && currentStatusId) {
      // Build list of universal statuses (On Hold, Dependency, Rejected) — available from every status
      const universalStatuses = (projectWorkflow.statuses || [])
        .filter((s: any) => {
          const name = s.name?.toLowerCase() || '';
          return UNIVERSAL_STATUS_KEYWORDS.some((k) => name.includes(k));
        })
        .map((s: any) => ({ id: s.id, displayName: s.displayName, color: s.color || '#6b7280' }));

      // Get statuses reachable via transitions from the current status
      const allowedToIds = new Set(
        (projectWorkflow.transitions || [])
          .filter(t => t.fromStatusId === currentStatusId)
          .map(t => t.toStatusId)
      );
      const allowedStatuses = (projectWorkflow.statuses || [])
        .filter(s => allowedToIds.has(s.id))
        .map(s => ({ id: s.id, displayName: s.displayName, color: s.color || '#6b7280' }));

      // Always include current status at top
      const opts = currentStatusOpt ? [currentStatusOpt] : [];
      for (const s of allowedStatuses) {
        if (!opts.some(o => o.id === s.id)) opts.push(s);
      }
      // Append universal statuses that aren't already in the list
      for (const s of universalStatuses) {
        if (!opts.some(o => o.id === s.id)) opts.push(s);
      }
      // If no outgoing transitions found (only current + universals), fall back to all workflow statuses
      if (allowedStatuses.length === 0 && universalStatuses.length === 0) {
        return allStatusOptions.length > 0 ? allStatusOptions : opts;
      }
      return opts;
    }

    // Fallback: no workflow configured — show all board statuses
    if (currentStatusOpt && !allStatusOptions.some((s: any) => s.id === currentStatusOpt.id)) {
      return [currentStatusOpt, ...allStatusOptions];
    }
    return allStatusOptions;
  })();

  const priorityOptionsBase = (boardData as any)?.filters?.priorities || [];
  const priorityOptions = issue?.priority && !priorityOptionsBase.some((p: any) => p.id === issue.priority!.id)
    ? [{ id: issue.priority.id, displayName: issue.priority.displayName, color: issue.priority.color || '#9ca3af' }, ...priorityOptionsBase]
    : priorityOptionsBase;

  const currentLabelIds = (issue?.labels || []).map((l: any) => l.id);

  // Reset local optimistic label state once server data arrives with the update
  useEffect(() => {
    setLocalLabelIds(null);
  }, [currentLabelIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Dropdown menu ────────────────────────────────────────────────────────────
  const dropdownItems: MenuProps['items'] = [
    { key: 'copy', icon: <Copy size={14} />, label: 'Copy Link' },
    { key: 'watch', icon: <Eye size={14} />, label: isWatching ? 'Unwatch' : 'Watch Issue' },
    { type: 'divider' },
    ...(canUpdateIssue ? [
      { key: 'clone', icon: <Copy size={14} />, label: 'Clone Issue' },
      { key: 'move', icon: <Share2 size={14} />, label: 'Move to Project' },
    ] : []),
    ...(canDeleteIssue ? [{ type: 'divider' as const }, { key: 'delete', icon: <Trash2 size={14} />, label: 'Delete Issue', danger: true }] : []),
  ];

  const handleDropdownClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'copy') { navigator.clipboard.writeText(window.location.href); antMessage.success('Link copied'); }
    if (key === 'watch') handleToggleWatch();
    if (key === 'clone') handleClone();
    if (key === 'move') setShowMoveModal(true);
    if (key === 'delete') handleDelete();
  };

  // ── Guards ───────────────────────────────────────────────────────────────────
  if (isLoading) return <div style={{ padding: 24 }}><Skeleton active avatar paragraph={{ rows: 15 }} /></div>;

  if (!canViewIssues) return (
    <div style={{ padding: 24 }}>
      <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 32, textAlign: 'center', color: COLORS.textSecondary }}>
        You don't have permission to view this issue.
      </div>
    </div>
  );

  if (error || !issue) return (
    <div style={{ padding: 80, textAlign: 'center' }}>
      <Empty
        image={<AlertCircle size={64} color={COLORS.danger} strokeWidth={1} style={{ margin: '0 auto' }} />}
        description={
          <Space direction="vertical">
            <Text strong style={{ fontSize: 18 }}>Issue not found</Text>
            <Text style={{ color: COLORS.textSecondary }}>The issue doesn't exist or you don't have access.</Text>
            <Button onClick={() => navigate(`/projects/${projectId}/issues`)} style={{ marginTop: 16 }}>Back to Issues</Button>
          </Space>
        }
      />
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', overflow: 'hidden' }}>

      {/* ── Top Bar ── */}
      <div style={{
        padding: '12px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${COLORS.border}`,
        background: '#fff',
        gap: 8,
      }}>
        {/* Left: back + breadcrumb + Add Epic */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Button type="text" icon={<ArrowLeft size={16} />}
            onClick={() => onBack ? onBack() : navigate(`/projects/${projectId}/issues`)}
            style={{ color: COLORS.textSecondary, flexShrink: 0 }} />

          {/* Epic selector in breadcrumb */}
          <Select
            value={issue.epicId || issue.parentId || 'none'}
            onChange={(v) => {
              if (v === 'none') {
                patch({ epicId: null, parentId: null }, 'Epic updated');
                return;
              }
              patch({ epicId: v, parentId: null }, 'Epic updated');
            }}
            size="small"
            variant="borderless"
            style={{ minWidth: 110, maxWidth: 160 }}
            placeholder="Add epic"
          >
            <Select.Option value="none">
              <span style={{ color: COLORS.textSecondary, fontSize: 12 }}>+ Add Epic</span>
            </Select.Option>
            {epicOptions.map((ep: any) => (
              <Select.Option key={ep.id} value={ep.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: ep.color || COLORS.primary, display: 'inline-block' }} />
                  <span style={{ fontSize: 12 }}>{ep.name}</span>
                </div>
              </Select.Option>
            ))}
          </Select>

          <span style={{ color: COLORS.border }}>/</span>

          <Text strong style={{ fontSize: 13 }}>{issue.issueKey}</Text>
        </div>

        {/* Right: action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Export */}
          <Tooltip title="Export issue">
            <Button type="text" icon={<Download size={16} />} onClick={handleExport}
              style={{ color: COLORS.textSecondary }} />
          </Tooltip>

          {/* Watch with count + hover shows watchers */}
          <Popover
            content={
              watchersList.length > 0 ? (
                <div style={{ minWidth: 160, maxWidth: 220 }}>
                  <Text style={{ fontSize: 12, color: COLORS.textSecondary, display: 'block', marginBottom: 8 }}>
                    Watching ({watchersList.length})
                  </Text>
                  {watchersList.map((w: any) => (
                    <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Avatar size={20} src={normalizeAvatarUrl(w.avatarUrl)} style={{ backgroundColor: COLORS.primary, flexShrink: 0 }}>
                        {w.displayName?.charAt(0)}
                      </Avatar>
                      <Text style={{ fontSize: 12 }}>{w.displayName}</Text>
                    </div>
                  ))}
                </div>
              ) : (
                <Text style={{ fontSize: 12, color: COLORS.textSecondary }}>No watchers yet</Text>
              )
            }
            trigger="hover"
            placement="bottom"
          >
            <Button
              type={isWatching ? 'primary' : 'text'}
              icon={<Eye size={16} />}
              onClick={handleToggleWatch}
              style={{ color: isWatching ? undefined : COLORS.textSecondary }}
            >
              {watcherCount > 0 ? watcherCount : ''}
            </Button>
          </Popover>

          {/* Share */}
          <Tooltip title="Share">
            <Button type="text" icon={<Share2 size={16} />}
              onClick={() => { navigator.clipboard.writeText(window.location.href); antMessage.success('Link copied!'); }}
              style={{ color: COLORS.textSecondary }} />
          </Tooltip>

          {/* More */}
          <Dropdown menu={{ items: dropdownItems, onClick: handleDropdownClick }} trigger={['click']}>
            <Button type="text" icon={<MoreHorizontal size={16} />} style={{ color: COLORS.textSecondary }} />
          </Dropdown>

          {/* Expand (external) — hidden when already on full page */}
          {!isFullPage && (
            <Tooltip title="Open full page">
              <Button type="text" icon={<ExternalLink size={16} />}
                onClick={() => { closeIssue(); navigate(`/projects/${projectId}/issues/${issueId}`); }}
                style={{ color: COLORS.textSecondary }} />
            </Tooltip>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* ═══════ Left / Main Column ═══════ */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '24px 32px',
          display: 'flex', flexDirection: 'column', gap: 28,
          scrollbarWidth: 'thin',
        }}>

          {/* ── Title + action buttons ── */}
          <div>
            {/* Epic badge above title */}
            {issue.epic && (
              <div style={{ marginBottom: 8 }}>
                <AntTag color={issue.epic.color || COLORS.primary} style={{ fontSize: 11, padding: '1px 8px', borderRadius: 4 }}>
                  {issue.epic.name}
                </AntTag>
              </div>
            )}
            <Title
              level={2}
              editable={canUpdateIssue ? {
                onChange: (v) => patch({ title: v }, 'Title updated'),
                triggerType: ['text'],
              } : false}
              style={{ margin: 0, fontSize: 22, fontWeight: 600, lineHeight: 1.35 }}
            >
              {issue.title}
            </Title>

            {/* Quick action row under title */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <Button
                icon={<Paperclip size={14} />}
                size="small"
                onClick={() => setShowAttachPanel((p) => !p)}
                style={{ borderRadius: 6, fontSize: 12 }}
              >
                Attach
              </Button>
              <Button
                icon={<Clock size={14} />}
                size="small"
                onClick={() => setIsLogTimeOpen(true)}
                style={{ borderRadius: 6, fontSize: 12 }}
              >
                Log time
              </Button>
            </div>
          </div>

          {/* ── Existing attachments (always visible when attachments exist) ── */}
          <AttachmentList key={attachRefreshKey} issueId={issue.id} initialData={issue.attachments} />

          {/* ── File upload panel (toggled by "Attach" button) ── */}
          {showAttachPanel && (
            <section style={{
              border: `1px solid ${COLORS.border}`, borderRadius: 10,
              padding: 16, background: COLORS.bgLight,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text strong style={{ fontSize: 14 }}>
                  <Paperclip size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
                  Upload Attachments
                </Text>
                <Button type="text" size="small" icon={<X size={14} />} onClick={() => setShowAttachPanel(false)} />
              </div>

              {/* Upload area */}
              <FileUpload
                issueId={issue.id}
                onUploadComplete={() => setAttachRefreshKey((k) => k + 1)}
              />
            </section>
          )}

          {/* ── Description ── */}
          <section>
            <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 8 }}>Description</Text>
            <RichTextEditor
              value={issue.descriptionHtml || (issue.description ? `<p>${issue.description.replace(/\n/g, '<br/>')}</p>` : '')}
              onChange={(html) => {
                if (!canUpdateDesc) return;
                // Debounce: wait 800 ms after the last keystroke before saving
                if (descSaveTimer.current) clearTimeout(descSaveTimer.current);
                descSaveTimer.current = setTimeout(() => {
                  patch({ descriptionHtml: html, description: html.replace(/<[^>]+>/g, '') });
                }, 800);
              }}
              placeholder="Add a description… (supports rich text, tables, code blocks)"
              editable={!!canUpdateDesc}
              minHeight={120}
              showToolbar={!!canUpdateDesc}
            />
          </section>

          {/* ── Subtasks ── */}
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text strong style={{ fontSize: 15 }}>Child issues</Text>
              {subtaskProgress && subtaskProgress.totalSubtasks > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {subtaskProgress.completedSubtasks}/{subtaskProgress.totalSubtasks} done
                  </Text>
                  <div style={{ width: 80, height: 5, background: '#ebecf0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${subtaskProgress.progressPercentage}%`, height: '100%', background: COLORS.success, transition: 'width 0.3s' }} />
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(subtasks as any[]).map((sub: any) => (
                <div
                  key={sub.id}
                  onClick={() => openIssue(sub.id, projectId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 6,
                    border: `1px solid ${COLORS.border}`, background: '#fff',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.bgHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                >
                  {sub.status?.category === 'DONE'
                    ? <CheckCircle2 size={15} color={COLORS.success} />
                    : <Circle size={15} color={COLORS.textSecondary} />
                  }
                  <AntTag color={sub.type?.color} style={{ margin: 0, fontSize: 10, padding: '0 4px' }}>{sub.type?.name}</AntTag>
                  <Text style={{ flex: 1, fontSize: 13, textDecoration: sub.status?.category === 'DONE' ? 'line-through' : 'none' }}>
                    {sub.title}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>{sub.issueKey}</Text>
                  <AntTag
                    color={sub.status?.color}
                    style={{ margin: 0, fontSize: 11, cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Status change inline on subtask is handled via the subtask's own page
                    }}
                  >
                    {sub.status?.displayName}
                  </AntTag>
                  {sub.assignee && <Avatar size={18} src={normalizeAvatarUrl(sub.assignee.avatarUrl)} />}
                </div>
              ))}

              {/* Add subtask input */}
              {isAddingSubtask ? (
                <div style={{ marginTop: 6, padding: 12, borderRadius: 6, border: `1px solid ${COLORS.primary}`, background: '#f0f7ff' }}>
                  <Input
                    autoFocus
                    placeholder="What needs to be done?"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onPressEnter={handleCreateSubtask}
                    style={{ marginBottom: 8 }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button type="primary" size="small" onClick={handleCreateSubtask} loading={isCreatingSubtask}>Create</Button>
                    <Button type="text" size="small" onClick={() => setIsAddingSubtask(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="text" icon={<Plus size={14} />}
                  onClick={() => setIsAddingSubtask(true)}
                  style={{ width: 'fit-content', color: COLORS.textSecondary, marginTop: 4, fontSize: 13 }}
                >
                  Add child issue
                </Button>
              )}
            </div>
          </section>

          {/* ── Linked Work Items ── */}
          <section>
            <IssueLinksList issueId={issue.id} projectId={projectId} initialLinks={issue.links} />
          </section>

          {/* ── Activity ── */}
          <section>
            <Text strong style={{ fontSize: 15, display: 'block', marginBottom: 14 }}>Activity</Text>
            <Tabs
              defaultActiveKey="all"
              size="small"
              items={[
                {
                  key: 'all', label: 'All',
                  children: (
                    <div style={{ paddingTop: 14 }}>
                      <CommentsList issueId={issueId!} />
                      <Divider style={{ margin: '16px 0' }} />
                      <ActivityList activities={activityData?.data?.activities || []} initialLimit={3} pageSize={10} />
                    </div>
                  ),
                },
                {
                  key: 'comments', label: 'Comments',
                  children: <div style={{ paddingTop: 14 }}><CommentsList issueId={issueId!} /></div>,
                },
                {
                  key: 'history', label: 'History',
                  children: <div style={{ paddingTop: 14 }}><ActivityList activities={activityData?.data?.activities || []} initialLimit={3} pageSize={10} /></div>,
                },
                {
                  key: 'worklog', label: 'Work log',
                  children: (
                    <div style={{ paddingTop: 14 }}>
                      <Button
                        type="primary" ghost size="small" icon={<Clock size={14} />}
                        onClick={() => setIsLogTimeOpen(true)}
                        style={{ marginBottom: 14 }}
                      >
                        Log time
                      </Button>
                      <TimeLogList issueId={issue.id} initialData={issue.timeLogs} />
                    </div>
                  ),
                },
              ]}
              tabBarStyle={{ marginBottom: 0, borderBottom: `1px solid ${COLORS.border}` }}
            />
          </section>
        </div>

        {/* Sidebar collapse handle */}
        <div
          onClick={() => setIsSidebarCollapsed((p) => !p)}
          style={{
            position: 'absolute', right: isSidebarCollapsed ? 0 : 360,
            top: '50%', transform: 'translateY(-50%)',
            width: 22, height: 22, borderRadius: '50%',
            background: '#fff', border: `1px solid ${COLORS.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', zIndex: 10, transition: 'right 0.3s',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          {isSidebarCollapsed ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
        </div>

        {/* ═══════ Right Sidebar ═══════ */}
        <div style={{
          width: isSidebarCollapsed ? 0 : 360,
          height: '100%', overflowX: 'hidden', overflowY: 'auto',
          borderLeft: `1px solid ${COLORS.border}`,
          transition: 'width 0.3s', background: '#fff',
        }}>
          <div style={{ padding: 20, minWidth: 360, display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Status + automation row — hidden (code kept) */}

            {/* ── Details card ── */}
            <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: '8px 4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px 10px' }}>
                <Text strong style={{ fontSize: 14 }}>Details</Text>
                <Popover
                  open={settingsOpen}
                  onOpenChange={setSettingsOpen}
                  trigger="click"
                  placement="bottomRight"
                  title={<Text strong style={{ fontSize: 13 }}>Visible fields</Text>}
                  content={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160 }}>
                      {([
                        ['assignee', 'Assignee'],
                        ['priority', 'Priority'],
                        ['dueDate', 'Due date'],
                        ['startDate', 'Start date'],
                        ['labels', 'Labels'],
                        ['sprint', 'Sprint'],
                        ['storyPoints', 'Story points'],
                        ['reporter', 'Reporter'],
                      ] as [keyof typeof fieldVisibility, string][]).map(([key, label]) => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                          <input
                            type="checkbox"
                            checked={fieldVisibility[key]}
                            onChange={() => toggleField(key)}
                            style={{ cursor: 'pointer' }}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  }
                >
                  <Button type="text" icon={<Settings size={13} />} size="small" />
                </Popover>
              </div>

              {/* Status */}
              <SidebarField label="Status" icon={<Zap size={13} />} COLORS={COLORS}>
                <Select
                  value={issue.status?.id}
                  onChange={(v) => patch({ statusId: v }, 'Status updated')}
                  variant="borderless" style={{ width: '100%' }} size="small"
                  disabled={!canUpdateIssue}
                >
                  {boardColumnStatuses.map((s: any) => (
                    <Select.Option key={s.id} value={s.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block', flexShrink: 0 }} />
                        <span style={{ fontSize: 12 }}>{s.displayName}</span>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </SidebarField>

              {/* Assignee */}
              {fieldVisibility.assignee && (
                <SidebarField label="Assignee" icon={<User size={13} />} editable={canReassign} COLORS={COLORS}>
                  <Select
                    value={issue.assignee?.id || 'unassigned'}
                    onChange={(v) => patch({ assigneeId: v === 'unassigned' ? null : v }, 'Assignee updated')}
                    variant="borderless" style={{ width: '100%' }} size="small"
                    disabled={!canReassign}
                  >
                    <Select.Option value="unassigned">
                      <Space size={6}><Avatar size={16} icon={<User size={10} />} />Unassigned</Space>
                    </Select.Option>
                    {(() => {
                      const members = membersData || [];
                      const assigneeInList = members.some((m: any) => m.user.id === issue.assignee?.id);
                      const opts = assigneeInList ? members : (issue.assignee ? [{ user: issue.assignee }, ...members] : members);
                      return opts.map((m: any) => (
                        <Select.Option key={m.user.id} value={m.user.id}>
                          <Space size={6}>
                            <Avatar size={16} src={normalizeAvatarUrl(m.user.avatarUrl)}>{m.user.displayName?.charAt(0)}</Avatar>
                            {m.user.displayName}
                          </Space>
                        </Select.Option>
                      ));
                    })()}
                  </Select>
                </SidebarField>
              )}

              {/* Priority */}
              {fieldVisibility.priority && <SidebarField label="Priority" icon={<Flag size={13} />} COLORS={COLORS}>
                <Select
                  value={issue.priority?.id}
                  onChange={(v) => patch({ priorityId: v }, 'Priority updated')}
                  variant="borderless" style={{ width: '100%' }} size="small"
                  placeholder="None"
                >
                  {priorityOptions.map((p: any) => (
                    <Select.Option key={p.id} value={p.id}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                        {p.displayName}
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </SidebarField>}

              {/* Due Date */}
              {fieldVisibility.dueDate && (
                <SidebarField label="Due date" icon={<Calendar size={13} />} COLORS={COLORS}>
                  <DatePicker
                    value={issue.dueDate ? dayjs(issue.dueDate) : null}
                    onChange={(d) => patch({ dueDate: d ? d.format('YYYY-MM-DD') : null }, 'Due date updated')}
                    size="small" variant="borderless" style={{ width: '100%' }}
                    placeholder="None"
                    format="MMM D, YYYY"
                    allowClear
                  />
                </SidebarField>
              )}

              {/* Start Date */}
              {fieldVisibility.startDate && (
                <SidebarField label="Start date" icon={<Calendar size={13} />} COLORS={COLORS}>
                  <DatePicker
                    value={issue.startDate ? dayjs(issue.startDate) : null}
                    onChange={(d) => patch({ startDate: d ? d.format('YYYY-MM-DD') : null }, 'Start date updated')}
                    size="small" variant="borderless" style={{ width: '100%' }}
                    placeholder="None"
                    format="MMM D, YYYY"
                    allowClear
                  />
                </SidebarField>
              )}

              {/* Labels */}
              {fieldVisibility.labels && <SidebarField label="Labels" icon={<Tag size={13} />} COLORS={COLORS}>
                <div style={{ width: '100%' }}>
                  <Select
                    mode="multiple"
                    value={localLabelIds ?? currentLabelIds}
                    onChange={(ids: string[]) => {
                      setLocalLabelIds(ids);
                      patch({ labels: ids }, 'Labels updated');
                    }}
                    variant="borderless"
                    style={{ width: '100%' }}
                    size="small"
                    placeholder="Add labels"
                    maxTagCount="responsive"
                    dropdownRender={(menu) => (
                      <>
                        {menu}
                        <Divider style={{ margin: '4px 0' }} />
                        <div style={{ padding: '4px 8px 8px' }}>
                          <Text style={{ fontSize: 11, color: COLORS.textSecondary, display: 'block', marginBottom: 4 }}>Create new label</Text>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                            <Input
                              size="small"
                              placeholder="Label name"
                              value={newLabelName}
                              onChange={(e) => setNewLabelName(e.target.value)}
                              onPressEnter={handleCreateLabel}
                              style={{ flex: 1 }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                            {LABEL_COLORS.map((c) => (
                              <div
                                key={c}
                                onClick={() => setNewLabelColor(c)}
                                style={{
                                  width: 16, height: 16, borderRadius: '50%', background: c, cursor: 'pointer',
                                  border: newLabelColor === c ? '2px solid #1268ff' : '2px solid transparent',
                                  transition: 'border 0.15s',
                                }}
                              />
                            ))}
                          </div>
                          <Button
                            type="primary" size="small" block
                            loading={isCreatingLabel}
                            onClick={handleCreateLabel}
                            disabled={!newLabelName.trim()}
                          >
                            Create "{newLabelName || '...'}"
                          </Button>
                        </div>
                      </>
                    )}
                  >
                    {projectLabels.map((l) => (
                      <Select.Option key={l.id} value={l.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, display: 'inline-block' }} />
                          {l.name}
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                </div>
              </SidebarField>}

              {/* Sprint — hidden (code kept) */}

              {/* Fix Version */}
              {versionsData && versionsData.length > 0 && (
                <SidebarField label="Fix version" icon={<GitBranch size={13} />} COLORS={COLORS}>
                  <Select
                    value={issue.fixVersion?.id || issue.fixVersionId || 'none'}
                    onChange={(v) => patch({ fixVersionId: v === 'none' ? null : v }, 'Fix version updated')}
                    variant="borderless" style={{ width: '100%' }} size="small"
                    placeholder="None"
                  >
                    <Select.Option value="none"><Text type="secondary" style={{ fontSize: 12 }}>None</Text></Select.Option>
                    {versionsData.filter((ver: any) => ver.status !== 'archived').map((ver: any) => (
                      <Select.Option key={ver.id} value={ver.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 10, padding: '0 4px', borderRadius: 3, background: ver.status === 'released' ? '#dcfce7' : '#fef3c7', color: ver.status === 'released' ? '#16a34a' : '#d97706' }}>
                            {ver.status}
                          </span>
                          {ver.name}
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                </SidebarField>
              )}

              {/* Affected Version */}
              {versionsData && versionsData.length > 0 && (
                <SidebarField label="Affected version" icon={<GitBranch size={13} />} COLORS={COLORS}>
                  <Select
                    value={issue.affectedVersion?.id || issue.affectedVersionId || 'none'}
                    onChange={(v) => patch({ affectedVersionId: v === 'none' ? null : v }, 'Affected version updated')}
                    variant="borderless" style={{ width: '100%' }} size="small"
                    placeholder="None"
                  >
                    <Select.Option value="none"><Text type="secondary" style={{ fontSize: 12 }}>None</Text></Select.Option>
                    {versionsData.map((ver: any) => (
                      <Select.Option key={ver.id} value={ver.id}>
                        {ver.name}
                      </Select.Option>
                    ))}
                  </Select>
                </SidebarField>
              )}

              {/* Story Points */}
              {fieldVisibility.storyPoints && (
                <SidebarField label="Story points" icon={<Hash size={13} />} COLORS={COLORS}>
                  <Input
                    key={issue.storyPoints}
                    defaultValue={issue.storyPoints ?? ''}
                    variant="borderless"
                    size="small"
                    style={{ width: '100%' }}
                    placeholder="None"
                    type="number"
                    min={0}
                    onBlur={(e) => {
                      const val = e.target.value;
                      patch({ storyPoints: val ? parseInt(val, 10) : undefined }, 'Story points updated');
                    }}
                    onPressEnter={(e) => (e.target as HTMLInputElement).blur()}
                  />
                </SidebarField>
              )}

              {/* Reporter */}
              {fieldVisibility.reporter && (
                <SidebarField label="Reporter" icon={<User size={13} />} COLORS={COLORS}>
                  <Select
                    value={issue.reporter?.id || 'none'}
                    onChange={(v) => patch({ reporterId: v === 'none' ? null : v }, 'Reporter updated')}
                    variant="borderless" style={{ width: '100%' }} size="small"
                  >
                    {(() => {
                      const members = membersData || [];
                      const reporterInList = members.some((m: any) => m.user.id === issue.reporter?.id);
                      const opts = reporterInList ? members : (issue.reporter ? [{ user: issue.reporter }, ...members] : members);
                      return opts.map((m: any) => (
                        <Select.Option key={m.user.id} value={m.user.id}>
                          <Space size={6}>
                            <Avatar size={16} src={normalizeAvatarUrl(m.user.avatarUrl)}>{m.user.displayName?.charAt(0)}</Avatar>
                            {m.user.displayName}
                          </Space>
                        </Select.Option>
                      ));
                    })()}
                  </Select>
                </SidebarField>
              )}
            </div>

            {/* ── Work Log panel ── */}
            <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: 'hidden' }}>
              <div style={{
                padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={13} style={{ color: COLORS.textSecondary }} />
                  <Text strong style={{ fontSize: 13 }}>Work Log</Text>
                </div>
                <Button
                  type="primary" ghost size="small" icon={<Clock size={12} />}
                  onClick={() => setIsLogTimeOpen(true)}
                  style={{ borderRadius: 6, fontSize: 11 }}
                >
                  Log time
                </Button>
              </div>
              <div style={{ padding: '12px 12px 8px' }}>
                <TimeLogList issueId={issue.id} initialData={issue.timeLogs} />
              </div>
            </div>

            {/* ── Development panel ── */}
            {(() => {
              const isRepoConnected = githubStatus?.connected || gitlabStatus?.connected;
              const defaultBranchName = `feature/${issue.issueKey.toLowerCase()}-${issue.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40).replace(/-$/, '')}`;
              const repoWebUrl = gitlabStatus?.repository?.webUrl
                || (githubStatus?.repository?.fullName ? `https://github.com/${githubStatus.repository.fullName}` : '');
              const isCreatingBranch = isCreatingGHBranch || isCreatingGLBranch;

              return (
                <div style={{ border: `1px solid ${COLORS.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text strong style={{ fontSize: 13 }}>Development</Text>
                  </div>

                  {/* Create branch row */}
                  <div
                    style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${COLORS.border}`, background: devExpanded === 'branch' ? COLORS.bgLight : 'transparent', userSelect: 'none' }}
                    onClick={() => {
                      if (devExpanded !== 'branch') setNewBranchName(defaultBranchName);
                      setDevExpanded(devExpanded === 'branch' ? null : 'branch');
                    }}
                  >
                    <Space size={6}>
                      <GitBranch size={14} style={{ color: COLORS.primary }} />
                      <Text style={{ fontSize: 12 }}>Create branch</Text>
                    </Space>
                    {devExpanded === 'branch' ? <ChevronUp size={13} style={{ color: COLORS.textSecondary }} /> : <ChevronDown size={13} style={{ color: COLORS.textSecondary }} />}
                  </div>

                  {devExpanded === 'branch' && (
                    <div style={{ padding: 12, background: COLORS.bgLight, borderBottom: `1px solid ${COLORS.border}` }}>
                      {isRepoConnected ? (
                        <Space direction="vertical" style={{ width: '100%' }} size={8}>
                          <div>
                            <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>Branch name</Text>
                            <Input
                              size="small"
                              value={newBranchName}
                              onChange={(e) => setNewBranchName(e.target.value)}
                              style={{ marginTop: 2, fontFamily: 'monospace', fontSize: 11 }}
                            />
                          </div>
                          <div>
                            <Text style={{ fontSize: 11, color: COLORS.textSecondary }}>From (base branch)</Text>
                            <Input
                              size="small"
                              value={newBranchRef}
                              onChange={(e) => setNewBranchRef(e.target.value)}
                              placeholder="main"
                              style={{ marginTop: 2, fontFamily: 'monospace', fontSize: 11 }}
                            />
                          </div>
                          <Button
                            type="primary"
                            size="small"
                            loading={isCreatingBranch}
                            onClick={handleCreateBranch}
                            disabled={!newBranchName.trim()}
                            block
                          >
                            Create branch
                          </Button>
                        </Space>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Connect a repository in{' '}
                          <a href={`/projects/${projectId}/integrations`} style={{ color: COLORS.primary }}>Project Integrations</a>
                          {' '}to create branches.
                        </Text>
                      )}
                    </div>
                  )}

                  {/* Create commit row */}
                  <div
                    style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: devExpanded === 'commit' ? COLORS.bgLight : 'transparent', userSelect: 'none' }}
                    onClick={() => setDevExpanded(devExpanded === 'commit' ? null : 'commit')}
                  >
                    <Space size={6}>
                      <GitCommit size={14} style={{ color: COLORS.primary }} />
                      <Text style={{ fontSize: 12 }}>Create commit</Text>
                    </Space>
                    {devExpanded === 'commit' ? <ChevronUp size={13} style={{ color: COLORS.textSecondary }} /> : <ChevronDown size={13} style={{ color: COLORS.textSecondary }} />}
                  </div>

                  {devExpanded === 'commit' && (
                    <div style={{ padding: 12, background: COLORS.bgLight }}>
                      <Text style={{ fontSize: 12, color: COLORS.textSecondary, display: 'block', marginBottom: 6 }}>
                        Include <Text code style={{ fontSize: 11 }}>{issue.issueKey}</Text> in your commit message to link it:
                      </Text>
                      <div style={{ background: COLORS.border, borderRadius: 4, padding: '6px 8px', fontFamily: 'monospace', fontSize: 11, color: COLORS.textPrimary, wordBreak: 'break-all' }}>
                        git commit -m &quot;{issue.issueKey}: describe your change&quot;
                      </div>
                      {repoWebUrl && (
                        <a href={`${repoWebUrl}/commits`} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, marginTop: 8, color: COLORS.primary }}>
                          <ExternalLink size={12} /> View commits on repository
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Code activity (GitHub) */}
            {githubStatus?.connected && (
              <CodeActivity
                issueId={issue.id}
                issueKey={issue.issueKey}
                issueTitle={issue.title}
                issueType={issue.type?.name || 'Task'}
                projectId={projectId}
                repositoryId={githubStatus?.repository?.id}
              />
            )}

            {/* ── Automation panel — hidden (code kept) ── */}

            {/* ── Meta ── */}
            <div style={{ paddingTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                Created {formatDistanceToNow(new Date(issue.createdAt), { addSuffix: true })}
              </Text>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                Updated {formatDistanceToNow(new Date(issue.updatedAt), { addSuffix: true })}
              </Text>
            </div>
          </div>
        </div>
      </div>

      {/* ── Dialogs ── */}
      <LogTimeDialog issueId={issue.id} issueKey={issue.issueKey} open={isLogTimeOpen} onOpenChange={setIsLogTimeOpen} />

      <Modal
        title="Move Issue to Another Project"
        open={showMoveModal}
        onCancel={() => setShowMoveModal(false)}
        onOk={handleMove}
        okText="Move Issue"
        okButtonProps={{ disabled: !moveTargetProjectId }}
      >
        <div style={{ marginBottom: 12 }}>
          <Text style={{ color: COLORS.textSecondary }}>
            Move <Text strong>{issue.issueKey}</Text> to another project.
          </Text>
        </div>
        <Select
          value={moveTargetProjectId || undefined}
          onChange={setMoveTargetProjectId}
          placeholder="Select target project"
          style={{ width: '100%' }}
        >
          {(projectsData as any)?.projects?.filter((p: any) => p.id !== projectId).map((p: any) => (
            <Select.Option key={p.id} value={p.id}>
              <Space><AntTag color="blue">{p.key}</AntTag>{p.name}</Space>
            </Select.Option>
          ))}
        </Select>
      </Modal>
    </div>
  );
}

export default IssueDetailPage;
