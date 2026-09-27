import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle } from '@/components/CheckCircle';
import { IconButton } from '@/components/IconButton';
import { ProgressBar } from '@/components/ProgressBar';
import { ErrorState, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { useSeason, useTv } from '@/data/catalog';
import { useEntry, useLibraryActions } from '@/data/library';
import { episodeCode, parseDay } from '@/lib/format';
import { isAfter, seasonWatchedCount } from '@/lib/progress';
import type { Episode, LibraryItem, ProgressAction } from '@/lib/types';
import { toast } from '@/store/toast';
import { colors, space } from '@/theme';

/** One season: every episode with a watched toggle, and "mark all" in the header. */
export default function SeasonScreen() {
  const p = useLocalSearchParams<{ id: string; season: string }>();
  const tvId = Number(p.id);
  const n = Number(p.season);
  const show = useTv(tvId);
  const season = useSeason(tvId, n);
  const { data: entry } = useEntry('tv', tvId);
  const { add, progress } = useLibraryActions();
  const [busy, setBusy] = useState<string | null>(null);

  const episodes = season.data?.episodes ?? [];
  const lastAired = show.data?.lastAired ?? null;
  const specials = n === 0;
  const watched = seasonWatchedCount(n, episodes.length, entry);
  const complete = episodes.length > 0 && watched >= episodes.length;
  const anyAired = !!lastAired && lastAired.season >= n && !specials;

  const act = async (key: string, action: ProgressAction, label: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBusy(key);
    try {
      const item: LibraryItem = entry ?? (await add.mutateAsync({ tmdbId: tvId, mediaType: 'tv', status: 'watching' }));
      const before = { season: item.progress.season, episode: item.progress.episode };
      const updated = await progress.mutateAsync({ item, action });
      toast.success(label, { label: 'Undo', onPress: () => progress.mutate({ item: updated, action: { type: 'set', ...before } }) });
    } catch {
      // the mutation already showed the error
    } finally {
      setBusy(null);
    }
  };

  const toggleAll = () =>
    complete
      ? act('all', { type: 'set', season: n, episode: 0 }, `${season.data?.name ?? 'Season'} unmarked`)
      : act('all', { type: 'complete_season', season: n }, `${season.data?.name ?? 'Season'} watched`);

  const renderEpisode = ({ item: ep }: { item: Episode }) => {
    const at = { season: n, episode: ep.episodeNumber };
    const isAired = !!lastAired && !isAfter(at, lastAired);
    const isWatched = !!entry?.progress && !specials && !isAfter(at, entry.progress);
    const key = String(ep.episodeNumber);
    return (
      <View style={styles.row}>
        <Pressable
          style={{ flex: 1, gap: 4 }}
          onPress={() =>
            router.push({
              pathname: '/episode/[id]/[season]/[episode]',
              params: { id: String(tvId), season: String(n), episode: String(ep.episodeNumber) },
            })
          }
          accessibilityRole="button"
          accessibilityLabel={`${ep.name}, ${episodeCode(n, ep.episodeNumber)}`}
        >
          <Text variant="heading" numberOfLines={2} tone={isAired ? 'default' : 'muted'}>
            {ep.name}
          </Text>
          <Text variant="caption" tone="faint">
            {episodeCode(n, ep.episodeNumber)}
            {ep.airDate ? ` · ${parseDay(ep.airDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
          </Text>
        </Pressable>
        {!specials && (
          <CheckCircle
            checked={isWatched}
            busy={busy === key}
            disabled={!isAired}
            label={
              !isAired
                ? `${episodeCode(n, ep.episodeNumber)} hasn't aired`
                : isWatched
                  ? `Unmark ${episodeCode(n, ep.episodeNumber)}`
                  : `Mark ${episodeCode(n, ep.episodeNumber)} watched`
            }
            onPress={() =>
              isWatched
                ? act(key, { type: 'set', season: n, episode: ep.episodeNumber - 1 }, `Unmarked from ${episodeCode(n, ep.episodeNumber)}`)
                : act(key, { type: 'set', season: n, episode: ep.episodeNumber }, `Watched up to ${episodeCode(n, ep.episodeNumber)}`)
            }
          />
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.frame}>
        <View style={styles.header}>
          <IconButton icon="arrow-back" tone="plain" accessibilityLabel="Back" onPress={() => router.back()} />
          <Text variant="heading" numberOfLines={1} style={styles.headerTitle}>
            {season.data?.name ?? `Season ${n}`}
          </Text>
          {anyAired ? (
            <Pressable
              onPress={toggleAll}
              hitSlop={10}
              disabled={busy !== null}
              accessibilityRole="button"
              accessibilityLabel={complete ? 'Unmark the whole season' : 'Mark the whole season watched'}
              style={styles.markAll}
            >
              {busy === 'all' ? (
                <ActivityIndicator color={colors.teal} />
              ) : (
                <Ionicons name="checkmark-done" size={26} color={complete ? colors.teal : colors.text} />
              )}
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
        {!specials && (
          <View style={styles.progress}>
            <ProgressBar value={episodes.length ? watched / episodes.length : 0} height={8} style={{ flex: 1 }} />
            <Text variant="caption" tone="muted" style={{ fontVariant: ['tabular-nums'] }}>
              {watched}/{episodes.length}
            </Text>
          </View>
        )}

        {season.isError ? (
          <ErrorState message={(season.error as Error).message} onRetry={() => season.refetch()} />
        ) : season.isLoading ? (
          <Loading />
        ) : (
          <FlatList
            data={episodes}
            keyExtractor={(e) => String(e.episodeNumber)}
            renderItem={renderEpisode}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xxl * 2 }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  frame: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingVertical: space.sm },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 19 },
  markAll: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.lg },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
