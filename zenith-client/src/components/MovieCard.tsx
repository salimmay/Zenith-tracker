import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { LibraryItem } from '@/lib/types';
import { colors, radius, space } from '@/theme';
import { Poster } from './Poster';
import { openTitle } from './PosterCard';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

function runtimeLabel(minutes?: number) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  return h ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}

/** A movie on the watchlist, laid out like an Up Next card. */
function MovieCardBase({ item, onWatch }: { item: LibraryItem; onWatch: (item: LibraryItem) => void }) {
  const facts = [item.year, runtimeLabel(item.runtime)].filter(Boolean).join(' · ');
  return (
    <View style={styles.card}>
      <Pressable onPress={() => openTitle('movie', item.tmdbId)} accessibilityRole="button" accessibilityLabel={`Open ${item.showName}`}>
        <Poster path={item.posterPath} title={item.showName} width={96} rounded={radius.md} />
      </Pressable>
      <View style={styles.info}>
        <Pressable onPress={() => openTitle('movie', item.tmdbId)}>
          <Text variant="title" numberOfLines={2} style={{ fontSize: 19, lineHeight: 24 }}>
            {item.showName}
          </Text>
          {facts ? (
            <Text tone="muted" style={{ marginTop: 2 }}>
              {facts}
            </Text>
          ) : null}
          {item.genres?.length ? (
            <Text variant="caption" tone="faint" numberOfLines={1} style={{ marginTop: 2 }}>
              {item.genres.slice(0, 3).join(' · ')}
            </Text>
          ) : null}
        </Pressable>
        <View style={styles.actions}>
          <PressableScale onPress={() => openTitle('movie', item.tmdbId)} style={styles.infoButton} accessibilityRole="button">
            <Text variant="caption" style={{ fontWeight: '700' }}>
              Details
            </Text>
          </PressableScale>
          <View style={{ flex: 1 }} />
          <PressableScale
            onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
            onPress={() => onWatch(item)}
            scale={0.9}
            accessibilityRole="button"
            accessibilityLabel={`Mark ${item.showName} watched`}
            style={styles.check}
          >
            <Ionicons name="checkmark" size={22} color={colors.teal} />
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

export const MovieCard = memo(MovieCardBase);

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: space.lg, marginBottom: space.lg },
  info: { flex: 1, justifyContent: 'space-between', paddingVertical: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  infoButton: {
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
  },
  check: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
