import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdSlot } from '@/ads/AdSlot';
import { Fab } from '@/components/Fab';
import { GlowEmpty } from '@/components/GlowEmpty';
import { ScreenHeader } from '@/components/Headers';
import { Poster } from '@/components/Poster';
import { openTitle } from '@/components/PosterCard';
import { PressableScale } from '@/components/PressableScale';
import { ErrorState, Skeleton, SlowHint } from '@/components/States';
import { Text } from '@/components/Text';
import { useCalendar } from '@/data/library';
import { daysUntil, episodeCode, parseDay } from '@/lib/format';
import type { CalendarEpisode } from '@/lib/types';
import { colors, radius, space } from '@/theme';

const RAIL = 72;

function countdown(date: string) {
  const d = daysUntil(date);
  if (d <= 0) return { value: 'Today', unit: '' };
  return { value: String(d), unit: d === 1 ? 'Day' : 'Days' };
}

function label(ep: CalendarEpisode) {
  if (ep.isPremiere) return ep.season === 1 ? 'Series Premiere' : `Season ${ep.season} Premiere`;
  if (ep.isFinale) return `Season ${ep.season} Finale`;
  return `${episodeCode(ep.season, ep.episode)}${ep.name ? ` · ${ep.name}` : ''}`;
}

/** Everything airing soon, on a countdown rail — nearest first. */
export default function UpcomingScreen() {
  const { data, isLoading, isError, error, refetch, isRefetching } = useCalendar();
  const episodes = data?.episodes ?? [];
  // Narrow phones: a smaller poster leaves the episode label room to breathe.
  const posterWidth = useWindowDimensions().width < 380 ? 60 : 80;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.teal} colors={[colors.teal]} />}
      >
        <View style={styles.frame}>
          <ScreenHeader title="Upcoming" subtitle="Don't miss out on these upcoming releases" />
          {isLoading ? (
            <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
              <SlowHint active />
              {Array.from({ length: 4 }, (_, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: space.lg }}>
                  <Skeleton style={{ width: RAIL, height: 120, borderRadius: RAIL / 2 }} />
                  <Skeleton style={{ width: 80, height: 120 }} />
                  <Skeleton style={{ flex: 1, height: 60 }} />
                </View>
              ))}
            </View>
          ) : isError ? (
            <ErrorState message={(error as Error).message} onRetry={refetch} />
          ) : episodes.length === 0 ? (
            <GlowEmpty
              message={'Nothing scheduled yet.\nAdd shows and their next episodes appear here.'}
              action={{ label: 'Find shows to follow', onPress: () => router.push('/search') }}
            />
          ) : (
            <View style={styles.timeline}>
              {/* One continuous rail behind every row; each day's countdown sits on it. */}
              <LinearGradient
                colors={[colors.teal, colors.tealStrong, '#17524C']}
                style={styles.rail}
                pointerEvents="none"
              />
              {episodes.map((ep, i) => {
                const newDay = i === 0 || episodes[i - 1].airDate !== ep.airDate;
                const c = countdown(ep.airDate);
                return (
                  <PressableScale
                    key={`${ep.tmdbId}-${ep.season}-${ep.episode}`}
                    scale={0.98}
                    onPress={() => openTitle('tv', ep.tmdbId)}
                    accessibilityRole="button"
                    accessibilityLabel={`${ep.showName}, ${label(ep)}, ${c.value} ${c.unit}`}
                    style={styles.row}
                  >
                    <View style={styles.railSlot}>
                      <View style={[styles.dot, !newDay && styles.dotSmall]} />
                      {newDay && (
                        <>
                          <Text style={styles.countValue}>{c.value}</Text>
                          {c.unit ? <Text style={styles.countUnit}>{c.unit}</Text> : null}
                        </>
                      )}
                    </View>
                    <Poster path={ep.posterPath} title={ep.showName} width={posterWidth} size="w185" rounded={radius.md} />
                    <View style={styles.info}>
                      <Text variant="heading" numberOfLines={1} style={{ fontSize: 18 }}>
                        {ep.showName}
                      </Text>
                      <View style={styles.line}>
                        <Ionicons name="tv-outline" size={18} color={ep.isPremiere ? colors.teal : colors.textMuted} />
                        <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }} tone={ep.isPremiere ? 'teal' : 'default'}>
                          {label(ep)}
                        </Text>
                      </View>
                      <View style={styles.line}>
                        <Ionicons name="alarm-outline" size={18} color={colors.textMuted} />
                        <Text tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                          {parseDay(ep.airDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                      </View>
                    </View>
                  </PressableScale>
                );
              })}
            </View>
          )}
          {/* Full width after the timeline: beside the rail there isn't room for a banner. */}
          {episodes.length > 0 && <AdSlot style={styles.ad} />}
        </View>
      </ScrollView>
      <Fab />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  frame: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  timeline: { paddingHorizontal: space.lg },
  rail: { position: 'absolute', left: space.lg, top: 0, bottom: 0, width: RAIL, borderRadius: RAIL / 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.md },
  railSlot: { width: RAIL, alignItems: 'center', gap: 2 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 3,
    borderColor: 'rgba(6,32,29,0.35)',
    marginBottom: 4,
  },
  dotSmall: { width: 8, height: 8, borderRadius: 4, borderWidth: 0, backgroundColor: 'rgba(255,255,255,0.5)' },
  countValue: { color: colors.onTeal, fontSize: 20, lineHeight: 24, fontWeight: '800', textAlign: 'center' },
  countUnit: { color: colors.onTeal, fontSize: 13, lineHeight: 16, fontWeight: '600' },
  info: { flex: 1, gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ad: { marginHorizontal: space.lg, marginTop: space.xl },
});
