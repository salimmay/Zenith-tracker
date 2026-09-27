import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CatalogPage, MovieDetails, SeasonDetails, TvDetails } from '@/lib/types';

export type ListName =
  | 'trending'
  | 'trending-tv'
  | 'trending-movies'
  | 'popular-tv'
  | 'top-tv'
  | 'airing-today'
  | 'popular-movies'
  | 'now-playing'
  | 'anime';

const LONG = 30 * 60_000;

export function useCatalogList(list: ListName) {
  return useQuery({
    queryKey: ['catalog', list],
    staleTime: LONG,
    queryFn: ({ signal }) => api<CatalogPage>(`/catalog/lists/${list}`, { auth: false, signal }),
  });
}

export function useSearch(query: string, type: 'multi' | 'tv' | 'movie') {
  const q = query.trim();
  return useInfiniteQuery({
    queryKey: ['search', type, q],
    enabled: q.length > 0,
    initialPageParam: 1,
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam, signal }) =>
      api<CatalogPage>(`/catalog/search?type=${type}&page=${pageParam}&q=${encodeURIComponent(q)}`, {
        auth: false,
        signal,
      }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
  });
}

export function useTv(id: number) {
  return useQuery({
    queryKey: ['tv', id],
    staleTime: LONG,
    enabled: id > 0,
    queryFn: ({ signal }) => api<TvDetails>(`/catalog/tv/${id}`, { auth: false, signal }),
  });
}

export function useSeason(id: number, season: number, enabled = true) {
  return useQuery({
    queryKey: ['season', id, season],
    staleTime: LONG,
    enabled: enabled && id > 0,
    queryFn: ({ signal }) => api<SeasonDetails>(`/catalog/tv/${id}/season/${season}`, { auth: false, signal }),
  });
}

export function useMovie(id: number) {
  return useQuery({
    queryKey: ['movie', id],
    staleTime: LONG,
    enabled: id > 0,
    queryFn: ({ signal }) => api<MovieDetails>(`/catalog/movie/${id}`, { auth: false, signal }),
  });
}
