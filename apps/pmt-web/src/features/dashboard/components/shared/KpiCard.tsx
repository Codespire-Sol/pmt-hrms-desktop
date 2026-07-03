import React from 'react';
import { motion } from 'framer-motion';

export interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  accentBg?: string;
  delay?: number;
  trend?: number;
}

export function KpiCard({
  icon, label, value, sub,
  accent  = '#1268ff',
  accentBg = 'rgba(18,104,255,0.09)',
  delay = 0,
  trend,
}: KpiCardProps) {
  const hasTrend   = trend !== undefined && trend !== 0;
  const trendUp    = (trend ?? 0) > 0;
  const trendColor = hasTrend ? (trendUp ? '#10b981' : '#ef4444') : '#9ca3af';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '18px',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'default',
        boxShadow: '0 1px 4px rgba(16,24,40,0.05), 0 4px 20px rgba(16,24,40,0.04)',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        height: '100%',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = `0 12px 40px ${accent}20, 0 2px 8px rgba(16,24,40,0.06)`;
        el.style.borderColor = `${accent}40`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.boxShadow = '0 1px 4px rgba(16,24,40,0.05), 0 4px 20px rgba(16,24,40,0.04)';
        el.style.borderColor = '#e5e7eb';
      }}
    >
      {/* Top accent bar */}
      <div style={{
        height: '3px',
        background: `linear-gradient(90deg, ${accent} 0%, ${accent}60 100%)`,
      }} />

      {/* Radial glow bg */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: `radial-gradient(ellipse at top left, ${accent}08 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ padding: '16px 18px 18px', position: 'relative' }}>
        {/* Icon row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '13px',
            background: accentBg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            border: `1.5px solid ${accent}20`,
            boxShadow: `0 4px 12px ${accent}18`,
          }}>
            <span style={{ color: accent, display: 'flex' }}>{icon}</span>
          </div>

          {hasTrend && (
            <span style={{
              fontSize: '10px', fontWeight: 700,
              padding: '3px 8px', borderRadius: '20px',
              color: trendColor, background: `${trendColor}12`,
              border: `1px solid ${trendColor}25`,
              letterSpacing: '0.02em',
              display: 'flex', alignItems: 'center', gap: '2px',
            }}>
              {trendUp ? '↑' : '↓'} {Math.abs(trend!)}%
            </span>
          )}
        </div>

        {/* Value */}
        <div style={{
          fontSize: '28px', fontWeight: 800, color: '#0f172a',
          lineHeight: 1, letterSpacing: '-0.04em', marginBottom: '5px',
          fontFeatureSettings: '"tnum"',
        }}>
          {value}
        </div>

        {/* Label */}
        <div style={{
          fontSize: '11px', fontWeight: 700, color: '#94a3b8',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          marginBottom: sub ? '6px' : 0,
        }}>
          {label}
        </div>

        {/* Sub-text */}
        {sub && (
          <div style={{
            fontSize: '11.5px', color: '#64748b',
            display: 'flex', alignItems: 'center', gap: '5px',
            marginTop: '2px',
          }}>
            <span style={{
              display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
              background: accent, opacity: 0.7, flexShrink: 0,
            }} />
            <span>{sub}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
