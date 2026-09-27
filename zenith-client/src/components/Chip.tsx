import { StyleSheet } from 'react-native';
import { css } from 'react-native-reanimated';
import { colors, cssEase, radius, space } from '@/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

interface Props {
  label: string;
  count?: number;
  active?: boolean;
  onPress: () => void;
}

export function Chip({ label, count, active, onPress }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[motion.chip, active && motion.active]}
    >
      <Text variant="caption" style={{ color: active ? colors.onTeal : colors.text, fontWeight: '700' }}>
        {label}
        {count !== undefined && (
          <Text variant="caption" style={{ color: active ? colors.onTeal : colors.textFaint }}>
            {'  '}
            {count}
          </Text>
        )}
      </Text>
    </PressableScale>
  );
}

/** Small non-interactive label, e.g. "3 left" or "Finale". */
export function Badge({ label, tone = 'teal' }: { label: string; tone?: 'teal' | 'amber' | 'muted' | 'danger' }) {
  const bg = { teal: colors.tealSoft, amber: colors.amberSoft, muted: 'rgba(255,255,255,0.07)', danger: colors.dangerSoft }[tone];
  const fg = { teal: colors.teal, amber: colors.amber, muted: colors.textMuted, danger: colors.danger }[tone];
  return (
    <Text variant="micro" style={[styles.badge, { backgroundColor: bg, color: fg }]}>
      {label}
    </Text>
  );
}

// Reanimated's StyleSheet: only the styles that carry CSS transitions.
const motion = css.create({
  chip: {
    minHeight: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    justifyContent: 'center',
    transitionProperty: ['transform', 'backgroundColor'],
    transitionDuration: 150,
    transitionTimingFunction: cssEase.out,
  },
  active: { backgroundColor: colors.teal, borderColor: colors.teal },
});

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
});
