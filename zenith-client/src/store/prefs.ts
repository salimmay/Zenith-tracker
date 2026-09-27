import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type UpNextSort = 'recent' | 'newest' | 'oldest' | 'title' | 'total' | 'left';
export type UpNextKind = 'tv' | 'movie';

export const UP_NEXT_SORTS: { value: UpNextSort; label: string }[] = [
  { value: 'recent', label: 'Recently watched' },
  { value: 'newest', label: 'Newest episode' },
  { value: 'oldest', label: 'Oldest episode' },
  { value: 'title', label: 'Alphabetical' },
  { value: 'total', label: 'Total episodes' },
  { value: 'left', label: 'Episodes left to watch' },
];

/** Small per-device UI choices that should survive a relaunch. */
interface PrefsState {
  upNextSort: UpNextSort;
  upNextKind: UpNextKind;
  /** First launch on this device (ms). Ads wait out a grace period after it. */
  installedAt: number | null;
  setUpNextSort: (v: UpNextSort) => void;
  setUpNextKind: (v: UpNextKind) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      upNextSort: 'recent',
      upNextKind: 'tv',
      installedAt: null,
      setUpNextSort: (upNextSort) => set({ upNextSort }),
      setUpNextKind: (upNextKind) => set({ upNextKind }),
    }),
    {
      name: 'zenith-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (!state?.installedAt) usePrefs.setState({ installedAt: Date.now() });
      },
    }
  )
);
