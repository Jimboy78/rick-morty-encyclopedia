import type { Location } from "../services/api";

// Deterministic galaxy map of every location in the API: one galaxy per dimension, planets on
// tilted concentric orbits (biggest populations on the inner rings), galaxies placed on a
// sunflower spiral and pushed outward until they don't overlap.

export interface Galaxy {
  id: number;
  name: string;
  x: number;
  y: number;
  r: number;
  hue: number;
  spin: 1 | -1;
  planets: Planet[];
}

export interface Planet {
  id: number;
  loc: Location;
  galaxy: Galaxy;
  ring: number;
  orbit: number;
  angle0: number;
  speed: number;
  size: number;
  kind: string;
  color: string;
}

export interface AtlasData {
  galaxies: Galaxy[];
  planets: Planet[];
  byId: Map<number, Planet>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  types: { type: string; count: number; color: string }[];
}

export const ORBIT_TILT = 0.7;
export const RING_GAP = 85;
const FIRST_ORBIT = 90;
const GALAXY_MARGIN = 90;
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

export const dimensionName = (dimension: string | undefined) => {
  const value = dimension?.trim();
  return !value || value.toLowerCase() === "unknown" ? "Unknown dimension" : value;
};

export const typeName = (type: string | undefined) => type?.trim() || "Unknown";

export function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const TYPE_COLORS: Record<string, string> = {
  Planet: "#4fd1a5",
  "Space station": "#9fb3c8",
  Microverse: "#b48cff",
  Cluster: "#7ce7ff",
  TV: "#ffd24a",
  Resort: "#ff9f43",
  "Fantasy town": "#ff8fcf",
  Dream: "#ff6fb5",
  Dimension: "#62a8ff",
  Menagerie: "#c3e86b",
  Game: "#ff5d5d",
  Unknown: "#7b8794",
};

export const colorForType = (type: string) => TYPE_COLORS[type] ?? `hsl(${hash(type) % 360} 72% 64%)`;

export const planetSize = (residents: number) => Math.min(24, 6 + Math.sqrt(residents) * 2.2);

/** Ring k (1-based) holds up to 6k planets. */
export const ringCapacity = (ring: number) => 6 * ring;

export function buildAtlas(locations: Location[]): AtlasData {
  const groups = new Map<string, Location[]>();
  for (const loc of locations) {
    const name = dimensionName(loc.dimension);
    groups.set(name, [...(groups.get(name) ?? []), loc]);
  }
  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));

  const galaxies: Galaxy[] = [];
  const planets: Planet[] = [];

  ordered.forEach(([name, locs], index) => {
    const sorted = [...locs].sort((a, b) => b.residents.length - a.residents.length || a.id - b.id);
    let ring = 1;
    let used = 0;
    const slots: { ring: number; slot: number }[] = [];
    for (let i = 0; i < sorted.length; i++) {
      if (used === ringCapacity(ring)) {
        ring++;
        used = 0;
      }
      slots.push({ ring, slot: used++ });
    }
    const rings = ring;
    const r = FIRST_ORBIT + (rings - 1) * RING_GAP + GALAXY_MARGIN;
    const galaxy: Galaxy = { id: index, name, x: 0, y: 0, r, hue: hash(name) % 360, spin: index % 2 ? -1 : 1, planets: [] };

    // Sunflower placement, pushed out until clear of every galaxy already placed.
    if (index > 0) {
      const angle = index * GOLDEN;
      let dist = 300 * Math.sqrt(index);
      const clear = () =>
        galaxies.every((g) => Math.hypot(g.x - Math.cos(angle) * dist, g.y - Math.sin(angle) * dist) >= g.r + r + 40);
      while (!clear()) dist += 30;
      galaxy.x = Math.round(Math.cos(angle) * dist);
      galaxy.y = Math.round(Math.sin(angle) * dist);
    }

    sorted.forEach((loc, i) => {
      const { ring: k, slot } = slots[i];
      const onRing = k === rings ? sorted.length - slots.findIndex((s) => s.ring === k) : ringCapacity(k);
      const kind = typeName(loc.type);
      const planet: Planet = {
        id: loc.id,
        loc,
        galaxy,
        ring: k,
        orbit: FIRST_ORBIT + (k - 1) * RING_GAP,
        angle0: (slot / onRing) * Math.PI * 2 + k * 0.7,
        speed: (0.06 / k) * galaxy.spin,
        size: planetSize(loc.residents.length),
        kind,
        color: colorForType(kind),
      };
      galaxy.planets.push(planet);
      planets.push(planet);
    });
    galaxies.push(galaxy);
  });

  const bounds = galaxies.reduce(
    (b, g) => ({ minX: Math.min(b.minX, g.x - g.r), minY: Math.min(b.minY, g.y - g.r), maxX: Math.max(b.maxX, g.x + g.r), maxY: Math.max(b.maxY, g.y + g.r) }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  const counts = new Map<string, number>();
  for (const p of planets) counts.set(p.kind, (counts.get(p.kind) ?? 0) + 1);
  const types = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([type, count]) => ({ type, count, color: colorForType(type) }));

  return { galaxies, planets, byId: new Map(planets.map((p) => [p.id, p])), bounds, types };
}

export function planetPosition(planet: Planet, seconds: number) {
  const angle = planet.angle0 + planet.speed * seconds;
  return {
    x: planet.galaxy.x + Math.cos(angle) * planet.orbit,
    y: planet.galaxy.y + Math.sin(angle) * planet.orbit * ORBIT_TILT,
  };
}

export const RANKS = [
  { at: 0, title: "Space Cadet" },
  { at: 0.05, title: "Portal Novice" },
  { at: 0.15, title: "Interdimensional Tourist" },
  { at: 0.35, title: "Galactic Fugitive" },
  { at: 0.6, title: "Council of Ricks" },
  { at: 1, title: "Rickest Rick" },
];

export const rankFor = (ratio: number) => [...RANKS].reverse().find((r) => ratio >= r.at)!;
