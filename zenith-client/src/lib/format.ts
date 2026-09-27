import type { MediaType, Status } from './types';

const IMG = 'https://image.tmdb.org/t/p';
export const poster = (path?: string | null, size: 'w185' | 'w342' | 'w500' = 'w342') =>
  path ? `${IMG}/${size}${path}` : null;
export const backdrop = (path?: string | null, size: 'w780' | 'w1280' = 'w780') =>
  path ? `${IMG}/${size}${path}` : null;
export const still = (path?: string | null) => (path ? `${IMG}/w300${path}` : null);
export const profile = (path?: string | null) => (path ? `${IMG}/w185${path}` : null);

export const itemKey = (mediaType: MediaType, tmdbId: number) => `${mediaType}:${tmdbId}`;

export const episodeCode = (season: number, episode: number) =>
  `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;

export const STATUS_LABEL: Record<Status, string> = {
  watching: 'Watching',
  waiting: 'Up to date',
  plan_to_watch: 'Plan to watch',
  paused: 'Paused',
  completed: 'Completed',
  dropped: 'Dropped',
};

export function formatMinutes(minutes: number) {
  if (!minutes) return '0h';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** TMDB air dates are plain YYYY-MM-DD — parse as local dates, not UTC. */
export function parseDay(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function daysUntil(date: string) {
  const diff = parseDay(date).getTime() - startOfDay(new Date()).getTime();
  return Math.round(diff / 86400000);
}

export function relativeDay(date: string) {
  const n = daysUntil(date);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return parseDay(date).toLocaleDateString(undefined, { weekday: 'long' });
  return parseDay(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
