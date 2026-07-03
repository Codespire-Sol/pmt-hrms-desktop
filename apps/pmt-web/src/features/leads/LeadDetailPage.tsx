import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Select,
  DatePicker,
  message,
  Skeleton,
  Avatar,
  Tag,
} from 'antd';
import {
  ArrowLeft, Send, Building2, Globe, CalendarDays,
  Clock, Hash, MessageSquare, FileText, Save, TrendingUp,
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useAppSelector } from '../../app/hooks';
import api from '../../lib/api';

dayjs.extend(relativeTime);

// ─── Types ────────────────────────────────────────────────────────────────────

type LeadStatus = 'new' | 'follow_up' | 'qualified' | 'won' | 'lost';

interface Lead {
  id: string;
  leadKey: string;
  name: string;
  company?: string | null;
  source?: string | null;
  status: LeadStatus;
  remarks?: string | null;
  followUpDate?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface LeadComment {
  id: string;
  leadId: string;
  content: string;
  authorName: string;
  createdBy: string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { label: string; value: LeadStatus }[] = [
  { label: 'New', value: 'new' },
  { label: 'Follow-up', value: 'follow_up' },
  { label: 'Qualified', value: 'qualified' },
  { label: 'Won', value: 'won' },
  { label: 'Lost', value: 'lost' },
];

const SOURCE_OPTIONS = ['LinkedIn', 'Referral', 'Cold call', 'Email', 'Website', 'Other'];

const STATUS_CONFIG: Record<LeadStatus, { bg: string; text: string; border: string; dot: string; label: string }> = {
  new:       { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6', label: 'New' },
  follow_up: { bg: '#fffbeb', text: '#b45309', border: '#fde68a', dot: '#f59e0b', label: 'Follow-up' },
  qualified: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0', dot: '#22c55e', label: 'Qualified' },
  won:       { bg: '#dcfce7', text: '#166534', border: '#86efac', dot: '#16a34a', label: 'Won' },
  lost:      { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', dot: '#ef4444', label: 'Lost' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name: string) {
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#0ea5e9', '#10b981', '#f59e0b'];
  let hash = 0;
  for (const c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Comment Item ─────────────────────────────────────────────────────────────

function CommentItem({ comment, onDelete, canDelete }: { comment: LeadComment; onDelete: () => void; canDelete: boolean }) {
  const initials = getInitials(comment.authorName);
  const color = avatarColor(comment.authorName);

  return (
    <div style={{
      display: 'flex', gap: 12, padding: '14px 0',
      borderBottom: '1px solid #f3f4f6',
    }}>
      <Avatar size={34} style={{ background: color, flexShrink: 0, fontSize: 12, fontWeight: 700 }}>
        {initials}
      </Avatar>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#111' }}>{comment.authorName}</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{dayjs(comment.createdAt).fromNow()}</span>
          </div>
          {canDelete && (
            <button
              onClick={onDelete}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#d1d5db', fontSize: 11, padding: '2px 6px', borderRadius: 4,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#d1d5db')}
            >
              Delete
            </button>
          )}
        </div>
        <p style={{ margin: 0, fontSize: 13.5, color: '#374151', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
          {comment.content}
        </p>
      </div>
    </div>
  );
}

// ─── Sidebar Field ────────────────────────────────────────────────────────────

function SidebarField({ icon: Icon, label, children }: {
  icon: React.ElementType; label: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <Icon size={11} color="#9ca3af" />
        <span style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const navigate = useNavigate();
  const currentUser = useAppSelector((state) => state.auth.user);

  const [lead, setLead] = useState<Lead | null>(null);
  const [loadingLead, setLoadingLead] = useState(true);
  const [saving, setSaving] = useState(false);

  const [comments, setComments] = useState<LeadComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const commentsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!leadId) return;
    void loadLead();
    void loadComments();
  }, [leadId]);

  async function loadLead() {
    try {
      setLoadingLead(true);
      const res = await api.get(`/leads/${leadId}`);
      setLead(res.data?.data ?? null);
    } catch {
      message.error('Failed to load lead');
    } finally {
      setLoadingLead(false);
    }
  }

  async function loadComments() {
    try {
      setLoadingComments(true);
      const res = await api.get(`/leads/${leadId}/comments`);
      setComments(res.data?.data ?? []);
    } catch {
      message.error('Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleSave() {
    if (!lead) return;
    try {
      setSaving(true);
      const res = await api.patch(`/leads/${lead.id}`, {
        name: lead.name,
        company: lead.company || null,
        source: lead.source || null,
        status: lead.status,
        remarks: lead.remarks || null,
        followUpDate: lead.followUpDate || null,
      });
      setLead(res.data?.data ?? lead);
      message.success('Lead saved successfully');
    } catch {
      message.error('Failed to save lead');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddComment() {
    if (!commentText.trim()) return;
    try {
      setSubmittingComment(true);
      const res = await api.post(`/leads/${leadId}/comments`, { content: commentText.trim() });
      setComments((prev) => [...prev, res.data?.data]);
      setCommentText('');
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch {
      message.error('Failed to add comment');
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await api.delete(`/leads/${leadId}/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      message.success('Comment deleted');
    } catch {
      message.error('Failed to delete comment');
    }
  }

  if (loadingLead) {
    return (
      <div style={{ padding: 40, maxWidth: 1100, margin: '0 auto' }}>
        <Skeleton active avatar paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (!lead) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <TrendingUp size={40} color="#d1d5db" style={{ marginBottom: 12 }} />
        <p style={{ color: '#6b7280', fontSize: 15, marginBottom: 16 }}>Lead not found.</p>
        <Button onClick={() => navigate('/lead-tracker')} style={{ borderRadius: 8 }}>Back to Leads</Button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[lead.status];

  return (
    <div style={{ background: '#f8f9fb', minHeight: '100vh' }}>

      {/* ── Sticky Top Bar ── */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '10px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/lead-tracker')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#6b7280', fontSize: 13, fontWeight: 500, padding: '6px 8px',
              borderRadius: 8, transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#111'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280'; }}
          >
            <ArrowLeft size={15} /> Back to Leads
          </button>

          <div style={{ width: 1, height: 18, background: '#e5e7eb' }} />

          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: '#f3f4f6', border: '1px solid #e5e7eb',
            borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700, color: '#374151',
          }}>
            <Hash size={11} /> {lead.leadKey}
          </span>

          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: statusCfg.bg, color: statusCfg.text,
            border: `1px solid ${statusCfg.border}`,
            borderRadius: 20, padding: '3px 12px', fontSize: 12, fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusCfg.dot, display: 'inline-block' }} />
            {statusCfg.label}
          </span>
        </div>

        <Button
          type="primary"
          icon={<Save size={14} />}
          loading={saving}
          onClick={handleSave}
          style={{
            borderRadius: 9, background: '#6366f1', borderColor: '#6366f1',
            fontWeight: 600, height: 36, paddingInline: 20,
          }}
        >
          Save Changes
        </Button>
      </div>

      {/* ── Body ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: 24,
        maxWidth: 1120,
        margin: '0 auto',
        padding: '28px 28px 48px',
      }}>

        {/* ── Left Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Lead Name Card */}
          <div style={{
            background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
            padding: '24px 28px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: `linear-gradient(135deg, ${avatarColor(lead.name)}, ${avatarColor(lead.name)}cc)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 800, color: '#fff',
              }}>
                {getInitials(lead.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Input
                  value={lead.name}
                  onChange={(e) => setLead({ ...lead, name: e.target.value })}
                  variant="borderless"
                  style={{
                    fontSize: 24, fontWeight: 800, color: '#111',
                    padding: 0, lineHeight: 1.2, width: '100%',
                  }}
                  placeholder="Lead name"
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    Created {dayjs(lead.createdAt).format('MMM D, YYYY')}
                  </span>
                  {lead.company && (
                    <>
                      <span style={{ color: '#e5e7eb' }}>·</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6b7280' }}>
                        <Building2 size={11} /> {lead.company}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Remarks Card */}
          <div style={{
            background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
            padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
              <FileText size={14} color="#6366f1" />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>Remarks</span>
            </div>
            <Input.TextArea
              value={lead.remarks ?? ''}
              onChange={(e) => setLead({ ...lead, remarks: e.target.value })}
              placeholder="Add notes, context, or observations about this lead..."
              autoSize={{ minRows: 4, maxRows: 12 }}
              style={{ borderRadius: 10, fontSize: 13.5, color: '#374151', resize: 'none', lineHeight: 1.7 }}
            />
          </div>

          {/* Comments Card */}
          <div style={{
            background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
            overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 24px 14px', borderBottom: '1px solid #f3f4f6',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <MessageSquare size={14} color="#6366f1" />
              <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>Comments</span>
              <span style={{
                background: '#f3f4f6', color: '#6b7280',
                borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 600, marginLeft: 2,
              }}>
                {comments.length}
              </span>
            </div>

            {/* Comment List */}
            <div style={{ padding: '0 24px', maxHeight: 380, overflowY: 'auto' }}>
              {loadingComments ? (
                <div style={{ padding: '20px 0' }}>
                  <Skeleton active avatar paragraph={{ rows: 2 }} />
                </div>
              ) : comments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <MessageSquare size={28} color="#e5e7eb" style={{ marginBottom: 8 }} />
                  <p style={{ color: '#9ca3af', fontSize: 13, margin: 0 }}>No comments yet. Start the conversation!</p>
                </div>
              ) : (
                comments.map((c) => (
                  <CommentItem
                    key={c.id}
                    comment={c}
                    onDelete={() => handleDeleteComment(c.id)}
                    canDelete={c.createdBy === currentUser?.id}
                  />
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Comment Input */}
            <div style={{
              borderTop: '1px solid #f3f4f6',
              padding: '14px 20px',
              display: 'flex', gap: 10, alignItems: 'flex-end',
              background: '#fafafa',
            }}>
              <Avatar
                size={32}
                style={{
                  background: currentUser
                    ? avatarColor(`${currentUser.firstName} ${currentUser.lastName}`)
                    : '#6366f1',
                  flexShrink: 0, fontSize: 11, fontWeight: 700,
                }}
              >
                {currentUser
                  ? `${currentUser.firstName?.[0] ?? ''}${currentUser.lastName?.[0] ?? ''}`.toUpperCase()
                  : 'U'}
              </Avatar>
              <Input.TextArea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment… (Ctrl+Enter to send)"
                autoSize={{ minRows: 1, maxRows: 5 }}
                style={{ borderRadius: 9, flex: 1, fontSize: 13.5 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void handleAddComment();
                  }
                }}
              />
              <Button
                type="primary"
                icon={<Send size={14} />}
                loading={submittingComment}
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                style={{
                  borderRadius: 9, height: 36, width: 36,
                  background: '#6366f1', borderColor: '#6366f1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0,
                }}
                title="Send (Ctrl+Enter)"
              />
            </div>
          </div>
        </div>

        {/* ── Right Sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Details Card */}
          <div style={{
            background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
            padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            position: 'sticky', top: 76,
          }}>
            <p style={{ margin: '0 0 18px', fontWeight: 700, fontSize: 13, color: '#111' }}>Details</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <SidebarField icon={TrendingUp} label="Status">
                <Select
                  value={lead.status}
                  options={STATUS_OPTIONS}
                  onChange={(v: LeadStatus) => setLead({ ...lead, status: v })}
                  style={{ width: '100%' }}
                  size="middle"
                />
              </SidebarField>

              <SidebarField icon={Building2} label="Company">
                <Input
                  value={lead.company ?? ''}
                  placeholder="Company name"
                  onChange={(e) => setLead({ ...lead, company: e.target.value || null })}
                  style={{ borderRadius: 8 }}
                />
              </SidebarField>

              <SidebarField icon={Globe} label="Source">
                <Select
                  allowClear
                  value={lead.source ?? undefined}
                  placeholder="Select source"
                  options={SOURCE_OPTIONS.map((s) => ({ label: s, value: s }))}
                  onChange={(v) => setLead({ ...lead, source: v ?? null })}
                  style={{ width: '100%' }}
                />
              </SidebarField>

              <SidebarField icon={CalendarDays} label="Follow-up Date">
                <DatePicker
                  style={{ width: '100%', borderRadius: 8 }}
                  value={lead.followUpDate ? dayjs(lead.followUpDate) : null}
                  onChange={(d) => setLead({ ...lead, followUpDate: d ? d.toISOString() : null })}
                />
              </SidebarField>

            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#f3f4f6', margin: '20px 0' }} />

            {/* Meta Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <SidebarField icon={Hash} label="Lead Key">
                <Tag style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, borderRadius: 6, width: 'fit-content' }}>
                  {lead.leadKey}
                </Tag>
              </SidebarField>

              <SidebarField icon={Clock} label="Last Updated">
                <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                  {dayjs(lead.updatedAt).format('MMM D, YYYY [at] h:mm A')}
                </span>
              </SidebarField>

              <SidebarField icon={CalendarDays} label="Created">
                <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                  {dayjs(lead.createdAt).format('MMM D, YYYY')}
                </span>
              </SidebarField>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
