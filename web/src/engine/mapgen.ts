import { DIRS, hexDistance, key } from './hex';
import { Rng } from './rng';
import type { Army, City, FactionId, GameSetup, Region, Terrain, Tile } from './types';
export type { Terrain };
import { FACTION_UNITS, UNIT_STATS, MOVE_POINTS } from './unitstats';

const RADIUS = { small: 7, medium: 8, large: 9 } as const;


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

  // 3. Regions: 2-4 connected hexes that act as one field, with one terrain.
  const regions = partition(tiles, nb, land, rng);
  const adj = regionAdjacency(tiles, regions, nb);
  const anchorOf = (r: number) => regions[r].anchor;
  const setTerrain = (r: number, terrain: Terrain) => { for (const id of regions[r].tiles) tiles[id].terrain = terrain; };
  const setOwner = (r: number, o: Tile['owner']) => { for (const id of regions[r].tiles) tiles[id].owner = o; };
  const coastal = (r: number) => regions[r].tiles.some((id) => nb[id].some((x) => tiles[x].terrain === 'water') || nb[id].length < 6);
  const hd = (a: number, b: number) => hexDistance(tiles[anchorOf(a)].q, tiles[anchorOf(a)].r, tiles[anchorOf(b)].q, tiles[anchorOf(b)].r);
  const steps = (from: number) => {
    const d = new Map<number, number>([[from, 0]]);
    const q = [from];
    while (q.length) { const c = q.shift()!; for (const n of adj[c]) if (!d.has(n)) { d.set(n, d.get(c)! + 1); q.push(n); } }
    return d;
  };

  // 4. Starting positions: spread capitals as far apart as possible.
  const active = setup.slots.filter((s) => s.kind !== 'off').map((s) => s.faction);
  // Inland regions are preferred, but never at the cost of distance between capitals.
  const candidates = regions.map((r) => r.id);
  let bestSet: number[] = [];
  let bestScore = -1;
  const stepMap = new Map(candidates.map((r) => [r, steps(r)]));
  for (let attempt = 0; attempt < 300; attempt++) {
    const set = rng.shuffle([...candidates]).slice(0, active.length);
    let minD = Infinity;
    for (let i = 0; i < set.length; i++) for (let j = i + 1; j < set.length; j++) minD = Math.min(minD, (stepMap.get(set[i])!.get(set[j]) ?? 0) + hd(set[i], set[j]) * 0.01);
    const score = minD + rng.next() * 0.5 - set.filter(coastal).length * 0.3;
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
  const homes: number[] = []; // region ids
  bestSet.forEach((cap, i) => {
    const f: FactionId = active[i];
    if (tiles[anchorOf(cap)].terrain === 'mountain') setTerrain(cap, 'plains');
    setOwner(cap, f);
    cities.push({ tile: anchorOf(cap), owner: f, level: 1, capital: true, assaults: 0, grew: false });
    homes.push(cap);
    // Starting army in a neighbouring region: 3 base units and 1 tier-2 unit.
    const spot = rng.shuffle([...adj[cap]]).sort((a, b) => (tiles[anchorOf(a)].terrain === 'mountain' ? 1 : 0) - (tiles[anchorOf(b)].terrain === 'mountain' ? 1 : 0))
      .find((r) => !homes.includes(r) && !armies.some((x) => x.tile === anchorOf(r)));
    if (spot !== undefined) {
      setOwner(spot, f);
      const [t1, t2] = FACTION_UNITS[f];
      mkArmy(f, anchorOf(spot), [t1, t1, t1, t2]);
    }
  });
  const nearHome = (r: number) => homes.some((h) => (steps(h).get(r) ?? 99) <= 1);

  // A third of the mountain regions are high peaks nobody can cross.
  const mountains = rng.shuffle(regions.filter((r) => tiles[r.anchor].terrain === 'mountain' && tiles[r.anchor].owner === null && !nearHome(r.id)).map((r) => r.id));
  let peaks = Math.round(regions.filter((r) => tiles[r.anchor].terrain === 'mountain').length / 3);
  const blocked = new Set<number>();
  for (const m of mountains) {
    if (peaks <= 0) break;
    blocked.add(m);
    if (!allConnected(adj, homes, blocked)) { blocked.delete(m); continue; }
    setTerrain(m, 'peak');
    peaks--;
  }

  // Two dwarf fortresses in mountain regions, far from every capital and from each other.
  const fortresses: { tile: number; discovered: boolean; finder?: FactionId | null }[] = [];
  const fortRegions: number[] = [];
  for (let i = 0; i < 2; i++) {
    let best = -1;
    let bestScore = -1;
    for (const r of regions) {
      if (tiles[r.anchor].terrain !== 'mountain' || tiles[r.anchor].owner !== null || fortRegions.includes(r.id) || armies.some((a) => a.tile === r.anchor)) continue;
      if (!adj[r.id].some((n) => !blocked.has(n) && !fortRegions.includes(n))) continue;
      blocked.add(r.id);
      const ok = allConnected(adj, homes, blocked);
      blocked.delete(r.id);
      if (!ok) continue;
      const score = Math.min(...[...homes, ...fortRegions].map((h) => hd(h, r.id))) + rng.next();
      if (score > bestScore) { bestScore = score; best = r.id; }
    }
    if (best < 0) break;
    fortRegions.push(best);
    blocked.add(best);
    fortresses.push({ tile: anchorOf(best), discovered: false });
  }

  // Neutral wildlings in roughly every fourth free region, away from the capitals.
  const free = rng.shuffle(regions.filter((r) => tiles[r.anchor].owner === null && !blocked.has(r.id) && !nearHome(r.id) && !armies.some((a) => a.tile === r.anchor)));
  free.slice(0, Math.round(regions.length / 4)).forEach((r) => {
    setOwner(r.id, 'neutral');
    const n = 1 + rng.int(3) + (tiles[r.anchor].terrain === 'mountain' ? 1 : 0);
    mkArmy('neutral', r.anchor, Array(n).fill('wildling'));
  });

  return { radius, tiles, regions, neighbors: nb, armies, cities, nextId, fortresses };
}

const NAME_A = ['Amber', 'Ash', 'Bone', 'Brier', 'Cinder', 'Copper', 'Crow', 'Dusk', 'Elder', 'Ember', 'Fern', 'Frost', 'Gloam', 'Gold', 'Grey', 'Hollow', 'Iron', 'Ivy', 'Mist', 'Moss', 'Oak', 'Raven', 'Red', 'Salt', 'Sorrow', 'Stone', 'Sun', 'Thorn', 'Wild', 'Wolf'];
const NAME_B = ['barrow', 'brook', 'crag', 'dale', 'deep', 'fall', 'fell', 'field', 'ford', 'gate', 'glen', 'heath', 'hold', 'hollow', 'marsh', 'mere', 'moor', 'reach', 'ridge', 'run', 'shore', 'spire', 'vale', 'watch', 'wood'];

/** Splits the land into connected groups of 2-4 hexes, preferring hexes of the same biome. */
function partition(tiles: Tile[], nb: number[][], land: Tile[], rng: Rng): Region[] {
  const group = new Map<number, number>();
  const groups: number[][] = [];
  const freeNb = (id: number) => nb[id].filter((x) => tiles[x].terrain !== 'water' && !group.has(x)).length;
  for (;;) {
    const open = land.filter((t) => !group.has(t.id));
    if (!open.length) break;
    let seed = open[0];
    let low = Infinity;
    for (const t of rng.shuffle(open)) { const f = freeNb(t.id); if (f < low) { low = f; seed = t; } }
    const target = [2, 3, 3, 4][rng.int(4)];
    const g = [seed.id];
    group.set(seed.id, groups.length);
    while (g.length < target) {
      const cand = [...new Set(g.flatMap((id) => nb[id]))].filter((x) => tiles[x].terrain !== 'water' && !group.has(x));
      if (!cand.length) break;
      cand.sort((a, b) => (tiles[a].terrain === seed.terrain ? 0 : 1) - (tiles[b].terrain === seed.terrain ? 0 : 1) || freeNb(a) - freeNb(b));
      group.set(cand[0], groups.length);
      g.push(cand[0]);
    }
    groups.push(g);
  }
  // Lone hexes join a neighbour, or pair up with a hex a big neighbour can spare.
  const connected = (ids: number[]) => {
    if (!ids.length) return false;
    const seen = new Set([ids[0]]);
    const st = [ids[0]];
    while (st.length) { const c = st.pop()!; for (const n of nb[c]) if (ids.includes(n) && !seen.has(n)) { seen.add(n); st.push(n); } }
    return seen.size === ids.length;
  };
  for (let gi = 0; gi < groups.length; gi++) {
    const g = groups[gi];
    if (g.length !== 1) continue;
    const id = g[0];
    const near = [...new Set(nb[id].map((x) => group.get(x)).filter((x): x is number => x !== undefined && x !== gi))];
    const small = near.filter((x) => groups[x].length < 4).sort((a, b) => groups[a].length - groups[b].length)[0];
    if (small !== undefined) { groups[small].push(id); group.set(id, small); g.length = 0; continue; }
    let paired = false;
    for (const x of near) {
      const other = groups[x];
      if (other.length < 3) continue;
      const give = other.find((t) => nb[id].includes(t) && connected(other.filter((o) => o !== t)));
      if (give === undefined) continue;
      groups[x] = other.filter((o) => o !== give);
      g.push(give);
      group.set(give, gi);
      paired = true;
      break;
    }
    if (!paired && near.length) { const x = near[0]; groups[x].push(id); group.set(id, x); g.length = 0; }
  }
  const kept = groups.filter((g) => g.length);
  const names = new Set<string>();
  return kept.map((ids, i) => {
    // One terrain per region: the most common biome among its hexes.
    const count = new Map<Terrain, number>();
    for (const id of ids) count.set(tiles[id].terrain, (count.get(tiles[id].terrain) ?? 0) + 1);
    const terrain = [...count].sort((a, b) => b[1] - a[1])[0][0];
    for (const id of ids) { tiles[id].terrain = terrain; tiles[id].region = i; }
    // The most central hex carries armies and buildings.
    const anchor = [...ids].sort((a, b) => spread(tiles, ids, a) - spread(tiles, ids, b) || a - b)[0];
    let name = '';
    for (let k = 0; k < 50 && (!name || names.has(name)); k++) name = rng.pick(NAME_A) + rng.pick(NAME_B);
    names.add(name);
    return { id: i, name, tiles: ids, anchor };
  });
}

function spread(tiles: Tile[], ids: number[], a: number): number {
  return ids.reduce((n, b) => n + hexDistance(tiles[a].q, tiles[a].r, tiles[b].q, tiles[b].r), 0);
}

/** Region index -> neighbouring region indices. */
export function regionAdjacency(tiles: Tile[], regions: Region[], nb: number[][]): number[][] {
  return regions.map((r) => {
    const out = new Set<number>();
    for (const id of r.tiles) for (const x of nb[id]) { const o = tiles[x].region; if (o >= 0 && o !== r.id) out.add(o); }
    return [...out];
  });
}

/** Every open region must stay reachable from the first capital. */
function allConnected(adj: number[][], homes: number[], blocked: Set<number>): boolean {
  if (!homes.length) return true;
  const seen = new Set([homes[0]]);
  const stack = [homes[0]];
  while (stack.length) {
    const id = stack.pop()!;
    for (const n of adj[id]) if (!seen.has(n) && !blocked.has(n)) { seen.add(n); stack.push(n); }
  }
  return adj.every((_, r) => blocked.has(r) || seen.has(r));
}
