import { useEffect, useState } from "react";
import { fetchEpisodesByUrl, type Character, type Episode } from "../services/api";

interface Props {
  character: Character;
  favorite: boolean;
  onToggleFavorite: (c: Character) => void;
  onClose: () => void;
}

export default function CharacterModal({ character: c, favorite, onToggleFavorite, onClose }: Props) {
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setEpisodes(null);
    setError(false);
    fetchEpisodesByUrl(c.episode)
      .then((eps) => alive && setEpisodes(eps))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [c]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const seasons = new Set(episodes?.map((e) => e.episode.slice(0, 3)));

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={`${c.name} dossier`} onClick={onClose}>
      <div className="modal__panel" onClick={(e) => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="dossier">
          <div className="dossier__photo">
            <img src={c.image} alt={c.name} />
            <span className="stamp">{c.status === "Dead" ? "DECEASED" : c.status === "Alive" ? "ACTIVE" : "UNKNOWN"}</span>
          </div>
          <div className="dossier__info">
            <p className="eyebrow">Citadel of Ricks · File #{String(c.id).padStart(4, "0")}</p>
            <h2>{c.name}</h2>
            <dl className="facts">
              <div>
                <dt>Species</dt>
                <dd>{c.species}{c.type ? ` (${c.type})` : ""}</dd>
              </div>
              <div>
                <dt>Gender</dt>
                <dd>{c.gender}</dd>
              </div>
              <div>
                <dt>Origin</dt>
                <dd>{c.origin.name}</dd>
              </div>
              <div>
                <dt>Last seen</dt>
                <dd>{c.location.name}</dd>
              </div>
              <div>
                <dt>Appearances</dt>
                <dd>{c.episode.length} episodes{episodes ? ` · ${seasons.size} season${seasons.size === 1 ? "" : "s"}` : ""}</dd>
              </div>
              <div>
                <dt>Indexed</dt>
                <dd>{new Date(c.created).toLocaleDateString()}</dd>
              </div>
            </dl>
            <button className={`btn ${favorite ? "btn--ghost" : ""}`} onClick={() => onToggleFavorite(c)}>
              {favorite ? "★ In your collection" : "☆ Add to collection"}
            </button>
          </div>
        </div>

        <h3 className="modal__sub">Episode appearances</h3>
        {error && <p className="muted">Interdimensional interference — couldn't load episodes.</p>}
        {!episodes && !error && <div className="loader loader--sm" />}
        {episodes && (
          <ul className="ep-chips">
            {episodes.map((e) => (
              <li key={e.id} title={`${e.name} · ${e.air_date}`}>
                <b>{e.episode}</b> {e.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
