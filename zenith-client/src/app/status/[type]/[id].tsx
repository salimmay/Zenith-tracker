import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Text } from '@/components/Text';
import { useEntry, useLibraryActions } from '@/data/library';
import { STATUS_LABEL } from '@/lib/format';
import type { MediaType, Status } from '@/lib/types';
import { toast } from '@/store/toast';
import { colors, radius, space } from '@/theme';

const TV_STATUSES: { value: Status; hint: string }[] = [
  { value: 'watching', hint: 'Shows up in Up Next' },
  { value: 'plan_to_watch', hint: 'Saved for later' },
  { value: 'paused', hint: 'Hidden from Up Next until you resume' },
  { value: 'completed', hint: 'Finished' },
  { value: 'dropped', hint: 'Not for you' },
];
const MOVIE_STATUSES: { value: Status; hint: string }[] = [
  { value: 'plan_to_watch', hint: 'Saved for later' },
  { value: 'completed', hint: 'Watched' },
  { value: 'dropped', hint: 'Not for you' },
];

/** Form sheet: pick a status, rate it, or remove it. */
export default function StatusSheet() {
  const params = useLocalSearchParams<{ type: MediaType; id: string }>();
  const type: MediaType = params.type === 'movie' ? 'movie' : 'tv';
  const { data: entry } = useEntry(type, Number(params.id));
  const { update, remove } = useLibraryActions();
  const insets = useSafeAreaInsets();

  if (!entry) return <View style={styles.sheet} />;

  const setStatus = (status: Status) => {
    Haptics.selectionAsync();
    if (status !== entry.status) update.mutate({ item: entry, patch: { status } });
    router.back();
  };

  const setRating = (stars: number) => {
    Haptics.selectionAsync();
    const rating = entry.rating === stars * 2 ? null : stars * 2; // tap the same star to clear
    update.mutate({ item: entry, patch: { rating } });
  };

  const confirmRemove = () => {
    const go = () => {
      remove.mutate(entry, { onSuccess: () => toast.show(`Removed ${entry.showName}`) });
      router.back();
    };
    if (Platform.OS === 'web') return go();
    Alert.alert(`Remove ${entry.showName}?`, 'Your progress for this title will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: go },
    ]);
  };

  // "Up to date" is set by the app, not picked — show it as selected "Watching".
  const current = entry.status === 'waiting' ? 'watching' : entry.status;
  const stars = entry.rating ? entry.rating / 2 : 0;

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
      <Text variant="title" numberOfLines={1}>
        {entry.showName}
      </Text>

      <View style={styles.list}>
        {(type === 'tv' ? TV_STATUSES : MOVIE_STATUSES).map((s) => {
          const active = current === s.value;
          return (
            <Pressable
              key={s.value}
              onPress={() => setStatus(s.value)}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfacePressed }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" tone={active ? 'teal' : 'default'}>
                  {type === 'movie' && s.value === 'completed' ? 'Watched' : STATUS_LABEL[s.value]}
                </Text>
                <Text variant="caption" tone="faint">
                  {s.hint}
                </Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={22} color={colors.teal} />}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.ratingRow}>
        <Text variant="bodyStrong">Your rating</Text>
        <View style={{ flexDirection: 'row', gap: 2 }} accessibilityRole="adjustable" accessibilityValue={{ min: 0, max: 5, now: stars }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`} style={styles.star}>
              <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={24} color={n <= stars ? colors.amber : colors.textFaint} />
            </Pressable>
          ))}
        </View>
      </View>

      <Button label="Remove from library" variant="danger" icon="trash-outline" onPress={confirmRemove} style={{ marginTop: space.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, padding: space.xl, paddingTop: space.xl + 4 },
  list: {
    marginTop: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg },
  star: { padding: 4 },
});
