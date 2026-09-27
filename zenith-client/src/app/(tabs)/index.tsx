import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Fragment, useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdSlot } from '@/ads/AdSlot';
import { Button } from '@/components/Button';
import { Fab } from '@/components/Fab';
import { GlowEmpty } from '@/components/GlowEmpty';
import { SectionHeader } from '@/components/Headers';
import { IconButton } from '@/components/IconButton';
import { MovieCard } from '@/components/MovieCard';
import { PressableScale } from '@/components/PressableScale';
import { Segmented } from '@/components/Segmented';
import { ErrorState, Skeleton, SlowHint } from '@/components/States';
import { Text } from '@/components/Text';
import { UpNextCard } from '@/components/UpNextCard';
import { useLibrary, useLibraryActions, useUpNext, useWatchNext } from '@/data/library';
import type { LibraryItem, UpNextEntry } from '@/lib/types';
import { usePrefs, type UpNextKind, type UpNextSort } from '@/store/prefs';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { colors, ease, radius, space } from '@/theme';

// A finished show slides out and the rest close the gap — without that, the
// list would jump under the user's thumb.
const REFLOW = LinearTransition.duration(220).easing(ease.out);
const ENTER = FadeIn.duration(200).easing(ease.out);
const EXIT = FadeOut.duration(160).easing(ease.out);

const airKey = (e: UpNextEntry) => e.next?.airDate ?? '';

// One ad per list: after the 3rd card, or after the last when there are fewer.
const adIndex = (count: number) => Math.min(2, count - 1);

function sortEntries(entries: UpNextEntry[], sort: UpNextSort) {
  const list = [...entries];
  switch (sort) {
    case 'newest':
      return list.sort((a, b) => airKey(b).localeCompare(airKey(a)));
    case 'oldest':
      return list.sort((a, b) => airKey(a).localeCompare(airKey(b)));
    case 'title':
      return list.sort((a, b) => a.show.showName.localeCompare(b.show.showName));
    case 'total':
      return list.sort((a, b) => b.totalEpisodes - a.totalEpisodes);
    case 'left':
      return list.sort((a, b) => a.remaining - b.remaining);
    default:
      return list.sort((a, b) => (b.show.lastWatchedAt ?? '').localeCompare(a.show.lastWatchedAt ?? ''));
  }
}

export default function UpNextScreen() {
  const kind = usePrefs((s) => s.upNextKind);
  const setKind = usePrefs((s) => s.setUpNextKind);
  const user = useSession((s) => s.user);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Segmented<UpNextKind>
            value={kind}
            onChange={setKind}
            options={[
              { value: 'tv', label: 'TV Shows' },
              { value: 'movie', label: 'Movies' },
            ]}
          />
        </View>
        {kind === 'tv' && (
          <IconButton icon="swap-vertical" tone="plain" accessibilityLabel="Sort" onPress={() => router.push('/sort')} />
        )}
      </View>
      {kind === 'tv' ? <ShowsList guest={!user} /> : <MoviesList />}
      <Fab />
    </SafeAreaView>
  );
}

function ShowsList({ guest }: { guest: boolean }) {
  const { data, isLoading, isError, error, refetch } = useUpNext();
  const watch = useWatchNext();
  const sort = usePrefs((s) => s.upNextSort);
  const [refreshing, setRefreshing] = useState(false);
  const [showWaiting, setShowWaiting] = useState(true);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);
  // A promise, so the card can show "saving" until the server has confirmed.
  const onWatch = useCallback((entry: UpNextEntry) => watch.mutateAsync(entry), [watch]);

  const watching = useMemo(() => sortEntries(data?.watching ?? [], sort), [data, sort]);
  const waiting = data?.waiting ?? [];

  if (isLoading) return <LoadingCards />;
  if (isError) return <ErrorState message={(error as Error).message} onRetry={refetch} />;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal} colors={[colors.teal]} />}
    >
      {guest && <GuestBanner />}
      {watching.length === 0 && waiting.length === 0 ? (
        <GlowEmpty
          message={'Nothing to binge yet.\nTap + to find your next obsession.'}
          action={{ label: 'Discover something new', onPress: () => router.push('/search') }}
        />
      ) : (
        // Cards are already there on launch; only later changes animate.
        <LayoutAnimationConfig skipEntering>
          {watching.map((entry, i) => (
            <Fragment key={entry.show.tmdbId}>
              <Animated.View layout={REFLOW} entering={ENTER} exiting={EXIT}>
                <UpNextCard entry={entry} onWatch={onWatch} />
              </Animated.View>
              {i === adIndex(watching.length) && (
                <Animated.View layout={REFLOW}>
                  <AdSlot />
                </Animated.View>
              )}
            </Fragment>
          ))}

          {waiting.length > 0 && (
            <Animated.View layout={REFLOW}>
              <SectionHeader
                title="Up to date"
                count={waiting.length}
                right={
                  <PressableScale
                    onPress={() => setShowWaiting((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={showWaiting ? 'Hide up to date shows' : 'Show up to date shows'}
                    style={styles.toggle}
                  >
                    <Text variant="caption" tone="teal" style={{ fontWeight: '700' }}>
                      {showWaiting ? 'Hide' : 'Show'}
                    </Text>
                  </PressableScale>
                }
              />
              {showWaiting &&
                waiting.map((entry) => (
                  <Animated.View key={entry.show.tmdbId} layout={REFLOW} entering={ENTER} exiting={EXIT}>
                    <UpNextCard entry={entry} onWatch={onWatch} />
                  </Animated.View>
                ))}
            </Animated.View>
          )}
        </LayoutAnimationConfig>
      )}
    </ScrollView>
  );
}

function MoviesList() {
  const { data, isLoading, isError, error, refetch } = useLibrary();
  const { progress } = useLibraryActions();
  const movies = useMemo(
    () => (data ?? []).filter((i) => i.mediaType === 'movie' && !i.isWatched && ['plan_to_watch', 'watching'].includes(i.status)),
    [data]
  );

  const onWatch = useCallback(
    (item: LibraryItem) =>
      progress.mutate(
        { item, action: { type: 'watch' } },
        {
          onSuccess: (updated) =>
            toast.success(`Watched ${item.showName}`, {
              label: 'Undo',
              onPress: () => progress.mutate({ item: updated, action: { type: 'unwatch' } }),
            }),
        }
      ),
    [progress]
  );

  if (isLoading) return <LoadingCards />;
  if (isError) return <ErrorState message={(error as Error).message} onRetry={refetch} />;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {movies.length === 0 ? (
        <GlowEmpty
          message={'No movies lined up.\nTap + to find something for movie night.'}
          action={{ label: 'Discover something new', onPress: () => router.push('/search') }}
        />
      ) : (
        <LayoutAnimationConfig skipEntering>
          {movies.map((m, i) => (
            <Fragment key={m.tmdbId}>
              <Animated.View layout={REFLOW} entering={ENTER} exiting={EXIT}>
                <MovieCard item={m} onWatch={onWatch} />
              </Animated.View>
              {i === adIndex(movies.length) && (
                <Animated.View layout={REFLOW}>
                  <AdSlot />
                </Animated.View>
              )}
            </Fragment>
          ))}
        </LayoutAnimationConfig>
      )}
    </ScrollView>
  );
}

function GuestBanner() {
  return (
    <View style={styles.banner}>
      <Ionicons name="phone-portrait-outline" size={20} color={colors.teal} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">Saved on this device</Text>
        <Text variant="caption" tone="muted">
          Create an account to back up and sync. Everything here comes with you.
        </Text>
      </View>
      <Button label="Sign in" size="sm" onPress={() => router.push('/auth')} />
    </View>
  );
}

function LoadingCards() {
  return (
    <View style={[styles.content, { gap: space.lg }]}>
      <SlowHint active />
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.lg }}>
          <Skeleton style={{ width: 96, height: 144 }} />
          <View style={{ flex: 1, gap: space.sm, paddingTop: 4 }}>
            <Skeleton style={{ height: 22, width: '75%' }} />
            <Skeleton style={{ height: 16, width: '55%' }} />
            <Skeleton style={{ height: 6, marginTop: space.md }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  content: { paddingHorizontal: space.lg, paddingBottom: 120, width: '100%', maxWidth: 720, alignSelf: 'center' },
  toggle: { paddingVertical: 4, paddingHorizontal: 8 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    marginBottom: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.tealSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(128,203,196,0.25)',
  },
});
