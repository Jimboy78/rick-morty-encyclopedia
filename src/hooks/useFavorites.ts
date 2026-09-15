import { useCallback, useEffect, useState } from "react";
import type { Character } from "../services/api";

const KEY = "citadel-collection";

function load(): Character[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Character[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(favorites));
    } catch {
      /* storage unavailable — keep in memory */
    }
  }, [favorites]);

  const isFavorite = useCallback((id: number) => favorites.some((f) => f.id === id), [favorites]);

  const toggle = useCallback((c: Character) => {
    setFavorites((prev) => (prev.some((f) => f.id === c.id) ? prev.filter((f) => f.id !== c.id) : [c, ...prev]));
  }, []);

  return { favorites, isFavorite, toggle };
}

export type Favorites = ReturnType<typeof useFavorites>;
