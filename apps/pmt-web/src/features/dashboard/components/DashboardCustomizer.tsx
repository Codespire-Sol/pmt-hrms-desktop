import { useState, useRef } from 'react';
import { Settings2, RotateCcw, Eye, EyeOff, X, AlertCircle, GripVertical } from 'lucide-react';
import { Switch, Drawer, message } from 'antd';
import {
  useGetDashboardPreferencesQuery,
  useUpdateDashboardPreferencesMutation,
  useResetDashboardPreferencesMutation,
} from '../dashboardApi';
import { WidgetType, WIDGET_INFO } from '../types';

const C = {
  primary:   '#1268ff',
  primaryBg: 'rgba(18,104,255,0.08)',
  text:      '#101828',
  textSub:   '#4a5565',
  textMuted: '#6a7282',
  border:    '#e5e7eb',
  bg:        '#f9fafb',
  card:      '#ffffff',
  shadow:    '0 4px 16px rgba(16,24,40,0.06)',
};

export const USER_DASHBOARD_WIDGETS: WidgetType[] = [
  'stats',
  'assigned_issues',
  'recent_activity',
  'project_summaries',
  'sprints_progress',
  'due_soon',
];

export const ADMIN_DASHBOARD_WIDGETS: WidgetType[] = [
  'kpi_cards',
  'projects_overview',
  'gantt_chart',
  'burndown',
  'burnup',
  'velocity_chart',
  'sprint_health_overview',
  'cumulative_flow',
  'issues_by_project',
  'overdue_by_project',
  'top_contributors',
  'system_events',
];

export const MANAGER_DASHBOARD_WIDGETS: WidgetType[] = [
  'kpi_cards',
  'sprint_health',
  'risk_issues',
  'team_workload',
  'team_velocity',
  'throughput_chart',
  'team_activity',
];

interface DashboardCustomizerProps {
  role?: 'admin' | 'manager' | 'employee';
  onPreferencesChange?: () => void;
}

export function DashboardCustomizer({ role = 'employee', onPreferencesChange }: DashboardCustomizerProps) {
  const catalog = role === 'admin' ? ADMIN_DASHBOARD_WIDGETS
                : role === 'manager' ? MANAGER_DASHBOARD_WIDGETS
                : USER_DASHBOARD_WIDGETS;
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Drag state
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const { data: preferences, isLoading, error } = useGetDashboardPreferencesQuery();
  const [updatePreferences, { isLoading: isUpdating }] = useUpdateDashboardPreferencesMutation();
  const [resetPreferences, { isLoading: isResetting }] = useResetDashboardPreferencesMutation();

  const hiddenWidgets = preferences?.hiddenWidgets ?? [];

  // Derive ordered widget list from saved layout y-positions (or default order)
  const savedLayout = preferences?.layout ?? [];
  const orderedWidgets: WidgetType[] = (() => {
    const layoutOrder = savedLayout
      .filter(l => catalog.includes(l.widgetId as WidgetType))
      .sort((a, b) => a.position.y - b.position.y)
      .map(l => l.widgetId as WidgetType);
    // Append any widgets not yet in layout (newly added defaults)
    const missing = catalog.filter(w => !layoutOrder.includes(w));
    return [...layoutOrder, ...missing];
  })();

  const isVisible = (id: WidgetType) => !hiddenWidgets.includes(id);
  const visibleCount = catalog.filter(isVisible).length;

  const toggle = async (widgetId: WidgetType) => {
    const next = isVisible(widgetId)
      ? [...hiddenWidgets, widgetId]
      : hiddenWidgets.filter(id => id !== widgetId);
    try {
      await updatePreferences({ hiddenWidgets: next }).unwrap();
      onPreferencesChange?.();
    } catch {
      message.error('Failed to update preferences');
    }
  };

  const saveOrder = async (newOrder: WidgetType[]) => {
    const layout = newOrder.map((widgetId, idx) => ({
      widgetId,
      position: { x: 0, y: idx, w: 12, h: 4 },
    }));
    try {
      await updatePreferences({ layout }).unwrap();
      onPreferencesChange?.();
    } catch {
      message.error('Failed to save widget order');
    }
  };

  const reset = async () => {
    try {
      await resetPreferences().unwrap();
      setConfirmReset(false);
      onPreferencesChange?.();
      message.success('Dashboard reset to defaults');
    } catch {
      message.error('Failed to reset preferences');
    }
  };

  // ── Drag handlers ────────────────────────────────────────────────────
  const handleDragStart = (idx: number) => {
    dragIdx.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    const fromIdx = dragIdx.current;
    if (fromIdx === null || fromIdx === dropIdx) {
      dragIdx.current = null;
      setDragOverIdx(null);
      return;
    }
    const newOrder = [...orderedWidgets];
    const [moved] = newOrder.splice(fromIdx, 1);
    newOrder.splice(dropIdx, 0, moved);
    dragIdx.current = null;
    setDragOverIdx(null);
    saveOrder(newOrder);
  };

  const handleDragEnd = () => {
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          height: '38px', padding: '0 16px', borderRadius: '10px',
          border: `1.5px solid ${C.border}`, background: C.card,
          display: 'flex', alignItems: 'center', gap: '7px',
          cursor: 'pointer', fontFamily: "'Inter', sans-serif",
          fontSize: '13px', fontWeight: 600, color: C.textSub,
          transition: 'all 0.18s', whiteSpace: 'nowrap',
          boxShadow: '0 1px 3px rgba(16,24,40,0.04)', outline: 'none',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = C.primary;
          el.style.color = C.primary;
          el.style.background = C.primaryBg;
          el.style.boxShadow = '0 0 0 3px rgba(18,104,255,0.08), 0 1px 3px rgba(16,24,40,0.04)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLButtonElement;
          el.style.borderColor = C.border;
          el.style.color = C.textSub;
          el.style.background = C.card;
          el.style.boxShadow = '0 1px 3px rgba(16,24,40,0.04)';
        }}
      >
        <Settings2 size={14} />
        <span>Customize</span>
      </button>

      {/* Drawer */}
      <Drawer
        open={open}
        onClose={() => { setOpen(false); setConfirmReset(false); }}
        placement="right"
        width={Math.min(420, typeof window !== 'undefined' ? window.innerWidth - 32 : 420)}
        closable={false}
        styles={{
          body: { padding: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' },
          mask: { backdropFilter: 'blur(2px)' },
        }}
        style={{ fontFamily: "'Inter', sans-serif" }}
        zIndex={1200}
      >
        {/* ── Drawer Header ─────────────────────────────────────────── */}
        <div style={{
          padding: '20px 24px', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          background: C.card, flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{
                width: 34, height: 34, borderRadius: '9px', background: C.primaryBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Settings2 size={16} color={C.primary} />
              </div>
              <span style={{ fontSize: '16px', fontWeight: 800, color: C.text }}>Customize Dashboard</span>
            </div>
            <div style={{ fontSize: '13px', color: C.textMuted, paddingLeft: '44px' }}>
              <strong style={{ color: C.primary }}>{visibleCount}</strong>
              {' '}of {catalog.length} widgets visible · drag grip to reorder
            </div>
          </div>
          <button
            onClick={() => { setOpen(false); setConfirmReset(false); }}
            style={{
              width: 32, height: 32, borderRadius: '8px', border: `1px solid ${C.border}`,
              background: C.bg, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <X size={15} color={C.textMuted} />
          </button>
        </div>

        {/* ── Drawer Body ───────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{
                  height: 68, borderRadius: '12px', background: C.bg,
                  border: `1px solid ${C.border}`,
                  animation: 'customizerPulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 0.1}s`,
                }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <AlertCircle size={32} color={C.textMuted} style={{ margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>Failed to load preferences</div>
              <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '4px' }}>Check your connection and try again.</div>
            </div>
          ) : (
            <>
              {/* Drag hint */}
              <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <GripVertical size={12} />
                Drag the handle to reorder widgets on your dashboard
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {orderedWidgets.map((widgetId, idx) => {
                  const info = WIDGET_INFO[widgetId];
                  const visible = isVisible(widgetId);
                  const isDragOver = dragOverIdx === idx;

                  return (
                    <div
                      key={widgetId}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '12px 14px', borderRadius: '12px',
                        border: `1.5px solid ${isDragOver ? C.primary : visible ? C.border : C.border + '60'}`,
                        background: isDragOver ? C.primaryBg : visible ? C.card : C.bg,
                        opacity: visible ? 1 : 0.55,
                        transition: 'all 0.15s ease',
                        cursor: 'grab',
                        transform: isDragOver ? 'scale(1.015) translateY(-1px)' : 'scale(1)',
                        boxShadow: isDragOver
                          ? '0 6px 20px rgba(18,104,255,0.18)'
                          : visible ? '0 1px 3px rgba(16,24,40,0.04)' : 'none',
                        userSelect: 'none',
                      }}
                    >
                      {/* Grip handle */}
                      <div
                        style={{ flexShrink: 0, color: C.textMuted, display: 'flex', alignItems: 'center', cursor: 'grab' }}
                        title="Drag to reorder"
                      >
                        <GripVertical size={16} />
                      </div>

                      {/* Eye icon */}
                      <div
                        onClick={(e) => { e.stopPropagation(); if (!isUpdating) toggle(widgetId); }}
                        style={{
                          width: 34, height: 34, borderRadius: '9px', flexShrink: 0,
                          background: visible ? C.primaryBg : C.bg,
                          border: `1px solid ${visible ? 'rgba(18,104,255,0.2)' : C.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        {visible
                          ? <Eye size={15} color={C.primary} />
                          : <EyeOff size={15} color={C.textMuted} />}
                      </div>

                      {/* Widget info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: visible ? C.text : C.textMuted }}>
                          {info.label}
                        </div>
                        <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>
                          {info.description}
                        </div>
                      </div>

                      {/* Position badge */}
                      <div style={{
                        fontSize: '11px', fontWeight: 700, color: C.textMuted,
                        background: C.bg, border: `1px solid ${C.border}`,
                        borderRadius: '6px', padding: '2px 8px', flexShrink: 0,
                      }}>
                        #{idx + 1}
                      </div>

                      {/* Toggle switch */}
                      <Switch
                        checked={visible}
                        onChange={() => toggle(widgetId)}
                        disabled={isUpdating}
                        size="small"
                        style={{ backgroundColor: visible ? C.primary : undefined, flexShrink: 0 }}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Drawer Footer ─────────────────────────────────────────── */}
        <div style={{
          padding: '16px 24px', borderTop: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: C.bg, flexShrink: 0, gap: '12px', flexWrap: 'wrap',
        }}>
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              disabled={isResetting}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '8px', border: `1px solid ${C.border}`,
                background: C.card, cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                fontSize: '13px', fontWeight: 600, color: C.textSub,
              }}
            >
              <RotateCcw size={13} />
              Reset to default
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: C.textSub }}>Reset all widgets?</span>
              <button
                onClick={reset}
                disabled={isResetting}
                style={{
                  padding: '6px 14px', borderRadius: '7px', border: 'none',
                  background: '#ff4d4f', color: '#fff', fontWeight: 700,
                  fontSize: '13px', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                }}
              >
                {isResetting ? 'Resetting…' : 'Yes, reset'}
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                style={{
                  padding: '6px 14px', borderRadius: '7px',
                  border: `1px solid ${C.border}`, background: C.card,
                  color: C.textSub, fontWeight: 600, fontSize: '13px',
                  cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                }}
              >
                Cancel
              </button>
            </div>
          )}
          <button
            onClick={() => { setOpen(false); setConfirmReset(false); }}
            style={{
              height: '38px', padding: '0 22px', borderRadius: '10px',
              border: 'none', background: C.primary, color: '#fff',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              boxShadow: '0 4px 14px rgba(18,104,255,0.3)',
            }}
          >
            Done
          </button>
        </div>
      </Drawer>

      <style>{`
        @keyframes customizerPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
      `}</style>
    </>
  );
}
