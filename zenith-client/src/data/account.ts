import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { useGuest } from '@/store/guest';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { invalidateLibrary, migrateGuestLibrary, queryClient } from './library';

type AuthResponse = { token: string; user: User };

async function completeSignIn(res: AuthResponse) {
  useSession.getState().signIn(res.token, res.user);
  await migrateGuestLibrary();
}

export function useSignIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { identifier: string; password: string }) =>
      api<AuthResponse>('/auth/login', { method: 'POST', body, auth: false }),
    onSuccess: async (res) => {
      await completeSignIn(res);
      invalidateLibrary(qc);
    },
  });
}

export function useSignUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { username: string; email: string; password: string }) =>
      api<AuthResponse>('/auth/register', { method: 'POST', body, auth: false }),
    onSuccess: async (res) => {
      await completeSignIn(res);
      invalidateLibrary(qc);
    },
  });
}

export function signOut() {
  useSession.getState().signOut();
  // The saved cache holds this account's library; it shouldn't outlive the session.
  queryClient.clear();
}

/** Refresh the signed-in user (settings, Trakt link) from the server. */
export function useMe() {
  const token = useSession((s) => s.token);
  return useQuery({
    queryKey: ['me', token],
    enabled: Boolean(token),
    queryFn: async () => {
      const { user } = await api<{ user: User }>('/auth/me');
      useSession.getState().setUser(user);
      return user;
    },
  });
}

export function useIncludeSpecials() {
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const guestValue = useGuest((s) => s.includeSpecials);
  const value = user ? user.settings.includeSpecials : guestValue;

  const mutation = useMutation({
    mutationFn: async (includeSpecials: boolean) => {
      if (!useSession.getState().token) {
        useGuest.getState().setIncludeSpecials(includeSpecials);
        return;
      }
      const res = await api<{ user: User }>('/auth/me', { method: 'PATCH', body: { settings: { includeSpecials } } });
      useSession.getState().setUser(res.user);
    },
    onSuccess: () => invalidateLibrary(qc),
    onError: (err) => toast.error((err as Error).message),
  });
  return { value, set: mutation.mutate, pending: mutation.isPending };
}

// ─── Trakt ────────────────────────────────────────────────────────────────────

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  interval: number;
  expiresIn: number;
}

export function useTraktStatus() {
  const token = useSession((s) => s.token);
  return useQuery({
    queryKey: ['trakt', token],
    enabled: Boolean(token),
    queryFn: () =>
      api<{ available: boolean; connected: boolean; username: string | null; lastSyncedAt: string | null }>('/trakt/status'),
  });
}

export const startTraktDevice = () => api<DeviceCode>('/trakt/device', { method: 'POST' });
export const pollTraktDevice = (deviceCode: string) =>
  api<{ state: 'pending' | 'slow_down' | 'connected' | 'expired' | 'denied' | 'invalid' | 'used'; username?: string }>(
    '/trakt/device/poll',
    { method: 'POST', body: { deviceCode } }
  );

export function useTraktSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ added: number; updated: number; pushed: number; failed: number }>('/trakt/sync', {
        method: 'POST',
        timeoutMs: 120_000, // a first sync of a big Trakt library takes a while
      }),
    onSuccess: (s) => {
      invalidateLibrary(qc);
      qc.invalidateQueries({ queryKey: ['trakt'] });
      const parts = [s.added && `${s.added} added`, s.updated && `${s.updated} updated`, s.pushed && `${s.pushed} sent to Trakt`].filter(Boolean);
      toast.success(parts.length ? `Trakt synced · ${parts.join(', ')}` : 'Trakt synced · already in step');
    },
    onError: (err) => toast.error((err as Error).message),
  });
}

export function useTraktDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/trakt', { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trakt'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      toast.show('Trakt disconnected');
    },
  });
}
