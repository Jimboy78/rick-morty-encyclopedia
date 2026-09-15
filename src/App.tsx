import { useCallback, useEffect, useState } from "react";
import Starfield from "./components/Starfield";
import PortalLogo from "./components/PortalLogo";
import Characters from "./components/Characters";
import CharacterCard from "./components/CharacterCard";
import CharacterModal from "./components/CharacterModal";
import PortalGun from "./components/PortalGun";
import WhoGame from "./components/WhoGame";
import Episodes from "./components/Episodes";
import Locations from "./components/Locations";
import { useFavorites } from "./hooks/useFavorites";
import type { Character } from "./services/api";

const TABS = [
  { id: "characters", label: "Characters", icon: "🧬" },
  { id: "portal", label: "Portal Gun", icon: "🌀" },
  { id: "game", label: "Who's That?", icon: "🎯" },
  { id: "episodes", label: "Episodes", icon: "📺" },
  { id: "locations", label: "Locations", icon: "🪐" },
  { id: "collection", label: "Collection", icon: "★" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const DIMENSIONS = [
  { id: "c137", label: "C-137" },
  { id: "cronenberg", label: "Cronenberg" },
  { id: "froopy", label: "Froopyland" },
] as const;

const readHash = (): Tab => {
  const h = window.location.hash.slice(1);
  return TABS.find((t) => t.id === h)?.id ?? "characters";
};

export default function App() {
  const [tab, setTab] = useState<Tab>(readHash);
  const [dimension, setDimension] = useState(() => {
    try {
      return localStorage.getItem("dimension") ?? "c137";
    } catch {
      return "c137";
    }
  });
  const [selected, setSelected] = useState<Character | null>(null);
  const favorites = useFavorites();

  useEffect(() => {
    const onHash = () => setTab(readHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.dimension = dimension;
    try {
      localStorage.setItem("dimension", dimension);
    } catch {
      /* ignore */
    }
  }, [dimension]);

  const go = (t: Tab) => {
    window.location.hash = t;
    setTab(t);
  };
  const close = useCallback(() => setSelected(null), []);

  return (
    <>
      <Starfield />
      <div className="app">
        <header className="hero">
          <div className="brand">
            <PortalLogo size={72} />
            <div>
              <h1 className="title">
                Rick <span>&</span> Morty
              </h1>
              <p className="tagline">Multiverse Encyclopedia · live from the Citadel archives</p>
            </div>
          </div>
          <div className="dimensions" role="radiogroup" aria-label="Dimension theme">
            {DIMENSIONS.map((d) => (
              <button
                key={d.id}
                role="radio"
                aria-checked={dimension === d.id}
                className={`dim dim--${d.id} ${dimension === d.id ? "on" : ""}`}
                onClick={() => setDimension(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </header>

        <nav className="tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => go(t.id)}>
              <span aria-hidden="true">{t.icon}</span> {t.label}
              {t.id === "collection" && favorites.favorites.length > 0 && <em className="badge">{favorites.favorites.length}</em>}
            </button>
          ))}
        </nav>

        <main key={tab} className="view">
          {tab === "characters" && <Characters favorites={favorites} onOpen={setSelected} />}
          {tab === "portal" && <PortalGun favorites={favorites} onOpen={setSelected} />}
          {tab === "game" && <WhoGame />}
          {tab === "episodes" && <Episodes />}
          {tab === "locations" && <Locations onOpen={setSelected} />}
          {tab === "collection" &&
            (favorites.favorites.length === 0 ? (
              <div className="empty">
                <span className="empty__emoji">🛸</span>
                <p>Your collection is empty. Star characters to keep them here.</p>
                <button className="btn" onClick={() => go("characters")}>Explore characters</button>
              </div>
            ) : (
              <div className="grid">
                {favorites.favorites.map((c, i) => (
                  <CharacterCard key={c.id} character={c} index={i} favorite onToggleFavorite={favorites.toggle} onOpen={setSelected} />
                ))}
              </div>
            ))}
        </main>

        <footer className="footer">
          Data from <a href="https://rickandmortyapi.com" target="_blank" rel="noreferrer">The Rick and Morty API</a> · Built with React + TypeScript · Wubba lubba dub dub
        </footer>
      </div>

      {selected && (
        <CharacterModal
          character={selected}
          favorite={favorites.isFavorite(selected.id)}
          onToggleFavorite={favorites.toggle}
          onClose={close}
        />
      )}
    </>
  );
}
