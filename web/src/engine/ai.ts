import { hexDistance } from './hex';
import {
  TERRAIN_COST, armiesAt, armyStrength, attackTargets, cityAt, currentPlayer, defenseBonus, neighbors, ownArmies, ownCities,
  pathTo, reachable, validate,
} from './rules';
import type { Action, Army, FactionId, GameState } from './types';
import { ARMY_FREE_SIZE, CITY_COST, FACTION_UNITS, IMPROVE_COST, MAX_CITY_LEVEL, MAX_IMPROVE, UNIT_STATS, UPGRADE_COST, unitCost } from './unitstats';

// Armies the AI has finished with this turn (AI runs on one machine only).
let doneKey = '';
const done = new Set<number>();

function legal(s: GameState, a: Action): Action | null {
  return validate(s, a) ? null : a;
}

/** Terrain-cost distance from every hex to the nearest goal hex. */
function distanceField(s: GameState, goals: number[]): Map<number, number> {
  const nb = neighbors(s);
  const dist = new Map<number, number>();
  const open: number[] = [];
  for (const g of goals) { dist.set(g, 0); open.push(g); }
  while (open.length) {
    open.sort((a, b) => dist.get(a)! - dist.get(b)!);
    const cur = open.shift()!;
    for (const n of nb[cur]) {
      const t = s.tiles[n];
      if (t.terrain === 'water' || cityAt(s, n)) continue;
      const d = dist.get(cur)! + TERRAIN_COST[s.tiles[cur].terrain];
      if (d < (dist.get(n) ?? Infinity)) { dist.set(n, d); open.push(n); }
    }
  }
  return dist;
}

/** Picks the AI's next single action, so the UI can animate one step at a time. */
export function aiNextAction(s: GameState): Action {
  const p = currentPlayer(s);
  const f = p.faction;
  const key = `${s.turn}-${f}`;
  if (key !== doneKey) { doneKey = key; done.clear(); }
  const nb = neighbors(s);
  const mine = ownArmies(s, f);
  const cities = ownCities(s, f);
  const enemyCities = s.cities.filter((c) => c.owner !== f);
  const myPower = mine.reduce((n, a) => n + armyStrength(a.units, 'att'), 0);

  // 0. A fight is waiting: press on if we still have the upper hand.
  if (s.pendingFight) {
    const pf = s.pendingFight;
    const att = mine.find((a) => a.id === pf.army);
    const theirs = defStrength(s, pf.target, armiesAt(s, pf.target).find((a) => a.owner !== f)?.owner ?? 'neutral');
    const ratio = att ? armyStrength(att.units, 'att') / Math.max(1, theirs) : 0;
    return { type: 'fight', p: f, choice: ratio >= 0.9 ? 'continue' : 'retreat' };
  }

  // 1. Merge armies sharing a hex once they have nothing left to attack.
  for (const a of mine) {
    if (cityAt(s, a.tile)) continue;
    const here = armiesAt(s, a.tile).filter((x) => x.owner === f);
    if (here.length === 2 && here.every((x) => !attackTargets(s, x).length) && here[0].units.length + here[1].units.length <= ARMY_FREE_SIZE) {
      return { type: 'merge', p: f, tile: a.tile };
    }
  }

  // 1a. Oversized armies cost upkeep: split the extra units off.
  for (const a of mine) {
    if (a.units.length <= ARMY_FREE_SIZE || armiesAt(s, a.tile).filter((x) => x.owner === f).length >= 2) continue;
    const extra = [...a.units].sort((x, y) => UNIT_STATS[x.type].tier - UNIT_STATS[y.type].tier).slice(0, a.units.length - ARMY_FREE_SIZE).map((u) => u.id);
    const act = legal(s, { type: 'split', p: f, army: a.id, units: extra });
    if (act) return act;
  }

  // 1b. Big armies next to enemies split, because every army may attack once per turn.
  for (const a of mine) {
    if (a.units.length < 6 || cityAt(s, a.tile) || armiesAt(s, a.tile).length >= 2) continue;
    const targets = attackTargets(s, a);
    if (!targets.length) continue;
    const weakest = Math.min(...targets.map((t) => defStrength(s, t, armiesAt(s, t)[0].owner)));
    const sorted = [...a.units].sort((x, y) => UNIT_STATS[y.type].tier - UNIT_STATS[x.type].tier);
    const half: number[] = [];
    let str = 0;
    for (const u of sorted) {
      if (str >= weakest * 1.4 || half.length >= a.units.length - 3) break;
      half.push(u.id);
      str += armyStrength([u], 'att');
    }
    if (half.length && str >= weakest * 1.2) {
      const act = legal(s, { type: 'split', p: f, army: a.id, units: half });
      if (act) return act;
    }
  }

  // 2. Defend: upgrade a city with enemies next to it.
  for (const c of cities) {
    const threatened = nb[c.tile].some((t) => armiesAt(s, t).some((a) => a.owner !== f && a.owner !== 'neutral'));
    const cap = Math.min(MAX_CITY_LEVEL, c.capital || cities.length === 1 ? 2 : 1);
    if (threatened && c.level < cap && p.gold >= UPGRADE_COST(f) * 2) {
      const a = legal(s, { type: 'upgrade', p: f, city: c.tile });
      if (a) return a;
    }
  }

  // 3. Expand: found another city when rich enough.
  const wantCities = 1 + Math.min(3, Math.floor(s.turn / 4));
  if (cities.length < wantCities && p.gold >= CITY_COST(f)) {
    for (const a of mine) {
      const act = legal(s, { type: 'build', p: f, army: a.id });
      if (act) return act;
    }
  }

  // 4. Recruit with what is left, keeping a little for a city if we lack one.
  const reserve = cities.length < wantCities ? Math.min(p.gold, CITY_COST(f)) * 0.5 : 0;
  if (cities.length) {
    const [t1, t2, t3] = FACTION_UNITS[f];
    const budget = p.gold - reserve;
    const pick = budget >= unitCost(t3) + unitCost(t1) ? t3 : budget >= unitCost(t2) + unitCost(t1) ? t2 : budget >= unitCost(t1) ? t1 : null;
    if (pick) {
      // Recruit in the city closest to the enemy.
      const front = [...cities].sort((a, b) => nearestEnemy(s, f, a.tile) - nearestEnemy(s, f, b.tile))[0];
      const act = legal(s, { type: 'recruit', p: f, city: front.tile, unit: pick });
      if (act) return act;
    }
  }

  // 4b. Improve land with spare gold: plains and mountains first.
  if (p.gold >= IMPROVE_COST[0] + unitCost(FACTION_UNITS[f][0])) {
    const spots = s.tiles
      .filter((t) => t.owner === f && t.improved < MAX_IMPROVE && !cityAt(s, t.id) && !s.builds.some((b) => b.tile === t.id))
      .filter((t) => p.gold >= IMPROVE_COST[t.improved] + unitCost(FACTION_UNITS[f][0]))
      .filter((t) => !nb[t.id].some((n) => armiesAt(s, n).some((a) => a.owner !== f && a.owner !== 'neutral')))
      .sort((a, b) => a.improved - b.improved || (a.terrain === 'forest' || a.terrain === 'desert' ? 1 : 0) - (b.terrain === 'forest' || b.terrain === 'desert' ? 1 : 0));
    if (spots.length) {
      const act = legal(s, { type: 'improve', p: f, tile: spots[0].id });
      if (act) return act;
    }
  }

  // 5. Druids enchant their forest.
  if (f === 'elves') {
    for (const a of mine) {
      const act = legal(s, { type: 'enchant', p: f, army: a.id });
      if (act) return act;
    }
  }

  // 6. Each army: attack if favourable, otherwise march towards a goal.
  const order = [...mine].sort((a, b) => (cityAt(s, b.tile) ? 1 : 0) - (cityAt(s, a.tile) ? 1 : 0));
  // Focus: the enemy city closest to our forces, so armies converge instead of scattering.
  const centre = mine.length ? mine : cities.map((c) => ({ tile: c.tile }));
  const focus = enemyCities
    .map((c) => ({ c, d: centre.reduce((n, a) => n + hexDistance(s.tiles[a.tile].q, s.tiles[a.tile].r, s.tiles[c.tile].q, s.tiles[c.tile].r), 0) / centre.length - (c.siege[f] ?? 0) * 3 + c.level }))
    .sort((a, b) => a.d - b.d)[0]?.c;
  for (const army of order) {
    if (done.has(army.id)) continue;
    const atk = bestAttack(s, army);
    if (atk) return atk;
    const mv = bestMove(s, army, focus ? [focus.tile] : [], enemyCities.map((c) => c.tile), myPower);
    if (mv) return mv;
    done.add(army.id);
  }
  return { type: 'endTurn', p: f };
}

function nearestEnemy(s: GameState, f: FactionId, tile: number): number {
  const t = s.tiles[tile];
  let best = Infinity;
  for (const a of s.armies) if (a.owner !== f && a.owner !== 'neutral') best = Math.min(best, hexDistance(t.q, t.r, s.tiles[a.tile].q, s.tiles[a.tile].r));
  return best;
}

function defStrength(s: GameState, tile: number, owner: Army['owner']): number {
  const units = armiesAt(s, tile).flatMap((a) => a.units);
  return armyStrength(units, 'def', defenseBonus(s, s.tiles[tile], owner).total);
}

function bestAttack(s: GameState, army: Army): Action | null {
  const f = army.owner as FactionId;
  const nb = neighbors(s);
  let best: { tile: number; score: number } | null = null;
  const mine = armyStrength(army.units, 'att');
  for (const t of attackTargets(s, army)) {
    const owner = armiesAt(s, t)[0].owner;
    const theirs = defStrength(s, t, owner);
    const ratio = mine / Math.max(1, theirs);
    const besiegesMe = s.cities.some((c) => c.owner === f && nb[c.tile].includes(t));
    const need = besiegesMe ? 0.85 : owner === 'neutral' ? 1.25 : 1.05;
    if (ratio >= need && (!best || ratio > best.score)) best = { tile: t, score: ratio };
  }
  return best ? { type: 'attack', p: f, army: army.id, target: best.tile } : null;
}

function bestMove(s: GameState, army: Army, enemyCities: number[], allEnemyCities: number[], myPower: number): Action | null {
  const f = army.owner as FactionId;
  if (army.mp <= 0) return null;
  const nb = neighbors(s);
  const inCity = !!cityAt(s, army.tile);
  const mine = armyStrength(army.units, 'att');

  // Already besieging? Hold position unless forced out of a city.
  if (!inCity && allEnemyCities.some((c) => nb[c].includes(army.tile))) return null;

  const goals: number[] = [];
  const free = (t: number) => s.tiles[t].terrain !== 'water' && !cityAt(s, t) && !armiesAt(s, t).some((a) => a.owner !== f);
  // Siege spots next to enemy cities (once the army is strong enough to hold them).
  if (mine >= 14 || myPower > 40) for (const c of enemyCities) for (const t of nb[c]) if (free(t)) goals.push(t);
  // Hexes next to armies we can beat.
  for (const other of s.armies) {
    if (other.owner === f) continue;
    const theirs = defStrength(s, other.tile, other.owner);
    if (mine / Math.max(1, theirs) >= 1.2) for (const t of nb[other.tile]) if (free(t)) goals.push(t);
  }
  // Otherwise claim unowned or enemy land.
  if (!goals.length) for (const t of s.tiles) if (free(t.id) && t.owner !== f) goals.push(t.id);
  if (!goals.length && !inCity) return null;

  const field = distanceField(s, goals);
  const reach = reachable(s, army);
  const here = field.get(army.tile) ?? Infinity;
  let best: { tile: number; score: number } | null = null;
  for (const [t, r] of reach) {
    if (!r.stop || cityAt(s, t)) continue;
    const d = field.get(t) ?? Infinity;
    // Avoid parking next to armies that would crush us.
    const danger = nb[t].reduce((n, x) => n + armiesAt(s, x).filter((a) => a.owner !== f && a.owner !== 'neutral').reduce((m, a) => m + armyStrength(a.units, 'att'), 0), 0);
    const score = d * 10 - defenseBonus(s, s.tiles[t], f).total * 2 + (danger > mine * 1.4 ? 40 : 0) + (s.tiles[t].owner !== f ? -3 : 0);
    if (!best || score < best.score) best = { tile: t, score };
  }
  if (!best) return null;
  if (!inCity && (field.get(best.tile) ?? Infinity) >= here && s.tiles[best.tile].owner === f) return null;
  return { type: 'move', p: f, army: army.id, path: pathTo(reach, best.tile) };
}
