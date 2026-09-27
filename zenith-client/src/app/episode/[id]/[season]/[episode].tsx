import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Badge } from '@/components/Chip';
import { Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { useSeason, useTv } from '@/data/catalog';
import { useEntry, useLibraryActions } from '@/data/library';
import { episodeCode, parseDay, relativeDay, still } from '@/lib/format';
import { toast } from '@/store/toast';
import { colors, radius, space } from '@/theme';

/** Episode details as a sheet: still, synopsis, air date, and a watched toggle. */
export default function EpisodeSheet() {
  const p = useLocalSearchParams<{ id: string; season: string; episode: string }>();
  const tvId = Number(p.id);
  const seasonNumber = Number(p.season);
  const episodeNumber = Number(p.episode);
  const insets = useSafeAreaInsets();
  const show = useTv(tvId);
  const season = useSeason(tvId, seasonNumber);
  const { data: entry } = useEntry('tv', tvId);
  const { progress } = useLibraryActions();

  const ep = season.data?.episodes.find((e) => e.episodeNumber === episodeNumber);
  const lastAired = show.data?.lastAired;
  const aired =
    !!lastAired && (lastAired.season > seasonNumber || (lastAired.season === seasonNumber && lastAired.episode >= episodeNumber));
  const watched =
    !!entry &&
    (entry.progress.season > seasonNumber ||
      (entry.progress.season === seasonNumber && entry.progress.episode >= episodeNumber));

  const toggle = () =>
    entry &&
    progress.mutate(
      {
        item: entry,
        action: { type: 'set', season: seasonNumber, episode: watched ? episodeNumber - 1 : episodeNumber },
      },
      {
        onSuccess: () => {
          toast.success(watched ? 'Marked unwatched' : `Watched up to ${episodeCode(seasonNumber, episodeNumber)}`);
          router.back();
        },
      }
    );

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
      {!ep ? (
        <Loading />
      ) : (
        <>
          {ep.stillPath ? (
            <Image source={{ uri: still(ep.stillPath)! }} style={styles.still} contentFit="cover" transition={150} />
          ) : null}
          <View style={{ gap: 4, marginTop: space.lg }}>
            <Text variant="caption" tone="teal" style={{ fontWeight: '700' }}>
              {show.data?.title} · {episodeCode(seasonNumber, episodeNumber)}
            </Text>
            <Text variant="title">{ep.name}</Text>
            <View style={styles.meta}>
              {ep.airDate && (
                <Text variant="caption" tone="muted">
                  {aired
                    ? parseDay(ep.airDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
                    : `Airs ${relativeDay(ep.airDate)}`}
                </Text>
              )}
              {ep.runtime ? <Text variant="caption" tone="muted">· {ep.runtime}m</Text> : null}
              {ep.rating ? <Text variant="caption" tone="muted">· ★ {ep.rating}</Text> : null}
              {watched && <Badge label="Watched" tone="teal" />}
            </View>
          </View>
          {ep.overview ? (
            <Text tone="muted" style={{ marginTop: space.md }}>
              {ep.overview}
            </Text>
          ) : null}
          {entry && aired && (
            <Button
              label={watched ? 'Mark unwatched' : 'Mark watched'}
              icon={watched ? 'close' : 'checkmark'}
              variant={watched ? 'secondary' : 'primary'}
              loading={progress.isPending}
              onPress={toggle}
              style={{ marginTop: space.xl }}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, padding: space.xl, paddingTop: space.xl + 4 },
  still: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
});
