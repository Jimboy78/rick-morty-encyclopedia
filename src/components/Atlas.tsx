import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildAtlas,
  planetPosition,
  rankFor,
  RANKS,
  type AtlasData,
  type Galaxy,
  type Planet,
} from "../atlas/layout";
import { fetchAllLocations, fetchCharactersByUrl, type Character } from "../services/api";
import "./atlas.css";

interface Props {
  onOpen: (c: Character) => void;
}

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

interface Flight {
  from: Camera;
  to: number;
  start: number;
  duration: number;
}

const VISITED_KEY = "atlas.visited";
const FLIGHT_MS = 1600;
const MIN_ZOOM = 0.08;
const MAX_ZOOM = 3;

const readVisited = (): number[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(VISITED_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

function makeStars(count: number) {
  let seed = 1337;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: count }, () => ({ x: rand(), y: rand(), r: rand() * 1.4 + 0.2, a: rand() * 0.6 + 0.2, depth: rand() * 0.25 + 0.05 }));
}
const STARS = makeStars(420);

function Residents({ planet, onOpen }: { planet: Planet; onOpen: (c: Character) => void }) {
  const [residents, setResidents] = useState<Character[] | null>(null);
  useEffect(() => {
    let alive = true;
    setResidents(null);
    fetchCharactersByUrl(planet.loc.residents.slice(0, 12))
      .then((list) => alive && setResidents(list))
      .catch(() => alive && setResidents([]));
    return () => {
      alive = false;
    };
  }, [planet]);
  if (planet.loc.residents.length === 0) return <p className="muted small">No known residents. Probably for a reason.</p>;
  if (!residents) return <div className="loader loader--sm" />;
  return (
    <div className="avatars" data-testid="atlas-residents">
      {residents.map((r) => (
        <button key={r.id} onClick={() => onOpen(r)} title={r.name}>
          <img src={r.image} alt={r.name} loading="lazy" />
        </button>
      ))}
      {planet.loc.residents.length > 12 && <span className="avatars__more">+{planet.loc.residents.length - 12}</span>}
    </div>
  );
}

export default function Atlas({ onOpen }: Props) {
  const [atlas, setAtlas] = useState<AtlasData | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Planet | null>(null);
  const [hover, setHover] = useState<{ planet: Planet; x: number; y: number } | null>(null);
  const [visited, setVisited] = useState<number[]>(readVisited);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [travelling, setTravelling] = useState(false);
  const [zoomLabel, setZoomLabel] = useState(1);

  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const minimap = useRef<HTMLCanvasElement>(null);
  const cam = useRef<Camera>({ x: 0, y: 0, zoom: 0.2 });
  const size = useRef({ w: 800, h: 600 });
  const flight = useRef<Flight | null>(null);
  const follow = useRef<number | null>(null);
  const clock = useRef(0);
  const state = useRef({ selected, hover, visited, hidden, atlas });
  state.current = { selected, hover, visited, hidden, atlas };

  useEffect(() => {
    fetchAllLocations()
      .then((locations) => setAtlas(buildAtlas(locations)))
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(VISITED_KEY, JSON.stringify(visited));
    } catch {
      /* ignore */
    }
  }, [visited]);

  const toScreen = useCallback((x: number, y: number) => {
    const { w, h } = size.current;
    const c = cam.current;
    return { x: (x - c.x) * c.zoom + w / 2, y: (y - c.y) * c.zoom + h / 2 };
  }, []);

  const toWorld = useCallback((sx: number, sy: number) => {
    const { w, h } = size.current;
    const c = cam.current;
    return { x: (sx - w / 2) / c.zoom + c.x, y: (sy - h / 2) / c.zoom + c.y };
  }, []);

  const fitAll = useCallback(() => {
    const a = state.current.atlas;
    if (!a) return;
    const { w, h } = size.current;
    const b = a.bounds;
    flight.current = null;
    follow.current = null;
    cam.current = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, zoom: clampZoom(Math.min(w / (b.maxX - b.minX), h / (b.maxY - b.minY)) * 0.95) };
  }, []);

  const fitGalaxy = useCallback((g: Galaxy) => {
    const { w, h } = size.current;
    flight.current = null;
    follow.current = null;
    cam.current = { x: g.x, y: g.y, zoom: clampZoom(Math.min(w, h) / (g.r * 2.3)) };
  }, []);

  const travelTo = useCallback((planet: Planet) => {
    flight.current = { from: { ...cam.current }, to: planet.id, start: performance.now(), duration: FLIGHT_MS };
    follow.current = planet.id;
    setTravelling(true);
    setHover(null);
  }, []);

  const randomPortal = useCallback(() => {
    const a = state.current.atlas;
    if (!a) return;
    const pool = a.planets.filter((p) => !state.current.visited.includes(p.id) && !state.current.hidden.has(p.kind));
    const list = pool.length ? pool : a.planets;
    travelTo(list[Math.floor(Math.random() * list.length)]);
  }, [travelTo]);

  // Resize the canvases to their box at device pixel ratio.
  useEffect(() => {
    const box = wrap.current;
    if (!box || !atlas) return;
    const observer = new ResizeObserver(() => {
      const rect = box.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size.current = { w: rect.width, h: rect.height };
      const c = canvas.current!;
      c.width = rect.width * dpr;
      c.height = rect.height * dpr;
      c.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    observer.observe(box);
    const rect = box.getBoundingClientRect();
    size.current = { w: rect.width, h: rect.height };
    fitAll();
    return () => observer.disconnect();
  }, [atlas, fitAll]);

  // Render loop.
  useEffect(() => {
    if (!atlas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let last = performance.now();
    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!reduced) clock.current += dt;
      const t = clock.current;
      const ctx = canvas.current?.getContext("2d");
      if (!ctx) return;
      const { w, h } = size.current;
      const { selected: sel, hover: hov, visited: seen, hidden: off } = state.current;
      const c = cam.current;

      // Camera: portal flight (zoom out, cross, zoom in) or follow the selected planet.
      const f = flight.current;
      if (f) {
        const planet = atlas.byId.get(f.to)!;
        const target = planetPosition(planet, t);
        const p = Math.min(1, (now - f.start) / f.duration);
        const e = ease(p);
        const endZoom = 1.35;
        const midZoom = Math.min(f.from.zoom, endZoom) * 0.35;
        c.x = lerp(f.from.x, target.x, e);
        c.y = lerp(f.from.y, target.y, e);
        c.zoom = p < 0.5 ? lerp(f.from.zoom, midZoom, ease(p * 2)) : lerp(midZoom, endZoom, ease((p - 0.5) * 2));
        if (p >= 1) {
          flight.current = null;
          setTravelling(false);
          setSelected(planet);
          setVisited((v) => (v[v.length - 1] === planet.id ? v : [...v.filter((id) => id !== planet.id), planet.id]));
        }
      } else if (follow.current !== null) {
        const target = planetPosition(atlas.byId.get(follow.current)!, t);
        c.x = lerp(c.x, target.x, 0.12);
        c.y = lerp(c.y, target.y, 0.12);
      }

      // Space.
      ctx.fillStyle = "#03060d";
      ctx.fillRect(0, 0, w, h);
      for (const s of STARS) {
        const sx = (((s.x * w - c.x * s.depth * c.zoom) % w) + w) % w;
        const sy = (((s.y * h - c.y * s.depth * c.zoom) % h) + h) % h;
        ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(t * 2 + s.x * 40));
        ctx.fillStyle = "#e8f3ea";
        ctx.fillRect(sx, sy, s.r, s.r);
      }
      ctx.globalAlpha = 1;

      // Galaxies: nebula glow, orbit rings, name.
      for (const g of atlas.galaxies) {
        const center = toScreen(g.x, g.y);
        const radius = g.r * c.zoom;
        if (center.x + radius < -50 || center.x - radius > w + 50 || center.y + radius < -50 || center.y - radius > h + 50) continue;
        const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius * 1.1);
        glow.addColorStop(0, `hsla(${g.hue}, 80%, 60%, 0.22)`);
        glow.addColorStop(0.5, `hsla(${g.hue}, 80%, 45%, 0.08)`);
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius * 1.1, 0, Math.PI * 2);
        ctx.fill();
        const rings = new Set(g.planets.map((p) => p.orbit));
        ctx.strokeStyle = `hsla(${g.hue}, 70%, 70%, 0.14)`;
        ctx.setLineDash([4, 6]);
        for (const orbit of rings) {
          ctx.beginPath();
          ctx.ellipse(center.x, center.y, orbit * c.zoom, orbit * c.zoom * 0.7, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.fillStyle = `hsla(${g.hue}, 90%, 80%, 0.9)`;
        ctx.beginPath();
        ctx.arc(center.x, center.y, Math.max(1.5, 5 * c.zoom), 0, Math.PI * 2);
        ctx.fill();
        if (radius > 45) {
          ctx.font = `${Math.min(26, Math.max(12, radius / 9))}px Bangers, Impact, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillStyle = `hsla(${g.hue}, 85%, 78%, ${Math.min(0.9, radius / 160)})`;
          ctx.fillText(g.name.toUpperCase(), center.x, center.y - radius * 0.78);
        }
      }

      // Travel log: portal trail through visited planets.
      if (seen.length > 1) {
        ctx.strokeStyle = "rgba(182, 255, 74, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([10, 8]);
        ctx.lineDashOffset = -t * 30;
        ctx.beginPath();
        seen.forEach((id, i) => {
          const planet = atlas.byId.get(id);
          if (!planet) return;
          const pos = planetPosition(planet, t);
          const s = toScreen(pos.x, pos.y);
          if (i === 0) ctx.moveTo(s.x, s.y);
          else ctx.lineTo(s.x, s.y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
      }

      // Planets.
      for (const planet of atlas.planets) {
        const pos = planetPosition(planet, t);
        const s = toScreen(pos.x, pos.y);
        const r = Math.max(1.6, planet.size * c.zoom);
        if (s.x < -r - 60 || s.x > w + r + 60 || s.y < -r - 60 || s.y > h + r + 60) continue;
        ctx.globalAlpha = off.has(planet.kind) ? 0.1 : 1;
        if (planet.kind === "Microverse") {
          ctx.shadowColor = planet.color;
          ctx.shadowBlur = 14;
        }
        const body = ctx.createRadialGradient(s.x - r * 0.35, s.y - r * 0.35, r * 0.1, s.x, s.y, r);
        body.addColorStop(0, "#ffffff");
        body.addColorStop(0.25, planet.color);
        body.addColorStop(1, "#0a0f18");
        ctx.fillStyle = body;
        ctx.beginPath();
        if (planet.kind === "Space station") ctx.rect(s.x - r * 0.8, s.y - r * 0.8, r * 1.6, r * 1.6);
        else ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (planet.loc.residents.length >= 20 && r > 5) {
          ctx.strokeStyle = `${planet.color}aa`;
          ctx.lineWidth = Math.max(1, r * 0.12);
          ctx.beginPath();
          ctx.ellipse(s.x, s.y, r * 1.7, r * 0.45, -0.35, 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
        if (seen.includes(planet.id) && r > 3) {
          ctx.fillStyle = "#b6ff4a";
          ctx.fillRect(s.x + r * 0.7, s.y - r - 6, 2, 8);
          ctx.fillRect(s.x + r * 0.7 + 2, s.y - r - 6, 6, 4);
        }
        if (sel?.id === planet.id || hov?.planet.id === planet.id) {
          ctx.strokeStyle = sel?.id === planet.id ? "#b6ff4a" : "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(s.x, s.y, r + 6 + (sel?.id === planet.id ? Math.sin(t * 5) * 2 : 0), 0, Math.PI * 2);
          ctx.stroke();
          ctx.lineWidth = 1;
        }
        if (c.zoom > 0.85 && !off.has(planet.kind)) {
          ctx.font = "12px 'Space Grotesk', sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(232, 243, 234, 0.85)";
          ctx.fillText(planet.loc.name, s.x, s.y + r + 15);
        }
        ctx.globalAlpha = 1;
      }

      // Minimap.
      const mm = minimap.current?.getContext("2d");
      if (mm && minimap.current) {
        const mw = minimap.current.width;
        const mh = minimap.current.height;
        const b = atlas.bounds;
        const scale = Math.min(mw / (b.maxX - b.minX), mh / (b.maxY - b.minY));
        const ox = (mw - (b.maxX - b.minX) * scale) / 2;
        const oy = (mh - (b.maxY - b.minY) * scale) / 2;
        const mx = (x: number) => ox + (x - b.minX) * scale;
        const my = (y: number) => oy + (y - b.minY) * scale;
        mm.clearRect(0, 0, mw, mh);
        for (const g of atlas.galaxies) {
          mm.fillStyle = `hsla(${g.hue}, 80%, 65%, 0.7)`;
          mm.beginPath();
          mm.arc(mx(g.x), my(g.y), Math.max(1.5, g.r * scale * 0.5), 0, Math.PI * 2);
          mm.fill();
        }
        mm.strokeStyle = "#b6ff4a";
        mm.strokeRect(mx(c.x - w / 2 / c.zoom), my(c.y - h / 2 / c.zoom), (w / c.zoom) * scale, (h / c.zoom) * scale);
      }
    };
    frame = requestAnimationFrame(render);
    const zoomTimer = setInterval(() => setZoomLabel(cam.current.zoom), 250);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(zoomTimer);
    };
  }, [atlas, toScreen]);

  // Test/automation hook: where a planet is on screen right now.
  useEffect(() => {
    if (!atlas) return;
    (window as unknown as { __atlas?: unknown }).__atlas = {
      screenOf: (id: number) => {
        const planet = atlas.byId.get(id);
        return planet ? toScreen(planetPosition(planet, clock.current).x, planetPosition(planet, clock.current).y) : null;
      },
      camera: () => ({ ...cam.current }),
    };
  }, [atlas, toScreen]);

  const pick = useCallback(
    (sx: number, sy: number) => {
      const a = state.current.atlas;
      if (!a) return null;
      let best: Planet | null = null;
      let bestDist = Infinity;
      for (const planet of a.planets) {
        if (state.current.hidden.has(planet.kind)) continue;
        const pos = planetPosition(planet, clock.current);
        const s = toScreen(pos.x, pos.y);
        const d = Math.hypot(s.x - sx, s.y - sy);
        const reach = Math.max(10, planet.size * cam.current.zoom + 6);
        if (d < reach && d < bestDist) {
          best = planet;
          bestDist = d;
        }
      }
      return best;
    },
    [toScreen]
  );

  // Pointer interaction: drag to pan, wheel/pinch to zoom, click to travel.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef({ moved: 0, pinch: 0 });

  const local = (e: { clientX: number; clientY: number }) => {
    const rect = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const zoomAt = (sx: number, sy: number, factor: number) => {
    const before = toWorld(sx, sy);
    cam.current.zoom = clampZoom(cam.current.zoom * factor);
    const after = toWorld(sx, sy);
    cam.current.x += before.x - after.x;
    cam.current.y += before.y - after.y;
    flight.current = null;
    follow.current = null;
  };

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = local(e);
      zoomAt(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!atlas || q.length < 2) return [];
    return atlas.planets.filter((p) => p.loc.name.toLowerCase().includes(q) || p.galaxy.name.toLowerCase().includes(q)).slice(0, 8);
  }, [atlas, query]);

  if (error) return <p className="empty">The Galactic Federation jammed the star charts. Try again later.</p>;
  if (!atlas) return <div className="loader" />;

  const ratio = visited.length / atlas.planets.length;
  const rank = rankFor(ratio);
  const nextRank = RANKS.find((r) => r.at > ratio);
  const neighbours = selected ? selected.galaxy.planets : [];

  return (
    <section className="atlas" data-testid="atlas">
      <div className="atlas__hud">
        <div className="atlas__rank" data-testid="atlas-rank">
          <span className="atlas__rank-title">{rank.title}</span>
          <span className="muted small">
            {visited.length}/{atlas.planets.length} locations visited
            {nextRank ? ` · next: ${nextRank.title} at ${Math.ceil(nextRank.at * atlas.planets.length)}` : ""}
          </span>
          <div className="atlas__progress">
            <span style={{ width: `${ratio * 100}%` }} />
          </div>
        </div>
        <div className="atlas__search">
          <input
            className="search"
            type="search"
            placeholder="Portal to… (Citadel, Earth, Microverse)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="atlas-search"
            aria-label="Search locations"
          />
          {results.length > 0 && (
            <ul className="atlas__results" role="listbox">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      travelTo(p);
                      setQuery("");
                    }}
                    data-testid="atlas-result"
                  >
                    <i style={{ background: p.color }} /> {p.loc.name} <span className="muted small">{p.galaxy.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="btn btn--big atlas__random" onClick={randomPortal} disabled={travelling} data-testid="atlas-random">
          🌀 Random portal
        </button>
      </div>

      <div className="atlas__stage">
        <div
          ref={wrap}
          className={`atlas__viewport ${travelling ? "atlas__viewport--travel" : ""}`}
        >
          <canvas
            ref={canvas}
            className="atlas__canvas"
            role="application"
            aria-label={`Galaxy map of ${atlas.planets.length} locations in ${atlas.galaxies.length} dimensions. Drag to pan, scroll to zoom, click a planet to travel.`}
            data-testid="atlas-canvas"
            data-planets={atlas.planets.length}
            data-galaxies={atlas.galaxies.length}
            data-selected={selected?.id ?? ""}
            tabIndex={0}
            onPointerDown={(e) => {
              canvas.current!.setPointerCapture(e.pointerId);
              pointers.current.set(e.pointerId, local(e));
              drag.current.moved = 0;
            }}
            onPointerMove={(e) => {
              const p = local(e);
              const prev = pointers.current.get(e.pointerId);
              if (prev) {
                if (pointers.current.size === 2) {
                  const [a, b] = [...pointers.current.values()];
                  const before = Math.hypot(a.x - b.x, a.y - b.y);
                  pointers.current.set(e.pointerId, p);
                  const [a2, b2] = [...pointers.current.values()];
                  const after = Math.hypot(a2.x - b2.x, a2.y - b2.y);
                  if (before > 0) zoomAt((a2.x + b2.x) / 2, (a2.y + b2.y) / 2, after / before);
                  drag.current.moved += 10;
                  return;
                }
                cam.current.x -= (p.x - prev.x) / cam.current.zoom;
                cam.current.y -= (p.y - prev.y) / cam.current.zoom;
                drag.current.moved += Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y);
                if (drag.current.moved > 4) {
                  flight.current = null;
                  follow.current = null;
                }
                pointers.current.set(e.pointerId, p);
                return;
              }
              const planet = pick(p.x, p.y);
              setHover(planet ? { planet, x: p.x, y: p.y } : null);
            }}
            onPointerUp={(e) => {
              const p = local(e);
              const wasClick = pointers.current.size === 1 && drag.current.moved < 5;
              pointers.current.delete(e.pointerId);
              if (!wasClick) return;
              const planet = pick(p.x, p.y);
              if (planet) travelTo(planet);
            }}
            onPointerLeave={() => setHover(null)}
            onDoubleClick={(e) => {
              const p = local(e);
              zoomAt(p.x, p.y, 1.8);
            }}
            onKeyDown={(e) => {
              const step = 80 / cam.current.zoom;
              const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
              if (moves[e.key]) {
                e.preventDefault();
                follow.current = null;
                cam.current.x += moves[e.key][0];
                cam.current.y += moves[e.key][1];
              } else if (e.key === "+" || e.key === "=") zoomAt(size.current.w / 2, size.current.h / 2, 1.25);
              else if (e.key === "-") zoomAt(size.current.w / 2, size.current.h / 2, 0.8);
            }}
          />
          {travelling && <div className="atlas__portal" aria-hidden="true" />}
          {hover && !travelling && (
            <div className="atlas__tooltip" style={{ left: hover.x, top: hover.y }}>
              <b>{hover.planet.loc.name}</b>
              <span>
                {hover.planet.kind} · {hover.planet.loc.residents.length} residents
              </span>
            </div>
          )}
          <div className="atlas__controls">
            <button onClick={() => zoomAt(size.current.w / 2, size.current.h / 2, 1.4)} aria-label="Zoom in">＋</button>
            <button onClick={() => zoomAt(size.current.w / 2, size.current.h / 2, 0.7)} aria-label="Zoom out">－</button>
            <button onClick={fitAll} aria-label="Show whole multiverse" data-testid="atlas-fit">⤢</button>
            <span className="muted small">{zoomLabel.toFixed(2)}×</span>
          </div>
          <canvas
            ref={minimap}
            className="atlas__minimap"
            width={160}
            height={120}
            aria-hidden="true"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const b = atlas.bounds;
              const scale = Math.min(160 / (b.maxX - b.minX), 120 / (b.maxY - b.minY));
              const ox = (160 - (b.maxX - b.minX) * scale) / 2;
              const oy = (120 - (b.maxY - b.minY) * scale) / 2;
              flight.current = null;
              follow.current = null;
              cam.current.x = (e.clientX - rect.left - ox) / scale + b.minX;
              cam.current.y = (e.clientY - rect.top - oy) / scale + b.minY;
            }}
          />
        </div>

        <aside className="atlas__panel" data-testid="atlas-panel">
          {selected ? (
            <>
              <div className="atlas__planet-art" style={{ ["--planet" as string]: selected.color }} />
              <p className="atlas__kicker">{selected.kind}</p>
              <h3 className="atlas__name" data-testid="atlas-selected-name">{selected.loc.name}</h3>
              <p className="muted">
                <button className="linklike" onClick={() => fitGalaxy(selected.galaxy)}>{selected.galaxy.name}</button> · {selected.loc.residents.length} residents
              </p>
              <Residents planet={selected} onOpen={onOpen} />
              {neighbours.length > 1 && (
                <>
                  <p className="atlas__kicker">Also in this dimension</p>
                  <div className="atlas__neighbours">
                    {neighbours
                      .filter((p) => p.id !== selected.id)
                      .slice(0, 10)
                      .map((p) => (
                        <button key={p.id} onClick={() => travelTo(p)} className={visited.includes(p.id) ? "seen" : ""}>
                          <i style={{ background: p.color }} /> {p.loc.name}
                        </button>
                      ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="atlas__intro">
              <h3 className="atlas__name">Multiverse Atlas</h3>
              <p className="muted">
                Every one of the <b>{atlas.planets.length}</b> locations in the archives, charted across <b>{atlas.galaxies.length}</b> dimensions. Bigger planets
                have more residents; rings mark crowded worlds, squares are space stations.
              </p>
              <p className="muted small">Drag to pan · scroll or pinch to zoom · click a planet to open a portal.</p>
            </div>
          )}

          <p className="atlas__kicker">Location types</p>
          <div className="atlas__legend" data-testid="atlas-legend">
            {atlas.types.slice(0, 12).map((t) => (
              <button
                key={t.type}
                aria-pressed={!hidden.has(t.type)}
                onClick={() =>
                  setHidden((h) => {
                    const next = new Set(h);
                    if (next.has(t.type)) next.delete(t.type);
                    else next.add(t.type);
                    return next;
                  })
                }
              >
                <i style={{ background: t.color }} /> {t.type} <span className="muted">{t.count}</span>
              </button>
            ))}
          </div>

          {visited.length > 0 && (
            <>
              <p className="atlas__kicker">Travel log</p>
              <ol className="atlas__log" data-testid="atlas-log">
                {[...visited]
                  .reverse()
                  .slice(0, 6)
                  .map((id) => {
                    const p = atlas.byId.get(id);
                    return p ? (
                      <li key={id}>
                        <button onClick={() => travelTo(p)}>{p.loc.name}</button>
                      </li>
                    ) : null;
                  })}
              </ol>
              <button className="btn btn--ghost small" onClick={() => setVisited([])}>Reset log</button>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
