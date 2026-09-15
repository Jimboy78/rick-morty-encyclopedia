const BASE = "https://rickandmortyapi.com/api";

export type Status = "Alive" | "Dead" | "unknown";

export interface Character {
  id: number;
  name: string;
  status: Status;
  species: string;
  type: string;
  gender: string;
  origin: { name: string; url: string };
  location: { name: string; url: string };
  image: string;
  episode: string[];
  created: string;
}

export interface Episode {
  id: number;
  name: string;
  air_date: string;
  episode: string;
  characters: string[];
}

export interface Location {
  id: number;
  name: string;
  type: string;
  dimension: string;
  residents: string[];
}

export interface Page<T> {
  info: { count: number; pages: number; next: string | null; prev: string | null };
  results: T[];
}

export interface CharacterFilters {
  name?: string;
  status?: string;
  species?: string;
  gender?: string;
}

const emptyPage = <T>(): Page<T> => ({
  info: { count: 0, pages: 0, next: null, prev: null },
  results: [],
});

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { signal });
  if (res.status === 404) throw new NotFoundError();
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json() as Promise<T>;
}

class NotFoundError extends Error {}

const query = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");

export async function fetchCharacters(
  page: number,
  filters: CharacterFilters,
  signal?: AbortSignal
): Promise<Page<Character>> {
  try {
    return await get<Page<Character>>(`/character?${query({ page, ...filters })}`, signal);
  } catch (e) {
    // The API answers 404 when a filter combination has no matches.
    if (e instanceof NotFoundError) return emptyPage<Character>();
    throw e;
  }
}

export const fetchCharacter = (id: number, signal?: AbortSignal) =>
  get<Character>(`/character/${id}`, signal);

export async function fetchCharacterCount(): Promise<number> {
  const page = await get<Page<Character>>("/character");
  return page.info.count;
}

const idFromUrl = (url: string) => Number(url.split("/").pop());

async function fetchMany<T>(resource: string, urls: string[]): Promise<T[]> {
  const ids = urls.map(idFromUrl).filter(Boolean);
  if (ids.length === 0) return [];
  const data = await get<T | T[]>(`/${resource}/${ids.join(",")}`);
  return Array.isArray(data) ? data : [data];
}

export const fetchEpisodesByUrl = (urls: string[]) => fetchMany<Episode>("episode", urls);
export const fetchCharactersByUrl = (urls: string[]) => fetchMany<Character>("character", urls);

export async function fetchAllEpisodes(): Promise<Episode[]> {
  const first = await get<Page<Episode>>("/episode");
  const rest = await Promise.all(
    Array.from({ length: first.info.pages - 1 }, (_, i) => get<Page<Episode>>(`/episode?page=${i + 2}`))
  );
  return [first, ...rest].flatMap((p) => p.results);
}

export async function fetchLocations(page: number, name: string): Promise<Page<Location>> {
  try {
    return await get<Page<Location>>(`/location?${query({ page, name })}`);
  } catch (e) {
    if (e instanceof NotFoundError) return emptyPage<Location>();
    throw e;
  }
}
