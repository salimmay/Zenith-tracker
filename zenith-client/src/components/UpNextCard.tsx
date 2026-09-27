import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  css,
  Extrapolation,
  interpolate,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { daysUntil, episodeCode, plural, relativeDay } from '@/lib/format';
import type { UpNextEntry } from '@/lib/types';
import { colors, cssEase, radius, space } from '@/theme';
import { Badge } from './Chip';
import { Poster } from './Poster';
import { PressableScale } from './PressableScale';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';
import { WatchFeedback, type WatchPhase } from './WatchFeedback';

const POSTER = 96;
// Below this width the action row can't fit a 96 pt poster beside it.
const COMPACT_WIDTH = 380;
const COMMIT_DISTANCE = 104;
const MAX_DRAG = 150;
// The loader never flickers: it shows at least this long, then the check holds briefly.
const MIN_SAVING_MS = 350;
const DONE_HOLD_MS = 650;
const ERROR_HOLD_MS = 1200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Where a flick would come to rest if it kept decelerating (Apple's decay form).
function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// Past the limit the card follows less and less instead of hitting a wall.
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

interface Props {
  entry: UpNextEntry;
  /** Resolves once the episode is saved; rejects if it couldn't be. */
  onWatch: (entry: UpNextEntry) => Promise<unknown>;
}

function UpNextCardBase({ entry, onWatch }: Props) {
  const { show, next } = entry;
  const compact = useWindowDimensions().width < COMPACT_WIDTH;
  const posterWidth = compact ? 80 : POSTER;
  const canWatch = Boolean(next?.aired);
  const waiting = entry.status === 'waiting';

  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const armed = useSharedValue(false);
  const [feedback, setFeedback] = useState<{ phase: WatchPhase; code: string } | null>(null);
  const busy = feedback !== null;
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  // One gesture = one mark: the card is locked from commit until the result has shown.
  const commit = async () => {
    if (busy || !next) return;
    const code = episodeCode(next.season, next.episode);
    setFeedback({ phase: 'saving', code });
    const started = Date.now();
    let ok = true;
    try {
      await onWatch(entry);
    } catch {
      ok = false; // the mutation already rolled back and explained it in a toast
    }
    await sleep(Math.max(0, MIN_SAVING_MS - (Date.now() - started)));
    if (!mounted.current) return; // a finished show leaves the list mid-sequence
    setFeedback({ phase: ok ? 'done' : 'error', code });
    if (ok) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); // same frame as the check
    await sleep(ok ? DONE_HOLD_MS : ERROR_HOLD_MS);
    if (mounted.current) setFeedback(null);
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(canWatch && !busy)
        .activeOffsetX(12) // rightward intent only…
        .failOffsetY([-12, 12]) // …and let vertical scrolling win
        .onStart(() => {
          start.set(x.get());
        })
        .onUpdate((e) => {
          const raw = Math.max(0, start.get() + e.translationX);
          x.set(raw <= MAX_DRAG ? raw : MAX_DRAG + rubberband(raw - MAX_DRAG, MAX_DRAG));
        })
        .onEnd((e) => {
          const projected = x.get() + project(e.velocityX);
          if (projected > COMMIT_DISTANCE && x.get() > 24) scheduleOnRN(commit);
          x.set(withSpring(0, { duration: 400, dampingRatio: 0.8, velocity: e.velocityX }));
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canWatch, busy, entry]
  );

  // Haptic exactly when the swipe crosses the commit point — the "detent".
  useAnimatedReaction(
    () => x.get() > COMMIT_DISTANCE,
    (isArmed, wasArmed) => {
      if (isArmed !== wasArmed && wasArmed !== null) {
        armed.set(isArmed);
        if (isArmed) scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
      }
    }
  );

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [0, 40], [0, 1], Extrapolation.CLAMP),
  }));
  const revealIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(x.get(), [0, COMMIT_DISTANCE], [0.75, 1], Extrapolation.CLAMP) * (armed.get() ? 1.12 : 1) }],
  }));

  const watched = entry.progress.totalEpisodesWatched ?? 0;
  const total = entry.totalEpisodes;

  let subtitle: string;
  if (waiting) {
    subtitle = entry.nextToAir
      ? `${episodeCode(entry.nextToAir.season, entry.nextToAir.episode)}${entry.nextToAir.name ? ` · ${entry.nextToAir.name}` : ''}`
      : 'No new season announced';
  } else if (next) {
    subtitle = `${episodeCode(next.season, next.episode)}${next.name ? ` · ${next.name}` : ''}`;
  } else {
    subtitle = 'All caught up';
  }
  const airIn = waiting && entry.nextToAir?.airDate ? daysUntil(entry.nextToAir.airDate) : null;
  const infoTarget = waiting ? entry.nextToAir : next;

  const openShow = () => router.push({ pathname: '/title/[type]/[id]', params: { type: 'tv', id: String(show.tmdbId) } });

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.reveal, revealStyle]} pointerEvents="none">
        <Animated.View style={[styles.revealInner, { width: posterWidth }, revealIconStyle]}>
          <Ionicons name="eye-outline" size={30} color={colors.teal} />
          <Text variant="caption" tone="teal" style={{ fontWeight: '700', textAlign: 'center' }}>
            Mark as{'\n'}watched
          </Text>
        </Animated.View>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.card, cardStyle]}>
          <Pressable onPress={openShow} accessibilityRole="button" accessibilityLabel={`Open ${show.showName}`}>
            <Poster path={show.posterPath} title={show.showName} width={posterWidth} size="w342" rounded={radius.md} />
          </Pressable>

          <View style={styles.info}>
            <Pressable onPress={openShow} accessibilityRole="button" accessibilityLabel={`${show.showName}, ${subtitle}`}>
              <Text variant="title" numberOfLines={1} style={styles.title}>
                {show.showName}
              </Text>
              <Text tone={waiting ? 'amber' : 'muted'} numberOfLines={1} style={{ marginTop: 2 }}>
                {subtitle}
              </Text>
            </Pressable>

            <View style={styles.progressRow}>
              <ProgressBar value={total ? watched / total : 0} height={6} tone={waiting ? 'muted' : 'teal'} style={{ flex: 1 }} />
              <Text variant="caption" tone="faint" style={styles.count}>
                {watched}/{total || '?'}
              </Text>
            </View>

            <View style={styles.actions}>
              {infoTarget && (
                <PressableScale
                  onPress={() =>
                    router.push({
                      pathname: '/episode/[id]/[season]/[episode]',
                      params: { id: String(show.tmdbId), season: String(infoTarget.season), episode: String(infoTarget.episode) },
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Episode info"
                  style={styles.infoButton}
                >
                  <Text variant="caption" style={{ fontWeight: '700' }}>
                    {compact ? 'Info' : 'Episode info'}
                  </Text>
                </PressableScale>
              )}
              <View style={{ flex: 1 }}>
                {waiting ? (
                  airIn !== null && airIn >= 0 ? (
                    <Badge label={airIn === 0 ? 'Out today' : airIn === 1 ? 'Tomorrow' : `In ${plural(airIn, 'day')}`} tone="amber" />
                  ) : entry.nextToAir?.airDate ? (
                    <Text variant="caption" tone="faint">{relativeDay(entry.nextToAir.airDate)}</Text>
                  ) : null
                ) : next && !next.aired && next.airDate ? (
                  <Badge label={`Airs ${relativeDay(next.airDate)}`} tone="amber" />
                ) : (
                  <Text variant="caption" tone="faint" numberOfLines={1}>
                    {entry.remaining} left
                  </Text>
                )}
              </View>
              {!waiting && (
                <PressableScale
                  onPress={commit}
                  disabled={!canWatch || busy}
                  scale={0.9}
                  accessibilityRole="button"
                  accessibilityLabel={next ? `Mark ${episodeCode(next.season, next.episode)} watched` : 'Nothing to mark'}
                  style={motion.check}
                >
                  <Ionicons name="checkmark" size={22} color={colors.teal} />
                </PressableScale>
              )}
            </View>

            {feedback && <WatchFeedback phase={feedback.phase} code={feedback.code} />}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export const UpNextCard = memo(UpNextCardBase);

const styles = StyleSheet.create({
  wrap: { marginBottom: space.lg, borderRadius: radius.lg, overflow: 'hidden' },
  reveal: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.tealDeep,
    borderRadius: radius.lg,
    justifyContent: 'center',
    paddingLeft: space.lg,
  },
  revealInner: { alignItems: 'center', gap: 4 },
  card: {
    flexDirection: 'row',
    gap: space.lg,
    backgroundColor: colors.background,
  },
  info: { flex: 1, justifyContent: 'space-between', paddingVertical: 2 },
  title: { fontSize: 19, lineHeight: 24 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  count: { minWidth: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  infoButton: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
  },
});

// Reanimated's StyleSheet: only the styles that carry CSS transitions.
const motion = css.create({
  check: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
    transitionProperty: 'transform',
    transitionDuration: 120,
    transitionTimingFunction: cssEase.out,
  },
});
