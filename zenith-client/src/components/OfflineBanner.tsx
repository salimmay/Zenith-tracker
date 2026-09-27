import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsOffline } from '@/lib/network';
import { colors, ease, radius, space } from '@/theme';
import { Text } from './Text';

// Enters and leaves from the same (top) edge; leaving is quicker than arriving.
const ENTER = FadeInUp.duration(220).easing(ease.out);
const EXIT = FadeOutUp.duration(180).easing(ease.out);

/** A small pill under the status bar while the device has no connection. */
export function OfflineBanner() {
  const offline = useIsOffline();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={[styles.host, { top: insets.top + space.sm }]}>
      {offline && (
        <Animated.View entering={ENTER} exiting={EXIT} style={styles.pill} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Ionicons name="cloud-offline-outline" size={16} color={colors.amber} />
          <Text variant="caption" style={{ fontWeight: '700' }}>
            Offline · showing saved data
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.amberSoft,
  },
});
