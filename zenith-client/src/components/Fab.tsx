import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { colors, space } from '@/theme';
import { PressableScale } from './PressableScale';

/**
 * The one way to add something, on every tab. Tab screens end above the tab
 * bar, so a plain bottom offset keeps it clear of the bar on every platform.
 */
export function Fab() {
  return (
    <PressableScale
      onPress={() => router.push('/search')}
      scale={0.92}
      accessibilityRole="button"
      accessibilityLabel="Search and add a show or movie"
      style={styles.fab}
    >
      <LinearGradient colors={[colors.teal, colors.tealStrong]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill}>
        <Ionicons name="add" size={30} color={colors.onTeal} />
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: colors.tealStrong,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fill: { flex: 1, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
});
