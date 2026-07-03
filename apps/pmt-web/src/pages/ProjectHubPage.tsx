import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input, Avatar, Skeleton, Empty, Tag, message } from 'antd';
import {
  ArrowLeft, Search, Briefcase, Users, FolderOpen,
  Columns3, User, FilterX,
} from 'lucide-react';
import { DndContext, type DragEndEvent, useSensors, useSensor, PointerSensor, closestCenter } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useGetProjectsQuery, useGetProjectMembersQuery } from '@/features/projects/projectsApi';
import { useGetUsersQuery } from '@/features/users/usersApi';
import { useGetBoardQuery } from '@/features/boards/boardsApi';
import { BoardColumn } from '@/features/boards/BoardColumn';
import { CreateIssueModal } from '@/features/issues/components/CreateIssueModal';
import { useIssueModal } from '@/features/issues/IssueDetailModal';
import { useUpdateIssueMutation } from '@/features/issues/issuesApi';

const C = {
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  primary: '#1268ff',
  primaryBg: '#eff6ff',
  text: '#0f172a',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
};

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  active: { color: C.success, bg: '#ecfdf5' },
  on_hold: { color: C.warning, bg: '#fffbeb' },
  completed: { color: '#3b82f6', bg: '#eff6ff' },
  archived: { color: C.textMuted, bg: '#f1f5f9' },
};


function ini(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
}

export default function ProjectHubPage() {
  const navigate = useNavigate();
  const [projectSearch, setProjectSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isCreateIssueOpen, setIsCreateIssueOpen] = useState(false);
  const [createIssueStatusId, setCreateIssueStatusId] = useState<string | undefined>();

  const projectsQueryParams = useMemo(() => ({
    ...(selectedUserId ? { memberId: selectedUserId } : {}),
  }), [selectedUserId]);
  const { data: projectsData, isLoading: projectsLoading } = useGetProjectsQuery(projectsQueryParams);

  // All employees (shown when no project selected)
  const { data: usersData, isLoading: usersLoading } = useGetUsersQuery({ limit: 100, scope: 'pmt' });

  // Project members (shown when a project is selected)
  const { data: projectMembers, isLoading: membersLoading } = useGetProjectMembersQuery(
    selectedProjectId || '',
    { skip: !selectedProjectId }
  );

  // Fetch board when a project is selected
  const boardParams = useMemo(() => ({
    projectId: selectedProjectId || '',
    params: selectedUserId ? { assigneeIds: [selectedUserId] } : {},
  }), [selectedProjectId, selectedUserId]);

  const { data: boardData, isLoading: boardLoading, refetch: refetchBoard } = useGetBoardQuery(
    boardParams,
    { skip: !selectedProjectId }
  );
  const [updateIssue] = useUpdateIssueMutation();

  const projects = useMemo(() => {
    const list = projectsData?.projects || [];
    if (!projectSearch.trim()) return list;
    const q = projectSearch.toLowerCase();
    return list.filter(p => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q));
  }, [projectsData, projectSearch]);

  const users = useMemo(() => {
    let list: any[];
    if (selectedProjectId && projectMembers) {
      // Project selected → show only allocated members
      list = projectMembers.map((m: any) => ({
        id: m.user?.id || m.userId,
        displayName: m.user?.displayName || m.user?.email || '',
        email: m.user?.email || '',
        avatarUrl: m.user?.avatarUrl,
        isActive: true,
        role: m.role,
      }));
    } else {
      // No project selected → show all employees, excluding admin-role users
      list = (usersData?.users || [])
        .filter((u: any) => u.roleName !== 'admin')
        .map((u: any) => ({
          id: u.id,
          displayName: u.displayName,
          email: u.email,
          avatarUrl: u.avatarUrl,
          isActive: u.isActive,
          role: null,
        }));
    }
    if (!userSearch.trim()) return list;
    const q = userSearch.toLowerCase();
    return list.filter((u: any) =>
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }, [selectedProjectId, projectMembers, usersData, userSearch]);

  const selectedProject = projectsData?.projects?.find(p => p.id === selectedProjectId);
  const selectedUser = users.find((u: any) => u.id === selectedUserId);

  // Parse board columns into BoardColumn-compatible shape
  const baseColumns = useMemo(() => {
    if (!boardData) return [];
    const raw = (boardData as any)?.columns || (boardData as any)?.statuses || [];
    return raw.map((col: any, idx: number) => ({
      id: col.id,
      name: col.name || 'Unknown',
      displayName: col.displayName || col.name || 'Unknown',
      color: col.color || '#94a3b8',
      category: col.category || 'to_do',
      position: col.position ?? idx,
      wipLimit: col.wipLimit ?? null,
      issues: col.issues || [],
    }));
  }, [boardData]);
  const [columns, setColumns] = useState<any[]>([]);
  const skipNextSync = useRef(false);

  useEffect(() => {
    // After an optimistic drag-drop update, skip the next server-driven
    // sync so the columns don't flash back to their pre-move state.
    if (skipNextSync.current) {
      skipNextSync.current = false;
      return;
    }
    setColumns(baseColumns);
  }, [baseColumns]);

  const columnIds = useMemo(() => columns.map((c: any) => c.id), [columns]);

  // Derive create-issue dropdowns from board filters (same data the board API returns)
  const boardFilters = (boardData as any)?.filters;
  const issueTypesForCreate = useMemo(
    () => (boardFilters?.types || [])
      .filter((t: any) => (t.displayName || t.name || '').toLowerCase() !== 'epic')
      .map((t: any) => ({ id: t.id, name: t.displayName || t.name })),
    [boardFilters],
  );
  const prioritiesForCreate = useMemo(
    () => (boardFilters?.priorities || []).map((p: any) => ({ id: p.id, name: p.displayName || p.name })),
    [boardFilters],
  );
  const membersForCreate = useMemo(
    () => (projectMembers || []).map((m: any) => ({
      id: m.user?.id || m.userId,
      displayName: m.user?.displayName || m.user?.email || '',
    })),
    [projectMembers],
  );

  const { openIssue } = useIssueModal();

  const handleClickIssue = useCallback((issue: any) => {
    openIssue(issue.id, selectedProjectId || undefined);
  }, [openIssue, selectedProjectId]);

  const openCreateIssue = useCallback((statusId?: string) => {
    setCreateIssueStatusId(statusId);
    setIsCreateIssueOpen(true);
  }, []);

  const getIssueMoveResult = useCallback(
    (
      currentColumns: any[],
      issueId: string,
      overId: string,
      options?: { isOverColumn?: boolean; overSortableIndex?: number; dragDeltaY?: number }
    ) => {
      const sourceColumnIndex = currentColumns.findIndex((col) =>
        col.issues.some((iss: any) => iss.id === issueId),
      );
      const targetColumnIndex = currentColumns.findIndex(
        (col) => col.id === overId || col.issues.some((iss: any) => iss.id === overId),
      );
      if (sourceColumnIndex === -1 || targetColumnIndex === -1) return null;

      const sourceColumn = currentColumns[sourceColumnIndex];
      const targetColumn = currentColumns[targetColumnIndex];
      const sourceIssues = [...sourceColumn.issues];
      const movingIssueIndex = sourceIssues.findIndex((iss: any) => iss.id === issueId);
      if (movingIssueIndex === -1) return null;

      if (sourceColumnIndex === targetColumnIndex) {
        const overIssueIndex = sourceIssues.findIndex((iss: any) => iss.id === overId);
        let newIndex = typeof options?.overSortableIndex === 'number' ? options.overSortableIndex : overIssueIndex;
        if (newIndex < 0 || options?.isOverColumn) {
          newIndex = typeof options?.dragDeltaY === 'number' && options.dragDeltaY < 0 ? 0 : sourceIssues.length - 1;
        }
        const boundedNewIndex = Math.max(0, Math.min(newIndex, sourceIssues.length - 1));
        if (movingIssueIndex === boundedNewIndex) return null;
        const reorderedIssues = arrayMove(sourceIssues, movingIssueIndex, boundedNewIndex);
        const nextColumns = [...currentColumns];
        nextColumns[sourceColumnIndex] = { ...sourceColumn, issues: reorderedIssues };
        return {
          nextColumns,
          fromStatusId: sourceColumn.id,
          toStatusId: targetColumn.id,
        };
      }

      const [movingIssue] = sourceIssues.splice(movingIssueIndex, 1);
      const targetIssues = [...targetColumn.issues];
      let insertIndex = targetIssues.length;
      const overIssueIndex = targetIssues.findIndex((iss: any) => iss.id === overId);
      if (overIssueIndex >= 0) {
        insertIndex = overIssueIndex;
      } else if (
        options?.isOverColumn &&
        typeof options?.dragDeltaY === 'number' &&
        options.dragDeltaY < 0
      ) {
        insertIndex = 0;
      }
      targetIssues.splice(insertIndex, 0, movingIssue);

      const nextColumns = [...currentColumns];
      nextColumns[sourceColumnIndex] = { ...sourceColumn, issues: sourceIssues };
      nextColumns[targetColumnIndex] = { ...targetColumn, issues: targetIssues };
      return {
        nextColumns,
        fromStatusId: sourceColumn.id,
        toStatusId: targetColumn.id,
      };
    },
    [],
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const issueId = active.id as string;
    const dropTargetId = over.id as string;
    const issueExists = columns.some((col) => col.issues.some((iss: any) => iss.id === issueId));
    if (!issueExists) return;

    const isOverColumn = columns.some((column) => column.id === dropTargetId);
    const overSortableIndex = over?.data?.current?.sortable?.index;
    const moveResult = getIssueMoveResult(columns, issueId, dropTargetId, {
      isOverColumn,
      overSortableIndex: typeof overSortableIndex === 'number' ? overSortableIndex : undefined,
      dragDeltaY: typeof event.delta?.y === 'number' ? event.delta.y : undefined,
    });
    if (!moveResult) return;

    const previousColumns = columns;
    // Skip the next baseColumns sync so the server refetch doesn't
    // overwrite our optimistic column state.
    skipNextSync.current = true;
    setColumns(moveResult.nextColumns);

    if (moveResult.fromStatusId === moveResult.toStatusId) return;

    try {
      await updateIssue({
        issueId,
        data: { statusId: moveResult.toStatusId },
      }).unwrap();
      message.success('Task updated');
    } catch (err: any) {
      skipNextSync.current = false;
      setColumns(previousColumns);
      message.error(err?.data?.error?.message || 'Failed to update task status');
    }
  }, [columns, getIssueMoveResult, updateIssue]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>

      {/* Top Bar */}
      <header style={{
        height: 56, background: C.card, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.textMuted, fontSize: 13, fontWeight: 600,
            padding: '6px 10px', borderRadius: 8,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = C.primaryBg; e.currentTarget.style.color = C.primary; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.textMuted; }}
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div style={{ width: 1, height: 24, background: C.border }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${C.primary} 0%, #06b6d4 100%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FolderOpen size={16} color="#fff" />
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, color: C.text, letterSpacing: '-0.02em' }}>Project Hub</span>
        </div>

        {/* Active filters */}
        <div style={{ flex: 1 }} />
        {selectedProject && (
          <Tag color="blue" closable onClose={() => { setSelectedProjectId(null); setSelectedUserId(null); }} style={{ borderRadius: 8, fontWeight: 600, fontSize: 12 }}>
            <Briefcase size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            {selectedProject.name}
          </Tag>
        )}
        {selectedUser && (
          <Tag color="purple" closable onClose={() => setSelectedUserId(null)} style={{ borderRadius: 8, fontWeight: 600, fontSize: 12 }}>
            <User size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            {selectedUser.displayName}
          </Tag>
        )}
        {(selectedProjectId || selectedUserId) && (
          <button
            onClick={() => { setSelectedProjectId(null); setSelectedUserId(null); setProjectSearch(''); setUserSearch(''); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '3px 10px', fontSize: 12, fontWeight: 600, color: C.textMuted,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = C.danger; e.currentTarget.style.borderColor = C.danger; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.textMuted; e.currentTarget.style.borderColor = C.border; }}
          >
            <FilterX size={12} /> Clear all
          </button>
        )}
      </header>

      {/* Content — 3 panels */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: 0, overflow: 'hidden' }}>

        {/* Left Panel — Projects (split 70/30: ongoing / done) */}
        <section style={{ borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            padding: '14px 16px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Briefcase size={15} color={C.primary} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Projects</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, background: '#f1f5f9', padding: '1px 6px', borderRadius: 8 }}>{projects.length}</span>
            </div>
          </div>
          <div style={{ padding: '8px 12px 4px' }}>
            <Input
              prefix={<Search size={13} color={C.textLight} />}
              placeholder="Search..."
              value={projectSearch}
              onChange={e => setProjectSearch(e.target.value)}
              allowClear size="small"
              style={{ borderRadius: 8 }}
            />
          </div>

          {/* Split: 70% ongoing, 30% done */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Ongoing Projects — 70% */}
            <div style={{ flex: 7, overflowY: 'auto', padding: '4px 8px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{
                padding: '6px 8px', fontSize: 11, fontWeight: 700, color: C.success,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                display: 'flex', alignItems: 'center', gap: 6,
                position: 'sticky', top: 0, background: C.bg, zIndex: 1,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.success }} />
                Ongoing
                <span style={{ color: C.textMuted, fontWeight: 600 }}>
                  ({projects.filter(p => p.status === 'active' || p.status === 'on_hold').length})
                </span>
              </div>
              {projectsLoading ? (
                <Skeleton active paragraph={{ rows: 3 }} style={{ padding: 8 }} />
              ) : (
                projects
                  .filter(p => p.status === 'active' || p.status === 'on_hold')
                  .map(project => {
                    const isActive = project.id === selectedProjectId;
                    const status = STATUS_COLORS[project.status] || STATUS_COLORS.active;
                    return (
                      <div
                        key={project.id}
                        onClick={() => { setSelectedProjectId(isActive ? null : project.id); setSelectedUserId(null); }}
                        style={{
                          padding: '10px 12px', borderRadius: 10, marginBottom: 4,
                          border: `1.5px solid ${isActive ? C.primary : 'transparent'}`,
                          background: isActive ? C.primaryBg : C.card,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f1f5f9'; }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? C.primaryBg : C.card; }}
                      >
                        <div style={{
                          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                          background: isActive
                            ? `linear-gradient(135deg, ${C.primary} 0%, #7c3aed 100%)`
                            : '#e2e8f0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 800, color: isActive ? '#fff' : C.textMuted,
                        }}>
                          {project.key?.slice(0, 3)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{project.key} &middot; <span style={{ color: status.color }}>{project.status}</span></div>
                        </div>
                      </div>
                    );
                  })
              )}
              {!projectsLoading && projects.filter(p => p.status === 'active' || p.status === 'on_hold').length === 0 && (
                <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 12, color: C.textLight }}>No ongoing projects</div>
              )}
            </div>

            {/* Done Projects — 30% */}
            <div style={{ flex: 3, overflowY: 'auto', padding: '4px 8px' }}>
              <div style={{
                padding: '6px 8px', fontSize: 11, fontWeight: 700, color: C.textMuted,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                display: 'flex', alignItems: 'center', gap: 6,
                position: 'sticky', top: 0, background: C.bg, zIndex: 1,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.textMuted }} />
                Completed / Archived
                <span style={{ color: C.textLight, fontWeight: 600 }}>
                  ({projects.filter(p => p.status === 'completed' || p.status === 'archived').length})
                </span>
              </div>
              {projectsLoading ? (
                <Skeleton active paragraph={{ rows: 2 }} style={{ padding: 8 }} />
              ) : (
                projects
                  .filter(p => p.status === 'completed' || p.status === 'archived')
                  .map(project => {
                    const isActive = project.id === selectedProjectId;
                    const status = STATUS_COLORS[project.status] || STATUS_COLORS.archived;
                    return (
                      <div
                        key={project.id}
                        onClick={() => { setSelectedProjectId(isActive ? null : project.id); setSelectedUserId(null); }}
                        style={{
                          padding: '8px 12px', borderRadius: 10, marginBottom: 4,
                          border: `1.5px solid ${isActive ? status.color : 'transparent'}`,
                          background: isActive ? status.bg : C.card,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                          opacity: 0.7, transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; }}
                      >
                        <div style={{
                          width: 30, height: 30, borderRadius: 7, flexShrink: 0,
                          background: project.status === 'completed' ? '#dbeafe' : '#e2e8f0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 800, color: project.status === 'completed' ? '#3b82f6' : C.textMuted,
                        }}>
                          {project.key?.slice(0, 3)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</div>
                          <div style={{ fontSize: 10, color: C.textLight }}>{project.key} &middot; <span style={{ color: status.color }}>{project.status}</span></div>
                        </div>
                      </div>
                    );
                  })
              )}
              {!projectsLoading && projects.filter(p => p.status === 'completed' || p.status === 'archived').length === 0 && (
                <div style={{ padding: '16px 8px', textAlign: 'center', fontSize: 12, color: C.textLight }}>No completed or archived projects</div>
              )}
            </div>
          </div>
        </section>

        {/* Center Panel — Kanban Board */}
        <section style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f1f5f9' }}>
          {!selectedProjectId ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
              <Columns3 size={48} color={C.textLight} strokeWidth={1.2} />
              <div style={{ fontSize: 16, fontWeight: 600, color: C.textMuted }}>Select a project to view the board</div>
              <div style={{ fontSize: 13, color: C.textLight }}>Click a project on the left or a user on the right</div>
            </div>
          ) : (
            <>
              <div style={{
                padding: '10px 16px', borderBottom: `1px solid ${C.border}`, background: C.card,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                  {selectedProject?.name} Board
                  {selectedUser && <span style={{ fontWeight: 400, color: C.textMuted }}> &mdash; {selectedUser.displayName}'s tasks</span>}
                </div>
                <button
                  onClick={() => navigate(`/projects/${selectedProjectId}/board`)}
                  style={{
                    background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
                    padding: '4px 10px', fontSize: 12, fontWeight: 600, color: C.primary,
                    cursor: 'pointer',
                  }}
                >
                  Open full board
                </button>
              </div>

              {/* Board columns — reusing project board components */}
              <div style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', padding: '12px 12px 12px', display: 'flex', gap: 10 }}>
                {boardLoading ? (
                  <div style={{ flex: 1, display: 'flex', gap: 10 }}>
                    {[1, 2, 3].map(i => (
                      <div key={i} style={{ flex: 1, background: C.card, borderRadius: 10, padding: 12 }}>
                        <Skeleton active paragraph={{ rows: 4 }} />
                      </div>
                    ))}
                  </div>
                ) : columns.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Empty description="No board columns configured" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
                      {columns.map((col: any) => (
                        <BoardColumn
                          key={col.id}
                          column={col}
                          projectId={selectedProjectId || undefined}
                          canDrag
                          onIssueUpdate={refetchBoard}
                          onClickIssue={handleClickIssue}
                          onCreateIssue={openCreateIssue}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </>
          )}
        </section>

        {/* Right Panel — Users */}
        <section style={{ borderLeft: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            padding: '14px 16px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={15} color={C.primary} />
              <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                {selectedProjectId ? 'Members' : 'Employees'}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, background: '#f1f5f9', padding: '1px 6px', borderRadius: 8 }}>{users.length}</span>
            </div>
          </div>
          <div style={{ padding: '8px 12px 4px' }}>
            <Input
              prefix={<Search size={13} color={C.textLight} />}
              placeholder={selectedProjectId ? 'Search members...' : 'Search employees...'}
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
              allowClear size="small"
              style={{ borderRadius: 8 }}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
            {(selectedProjectId ? membersLoading : usersLoading) ? (
              <Skeleton active paragraph={{ rows: 4 }} style={{ padding: 12 }} />
            ) : users.length === 0 ? (
              <Empty description={selectedProjectId ? 'No members found' : 'No employees found'} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 40 }} />
            ) : (
              users.map(user => {
                const isActive = user.id === selectedUserId;
                return (
                  <div
                    key={user.id}
                    onClick={() => {
                      setSelectedUserId(isActive ? null : user.id);
                      if (!isActive && !selectedProjectId && projects.length > 0) {
                        setSelectedProjectId(projects[0].id);
                      }
                    }}
                    style={{
                      padding: '10px 12px', borderRadius: 10, marginBottom: 4,
                      border: `1.5px solid ${isActive ? '#8b5cf6' : 'transparent'}`,
                      background: isActive ? '#f5f3ff' : C.card,
                      display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f1f5f9'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = isActive ? '#f5f3ff' : C.card; }}
                  >
                    <Avatar
                      size={32}
                      src={user.avatarUrl}
                      style={{
                        backgroundColor: isActive ? '#8b5cf6' : C.primary,
                        fontWeight: 700, fontSize: 11, flexShrink: 0,
                      }}
                    >
                      {ini(user.displayName || user.email)}
                    </Avatar>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.displayName}
                      </div>
                      <div style={{ fontSize: 10, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.email}
                      </div>
                    </div>
                    {user.role ? (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: C.textMuted,
                        background: '#f1f5f9', padding: '2px 6px', borderRadius: 6,
                        textTransform: 'capitalize', flexShrink: 0,
                      }}>{user.role}</span>
                    ) : user.isActive && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.success, flexShrink: 0 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Create Issue Modal */}
      {selectedProjectId && (
        <CreateIssueModal
          open={isCreateIssueOpen}
          onOpenChange={setIsCreateIssueOpen}
          projectId={selectedProjectId}
          defaultStatusId={createIssueStatusId}
          issueTypes={issueTypesForCreate}
          priorities={prioritiesForCreate}
          members={membersForCreate}
          onSuccess={() => {
            setIsCreateIssueOpen(false);
            refetchBoard();
          }}
        />
      )}
    </div>
  );
}
