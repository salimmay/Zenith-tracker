export type MediaType = 'tv' | 'movie';
export type Status = 'watching' | 'waiting' | 'plan_to_watch' | 'paused' | 'completed' | 'dropped';

export interface Position {
  season: number;
  episode: number;
  totalEpisodesWatched?: number;
}

/** A title in the user's library — same shape for server docs and guest items. */
export interface LibraryItem {
  _id?: string;
  tmdbId: number;
  mediaType: MediaType;
  showName: string;
  posterPath: string | null;
  backdropPath?: string | null;
  isAnime?: boolean;
  runtime?: number;
  genres?: string[];
  year?: number | null;
  totalEpisodes?: number;
  tmdbStatus?: string | null;
  status: Status;
  progress: Position;
  isWatched?: boolean;
  rating?: number | null;
  lastWatchedAt?: string | null;
  createdAt?: string;
}

export interface NextEpisode {
  season: number;
  episode: number;
  name?: string;
  overview?: string;
  stillPath?: string | null;
  airDate?: string | null;
  runtime?: number | null;
  aired: boolean;
}

export interface UpNextEntry {
  show: LibraryItem;
  status: Status;
  progress: Position;
  next: NextEpisode | null;
  nextToAir: { season: number; episode: number; name?: string; airDate?: string } | null;
  remaining: number;
  totalEpisodes: number;
  seasonEpisodeCount: number;
}

export interface UpNext {
  watching: UpNextEntry[];
  waiting: UpNextEntry[];
}

export interface CatalogItem {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  year: number | null;
  rating: number | null;
  isAnime?: boolean;
}

export interface CatalogPage {
  page: number;
  totalPages: number;
  results: CatalogItem[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

interface DetailsBase extends CatalogItem {
  genres: string[];
  tagline?: string;
  status?: string;
  runtime: number | null;
  cast: CastMember[];
  trailerKey: string | null;
  recommendations: CatalogItem[];
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterPath: string | null;
}

export interface TvDetails extends DetailsBase {
  networks: string[];
  numberOfSeasons: number;
  numberOfEpisodes: number;
  seasons: SeasonSummary[];
  lastAired: { season: number; episode: number } | null;
  nextToAir: { season: number; episode: number; name?: string; airDate?: string } | null;
}

export interface MovieDetails extends DetailsBase {
  releaseDate?: string;
}

export interface Episode {
  episodeNumber: number;
  name: string;
  overview: string;
  airDate: string | null;
  runtime: number | null;
  stillPath: string | null;
  rating: number | null;
}

export interface SeasonDetails {
  seasonNumber: number;
  name: string;
  overview: string;
  episodes: Episode[];
}

export interface CalendarEpisode {
  tmdbId: number;
  showName: string;
  posterPath: string | null;
  season: number;
  episode: number;
  name: string;
  airDate: string;
  stillPath: string | null;
  isPremiere: boolean;
  isFinale: boolean;
}

export interface Stats {
  titles: number;
  shows: number;
  anime: number;
  movies: number;
  moviesWatched: number;
  episodes: number;
  minutes: number;
  statuses: Partial<Record<Status, number>>;
  genres: { name: string; count: number }[];
  topShows: { tmdbId: number; showName: string; posterPath: string | null; minutes: number }[];
  /** From the watch history: time watched in the selected range. */
  range: StatsRange;
  period: { minutes: number; episodes: number; movies: number };
  /** Minutes per month (YYYY-MM), last 12 months; months with nothing are omitted. */
  monthly: { month: string; minutes: number }[];
}

export type StatsRange = 'month' | 'year' | 'all';
export type StatsType = 'all' | 'tv' | 'movie';

/** One watch in the device log (guest mode). Batch rows carry episodes > 1. */
export interface HistoryEntry {
  tmdbId: number;
  mediaType: MediaType;
  episodes: number;
  minutes: number;
  watchedAt: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt?: string;
  settings: { includeSpecials: boolean };
  trakt: { connected: boolean; username: string | null; lastSyncedAt: string | null };
  /** Hook for a future "remove ads" purchase. */
  adFree?: boolean;
}

export type ProgressAction =
  | { type: 'watch' }
  | { type: 'unwatch' }
  | { type: 'set'; season: number; episode: number }
  | { type: 'complete_season'; season: number };
