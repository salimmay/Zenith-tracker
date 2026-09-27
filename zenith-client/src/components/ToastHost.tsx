import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/store/toast';
import { colors, ease, radius, space } from '@/theme';
import { Text } from './Text';

// Module scope: layout-animation builders shouldn't be rebuilt every render.
// Exit is quicker than entry — the user has already read it.
const ENTER = FadeInDown.duration(260).easing(ease.out);
const EXIT = FadeOutDown.duration(200).easing(ease.out);

/** Sits above the tab bar. Enters and leaves from the same edge. */
export function ToastHost({ bottomOffset = 64 }: { bottomOffset?: number }) {
  const insets = useSafeAreaInsets();
  const current = useToast((s) => s.toast);
  const dismiss = useToast((s) => s.dismiss);

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + bottomOffset + space.md }]}>
      {current && (
        <Animated.View
          key={current.id}
          entering={ENTER}
          exiting={EXIT}
          style={styles.toast}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {current.tone !== 'neutral' && (
            <Ionicons
              name={current.tone === 'error' ? 'alert-circle' : 'checkmark-circle'}
              size={20}
              color={current.tone === 'error' ? colors.danger : colors.teal}
            />
          )}
          <Text variant="caption" style={styles.message} numberOfLines={2}>
            {current.message}
          </Text>
          {current.action && (
            <Pressable
              hitSlop={12}
              accessibilityRole="button"
              onPress={() => {
                current.action!.onPress();
                dismiss(current.id);
              }}
            >
              <Text variant="caption" tone="teal" style={{ fontWeight: '800' }}>
                {current.action.label}
              </Text>
            </Pressable>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  message: { flex: 1, color: colors.text },
});
