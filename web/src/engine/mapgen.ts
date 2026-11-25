import { DIRS, hexDistance, key } from './hex';
import { Rng } from './rng';
import type { FactionId, GameSetup, Region, Terrain, Tile } from './types';

const RADIUS = { small: 4, medium: 5, large: 6 } as const;

const REGION_NAMES = [
  'Solomon’s Reach', 'Mammon Heights', 'Sylvana Vale', 'Adanthar Coast', 'Maltur Wastes',
  'Mistfall', 'Old Shore', 'Bonefields', 'Amberwood', 'Ironcrag', 'Sunken Marches',
  'Greyhollow', 'Thornmere', 'Saltspire',
];

export interface MapData {
  radius: number;
  tiles: Tile[];
  regions: Region[];
  neighbors: number[][];
}

export function buildNeighbors(tiles: Tile[]): number[][] {
  const index = new Map<string, number>();
  tiles.forEach((t) => index.set(key(t.q, t.r), t.id));
  return tiles.map((t) =>
    DIRS.map(([dq, dr]) => index.get(key(t.q + dq, t.r + dr))).filter((v): v is number => v !== undefined),
  );
}

export function generateMap(setup: GameSetup): MapData {
  const rng = new Rng(setup.seed ^ 0x5eed);
  const radius = RADIUS[setup.size];
  const tiles: Tile[] = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      tiles.push({
        id: tiles.length, q, r, terrain: 'water', region: -1, owner: null, troops: 0,
        champion: false, stronghold: false, capital: null, deco: rng.int(1 << 30),
      });
    }
  }
  const nb = buildNeighbors(tiles);

  // 1. Island shape: a wobbly coastline from layered angular noise.
  const phase = [rng.next() * 6.28, rng.next() * 6.28, rng.next() * 6.28];
  for (const t of tiles) {
    const d = hexDistance(0, 0, t.q, t.r);
    if (d >= radius) continue;
    const ang = Math.atan2(t.r * 1.5, Math.sqrt(3) * (t.q + t.r / 2));
    const wobble =
      0.7 * Math.sin(ang * 2 + phase[0]) + 0.45 * Math.sin(ang * 3 + phase[1]) + 0.3 * Math.sin(ang * 5 + phase[2]);
    const limit = radius - 0.6 + wobble * 0.75 + (rng.next() - 0.5) * 0.6;
    if (d <= limit || d <= 1) t.terrain = 'plains';
  }
  // Keep the largest connected landmass only.
  const seen = new Set<number>();
  let best: number[] = [];
  for (const t of tiles) {
    if (t.terrain === 'water' || seen.has(t.id)) continue;
    const comp: number[] = [];
    const stack = [t.id];
    seen.add(t.id);
    while (stack.length) {
      const id = stack.pop()!;
      comp.push(id);
      for (const n of nb[id]) if (!seen.has(n) && tiles[n].terrain !== 'water') { seen.add(n); stack.push(n); }
    }
    if (comp.length > best.length) best = comp;
  }
  const keep = new Set(best);
  for (const t of tiles) if (t.terrain !== 'water' && !keep.has(t.id)) t.terrain = 'water';
  const land = tiles.filter((t) => t.terrain !== 'water');

  // 2. Biomes: port of MapGenerator.java (seeded growth with clustering).
  const count = (t: Tile, type: Terrain) => nb[t.id].filter((n) => tiles[n].terrain === type).length;
  const grow = (type: Terrain, seeds: number, target: number) => {
    const placed: Tile[] = [];
    const frontier: Tile[] = [];
    const addFrontier = (t: Tile) => {
      for (const n of nb[t.id]) {
        const nt = tiles[n];
        if (nt.terrain === 'plains' && !frontier.includes(nt)) frontier.push(nt);
      }
    };
    for (let i = 0; i < seeds; i++) {
      const pool = rng.shuffle(land.filter((t) => t.terrain === 'plains'));
      const seed =
        pool.find((t) => type !== 'desert' || count(t, 'mountain') > 0) ?? pool[0];
      if (!seed) break;
      seed.terrain = type;
      placed.push(seed);
      addFrontier(seed);
    }
    let guard = 0;
    while (placed.length < target && frontier.length && guard++ < 5000) {
      const t = frontier.splice(rng.int(frontier.length), 1)[0];
      if (t.terrain !== 'plains') continue;
      if (type === 'forest' && count(t, 'desert') > 0) continue;
      if (type === 'desert' && count(t, 'forest') > 0) continue;
      if (count(t, type) < 2 && rng.int(100) < 60) { frontier.push(t); continue; }
      t.terrain = type;
      placed.push(t);
      addFrontier(t);
    }
  };
  const n = land.length;
  grow('mountain', 2, Math.round(n * 0.2));
  grow('desert', 1, Math.round(n * 0.14));
  grow('forest', 3, Math.round(n * 0.24));

  // 3. Regions: farthest-point seeds, then simultaneous flood fill.
  const regionCount = Math.max(4, Math.min(REGION_NAMES.length, Math.round(n / 9)));
  const seeds: Tile[] = [rng.pick(land)];
  while (seeds.length < regionCount) {
    let far = land[0];
    let farD = -1;
    for (const t of land) {
      const d = Math.min(...seeds.map((s) => hexDistance(s.q, s.r, t.q, t.r))) + rng.next() * 0.5;
      if (d > farD) { farD = d; far = t; }
    }
    seeds.push(far);
  }
  // Grow the smallest region first so provinces end up similar in size.
  const fronts: Tile[][] = seeds.map((sd, i) => { sd.region = i; return [sd]; });
  const sizes = seeds.map(() => 1);
  for (;;) {
    let pick = -1;
    for (let i = 0; i < fronts.length; i++) if (fronts[i].length && (pick < 0 || sizes[i] < sizes[pick])) pick = i;
    if (pick < 0) break;
    const front = fronts[pick];
    let grew = false;
    while (front.length && !grew) {
      const t = front[rng.int(front.length)];
      const free = nb[t.id].map((x) => tiles[x]).filter((x) => x.terrain !== 'water' && x.region === -1);
      if (!free.length) { front.splice(front.indexOf(t), 1); continue; }
      const nt = rng.pick(free);
      nt.region = pick;
      front.push(nt);
      sizes[pick]++;
      grew = true;
    }
  }
  const names = rng.shuffle([...REGION_NAMES]);
  const regions: Region[] = seeds.map((_, i) => {
    const ids = land.filter((t) => t.region === i).map((t) => t.id);
    return { id: i, name: names[i], tiles: ids, bonus: Math.max(1, Math.round(ids.length / 3.5)) };
  });

  // 4. Starting positions: spread capitals as far apart as possible.
  const active = setup.slots.filter((s) => s.kind !== 'off').map((s) => s.faction);
  const inland = land.filter((t) => nb[t.id].every((x) => tiles[x].terrain !== 'water'));
  const candidates = inland.length >= active.length * 3 ? inland : land;
  let bestSet: Tile[] = [];
  let bestScore = -1;
  for (let attempt = 0; attempt < 200; attempt++) {
    const set = rng.shuffle([...candidates]).slice(0, active.length);
    let minD = Infinity;
    for (let i = 0; i < set.length; i++)
      for (let j = i + 1; j < set.length; j++) minD = Math.min(minD, hexDistance(set[i].q, set[i].r, set[j].q, set[j].r));
    const score = minD + set.filter((t) => t.terrain === 'plains').length * 0.3;
    if (score > bestScore) { bestScore = score; bestSet = set; }
  }

  for (const t of land) {
    t.owner = 'neutral';
    t.troops = 2 + (t.terrain === 'mountain' ? 1 : 0) + (rng.int(3) === 0 ? 1 : 0);
  }
  bestSet.forEach((cap, i) => {
    const f: FactionId = active[i];
    if (cap.terrain === 'water') return;
    cap.terrain = cap.terrain === 'mountain' ? 'plains' : cap.terrain;
    cap.owner = f;
    cap.capital = f;
    cap.troops = 6;
    const around = rng.shuffle(nb[cap.id].map((x) => tiles[x]).filter((x) => x.terrain !== 'water' && !x.capital));
    around.slice(0, 2).forEach((a) => { a.owner = f; a.troops = 3; });
    // Make sure each faction has a little of its power terrain nearby.
    const home = FACTION_TERRAIN[f];
    const ring = land
      .filter((x) => x.owner === 'neutral' && hexDistance(x.q, x.r, cap.q, cap.r) <= 2)
      .sort((a, b) => a.deco - b.deco);
    if (ring.length && !ring.some((x) => x.terrain === home)) ring[0].terrain = home;
  });

  return { radius, tiles, regions, neighbors: nb };
}

const FACTION_TERRAIN: Record<FactionId, Terrain> = { necro: 'desert', elves: 'forest', giants: 'mountain' };
