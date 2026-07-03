import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Shield, User } from 'lucide-react';
import { Button } from 'antd';
import { useAppSelector } from '../../app/hooks';
import { AdminDashboard } from './components/AdminDashboard';
import { EmployeeDashboard } from './components/EmployeeDashboard';
import { DashboardCustomizer } from './components/DashboardCustomizer';
import { usePermission as usePermissionGuard } from '@/features/rbac/components/PermissionGuard';

type DashView = 'admin' | 'employee';

const GREETING = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const ROLE_META: Record<DashView, { icon: React.ReactNode; label: string; color: string; bg: string; border: string }> = {
  admin:    { icon: <Shield size={12} />,  label: 'Admin',   color: '#f97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.25)' },
  employee: { icon: <User size={12} />,    label: 'Member',  color: '#1268ff', bg: 'rgba(18,104,255,0.1)', border: 'rgba(18,104,255,0.25)' },
};

const EMOJI = () => {
  const h = new Date().getHours();
  if (h < 12) return '☀️';
  if (h < 17) return '🌤️';
  return '🌙';
};

export function DashboardPage() {
  const { user, isAdmin } = useAppSelector((state) => state.auth);
  const { hasPermission: canCreateProject } = usePermissionGuard('projects.create');

  const activeView: DashView = isAdmin ? 'admin' : 'employee';
  const roleMeta = ROLE_META[activeView];

  const subtitles: Record<DashView, string> = {
    admin:    "Organisation-wide overview · all projects & teams",
    employee: "Here's what needs your attention today",
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minHeight: '100vh' }}>

      {/* ─── Premium Header ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          marginBottom: 32,
          borderRadius: 20,
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          boxShadow: '0 0 0 1px rgba(15,23,42,0.04), 0 4px 24px rgba(15,23,42,0.06)',
          background: '#ffffff',
        }}
      >
        {/* Top gradient bar */}
        <div style={{
          height: 3,
          background: activeView === 'admin'
            ? 'linear-gradient(90deg, #f97316 0%, #1268ff 50%, #8b5cf6 100%)'
            : 'linear-gradient(90deg, #1268ff 0%, #06b6d4 50%, #10b981 100%)',
        }} />

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 16,
          padding: '20px 28px 22px',
        }}>
          {/* Left: greeting */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            {/* Emoji icon */}
            <div style={{
              width: 52, height: 52, borderRadius: 16, flexShrink: 0,
              background: activeView === 'admin'
                ? 'linear-gradient(135deg, #f97316 0%, #1268ff 100%)'
                : 'linear-gradient(135deg, #1268ff 0%, #06b6d4 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: activeView === 'admin'
                ? '0 6px 20px rgba(249,115,22,0.3)'
                : '0 6px 20px rgba(18,104,255,0.3)',
              fontSize: 22,
            }}>
              {EMOJI()}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <h1 style={{
                  fontSize: 22, fontWeight: 800, color: '#0f172a',
                  margin: 0, letterSpacing: '-0.03em', lineHeight: 1.1,
                }}>
                  {GREETING()}, {user?.firstName}!
                </h1>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 20,
                  fontSize: 11, fontWeight: 700,
                  color: roleMeta.color, background: roleMeta.bg,
                  border: `1px solid ${roleMeta.border}`,
                }}>
                  {roleMeta.icon}
                  {roleMeta.label}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#64748b', fontWeight: 500 }}>
                {subtitles[activeView]}
              </p>
            </div>
          </div>

          {/* Right: controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <DashboardCustomizer role={activeView} />
            {canCreateProject && (
              <Link to="/projects/new">
                <Button
                  type="primary"
                  icon={<Plus size={15} />}
                  style={{
                    height: 40, borderRadius: 11,
                    backgroundColor: '#1268ff', fontWeight: 700,
                    fontSize: 13,
                    display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: '0 4px 16px rgba(18,104,255,0.35)',
                    border: 'none',
                    paddingInline: 18,
                    letterSpacing: '-0.01em',
                  }}
                >
                  New Project
                </Button>
              </Link>
            )}
          </div>
        </div>
      </motion.div>

      {/* ─── Dashboard Content ──────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {activeView === 'admin'    && <AdminDashboard />}
          {activeView === 'employee' && <EmployeeDashboard />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
