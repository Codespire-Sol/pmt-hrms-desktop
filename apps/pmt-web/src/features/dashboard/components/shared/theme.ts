/** Shared dark/light color tokens used by all dashboard widgets */
export function getDashboardColors(isDark: boolean) {
  return {
    card:      isDark ? '#1e293b' : '#ffffff',
    cardHover: isDark ? '#253347' : '#fafbff',
    border:    isDark ? '#334155' : '#e5e7eb',
    bg:        isDark ? '#0f172a' : '#f9fafb',
    text:      isDark ? '#f1f5f9' : '#101828',
    textSub:   isDark ? '#94a3b8' : '#4a5565',
    textMuted: isDark ? '#64748b' : '#6a7282',
    shadow:    isDark ? '0 8px 16px rgba(0,0,0,0.35)' : '0 8px 16px rgba(16,24,40,0.06)',
    shadowLg:  isDark ? '0 12px 24px rgba(0,0,0,0.45)' : '0 12px 24px rgba(16,24,40,0.08)',
    tooltip:   { background: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e5e7eb'}`, borderRadius: '8px', boxShadow: isDark ? '0 8px 16px rgba(0,0,0,0.35)' : '0 8px 16px rgba(16,24,40,0.06)', padding: '10px 14px', fontSize: '13px', color: isDark ? '#f1f5f9' : '#101828' },
    // fixed accent colors
    primary: '#1268ff', primaryBg: isDark ? 'rgba(18,104,255,0.15)' : 'rgba(18,104,255,0.08)',
    success: '#10b981', successBg: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.08)',
    warning: '#faad14', warningBg: isDark ? 'rgba(250,173,20,0.15)' : 'rgba(250,173,20,0.08)',
    danger:  '#ff4d4f', dangerBg:  isDark ? 'rgba(255,77,79,0.15)'  : 'rgba(255,77,79,0.08)',
    purple:  '#8b5cf6', purpleBg:  isDark ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.08)',
    orange:  '#ff6b1a', orangeBg:  isDark ? 'rgba(255,107,26,0.15)' : 'rgba(255,107,26,0.08)',
    teal:    '#06b6d4', tealBg:    isDark ? 'rgba(6,182,212,0.15)'  : 'rgba(6,182,212,0.08)',
  };
}
