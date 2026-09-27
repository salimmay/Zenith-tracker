import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { css, FadeIn } from 'react-native-reanimated';
import { useIsOffline, useSlow } from '@/lib/network';
import { colors, ease, radius, space } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';
import { ZenithLoader } from './ZenithLoader';

const HINT_ENTER = FadeIn.duration(250).easing(ease.out);

interface EmptyProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({ icon, title, body, action, style }: EmptyProps) {
  return (
    <View style={[styles.empty, style]}>
      <View style={styles.iconWell}>
        <Ionicons name={icon} size={28} color={colors.teal} />
      </View>
      <Text variant="heading" style={styles.center}>
        {title}
      </Text>
      {body && (
        <Text tone="muted" style={[styles.center, { maxWidth: 300 }]}>
          {body}
        </Text>
      )}
      {action && <Button label={action.label} onPress={action.onPress} style={{ marginTop: space.sm, minWidth: 180 }} />}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const offline = useIsOffline();
  // Offline is its own, calmer message: nothing is broken, and it fixes itself.
  if (offline) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        title="You're offline"
        body="This will load as soon as you're back online. Anything you've already opened is still here."
        action={{ label: 'Try again', onPress: onRetry }}
      />
    );
  }
  return (
    <EmptyState
      icon="alert-circle-outline"
      title="Couldn't load this"
      body={message}
      action={{ label: 'Try again', onPress: onRetry }}
    />
  );
}

/**
 * Shown under a loading layout once it has taken longer than usual. On a
 * good connection it never appears; on a bad one it says what's happening
 * instead of leaving a silent spinner.
 */
export function SlowHint({ active, style }: { active: boolean; style?: StyleProp<ViewStyle> }) {
  const slow = useSlow(active);
  const offline = useIsOffline();
  if (!slow) return null;
  return (
    <Animated.View entering={HINT_ENTER} style={[styles.hint, style]} accessibilityLiveRegion="polite">
      <ZenithLoader size={28} />
      <Text variant="caption" tone="muted" style={{ flex: 1 }}>
        {offline ? "You're offline. This will load when you reconnect." : 'Still loading. Your connection seems slow.'}
      </Text>
    </Animated.View>
  );
}

/** Centred loader for screens and sheets with no layout to sketch yet. */
export function Loading({ style }: { style?: StyleProp<ViewStyle> }) {
  const slow = useSlow(true);
  return (
    <View style={[styles.loading, style]}>
      <ZenithLoader size={56} />
      {slow && (
        <Animated.View entering={HINT_ENTER}>
          <Text variant="caption" tone="muted" style={styles.center}>
            Still loading. Your connection seems slow.
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

/**
 * Loading placeholder. A slow, gentle opacity pulse: it tells the user the
 * app is working without drawing the eye like a shimmer sweep does.
 */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  return <Animated.View style={[motion.skeleton, style]} />;
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl * 1.5, paddingHorizontal: space.xl },
  iconWell: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  center: { textAlign: 'center' },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  loading: { alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingVertical: space.xxl * 1.5 },
});

// Reanimated's StyleSheet: understands CSS keyframe animations.
const motion = css.create({
  skeleton: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    animationName: css.keyframes({ from: { opacity: 1 }, to: { opacity: 0.45 } }),
    animationDuration: 900,
    animationIterationCount: 'infinite',
    animationDirection: 'alternate',
    animationTimingFunction: 'ease-in-out',
  },
});
