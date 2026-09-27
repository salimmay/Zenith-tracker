import { router } from 'expo-router';
import { View } from 'react-native';
import { EmptyState } from '@/components/States';
import { colors } from '@/theme';

export default function NotFound() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
      <EmptyState icon="help-circle-outline" title="This page doesn't exist" action={{ label: 'Go to Up Next', onPress: () => router.replace('/') }} />
    </View>
  );
}
