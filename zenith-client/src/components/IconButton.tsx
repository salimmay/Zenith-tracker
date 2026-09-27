import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '@/theme';
import { PressableScale } from './PressableScale';

interface Props {
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'surface' | 'glass' | 'plain';
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** 40pt visual, 44pt+ touch target via hitSlop. */
export function IconButton({ icon, onPress, accessibilityLabel, tone = 'surface', color = colors.text, size = 20, style }: Props) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      scale={0.92}
      style={[styles.base, styles[tone], style]}
    >
      <Ionicons name={icon} size={size} color={color} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  surface: { backgroundColor: colors.surfaceRaised },
  glass: { backgroundColor: 'rgba(14,17,17,0.6)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  plain: {},
});
