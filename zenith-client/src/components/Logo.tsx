import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';

/**
 * The Zenith mark (source: assets/brand/zenith-logo.svg). `tile` draws the
 * rounded app-icon background; without it the mark sits on the screen.
 */
export function Logo({ size = 40, tile = true }: { size?: number; tile?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityRole="image" accessibilityLabel="Zenith">
      {tile && <Rect width={120} height={120} rx={28} fill={colors.surface} />}
      <Circle cx={60} cy={60} r={46} stroke={colors.tealDeep} strokeWidth={4} fill="none" />
      <Path d="M40 38H80L44 82H84" stroke={colors.teal} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Circle cx={82} cy={38} r={4.5} fill={colors.amber} />
    </Svg>
  );
}
