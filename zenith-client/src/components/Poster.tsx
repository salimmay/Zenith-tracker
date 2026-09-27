import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { poster } from '@/lib/format';
import { colors, radius } from '@/theme';
import { Text } from './Text';

interface Props {
  path: string | null | undefined;
  title: string;
  width: number;
  size?: 'w185' | 'w342' | 'w500';
  style?: StyleProp<ViewStyle>;
  rounded?: number;
}

/** 2:3 poster. Falls back to the title's initials so a missing image never leaves a hole. */
export function Poster({ path, title, width, size = 'w342', style, rounded = radius.md }: Props) {
  const uri = poster(path, size);
  const height = Math.round(width * 1.5);
  return (
    <View style={[styles.frame, { width, height, borderRadius: rounded }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          recyclingKey={uri}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text variant="heading" tone="faint" style={styles.initials}>
          {title
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0])
            .join('')
            .toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  initials: { letterSpacing: 1 },
});
