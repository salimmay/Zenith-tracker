import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/Button';
import { Loading } from '@/components/States';
import { Text } from '@/components/Text';
import { pollTraktDevice, startTraktDevice, useTraktSync, type DeviceCode } from '@/data/account';
import { colors, radius, space } from '@/theme';

type Phase = 'starting' | 'waiting' | 'connected' | 'failed';

/**
 * Trakt device-code flow: show a short code, the user approves it on
 * trakt.tv/activate, and we poll until Trakt says yes. No redirect URL needed.
 */
export default function TraktSheet() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const sync = useTraktSync();
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [phase, setPhase] = useState<Phase>('starting');
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let interval = 5;

    const poll = async (device: DeviceCode, deadline: number) => {
      if (cancelled) return;
      if (Date.now() > deadline) {
        setPhase('failed');
        setMessage('The code expired. Start again to get a new one.');
        return;
      }
      try {
        const res = await pollTraktDevice(device.deviceCode);
        if (cancelled) return;
        if (res.state === 'connected') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setPhase('connected');
          qc.invalidateQueries({ queryKey: ['trakt'] });
          qc.invalidateQueries({ queryKey: ['me'] });
          return;
        }
        if (res.state === 'denied' || res.state === 'expired' || res.state === 'invalid' || res.state === 'used') {
          setPhase('failed');
          setMessage(res.state === 'denied' ? 'Access was declined on Trakt.' : 'That code is no longer valid. Start again.');
          return;
        }
        if (res.state === 'slow_down') interval += 1;
      } catch {
        // transient network error — keep polling until the deadline
      }
      timer.current = setTimeout(() => poll(device, deadline), interval * 1000);
    };

    startTraktDevice()
      .then((device) => {
        if (cancelled) return;
        setCode(device);
        setPhase('waiting');
        interval = device.interval;
        poll(device, Date.now() + device.expiresIn * 1000);
      })
      .catch((err: Error) => {
        setPhase('failed');
        setMessage(err.message);
      });

    return () => {
      cancelled = true;
      clearTimeout(timer.current);
    };
  }, [qc]);

  return (
    <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.icon}>
        <Ionicons name={phase === 'connected' ? 'checkmark' : 'sync'} size={26} color={colors.teal} />
      </View>
      <Text variant="title" style={styles.center}>
        {phase === 'connected' ? 'Trakt connected' : 'Connect Trakt'}
      </Text>

      {phase === 'starting' && <Loading style={{ paddingVertical: space.xl }} />}

      {phase === 'waiting' && code && (
        <>
          <Text tone="muted" style={styles.center}>
            Open trakt.tv/activate and enter this code. This screen updates by itself.
          </Text>
          <View style={styles.codeBox} accessible accessibilityLabel={`Code ${code.userCode.split('').join(' ')}`}>
            <Text style={styles.code} selectable>
              {code.userCode}
            </Text>
          </View>
          <Button label="Open trakt.tv/activate" icon="open-outline" onPress={() => WebBrowser.openBrowserAsync(`${code.verificationUrl}/${code.userCode}`)} />
          <View style={styles.waiting}>
            <ActivityIndicator size="small" color={colors.textFaint} />
            <Text variant="caption" tone="faint">
              Waiting for approval…
            </Text>
          </View>
        </>
      )}

      {phase === 'connected' && (
        <>
          <Text tone="muted" style={styles.center}>
            Run a first sync to bring your Trakt history into Zenith and send Zenith's progress to Trakt. From now on,
            every episode you check off is sent to Trakt automatically.
          </Text>
          <Button
            label="Sync now"
            icon="sync"
            loading={sync.isPending}
            onPress={() => sync.mutate(undefined, { onSuccess: () => router.back() })}
            style={{ marginTop: space.lg }}
          />
          <Button label="Later" variant="ghost" onPress={() => router.back()} />
        </>
      )}

      {phase === 'failed' && (
        <>
          <Text tone="danger" style={styles.center}>
            {message}
          </Text>
          <Button label="Close" variant="secondary" onPress={() => router.back()} style={{ marginTop: space.lg }} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: colors.surface, padding: space.xl, paddingTop: space.xl + 4, gap: space.md },
  icon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.tealSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  codeBox: {
    alignSelf: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginVertical: space.sm,
  },
  code: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: 6, color: colors.text, fontVariant: ['tabular-nums'] },
  waiting: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.sm },
});
