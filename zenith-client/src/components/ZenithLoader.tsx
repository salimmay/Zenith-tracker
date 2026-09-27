import { StyleSheet, View } from 'react-native';
import Animated, { css, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@/theme';

const R = 46;
const ARC = 2 * Math.PI * R * 0.25; // a quarter of the ring

/**
 * The loading indicator: the Zenith mark holds still while a teal arc runs
 * around its ring. Constant motion, so linear. With reduced motion the arc
 * stays put and the mark breathes instead.
 */
export function ZenithLoader({ size = 48 }: { size?: number }) {
  const reduced = useReducedMotion();
  return (
    <View style={{ width: size, height: size }} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Animated.View style={[StyleSheet.absoluteFill, reduced && motion.breathe]}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Circle cx={60} cy={60} r={R} stroke={colors.tealDeep} strokeWidth={4} fill="none" />
          <Path d="M40 38H80L44 82H84" stroke={colors.teal} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Circle cx={82} cy={38} r={4.5} fill={colors.amber} />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, !reduced && motion.spin]}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Circle
            cx={60}
            cy={60}
            r={R}
            stroke={colors.teal}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${ARC} ${2 * Math.PI * R}`}
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const motion = css.create({
  spin: {
    animationName: css.keyframes({ from: { transform: [{ rotate: '0deg' }] }, to: { transform: [{ rotate: '360deg' }] } }),
    animationDuration: 1100,
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
  },
  breathe: {
    animationName: css.keyframes({ from: { opacity: 1 }, to: { opacity: 0.5 } }),
    animationDuration: 900,
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    animationTimingFunction: 'ease-in-out',
  },
});
