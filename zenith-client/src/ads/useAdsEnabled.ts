import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { api } from '@/lib/api';
import { usePrefs } from '@/store/prefs';
import { useSession } from '@/store/session';
import { useAdsState } from './consent';

/** No ads for the first days after install: the first impression stays clean. */
const GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/** Remote kill switch — ads can be turned off without shipping an update. */
function useAdsConfig() {
  return useQuery({
    queryKey: ['config'],
    enabled: Platform.OS !== 'web',
    staleTime: 60 * 60_000,
    queryFn: () => api<{ ads: { enabled: boolean } }>('/config', { auth: false }),
  });
}

/**
 * The single answer to "may this screen show an ad?". A paid "remove ads"
 * only has to set `user.adFree` — no screen needs to change.
 */
export function useAdsEnabled() {
  const config = useAdsConfig();
  const ready = useAdsState((s) => s.ready);
  const adFree = useSession((s) => s.user?.adFree === true);
  const installedAt = usePrefs((s) => s.installedAt);
  const graceOver = __DEV__ || (installedAt !== null && Date.now() - installedAt > GRACE_MS);

  return Platform.OS !== 'web' && ready && config.data?.ads.enabled === true && !adFree && graceOver;
}
