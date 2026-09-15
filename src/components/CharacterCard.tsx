import { useRef } from "react";
import type { Character } from "../services/api";

interface Props {
  character: Character;
  index?: number;
  favorite: boolean;
  onToggleFavorite: (c: Character) => void;
  onOpen: (c: Character) => void;
}

export default function CharacterCard({ character: c, index = 0, favorite, onToggleFavorite, onOpen }: Props) {
  const ref = useRef<HTMLElement>(null);

  // Holographic tilt that follows the pointer.
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${(0.5 - y) * 16}deg`);
    el.style.setProperty("--ry", `${(x - 0.5) * 16}deg`);
    el.style.setProperty("--mx", `${x * 100}%`);
    el.style.setProperty("--my", `${y * 100}%`);
  };
  const onLeave = () => {
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  };

  return (
    <article
      ref={ref}
      className="card"
      style={{ animationDelay: `${Math.min(index % 20, 19) * 35}ms` }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      <button className="card__hit" onClick={() => onOpen(c)} aria-label={`Open dossier for ${c.name}`} />
      <div className="card__img">
        <img src={c.image} alt="" loading="lazy" />
        <span className={`status status--${c.status.toLowerCase()}`}>
          <i />
          {c.status}
        </span>
      </div>
      <div className="card__body">
        <h3>{c.name}</h3>
        <p>
          {c.species}
          {c.type ? ` · ${c.type}` : ""}
        </p>
        <p className="card__loc" title="Last known location">
          📍 {c.location.name}
        </p>
      </div>
      <button
        className={`fav ${favorite ? "fav--on" : ""}`}
        onClick={() => onToggleFavorite(c)}
        aria-pressed={favorite}
        aria-label={favorite ? "Remove from collection" : "Add to collection"}
      >
        {favorite ? "★" : "☆"}
      </button>
      <span className="card__shine" aria-hidden="true" />
    </article>
  );
}
