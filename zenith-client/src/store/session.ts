import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { User } from '@/lib/types';

interface SessionState {
  token: string | null;
  user: User | null;
  hydrated: boolean;
  signIn: (token: string, user: User) => void;
  setUser: (user: User) => void;
  signOut: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hydrated: false,
      signIn: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      signOut: () => set({ token: null, user: null }),
    }),
    {
      name: 'zenith-session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ token, user }) => ({ token, user }),
      onRehydrateStorage: () => () => useSession.setState({ hydrated: true }),
    }
  )
);

/** Query-key scope: separates guest data from each account's data in the cache. */
export const useScope = () => useSession((s) => s.user?.id ?? 'guest');
