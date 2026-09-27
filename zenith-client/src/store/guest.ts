import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { itemKey } from '@/lib/format';
import type { HistoryEntry, LibraryItem, MediaType } from '@/lib/types';

/**
 * The library of someone using Zenith without an account. Lives on the device
 * and is merged into their account (POST /library/sync-local) when they sign in.
 */
interface GuestState {
  items: Record<string, LibraryItem>;
  /** Watch log, newest last — powers guest stats and moves to the account on sign-in. */
  history: HistoryEntry[];
  includeSpecials: boolean;
  upsert: (item: LibraryItem) => void;
  patch: (mediaType: MediaType, tmdbId: number, patch: Partial<LibraryItem>) => void;
  remove: (mediaType: MediaType, tmdbId: number) => void;
  /** Positive: log watched episodes. Negative: take back the most recent ones. */
  logWatch: (item: LibraryItem, episodes: number) => void;
  clear: () => void;
  setIncludeSpecials: (v: boolean) => void;
}

export const useGuest = create<GuestState>()(
  persist(
    (set) => ({
      items: {},
      history: [],
      includeSpecials: false,
      upsert: (item) =>
        set((s) => ({ items: { ...s.items, [itemKey(item.mediaType, item.tmdbId)]: item } })),
      patch: (mediaType, tmdbId, patch) =>
        set((s) => {
          const key = itemKey(mediaType, tmdbId);
          const current = s.items[key];
          return current ? { items: { ...s.items, [key]: { ...current, ...patch } } } : s;
        }),
      remove: (mediaType, tmdbId) =>
        set((s) => {
          const { [itemKey(mediaType, tmdbId)]: _removed, ...rest } = s.items;
          return {
            items: rest,
            history: s.history.filter((h) => !(h.tmdbId === tmdbId && h.mediaType === mediaType)),
          };
        }),
      logWatch: (item, episodes) =>
        set((s) => {
          if (episodes === 0) return s;
          const perEpisode = item.runtime ?? 0;
          if (episodes > 0) {
            const entry: HistoryEntry = {
              tmdbId: item.tmdbId,
              mediaType: item.mediaType,
              episodes,
              minutes: episodes * perEpisode,
              watchedAt: new Date().toISOString(),
            };
            return { history: [...s.history, entry] };
          }
          // Undo: peel episodes off this title's newest entries.
          let remaining = -episodes;
          const history = [...s.history];
          for (let i = history.length - 1; i >= 0 && remaining > 0; i--) {
            const h = history[i];
            if (h.tmdbId !== item.tmdbId || h.mediaType !== item.mediaType) continue;
            const take = Math.min(remaining, h.episodes);
            remaining -= take;
            if (take === h.episodes) history.splice(i, 1);
            else history[i] = { ...h, episodes: h.episodes - take, minutes: (h.episodes - take) * perEpisode };
          }
          return { history };
        }),
      clear: () => set({ items: {}, history: [] }),
      setIncludeSpecials: (includeSpecials) => set({ includeSpecials }),
    }),
    { name: 'zenith-guest-library', storage: createJSONStorage(() => AsyncStorage) }
  )
);

export const guestList = () =>
  Object.values(useGuest.getState().items).sort(
    (a, b) => (b.lastWatchedAt ?? b.createdAt ?? '').localeCompare(a.lastWatchedAt ?? a.createdAt ?? '')
  );
