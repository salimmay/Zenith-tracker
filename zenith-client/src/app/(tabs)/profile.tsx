import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdSlot } from '@/ads/AdSlot';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { Fab } from '@/components/Fab';
import { SectionHeader } from '@/components/Headers';
import { IconButton } from '@/components/IconButton';
import { Logo } from '@/components/Logo';
import { Poster } from '@/components/Poster';
import { openTitle } from '@/components/PosterCard';
import { PressableScale } from '@/components/PressableScale';
import { HeroTime, MonthlyChart, StatTile, StatusBreakdown } from '@/components/StatsViews';
import { ErrorState, Skeleton, SlowHint } from '@/components/States';
import { Text } from '@/components/Text';
import { useStats } from '@/data/library';
import { formatMinutes } from '@/lib/format';
import type { StatsRange, StatsType } from '@/lib/types';
import { useSession } from '@/store/session';
import { colors, radius, space } from '@/theme';

const TYPES: { value: StatsType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'tv', label: 'TV Shows' },
  { value: 'movie', label: 'Movies' },
];
const RANGES: { value: StatsRange; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

export default function ProfileScreen() {
  const user = useSession((s) => s.user);
  const [type, setType] = useState<StatsType>('all');
  const [range, setRange] = useState<StatsRange>('year');
  const stats = useStats(range, type);
  const s = stats.data;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.frame}>
          <View style={styles.topRow}>
            <Logo size={36} />
            <Text variant="display" style={{ flex: 1 }} numberOfLines={1}>
              {user ? user.username : 'Zenith'}
            </Text>
            <IconButton icon="settings-outline" tone="plain" size={24} accessibilityLabel="Settings" onPress={() => router.push('/settings')} />
          </View>

          <View style={styles.body}>
            {!user && (
              <View style={styles.guest}>
                <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                  Your stats live on this device. Sign in to keep them safe.
                </Text>
                <Button label="Sign in" size="sm" onPress={() => router.push('/auth')} />
              </View>
            )}

            <Text variant="display" style={{ marginTop: space.lg }}>
              Stats
            </Text>
            <Text tone="muted">Your watching, in numbers</Text>

            <View style={styles.typeTabs} accessibilityRole="tablist">
              {TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  onPress={() => setType(t.value)}
                  hitSlop={8}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: type === t.value }}
                >
                  <Text variant="heading" tone={type === t.value ? 'teal' : 'default'}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {stats.isError ? (
              <ErrorState message={(stats.error as Error).message} onRetry={() => stats.refetch()} />
            ) : !s ? (
              <View style={{ gap: space.lg }}>
                <SlowHint active />
                <Skeleton style={{ height: 170 }} />
                <Skeleton style={{ height: 180, borderRadius: radius.xl }} />
              </View>
            ) : (
              <>
                <Text variant="caption" tone="muted" style={{ marginBottom: space.sm }}>
                  Hours watched per month
                </Text>
                <MonthlyChart monthly={s.monthly} />

                <View style={styles.ranges}>
                  {RANGES.map((r) => (
                    <Chip key={r.value} label={r.label} active={range === r.value} onPress={() => setRange(r.value)} />
                  ))}
                </View>

                <HeroTime minutes={s.period.minutes} range={range} />
                <AdSlot style={{ marginTop: space.lg, marginBottom: 0 }} />

                <View style={styles.tiles}>
                  {type !== 'movie' && <StatTile value={s.period.episodes.toLocaleString()} label="Episodes" />}
                  {type !== 'tv' && <StatTile value={s.period.movies.toLocaleString()} label="Movies" />}
                  {type !== 'movie' && <StatTile value={String(s.shows)} label={`Shows${s.anime ? ` · ${s.anime} anime` : ''}`} />}
                </View>

                {s.titles > 0 && (
                  <>
                    <SectionHeader title="Library" count={s.titles} />
                    <View style={styles.card}>
                      <StatusBreakdown statuses={s.statuses} />
                    </View>
                  </>
                )}

                {s.genres.length > 0 && (
                  <>
                    <SectionHeader title="Top genres" />
                    <View style={styles.genres}>
                      {s.genres.map((g) => (
                        <View key={g.name} style={styles.genre}>
                          <Text variant="caption" style={{ fontWeight: '600' }}>
                            {g.name}
                          </Text>
                          <Text variant="caption" tone="faint">
                            {g.count}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {s.topShows.some((t) => t.minutes > 0) && (
                  <>
                    <SectionHeader title="Most watched" />
                    <View style={{ gap: space.sm }}>
                      {s.topShows
                        .filter((t) => t.minutes > 0)
                        .map((t, i) => (
                          <PressableScale key={t.tmdbId} scale={0.98} onPress={() => openTitle('tv', t.tmdbId)} style={styles.topRow2}>
                            <Text variant="heading" tone="faint" style={{ width: 20 }}>
                              {i + 1}
                            </Text>
                            <Poster path={t.posterPath} title={t.showName} width={40} size="w185" rounded={6} />
                            <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                              {t.showName}
                            </Text>
                            <Text variant="caption" tone="muted">
                              {formatMinutes(t.minutes)}
                            </Text>
                          </PressableScale>
                        ))}
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>
      <Fab />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  frame: { width: '100%', maxWidth: 720, alignSelf: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md },
  body: { paddingHorizontal: space.lg },
  guest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.tealSoft,
  },
  typeTabs: { flexDirection: 'row', gap: space.xl, marginTop: space.xl, marginBottom: space.xl },
  ranges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xl, marginBottom: space.lg },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  card: {
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  genre: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  topRow2: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 },
});
