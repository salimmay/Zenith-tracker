import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { startAds } from '@/ads/consent';
import { KeyboardProvider } from '@/components/Keyboard';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ToastHost } from '@/components/ToastHost';
import { useMe } from '@/data/account';
import { CACHE_MAX_AGE, queryClient } from '@/data/library';
import '@/lib/network'; // connects React Query to the device's online/offline state
import { useSession } from '@/store/session';
import { colors } from '@/theme';

SplashScreen.preventAutoHideAsync();

// The last data each screen loaded is saved on the device, so a bad or missing
// connection still opens straight into your shows instead of a spinner.
const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'zenith-query-cache', throttleTime: 1000 });
const persistOptions = {
  persister,
  maxAge: CACHE_MAX_AGE,
  buster: 'v2', // bump when cached shapes change
  dehydrateOptions: {
    // Search results are throwaway; everything else that loaded fine is kept.
    shouldDehydrateQuery: (q: { state: { status: string }; queryKey: readonly unknown[] }) =>
      q.state.status === 'success' && q.queryKey[0] !== 'search',
  },
};

const SHEET = {
  presentation: 'formSheet',
  sheetAllowedDetents: 'fitToContents',
  sheetGrabberVisible: true,
  sheetCornerRadius: 22,
  contentStyle: { backgroundColor: colors.surface },
} as const;

function SessionRefresher() {
  useMe(); // keeps the stored user (settings, Trakt link) fresh on launch
  return null;
}

export default function RootLayout() {
  const hydrated = useSession((s) => s.hydrated);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!hydrated) return;
    SplashScreen.hideAsync();
    startAds(); // consent → tracking prompt → SDK; never blocks the UI
  }, [hydrated]);

  // Render nothing until the stored session is read, so we never flash the
  // guest UI for a signed-in user.
  if (!hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
            <SessionRefresher />
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.background },
                animation: reduced ? 'fade' : 'default',
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="title/[type]/[id]" />
              <Stack.Screen name="season/[id]/[season]" />
              {/* A task the user can abandon: search, sign in, settings. */}
              <Stack.Screen name="search" options={{ presentation: 'modal', animation: reduced ? 'fade' : 'slide_from_bottom' }} />
              <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
              <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
              {/* Short interruptions: native sheets sized to their content. */}
              <Stack.Screen name="status/[type]/[id]" options={SHEET} />
              <Stack.Screen name="episode/[id]/[season]/[episode]" options={SHEET} />
              <Stack.Screen name="sort" options={SHEET} />
              <Stack.Screen name="trakt" options={SHEET} />
            </Stack>
            {/* Sits above the tab bar and the + button. */}
            <ToastHost bottomOffset={132} />
            <OfflineBanner />
          </PersistQueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
