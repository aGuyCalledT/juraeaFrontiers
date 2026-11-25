import { DIRS, hexDistance, key } from './hex';
import { Rng } from './rng';
import type { Army, City, FactionId, GameSetup, Region, Terrain, Tile } from './types';
export type { Terrain };
import { FACTION_UNITS, UNIT_STATS, MOVE_POINTS } from './unitstats';

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
  armies: Army[];
  cities: City[];
  nextId: number;
  fortresses: { tile: number; discovered: boolean; finder?: FactionId | null }[];
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
        id: tiles.length, q, r, terrain: 'water', region: -1, owner: null, enchanted: false, improved: 0, corrupted: false, deco: rng.int(1 << 30),
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
    return { id: i, name: names[i], tiles: ids };
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
    const score = minD + rng.next() * 0.5;
    if (score > bestScore) { bestScore = score; bestSet = set; }
  }

  let nextId = 1;
  const armies: Army[] = [];
  const cities: City[] = [];
  const mkArmy = (owner: Army['owner'], tile: number, types: string[]): Army => {
    const a: Army = {
      id: nextId++, owner, tile, mp: MOVE_POINTS, attacked: false, lowMorale: false,
      units: types.map((t) => ({ id: nextId++, type: t as Army['units'][0]['type'], hp: UNIT_STATS[t as keyof typeof UNIT_STATS].hp })),
    };
    armies.push(a);
    return a;
  };
  const homes: number[] = [];
  bestSet.forEach((cap, i) => {
    const f: FactionId = active[i];
    if (cap.terrain === 'water') return;
    if (cap.terrain === 'mountain') cap.terrain = 'plains';
    cap.owner = f;
    cities.push({ tile: cap.id, owner: f, level: 0, siege: {}, capital: true });
    homes.push(cap.id);
    // Starting army next to the capital: 3 base units and 1 tier-2 unit.
    const spot = rng.shuffle(nb[cap.id].map((x) => tiles[x]).filter((x) => x.terrain !== 'water'))
      .sort((a, b) => (a.terrain === 'mountain' ? 1 : 0) - (b.terrain === 'mountain' ? 1 : 0))[0];
    if (spot) {
      spot.owner = f;
      const [t1, t2] = FACTION_UNITS[f];
      mkArmy(f, spot.id, [t1, t1, t1, t2]);
    }
  });

  // A third of the mountains are high peaks nobody can cross.
  const mountains = rng.shuffle(land.filter((t) => t.terrain === 'mountain' && t.owner === null &&
    homes.every((h) => hexDistance(tiles[h].q, tiles[h].r, t.q, t.r) >= 2)));
  let peaks = Math.round(land.filter((t) => t.terrain === 'mountain').length / 3);
  for (const m of mountains) {
    if (peaks <= 0) break;
    m.terrain = 'peak';
    if (!allConnected(tiles, nb, homes)) { m.terrain = 'mountain'; continue; }
    peaks--;
  }

  // Two dwarf fortresses on mountains, far from every capital and from each other.
  const fortresses: { tile: number; discovered: boolean; finder?: FactionId | null }[] = [];
  const mts = land.filter((t) => t.terrain === 'mountain' && t.owner === null);
  for (let i = 0; i < 2 && mts.length; i++) {
    let best: Tile | null = null;
    let bestScore = -1;
    for (const m of mts) {
      if (fortresses.some((fo) => fo.tile === m.id)) continue;
      const others = [...homes, ...fortresses.map((fo) => fo.tile)];
      const score = Math.min(...others.map((h) => hexDistance(tiles[h].q, tiles[h].r, m.q, m.r))) + rng.next();
      if (score > bestScore && nb[m.id].some((x) => tiles[x].terrain !== 'water' && tiles[x].terrain !== 'peak')) { bestScore = score; best = m; }
    }
    if (!best) break;
    fortresses.push({ tile: best.id, discovered: false });
    best.owner = null;
  }

  // Neutral wildlings on roughly every fourth free hex, away from the capitals.
  const free = rng.shuffle(land.filter((t) => t.owner === null && t.terrain !== 'peak' && !fortresses.some((fo) => fo.tile === t.id) && homes.every((h) => hexDistance(tiles[h].q, tiles[h].r, t.q, t.r) >= 2)));
  free.slice(0, Math.round(land.length / 4)).forEach((t) => {
    t.owner = 'neutral';
    const n = 1 + rng.int(3) + (t.terrain === 'mountain' ? 1 : 0);
    mkArmy('neutral', t.id, Array(n).fill('wildling'));
  });

  return { radius, tiles, regions, neighbors: nb, armies, cities, nextId, fortresses };
}

/** Every passable land hex must stay reachable from the first capital. */
function allConnected(tiles: Tile[], nb: number[][], homes: number[]): boolean {
  if (!homes.length) return true;
  const ok = (t: Tile) => t.terrain !== 'water' && t.terrain !== 'peak';
  const seen = new Set([homes[0]]);
  const stack = [homes[0]];
  while (stack.length) {
    const id = stack.pop()!;
    for (const n of nb[id]) if (!seen.has(n) && ok(tiles[n])) { seen.add(n); stack.push(n); }
  }
  return tiles.every((t) => !ok(t) || seen.has(t.id));
}
