import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip } from '@/components/Chip';
import { SearchField } from '@/components/Headers';
import { Poster } from '@/components/Poster';
import { openTitle } from '@/components/PosterCard';
import { PressableScale } from '@/components/PressableScale';
import { EmptyState, ErrorState, Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { ZenithLoader } from '@/components/ZenithLoader';
import { useCatalogList, useSearch } from '@/data/catalog';
import { useLibrary, useLibraryActions } from '@/data/library';
import { itemKey } from '@/lib/format';
import type { CatalogItem } from '@/lib/types';
import { toast } from '@/store/toast';
import { colors, radius, space } from '@/theme';

type SearchType = 'multi' | 'tv' | 'movie';

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Search and add. Opens from the + button on every tab. */
export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<SearchType>('multi');
  const debounced = useDebounced(query, 300);
  const { data: library } = useLibrary();
  const owned = useMemo(() => new Set((library ?? []).map((i) => itemKey(i.mediaType, i.tmdbId))), [library]);

  const trending = useCatalogList('trending');
  const search = useSearch(debounced, type);
  const searching = debounced.trim().length > 0;

  const results = useMemo(() => {
    if (!searching) {
      const all = trending.data?.results ?? [];
      return type === 'multi' ? all : all.filter((r) => r.mediaType === type);
    }
    const seen = new Set<string>();
    return (search.data?.pages ?? [])
      .flatMap((p) => p.results)
      .filter((r) => {
        const k = itemKey(r.mediaType, r.tmdbId);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }, [searching, trending.data, search.data, type]);

  const active = searching ? search : trending;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.frame}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <SearchField value={query} onChangeText={setQuery} placeholder="Search shows, anime, movies…" autoFocus />
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
            <Text variant="bodyStrong" tone="teal">
              Cancel
            </Text>
          </Pressable>
        </View>
        {/* flexShrink: 0 — otherwise the results list below squeezes this row to nothing. */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={styles.chips}>
          <Chip label="Best match" active={type === 'multi'} onPress={() => setType('multi')} />
          <Chip label="TV Shows" active={type === 'tv'} onPress={() => setType('tv')} />
          <Chip label="Movies" active={type === 'movie'} onPress={() => setType('movie')} />
        </ScrollView>

        {active.isError ? (
          <ErrorState message={(active.error as Error).message} onRetry={() => active.refetch()} />
        ) : active.isLoading ? (
          <Loading />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(r) => itemKey(r.mediaType, r.tmdbId)}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              !searching ? (
                <Text variant="heading" tone="muted" style={{ marginBottom: space.md }}>
                  Trending now
                </Text>
              ) : null
            }
            onEndReachedThreshold={0.6}
            onEndReached={() => searching && search.hasNextPage && !search.isFetchingNextPage && search.fetchNextPage()}
            ListFooterComponent={search.isFetchingNextPage ? <View style={{ alignItems: 'center', margin: space.lg }}><ZenithLoader size={32} /></View> : null}
            ListEmptyComponent={
              searching ? <EmptyState icon="search" title={`Nothing for "${debounced}"`} body="Check the spelling or try the original title." /> : null
            }
            renderItem={({ item }) => <ResultRow item={item} owned={owned.has(itemKey(item.mediaType, item.tmdbId))} />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function ResultRow({ item, owned }: { item: CatalogItem; owned: boolean }) {
  const { add } = useLibraryActions();
  const [adding, setAdding] = useState(false);
  const isMovie = item.mediaType === 'movie';

  const addIt = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAdding(true);
    try {
      // Shows go straight to Up Next; movies to the movie watchlist.
      await add.mutateAsync({ tmdbId: item.tmdbId, mediaType: item.mediaType, status: isMovie ? 'plan_to_watch' : 'watching' });
      toast.success(`Added ${item.title}`);
    } catch {
      // the mutation already showed the error
    } finally {
      setAdding(false);
    }
  };

  return (
    <View style={styles.row}>
      <Pressable onPress={() => openTitle(item.mediaType, item.tmdbId)} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`}>
        <Poster path={item.posterPath} title={item.title} width={84} size="w185" rounded={radius.md} />
      </Pressable>
      <View style={styles.rowInfo}>
        <Pressable onPress={() => openTitle(item.mediaType, item.tmdbId)} style={styles.titleRow}>
          <Ionicons name={isMovie ? 'film-outline' : 'tv-outline'} size={20} color={colors.textMuted} style={{ marginTop: 2 }} />
          <Text variant="heading" numberOfLines={2} style={{ flex: 1, fontSize: 18, lineHeight: 23 }}>
            {item.title}
          </Text>
        </Pressable>
        <View style={styles.pills}>
          {item.isAnime && <Pill label="Anime" />}
          {item.year && <Pill label={String(item.year)} />}
          {item.rating ? <Pill label={`★ ${item.rating}`} /> : null}
        </View>
        {owned ? (
          <View style={styles.owned}>
            <Ionicons name="checkmark-circle" size={18} color={colors.teal} />
            <Text variant="caption" tone="teal" style={{ fontWeight: '700' }}>
              In your library
            </Text>
          </View>
        ) : (
          <PressableScale onPress={addIt} disabled={adding} accessibilityRole="button" style={styles.addButton}>
            {adding ? (
              <ActivityIndicator size="small" color={colors.teal} />
            ) : (
              <Text variant="bodyStrong">{isMovie ? 'Add Movie' : 'Add Show'}</Text>
            )}
          </PressableScale>
        )}
      </View>
    </View>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text variant="caption" tone="muted" style={{ fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  frame: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md },
  chips: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.lg },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl * 2 },
  row: { flexDirection: 'row', gap: space.lg, marginBottom: space.lg },
  rowInfo: { flex: 1, gap: space.sm },
  titleRow: { flexDirection: 'row', gap: space.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceRaised },
  addButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    minWidth: 120,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  owned: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40 },
});
