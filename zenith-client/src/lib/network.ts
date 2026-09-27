import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';

// React Query learns about connectivity from the OS: queries pause while
// offline and refetch by themselves when the connection comes back.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    // isInternetReachable is null while unknown — only a definite "no" counts as offline.
    setOnline(Boolean(state.isConnected) && state.isInternetReachable !== false);
  })
);

export function useIsOffline() {
  return !useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true
  );
}

/** True once `active` has stayed true for `afterMs` — "this is taking a while". */
export function useSlow(active: boolean, afterMs = 4000) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), afterMs);
    return () => clearTimeout(t);
  }, [active, afterMs]);
  return slow;
}
