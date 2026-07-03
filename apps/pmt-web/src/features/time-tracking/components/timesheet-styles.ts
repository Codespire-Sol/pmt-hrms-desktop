// Canonical design tokens for the timesheet feature
// Replaces duplicated COLORS objects across 8+ files

export const TS = {
  // Page
  pageBg: '#F7F9FC',

  // Card
  cardBg: '#FFFFFF',
  cardBorder: '#EAECF0',
  cardRadius: 14,
  cardShadow: '0 1px 3px rgba(16,24,40,0.04), 0 1px 2px rgba(16,24,40,0.02)',
  cardShadowHover: '0 4px 12px rgba(16,24,40,0.08)',

  // Text hierarchy
  textPrimary: '#101828',
  textSecondary: '#475467',
  textTertiary: '#667085',
  textMuted: '#98A2B3',

  // Brand / Accent
  primary: '#1268ff',
  primaryLight: 'rgba(18,104,255,0.08)',
  primaryBorder: 'rgba(18,104,255,0.2)',

  // Semantic
  success: '#079455',
  successBg: '#ECFDF3',
  warning: '#DC6803',
  warningBg: '#FFFAEB',
  danger: '#D92D20',
  dangerBg: '#FEF3F2',

  // Borders & Surfaces
  border: '#EAECF0',
  borderSubtle: '#F2F4F7',
  surfaceHover: '#F9FAFB',
  surfaceActive: '#F5F8FF',

  // Grid-specific
  gridHeaderBg: '#F8FAFC',
  gridRowAlt: '#FAFAFA',
  gridTodayTint: 'rgba(18,104,255,0.06)',
  gridWeekendBg: '#FAFBFD',
  gridTotalsBg: '#F5F8FF',

  // Transitions
  transitionFast: '150ms ease-out',
  transitionNormal: '200ms ease-out',
  transitionSlow: '300ms ease-out',
} as const;

// Reusable Tailwind class presets
export const cardClass =
  'bg-white border border-[#eaecf0] rounded-[14px] shadow-[0_1px_3px_rgba(16,24,40,0.04),0_1px_2px_rgba(16,24,40,0.02)]';

export const cardHoverClass =
  'hover:shadow-[0_4px_12px_rgba(16,24,40,0.08)] hover:-translate-y-[1px] transition-all duration-200';

export const tooltipClass =
  'bg-white/95 backdrop-blur-sm border border-[#F2F4F7] rounded-xl px-3 py-2 shadow-lg text-sm';

// Segmented control container
export const segmentedContainerClass =
  'bg-[#F2F4F7] rounded-xl p-0.5 flex gap-0.5 w-fit';

// Segmented control segment (active)
export const segmentActiveClass =
  'bg-white text-[#101828] shadow-sm rounded-[10px] px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-150';

// Segmented control segment (inactive)
export const segmentInactiveClass =
  'text-[#667085] rounded-[10px] px-3.5 py-1.5 text-[13px] font-semibold hover:text-[#475467] transition-all duration-150';

// Grid cell heatmap colours
export function cellColors(hours: number): { bg: string; text: string; border: string } {
  if (hours === 0) return { bg: 'transparent', text: '#cbd5e1', border: '#E4E7EC' };
  if (hours < 1) return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
  if (hours < 2) return { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' };
  if (hours < 4) return { bg: '#93c5fd', text: '#1e3a8a', border: '#60a5fa' };
  if (hours < 6) return { bg: '#3b82f6', text: '#ffffff', border: '#2563eb' };
  if (hours < 8) return { bg: '#2563eb', text: '#ffffff', border: '#1d4ed8' };
  return { bg: '#1d4ed8', text: '#ffffff', border: '#1e40af' };
}

// Utilization color helper
export function getUtilColor(pct: number) {
  if (pct >= 90) return { fg: TS.success, bg: TS.successBg };
  if (pct >= 70) return { fg: TS.warning, bg: TS.warningBg };
  return { fg: TS.danger, bg: TS.dangerBg };
}
