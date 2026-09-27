import { keepPreviousData, QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { api, ApiError } from '@/lib/api';
import { episodeCode, itemKey } from '@/lib/format';
import type {
  CalendarEpisode,
  LibraryItem,
  MediaType,
  ProgressAction,
  Stats,
  StatsRange,
  StatsType,
  Status,
  UpNext,
  UpNextEntry,
} from '@/lib/types';
import { guestList, useGuest } from '@/store/guest';
import { useScope, useSession } from '@/store/session';
import { toast } from '@/store/toast';

/** How long saved data stays usable offline (and in the on-device cache). */
export const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Kept in memory as long as it's kept on disk, so saved data survives restarts.
      gcTime: CACHE_MAX_AGE,
      refetchOnWindowFocus: false,
      // Try once even when the OS says offline (it can be wrong), then wait for the
      // connection instead of spinning — saved data stays on screen meanwhile.
      networkMode: 'offlineFirst',
      // Network hiccups get two more tries with backoff; real errors (404, 401) don't.
      retry: (count, err) => (err instanceof ApiError && err.status === 0 ? count < 2 : count < 1),
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
  },
});

const isGuest = () => !useSession.getState().token;
const includeSpecials = () =>
  isGuest() ? useGuest.getState().includeSpecials : Boolean(useSession.getState().user?.settings.includeSpecials);

/** Everything that depends on the library — refreshed after any change. */
export function invalidateLibrary(qc = queryClient) {
  for (const key of ['upNext', 'library', 'entry', 'stats', 'calendar']) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

async function fetchUpNext(): Promise<UpNext> {
  if (!isGuest()) return api<UpNext>('/library/up-next');

  const items = guestList().filter(
    (i) => i.mediaType === 'tv' && ['watching', 'waiting', 'completed'].includes(i.status)
  );
  if (items.length === 0) return { watching: [], waiting: [] };

  const res = await api<{ items: (Omit<UpNextEntry, 'show'> & { tmdbId: number; error?: string })[] }>(
    '/catalog/progress/up-next',
    {
      method: 'POST',
      auth: false,
      body: {
        includeSpecials: includeSpecials(),
        items: items.map((i) => ({ tmdbId: i.tmdbId, status: i.status, progress: i.progress })),
      },
    }
  );

  const entries: UpNextEntry[] = [];
  res.items.forEach((r, idx) => {
    if (r.error) return;
    const show = items[idx];
    // Keep the device copy in step with what the engine resolved.
    if (show.status !== r.status || show.progress.totalEpisodesWatched !== r.progress.totalEpisodesWatched) {
      useGuest.getState().patch('tv', show.tmdbId, { status: r.status, progress: r.progress });
    }
    entries.push({ ...r, show: { ...show, status: r.status, progress: r.progress } });
  });

  return {
    watching: entries.filter((e) => e.status === 'watching'),
    waiting: entries
      .filter((e) => e.status === 'waiting')
      .sort((a, b) => (a.nextToAir?.airDate ?? '9999').localeCompare(b.nextToAir?.airDate ?? '9999')),
  };
}

export function useUpNext() {
  const scope = useScope();
  return useQuery({ queryKey: ['upNext', scope], queryFn: fetchUpNext });
}

export function useLibrary() {
  const scope = useScope();
  const guestItems = useGuest((s) => s.items);
  const query = useQuery({
    queryKey: ['library', scope],
    queryFn: () => api<{ items: LibraryItem[] }>('/library').then((r) => r.items),
    enabled: scope !== 'guest',
  });
  const guest = useMemo(
    () =>
      Object.values(guestItems).sort((a, b) =>
        (b.lastWatchedAt ?? b.createdAt ?? '').localeCompare(a.lastWatchedAt ?? a.createdAt ?? '')
      ),
    [guestItems]
  );
  return scope === 'guest'
    ? { data: guest, isLoading: false, isError: false, error: null, refetch: async () => {}, isRefetching: false }
    : query;
}

/** The library entry for one title, or null if it isn't tracked. */
export function useEntry(mediaType: MediaType, tmdbId: number) {
  const scope = useScope();
  const guestItem = useGuest((s) => s.items[itemKey(mediaType, tmdbId)] ?? null);
  const query = useQuery({
    queryKey: ['entry', scope, mediaType, tmdbId],
    queryFn: () => api<{ item: LibraryItem | null }>(`/library/lookup/${mediaType}/${tmdbId}`).then((r) => r.item),
    enabled: scope !== 'guest' && tmdbId > 0,
  });
  return scope === 'guest' ? { data: guestItem, isLoading: false } : { data: query.data ?? null, isLoading: query.isLoading };
}

function guestStats(range: StatsRange, type: StatsType): Stats {
  const all = guestList();
  const items = type === 'all' ? all : all.filter((i) => i.mediaType === type);
  const statuses: Stats['statuses'] = {};
  const genreCount = new Map<string, number>();
  let episodes = 0;
  let minutes = 0;
  for (const i of items) {
    statuses[i.status] = (statuses[i.status] ?? 0) + 1;
    for (const g of i.genres ?? []) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    if (i.mediaType === 'movie') {
      if (i.isWatched) minutes += i.runtime ?? 0;
    } else {
      episodes += i.progress.totalEpisodesWatched ?? 0;
      minutes += (i.progress.totalEpisodesWatched ?? 0) * (i.runtime ?? 0);
    }
  }

  // Same shape the server derives from its history collection.
  const now = new Date();
  const start =
    range === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1) : range === 'year' ? new Date(now.getFullYear(), 0, 1) : null;
  const log = useGuest.getState().history.filter((h) => type === 'all' || h.mediaType === type);
  const period = { minutes: 0, episodes: 0, movies: 0 };
  const byMonth = new Map<string, number>();
  for (const h of log) {
    const d = new Date(h.watchedAt);
    if (!start || d >= start) {
      period.minutes += h.minutes;
      if (h.mediaType === 'tv') period.episodes += h.episodes;
      else period.movies += 1;
    }
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    byMonth.set(month, (byMonth.get(month) ?? 0) + h.minutes);
  }

  return {
    titles: items.length,
    shows: items.filter((i) => i.mediaType === 'tv').length,
    anime: items.filter((i) => i.isAnime).length,
    movies: items.filter((i) => i.mediaType === 'movie').length,
    moviesWatched: items.filter((i) => i.isWatched).length,
    episodes,
    minutes,
    statuses,
    genres: [...genreCount].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => ({ name, count })),
    topShows: items
      .filter((i) => i.mediaType === 'tv')
      .map((i) => ({ tmdbId: i.tmdbId, showName: i.showName, posterPath: i.posterPath, minutes: (i.progress.totalEpisodesWatched ?? 0) * (i.runtime ?? 0) }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5),
    range,
    period,
    monthly: [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([month, minutes]) => ({ month, minutes })),
  };
}

export function useStats(range: StatsRange, type: StatsType) {
  const scope = useScope();
  const guestItems = useGuest((s) => s.items);
  const guestHistory = useGuest((s) => s.history);
  return useQuery({
    queryKey: ['stats', scope, range, type, scope === 'guest' ? [guestItems, guestHistory] : null],
    queryFn: () => (scope === 'guest' ? guestStats(range, type) : api<Stats>(`/library/stats?range=${range}&type=${type}`)),
    placeholderData: keepPreviousData,
  });
}

export function useCalendar() {
  const scope = useScope();
  return useQuery({
    queryKey: ['calendar', scope],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      if (scope !== 'guest') return api<{ episodes: CalendarEpisode[] }>('/calendar?days=120');
      const items = guestList().filter((i) => i.mediaType === 'tv' && i.status !== 'dropped' && i.status !== 'paused');
      if (items.length === 0) return { episodes: [] };
      return api<{ episodes: CalendarEpisode[] }>('/catalog/calendar', {
        method: 'POST',
        auth: false,
        body: {
          days: 120,
          items: items.map((i) => ({ tmdbId: i.tmdbId, showName: i.showName, posterPath: i.posterPath, status: i.status })),
        },
      });
    },
  });
}

// ─── Writes ───────────────────────────────────────────────────────────────────

interface AddInput {
  tmdbId: number;
  mediaType: MediaType;
  status?: Status;
}

async function addTitle({ tmdbId, mediaType, status }: AddInput): Promise<LibraryItem> {
  if (!isGuest()) {
    return api<{ item: LibraryItem }>('/library', { method: 'POST', body: { tmdbId, mediaType, status } }).then((r) => r.item);
  }
  const { meta, suggestedStatus } = await api<{ meta: Omit<LibraryItem, 'status' | 'progress' | 'tmdbId' | 'mediaType'>; suggestedStatus: Status | null }>(
    `/catalog/meta/${mediaType}/${tmdbId}`,
    { auth: false }
  );
  const resolved: Status =
    status && !['watching', 'waiting'].includes(status) ? status : (suggestedStatus ?? status ?? 'plan_to_watch');
  const now = new Date().toISOString();
  const item: LibraryItem = {
    ...meta,
    tmdbId,
    mediaType,
    status: resolved,
    progress: { season: 1, episode: 0, totalEpisodesWatched: 0 },
    isWatched: mediaType === 'movie' && resolved === 'completed',
    createdAt: now,
    lastWatchedAt: mediaType === 'movie' && resolved === 'completed' ? now : null,
  };
  useGuest.getState().upsert(item);
  if (item.isWatched) useGuest.getState().logWatch(item, 1);
  return item;
}

async function applyProgress(item: LibraryItem, action: ProgressAction): Promise<LibraryItem> {
  if (!isGuest()) {
    return api<{ item: LibraryItem }>(`/library/${item._id}/progress`, { method: 'POST', body: action }).then((r) => r.item);
  }
  const guest = useGuest.getState();
  // The caller's copy can be a stale snapshot (an Up Next card); the store is current.
  const current = guest.items[itemKey(item.mediaType, item.tmdbId)] ?? item;
  if (item.mediaType === 'movie') {
    const watched = action.type !== 'unwatch';
    const patch: Partial<LibraryItem> = {
      isWatched: watched,
      status: watched ? 'completed' : 'plan_to_watch',
      ...(watched ? { lastWatchedAt: new Date().toISOString() } : {}),
    };
    guest.patch('movie', item.tmdbId, patch);
    if (watched !== Boolean(current.isWatched)) guest.logWatch(current, watched ? 1 : -1);
    return { ...item, ...patch };
  }
  const res = await api<{ status: Status; progress: LibraryItem['progress'] }>('/catalog/progress/apply', {
    method: 'POST',
    auth: false,
    body: {
      item: { tmdbId: item.tmdbId, status: item.status, progress: { season: item.progress.season, episode: item.progress.episode } },
      action,
      includeSpecials: includeSpecials(),
    },
  });
  const patch: Partial<LibraryItem> = {
    status: res.status,
    progress: res.progress,
    ...(action.type !== 'unwatch' ? { lastWatchedAt: new Date().toISOString() } : {}),
  };
  guest.patch('tv', item.tmdbId, patch);
  guest.logWatch(current, (res.progress.totalEpisodesWatched ?? 0) - (current.progress.totalEpisodesWatched ?? 0));
  return { ...item, ...patch };
}

async function updateItem(item: LibraryItem, patch: { status?: Status; rating?: number | null }): Promise<LibraryItem> {
  if (!isGuest()) {
    return api<{ item: LibraryItem }>(`/library/${item._id}`, { method: 'PATCH', body: patch }).then((r) => r.item);
  }
  const next: Partial<LibraryItem> = { ...patch };
  if (item.mediaType === 'movie' && patch.status) {
    next.isWatched = patch.status === 'completed';
    if (next.isWatched && !item.isWatched) next.lastWatchedAt = new Date().toISOString();
    if (next.isWatched !== Boolean(item.isWatched)) useGuest.getState().logWatch(item, next.isWatched ? 1 : -1);
  }
  useGuest.getState().patch(item.mediaType, item.tmdbId, next);
  return { ...item, ...next };
}

async function removeItem(item: LibraryItem) {
  if (!isGuest()) {
    await api(`/library/${item._id}`, { method: 'DELETE' });
    return;
  }
  useGuest.getState().remove(item.mediaType, item.tmdbId);
}

function onError(err: unknown) {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  toast.error((err as Error).message);
}

export function useLibraryActions() {
  const qc = useQueryClient();
  const settle = () => invalidateLibrary(qc);

  const add = useMutation({ mutationFn: addTitle, onSuccess: settle, onError });
  const progress = useMutation({
    mutationFn: ({ item, action }: { item: LibraryItem; action: ProgressAction }) => applyProgress(item, action),
    onSuccess: settle,
    onError,
  });
  const update = useMutation({
    mutationFn: ({ item, patch }: { item: LibraryItem; patch: { status?: Status; rating?: number | null } }) =>
      updateItem(item, patch),
    onSuccess: settle,
    onError,
  });
  const remove = useMutation({ mutationFn: removeItem, onSuccess: settle, onError });

  return { add, progress, update, remove };
}

/**
 * The Up Next checkmark. Updates the card instantly (optimistic), confirms
 * with the server, and offers Undo. The card never waits on the network.
 */
export function useWatchNext() {
  const qc = useQueryClient();
  const scope = useScope();
  const key = ['upNext', scope];

  const undo = useMutation({
    mutationFn: (item: LibraryItem) => applyProgress(item, { type: 'unwatch' }),
    onSuccess: () => invalidateLibrary(qc),
    onError,
  });

  return useMutation({
    mutationFn: (entry: UpNextEntry) => applyProgress(entry.show, { type: 'watch' }),
    onMutate: async (entry) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<UpNext>(key);
      if (previous && entry.next) {
        qc.setQueryData<UpNext>(key, {
          ...previous,
          watching: previous.watching.map((e) => (e.show.tmdbId === entry.show.tmdbId ? predictAfterWatch(e) : e)),
        });
      }
      return { previous };
    },
    onError: (err, _entry, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
      onError(err);
    },
    onSuccess: (item, entry) => {
      const ep = entry.next ? episodeCode(entry.next.season, entry.next.episode) : 'Episode';
      toast.success(`${ep} watched · ${entry.show.showName}`, {
        label: 'Undo',
        onPress: () => undo.mutate(item),
      });
    },
    onSettled: () => invalidateLibrary(qc),
  });
}

/** Best guess at the card's next state, replaced by the server's answer moments later. */
function predictAfterWatch(entry: UpNextEntry): UpNextEntry {
  const next = entry.next!;
  const inSeason = next.episode < entry.seasonEpisodeCount;
  const remaining = Math.max(0, entry.remaining - 1);
  return {
    ...entry,
    progress: { ...entry.progress, season: next.season, episode: next.episode },
    remaining,
    next: remaining > 0
      ? { season: inSeason ? next.season : next.season + 1, episode: inSeason ? next.episode + 1 : 1, aired: true }
      : null,
  };
}

// ─── Account migration ────────────────────────────────────────────────────────

/** After sign-in: move everything tracked as a guest into the account. */
export async function migrateGuestLibrary() {
  const items = guestList();
  if (items.length === 0) return;
  try {
    const summary = await api<{ added: number; merged: number; failed: number }>('/library/sync-local', {
      method: 'POST',
      body: {
        items: items.map((i) => ({
          tmdbId: i.tmdbId,
          mediaType: i.mediaType,
          status: i.status,
          progress: { season: i.progress.season, episode: i.progress.episode },
          isWatched: i.isWatched ?? false,
          rating: i.rating ?? null,
          lastWatchedAt: i.lastWatchedAt ?? null,
        })),
        history: useGuest.getState().history,
      },
    });
    // Keep anything that failed on the device so a later sign-in can retry it.
    if (summary.failed === 0) useGuest.getState().clear();
    const moved = summary.added + summary.merged;
    if (moved > 0) toast.success(`Moved ${moved} title${moved === 1 ? '' : 's'} into your account`);
  } catch (err) {
    toast.error(`Couldn't move your device library yet: ${(err as Error).message}`);
  }
}
