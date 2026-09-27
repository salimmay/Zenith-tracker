import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, radius, space, type } from '@/theme';
import { Text } from './Text';

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.screen}>
      <View style={{ flex: 1 }}>
        <Text variant="display" accessibilityRole="header">
          {title}
        </Text>
        {subtitle && (
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {right && <View style={styles.right}>{right}</View>}
    </View>
  );
}

export function SectionHeader({ title, count, right }: { title: string; count?: number; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="micro" tone="muted" accessibilityRole="header">
        {title}
        {count !== undefined && <Text variant="micro" tone="faint">{`  ${count}`}</Text>}
      </Text>
      {right}
    </View>
  );
}

interface SearchProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}

export function SearchField({ value, onChangeText, placeholder, autoFocus }: SearchProps) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={18} color={colors.textFaint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        accessibilityLabel={placeholder}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={colors.textFaint} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    gap: space.md,
  },
  right: { flexDirection: 'row', gap: space.sm, paddingBottom: 2 },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
    marginBottom: space.md,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  // 16px minimum keeps iOS Safari from zooming the page on focus (Expo web).
  input: { flex: 1, color: colors.text, ...type.body, fontSize: 16, paddingVertical: 0 },
});
