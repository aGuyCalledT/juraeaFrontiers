import { FACTIONS } from './factions';
import { buildNeighbors, generateMap, regionAdjacency } from './mapgen';
import { Rng } from './rng';
import type {
  Action, Army, CannonShot, City, CombatDie, CombatEvent, FactionId, GameEvent, GameSetup, GameState,
  Income, Owner, PlayerState, PlayerStats, RaiseResult, Region, Tile, Unit,
} from './types';
import {
  ARMY_FREE_SIZE, CITY_ASSAULTS, CITY_COST, DWARF_UNITS, FACTION_UNITS, GROW_RANGE, IMPROVE_COST, MAX_CITY_LEVEL, MAX_IMPROVE, MOVE_POINTS, NO_CITY_LIMIT,
  ENCHANTED_GOLD, RAZE_GOLD, SPELL_COOLDOWN, START_GOLD, UNIT_STATS, UPGRADE_COST, DWARF_COST, DWARF_COST_OTHERS, RAISE, CITY_TUNE, garrisonTier, hitRank,
  siegeCost, wallHp, baseCost, bounty, refund, unitCost, type UnitType,
} from './unitstats';

// ------------------------------------------------------------------ helpers
// The board is made of regions (2-4 hexes acting as one field). Every position
// in the game state (armies, cities, walls, fortresses, builds) is the anchor
// hex of its region, and `neighbors` links anchors of touching regions.
const hexCache = new Map<number, number[][]>();
/** Plain hex adjacency (for coasts and drawing). */
export function hexNeighbors(state: GameState): number[][] {
  let nb = hexCache.get(state.radius);
  if (!nb) { nb = buildNeighbors(state.tiles); hexCache.set(state.radius, nb); }
  return nb;
}

const nodeCache = new Map<string, number[][]>();
/** Region adjacency, indexed by any hex id: the anchors of the regions touching that hex's region. */
export function neighbors(state: GameState): number[][] {
  const key = `${state.setup.seed}:${state.setup.size}:${state.regions.length}`;
  let nb = nodeCache.get(key);
  if (!nb) {
    const adj = regionAdjacency(state.tiles, state.regions, hexNeighbors(state));
    nb = state.tiles.map((t) => (t.region >= 0 ? adj[t.region].map((r) => state.regions[r].anchor) : []));
    nodeCache.set(key, nb);
  }
  return nb;
}

export function regionOf(s: GameState, tile: number): Region | undefined { return s.regions[s.tiles[tile]?.region ?? -1]; }
/** The anchor hex of the region containing `tile`. */
export function anchorOf(s: GameState, tile: number): number { return regionOf(s, tile)?.anchor ?? tile; }
export function regionTiles(s: GameState, tile: number): number[] { return regionOf(s, tile)?.tiles ?? [tile]; }
/** Change a field on every hex of a region. */
function setRegion(s: GameState, tile: number, patch: Partial<Tile>) {
  for (const id of regionTiles(s, tile)) Object.assign(s.tiles[id], patch);
}
/** Steps between two regions through the region graph (water and peaks included). */
export function regionDist(s: GameState, a: number, b: number): number {
  const from = anchorOf(s, a), to = anchorOf(s, b);
  if (from === to) return 0;
  const nb = neighbors(s);
  const seen = new Map<number, number>([[from, 0]]);
  const q = [from];
  while (q.length) {
    const c = q.shift()!;
    for (const n of nb[c]) {
      if (seen.has(n)) continue;
      const d = seen.get(c)! + 1;
      if (n === to) return d;
      seen.set(n, d);
      q.push(n);
    }
  }
  return Infinity;
}

export const TERRAIN_COST: Record<string, number> = { plains: 1, desert: 1, forest: 2, mountain: 3, peak: 99, water: 99 };
export const IMPASSABLE = (t: Tile) => t.terrain === 'water' || t.terrain === 'peak';

export function currentPlayer(s: GameState): PlayerState { return s.players[s.current]; }
export function player(s: GameState, f: FactionId): PlayerState | undefined { return s.players.find((p) => p.faction === f); }
export function armiesAt(s: GameState, tile: number): Army[] { return s.armies.filter((a) => a.tile === tile); }
export function armyById(s: GameState, id: number): Army | undefined { return s.armies.find((a) => a.id === id); }
export function cityAt(s: GameState, tile: number): City | undefined { return s.cities.find((c) => c.tile === tile); }
export function ownArmies(s: GameState, f: Owner): Army[] { return s.armies.filter((a) => a.owner === f); }
export function ownCities(s: GameState, f: FactionId): City[] { return s.cities.filter((c) => c.owner === f); }
export function unitCount(s: GameState, f: Owner): number { return ownArmies(s, f).reduce((n, a) => n + a.units.length, 0); }
/** Anchor hexes of all land regions. */
export function landRegions(s: GameState): Tile[] { return s.regions.map((r) => s.tiles[r.anchor]); }
/** Anchor hexes of the regions a side holds. */
export function ownedRegions(s: GameState, f: Owner): Tile[] { return landRegions(s).filter((t) => t.owner === f); }
export function isCoastal(s: GameState, tile: number): boolean {
  const nb = hexNeighbors(s);
  return regionTiles(s, tile).some((id) => nb[id].length < 6 || nb[id].some((n) => s.tiles[n].terrain === 'water'));
}
export function upkeepOf(a: Army): number { return Math.max(0, a.units.length - ARMY_FREE_SIZE); }
export function wallAt(s: GameState, tile: number) { return s.walls.find((w) => w.tile === tile); }
export function emptyStats(): PlayerStats {
  return { income: 0, loot: 0, upkeep: 0, spentUnits: 0, spentBuild: 0, recruited: 0, hired: 0, lost: 0, spells: 0, terraformed: 0, peakUnits: 0, peakCities: 0, peakTiles: 0, fell: 0 };
}

export function fortressAt(s: GameState, tile: number) { return s.fortresses.find((f) => f.tile === tile); }
/** Dwarves are cheaper for the side that found their fortress. */
export function hireCost(s: GameState, fortress: number, f: FactionId): number {
  const fo = fortressAt(s, fortress);
  return fo?.finder === f ? DWARF_COST : DWARF_COST_OTHERS;
}
/** What a city of faction `f` charges for a unit. */
export function recruitCost(f: FactionId, u: UnitType): number { return u === 'siege' ? siegeCost(f) : unitCost(u); }
export function recruitable(f: FactionId): UnitType[] { return [...FACTION_UNITS[f], 'siege']; }
export function tier3Count(s: GameState, f: FactionId): number {
  return ownArmies(s, f).reduce((n, a) => n + a.units.filter((u) => UNIT_STATS[u.type].tier === 3).length, 0);
}
/** Tier-3 units allowed: 2 plus one per city. */
export function tier3Limit(s: GameState, f: FactionId): number { return 2 + ownCities(s, f).length; }
/** Evergarden may grow forest here: not next to a rival city. */
export function canGrowForest(s: GameState, tile: number): boolean {
  return !s.cities.some((c) => c.owner !== 'elves' && regionDist(s, c.tile, tile) <= 1);
}
/** Regions a city of Evergarden may turn into enchanted forest this round. */
export function growTargets(s: GameState, city: number): number[] {
  const c = cityAt(s, city);
  if (!c || c.owner !== 'elves' || c.grew) return [];
  return landRegions(s).map((t) => t.id).filter((t) => !validate(s, { type: 'grow', p: 'elves', city, tile: t }));
}
/** The hidden defender of a city, sized by its level. */
export function garrisonUnit(c: City): Unit {
  const type = FACTION_UNITS[c.owner][garrisonTier(c.level, c.capital) - 1];
  return { id: -1000000 - c.tile, type, hp: UNIT_STATS[type].hp };
}
const fights = (u: Unit) => !UNIT_STATS[u.type].noDice;

/** Cost for an army of `owner` to step onto `tile`, or Infinity if it cannot go there. */
export function stepCost(s: GameState, owner: Owner, tile: number, movingArmy?: number): number {
  const t = s.tiles[tile];
  if (IMPASSABLE(t) || fortressAt(s, tile)) return Infinity;
  if (wallAt(s, tile) && owner !== 'giants') return Infinity;
  const city = cityAt(s, tile);
  if (city && city.owner !== owner) return Infinity;
  const here = armiesAt(s, tile).filter((a) => a.id !== movingArmy);
  if (here.some((a) => a.owner !== owner)) return Infinity;
  const base = t.corrupted ? 1 : TERRAIN_COST[t.terrain];
  return here.length ? Math.max(1, base - 1) : base;
}

export interface Reach { cost: number; prev: number; /** can end the move here */ stop: boolean }

/** Dijkstra over the army's remaining movement points. */
export function reachable(s: GameState, army: Army): Map<number, Reach> {
  const nb = neighbors(s);
  const best = new Map<number, Reach>([[army.tile, { cost: 0, prev: -1, stop: false }]]);
  const open: number[] = [army.tile];
  while (open.length) {
    open.sort((a, b) => best.get(a)!.cost - best.get(b)!.cost);
    const cur = open.shift()!;
    const c = best.get(cur)!.cost;
    for (const n of nb[cur]) {
      const nc = c + stepCost(s, army.owner, n, army.id);
      if (nc > army.mp) continue;
      const prev = best.get(n);
      if (!prev || nc < prev.cost) { best.set(n, { cost: nc, prev: cur, stop: true }); open.push(n); }
    }
  }
  for (const [id, r] of best) if (armiesAt(s, id).filter((a) => a.id !== army.id).length >= 2) r.stop = false;
  return best;
}

export function pathTo(reach: Map<number, Reach>, target: number): number[] {
  const path: number[] = [];
  let cur = target;
  while (reach.has(cur) && reach.get(cur)!.prev !== -1) { path.unshift(cur); cur = reach.get(cur)!.prev; }
  return path;
}

/** Why this army cannot attack that region right now, or null. */
export function attackError(s: GameState, army: Army, target: number): string | null {
  if (army.owner === 'neutral') return 'Neutrals never attack.';
  if (s.pendingFight || s.pendingCity) return 'Finish the current fight first.';
  if (army.attacked) return 'This army already attacked this turn.';
  if (army.mp < 1) return 'Attacking needs 1 movement point.';
  if (!army.units.some(fights)) return 'Siege engines cannot attack on their own.';
  if (!neighbors(s)[army.tile].includes(target)) return 'Target must be next to the army.';
  const city = cityAt(s, target);
  const enemy = armiesAt(s, target).some((a) => a.owner !== army.owner) || (!!city && city.owner !== army.owner) || (army.owner !== 'giants' && !!wallAt(s, target));
  if (!enemy) return 'Nobody to attack there.';
  if (city && city.owner !== army.owner && city.assaults >= CITY_ASSAULTS) return `A city can only be attacked ${CITY_ASSAULTS} times per round.`;
  return null;
}

/** Enemy-held regions this army may attack right now. */
export function attackTargets(s: GameState, army: Army): number[] {
  if (army.mp < 1 || army.attacked || army.owner === 'neutral' || s.pendingFight || s.pendingCity) return [];
  return neighbors(s)[army.tile].filter((n) => !attackError(s, army, n));
}

/** Forests this army may clear (mammoths) or blight (necromancers) instead of attacking. */
export function terraformTargets(s: GameState, army: Army): number[] {
  if (army.mp < 1 || army.attacked || s.pendingFight || s.pendingCity) return [];
  const mammoth = army.owner === 'giants' && army.units.some((u) => u.type === 'mammoth');
  const necro = army.owner === 'necro';
  if (!mammoth && !necro) return [];
  return [army.tile, ...neighbors(s)[army.tile]].filter((t) => {
    const tile = s.tiles[t];
    if (tile.terrain !== 'forest' || cityAt(s, t)) return false;
    return mammoth || !tile.corrupted;
  });
}

export function computeIncome(s: GameState, f: FactionId): Income {
  const own = ownedRegions(s, f).filter((t) => !cityAt(s, t.id));
  const plains = own.filter((t) => t.terrain === 'plains').length;
  const mountains = own.filter((t) => t.terrain === 'mountain').length;
  const forests = own.filter((t) => t.terrain === 'forest').length;
  const cs = ownCities(s, f);
  const coastal = cs.filter((c) => isCoastal(s, c.tile)).length;
  const improvements = own.reduce((n, t) => n + t.improved, 0);
  const enchanted = f === 'elves' ? own.filter((t) => t.enchanted && !t.corrupted).length : 0;
  const upkeep = ownArmies(s, f).reduce((n, a) => n + upkeepOf(a), 0);
  const cityGold = (cs.length - coastal) * 3 + coastal * 4;
  // Evergarden lives from its cities and enchanted forests only.
  if (f === 'elves') return { gold: cityGold + enchanted * ENCHANTED_GOLD, plains: 0, mountains: 0, forests: 0, cities: cs.length, coastal, improvements: 0, enchanted, upkeep };
  const gold = plains + mountains + Math.floor(forests / 2) + cityGold + improvements;
  return { gold, plains, mountains, forests, cities: cs.length, coastal, improvements, enchanted, upkeep };
}

/** Defence bonus for `owner`'s units standing on `tile`. */
export function defenseBonus(s: GameState, tile: Tile, owner: Owner): { total: number; labels: string[] } {
  const labels: string[] = [];
  let total = 0;
  if (tile.terrain === 'mountain') { total += 1; labels.push('Mountain +1'); }
  const city = cityAt(s, anchorOf(s, tile.id));
  if (city && city.owner === owner) {
    const d = city.capital ? CITY_TUNE.capitalDef : CITY_TUNE.cityDef;
    total += d; labels.push(`${city.capital ? 'Capital' : 'City'} +${d}`);
  }
  if (owner === 'elves' && tile.terrain === 'forest' && !tile.corrupted) { total += 1; labels.push('Forest Wardens +1'); }
  if (owner === 'elves' && tile.enchanted && !tile.corrupted) { total += 1; labels.push('Enchanted +1'); }
  return { total, labels };
}

/** Hits land on the weakest unit first: tier 1, siege engines, then tier 2 and 3; fewest HP first. */
const byWeakness = (a: Unit, b: Unit) => hitRank(a.type) - hitRank(b.type) || a.hp - b.hp || a.id - b.id;
const tierOf = (u: Unit) => UNIT_STATS[u.type].tier;

// ------------------------------------------------------------------ setup
export function createGame(setup: GameSetup): { state: GameState; events: GameEvent[] } {
  const map = generateMap(setup);
  hexCache.set(map.radius, map.neighbors);
  const order = new Rng(setup.seed ^ 0x0de5).shuffle(setup.slots.filter((s) => s.kind !== 'off'));
  const players: PlayerState[] = order.map((s) => ({
    faction: s.faction, kind: s.kind === 'ai' ? 'ai' : 'human', controller: s.controller, name: s.name,
    alive: true, gold: START_GOLD, noCity: 0, kills: 0, spell: SPELL_COOLDOWN, stats: emptyStats(),
  }));
  const state: GameState = {
    version: 6, setup, rng: setup.seed, radius: map.radius, tiles: map.tiles, regions: map.regions, armies: map.armies,
    cities: map.cities, builds: [], players, current: 0, phase: 'play', turn: 1, nextId: map.nextId, winner: null,
    actionCount: 0, pendingFight: null, pendingCity: null, fortresses: map.fortresses, walls: [],
  };
  for (const a of state.armies) if (a.owner !== 'neutral') discover(state, a.tile, a.owner, []);
  const events: GameEvent[] = [];
  const rng = new Rng(state.rng);
  startTurn(state, rng, events, true);
  state.rng = rng.state;
  return { state, events };
}

// ------------------------------------------------------------------ validation
export function validate(s: GameState, a: Action): string | null {
  if (s.phase === 'over') return 'The game is over.';
  const p = currentPlayer(s);
  if (a.p !== p.faction) return 'Not your turn.';
  const f = p.faction;
  if (s.pendingFight && a.type !== 'fight') return 'Decide first: fight on or retreat.';
  if (s.pendingCity && a.type !== 'cityChoice') return 'Decide first: take the city or raze it.';
  const myArmy = (id: number) => { const ar = armyById(s, id); return ar && ar.owner === f ? ar : undefined; };
  const isAnchor = (t: number) => s.tiles[t] && s.tiles[t].region >= 0 && s.regions[s.tiles[t].region].anchor === t;
  switch (a.type) {
    case 'move': {
      const ar = myArmy(a.army);
      if (!ar) return 'Pick one of your armies.';
      if (!a.path.length) return 'Pick where to march.';
      const nb = neighbors(s);
      let at = ar.tile;
      let cost = 0;
      for (const t of a.path) {
        if (!nb[at].includes(t)) return 'You can only march to neighbouring regions.';
        const c = stepCost(s, f, t, ar.id);
        if (!isFinite(c)) {
          if (s.tiles[t].terrain === 'peak') return 'High peaks cannot be crossed.';
          return cityAt(s, t) ? 'Attack an enemy city to take it.' : 'That region is blocked.';
        }
        cost += c;
        at = t;
      }
      if (cost > ar.mp) return `Not enough movement (needs ${cost}, has ${ar.mp}).`;
      if (armiesAt(s, at).filter((x) => x.id !== ar.id).length >= 2) return 'At most two armies per region.';
      return null;
    }
    case 'attack': {
      const ar = myArmy(a.army);
      if (!ar) return 'Pick one of your armies.';
      return attackError(s, ar, a.target);
    }
    case 'fight':
      return s.pendingFight ? null : 'There is no fight to continue.';
    case 'cityChoice':
      return s.pendingCity ? null : 'No city to decide on.';
    case 'split':
    case 'dismiss': {
      const ar = myArmy(a.army);
      if (!ar) return 'Pick one of your armies.';
      const ids = new Set(a.units);
      const chosen = ar.units.filter((u) => ids.has(u.id));
      if (!chosen.length || chosen.length !== ids.size) return a.type === 'split' ? 'Choose which units split off.' : 'Choose units to dismiss.';
      if (a.type === 'split') {
        if (armiesAt(s, ar.tile).filter((x) => x.owner === f).length >= 2) return 'There is already a second army here. Merge first.';
        if (chosen.length === ar.units.length) return 'Leave at least one unit behind.';
      }
      return null;
    }
    case 'merge': {
      const here = armiesAt(s, a.tile).filter((x) => x.owner === f);
      return here.length === 2 ? null : 'Merging needs two of your armies in one region.';
    }
    case 'recruit': {
      const c = cityAt(s, a.city);
      if (!c || c.owner !== f) return 'Recruit in one of your cities.';
      if (!recruitable(f).includes(a.unit)) return 'Your faction cannot recruit that.';
      if (p.gold < recruitCost(f, a.unit)) return 'Not enough gold.';
      if (UNIT_STATS[a.unit].tier === 3 && tier3Count(s, f) >= tier3Limit(s, f)) return `Tier-3 limit reached (${tier3Limit(s, f)}: 2 + 1 per city).`;
      if (a.unit === 'treant') {
        if (a.at === undefined) return 'Treants awaken in an enchanted forest. Pick one.';
        const t = s.tiles[a.at];
        if (!t || !isAnchor(a.at) || t.owner !== 'elves' || !t.enchanted || t.corrupted || t.terrain !== 'forest' || cityAt(s, a.at)) return 'Treants awaken only in your enchanted forests.';
        if (armiesAt(s, a.at).some((x) => x.owner !== f)) return 'Enemies stand in that forest.';
        if (armiesAt(s, a.at).length >= 2) return 'Two armies already stand there.';
        return null;
      }
      return null;
    }
    case 'hire': {
      const fo = fortressAt(s, a.fortress);
      if (!fo || !fo.discovered) return 'No dwarf fortress there.';
      if (!DWARF_UNITS.includes(a.unit)) return 'The dwarves do not offer that.';
      const ar = myArmy(a.army);
      if (!ar || !neighbors(s)[a.fortress].includes(ar.tile)) return 'An army must stand next to the fortress.';
      if (p.gold < hireCost(s, a.fortress, f)) return 'Not enough gold.';
      return null;
    }
    case 'terraform': {
      const ar = myArmy(a.army);
      if (!ar) return 'Pick one of your armies.';
      if (ar.attacked) return 'This army already attacked this turn.';
      if (ar.mp < 1) return 'Needs 1 movement point.';
      return terraformTargets(s, ar).includes(a.target) ? null : f === 'necro' ? 'Pick a healthy forest here or next to the army.' : 'Needs a mammoth and a forest here or next to the army.';
    }
    case 'spell': {
      if (p.spell > 0) return `The spell recharges in ${p.spell} turn${p.spell > 1 ? 's' : ''}.`;
      const ar = myArmy(a.army);
      if (f === 'necro') {
        if (!ar || ar.units.filter((u) => u.type === 'skeleton').length < 3) return 'Needs an army with 3 skeletons.';
        if (tier3Count(s, f) >= tier3Limit(s, f)) return `Tier-3 limit reached (${tier3Limit(s, f)}).`;
        return null;
      }
      if (f === 'elves') {
        if (!ar || !ar.units.some((u) => u.type === 'archer')) return 'Needs an army with archers.';
        if (a.target === undefined || !neighbors(s)[ar.tile].includes(a.target) || !armiesAt(s, a.target).some((x) => x.owner !== f)) return 'Pick an enemy army next to the archers.';
        return null;
      }
      if (a.target === undefined) return 'Pick an empty region next to a Giant army.';
      const t = s.tiles[a.target];
      if (!t || !isAnchor(a.target) || IMPASSABLE(t) || cityAt(s, t.id) || fortressAt(s, t.id) || wallAt(s, t.id) || armiesAt(s, t.id).length) return 'Walls need an empty region.';
      if (!ownArmies(s, f).some((x) => neighbors(s)[x.tile].includes(t.id))) return 'Walls rise next to one of your armies.';
      return null;
    }
    case 'build': {
      const ar = myArmy(a.army);
      if (!ar) return 'Pick one of your armies.';
      const t = s.tiles[ar.tile];
      if (t.owner !== f) return 'Build on your own land.';
      if (cityAt(s, t.id) || s.builds.some((b) => b.tile === t.id)) return 'Something is already being built here.';
      if (s.cities.some((c) => regionDist(s, c.tile, t.id) < 2)) return 'Too close to another city (needs a region between).';
      if (s.builds.some((b) => b.kind === 'city' && regionDist(s, b.tile, t.id) < 2)) return 'Too close to another building site.';
      if (p.gold < CITY_COST(f)) return `A city costs ${CITY_COST(f)} gold.`;
      return null;
    }
    case 'upgrade': {
      const c = cityAt(s, a.city);
      if (!c || c.owner !== f) return 'Upgrade one of your cities.';
      if (c.level >= MAX_CITY_LEVEL) return 'This city is fully upgraded.';
      if (s.builds.some((b) => b.tile === c.tile)) return 'Already upgrading.';
      if (p.gold < UPGRADE_COST(f)) return `An upgrade costs ${UPGRADE_COST(f)} gold.`;
      return null;
    }
    case 'improve': {
      const t = s.tiles[a.tile];
      if (f === 'elves') return 'Evergarden does not farm: grow enchanted forests instead.';
      if (!t || !isAnchor(a.tile) || t.owner !== f) return 'Improve your own land.';
      if (cityAt(s, t.id)) return 'Cities grow by upgrading, not by improvements.';
      if (t.improved >= MAX_IMPROVE) return 'This region is fully improved.';
      if (s.builds.some((b) => b.tile === t.id)) return 'Something is already being built here.';
      const cost = IMPROVE_COST[t.improved];
      if (p.gold < cost) return `This improvement costs ${cost} gold.`;
      return null;
    }
    case 'grow': {
      if (f !== 'elves') return 'Only Evergarden grows forests.';
      const c = cityAt(s, a.city);
      if (!c || c.owner !== f) return 'Pick one of your cities.';
      if (c.grew) return 'This city already grew a forest this round.';
      const t = s.tiles[a.tile];
      if (!t || !isAnchor(a.tile) || t.owner !== f) return 'Grow forests on your own land.';
      if (cityAt(s, t.id) || fortressAt(s, t.id)) return 'Not on a city.';
      if (regionDist(s, c.tile, t.id) > GROW_RANGE) return `Within ${GROW_RANGE} regions of the city.`;
      if (t.terrain !== 'plains' && t.terrain !== 'desert' && t.terrain !== 'forest') return 'Forests grow on plains, desert or forest.';
      if (t.terrain === 'forest' && t.enchanted && !t.corrupted) return 'Already an enchanted forest.';
      if (!canGrowForest(s, t.id)) return 'Too close to a rival city.';
      if (armiesAt(s, t.id).some((x) => x.owner !== f)) return 'Enemies stand there.';
      return null;
    }
    case 'endTurn':
      return null;
  }
}

// ------------------------------------------------------------------ apply
export function applyAction(prev: GameState, a: Action): { state: GameState; events: GameEvent[]; error?: string } {
  const err = validate(prev, a);
  if (err) return { state: prev, events: [], error: err };
  const s: GameState = structuredClone(prev);
  s.actionCount++;
  const events: GameEvent[] = [];
  const p = currentPlayer(s);
  const f = p.faction;
  const rng = new Rng(s.rng);
  const gold0 = p.gold;

  switch (a.type) {
    case 'move': {
      const ar = armyById(s, a.army)!;
      const captured: number[] = [];
      for (const t of a.path) {
        ar.mp -= stepCost(s, f, t, ar.id);
        ar.tile = t;
        claim(s, t, f, captured, events);
        discover(s, t, f, events);
      }
      events.push({ type: 'moved', p: f, army: ar.id, path: a.path, captured });
      break;
    }
    case 'attack': {
      const ar = armyById(s, a.army)!;
      ar.mp -= 1;
      ar.attacked = true;
      const priests = ar.owner === 'necro' ? ar.units.filter((u) => u.type === 'priest').length : 0;
      const defPriests = armiesAt(s, a.target).filter((x) => x.owner === 'necro').flatMap((x) => x.units).filter((u) => u.type === 'priest').length;
      const city = cityAt(s, a.target);
      const enemyCity = city && city.owner !== f ? city : undefined;
      if (enemyCity) enemyCity.assaults++;
      s.pendingFight = {
        army: ar.id, target: a.target, round: 0, skelDeaths: 0, otherDeaths: 0, necroPriests: priests + defPriests,
        garrison: enemyCity ? garrisonUnit(enemyCity) : null,
      };
      fightRound(s, rng, events);
      break;
    }
    case 'fight': {
      const pf = s.pendingFight!;
      if (a.choice === 'continue') fightRound(s, rng, events);
      else {
        events.push({ type: 'retreat', p: f, army: pf.army, target: pf.target });
        endFight(s, rng, events);
      }
      break;
    }
    case 'cityChoice': {
      const pc = s.pendingCity!;
      s.pendingCity = null;
      const ar = armyById(s, pc.army);
      // The city may already be gone with its fallen faction: just claim the ground.
      const c = cityAt(s, pc.city) ?? { tile: pc.city, owner: f, level: 1, capital: false, assaults: 0, grew: false };
      const from = c.owner;
      if (!cityAt(s, pc.city)) {
        claim(s, pc.city, f, [], events);
      } else if (a.choice === 'take') {
        c.owner = f;
        c.capital = false;
        c.grew = false;
        setRegion(s, c.tile, { owner: f, improved: 0, enchanted: f === 'elves' ? s.tiles[c.tile].enchanted : false });
        events.push({ type: 'cityCaptured', p: f, city: c.tile, from });
      } else {
        const gold = RAZE_GOLD * Math.max(1, c.level);
        s.cities = s.cities.filter((x) => x !== c);
        p.gold += gold;
        p.stats.loot += gold;
        setRegion(s, c.tile, { owner: f, improved: 0 });
        events.push({ type: 'cityRazed', p: f, city: c.tile, from, gold });
      }
      s.builds = s.builds.filter((b) => b.tile !== c.tile);
      // The victorious army marches in.
      if (ar && armiesAt(s, c.tile).length < 2) {
        const path = [c.tile];
        ar.tile = c.tile;
        ar.mp = 0;
        discover(s, c.tile, f, events);
        events.push({ type: 'moved', p: f, army: ar.id, path, captured: [] });
      }
      checkElimination(s, events);
      break;
    }
    case 'split': {
      const ar = armyById(s, a.army)!;
      const ids = new Set(a.units);
      const moving = ar.units.filter((u) => ids.has(u.id));
      ar.units = ar.units.filter((u) => !ids.has(u.id));
      const na: Army = { id: s.nextId++, owner: f, tile: ar.tile, units: moving, mp: ar.mp, attacked: ar.attacked, lowMorale: ar.lowMorale };
      s.armies.push(na);
      events.push({ type: 'split', p: f, army: ar.id, newArmy: na.id, tile: ar.tile });
      break;
    }
    case 'dismiss': {
      const ar = armyById(s, a.army)!;
      const ids = new Set(a.units);
      const gone = ar.units.filter((u) => ids.has(u.id));
      const gold = gone.reduce((n, u) => n + refund(u.type), 0);
      ar.units = ar.units.filter((u) => !ids.has(u.id));
      p.gold += gold;
      s.armies = s.armies.filter((x) => x.units.length > 0);
      events.push({ type: 'dismissed', p: f, army: ar.id, units: gone.length, refund: gold });
      checkElimination(s, events);
      break;
    }
    case 'merge': {
      const [x, y] = armiesAt(s, a.tile).filter((ar) => ar.owner === f);
      x.units.push(...y.units);
      x.mp = Math.min(x.mp, y.mp);
      x.attacked = x.attacked || y.attacked;
      x.lowMorale = x.lowMorale || y.lowMorale;
      s.armies = s.armies.filter((ar) => ar.id !== y.id);
      events.push({ type: 'merged', p: f, army: x.id, tile: a.tile });
      break;
    }
    case 'recruit': {
      p.gold -= recruitCost(f, a.unit);
      const at = a.unit === 'treant' ? a.at! : a.city;
      let ar = armiesAt(s, at).find((x) => x.owner === f);
      if (!ar) {
        ar = { id: s.nextId++, owner: f, tile: at, units: [], mp: MOVE_POINTS, attacked: false, lowMorale: false };
        s.armies.push(ar);
      }
      ar.units.push({ id: s.nextId++, type: a.unit, hp: UNIT_STATS[a.unit].hp });
      if (a.unit === 'treant') setRegion(s, at, { terrain: 'plains', enchanted: false });
      events.push({ type: 'recruited', p: f, city: at, unit: a.unit, army: ar.id });
      break;
    }
    case 'hire': {
      p.gold -= hireCost(s, a.fortress, f);
      const ar = armyById(s, a.army)!;
      ar.units.push({ id: s.nextId++, type: a.unit, hp: UNIT_STATS[a.unit].hp });
      events.push({ type: 'hired', p: f, fortress: a.fortress, unit: a.unit, army: ar.id });
      break;
    }
    case 'terraform': {
      const ar = armyById(s, a.army)!;
      ar.mp -= 1;
      ar.attacked = true;
      if (f === 'necro') { setRegion(s, a.target, { corrupted: true, enchanted: false }); events.push({ type: 'terraformed', p: f, tile: a.target, to: 'corrupted' }); }
      else { setRegion(s, a.target, { terrain: 'plains', corrupted: false, enchanted: false }); events.push({ type: 'terraformed', p: f, tile: a.target, to: 'plains' }); }
      break;
    }
    case 'spell': {
      p.spell = SPELL_COOLDOWN;
      const ar = a.army >= 0 ? armyById(s, a.army) : undefined;
      if (f === 'necro' && ar) {
        const bones = ar.units.filter((u) => u.type === 'skeleton').sort((x, y) => x.hp - y.hp).slice(0, 3).map((u) => u.id);
        ar.units = ar.units.filter((u) => !bones.includes(u.id));
        ar.units.push({ id: s.nextId++, type: 'colossus', hp: UNIT_STATS.colossus.hp });
        events.push({ type: 'spellCast', p: f, spell: 'colossus', army: ar.id, tile: ar.tile });
      } else if (f === 'elves' && ar) {
        events.push({ type: 'spellCast', p: f, spell: 'volley', army: ar.id, tile: a.target! });
        volley(s, rng, ar, a.target!, events);
      } else {
        s.walls.push({ tile: a.target!, hp: wallHp(s.turn) });
        events.push({ type: 'spellCast', p: f, spell: 'wall', army: -1, tile: a.target! });
      }
      break;
    }
    case 'build': {
      const ar = armyById(s, a.army)!;
      p.gold -= CITY_COST(f);
      s.builds.push({ tile: ar.tile, owner: f, kind: 'city', turnsLeft: 2 });
      events.push({ type: 'buildStarted', p: f, tile: ar.tile, kind: 'city' });
      break;
    }
    case 'upgrade': {
      p.gold -= UPGRADE_COST(f);
      s.builds.push({ tile: a.city, owner: f, kind: 'upgrade', turnsLeft: 1 });
      events.push({ type: 'buildStarted', p: f, tile: a.city, kind: 'upgrade' });
      break;
    }
    case 'improve': {
      const t = s.tiles[a.tile];
      p.gold -= IMPROVE_COST[t.improved];
      s.builds.push({ tile: a.tile, owner: f, kind: 'improve', turnsLeft: 1 });
      events.push({ type: 'buildStarted', p: f, tile: a.tile, kind: 'improve' });
      break;
    }
    case 'grow': {
      cityAt(s, a.city)!.grew = true;
      setRegion(s, a.tile, { terrain: 'forest', enchanted: true, corrupted: false, improved: 0 });
      s.builds = s.builds.filter((b) => !(b.tile === a.tile && b.kind === 'improve'));
      events.push({ type: 'grown', p: f, tile: a.tile, city: a.city });
      break;
    }
    case 'endTurn': {
      advance(s, rng, events);
      break;
    }
  }
  s.rng = rng.state;
  tally(s, p, a, gold0);
  return { state: s, events };
}

/** Keep the running totals shown in the end-of-game report. */
function tally(s: GameState, p: PlayerState, a: Action, gold0: number) {
  const st = p.stats;
  const spent = Math.max(0, gold0 - p.gold);
  if (a.type === 'recruit') { st.recruited++; st.spentUnits += spent; }
  else if (a.type === 'hire') { st.hired++; st.spentUnits += spent; }
  else if (a.type === 'build' || a.type === 'upgrade' || a.type === 'improve') st.spentBuild += spent;
  else if (a.type === 'spell') st.spells++;
  else if (a.type === 'terraform' || a.type === 'grow') st.terraformed++;
  for (const pl of s.players) {
    if (!pl.alive) continue;
    const ps = pl.stats;
    ps.peakUnits = Math.max(ps.peakUnits, unitCount(s, pl.faction));
    ps.peakCities = Math.max(ps.peakCities, ownCities(s, pl.faction).length);
    ps.peakTiles = Math.max(ps.peakTiles, ownedRegions(s, pl.faction).length);
  }
}

/** An army enters a region: it now belongs to that side. */
function claim(s: GameState, tile: number, f: FactionId, captured: number[], events: GameEvent[]) {
  const t = s.tiles[tile];
  if (t.owner === f) return;
  if (t.owner !== null) captured.push(tile);
  // Taking another player's improved land destroys the improvement and loots it.
  if (t.improved && t.owner && t.owner !== 'neutral') {
    const gold = t.improved;
    player(s, f)!.gold += gold;
    player(s, f)!.stats.loot += gold;
    events.push({ type: 'pillaged', p: f, tile, gold });
    setRegion(s, tile, { improved: 0 });
  }
  setRegion(s, tile, { owner: f });
  if (t.enchanted && f !== 'elves') setRegion(s, tile, { enchanted: false });
  s.builds = s.builds.filter((b) => !(b.tile === tile && b.owner !== f));
}

/** Dwarf fortresses next to `tile` become known to everyone. */
function discover(s: GameState, tile: number, f: Owner, events: GameEvent[]) {
  for (const fo of s.fortresses) {
    if (fo.discovered || !neighbors(s)[tile].includes(fo.tile)) continue;
    fo.discovered = true;
    if (f !== 'neutral' && f !== null) fo.finder = f as FactionId;
    events.push({ type: 'discovered', p: f as FactionId, tile: fo.tile });
  }
}

// ------------------------------------------------------------------ combat
function rollSide(rng: Rng, units: Unit[], side: 'att' | 'def', bonus: number, foe: Owner): CombatDie[] {
  return units.filter(fights).map((u) => {
    const st = UNIT_STATS[u.type];
    const roll = 1 + rng.int(6);
    const b = (side === 'att' ? st.attack : st.defense) + bonus + (st.counters && st.counters === foe ? 2 : 0);
    return { unit: u.id, type: u.type, roll, bonus: b, total: roll + b };
  });
}

function wound(units: Unit[], dead: Set<number>): number {
  const alive = units.filter((u) => !dead.has(u.id) && u.hp > 0).sort(byWeakness);
  const v = alive[0];
  if (!v) return -1;
  v.hp -= 1;
  if (v.hp <= 0) dead.add(v.id);
  return v.id;
}

/** One exchange of the pending fight. Fights go on until a side is gone or the attacker retreats. */
function fightRound(s: GameState, rng: Rng, events: GameEvent[]) {
  const pf = s.pendingFight!;
  pf.round++;
  const att = armyById(s, pf.army)!;
  const target = pf.target;
  const defArmies = armiesAt(s, target).filter((a) => a.owner !== att.owner);
  const city = cityAt(s, target);
  const garrison = pf.garrison && pf.garrison.hp > 0 ? pf.garrison : null;
  const wall = !defArmies.length && !garrison ? wallAt(s, target) : undefined;
  const defOwner: Owner = wall ? 'giants' : defArmies[0]?.owner ?? city!.owner;
  const tile = s.tiles[target];
  const attUnits = att.units;
  const wallUnit: Unit | undefined = wall ? { id: -1 - target, type: 'wall', hp: wall.hp } : undefined;
  const defUnits = wallUnit ? [wallUnit] : [...defArmies.flatMap((a) => a.units), ...(garrison ? [garrison] : [])];
  const snapshot = (us: Unit[]) => us.map((u) => ({ ...u }));
  const db = wall ? { total: 0, labels: [] as string[] } : defenseBonus(s, tile, defOwner);
  if (attUnits.some((u) => u.type === 'siege')) { db.total -= 1; db.labels.push('Siege engine −1'); }
  const defMorale = defArmies.some((a) => a.lowMorale) ? -1 : 0;
  const attMorale = att.lowMorale ? -1 : 0;
  const ev: CombatEvent = {
    type: 'combat', p: att.owner as FactionId,
    attacker: { army: att.id, tile: att.tile, owner: att.owner, units: snapshot(attUnits) },
    defender: { armies: defArmies.map((a) => a.id), tile: target, owner: defOwner, units: snapshot(defUnits) },
    attDice: [], defDice: [], shots: [], pairs: [], dead: [], raise: null, defenderWiped: false, attackerWiped: false,
    terrainBonus: [...db.labels, ...(defMorale ? ['Low morale −1'] : [])], attackMods: attMorale ? ['Low morale −1'] : [],
    round: pf.round, final: false, bounty: { att: 0, def: 0 }, wall: !!wall, garrison: garrison?.id,
  };
  ev.attDice = rollSide(rng, attUnits, 'att', attMorale, defOwner);
  ev.defDice = rollSide(rng, defUnits, 'def', db.total + defMorale, att.owner);
  const dead = new Set<number>();

  // Lead Belchers: a natural 6 fires an extra shot before the exchange.
  for (const [side, dice, foes] of [['att', ev.attDice, defUnits], ['def', ev.defDice, attUnits]] as const) {
    for (const d of dice) {
      if (d.type !== 'belcher' || d.roll !== 6) continue;
      const shot: CannonShot = { side, shooter: d.unit, rolls: [], hits: [] };
      for (let guard = 0; guard < 6; guard++) {
        const r = 1 + rng.int(6);
        shot.rolls.push(r);
        if (r >= 4) { const v = wound(foes, dead); if (v >= 0) shot.hits.push(v); }
        if (r !== 6) break;
      }
      ev.shots.push(shot);
    }
  }
  for (const d of [...ev.attDice, ...ev.defDice]) if (dead.has(d.unit)) d.void = true;

  // Best against best; spare dice are lost. A side without dice is hit by every enemy die.
  const A = ev.attDice.filter((d) => !d.void).sort((x, y) => y.total - x.total);
  const D = ev.defDice.filter((d) => !d.void).sort((x, y) => y.total - x.total);
  if (!D.length) {
    for (const a of A) ev.pairs.push({ att: a.unit, def: -1, winner: 'att', victim: wound(defUnits, dead) });
  } else if (!A.length) {
    if (!wall) for (const d of D) ev.pairs.push({ att: -1, def: d.unit, winner: 'def', victim: wound(attUnits, dead) });
  } else {
    const n = Math.min(A.length, D.length);
    for (let i = 0; i < n; i++) {
      const attWins = A[i].total > D[i].total;
      // A wall never strikes back.
      const victim = attWins ? wound(defUnits, dead) : wall ? -1 : wound(attUnits, dead);
      ev.pairs.push({ att: A[i].unit, def: D[i].unit, winner: attWins ? 'att' : 'def', victim });
    }
  }
  ev.dead = [...dead];
  if (wall && wallUnit) {
    wall.hp = wallUnit.hp;
    att.mp = 0;
    if (wall.hp <= 0) {
      s.walls = s.walls.filter((w) => w !== wall);
      events.push({ type: 'wallFallen', p: att.owner as FactionId, tile: target });
    }
  }

  // Remove the fallen, pay bounties.
  for (const ar of [att, ...defArmies]) ar.units = ar.units.filter((u) => !dead.has(u.id));
  const killedDef = defUnits.filter((u) => dead.has(u.id) && u.type !== 'wall');
  const killedAtt = attUnits.filter((u) => dead.has(u.id));
  ev.bounty = { att: killedDef.reduce((g, u) => g + bounty(u.type), 0), def: killedAtt.reduce((g, u) => g + bounty(u.type), 0) };
  const pa = att.owner !== 'neutral' ? player(s, att.owner) : undefined;
  const pd = defOwner !== 'neutral' ? player(s, defOwner) : undefined;
  if (pa) { pa.kills += killedDef.length; pa.gold += ev.bounty.att; pa.stats.loot += ev.bounty.att; pa.stats.lost += killedAtt.length; }
  if (pd) { pd.kills += killedAtt.length; pd.gold += ev.bounty.def; pd.stats.loot += ev.bounty.def; pd.stats.lost += killedDef.filter((u) => u.id >= 0).length; }
  for (const u of [...killedDef, ...killedAtt]) { if (u.type === 'skeleton') pf.skelDeaths++; else pf.otherDeaths++; }

  ev.defenderWiped = wall ? wall.hp <= 0 : !defArmies.some((a) => a.units.length) && !(pf.garrison && pf.garrison.hp > 0);
  ev.attackerWiped = att.units.length === 0;
  ev.final = ev.defenderWiped || ev.attackerWiped;
  events.push(ev);
  if (ev.final) endFight(s, rng, events);
}

/** Arrow Rain: the archers shoot, the target cannot hurt them. */
function volley(s: GameState, rng: Rng, ar: Army, target: number, events: GameEvent[]) {
  const archers = ar.units.filter((u) => u.type === 'archer');
  const defArmies = armiesAt(s, target).filter((a) => a.owner !== ar.owner);
  const defOwner = defArmies[0].owner;
  const defUnits = defArmies.flatMap((a) => a.units);
  const db = defenseBonus(s, s.tiles[target], defOwner);
  const ev: CombatEvent = {
    type: 'combat', p: ar.owner as FactionId,
    attacker: { army: ar.id, tile: ar.tile, owner: ar.owner, units: archers.map((u) => ({ ...u })) },
    defender: { armies: defArmies.map((a) => a.id), tile: target, owner: defOwner, units: defUnits.map((u) => ({ ...u })) },
    attDice: rollSide(rng, archers, 'att', 0, defOwner), defDice: rollSide(rng, defUnits, 'def', db.total, ar.owner),
    shots: [], pairs: [], dead: [], raise: null, defenderWiped: false, attackerWiped: false, terrainBonus: db.labels,
    attackMods: ['Arrow Rain'], round: 1, final: true, bounty: { att: 0, def: 0 }, volley: true,
  };
  const dead = new Set<number>();
  const A = [...ev.attDice].sort((x, y) => y.total - x.total);
  const D = [...ev.defDice].sort((x, y) => y.total - x.total);
  if (!D.length) for (const a of A) ev.pairs.push({ att: a.unit, def: -1, winner: 'att', victim: wound(defUnits, dead) });
  for (let i = 0; i < Math.min(A.length, D.length); i++) {
    const hit = A[i].total > D[i].total;
    ev.pairs.push({ att: A[i].unit, def: D[i].unit, winner: hit ? 'att' : 'def', victim: hit ? wound(defUnits, dead) : -1 });
  }
  ev.dead = [...dead];
  for (const d of defArmies) d.units = d.units.filter((u) => !dead.has(u.id));
  const killed = defUnits.filter((u) => dead.has(u.id));
  ev.bounty.att = killed.reduce((g, u) => g + bounty(u.type), 0);
  const pa = player(s, ar.owner as FactionId)!;
  pa.gold += ev.bounty.att;
  pa.stats.loot += ev.bounty.att;
  pa.kills += killed.length;
  const pv = defArmies[0] && defArmies[0].owner !== 'neutral' ? player(s, defArmies[0].owner) : undefined;
  if (pv) pv.stats.lost += killed.length;
  s.armies = s.armies.filter((x) => x.units.length > 0);
  ev.defenderWiped = !defArmies.some((a) => a.units.length);
  events.push(ev);
  checkElimination(s, events);
}

/** Units that count for raising: two fallen skeletons count as one. */
export function raiseDeaths(skel: number, other: number): number { return other + Math.floor(skel / 2); }

/** After the last round: the dead may rise, empty armies vanish, a fallen city awaits its fate. */
function endFight(s: GameState, rng: Rng, events: GameEvent[]) {
  const pf = s.pendingFight!;
  s.pendingFight = null;
  const att = armyById(s, pf.army)!;
  const defArmies = armiesAt(s, pf.target).filter((a) => a.owner !== att.owner);
  const deaths = raiseDeaths(pf.skelDeaths, pf.otherDeaths);
  const sides: [Army[], number][] = [[[att], att.tile], [defArmies, pf.target]];
  for (const [armies, tile] of sides) {
    // A wiped-out side has no one left to raise the dead.
    if (!armies.some((x) => x.units.length) || armies[0].owner !== 'necro' || deaths === 0) continue;
    const extra = pf.necroPriests * Math.min(RAISE.priestRolls, deaths);
    const rolls: number[] = [];
    for (let i = 0; i < deaths + extra; i++) rolls.push(1 + rng.int(6));
    const raised = Math.min(deaths, rolls.filter((r) => r >= RAISE.on).length);
    const home = armies.find((x) => x.units.length) ?? armies[0];
    for (let i = 0; i < raised; i++) home.units.push({ id: s.nextId++, type: 'skeleton', hp: 1 });
    const raise: RaiseResult = { rolls, priestRolls: extra, raised, army: home.id };
    events.push({ type: 'raised', p: 'necro', raise, tile });
  }
  s.armies = s.armies.filter((ar) => ar.units.length > 0);
  const city = cityAt(s, pf.target);
  const fallen = city && city.owner !== att.owner && att.units.length > 0 &&
    !armiesAt(s, pf.target).some((a) => a.owner !== att.owner) && !(pf.garrison && pf.garrison.hp > 0);
  if (fallen) {
    s.pendingCity = { army: att.id, city: city.tile };
    events.push({ type: 'cityFallen', p: att.owner as FactionId, city: city.tile, from: city.owner });
  }
  checkElimination(s, events);
}

// ------------------------------------------------------------------ turns
function advance(s: GameState, rng: Rng, events: GameEvent[]) {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (s.current + i) % n;
    if (s.players[idx].alive) {
      if (idx <= s.current) s.turn++;
      s.current = idx;
      break;
    }
  }
  startTurn(s, rng, events, false);
  if (s.phase !== 'over' && !currentPlayer(s).alive) advance(s, rng, events);
}

function startTurn(s: GameState, _rng: Rng, events: GameEvent[], first: boolean) {
  const p = currentPlayer(s);
  const f = p.faction;
  const nb = neighbors(s);
  for (const ar of ownArmies(s, f)) { ar.mp = MOVE_POINTS; ar.attacked = false; }
  if (!first && p.spell > 0) p.spell--;
  for (const c of s.cities) { c.assaults = 0; if (c.owner === f) c.grew = false; }

  // Construction.
  for (const b of s.builds.filter((x) => x.owner === f)) {
    b.turnsLeft--;
    if (b.turnsLeft > 0) continue;
    if (b.kind === 'city') {
      if (s.tiles[b.tile].owner === f && !cityAt(s, b.tile)) {
        s.cities.push({ tile: b.tile, owner: f, level: 1, capital: false, assaults: 0, grew: false });
        setRegion(s, b.tile, { improved: 0 });
        events.push({ type: 'built', p: f, tile: b.tile, kind: 'city', level: 1 });
      }
    } else if (b.kind === 'upgrade') {
      const c = cityAt(s, b.tile);
      if (c && c.owner === f) { c.level++; events.push({ type: 'built', p: f, tile: b.tile, kind: 'upgrade', level: c.level }); }
    } else {
      const t = s.tiles[b.tile];
      if (t.owner === f && !cityAt(s, b.tile)) { setRegion(s, b.tile, { improved: Math.min(MAX_IMPROVE, t.improved + 1) }); events.push({ type: 'built', p: f, tile: b.tile, kind: 'improve', level: s.tiles[b.tile].improved }); }
    }
  }
  s.builds = s.builds.filter((b) => b.turnsLeft > 0);

  // Healing: in or next to an own city, mammoth milk and druid herbs.
  const healed: { army: number; unit: number; by: 'city' | 'mammoth' | 'druid' }[] = [];
  const myCities = ownCities(s, f);
  for (const ar of ownArmies(s, f)) {
    const nearCity = myCities.some((c) => c.tile === ar.tile || nb[c.tile].includes(ar.tile));
    if (nearCity) for (const u of ar.units) if (u.hp < UNIT_STATS[u.type].hp) { u.hp++; healed.push({ army: ar.id, unit: u.id, by: 'city' }); }
    for (const healer of ['mammoth', 'druid'] as const) {
      const n = ar.units.filter((u) => u.type === healer).length;
      for (let i = 0; i < n; i++) {
        const w = ar.units
          .filter((u) => (healer === 'druid' || u.type !== 'mammoth') && u.hp < UNIT_STATS[u.type].hp)
          .sort((a, b) => tierOf(b) - tierOf(a) || a.hp - b.hp)[0];
        if (!w) break;
        w.hp++;
        healed.push({ army: ar.id, unit: w.id, by: healer });
      }
    }
  }
  if (healed.length) events.push({ type: 'healed', p: f, units: healed });

  // Income, then upkeep for oversized armies (units above 8 cost 1 gold each).
  const income = computeIncome(s, f);
  if (!first) {
    p.gold += income.gold;
    p.stats.income += income.gold;
    let paid = 0;
    let unpaid = 0;
    const broke: number[] = [];
    for (const ar of ownArmies(s, f)) {
      const cost = upkeepOf(ar);
      if (!cost) { ar.lowMorale = false; continue; }
      if (p.gold >= cost) { p.gold -= cost; paid += cost; ar.lowMorale = false; }
      else { unpaid += cost - p.gold; paid += p.gold; p.gold = 0; ar.lowMorale = true; broke.push(ar.id); }
    }
    p.stats.upkeep += paid;
    if (paid || unpaid) events.push({ type: 'upkeep', p: f, paid, unpaid, armies: broke });
  }

  // Without a city for too long?
  if (ownCities(s, f).length) p.noCity = 0;
  else {
    p.noCity++;
    if (p.noCity > NO_CITY_LIMIT || (!ownArmies(s, f).length && !canRegainCity(s, f))) eliminate(s, f, 'cities', events);
  }
  if (p.alive) events.push({ type: 'turn', p: f, turn: s.turn, income });
  checkElimination(s, events);
}

/** Can a faction without cities still get one before its time runs out? */
export function canRegainCity(s: GameState, f: FactionId): boolean {
  const p = player(s, f)!;
  const left = NO_CITY_LIMIT + 1 - p.noCity; // turn starts left, including the deadline
  if (s.builds.some((b) => b.owner === f && b.kind === 'city' && b.turnsLeft - 1 <= left)) return true;
  // An army next to a rival city can still storm it.
  if (ownArmies(s, f).some((a) => s.cities.some((c) => c.owner !== f && neighbors(s)[c.tile].includes(a.tile)))) return true;
  if (left >= 2 && p.gold >= CITY_COST(f)) {
    const spot = ownArmies(s, f).some((a) => s.tiles[a.tile].owner === f && !s.cities.some((c) => regionDist(s, c.tile, a.tile) < 2));
    if (spot) return true;
  }
  return false;
}

function eliminate(s: GameState, f: FactionId, reason: 'units' | 'cities', events: GameEvent[]) {
  const p = player(s, f)!;
  if (!p.alive) return;
  p.alive = false;
  p.stats.fell = s.turn;
  s.armies = s.armies.filter((a) => a.owner !== f);
  s.cities = s.cities.filter((c) => c.owner !== f);
  s.builds = s.builds.filter((b) => b.owner !== f);
  events.push({ type: 'eliminated', p: f, reason });
}

function checkElimination(s: GameState, events: GameEvent[]) {
  for (const p of s.players) {
    if (!p.alive) continue;
    const units = unitCount(s, p.faction);
    const canRecruit = ownCities(s, p.faction).length > 0 && p.gold >= baseCost(p.faction);
    if (units === 0 && !canRecruit) eliminate(s, p.faction, 'units', events);
  }
  const alive = s.players.filter((p) => p.alive);
  if (alive.length <= 1 && s.phase !== 'over') {
    s.phase = 'over';
    s.winner = alive[0]?.faction ?? null;
    s.pendingFight = null;
    s.pendingCity = null;
    if (s.winner) events.push({ type: 'victory', p: s.winner });
  }
}

export function armyStrength(units: Unit[], side: 'att' | 'def', bonus = 0): number {
  return units.reduce((n, u) => {
    const st = UNIT_STATS[u.type];
    return n + (3.5 + (side === 'att' ? st.attack : st.defense) + bonus) * (0.6 + 0.4 * u.hp);
  }, 0);
}

export function unitLabel(t: UnitType) { return UNIT_STATS[t].name; }
export const FACTION_NAME = (f: Owner) => (f === 'neutral' ? 'Wildlands' : FACTIONS[f].short);
