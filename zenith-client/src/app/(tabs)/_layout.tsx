import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { colors } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Search lives behind the + button on every tab rather than in its own tab.
const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Up Next', icon: 'play-circle-outline', iconActive: 'play-circle' },
  { name: 'upcoming', title: 'Upcoming', icon: 'calendar-clear-outline', iconActive: 'calendar-clear' },
  { name: 'library', title: 'Library', icon: 'albums-outline', iconActive: 'albums' },
  { name: 'profile', title: 'Profile', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Tabs are peers: switching is instant, never a slide.
        animation: 'none',
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          ...(Platform.OS === 'web' ? { height: 60, paddingBottom: 6 } : {}),
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ focused, color }) => <Ionicons name={focused ? t.iconActive : t.icon} size={24} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
