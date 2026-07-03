import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, FolderKanban, LayoutGrid, List as ListIcon,
  Users, AlertCircle, CheckCircle2, ArrowRight, Calendar, Clock,
} from 'lucide-react';
import { useGetProjectsQuery } from './projectsApi';
import { useAppSelector } from '@/app/hooks';
import { Typography, Input, Card, Row, Col, Space, Skeleton, Select } from 'antd';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

const { Title, Text, Paragraph } = Typography;

const COLORS = {
  primary: '#1268ff',
  primaryLight: 'rgba(18, 104, 255, 0.08)',
  appBackground: '#f9fafb',
  textPrimary: '#101828',
  textSecondary: '#4a5565',
  border: '#e5e7eb',
  shadow: '0 4px 12px rgba(16, 24, 40, 0.06)',
  shadowLg: '0 12px 24px rgba(16, 24, 40, 0.1)',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All status' },
  { value: 'active', label: 'Active' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

function getStatusStyle(status: string) {
  switch (status) {
    case 'active':    return { bg: 'rgba(16,185,129,0.1)', color: COLORS.success,       dot: COLORS.success };
    case 'on_hold':   return { bg: 'rgba(245,158,11,0.1)', color: COLORS.warning,       dot: COLORS.warning };
    case 'completed': return { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6',            dot: '#3b82f6' };
    case 'archived':  return { bg: '#f2f4f7',              color: COLORS.textSecondary,  dot: '#9ca3af' };
    default:          return { bg: COLORS.primaryLight,    color: COLORS.primary,        dot: COLORS.primary };
  }
}

// Format a date string like "2026-02-19T00:00:00.000Z" → "Feb 19, 2026"
function fmtDate(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return null; }
}

// Check if a date is past today
function isOverdue(iso?: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

// Resolve memberCount from either statistics sub-object or top-level snake_case field
function memberCount(project: any): number {
  return project.statistics?.memberCount ?? project.member_count ?? 0;
}

// Compute completion % from completedIssues / totalIssues
function computeCompletion(project: any): number {
  const total = project.statistics?.totalIssues ?? project.issue_count ?? 0;
  const done  = project.statistics?.completedIssues ?? project.completed_issues ?? 0;
  if (!total) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

export function ProjectsListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [viewType, setViewType] = useState<'grid' | 'list'>('grid');

  const { isAdmin } = useAppSelector((state) => state.auth);
  const { data, isLoading } = useGetProjectsQuery({ search, status: statusFilter || undefined });
  const { hasPermission: canCreateProject } = usePermissionGuard('projects.create');

  const canCreate = canCreateProject || isAdmin;
  const projects = data?.projects ?? [];

  const totalIssues  = projects.reduce((s, p) => s + (p.statistics?.totalIssues ?? (p as any).issue_count ?? 0), 0);
  const totalMembers = projects.reduce((s, p) => s + memberCount(p), 0);
  const activeCount  = projects.filter((p) => p.status === 'active').length;
  const healthyCount = projects.filter((p) => computeCompletion(p) >= 80).length;

  return (
    <div style={{ padding: '0' }}>

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <Title level={2} style={{ fontSize: '30px', fontWeight: 700, color: COLORS.textPrimary, margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
            Projects
          </Title>
          <Text style={{ fontSize: '15px', color: COLORS.textSecondary }}>
            Manage and track all your projects in one place.
          </Text>
        </div>
        {canCreate && (
          <button
            onClick={() => navigate('/projects/new')}
            className="create-btn"
            style={{
              height: '44px', borderRadius: '10px', border: 'none', cursor: 'pointer',
              backgroundColor: COLORS.primary, color: '#fff', fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '0 20px', fontSize: '14px', fontFamily: 'inherit',
              boxShadow: '0 4px 12px rgba(18,104,255,0.28)', transition: 'all 0.2s',
            }}
          >
            <Plus size={16} /> New Project
          </button>
        )}
      </div>

      {/* ── Summary Stats ── */}
      {!isLoading && projects.length > 0 && (
        <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
          {[
            { icon: <FolderKanban size={20} color="#fff" />, bg: COLORS.primary,  value: projects.length, label: 'Total Projects', sub: `${activeCount} active` },
            { icon: <AlertCircle  size={20} color="#fff" />, bg: COLORS.warning,  value: totalIssues,     label: 'Total Issues',   sub: 'across all projects' },
            { icon: <Users        size={20} color="#fff" />, bg: COLORS.purple,   value: totalMembers,    label: 'Team Members',   sub: 'across all projects' },
            { icon: <CheckCircle2 size={20} color="#fff" />, bg: COLORS.success,  value: healthyCount,    label: 'Healthy Projects', sub: '≥ 80% complete' },
          ].map((stat) => (
            <Col key={stat.label} xs={24} sm={12} xl={6}>
              <Card
                style={{ border: `1px solid ${COLORS.border}`, borderRadius: '12px', boxShadow: COLORS.shadow, height: '100%' }}
                styles={{ body: { padding: '18px 20px' } }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '11px', backgroundColor: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {stat.icon}
                  </div>
                  <div>
                    <span style={{ fontSize: '26px', fontWeight: 800, color: COLORS.textPrimary, lineHeight: 1, display: 'block', letterSpacing: '-0.03em' }}>{stat.value}</span>
                    <Text style={{ fontSize: '13px', fontWeight: 600, color: COLORS.textPrimary, display: 'block', lineHeight: 1.3 }}>{stat.label}</Text>
                    <Text style={{ fontSize: '11px', color: '#9ca3af' }}>{stat.sub}</Text>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {/* ── Search / Filter Bar ── */}
      <Card
        style={{ marginBottom: '24px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, boxShadow: '0 1px 2px rgba(16,24,40,0.05)' }}
        styles={{ body: { padding: '14px 20px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Space size={12} wrap>
            <Input
              placeholder="Search projects by name or key..."
              prefix={<Search size={16} color={COLORS.textSecondary} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
              style={{ width: '320px', height: '40px', borderRadius: '8px', fontSize: '14px' }}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
              style={{ width: '140px', height: '40px' }}
            />
          </Space>
          <div style={{ display: 'flex', gap: '1px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
            {(['grid', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setViewType(v)}
                style={{
                  width: '40px', height: '40px', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: viewType === v ? COLORS.primary : '#fff',
                  color: viewType === v ? '#fff' : COLORS.textSecondary,
                  transition: 'all 0.15s',
                }}
              >
                {v === 'grid' ? <LayoutGrid size={16} /> : <ListIcon size={16} />}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Main Content ── */}
      {isLoading ? (
        <Row gutter={[20, 20]}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Col key={i} xs={24} md={12} lg={8}>
              <Card style={{ borderRadius: '16px', border: `1px solid ${COLORS.border}`, height: '100%' }}>
                <Skeleton active avatar paragraph={{ rows: 4 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : projects.length === 0 ? (
        <Card style={{ borderRadius: '16px', border: `1px solid ${COLORS.border}`, boxShadow: COLORS.shadow }}>
          <div style={{ padding: '64px 0', textAlign: 'center' }}>
            <div style={{ width: '72px', height: '72px', borderRadius: '18px', backgroundColor: COLORS.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <FolderKanban size={36} color={COLORS.primary} strokeWidth={1.5} />
            </div>
            <Title level={4} style={{ color: COLORS.textPrimary, marginBottom: '8px' }}>
              {search ? 'No projects match your search' : 'No projects yet'}
            </Title>
            <Text style={{ fontSize: '15px', color: COLORS.textSecondary, display: 'block', marginBottom: '24px' }}>
              {search ? 'Try a different name or clear the filter.' : 'Create your first project to start organizing work.'}
            </Text>
            {canCreate && !search && (
              <button
                onClick={() => navigate('/projects/new')}
                style={{
                  height: '44px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  backgroundColor: COLORS.primary, color: '#fff', fontWeight: 600,
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  padding: '0 24px', fontSize: '14px', fontFamily: 'inherit',
                }}
              >
                <Plus size={16} /> Create your first project
              </button>
            )}
          </div>
        </Card>
      ) : viewType === 'grid' ? (

        /* ── Grid View ── */
        <Row gutter={[20, 20]} align="stretch">
          {projects.map((project) => {
            const ss         = getStatusStyle(project.status);
            const completion = computeCompletion(project);
            const totalIss   = project.statistics?.totalIssues   ?? (project as any).issue_count         ?? 0;
            const doneIss    = project.statistics?.completedIssues ?? (project as any).completed_issues  ?? 0;
            const inProg     = project.statistics?.inProgressIssues ?? (project as any).in_progress_issues ?? 0;
            const openIss    = project.statistics?.openIssues    ?? (project as any).open_issues         ?? 0;
            const members    = memberCount(project);
            const startDate  = fmtDate((project as any).start_date ?? project.startDate);
            const endDate    = fmtDate((project as any).target_end_date ?? project.targetEndDate);
            const overdue    = endDate && isOverdue((project as any).target_end_date ?? project.targetEndDate) && project.status === 'active';

            return (
              <Col key={project.id} xs={24} md={12} xl={8} style={{ display: 'flex' }}>
                <div
                  className="project-card"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  style={{
                    width: '100%',
                    borderRadius: '16px',
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: COLORS.shadow,
                    backgroundColor: '#fff',
                    transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Gradient top bar */}
                  <div style={{ height: '4px', background: `linear-gradient(90deg, ${COLORS.primary}, #60a5fa)` }} />

                  <div style={{ padding: '20px 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: 0 }}>

                    {/* ── Row 1: Icon + Status badge ── */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                      <div style={{ width: '46px', height: '46px', borderRadius: '12px', backgroundColor: COLORS.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FolderKanban size={22} color={COLORS.primary} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: ss.dot, display: 'inline-block' }} />
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', backgroundColor: ss.bg, color: ss.color }}>
                          {project.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    {/* ── Row 2: Name + Description ── */}
                    <div style={{ marginBottom: '12px', flex: 1 }}>
                      <Text style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '3px' }}>
                        {project.key}
                      </Text>
                      <Title level={4} style={{ margin: '0 0 6px', fontSize: '17px', fontWeight: 700, color: COLORS.textPrimary, lineHeight: 1.3 }}>
                        {project.name}
                      </Title>
                      <Paragraph style={{ fontSize: '13px', color: COLORS.textSecondary, margin: 0, lineHeight: 1.5 }} ellipsis={{ rows: 2 }}>
                        {project.description || 'No description provided.'}
                      </Paragraph>
                    </div>

                    {/* ── Row 3: Dates ── */}
                    {(startDate || endDate) && (
                      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                        {startDate && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Calendar size={12} color="#94a3b8" />
                            <Text style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>Start: {startDate}</Text>
                          </div>
                        )}
                        {endDate && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Clock size={12} color={overdue ? COLORS.danger : '#94a3b8'} />
                            <Text style={{ fontSize: '11px', color: overdue ? COLORS.danger : '#94a3b8', fontWeight: overdue ? 600 : 500 }}>
                              Due: {endDate}
                            </Text>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── Row 4: Lead ── */}
                    {(project.lead || project.owner) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                        <LeadAvatar name={(project.lead ?? project.owner)!.displayName} avatarUrl={(project.lead ?? project.owner)!.avatarUrl} />
                        <Text style={{ fontSize: '11px', color: COLORS.textSecondary, fontWeight: 500 }}>
                          {project.lead ? `Lead: ${project.lead.displayName}` : `Owner: ${project.owner!.displayName}`}
                        </Text>
                      </div>
                    )}

                    {/* ── Row 5: Completion bar ── */}
                    {totalIss > 0 && (
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <Text style={{ fontSize: '11px', color: COLORS.textSecondary, fontWeight: 500 }}>Completion</Text>
                          <Text style={{ fontSize: '11px', fontWeight: 700, color: completion >= 80 ? COLORS.success : COLORS.primary }}>{completion}%</Text>
                        </div>
                        <div style={{ width: '100%', height: '5px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${completion}%`, height: '100%', borderRadius: '3px', background: completion >= 80 ? `linear-gradient(90deg, ${COLORS.success}, #34d399)` : `linear-gradient(90deg, ${COLORS.primary}, #60a5fa)`, transition: 'width 0.5s ease' }} />
                        </div>
                      </div>
                    )}

                    {/* ── Row 6: Stats row ── */}
                    <div style={{ display: 'flex', borderTop: `1px solid ${COLORS.border}`, paddingTop: '14px', justifyContent: 'space-between' }}>
                      {[
                        { val: totalIss, label: 'Issues',      color: COLORS.textPrimary },
                        { val: openIss,  label: 'Open',        color: COLORS.warning },
                        { val: inProg,   label: 'In Progress', color: COLORS.primary },
                        { val: doneIss,  label: 'Done',        color: COLORS.success },
                        { val: members,  label: 'Members',     color: COLORS.purple },
                      ].map((s, i, arr) => (
                        <div key={s.label} style={{ flex: 1, textAlign: 'center', borderRight: i < arr.length - 1 ? `1px solid ${COLORS.border}` : 'none', padding: '0 4px' }}>
                          <Text style={{ display: 'block', fontSize: '17px', fontWeight: 800, color: s.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.val}</Text>
                          <Text style={{ fontSize: '10px', color: COLORS.textSecondary, fontWeight: 500 }}>{s.label}</Text>
                        </div>
                      ))}
                    </div>

                    {/* ── Row 7: Footer ── */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                      {overdue ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <AlertCircle size={13} color={COLORS.danger} />
                          <Text style={{ fontSize: '12px', color: COLORS.danger, fontWeight: 600 }}>Overdue</Text>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <CheckCircle2 size={13} color={COLORS.success} />
                          <Text style={{ fontSize: '12px', color: COLORS.success, fontWeight: 500 }}>On track</Text>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: COLORS.primary, fontSize: '12px', fontWeight: 600 }}>
                        Open <ArrowRight size={13} />
                      </div>
                    </div>
                  </div>
                </div>
              </Col>
            );
          })}

          {/* ── New Project Card ── */}
          {canCreate && (
            <Col xs={24} md={12} xl={8} style={{ display: 'flex' }}>
              <div
                className="new-project-card"
                onClick={() => navigate('/projects/new')}
                style={{
                  width: '100%',
                  borderRadius: '16px',
                  border: `2px dashed ${COLORS.border}`,
                  backgroundColor: '#fafafa',
                  minHeight: '260px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', backgroundColor: COLORS.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={24} color={COLORS.primary} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Text style={{ display: 'block', fontWeight: 700, fontSize: '15px', color: COLORS.textPrimary }}>New Project</Text>
                  <Text style={{ fontSize: '13px', color: COLORS.textSecondary }}>Click to create a new project</Text>
                </div>
              </div>
            </Col>
          )}
        </Row>
      ) : (

        /* ── List View ── */
        <div style={{ borderRadius: '16px', overflow: 'hidden', border: `1px solid ${COLORS.border}`, boxShadow: COLORS.shadow }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 80px 70px 70px 80px 110px 40px', gap: '0 12px', padding: '12px 24px', backgroundColor: '#f8fafc', borderBottom: `1px solid ${COLORS.border}` }}>
            {['Project', 'Issues', 'Open', 'In Progress', 'Done', 'Members', 'Status', ''].map((h) => (
              <Text key={h} style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: h === 'Project' ? 'left' : 'center' }}>
                {h}
              </Text>
            ))}
          </div>
          {projects.map((project, idx) => {
            const ss      = getStatusStyle(project.status);
            const totalIss = project.statistics?.totalIssues   ?? (project as any).issue_count         ?? 0;
            const doneIss  = project.statistics?.completedIssues ?? (project as any).completed_issues  ?? 0;
            const inProg   = project.statistics?.inProgressIssues ?? (project as any).in_progress_issues ?? 0;
            const openIss  = project.statistics?.openIssues    ?? (project as any).open_issues         ?? 0;
            const members  = memberCount(project);
            return (
              <div
                key={project.id}
                className="project-list-row"
                onClick={() => navigate(`/projects/${project.id}`)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 70px 80px 70px 70px 80px 110px 40px',
                  gap: '0 12px',
                  padding: '14px 24px',
                  alignItems: 'center',
                  backgroundColor: '#fff',
                  cursor: 'pointer',
                  borderBottom: idx < projects.length - 1 ? `1px solid #f1f5f9` : 'none',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: COLORS.primaryLight, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FolderKanban size={18} color={COLORS.primary} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Text style={{ fontSize: '11px', fontWeight: 700, color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{project.key}</Text>
                    </div>
                    <Text strong style={{ fontSize: '14px', color: COLORS.textPrimary, display: 'block' }} ellipsis={{ tooltip: project.name }}>{project.name}</Text>
                    <Text style={{ fontSize: '12px', color: COLORS.textSecondary }} ellipsis={{ tooltip: project.description ?? '' }}>{project.description || 'No description'}</Text>
                  </div>
                </div>
                <Text strong style={{ textAlign: 'center', display: 'block', fontSize: '15px', color: COLORS.textPrimary }}>{totalIss}</Text>
                <Text strong style={{ textAlign: 'center', display: 'block', fontSize: '15px', color: COLORS.warning }}>{openIss}</Text>
                <Text strong style={{ textAlign: 'center', display: 'block', fontSize: '15px', color: COLORS.primary }}>{inProg}</Text>
                <Text strong style={{ textAlign: 'center', display: 'block', fontSize: '15px', color: COLORS.success }}>{doneIss}</Text>
                <Text strong style={{ textAlign: 'center', display: 'block', fontSize: '15px', color: COLORS.purple }}>{members}</Text>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', backgroundColor: ss.bg, color: ss.color }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: ss.dot, display: 'inline-block' }} />
                    {project.status.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <ArrowRight size={16} color={COLORS.textSecondary} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .project-card:hover {
          transform: translateY(-4px);
          box-shadow: ${COLORS.shadowLg} !important;
          border-color: rgba(18,104,255,0.3) !important;
        }
        .new-project-card:hover {
          border-color: ${COLORS.primary} !important;
          background-color: ${COLORS.primaryLight} !important;
        }
        .project-list-row:hover { background-color: #f8fafc !important; }
        .create-btn:hover { opacity: 0.92; transform: translateY(-1px); }
      `}</style>
    </div>
  );
}

// ── Small inline components ──────────────────────────────────────────────────
function LeadAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name}
      style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
    />
  ) : (
    <div style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: COLORS.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: COLORS.primary, flexShrink: 0 }}>
      {initials}
    </div>
  );
}
