// betbrinks Design System - Colors
// Primary: Purple/Violet theme

export const colors = {
  // Primary
  primary: {
    50: '#FAF5FF',
    100: '#F3E8FF',
    200: '#E9D5FF',
    300: '#D8B4FE',
    400: '#C084FC',
    500: '#A855F7',
    600: '#9333EA',
    700: '#7C3AED', // Main brand color
    800: '#6D28D9',
    900: '#5B21B6',
  },

  // Neutral
  gray: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },

  // Semantic
  success: {
    light: '#D1FAE5',
    main: '#10B981',
    dark: '#059669',
  },
  error: {
    light: '#FEE2E2',
    main: '#EF4444',
    dark: '#DC2626',
  },
  warning: {
    light: '#FEF3C7',
    main: '#F59E0B',
    dark: '#D97706',
  },
  info: {
    light: '#DBEAFE',
    main: '#3B82F6',
    dark: '#2563EB',
  },

  // Odds specific
  odds: {
    up: '#10B981',     // Green - odd went up
    down: '#EF4444',   // Red - odd went down
    neutral: '#94A3B8', // Gray - no change
  },

  // Background
  background: {
    primary: '#FFFFFF',
    secondary: '#F8FAFC',
    dark: '#0F172A',
    card: '#FFFFFF',
    overlay: 'rgba(15, 23, 42, 0.5)',
  },

  // Text
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    tertiary: '#94A3B8',
    inverse: '#FFFFFF',
    link: '#7C3AED',
  },

  // Special
  diamond: '#60A5FA',   // Diamond icon color
  points: '#F59E0B',    // Points/coin color
  live: '#EF4444',      // Live badge color
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
} as const;
