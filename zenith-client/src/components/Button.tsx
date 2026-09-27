import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, space } from '@/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface Props {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const palette = {
  primary: { bg: colors.teal, fg: colors.onTeal },
  secondary: { bg: colors.surfaceRaised, fg: colors.text },
  ghost: { bg: 'transparent', fg: colors.teal },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

export function Button({ label, onPress, variant = 'primary', size = 'md', icon, loading, disabled, style, accessibilityLabel }: Props) {
  const { bg, fg } = palette[variant];
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[styles.base, size === 'sm' && styles.sm, { backgroundColor: bg }, style]}
    >
      {/* Keep the label in the layout while loading so the button never changes width. */}
      <View style={[styles.row, loading && styles.hidden]}>
        {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={fg} />}
        <Text variant={size === 'sm' ? 'caption' : 'bodyStrong'} style={{ color: fg, fontWeight: '700' }}>
          {label}
        </Text>
      </View>
      {loading && <ActivityIndicator style={StyleSheet.absoluteFill} color={fg} />}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hidden: { opacity: 0 },
});
