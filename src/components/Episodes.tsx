import { useEffect, useMemo, useState } from "react";
import { fetchAllEpisodes, type Episode } from "../services/api";

export default function Episodes() {
  const [episodes, setEpisodes] = useState<Episode[] | null>(null);
  const [season, setSeason] = useState("S01");
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchAllEpisodes().then(setEpisodes).catch(() => setError(true));
  }, []);

  const seasons = useMemo(() => {
    const map = new Map<string, Episode[]>();
    episodes?.forEach((e) => {
      const s = e.episode.slice(0, 3);
      map.set(s, [...(map.get(s) ?? []), e]);
    });
    return map;
  }, [episodes]);

  if (error) return <p className="empty">The TV signal from Interdimensional Cable is down.</p>;
  if (!episodes) return <div className="loader" />;

  const list = seasons.get(season) ?? [];
  const maxCast = Math.max(...episodes.map((e) => e.characters.length));

  return (
    <section>
      <div className="tabs tabs--pill" role="tablist">
        {[...seasons.keys()].map((s) => (
          <button key={s} role="tab" aria-selected={s === season} className={s === season ? "on" : ""} onClick={() => setSeason(s)}>
            Season {Number(s.slice(1))}
          </button>
        ))}
      </div>

      <ol className="timeline">
        {list.map((e, i) => (
          <li key={e.id} style={{ animationDelay: `${i * 50}ms` }}>
            <span className="timeline__code">{e.episode.slice(3)}</span>
            <div className="timeline__body">
              <h3>{e.name}</h3>
              <p className="muted">Aired {e.air_date}</p>
              <div className="bar" title={`${e.characters.length} characters`}>
                <span style={{ width: `${(e.characters.length / maxCast) * 100}%` }} />
              </div>
              <p className="muted small">{e.characters.length} characters on screen</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
