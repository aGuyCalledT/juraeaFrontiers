import { COSTS, FACTIONS } from './factions';
import { buildNeighbors, generateMap } from './mapgen';
import { Rng } from './rng';
import type {
  Action, CombatRound, DieRoll, FactionId, GameEvent, GameSetup, GameState, Income, Owner, PlayerState, Tile,
} from './types';

const nbCache = new Map<number, number[][]>();
export function neighbors(state: GameState): number[][] {
  let nb = nbCache.get(state.radius);
  if (!nb) { nb = buildNeighbors(state.tiles); nbCache.set(state.radius, nb); }
  return nb;
}

export const DOMINATION = 0.75;

export function createGame(setup: GameSetup): { state: GameState; events: GameEvent[] } {
  const map = generateMap(setup);
  nbCache.set(map.radius, map.neighbors);
  const order = new Rng(setup.seed ^ 0x0de5).shuffle(setup.slots.filter((s) => s.kind !== 'off'));
  const players: PlayerState[] = order
    .map((s) => ({
      faction: s.faction, kind: s.kind === 'ai' ? 'ai' : 'human', controller: s.controller, name: s.name,
      alive: true, gold: 3, power: 2, reinforcements: 0, abilityUsed: false, conquered: 0, kills: 0,
    }));
  const state: GameState = {
    version: 1, setup, rng: setup.seed, radius: map.radius, tiles: map.tiles, regions: map.regions, players,
    current: 0, phase: 'reinforce', turn: 1, fortifyUsed: false, pending: null, winner: null, actionCount: 0, raiseOnMove: false,
  };
  const events: GameEvent[] = [];
  startTurn(state, events, true);
  return { state, events };
}

export function currentPlayer(s: GameState): PlayerState {
  return s.players[s.current];
}

export function player(s: GameState, f: FactionId): PlayerState | undefined {
  return s.players.find((p) => p.faction === f);
}

export function landTiles(s: GameState): Tile[] {
  return s.tiles.filter((t) => t.terrain !== 'water');
}

export function ownedTiles(s: GameState, f: Owner): Tile[] {
  return s.tiles.filter((t) => t.owner === f);
}

export function computeIncome(s: GameState, f: FactionId): Income {
  const owned = ownedTiles(s, f);
  const regions = s.regions.filter((r) => r.tiles.length && r.tiles.every((id) => s.tiles[id].owner === f));
  const capital = owned.some((t) => t.capital === f);
  const troops = Math.max(3, Math.floor(owned.length / 3)) + regions.reduce((a, r) => a + r.bonus, 0) + (capital ? 1 : 0);
  const p = player(s, f)!;
  const gold = owned.filter((t) => t.terrain === 'plains').length + (capital ? 2 : 0) + (p.conquered > 0 ? 2 : 0);
  const power = owned.filter((t) => t.terrain === FACTIONS[f].resourceTerrain).length;
  return { troops, gold, power, regions: regions.map((r) => r.name) };
}

function startTurn(s: GameState, events: GameEvent[], first = false) {
  const p = currentPlayer(s);
  const income = computeIncome(s, p.faction);
  if (first) income.gold = 0;
  p.reinforcements = income.troops;
  p.gold += income.gold;
  p.power += income.power;
  p.abilityUsed = false;
  p.conquered = 0;
  s.phase = 'reinforce';
  s.fortifyUsed = false;
  s.pending = null;
  events.push({ type: 'turn', p: p.faction, turn: s.turn, income });
}

function advancePlayer(s: GameState, events: GameEvent[]) {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (s.current + i) % n;
    if (s.players[idx].alive) {
      if (idx <= s.current) s.turn++;
      s.current = idx;
      break;
    }
  }
  startTurn(s, events);
}

export type Validation = string | null;

/** Returns an error message, or null when the action is legal. */
export function validate(s: GameState, a: Action): Validation {
  if (s.phase === 'over') return 'The game is over.';
  const p = currentPlayer(s);
  if (a.p !== p.faction) return 'Not your turn.';
  const nb = neighbors(s);
  if (s.pending && a.type !== 'move') return 'Choose how many troops move in first.';
  switch (a.type) {
    case 'place': {
      if (s.phase !== 'reinforce') return 'You can only place troops while reinforcing.';
      const t = s.tiles[a.tile];
      if (!t || t.owner !== p.faction) return 'Place troops on your own hexes.';
      if (a.n < 1 || a.n > p.reinforcements) return 'Not enough reinforcements.';
      return null;
    }
    case 'buy': {
      if (s.phase !== 'reinforce') return 'The market is open while reinforcing.';
      if (a.item === 'troop') return p.gold >= COSTS.troop ? null : 'Not enough gold.';
      if (p.gold < COSTS.champion) return 'Not enough gold.';
      const t = a.tile !== undefined ? s.tiles[a.tile] : undefined;
      if (!t || t.owner !== p.faction) return 'Champions join your own hexes.';
      if (t.champion) return 'That hex already has a champion.';
      return null;
    }
    case 'ability': {
      const def = FACTIONS[p.faction].ability;
      if (p.abilityUsed) return 'Ability already used this turn.';
      if (p.power < def.cost) return `Needs ${def.cost} ${FACTIONS[p.faction].resource}.`;
      const t = s.tiles[a.tile];
      if (!t || t.terrain === 'water') return 'Pick a land hex.';
      if (p.faction === 'elves') {
        if (t.terrain !== 'plains' && t.terrain !== 'desert') return 'Only plains or desert can be overgrown.';
        const near = t.owner === p.faction || nb[t.id].some((n) => s.tiles[n].owner === p.faction);
        return near ? null : 'Pick a hex you own or that borders yours.';
      }
      if (t.owner !== p.faction) return 'Pick one of your hexes.';
      if (p.faction === 'giants' && t.stronghold) return 'Already a stronghold.';
      return null;
    }
    case 'attack': {
      if (s.phase !== 'attack') return 'Attacks happen in the attack phase.';
      const f = s.tiles[a.from];
      const t = s.tiles[a.to];
      if (!f || f.owner !== p.faction) return 'Attack from your own hex.';
      if (f.troops < 2) return 'Needs at least 2 troops to attack.';
      if (!t || t.terrain === 'water' || t.owner === p.faction) return 'Pick an enemy hex.';
      if (!nb[f.id].includes(t.id)) return 'Target must be adjacent.';
      return null;
    }
    case 'move': {
      if (!s.pending) return 'Nothing to move.';
      if (a.n < s.pending.min || a.n > s.pending.max) return 'Invalid number of troops.';
      return null;
    }
    case 'fortify': {
      if (s.phase !== 'fortify') return 'Fortify in the fortify phase.';
      if (s.fortifyUsed) return 'You already fortified this turn.';
      const f = s.tiles[a.from];
      const t = s.tiles[a.to];
      if (!f || !t || f.owner !== p.faction || t.owner !== p.faction || f.id === t.id) return 'Move between your own hexes.';
      if (a.n < 1 || a.n > f.troops - 1) return 'Leave at least one troop behind.';
      if (!connected(s, f.id, t.id, p.faction)) return 'Hexes must be connected through your land.';
      return null;
    }
    case 'endPhase': {
      if (s.phase === 'reinforce' && p.reinforcements > 0) return 'Place all reinforcements first.';
      return null;
    }
  }
}

export function connected(s: GameState, a: number, b: number, f: FactionId): boolean {
  const nb = neighbors(s);
  const seen = new Set([a]);
  const stack = [a];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === b) return true;
    for (const n of nb[id]) if (!seen.has(n) && s.tiles[n].owner === f) { seen.add(n); stack.push(n); }
  }
  return false;
}

export function reachable(s: GameState, a: number, f: FactionId): Set<number> {
  const nb = neighbors(s);
  const seen = new Set([a]);
  const stack = [a];
  while (stack.length) {
    const id = stack.pop()!;
    for (const n of nb[id]) if (!seen.has(n) && s.tiles[n].owner === f) { seen.add(n); stack.push(n); }
  }
  seen.delete(a);
  return seen;
}

export function combatMods(s: GameState, from: Tile, to: Tile): { att: string[]; def: string[]; attBonus: number; defBonus: number } {
  const att: string[] = [];
  const def: string[] = [];
  const attacker = from.owner as FactionId;
  if (from.champion) att.push(FACTIONS[attacker].units.special);
  if (attacker === 'elves' && from.terrain === 'forest') att.push('Forest Wardens');
  if (attacker === 'giants' && (from.terrain === 'mountain' || from.troops >= 5)) att.push('Colossi');
  if (to.terrain === 'mountain') def.push('Mountain');
  if (to.champion && to.owner !== 'neutral') def.push(FACTIONS[to.owner as FactionId].units.special);
  if (to.owner === 'elves' && to.terrain === 'forest') def.push('Forest Wardens');
  if (to.owner === 'giants' && to.troops >= 5) def.push('Colossi');
  if (to.capital) def.push('Capital walls');
  return { att, def, attBonus: att.length, defBonus: def.length };
}

function rollDice(rng: Rng, n: number, bonus: number): DieRoll[] {
  const dice: DieRoll[] = [];
  for (let i = 0; i < n; i++) dice.push({ value: 1 + rng.int(6), bonus: 0 });
  dice.sort((a, b) => b.value - a.value);
  if (dice.length) dice[0].bonus = bonus;
  return dice;
}

const total = (d: DieRoll) => d.value + d.bonus;

function fightRound(s: GameState, rng: Rng, from: Tile, to: Tile): CombatRound {
  const mods = combatMods(s, from, to);
  const attN = Math.min(3, from.troops - 1);
  const defN = Math.min(to.stronghold || to.capital ? 3 : 2, to.troops);
  const att = rollDice(rng, attN, mods.attBonus);
  const def = rollDice(rng, defN, mods.defBonus);
  // Bonuses can reorder the best die; re-sort by total for comparison.
  att.sort((a, b) => total(b) - total(a));
  def.sort((a, b) => total(b) - total(a));
  let attLoss = 0;
  let defLoss = 0;
  for (let i = 0; i < Math.min(att.length, def.length); i++) {
    if (total(att[i]) > total(def[i])) defLoss++;
    else attLoss++;
  }
  from.troops -= attLoss;
  to.troops -= defLoss;
  return { att, def, attLoss, defLoss };
}

/** Applies an action. Mutates a clone and returns it with the resulting events. */
export function applyAction(prev: GameState, a: Action): { state: GameState; events: GameEvent[]; error?: string } {
  const err = validate(prev, a);
  if (err) return { state: prev, events: [], error: err };
  const s: GameState = structuredClone(prev);
  s.actionCount++;
  const events: GameEvent[] = [];
  const p = currentPlayer(s);
  const rng = new Rng(s.rng);

  switch (a.type) {
    case 'place': {
      s.tiles[a.tile].troops += a.n;
      p.reinforcements -= a.n;
      events.push({ type: 'placed', tile: a.tile, n: a.n, p: p.faction });
      break;
    }
    case 'buy': {
      if (a.item === 'troop') {
        p.gold -= COSTS.troop;
        p.reinforcements += 1;
      } else {
        p.gold -= COSTS.champion;
        s.tiles[a.tile!].champion = true;
      }
      events.push({ type: 'bought', item: a.item, tile: a.tile, p: p.faction });
      break;
    }
    case 'ability': {
      const t = s.tiles[a.tile];
      p.power -= FACTIONS[p.faction].ability.cost;
      p.abilityUsed = true;
      if (p.faction === 'necro') t.troops += 2;
      if (p.faction === 'elves') { t.terrain = 'forest'; if (t.owner === 'elves') t.troops += 1; }
      if (p.faction === 'giants') { t.stronghold = true; t.troops += 2; }
      events.push({ type: 'ability', p: p.faction, tile: t.id });
      break;
    }
    case 'attack': {
      const from = s.tiles[a.from];
      const to = s.tiles[a.to];
      const defender = to.owner as Owner;
      const mods = combatMods(s, from, to);
      const rounds: CombatRound[] = [];
      do {
        rounds.push(fightRound(s, rng, from, to));
      } while (a.blitz && from.troops > 1 && to.troops > 0 && rounds.length < 60);
      const killed = rounds.reduce((x, r) => x + r.defLoss, 0);
      p.kills += killed;
      // Souls come from slain faction troops only (wild beasts have no souls worth taking).
      if (p.faction === 'necro' && defender !== 'neutral') p.power += killed;
      const lostAtt = rounds.reduce((x, r) => x + r.attLoss, 0);
      if (defender === 'necro' && lostAtt) { const dp = player(s, 'necro'); if (dp) dp.power += lostAtt; }
      const conquered = to.troops <= 0;
      events.push({ type: 'combat', p: p.faction, from: from.id, to: to.id, defender, rounds, attMods: mods.att, defMods: mods.def, conquered });
      if (conquered) {
        to.owner = p.faction;
        to.troops = 0;
        if (to.champion) { to.champion = false; if (p.faction === 'necro') p.power += 2; }
        to.stronghold = false;
        p.conquered++;
        s.raiseOnMove = defender !== 'neutral';
        events.push({ type: 'conquered', p: p.faction, tile: to.id, from: defender });
        const lostCapital = to.capital && to.capital !== p.faction ? to.capital : null;
        if (lostCapital) {
          to.capital = null;
          eliminate(s, lostCapital, p.faction, events);
        }
        const min = Math.min(rounds[rounds.length - 1].att.length, from.troops - 1);
        const max = from.troops - 1;
        if (max <= min) {
          moveIn(s, from, to, min, events);
        } else {
          s.pending = { from: from.id, to: to.id, min, max };
        }
        checkVictory(s, events);
      }
      break;
    }
    case 'move': {
      const pend = s.pending!;
      moveIn(s, s.tiles[pend.from], s.tiles[pend.to], a.n, events);
      s.pending = null;
      break;
    }
    case 'fortify': {
      s.tiles[a.from].troops -= a.n;
      s.tiles[a.to].troops += a.n;
      s.fortifyUsed = true;
      events.push({ type: 'moved', from: a.from, to: a.to, n: a.n, p: p.faction });
      break;
    }
    case 'endPhase': {
      if (s.phase === 'reinforce') {
        s.phase = 'attack';
        events.push({ type: 'phase', p: p.faction, phase: 'attack' });
      } else if (s.phase === 'attack') {
        s.phase = 'fortify';
        events.push({ type: 'phase', p: p.faction, phase: 'fortify' });
      } else {
        advancePlayer(s, events);
      }
      break;
    }
  }
  s.rng = rng.state;
  return { state: s, events };
}

function moveIn(s: GameState, from: Tile, to: Tile, n: number, events: GameEvent[]) {
  from.troops -= n;
  to.troops += n;
  events.push({ type: 'moved', from: from.id, to: to.id, n, p: from.owner as FactionId });
  // Undead Army: fallen faction soldiers rise again on the conquered hex.
  if (from.owner === 'necro' && s.raiseOnMove) {
    to.troops += 1;
    events.push({ type: 'raised', p: 'necro', tile: to.id, n: 1 });
  }
  s.raiseOnMove = false;
}

function eliminate(s: GameState, loser: FactionId, by: FactionId, events: GameEvent[]) {
  const lp = player(s, loser)!;
  const wp = player(s, by)!;
  lp.alive = false;
  wp.gold += lp.gold;
  lp.gold = 0;
  for (const t of s.tiles) {
    if (t.owner === loser) {
      t.owner = by;
      t.troops = Math.max(1, Math.ceil(t.troops / 2));
      t.champion = false;
    }
  }
  events.push({ type: 'eliminated', p: loser, by });
}

function checkVictory(s: GameState, events: GameEvent[]) {
  const alive = s.players.filter((p) => p.alive);
  const land = landTiles(s).length;
  const p = currentPlayer(s);
  if (alive.length === 1) {
    s.phase = 'over';
    s.winner = alive[0].faction;
    events.push({ type: 'victory', p: alive[0].faction, reason: 'last' });
  } else if (ownedTiles(s, p.faction).length >= Math.ceil(land * DOMINATION)) {
    s.phase = 'over';
    s.winner = p.faction;
    events.push({ type: 'victory', p: p.faction, reason: 'domination' });
  }
}

export function dieTotal(d: DieRoll): number {
  return total(d);
}
