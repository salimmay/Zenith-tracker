import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdSlot } from '@/ads/AdSlot';
import { Button } from '@/components/Button';
import { CheckCircle } from '@/components/CheckCircle';
import { IconButton } from '@/components/IconButton';
import { Poster } from '@/components/Poster';
import { Rail } from '@/components/PosterCard';
import { PressableScale } from '@/components/PressableScale';
import { ProgressBar } from '@/components/ProgressBar';
import { ErrorState, Skeleton, SlowHint } from '@/components/States';
import { Text } from '@/components/Text';
import { useMovie, useTv } from '@/data/catalog';
import { useEntry, useLibraryActions } from '@/data/library';
import { seasonWatchedCount } from '@/lib/progress';
import { daysUntil, episodeCode, plural, poster, profile, relativeDay, STATUS_LABEL } from '@/lib/format';
import type { LibraryItem, MediaType, MovieDetails, ProgressAction, SeasonSummary, TvDetails } from '@/lib/types';
import { toast } from '@/store/toast';
import { colors, radius, space } from '@/theme';

const BACKDROP = 440;

export default function TitleScreen() {
  const params = useLocalSearchParams<{ type: MediaType; id: string }>();
  const type: MediaType = params.type === 'movie' ? 'movie' : 'tv';
  const id = Number(params.id);
  const tv = useTv(type === 'tv' ? id : 0);
  const movie = useMovie(type === 'movie' ? id : 0);
  const details = (type === 'tv' ? tv.data : movie.data) as TvDetails | MovieDetails | undefined;
  const query = type === 'tv' ? tv : movie;
  const { data: entry } = useEntry(type, id);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const posterWidth = Math.min(220, Math.round(Math.min(width, 720) * 0.55));

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.set(e.contentOffset.y);
  });
  // The compact title appears as the poster scrolls away — spatial continuity.
  const fadeAt = posterWidth * 1.5;
  const barStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [fadeAt - 60, fadeAt], [0, 1], Extrapolation.CLAMP),
  }));
  const barTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [fadeAt + 40, fadeAt + 90], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.get(), [fadeAt + 40, fadeAt + 90], [6, 0], Extrapolation.CLAMP) }],
  }));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const share = () =>
    details &&
    Share.share({ message: `${details.title} — https://www.themoviedb.org/${type}/${details.tmdbId}` }).catch(() => {});

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.topBar, { paddingTop: insets.top, height: insets.top + 56 }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, styles.topBarBg, barStyle]} />
        <IconButton icon="arrow-back" tone="glass" accessibilityLabel="Back" onPress={back} />
        <Animated.View style={[styles.barTitle, barTitleStyle]}>
          <Text variant="heading" numberOfLines={1}>
            {details?.title}
          </Text>
        </Animated.View>
        <IconButton icon="share-outline" tone="glass" accessibilityLabel="Share" onPress={share} />
        {entry && (
          <IconButton
            icon="ellipsis-horizontal"
            tone="glass"
            accessibilityLabel="Change status, rate or remove"
            onPress={() => router.push({ pathname: '/status/[type]/[id]', params: { type, id: String(id) } })}
          />
        )}
      </Animated.View>

      {query.isError ? (
        <View style={{ paddingTop: insets.top + 80 }}>
          <ErrorState message={(query.error as Error).message} onRetry={() => query.refetch()} />
        </View>
      ) : (
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl * 2 }}>
          {/* The poster itself, blurred, tints the top of the page in its own colours. */}
          <View style={[styles.backdrop, { height: BACKDROP + insets.top }]} pointerEvents="none">
            {details?.posterPath && (
              <Image source={{ uri: poster(details.posterPath, 'w185')! }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} />
            )}
            <LinearGradient
              colors={['rgba(14,17,17,0.35)', 'rgba(14,17,17,0.7)', colors.background]}
              locations={[0, 0.6, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>

          <View style={[styles.content, { paddingTop: insets.top + 64 }]}>
            {!details ? (
              <DetailsSkeleton posterWidth={posterWidth} />
            ) : (
              <>
                <View style={{ alignItems: 'center' }}>
                  <Poster path={details.posterPath} title={details.title} width={posterWidth} size="w500" rounded={radius.lg} style={styles.poster} />
                  {details.rating ? (
                    <View style={styles.rating}>
                      <Text variant="micro" style={styles.ratingBadge}>
                        TMDB
                      </Text>
                      <Text variant="bodyStrong">{details.rating}</Text>
                    </View>
                  ) : null}
                </View>

                <Actions details={details} type={type} entry={entry} />
                <Facts details={details} type={type} />

                <Text variant="title" accessibilityRole="header" style={{ marginTop: space.xl }}>
                  {details.title}
                </Text>
                <Overview text={details.overview} />

                {type === 'tv' && <NextAiring details={details as TvDetails} />}
                {details.trailerKey && <Trailer videoKey={details.trailerKey} />}
                {type === 'tv' && <Seasons details={details as TvDetails} entry={entry} />}
                {details.cast.length > 0 && <Cast cast={details.cast} />}
              </>
            )}
          </View>
          {details && (
            <View style={styles.content}>
              <AdSlot style={{ marginTop: space.xl, marginBottom: 0 }} />
            </View>
          )}
          {details && details.recommendations.length > 0 && (
            <View style={{ marginTop: space.xl }}>
              <Rail title="You may also like" items={details.recommendations} />
            </View>
          )}
        </Animated.ScrollView>
      )}
    </View>
  );
}

// ─── Primary actions ─────────────────────────────────────────────────────────

function Actions({ details, type, entry }: { details: TvDetails | MovieDetails; type: MediaType; entry: LibraryItem | null }) {
  const { add, progress } = useLibraryActions();
  const tv = type === 'tv' ? (details as TvDetails) : null;

  const addAs = async (status: LibraryItem['status']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const item = await add.mutateAsync({ tmdbId: details.tmdbId, mediaType: type, status });
      toast.success(`Added to ${STATUS_LABEL[item.status]}`);
    } catch {
      // the mutation already showed the error
    }
  };

  if (!entry) {
    const primary = type === 'tv' ? 'watching' : 'plan_to_watch';
    const secondary = type === 'tv' ? 'plan_to_watch' : 'completed';
    return (
      <View style={styles.addWrap}>
        <PressableScale
          onPress={() => addAs(primary)}
          disabled={add.isPending}
          accessibilityRole="button"
          style={styles.addButton}
        >
          {add.isPending && add.variables?.status === primary ? (
            <ActivityIndicator color={colors.teal} />
          ) : (
            <>
              <Ionicons name="add" size={24} color={colors.text} />
              <Text variant="heading">{type === 'tv' ? 'Add Show' : 'Add Movie'}</Text>
            </>
          )}
        </PressableScale>
        <Pressable onPress={() => addAs(secondary)} hitSlop={10} accessibilityRole="button" disabled={add.isPending}>
          <Text variant="caption" tone="muted" style={{ fontWeight: '600' }}>
            {type === 'tv' ? 'Save for later instead' : 'Already watched it'}
          </Text>
        </Pressable>
      </View>
    );
  }

  const statusChip = (
    <PressableScale
      onPress={() => router.push({ pathname: '/status/[type]/[id]', params: { type, id: String(details.tmdbId) } })}
      accessibilityRole="button"
      accessibilityLabel={`Status: ${STATUS_LABEL[entry.status]}. Change`}
      style={styles.statusChip}
    >
      <View style={[styles.statusDot, { backgroundColor: entry.status === 'dropped' ? colors.danger : entry.status === 'waiting' ? colors.amber : colors.teal }]} />
      <Text variant="bodyStrong">{type === 'movie' && entry.isWatched ? 'Watched' : STATUS_LABEL[entry.status]}</Text>
      {entry.rating ? <Text variant="caption" tone="muted">{`★ ${entry.rating / 2}`}</Text> : null}
      <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
    </PressableScale>
  );

  if (type === 'movie') {
    return (
      <View style={styles.actions}>
        {statusChip}
        <Button
          label={entry.isWatched ? 'Watched' : 'Mark watched'}
          icon={entry.isWatched ? 'checkmark-circle' : 'checkmark'}
          variant={entry.isWatched ? 'secondary' : 'primary'}
          loading={progress.isPending}
          style={{ flex: 1 }}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            progress.mutate({ item: entry, action: { type: entry.isWatched ? 'unwatch' : 'watch' } });
          }}
        />
      </View>
    );
  }

  const watched = entry.progress.totalEpisodesWatched ?? 0;
  const total = tv?.numberOfEpisodes || entry.totalEpisodes || 0;
  return (
    <View style={{ gap: space.md, marginTop: space.xl }}>
      <View style={{ alignItems: 'center' }}>{statusChip}</View>
      <View style={styles.progressRow}>
        <ProgressBar value={total ? watched / total : 0} height={6} style={{ flex: 1 }} />
        <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
          {watched}/{total}
        </Text>
      </View>
    </View>
  );
}

function Facts({ details, type }: { details: TvDetails | MovieDetails; type: MediaType }) {
  const tv = type === 'tv' ? (details as TvDetails) : null;
  const status = tv?.status === 'Returning Series' ? 'Running' : tv?.status === 'Canceled' ? 'Canceled' : tv?.status === 'Ended' ? 'Ended' : null;
  const chips = [
    status,
    details.year && !tv ? String(details.year) : null,
    details.genres[0],
    tv?.networks[0],
    details.runtime ? `${details.runtime}m` : null,
  ].filter(Boolean) as string[];
  if (!chips.length) return null;
  return (
    <View style={styles.facts}>
      {chips.map((c, i) => (
        <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {i > 0 && <View style={styles.dot} />}
          <View style={styles.pill}>
            <Text variant="caption" style={{ fontWeight: '600' }}>
              {c}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function Overview({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityHint={open ? 'Collapse' : 'Expand'} style={{ marginTop: space.sm }}>
      <Text tone="muted" numberOfLines={open ? undefined : 4} style={{ fontSize: 16, lineHeight: 23 }}>
        {text}
      </Text>
      {!open && text.length > 200 && (
        <Text tone="faint" style={{ marginTop: 4 }}>
          Read more
        </Text>
      )}
    </Pressable>
  );
}

function NextAiring({ details }: { details: TvDetails }) {
  const next = details.nextToAir;
  if (!next?.airDate) return null;
  const days = daysUntil(next.airDate);
  const when = days === 0 ? 'airs today' : days === 1 ? 'airs tomorrow' : days > 1 ? `airs in ${plural(days, 'day')}` : `aired ${relativeDay(next.airDate)}`;
  return (
    <PressableScale
      scale={0.98}
      onPress={() =>
        router.push({
          pathname: '/episode/[id]/[season]/[episode]',
          params: { id: String(details.tmdbId), season: String(next.season), episode: String(next.episode) },
        })
      }
      accessibilityRole="button"
      style={styles.nextRow}
    >
      <Ionicons name="time-outline" size={22} color={colors.teal} />
      <Text variant="bodyStrong" style={{ flex: 1 }}>
        {episodeCode(next.season, next.episode)} <Text tone="muted">{when}</Text>
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </PressableScale>
  );
}

function Trailer({ videoKey }: { videoKey: string }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" style={{ marginBottom: space.md }}>
        Official trailer
      </Text>
      <PressableScale
        scale={0.98}
        onPress={() => WebBrowser.openBrowserAsync(`https://www.youtube.com/watch?v=${videoKey}`)}
        accessibilityRole="button"
        accessibilityLabel="Play trailer"
        style={styles.trailer}
      >
        <Image source={{ uri: `https://img.youtube.com/vi/${videoKey}/hqdefault.jpg` }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        <View style={styles.play}>
          <Ionicons name="play" size={30} color="#fff" style={{ marginLeft: 3 }} />
        </View>
      </PressableScale>
    </View>
  );
}

// ─── Seasons ─────────────────────────────────────────────────────────────────

function Seasons({ details, entry }: { details: TvDetails; entry: LibraryItem | null }) {
  const { add, progress } = useLibraryActions();
  const seasons = details.seasons
    .filter((s) => s.episodeCount > 0)
    .sort((a, b) => (a.seasonNumber === 0 ? 1 : b.seasonNumber === 0 ? -1 : a.seasonNumber - b.seasonNumber));
  if (seasons.length === 0) return null;

  const act = async (action: ProgressAction, label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const item = entry ?? (await add.mutateAsync({ tmdbId: details.tmdbId, mediaType: 'tv', status: 'watching' }));
      const before = { season: item.progress.season, episode: item.progress.episode };
      const updated = await progress.mutateAsync({ item, action });
      toast.success(label, { label: 'Undo', onPress: () => progress.mutate({ item: updated, action: { type: 'set', ...before } }) });
    } catch {
      // the mutation already showed the error
    }
  };

  return (
    <View style={styles.section}>
      {seasons.map((s) => (
        <SeasonRow key={s.seasonNumber} tvId={details.tmdbId} season={s} entry={entry} lastAired={details.lastAired} act={act} />
      ))}
    </View>
  );
}

function SeasonRow({
  tvId,
  season,
  entry,
  lastAired,
  act,
}: {
  tvId: number;
  season: SeasonSummary;
  entry: LibraryItem | null;
  lastAired: TvDetails['lastAired'];
  act: (action: ProgressAction, label: string) => Promise<void>;
}) {
  const n = season.seasonNumber;
  const specials = n === 0;
  const watched = seasonWatchedCount(n, season.episodeCount, entry);
  const complete = watched >= season.episodeCount;
  const aired = !!lastAired && lastAired.season >= n && n > 0;
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    await (complete
      ? act({ type: 'set', season: n, episode: 0 }, `${season.name} unmarked`)
      : act({ type: 'complete_season', season: n }, `${season.name} watched`));
    setBusy(false);
  };

  return (
    <View style={styles.seasonRow}>
      {!specials && aired ? (
        <CheckCircle checked={complete} busy={busy} label={complete ? `Unmark ${season.name}` : `Mark ${season.name} watched`} onPress={toggle} />
      ) : (
        <View style={{ width: 40 }} />
      )}
      <Pressable
        style={styles.seasonMain}
        onPress={() => router.push({ pathname: '/season/[id]/[season]', params: { id: String(tvId), season: String(n) } })}
        accessibilityRole="button"
        accessibilityLabel={`${season.name}, ${watched} of ${season.episodeCount} watched`}
      >
        <Text variant="bodyStrong" style={{ minWidth: 76 }} numberOfLines={1}>
          {season.name}
        </Text>
        {specials ? (
          <Text variant="caption" tone="faint" style={{ flex: 1 }}>
            {plural(season.episodeCount, 'extra')}
          </Text>
        ) : (
          <>
            <ProgressBar value={watched / season.episodeCount} height={6} style={{ flex: 1 }} />
            <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'], minWidth: 40, textAlign: 'right' }}>
              {watched}/{season.episodeCount}
            </Text>
          </>
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

// ─── Cast ────────────────────────────────────────────────────────────────────

function Cast({ cast }: { cast: TvDetails['cast'] }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" style={{ marginBottom: space.md }}>
        Starring
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}>
        {cast.map((c) => (
          <View key={c.id} style={{ width: 112, gap: 4 }}>
            {c.profilePath ? (
              <Image source={{ uri: profile(c.profilePath)! }} style={styles.castPhoto} contentFit="cover" transition={150} />
            ) : (
              <View style={[styles.castPhoto, { alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={32} color={colors.textFaint} />
              </View>
            )}
            <Text variant="caption" numberOfLines={1} style={{ fontWeight: '700', color: colors.text }}>
              {c.name}
            </Text>
            <Text variant="caption" tone="faint" numberOfLines={1}>
              {c.character}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function DetailsSkeleton({ posterWidth }: { posterWidth: number }) {
  return (
    <View style={{ alignItems: 'center', gap: space.lg }}>
      <SlowHint active style={{ alignSelf: 'stretch' }} />
      <Skeleton style={{ width: posterWidth, height: posterWidth * 1.5, borderRadius: radius.lg }} />
      <Skeleton style={{ width: 220, height: 52 }} />
      <Skeleton style={{ width: '100%', height: 90 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  topBarBg: { backgroundColor: 'rgba(14,17,17,0.94)', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  barTitle: { flex: 1 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  content: { paddingHorizontal: space.lg, width: '100%', maxWidth: 720, alignSelf: 'center' },
  poster: {
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  rating: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  ratingBadge: { backgroundColor: colors.teal, color: colors.onTeal, paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  addWrap: { alignItems: 'center', gap: space.md, marginTop: space.xl },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 56,
    minWidth: 240,
    paddingHorizontal: space.xl,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.teal,
    backgroundColor: colors.surface,
  },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  facts: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: space.sm, marginTop: space.xl },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textMuted },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
    marginTop: space.xl,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  section: {
    marginTop: space.xl,
    paddingTop: space.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  trailer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  play: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  seasonRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 60 },
  seasonMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56 },
  castPhoto: { width: 112, height: 150, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
});

