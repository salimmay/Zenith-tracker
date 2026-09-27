import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { memo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { CatalogItem, MediaType } from '@/lib/types';
import { colors, space } from '@/theme';
import { Poster } from './Poster';
import { PressableScale } from './PressableScale';
import { ProgressBar } from './ProgressBar';
import { Skeleton } from './States';
import { Text } from './Text';

export function openTitle(mediaType: MediaType, tmdbId: number) {
  router.push({ pathname: '/title/[type]/[id]', params: { type: mediaType, id: String(tmdbId) } });
}

interface Props {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  width: number;
  caption?: string;
  progress?: number;
  inLibrary?: boolean;
}

function PosterCardBase({ tmdbId, mediaType, title, posterPath, width, caption, progress, inLibrary }: Props) {
  return (
    <PressableScale
      onPress={() => openTitle(mediaType, tmdbId)}
      accessibilityRole="button"
      accessibilityLabel={[title, caption].filter(Boolean).join(', ')}
      style={{ width }}
    >
      <View>
        <Poster path={posterPath} title={title} width={width} />
        {inLibrary && (
          <View style={styles.owned}>
            <Ionicons name="checkmark" size={12} color={colors.onTeal} />
          </View>
        )}
      </View>
      {progress !== undefined && <ProgressBar value={progress} height={3} style={{ marginTop: 6 }} />}
      <Text variant="caption" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      {caption && (
        <Text variant="caption" tone="faint" numberOfLines={1}>
          {caption}
        </Text>
      )}
    </PressableScale>
  );
}

export const PosterCard = memo(PosterCardBase);

interface RailProps {
  title: string;
  items: CatalogItem[] | undefined;
  loading?: boolean;
  owned?: Set<string>;
}

/** Horizontal row of posters with a heading. */
export function Rail({ title, items, loading, owned }: RailProps) {
  if (!loading && (!items || items.length === 0)) return null;
  return (
    <View style={styles.rail}>
      <Text variant="heading" style={styles.railTitle}>
        {title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railRow}>
        {loading
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} style={{ width: 112, height: 168 }} />)
          : items!.map((it) => (
              <PosterCard
                key={`${it.mediaType}:${it.tmdbId}`}
                tmdbId={it.tmdbId}
                mediaType={it.mediaType}
                title={it.title}
                posterPath={it.posterPath}
                width={112}
                caption={[it.year, it.rating ? `★ ${it.rating}` : null].filter(Boolean).join(' · ')}
                inLibrary={owned?.has(`${it.mediaType}:${it.tmdbId}`)}
              />
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 6, color: colors.text, fontWeight: '600' },
  owned: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rail: { marginBottom: space.xl },
  railTitle: { paddingHorizontal: space.lg, marginBottom: space.md },
  railRow: { paddingHorizontal: space.lg, gap: space.md },
});
