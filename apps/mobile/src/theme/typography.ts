import { TextStyle } from 'react-native';

export const fontFamily = {
  regular: 'System',
  medium: 'System',
  semibold: 'System',
  bold: 'System',
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
};

export const typography: Record<string, TextStyle> = {
  // Headings
  h1: { fontSize: fontSize['4xl'], fontWeight: '700', lineHeight: 44 },
  h2: { fontSize: fontSize['3xl'], fontWeight: '700', lineHeight: 38 },
  h3: { fontSize: fontSize['2xl'], fontWeight: '600', lineHeight: 32 },
  h4: { fontSize: fontSize.xl, fontWeight: '600', lineHeight: 28 },

  // Body
  bodyLg: { fontSize: fontSize.lg, fontWeight: '400', lineHeight: 24 },
  body: { fontSize: fontSize.md, fontWeight: '400', lineHeight: 22 },
  bodySm: { fontSize: fontSize.sm, fontWeight: '400', lineHeight: 20 },
  bodyXs: { fontSize: fontSize.xs, fontWeight: '400', lineHeight: 16 },

  // Labels
  labelLg: { fontSize: fontSize.lg, fontWeight: '600', lineHeight: 24 },
  label: { fontSize: fontSize.md, fontWeight: '600', lineHeight: 22 },
  labelSm: { fontSize: fontSize.sm, fontWeight: '600', lineHeight: 20 },

  // Special
  oddValue: { fontSize: fontSize.lg, fontWeight: '700', lineHeight: 24 },
  points: { fontSize: fontSize.xl, fontWeight: '700', lineHeight: 28 },
  badge: { fontSize: fontSize.xs, fontWeight: '700', lineHeight: 16, textTransform: 'uppercase' },
};
