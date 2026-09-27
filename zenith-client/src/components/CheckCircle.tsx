import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator } from 'react-native';
import { css } from 'react-native-reanimated';
import { colors, cssEase } from '@/theme';
import { PressableScale } from './PressableScale';

interface Props {
  checked: boolean;
  onPress: () => void;
  label: string;
  busy?: boolean;
  disabled?: boolean;
  size?: number;
}

/** Round watched toggle for seasons and episodes. Fills teal when checked. */
export function CheckCircle({ checked, onPress, label, busy, disabled, size = 40 }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={busy || disabled}
      scale={0.9}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      style={[motion.circle, { width: size, height: size, borderRadius: size / 2 }, disabled && motion.disabled, checked && motion.on]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={checked ? colors.onTeal : colors.teal} />
      ) : checked ? (
        <Ionicons name="checkmark" size={size * 0.5} color={colors.onTeal} />
      ) : null}
    </PressableScale>
  );
}

// Reanimated's StyleSheet: the fill fades rather than snapping.
const motion = css.create({
  circle: {
    borderWidth: 2,
    borderColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    transitionProperty: ['transform', 'backgroundColor'],
    transitionDuration: 160,
    transitionTimingFunction: cssEase.out,
  },
  on: { backgroundColor: colors.teal },
  disabled: { borderColor: colors.textFaint, opacity: 0.5 },
});
