import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, ease } from '@/theme';

interface Props {
  value: number; // 0..1
  height?: number;
  tone?: 'teal' | 'amber' | 'muted';
  style?: StyleProp<ViewStyle>;
}

const fills = {
  teal: [colors.tealStrong, colors.teal] as const,
  amber: [colors.amber, colors.amber] as const,
  muted: [colors.textFaint, colors.textFaint] as const,
};

/**
 * The fill is absolutely positioned and childless, so animating its width
 * lays out nothing else — and keeps the rounded end that scaleX would smear.
 */
export function ProgressBar({ value, height = 4, tone = 'teal', style }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const width = useSharedValue(0);
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, value || 0));

  useEffect(() => {
    if (!trackWidth) return;
    const target = clamped * trackWidth;
    width.set(reduced ? target : withTiming(target, { duration: 250, easing: ease.out }));
  }, [clamped, trackWidth, reduced, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: width.get() }));

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }, style]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View style={[styles.fill, { borderRadius: height / 2 }, fillStyle]}>
        <LinearGradient colors={fills[tone]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
});
