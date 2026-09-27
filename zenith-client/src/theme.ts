import { cubicBezier, Easing } from 'react-native-reanimated';

/**
 * Zenith design tokens. "Dark, clean, teal": OLED-friendly neutrals with a
 * faint teal cast so surfaces feel related to the accent instead of grey.
 */
export const colors = {
  background: '#0E1111',
  surface: '#161B1B',
  surfaceRaised: '#1E2525',
  surfacePressed: '#252D2D',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.12)',

  text: '#F2F5F4',
  textMuted: '#A3AEAC',
  textFaint: '#6B7775',

  teal: '#80CBC4',
  tealStrong: '#26A69A',
  tealEnd: '#4DB6AC',
  tealSoft: 'rgba(128,203,196,0.14)',
  tealDeep: '#1C3B38', // opaque teal-tinted surface (swipe reveal, hero cards)
  onTeal: '#06201D',

  amber: '#F2B45C',
  amberSoft: 'rgba(242,180,92,0.14)',
  danger: '#EF6B6B',
  dangerSoft: 'rgba(239,107,107,0.14)',

  scrim: 'rgba(0,0,0,0.55)',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '700' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const },
};

// Curves from the animation guidelines — built-in easings are too weak.
export const ease = {
  out: Easing.bezier(0.23, 1, 0.32, 1),
  inOut: Easing.bezier(0.77, 0, 0.175, 1),
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
};
// Same curves for Reanimated CSS transitions.
export const cssEase = {
  out: cubicBezier(0.23, 1, 0.32, 1),
  inOut: cubicBezier(0.77, 0, 0.175, 1),
};

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };
