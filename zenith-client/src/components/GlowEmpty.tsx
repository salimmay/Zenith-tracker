import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, radius, space } from '@/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

interface Props {
  message: string;
  action: { label: string; onPress: () => void };
}

/** Empty screen: a soft teal glow behind one clear next step. */
export function GlowEmpty({ message, action }: Props) {
  return (
    <View style={styles.wrap}>
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100" pointerEvents="none">
        <Defs>
          <RadialGradient id="glow" cx="50%" cy="45%" rx="55%" ry="40%">
            <Stop offset="0" stopColor={colors.teal} stopOpacity={0.2} />
            <Stop offset="1" stopColor={colors.teal} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#glow)" />
      </Svg>
      <Text tone="muted" style={styles.message}>
        {message}
      </Text>
      <PressableScale onPress={action.onPress} accessibilityRole="button" style={styles.button}>
        <Ionicons name="add" size={22} color={colors.text} />
        <Text variant="heading">{action.label}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 420, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingHorizontal: space.xl },
  message: { textAlign: 'center', fontSize: 16, lineHeight: 23 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.teal,
    backgroundColor: colors.surface,
  },
});
