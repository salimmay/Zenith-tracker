import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdSlot } from '@/ads/AdSlot';
import { Chip } from '@/components/Chip';
import { ScreenHeader, SearchField } from '@/components/Headers';
import { IconButton } from '@/components/IconButton';
import { PosterCard } from '@/components/PosterCard';
import { Segmented } from '@/components/Segmented';
import { EmptyState, ErrorState, Skeleton, SlowHint } from '@/components/States';
import { Fab } from '@/components/Fab';
import { useLibrary } from '@/data/library';
import { STATUS_LABEL } from '@/lib/format';
import type { LibraryItem, Status } from '@/lib/types';
import { colors, space } from '@/theme';

type Kind = 'all' | 'tv' | 'anime' | 'movie';
type Sort = 'recent' | 'title';
const STATUS_ORDER: Status[] = ['watching', 'waiting', 'plan_to_watch', 'completed', 'paused', 'dropped'];

const GAP = space.md;

export default function LibraryScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useLibrary();
  const { width } = useWindowDimensions();
  const [status, setStatus] = useState<Status | 'all'>('all');
  const [kind, setKind] = useState<Kind>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [query, setQuery] = useState('');

  const contentWidth = Math.min(width, 960) - space.lg * 2;
  const columns = Math.max(3, Math.floor((contentWidth + GAP) / (120 + GAP)));
  const cardWidth = Math.floor((contentWidth - GAP * (columns - 1)) / columns);

  const byKind = useMemo(
    () =>
      (data ?? []).filter((i) =>
        kind === 'all' ? true : kind === 'movie' ? i.mediaType === 'movie' : kind === 'anime' ? i.isAnime : i.mediaType === 'tv' && !i.isAnime
      ),
    [data, kind]
  );

  const counts = useMemo(() => {
    const c: Partial<Record<Status, number>> = {};
    for (const i of byKind) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [byKind]);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = byKind.filter(
      (i) => (status === 'all' || i.status === status) && (!q || i.showName.toLowerCase().includes(q))
    );
    return sort === 'title' ? [...filtered].sort((a, b) => a.showName.localeCompare(b.showName)) : filtered;
  }, [byKind, status, query, sort]);

  const caption = (i: LibraryItem) => {
    if (i.mediaType === 'movie') return i.isWatched ? 'Watched' : (i.year ? String(i.year) : 'Movie');
    if (i.progress.totalEpisodesWatched) return `${i.progress.totalEpisodesWatched}/${i.totalEpisodes || '?'} eps`;
    return STATUS_LABEL[i.status];
  };

  const header = (
    <View style={styles.controls}>
      <SearchField value={query} onChangeText={setQuery} placeholder="Filter your library" />
      <Segmented<Kind>
        value={kind}
        onChange={setKind}
        options={[
          { value: 'all', label: 'All' },
          { value: 'tv', label: 'TV' },
          { value: 'anime', label: 'Anime' },
          { value: 'movie', label: 'Movies' },
        ]}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
        <Chip label="All" count={byKind.length} active={status === 'all'} onPress={() => setStatus('all')} />
        {STATUS_ORDER.filter((s) => counts[s]).map((s) => (
          <Chip key={s} label={STATUS_LABEL[s]} count={counts[s]} active={status === s} onPress={() => setStatus(s)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.frame}>
        <ScreenHeader
          title="Library"
          subtitle={data ? `${data.length} titles` : undefined}
          right={
            <IconButton
              icon={sort === 'recent' ? 'time-outline' : 'text-outline'}
              accessibilityLabel={sort === 'recent' ? 'Sorted by recent. Sort by title' : 'Sorted by title. Sort by recent'}
              onPress={() => setSort((s) => (s === 'recent' ? 'title' : 'recent'))}
            />
          }
        />
        {isLoading ? (
          <View style={[styles.grid, { paddingHorizontal: space.lg }]}>
            <SlowHint active style={{ width: '100%' }} />
            {Array.from({ length: columns * 3 }, (_, i) => (
              <Skeleton key={i} style={{ width: cardWidth, height: cardWidth * 1.5 }} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState message={(error as Error).message} onRetry={refetch} />
        ) : (
          <FlatList
            key={columns}
            data={items}
            numColumns={columns}
            keyExtractor={(i) => `${i.mediaType}:${i.tmdbId}`}
            ListHeaderComponent={header}
            contentContainerStyle={styles.list}
            columnWrapperStyle={{ gap: GAP }}
            ItemSeparatorComponent={() => <View style={{ height: space.lg }} />}
            keyboardDismissMode="on-drag"
            refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.teal} colors={[colors.teal]} />}
            renderItem={({ item }) => (
              <PosterCard
                tmdbId={item.tmdbId}
                mediaType={item.mediaType}
                title={item.showName}
                posterPath={item.posterPath}
                width={cardWidth}
                caption={caption(item)}
                progress={
                  item.mediaType === 'tv' && item.totalEpisodes
                    ? (item.progress.totalEpisodesWatched ?? 0) / item.totalEpisodes
                    : undefined
                }
              />
            )}
            ListFooterComponent={items.length > 0 ? <AdSlot style={{ marginTop: space.xl }} /> : null}
            ListEmptyComponent={
              data?.length ? (
                <EmptyState icon="funnel-outline" title="No matches" body="Try another filter or search." />
              ) : (
                <EmptyState
                  icon="albums-outline"
                  title="Your library is empty"
                  body="Everything you add — shows, anime and movies — is collected here."
                  action={{ label: 'Find something to watch', onPress: () => router.push('/search') }}
                />
              )
            }
          />
        )}
      </View>
      <Fab />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  frame: { flex: 1, width: '100%', maxWidth: 960, alignSelf: 'center' },
  controls: { gap: space.md, marginBottom: space.lg },
  chipScroll: { marginHorizontal: -space.lg },
  chips: { gap: space.sm, paddingHorizontal: space.lg },
  list: { paddingHorizontal: space.lg, paddingBottom: 120 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
