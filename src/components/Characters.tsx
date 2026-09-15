import { useEffect, useRef, useState } from "react";
import { fetchCharacters, type Character, type CharacterFilters } from "../services/api";
import type { Favorites } from "../hooks/useFavorites";
import CharacterCard from "./CharacterCard";

interface Props {
  favorites: Favorites;
  onOpen: (c: Character) => void;
}

const STATUSES = ["", "Alive", "Dead", "unknown"];
const GENDERS = ["", "Female", "Male", "Genderless", "unknown"];
const SPECIES = ["", "Human", "Alien", "Humanoid", "Robot", "Animal", "Mythological Creature", "Cronenberg", "Disease", "Poopybutthole"];

export default function Characters({ favorites, onOpen }: Props) {
  const [filters, setFilters] = useState<CharacterFilters>({});
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Character[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);

  // Debounce the name search into the filters.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.name === search.trim() ? f : { ...f, name: search.trim() }));
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    fetchCharacters(page, filters, ctrl.signal)
      .then((res) => {
        setItems((prev) => (page === 1 ? res.results : [...prev, ...res.results]));
        setPages(res.info.pages);
        setCount(res.info.count);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError("The portal collapsed. Try again.");
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [page, filters, retry]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && !error && page < pages) setPage((p) => p + 1);
      },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loading, error, page, pages]);

  const setFilter = (key: keyof CharacterFilters) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((f) => ({ ...f, [key]: e.target.value }));
    setPage(1);
  };

  return (
    <section>
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search across the multiverse… (e.g. Pickle Rick)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={filters.status ?? ""} onChange={setFilter("status")} aria-label="Status">
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s ? `Status: ${s}` : "Any status"}</option>
          ))}
        </select>
        <select value={filters.species ?? ""} onChange={setFilter("species")} aria-label="Species">
          {SPECIES.map((s) => (
            <option key={s} value={s}>{s || "Any species"}</option>
          ))}
        </select>
        <select value={filters.gender ?? ""} onChange={setFilter("gender")} aria-label="Gender">
          {GENDERS.map((s) => (
            <option key={s} value={s}>{s || "Any gender"}</option>
          ))}
        </select>
      </div>

      {count !== null && (
        <p className="result-count">
          <b>{count.toLocaleString()}</b> beings detected in this slice of the multiverse
        </p>
      )}

      <div className="grid">
        {items.map((c, i) => (
          <CharacterCard
            key={c.id}
            character={c}
            index={i}
            favorite={favorites.isFavorite(c.id)}
            onToggleFavorite={favorites.toggle}
            onOpen={onOpen}
          />
        ))}
      </div>

      {!loading && count === 0 && (
        <div className="empty">
          <span className="empty__emoji">🥒</span>
          <p>No one here. Not even Pickle Rick.</p>
        </div>
      )}
      {error && (
        <div className="empty">
          <p>{error}</p>
          <button className="btn" onClick={() => setRetry((r) => r + 1)}>Reopen portal</button>
        </div>
      )}
      {loading && <div className="loader" />}
      <div ref={sentinel} />
    </section>
  );
}
