export const themeTokens = {
  colors: {
    primary: '#1368FF',           // Figma: Linear Gradient base / #1368FF
    primaryDark: '#0052CC',       // Figma: #0052CC
    primaryForeground: '#ffffff',
    primaryBackground: '#ffffff', // Figma: #FFFFFF
    appBackground: '#F8F9FC',     // Figma: Background color #F8F9FC
    appGradient: 'linear-gradient(180deg, #F8F9FC 0%, #FFFFFF 100%)',
    darkBase: '#101828',
    textPrimary: '#111827',       // Figma: close to #111827 / darkest text
    textSecondary: '#374151',     // Figma: medium body text
    textTertiary: '#6B7280',      // Figma: #6B7280 selection/muted text
    borders: '#E5E7EB',           // Figma: Border color #E5E7EB
    borderLight: '#D1D5DB',       // Figma: #D1D5DB lighter border
    secondaryBackground: '#F8F9FC', // Figma: bg #F8F9FC (used for table header, card bg)
    accent: 'rgba(19, 104, 255, 0.08)',
    success: '#10b981',
    warning: '#faad14',
    danger: '#ff4d4f',
    info: '#1368FF',
    blue50: '#EFF6FF',
    blue100: '#DBEAFE',
    blue600: '#0052CC',           // Figma: #0052CC
    blue700: '#0b3d99',
    blue900: '#031763',
    orange: '#ff6b1a',
    purple: '#5700ff',
    // Page heading color (Dashboard standard)
    heading: '#1E2875',
  },
  typography: {
    fontFamily: "'Inter', sans-serif",
    titles: {
      fontSize: '32px',
      fontWeight: '800',
      color: '#1E2875',
      letterSpacing: '-0.02em',
    },
    subtitles: {
      fontSize: '20px',
      fontWeight: '600',
      color: '#111827',
    },
    body: {
      fontSize: '14px',
      color: '#374151',
    },
    label: {
      fontSize: '12px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: '#6B7280',
    },
  },
  spacing: {
    containerPadding: '24px',
    cardPadding: '24px',
    gapPrimary: '16px',
    gapSecondary: '12px',
    gapTertiary: '8px',
    marginBottomSection: '24px',
    marginBottomSubSection: '16px',
  },
  borderRadius: {
    card: '12px',
    upload: '16px',
    small: '8px',
  },
  shadows: {
    standard: '0 8px 16px rgba(16, 24, 40, 0.06)',
    large: '0 12px 24px rgba(16, 24, 40, 0.08)',
    hover: '0 12px 24px rgba(16, 24, 40, 0.08)',
    subtle: '0 1px 0 rgba(3, 23, 99, 0.04)',
  },
};

export const antdTheme = {
  token: {
    colorPrimary: themeTokens.colors.primary,
    borderRadius: 12,
    fontFamily: themeTokens.typography.fontFamily,
    colorBgContainer: themeTokens.colors.primaryBackground,
    colorBgLayout: themeTokens.colors.appBackground,
    colorText: themeTokens.colors.textPrimary,
    colorTextSecondary: themeTokens.colors.textSecondary,
    colorBorder: themeTokens.colors.borders,
  },
  components: {
    Button: {
      borderRadius: 8,
      controlHeight: 44,
      fontWeight: 500,
    },
    Card: {
      borderRadiusLG: 12,
      boxShadowTertiary: themeTokens.shadows.standard,
    },
    Modal: {
      borderRadiusLG: 16,
      headerBg: '#ffffff',
      contentBg: '#ffffff',
      titleColor: '#1E2875',
      titleFontSize: 16,
      titleLineHeight: 1.5,
      fontWeightStrong: 700,
    },
  },
};
