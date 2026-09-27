import { Text as RNText, type TextProps } from 'react-native';
import { colors, type as typography } from '@/theme';

type Variant = keyof typeof typography;
type Tone = 'default' | 'muted' | 'faint' | 'teal' | 'amber' | 'danger' | 'onTeal';

const toneColor: Record<Tone, string> = {
  default: colors.text,
  muted: colors.textMuted,
  faint: colors.textFaint,
  teal: colors.teal,
  amber: colors.amber,
  danger: colors.danger,
  onTeal: colors.onTeal,
};

export function Text({
  variant = 'body',
  tone = 'default',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  // Cap Dynamic Type growth so fixed-size cards stay intact at 200% text size.
  return <RNText maxFontSizeMultiplier={1.4} {...rest} style={[typography[variant], { color: toneColor[tone] }, style]} />;
}
