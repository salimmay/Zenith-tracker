import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutRectangle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, ease, radius } from '@/theme';
import { Text } from './Text';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/**
 * Segmented control with a sliding pill. Segments are measured once, then
 * only transforms (and the childless pill's width) animate. ease-in-out,
 * because the pill travels across the screen rather than entering it.
 */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const [layouts, setLayouts] = useState<Partial<Record<T, LayoutRectangle>>>({});
  const x = useSharedValue(0);
  const w = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const l = layouts[value];
    if (!l) return;
    // First placement snaps; later changes travel.
    const animate = w.get() > 0 && !reduced;
    x.set(animate ? withTiming(l.x, { duration: 250, easing: ease.inOut }) : l.x);
    w.set(animate ? withTiming(l.width, { duration: 250, easing: ease.inOut }) : l.width);
  }, [value, layouts, reduced, x, w]);

  const pill = useAnimatedStyle(() => ({ width: w.get(), transform: [{ translateX: x.get() }] }));

  return (
    <View style={styles.track} accessibilityRole="tablist">
      <Animated.View style={[styles.pill, pill]} />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            style={styles.segment}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onLayout={(e) => {
              const layout = e.nativeEvent.layout;
              setLayouts((prev) => ({ ...prev, [o.value]: layout }));
            }}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync(); // on the press, not when the pill lands
              onChange(o.value);
            }}
          >
            <Text variant="caption" style={[styles.label, { color: active ? colors.text : colors.textMuted }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 0,
    borderRadius: radius.sm + 1,
    backgroundColor: colors.surfaceRaised,
  },
  segment: { flex: 1, minHeight: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  label: { fontWeight: '700' },
});
