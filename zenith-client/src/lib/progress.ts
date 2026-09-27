import type { LibraryItem, Position } from './types';

// Display-side progress helpers. The real rules live in the API's progress
// engine; these only read a stored position, which the server keeps canonical.

export function isAfter(a: Position, b: Position) {
  return a.season !== b.season ? a.season > b.season : a.episode > b.episode;
}

/** Episodes of `seasonNumber` covered by the entry's position. Specials never count. */
export function seasonWatchedCount(seasonNumber: number, episodeCount: number, entry: LibraryItem | null) {
  const pos = entry?.progress;
  if (!pos || seasonNumber === 0) return 0;
  if (pos.season > seasonNumber) return episodeCount;
  if (pos.season === seasonNumber) return Math.min(pos.episode, episodeCount);
  return 0;
}
