import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useSession } from '@/store/session';

/**
 * API base URL:
 *  1. EXPO_PUBLIC_API_URL when set (production / deployed API)
 *  2. in development, the machine running Metro — so Expo Go on a real phone
 *     reaches the local server without editing code
 */
function resolveBaseUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && Platform.OS !== 'web') return `http://${host}:5000`;
  return Platform.OS === 'android' ? 'http://10.0.2.2:5000' : 'http://localhost:5000';
}

export const API_URL = resolveBaseUrl();

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown; auth?: boolean; signal?: AbortSignal };

/** A request that hasn't answered by now is treated as failed, not left spinning. */
const TIMEOUT_MS = 15_000;

export async function api<T>(path: string, { method = 'GET', body, auth = true, signal }: Options = {}): Promise<T> {
  const token = auth ? useSession.getState().token : null;

  // Our own controller, so both the timeout and the caller's cancel (React Query) abort the fetch.
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener('abort', onCallerAbort);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (timedOut) throw new ApiError('Your connection is very slow right now. Try again in a moment.', 0, { timeout: true });
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError("Can't reach Zenith. Check your connection.", 0, { offline: true });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // An expired session signs the user out; their data is safe on the server.
    if (res.status === 401 && token && data.sessionExpired) useSession.getState().signOut();
    throw new ApiError(data.message || `Request failed (${res.status})`, res.status, data);
  }
  return data as T;
}
