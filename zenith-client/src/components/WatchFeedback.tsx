import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  Keyframe,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, ease, radius, space } from '@/theme';
import { Text } from './Text';
import { ZenithLoader } from './ZenithLoader';

export type WatchPhase = 'saving' | 'done' | 'error';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LENGTH = 16; // length of the check stroke below, in viewBox units

// Module scope: layout-animation builders shouldn't be rebuilt every render.
const PANEL_IN = FadeIn.duration(120).easing(ease.out);
const PANEL_OUT = FadeOut.duration(180).easing(ease.out);
// The confirmation arrives from 85% — never from nothing.
const POP = new Keyframe({
  0: { opacity: 0, transform: [{ scale: 0.85 }] },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: ease.out },
}).duration(220);
const SWAP = FadeIn.duration(150);

/** The check draws itself once the circle has landed. */
function DrawnCheck({ size = 32 }: { size?: number }) {
  const reduced = useReducedMotion();
  const offset = useSharedValue(reduced ? 0 : CHECK_LENGTH);
  useEffect(() => {
    if (!reduced) offset.set(withDelay(90, withTiming(0, { duration: 240, easing: ease.out })));
  }, [offset, reduced]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.get() }));
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={12} fill={colors.teal} />
      <AnimatedPath
        d="M7 12.5l3.2 3.2L17 9"
        stroke={colors.onTeal}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={CHECK_LENGTH}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

/**
 * Covers a card's info area while an episode is being marked: a short
 * loader, then a drawn check (or an honest failure). While it's up the card
 * can't be swiped or tapped again, so one gesture can't become two marks.
 */
export function WatchFeedback({ phase, code }: { phase: WatchPhase; code: string }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={PANEL_IN}
      exiting={PANEL_OUT}
      style={styles.panel}
      accessibilityLiveRegion="polite"
      accessibilityLabel={phase === 'saving' ? `Marking ${code} watched` : phase === 'done' ? `${code} watched` : "Couldn't save"}
    >
      {phase === 'saving' && (
        <Animated.View key="saving" entering={SWAP} style={styles.row}>
          <ZenithLoader size={32} />
          <Text variant="bodyStrong" tone="muted" numberOfLines={1} style={styles.label}>
            Marking {code} watched…
          </Text>
        </Animated.View>
      )}
      {phase === 'done' && (
        <View key="done" style={styles.row}>
          <Animated.View entering={reduced ? SWAP : POP}>
            <DrawnCheck />
          </Animated.View>
          <Animated.View entering={SWAP} style={styles.label}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {code} watched
            </Text>
          </Animated.View>
        </View>
      )}
      {phase === 'error' && (
        <Animated.View key="error" entering={SWAP} style={styles.row}>
          <Ionicons name="alert-circle" size={32} color={colors.danger} />
          <Text variant="bodyStrong" numberOfLines={2} style={styles.label}>
            Couldn't save · try again
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.md,
    backgroundColor: colors.tealDeep,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  label: { flex: 1 },
});
