import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { UP_NEXT_SORTS, usePrefs } from '@/store/prefs';
import { colors, radius, space } from '@/theme';

/** Sort order for Up Next. Picking one applies it and closes the sheet. */
export default function SortSheet() {
  const insets = useSafeAreaInsets();
  const sort = usePrefs((s) => s.upNextSort);
  const setSort = usePrefs((s) => s.setUpNextSort);

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
      <Text variant="micro" tone="muted" style={{ marginBottom: space.sm, marginLeft: space.sm }}>
        Sort by
      </Text>
      {UP_NEXT_SORTS.map((o) => {
        const active = o.value === sort;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              Haptics.selectionAsync();
              setSort(o.value);
              router.back();
            }}
            style={({ pressed }) => [styles.option, active && styles.active, pressed && !active && styles.pressed]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {o.label}
            </Text>
            {active && <Ionicons name="checkmark" size={20} color={colors.teal} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, padding: space.lg, paddingTop: space.xl + 4 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 54,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
  },
  active: { backgroundColor: colors.surfaceRaised },
  pressed: { backgroundColor: colors.surfacePressed },
});
