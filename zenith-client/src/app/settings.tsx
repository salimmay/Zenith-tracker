import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { showAdPrivacyOptions, useAdsState } from '@/ads/consent';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { Text } from '@/components/Text';
import { signOut, useIncludeSpecials, useTraktDisconnect, useTraktStatus, useTraktSync } from '@/data/account';
import { relativeDay } from '@/lib/format';
import { useSession } from '@/store/session';
import { colors, radius, space } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const user = useSession((s) => s.user);
  const specials = useIncludeSpecials();
  const privacyOptionsRequired = useAdsState((s) => s.privacyOptionsRequired);

  const confirmSignOut = () => {
    const go = () => {
      signOut();
      router.back();
    };
    if (Platform.OS === 'web') return go();
    Alert.alert('Sign out?', 'Your library stays safe in your account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: go },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xxl }]}>
      <View style={styles.header}>
        <Text variant="display" style={{ flex: 1 }}>
          Settings
        </Text>
        <Button label="Done" variant="ghost" size="sm" onPress={() => router.back()} />
      </View>

      <Group>
        {user ? (
          <>
            <Row icon="person-circle-outline" title={user.username} subtitle={user.email} />
            <Row icon="log-out-outline" title="Sign out" onPress={confirmSignOut} chevron />
          </>
        ) : (
          <Row
            icon="person-circle-outline"
            title="Sign in or create an account"
            subtitle="Back up your library and sync it everywhere"
            onPress={() => router.push('/auth')}
            chevron
          />
        )}
      </Group>

      <Text variant="micro" tone="muted" style={styles.groupLabel}>
        Automation
      </Text>
      <Group>
        {user ? (
          <TraktRow />
        ) : (
          <Row icon="sync-outline" title="Trakt sync" subtitle="Sign in to connect your Trakt account" />
        )}
      </Group>

      <Text variant="micro" tone="muted" style={styles.groupLabel}>
        Tracking
      </Text>
      <Group>
        <Row
          icon="sparkles-outline"
          title="Include specials"
          subtitle="Count Season 0 extras in Up Next and progress"
          right={
            <Switch
              value={specials.value}
              onValueChange={specials.set}
              disabled={specials.pending}
              trackColor={{ true: colors.tealStrong, false: colors.surfacePressed }}
              thumbColor={Platform.OS === 'android' ? colors.text : undefined}
              accessibilityLabel="Include specials"
            />
          }
        />
      </Group>

      {(privacyOptionsRequired || PRIVACY_URL) && (
        <>
          <Text variant="micro" tone="muted" style={styles.groupLabel}>
            Privacy and ads
          </Text>
          <Group>
            {privacyOptionsRequired && (
              <Row
                icon="shield-checkmark-outline"
                title="Ad privacy choices"
                subtitle="Change how ads may use your data"
                onPress={() => showAdPrivacyOptions().catch(() => {})}
                chevron
              />
            )}
            {PRIVACY_URL && (
              <Row icon="document-text-outline" title="Privacy policy" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} chevron />
            )}
          </Group>
        </>
      )}

      <Text variant="caption" tone="faint" style={styles.credit}>
        Metadata and images from TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.
      </Text>
    </ScrollView>
  );
}

function syncedWhen(iso: string) {
  const d = new Date(iso);
  const day = relativeDay(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  return day === 'Today' || day === 'Yesterday' ? day.toLowerCase() : `on ${day}`;
}

function TraktRow() {
  const status = useTraktStatus();
  const sync = useTraktSync();
  const disconnect = useTraktDisconnect();
  const t = status.data;

  if (status.isLoading) return <Row icon="sync-outline" title="Trakt" right={<ActivityIndicator color={colors.teal} />} />;
  if (!t?.available) return <Row icon="sync-outline" title="Trakt" subtitle="Not configured on the server" />;
  if (!t.connected) {
    return (
      <Row icon="sync-outline" title="Connect Trakt" subtitle="Two-way sync of your watch history" onPress={() => router.push('/trakt')} chevron />
    );
  }
  return (
    <>
      <Row
        icon="sync-outline"
        title={`Trakt · ${t.username ?? 'connected'}`}
        subtitle={t.lastSyncedAt ? `Last synced ${syncedWhen(t.lastSyncedAt)}` : 'Not synced yet'}
        right={<Button label="Sync now" size="sm" loading={sync.isPending} onPress={() => sync.mutate()} />}
      />
      <Row icon="unlink-outline" title="Disconnect Trakt" onPress={() => disconnect.mutate()} right={disconnect.isPending ? <ActivityIndicator color={colors.teal} /> : undefined} />
    </>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

function Row({
  icon,
  title,
  subtitle,
  right,
  onPress,
  chevron,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const content = (
    <>
      <Ionicons name={icon} size={22} color={colors.text} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="heading">{title}</Text>
        {subtitle && (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        )}
      </View>
      {right}
      {chevron && <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />}
    </>
  );
  return onPress ? (
    <PressableScale scale={0.98} onPress={onPress} accessibilityRole="button" style={styles.row}>
      {content}
    </PressableScale>
  ) : (
    <View style={styles.row}>{content}</View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: space.lg, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: space.xl },
  groupLabel: { marginTop: space.xl, marginBottom: space.sm, marginLeft: space.xs },
  group: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  credit: { marginTop: space.xxl, textAlign: 'center' },
});
