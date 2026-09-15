import { useEffect, useState } from "react";
import { fetchCharacter, fetchCharacterCount, type Character } from "../services/api";
import type { Favorites } from "../hooks/useFavorites";

interface Props {
  favorites: Favorites;
  onOpen: (c: Character) => void;
}

type Phase = "idle" | "opening" | "open";

export default function PortalGun({ favorites, onOpen }: Props) {
  const [total, setTotal] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [character, setCharacter] = useState<Character | null>(null);
  const [error, setError] = useState(false);
  const [shots, setShots] = useState(0);

  useEffect(() => {
    fetchCharacterCount().then(setTotal).catch(() => setError(true));
  }, []);

  const fire = async () => {
    if (!total || phase === "opening") return;
    setPhase("opening");
    setError(false);
    const id = 1 + Math.floor(Math.random() * total);
    try {
      // Let the portal spin up before the character steps through.
      const [c] = await Promise.all([fetchCharacter(id), new Promise((r) => setTimeout(r, 1100))]);
      setCharacter(c);
      setShots((s) => s + 1);
      setPhase("open");
    } catch {
      setError(true);
      setPhase("idle");
    }
  };

  return (
    <section className="gun">
      <div className="gun__intro">
        <h2 className="display">Portal Gun</h2>
        <p>
          Fire a portal into a random dimension and see who steps out. {total ? `${total.toLocaleString()} possible beings.` : ""}
        </p>
        <button className="btn btn--big" onClick={fire} disabled={!total || phase === "opening"}>
          {phase === "opening" ? "Charging…" : "🔫 Fire portal"}
        </button>
        {shots > 0 && <p className="muted">Portals opened this session: {shots}</p>}
        {error && <p className="muted">Portal fluid depleted. Try again.</p>}
      </div>

      <div className={`vortex vortex--${phase}`} key={shots}>
        <div className="vortex__ring" />
        <div className="vortex__ring vortex__ring--2" />
        <div className="vortex__ring vortex__ring--3" />
        {phase === "open" && character && (
          <button className="vortex__char" onClick={() => onOpen(character)}>
            <img src={character.image} alt={character.name} />
            <span>{character.name}</span>
          </button>
        )}
        {phase === "idle" && <span className="vortex__hint">?</span>}
      </div>

      {phase === "open" && character && (
        <div className="gun__meta">
          <p>
            <b>{character.species}</b> from <b>{character.origin.name}</b> — currently {character.status.toLowerCase()}.
          </p>
          <div className="row">
            <button className="btn btn--ghost" onClick={() => onOpen(character)}>Open dossier</button>
            <button className="btn btn--ghost" onClick={() => favorites.toggle(character)}>
              {favorites.isFavorite(character.id) ? "★ Collected" : "☆ Collect"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
