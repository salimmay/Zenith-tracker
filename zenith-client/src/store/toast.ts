import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
  tone: 'neutral' | 'success' | 'error';
  action?: { label: string; onPress: () => void };
}

interface ToastState {
  toast: Toast | null;
  show: (t: Omit<Toast, 'id'>, durationMs?: number) => void;
  dismiss: (id?: number) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let nextId = 1;

// One toast at a time: a new one replaces the old, which suits the
// "Marked S2E4 · Undo" pattern where only the latest action is undoable.
export const useToast = create<ToastState>()((set, get) => ({
  toast: null,
  show: (t, durationMs = t.action ? 4500 : 2800) => {
    clearTimeout(timer);
    const id = nextId++;
    set({ toast: { ...t, id } });
    timer = setTimeout(() => get().dismiss(id), durationMs);
  },
  dismiss: (id) => {
    if (id === undefined || get().toast?.id === id) set({ toast: null });
  },
}));

export const toast = {
  show: (message: string, action?: Toast['action']) => useToast.getState().show({ message, tone: 'neutral', action }),
  success: (message: string, action?: Toast['action']) =>
    useToast.getState().show({ message, tone: 'success', action }),
  error: (message: string) => useToast.getState().show({ message, tone: 'error' }),
};
