import { useEffect, useState } from "react";
import { fetchCharactersByUrl, fetchLocations, type Character, type Location } from "../services/api";

interface Props {
  onOpen: (c: Character) => void;
}

function Residents({ urls, onOpen }: { urls: string[]; onOpen: (c: Character) => void }) {
  const [residents, setResidents] = useState<Character[] | null>(null);
  useEffect(() => {
    fetchCharactersByUrl(urls.slice(0, 8)).then(setResidents).catch(() => setResidents([]));
  }, [urls]);
  if (!residents) return <div className="loader loader--sm" />;
  return (
    <div className="avatars">
      {residents.map((r) => (
        <button key={r.id} onClick={() => onOpen(r)} title={r.name}>
          <img src={r.image} alt={r.name} loading="lazy" />
        </button>
      ))}
      {urls.length > 8 && <span className="avatars__more">+{urls.length - 8}</span>}
    </div>
  );
}

export default function Locations({ onOpen }: Props) {
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [data, setData] = useState<{ pages: number; count: number; results: Location[] } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setError(false);
      fetchLocations(page, name.trim())
        .then((res) => setData({ pages: res.info.pages, count: res.info.count, results: res.results }))
        .catch(() => setError(true));
    }, 250);
    return () => clearTimeout(t);
  }, [page, name]);

  return (
    <section>
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search planets, citadels, microverses…"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setPage(1);
          }}
        />
      </div>
      {error && <p className="empty">Galactic Federation blocked this request.</p>}
      {!data && !error && <div className="loader" />}
      {data && (
        <>
          <p className="result-count"><b>{data.count}</b> known locations</p>
          <div className="locations">
            {data.results.map((l) => (
              <article key={l.id} className={`loc ${open === l.id ? "loc--open" : ""}`}>
                <button className="loc__head" onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}>
                  <span className="loc__planet" style={{ ["--hue" as string]: (l.id * 47) % 360 }} />
                  <span>
                    <h3>{l.name}</h3>
                    <p className="muted">{l.type || "Unknown type"} · {l.dimension || "Unknown dimension"}</p>
                  </span>
                  <span className="loc__count">{l.residents.length} 👤</span>
                </button>
                {open === l.id && l.residents.length > 0 && <Residents urls={l.residents} onOpen={onOpen} />}
                {open === l.id && l.residents.length === 0 && <p className="muted small">No known residents.</p>}
              </article>
            ))}
          </div>
          <div className="pager">
            <button className="btn btn--ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span>{page} / {data.pages || 1}</span>
            <button className="btn btn--ghost" disabled={page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </>
      )}
    </section>
  );
}
