import { FACTIONS } from './factions';
import { hexDistance } from './hex';
import { buildNeighbors, generateMap } from './mapgen';
import { Rng } from './rng';
import type {
  Action, Army, CannonShot, City, CombatDie, CombatEvent, CombatPair, FactionId, GameEvent, GameSetup, GameState,
  Income, Owner, PlayerState, Tile, Unit,
} from './types';
import {
  CITY_COST, FACTION_UNITS, MAX_CITY_LEVEL, MOVE_POINTS, NO_CITY_LIMIT, SIEGE_ROUNDS, UNIT_STATS, UPGRADE_COST, baseCost, unitCost,
  type UnitType,
} from './unitstats';

// ------------------------------------------------------------------ helpers
const nbCache = new Map<number, number[][]>();
export function neighbors(state: GameState): number[][] {
  let nb = nbCache.get(state.radius);
  if (!nb) { nb = buildNeighbors(state.tiles); nbCache.set(state.radius, nb); }
  return nb;
}

export const TERRAIN_COST: Record<string, number> = { plains: 1, desert: 1, forest: 2, mountain: 3, water: 99 };
export const TERRAIN_DEFENSE: Record<string, number> = { plains: 0, desert: 0, forest: 1, mountain: 2, water: 0 };

export function currentPlayer(s: GameState): PlayerState { return s.players[s.current]; }
export function player(s: GameState, f: FactionId): PlayerState | undefined { return s.players.find((p) => p.faction === f); }
export function armiesAt(s: GameState, tile: number): Army[] { return s.armies.filter((a) => a.tile === tile); }
export function armyById(s: GameState, id: number): Army | undefined { return s.armies.find((a) => a.id === id); }
export function cityAt(s: GameState, tile: number): City | undefined { return s.cities.find((c) => c.tile === tile); }
export function buildAt(s: GameState, tile: number): { city?: City; build?: GameState['builds'][0] } { return { build: s.builds.find((b) => b.tile === tile) }; }
export function ownArmies(s: GameState, f: Owner): Army[] { return s.armies.filter((a) => a.owner === f); }
export function ownCities(s: GameState, f: FactionId): City[] { return s.cities.filter((c) => c.owner === f); }
export function unitCount(s: GameState, f: Owner): number { return ownArmies(s, f).reduce((n, a) => n + a.units.length, 0); }
export function hostile(a: Owner, b: Owner): boolean { return a !== b; }
export function landTiles(s: GameState): Tile[] { return s.tiles.filter((t) => t.terrain !== 'water'); }
export function ownedTiles(s: GameState, f: Owner): Tile[] { return s.tiles.filter((t) => t.owner === f); }

/** Cost for an army of `owner` to step onto `tile`, or Infinity if it cannot stop or pass there. */
export function stepCost(s: GameState, owner: Owner, tile: number, movingArmy?: number): number {
  const t = s.tiles[tile];
  if (t.terrain === 'water' || cityAt(s, tile)) return Infinity;
  const here = armiesAt(s, tile).filter((a) => a.id !== movingArmy);
  if (here.some((a) => a.owner !== owner)) return Infinity;
  const base = TERRAIN_COST[t.terrain];
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
      const step = stepCost(s, army.owner, n, army.id);
      const nc = c + step;
      if (nc > army.mp) continue;
      const prev = best.get(n);
      if (!prev || nc < prev.cost) { best.set(n, { cost: nc, prev: cur, stop: true }); open.push(n); }
    }
  }
  // Cannot end on a tile that already holds two own armies (passing through is fine).
  for (const [id, r] of best) if (armiesAt(s, id).filter((a) => a.id !== army.id).length >= 2) r.stop = false;
  return best;
}

export function pathTo(reach: Map<number, Reach>, target: number): number[] {
  const path: number[] = [];
  let cur = target;
  while (reach.has(cur) && reach.get(cur)!.prev !== -1) { path.unshift(cur); cur = reach.get(cur)!.prev; }
  return path;
}

/** Enemy-held tiles this army may attack right now. */
export function attackTargets(s: GameState, army: Army): number[] {
  if (army.mp < 1 || army.attacked || army.owner === 'neutral') return [];
  return neighbors(s)[army.tile].filter((n) => armiesAt(s, n).some((a) => a.owner !== army.owner));
}

export function computeIncome(s: GameState, f: FactionId): Income {
  const tiles = ownedTiles(s, f).filter((t) => t.terrain === 'plains').length;
  const cities = ownCities(s, f).length;
  const enchanted = f === 'elves' ? s.tiles.filter((t) => t.enchanted && t.owner === 'elves').length : 0;
  return { tiles, cities, enchanted, gold: tiles + cities * 2 + Math.floor(enchanted / 3) };
}

export function defenseBonus(s: GameState, tile: Tile, owner: Owner): { total: number; labels: string[] } {
  const labels: string[] = [];
  let total = TERRAIN_DEFENSE[tile.terrain];
  if (tile.terrain === 'mountain') labels.push('Mountain +2');
  if (tile.terrain === 'forest') labels.push('Forest +1');
  if (owner === 'elves' && tile.terrain === 'forest') { total += 1; labels.push('Forest Wardens +1'); }
  if (owner === 'elves' && tile.enchanted) { total += 1; labels.push('Enchanted +1'); }
  return { total, labels };
}

const tierOf = (u: Unit) => UNIT_STATS[u.type].tier;
/** Weakest unit first: lowest tier, then fewest HP. Hits are dealt in this order. */
const byWeakness = (a: Unit, b: Unit) => tierOf(a) - tierOf(b) || a.hp - b.hp || a.id - b.id;

// ------------------------------------------------------------------ setup
export function createGame(setup: GameSetup): { state: GameState; events: GameEvent[] } {
  const map = generateMap(setup);
  nbCache.set(map.radius, map.neighbors);
  const order = new Rng(setup.seed ^ 0x0de5).shuffle(setup.slots.filter((s) => s.kind !== 'off'));
  const players: PlayerState[] = order.map((s) => ({
    faction: s.faction, kind: s.kind === 'ai' ? 'ai' : 'human', controller: s.controller, name: s.name,
    alive: true, gold: baseCost(s.faction) * 2, noCity: 0, kills: 0,
  }));
  const state: GameState = {
    version: 2, setup, rng: setup.seed, radius: map.radius, tiles: map.tiles, regions: map.regions, armies: map.armies,
    cities: map.cities, builds: [], players, current: 0, phase: 'play', turn: 1, nextId: map.nextId, winner: null, actionCount: 0,
  };
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
  const myArmy = (id: number) => { const ar = armyById(s, id); return ar && ar.owner === f ? ar : undefined; };
  switch (a.type) {
    case 'move': {
      const ar = myArmy(a.army);
      if (!ar) return 'Pick one of your armies.';
      if (!a.path.length) return 'Pick where to march.';
      const nb = neighbors(s);
      let at = ar.tile;
      let cost = 0;
      for (const t of a.path) {
        if (!nb[at].includes(t)) return 'You can only march to neighbouring hexes.';
        const c = stepCost(s, f, t, ar.id);
        if (!isFinite(c)) return cityAt(s, t) ? 'Troops cannot enter cities.' : 'That hex is blocked.';
        cost += c;
        at = t;
      }
      if (cost > ar.mp) return `Not enough movement (needs ${cost}, has ${ar.mp}).`;
      if (armiesAt(s, at).filter((x) => x.id !== ar.id).length >= 2) return 'At most two armies per hex.';
      return null;
    }
    case 'attack': {
      const ar = myArmy(a.army);
      if (!ar) return 'Pick one of your armies.';
      if (ar.attacked) return 'This army already attacked this turn.';
      if (ar.mp < 1) return 'Attacking needs 1 movement point.';
      if (!neighbors(s)[ar.tile].includes(a.target)) return 'Target must be next to the army.';
      if (!armiesAt(s, a.target).some((x) => x.owner !== f)) return 'Nobody to attack there.';
      return null;
    }
    case 'split': {
      const ar = myArmy(a.army);
      if (!ar) return 'Pick one of your armies.';
      if (cityAt(s, ar.tile)) return 'March out of the city first.';
      if (armiesAt(s, ar.tile).length >= 2) return 'There is already a second army here. Merge first.';
      const ids = new Set(a.units);
      const moving = ar.units.filter((u) => ids.has(u.id));
      if (!moving.length || moving.length !== ids.size) return 'Choose which units split off.';
      if (moving.length === ar.units.length) return 'Leave at least one unit behind.';
      return null;
    }
    case 'merge': {
      const here = armiesAt(s, a.tile).filter((x) => x.owner === f);
      return here.length === 2 ? null : 'Merging needs two of your armies on one hex.';
    }
    case 'recruit': {
      const c = cityAt(s, a.city);
      if (!c || c.owner !== f) return 'Recruit in one of your cities.';
      if (!FACTION_UNITS[f].includes(a.unit)) return 'Your faction cannot recruit that.';
      if (p.gold < unitCost(a.unit)) return 'Not enough gold.';
      if (!cityExit(s, a.city, f)) return 'Every hex around this city is blocked, so recruits could not march out.';
      return null;
    }
    case 'build': {
      const ar = myArmy(a.army);
      if (!ar) return 'Pick one of your armies.';
      const t = s.tiles[ar.tile];
      if (t.owner !== f) return 'Build on your own land.';
      if (cityAt(s, t.id) || s.builds.some((b) => b.tile === t.id)) return 'Something is already built here.';
      if (s.cities.some((c) => hexDistance(s.tiles[c.tile].q, s.tiles[c.tile].r, t.q, t.r) < 3)) return 'Too close to another city (needs 2 hexes between).';
      if (s.builds.some((b) => b.kind === 'city' && hexDistance(s.tiles[b.tile].q, s.tiles[b.tile].r, t.q, t.r) < 3)) return 'Too close to another building site.';
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
    case 'enchant': {
      const ar = myArmy(a.army);
      if (!ar || f !== 'elves') return 'Only Evergarden druids can enchant.';
      if (!ar.units.some((u) => u.type === 'druid')) return 'This army has no druid.';
      const t = s.tiles[ar.tile];
      if (t.terrain !== 'forest') return 'Druids enchant forests only.';
      if (t.enchanted) return 'This forest is already enchanted.';
      return null;
    }
    case 'endTurn': {
      const stuck = ownArmies(s, f).find((ar) => cityAt(s, ar.tile) && ar.mp > 0 && [...reachable(s, ar).values()].some((r) => r.stop));
      return stuck ? 'New recruits must march out of the city before you end the turn.' : null;
    }
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

  switch (a.type) {
    case 'move': {
      const ar = armyById(s, a.army)!;
      const captured: number[] = [];
      const forested: number[] = [];
      for (const t of a.path) {
        ar.mp -= stepCost(s, f, t, ar.id);
        ar.tile = t;
        claim(s, t, f, captured, forested);
      }
      events.push({ type: 'moved', p: f, army: ar.id, path: a.path, captured, forested });
      break;
    }
    case 'attack': {
      const ev = fight(s, rng, armyById(s, a.army)!, a.target);
      events.push(ev);
      checkElimination(s, events);
      break;
    }
    case 'split': {
      const ar = armyById(s, a.army)!;
      const ids = new Set(a.units);
      const moving = ar.units.filter((u) => ids.has(u.id));
      ar.units = ar.units.filter((u) => !ids.has(u.id));
      const na: Army = { id: s.nextId++, owner: f, tile: ar.tile, units: moving, mp: ar.mp, attacked: ar.attacked };
      s.armies.push(na);
      events.push({ type: 'split', p: f, army: ar.id, newArmy: na.id, tile: ar.tile });
      break;
    }
    case 'merge': {
      const [x, y] = armiesAt(s, a.tile).filter((ar) => ar.owner === f);
      x.units.push(...y.units);
      x.mp = Math.min(x.mp, y.mp);
      x.attacked = x.attacked || y.attacked;
      s.armies = s.armies.filter((ar) => ar.id !== y.id);
      events.push({ type: 'merged', p: f, army: x.id, tile: a.tile });
      break;
    }
    case 'recruit': {
      p.gold -= unitCost(a.unit);
      let ar = armiesAt(s, a.city).find((x) => x.owner === f);
      if (!ar) {
        ar = { id: s.nextId++, owner: f, tile: a.city, units: [], mp: MOVE_POINTS, attacked: false };
        s.armies.push(ar);
      }
      ar.units.push({ id: s.nextId++, type: a.unit, hp: UNIT_STATS[a.unit].hp });
      events.push({ type: 'recruited', p: f, city: a.city, unit: a.unit, army: ar.id });
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
    case 'enchant': {
      const ar = armyById(s, a.army)!;
      s.tiles[ar.tile].enchanted = true;
      events.push({ type: 'enchanted', p: f, tile: ar.tile });
      break;
    }
    case 'endTurn': {
      advance(s, rng, events);
      break;
    }
  }
  s.rng = rng.state;
  return { state: s, events };
}

/** An army stands on a hex: it now belongs to that side. */
function claim(s: GameState, tile: number, f: FactionId, captured: number[], forested: number[]) {
  const t = s.tiles[tile];
  if (t.owner === f) return;
  if (t.owner !== null) captured.push(tile);
  t.owner = f;
  if (t.enchanted && f !== 'elves') t.enchanted = false;
  // Evergarden: forest grows wherever the elves claim land.
  if (f === 'elves' && (t.terrain === 'plains' || t.terrain === 'desert')) {
    t.terrain = 'forest';
    forested.push(tile);
  }
  s.builds = s.builds.filter((b) => !(b.tile === tile && b.owner !== f));
}

// ------------------------------------------------------------------ combat
function rollSide(rng: Rng, units: Unit[], side: 'att' | 'def', bonus: number): CombatDie[] {
  return units.map((u) => {
    const st = UNIT_STATS[u.type];
    const roll = 1 + rng.int(6);
    const b = side === 'att' ? st.attack : st.defense + bonus;
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

export function fight(s: GameState, rng: Rng, att: Army, target: number): CombatEvent {
  const defArmies = armiesAt(s, target).filter((a) => a.owner !== att.owner);
  const defOwner = defArmies[0].owner;
  const tile = s.tiles[target];
  const attUnits = att.units;
  const defUnits = defArmies.flatMap((a) => a.units);
  const snapshot = (us: Unit[]) => us.map((u) => ({ ...u }));
  const ev: CombatEvent = {
    type: 'combat', p: att.owner as FactionId,
    attacker: { army: att.id, tile: att.tile, owner: att.owner, units: snapshot(attUnits) },
    defender: { armies: defArmies.map((a) => a.id), tile: target, owner: defOwner, units: snapshot(defUnits) },
    attDice: [], defDice: [], shots: [], pairs: [], dead: [], raise: null, defenderWiped: false, terrainBonus: [],
  };
  const db = defenseBonus(s, tile, defOwner);
  ev.terrainBonus = db.labels;
  ev.attDice = rollSide(rng, attUnits, 'att', 0);
  ev.defDice = rollSide(rng, defUnits, 'def', db.total);
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

  // The exchange: best against best; spare dice are lost.
  const A = ev.attDice.filter((d) => !d.void).sort((x, y) => y.total - x.total);
  const D = ev.defDice.filter((d) => !d.void).sort((x, y) => y.total - x.total);
  const n = Math.min(A.length, D.length);
  for (let i = 0; i < n; i++) {
    const attWins = A[i].total > D[i].total;
    const victim = attWins ? wound(defUnits, dead) : wound(attUnits, dead);
    const pair: CombatPair = { att: A[i].unit, def: D[i].unit, winner: attWins ? 'att' : 'def', victim };
    ev.pairs.push(pair);
  }
  ev.dead = [...dead];

  // Remove the fallen.
  const attOwner = att.owner;
  for (const ar of [att, ...defArmies]) ar.units = ar.units.filter((u) => !dead.has(u.id));
  const killsAtt = defUnits.filter((u) => dead.has(u.id)).length;
  const killsDef = attUnits.filter((u) => dead.has(u.id)).length;
  const pa = attOwner !== 'neutral' ? player(s, attOwner) : undefined;
  const pd = defOwner !== 'neutral' ? player(s, defOwner) : undefined;
  if (pa) pa.kills += killsAtt;
  if (pd) pd.kills += killsDef;

  // Necromancers: every death may rise again as a skeleton.
  const necroSide = attOwner === 'necro' ? 'att' : defOwner === 'necro' ? 'def' : null;
  const deaths = dead.size;
  if (necroSide && deaths > 0) {
    const pool = necroSide === 'att' ? ev.attacker.units : ev.defender.units;
    const priests = pool.filter((u) => u.type === 'priest').length;
    const extra = priests * Math.min(3, deaths);
    const rolls: number[] = [];
    for (let i = 0; i < deaths + extra; i++) rolls.push(1 + rng.int(6));
    const raised = Math.min(deaths, rolls.filter((r) => r === 6).length);
    let home = necroSide === 'att' ? att : defArmies.find((x) => x.units.length) ?? defArmies[0];
    if (raised > 0) {
      for (let i = 0; i < raised; i++) home.units.push({ id: s.nextId++, type: 'skeleton', hp: 1 });
    }
    ev.raise = { rolls, priestRolls: extra, raised, army: home.id };
  }
  s.armies = s.armies.filter((ar) => ar.units.length > 0);
  ev.defenderWiped = !armiesAt(s, target).some((x) => x.owner !== attOwner);
  const still = armyById(s, att.id);
  if (still) { still.mp -= 1; still.attacked = true; }
  return ev;
}

// ------------------------------------------------------------------ turns
/** Is there a hex next to the city that a fresh army could step onto? */
export function cityExit(s: GameState, city: number, f: FactionId): boolean {
  return neighbors(s)[city].some((t) => isFinite(stepCost(s, f, t)) && TERRAIN_COST[s.tiles[t].terrain] <= MOVE_POINTS &&
    armiesAt(s, t).filter((a) => a.owner === f).length < 2);
}

function advance(s: GameState, rng: Rng, events: GameEvent[]) {
  // Recruits that could not leave a city disband.
  const f = currentPlayer(s).faction;
  s.armies = s.armies.filter((a) => !(a.owner === f && cityAt(s, a.tile)));
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
  // A player eliminated at the start of their own turn passes straight on.
  if (s.phase !== 'over' && !currentPlayer(s).alive) advance(s, rng, events);
}

function startTurn(s: GameState, _rng: Rng, events: GameEvent[], first: boolean) {
  const p = currentPlayer(s);
  const f = p.faction;
  const nb = neighbors(s);
  for (const ar of ownArmies(s, f)) { ar.mp = MOVE_POINTS; ar.attacked = false; }

  // Construction.
  for (const b of s.builds.filter((x) => x.owner === f)) {
    b.turnsLeft--;
    if (b.turnsLeft > 0) continue;
    if (b.kind === 'city') {
      if (s.tiles[b.tile].owner === f && !cityAt(s, b.tile)) {
        s.cities.push({ tile: b.tile, owner: f, level: 0, siege: {}, capital: false });
        events.push({ type: 'built', p: f, tile: b.tile, kind: 'city', level: 0 });
      }
    } else {
      const c = cityAt(s, b.tile);
      if (c && c.owner === f) { c.level++; events.push({ type: 'built', p: f, tile: b.tile, kind: 'upgrade', level: c.level }); }
    }
  }
  s.builds = s.builds.filter((b) => b.turnsLeft > 0);

  // Sieges: count rounds this faction has stood next to enemy cities.
  for (const c of s.cities) {
    if (c.owner === f) continue;
    const besieging = nb[c.tile].some((t) => armiesAt(s, t).some((a) => a.owner === f));
    if (!besieging) { delete c.siege[f]; continue; }
    const rounds = (c.siege[f] ?? 0) + 1;
    const needed = SIEGE_ROUNDS + c.level;
    c.siege[f] = rounds;
    if (rounds >= needed) {
      const from = c.owner;
      c.owner = f;
      c.siege = {};
      c.capital = false;
      s.tiles[c.tile].owner = f;
      s.builds = s.builds.filter((b) => b.tile !== c.tile);
      events.push({ type: 'cityCaptured', p: f, city: c.tile, from });
    } else {
      events.push({ type: 'siege', p: f, city: c.tile, rounds, needed });
    }
  }

  // Healing: next to an own city, and mammoth milk.
  const healed: { army: number; unit: number; by: 'city' | 'mammoth' }[] = [];
  const myCities = ownCities(s, f);
  for (const ar of ownArmies(s, f)) {
    const nearCity = myCities.some((c) => c.tile === ar.tile || nb[c.tile].includes(ar.tile));
    if (nearCity) for (const u of ar.units) if (u.hp < UNIT_STATS[u.type].hp) { u.hp++; healed.push({ army: ar.id, unit: u.id, by: 'city' }); }
    const mammoths = ar.units.filter((u) => u.type === 'mammoth').length;
    for (let i = 0; i < mammoths; i++) {
      const w = ar.units
        .filter((u) => u.type !== 'mammoth' && u.hp < UNIT_STATS[u.type].hp)
        .sort((a, b) => tierOf(b) - tierOf(a) || a.hp - b.hp)[0];
      if (!w) break;
      w.hp++;
      healed.push({ army: ar.id, unit: w.id, by: 'mammoth' });
    }
  }
  if (healed.length) events.push({ type: 'healed', p: f, units: healed });

  // Income.
  const income = computeIncome(s, f);
  if (!first) p.gold += income.gold;

  // Without a city for too long?
  if (ownCities(s, f).length) p.noCity = 0;
  else {
    p.noCity++;
    if (p.noCity > NO_CITY_LIMIT || !canRegainCity(s, f)) eliminate(s, f, 'cities', events);
  }
  if (p.alive) events.push({ type: 'turn', p: f, turn: s.turn, income });
  checkElimination(s, events);
}

/** Can a faction without cities still get one before its time runs out? */
export function canRegainCity(s: GameState, f: FactionId): boolean {
  const p = player(s, f)!;
  const left = NO_CITY_LIMIT + 1 - p.noCity; // turn starts left, including the deadline
  if (s.builds.some((b) => b.owner === f && b.kind === 'city' && b.turnsLeft - 1 <= left)) return true;
  if (s.cities.some((c) => (c.siege[f] ?? 0) + left >= SIEGE_ROUNDS + c.level)) return true;
  if (left >= 2 && p.gold >= CITY_COST(f)) {
    const spot = ownArmies(s, f).some((a) => s.tiles[a.tile].owner === f &&
      !s.cities.some((c) => hexDistance(s.tiles[c.tile].q, s.tiles[c.tile].r, s.tiles[a.tile].q, s.tiles[a.tile].r) < 3));
    if (spot) return true;
  }
  return false;
}

function eliminate(s: GameState, f: FactionId, reason: 'units' | 'cities', events: GameEvent[]) {
  const p = player(s, f)!;
  if (!p.alive) return;
  p.alive = false;
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
    if (s.winner) events.push({ type: 'victory', p: s.winner });
  }
}

export function armyStrength(units: Unit[], side: 'att' | 'def', bonus = 0): number {
  return units.reduce((n, u) => {
    const st = UNIT_STATS[u.type];
    return n + (3.5 + (side === 'att' ? st.attack : st.defense + bonus)) * (0.6 + 0.4 * u.hp);
  }, 0);
}

export function unitLabel(t: UnitType) { return UNIT_STATS[t].name; }
export const FACTION_NAME = (f: Owner) => (f === 'neutral' ? 'Wildlands' : FACTIONS[f].short);
