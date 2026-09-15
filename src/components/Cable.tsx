import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { fetchCharacter, fetchCharacterCount, type Character } from "../services/api";
import type { Favorites } from "../hooks/useFavorites";
import "./cable.css";

interface Props {
  favorites: Favorites;
  onOpen: (c: Character) => void;
}

type Phase = "off" | "tuning" | "on" | "error";

// Programming guide from the Interdimensional Cable box.
const SHOWS = [
  "Ball Fondlers",
  "Two Brothers",
  "Real Fake Doors",
  "Gazorpazorp Nightly",
  "Ants in My Eyes Johnson",
  "How Did I Get Here?",
  "Baby Legs",
  "Strawberry Smiggles",
  "Plumbus: How It's Made",
  "Gene Moves",
  "Mr. Sneezy",
  "Tiny Rick Unplugged",
  "Citadel News at 9",
  "Froopyland Kids",
];

const STATIC_W = 160;
const STATIC_H = 120;
const AUTO_SURF_MS = 6500;

const pad = (n: number | string) => String(n).padStart(3, "0");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const preload = (src: string) =>
  new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = src;
  });

function tickerFor(c: Character) {
  const eps = `seen in ${c.episode.length} episode${c.episode.length === 1 ? "" : "s"}`;
  if (c.status === "Dead") return `IN MEMORIAM: ${c.name}, ${c.species} of ${c.origin.name} — ${eps}`;
  if (c.status === "unknown") return `WHEREABOUTS UNKNOWN: ${c.name} (${c.species}) last reported near ${c.location.name} — ${eps}`;
  return `LIVE: ${c.name} (${c.species}, ${c.gender}) broadcasting from ${c.location.name} — ${eps}`;
}

export default function Cable({ favorites, onOpen }: Props) {
  const [total, setTotal] = useState<number | null>(null);
  const [channel, setChannel] = useState(1);
  const [character, setCharacter] = useState<Character | null>(null);
  const [phase, setPhase] = useState<Phase>("tuning");
  const [dial, setDial] = useState("");
  const [sound, setSound] = useState(false);
  const [autoSurf, setAutoSurf] = useState(false);
  const [history, setHistory] = useState<Character[]>([]);

  const requestRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const soundRef = useRef(sound);
  const dialRef = useRef("");
  const dialTimer = useRef<ReturnType<typeof setTimeout>>();

  soundRef.current = sound;

  const audio = () => {
    if (!audioRef.current) audioRef.current = new AudioContext();
    return audioRef.current;
  };

  const playStatic = useCallback((duration = 0.45) => {
    if (!soundRef.current) return;
    const ctx = audio();
    const length = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 2400;
    band.Q.value = 0.6;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    source.connect(band).connect(gain).connect(ctx.destination);
    source.start();
  }, []);

  const playBlip = useCallback((up: boolean) => {
    if (!soundRef.current) return;
    const ctx = audio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(up ? 110 : 900, t);
    osc.frequency.exponentialRampToValueAtTime(up ? 900 : 60, t + 0.3);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(t + 0.36);
  }, []);

  const tune = useCallback(
    async (target: number) => {
      if (!total) return;
      const next = ((((target - 1) % total) + total) % total) + 1;
      const request = ++requestRef.current;
      setChannel(next);
      setPhase("tuning");
      playStatic();
      try {
        const [c] = await Promise.all([fetchCharacter(next), wait(420)]);
        await preload(c.image);
        if (request !== requestRef.current) return;
        setCharacter(c);
        setPhase("on");
        setHistory((h) => [c, ...h.filter((x) => x.id !== c.id)].slice(0, 8));
      } catch {
        if (request === requestRef.current) setPhase("error");
      }
    },
    [total, playStatic],
  );

  const surf = useCallback(() => total && tune(1 + Math.floor(Math.random() * total)), [total, tune]);

  const power = useCallback(() => {
    if (phase === "off") {
      playBlip(true);
      tune(channel);
    } else {
      requestRef.current++;
      playBlip(false);
      setAutoSurf(false);
      setPhase("off");
    }
  }, [phase, channel, tune, playBlip]);

  useEffect(() => {
    fetchCharacterCount()
      .then(setTotal)
      .catch(() => setPhase("error"));
  }, []);

  // Switch on to a random channel once we know how many exist.
  useEffect(() => {
    if (total) tune(1 + Math.floor(Math.random() * total));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  useEffect(() => {
    if (!autoSurf || phase === "off") return;
    const id = setInterval(surf, AUTO_SURF_MS);
    return () => clearInterval(id);
  }, [autoSurf, phase, surf]);

  // Analog snow: a tiny noise canvas scaled up with pixelated rendering.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const frame = ctx.createImageData(STATIC_W, STATIC_H);
    const d = frame.data;
    let raf = 0;
    let tick = 0;
    const draw = () => {
      if (tick++ % 2 === 0) {
        for (let i = 0; i < d.length; i += 4) {
          const v = (Math.random() * 255) | 0;
          d[i] = d[i + 1] = d[i + 2] = v;
          d[i + 3] = 255;
        }
        ctx.putImageData(frame, 0, 0);
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select")) return;

      if (/^[0-9]$/.test(e.key) && phase !== "off") {
        dialRef.current = (dialRef.current + e.key).slice(-3);
        setDial(dialRef.current);
        clearTimeout(dialTimer.current);
        dialTimer.current = setTimeout(() => {
          const n = Number(dialRef.current);
          dialRef.current = "";
          setDial("");
          if (n > 0) tune(n);
        }, 1100);
        return;
      }
      switch (e.key.toLowerCase()) {
        case "arrowright":
          if (phase !== "off") tune(channel + 1);
          break;
        case "arrowleft":
          if (phase !== "off") tune(channel - 1);
          break;
        case "r":
          if (phase !== "off") surf();
          break;
        case "p":
          power();
          break;
        case "m":
          setSound((s) => !s);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, channel, tune, surf, power]);

  useEffect(() => () => clearTimeout(dialTimer.current), []);
  useEffect(() => () => void audioRef.current?.close(), []);

  const show = SHOWS[channel % SHOWS.length];
  const knob = { "--rot": `${channel * 23}deg` } as CSSProperties;
  const collected = character ? favorites.isFavorite(character.id) : false;

  return (
    <section className="cable">
      <div className={`tv tv--${phase}`}>
        <div className="tv__ears" aria-hidden="true">
          <i />
          <i />
        </div>

        <div className="tv__body">
          <div className="tv__bezel">
            <div className={`crt crt--${phase}`}>
              <div className="crt__inner">
                {character && (
                  <>
                    <img className="crt__bg" src={character.image} alt="" aria-hidden="true" />
                    <button
                      className="crt__program"
                      onClick={() => onOpen(character)}
                      aria-label={`Open ${character.name} dossier`}
                      tabIndex={phase === "on" ? 0 : -1}
                    >
                      <img key={character.id} className="crt__img" src={character.image} alt={character.name} />
                    </button>
                  </>
                )}

                {phase !== "off" && (
                  <>
                    <div className="crt__show">
                      {show}
                      {phase === "on" && (
                        <span className="crt__live">
                          <i /> LIVE
                        </span>
                      )}
                    </div>
                    <div className="crt__osd">CH {dial ? dial.padEnd(3, "_") : pad(channel)}</div>
                  </>
                )}

                {phase === "on" && character && (
                  <>
                    <div className="crt__lower" key={character.id}>
                      <span className="crt__name">{character.name}</span>
                      <br />
                      <span className="crt__meta">
                        {character.status.toUpperCase()} · {character.species}
                        {character.type ? ` · ${character.type}` : ""}
                      </span>
                    </div>
                    <div className="crt__ticker">
                      <span key={character.id}>
                        {tickerFor(character)} ✦ Stay tuned for {SHOWS[(channel + 1) % SHOWS.length]} ✦
                      </span>
                    </div>
                  </>
                )}

                {phase === "error" && <div className="crt__nosignal">NO SIGNAL</div>}

                <canvas ref={canvasRef} className="crt__static" width={STATIC_W} height={STATIC_H} aria-hidden="true" />
                <div className="crt__scan" aria-hidden="true" />
                <div className="crt__roll" aria-hidden="true" />
              </div>
              {phase === "off" && <div className="crt__dot" aria-hidden="true" />}
              <div className="crt__vignette" aria-hidden="true" />
            </div>
          </div>

          <div className="tv__panel">
            <div className="tv__brand">MICROVERSE</div>
            <button
              className="knob"
              style={knob}
              onClick={() => tune(channel + 1)}
              disabled={phase === "off" || !total}
              aria-label="Next channel"
            />
            <span className="knob__label">CHANNEL</span>
            <div className="tv__btns">
              <button className="tv__btn" onClick={() => tune(channel - 1)} disabled={phase === "off"} aria-label="Previous channel">
                ◀
              </button>
              <button className="tv__btn" onClick={() => tune(channel + 1)} disabled={phase === "off"} aria-label="Next channel">
                ▶
              </button>
              <button className="tv__btn" onClick={surf} disabled={phase === "off"} aria-label="Random channel">
                🎲
              </button>
              <button className={`tv__btn ${sound ? "on" : ""}`} onClick={() => setSound((s) => !s)} aria-label="Toggle sound">
                {sound ? "🔊" : "🔇"}
              </button>
              <button
                className={`tv__btn ${autoSurf ? "on" : ""}`}
                onClick={() => setAutoSurf((a) => !a)}
                disabled={phase === "off"}
                aria-label="Toggle auto surf"
              >
                ⏩
              </button>
              <button className="tv__btn tv__btn--power" onClick={power} aria-label="Power">
                ⏻
              </button>
            </div>
            <span className={`tv__led ${phase === "off" ? "" : "on"}`} aria-hidden="true" />
            <div className="tv__grille" aria-hidden="true" />
          </div>
        </div>

        <div className="tv__feet" aria-hidden="true">
          <i />
          <i />
        </div>
      </div>

      <aside className="guide">
        <div className="guide__card">
          <h2 className="display">Interdimensional Cable</h2>
          <p className="muted">
            Every being in the multiverse has a channel. {total ? `${total.toLocaleString()} channels, ` : ""}infinite
            realities, zero commercials that make sense.
          </p>
        </div>

        {character && (
          <div className="guide__card">
            <h3>Now playing</h3>
            <div className="guide__now">
              <img src={character.image} alt="" />
              <div>
                <b>{character.name}</b>
                <small>
                  CH {pad(character.id)} · {show}
                </small>
              </div>
            </div>
            <div className="row">
              <button className="btn btn--ghost" onClick={() => onOpen(character)}>
                Open dossier
              </button>
              <button className="btn btn--ghost" onClick={() => favorites.toggle(character)}>
                {collected ? "★ Collected" : "☆ Collect"}
              </button>
            </div>
          </div>
        )}

        <div className="guide__card">
          <h3>Remote</h3>
          <ul className="kbd-list">
            <li>
              <kbd>◀</kbd>
              <kbd>▶</kbd> Surf channels
            </li>
            <li>
              <kbd>0-9</kbd> Dial a channel directly
            </li>
            <li>
              <kbd>R</kbd> Random reality · <kbd>M</kbd> Sound
            </li>
            <li>
              <kbd>P</kbd> Power
            </li>
          </ul>
        </div>

        {history.length > 1 && (
          <div className="guide__card">
            <h3>Recently watched</h3>
            <div className="history">
              {history.slice(1).map((c) => (
                <button key={c.id} onClick={() => tune(c.id)} title={c.name} disabled={phase === "off"}>
                  <img src={c.image} alt={c.name} loading="lazy" />
                  <span>{pad(c.id)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </section>
  );
}
