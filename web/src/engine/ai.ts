import { COSTS, FACTIONS } from './factions';
import { combatMods, currentPlayer, neighbors, ownedTiles, reachable } from './rules';
import type { Action, FactionId, GameState, Tile } from './types';

/** Picks the AI's next single action, so the UI can animate one step at a time. */
export function aiNextAction(s: GameState): Action {
  const p = currentPlayer(s);
  const f = p.faction;
  const nb = neighbors(s);
  const T = s.tiles;
  const hostile = (t: Tile) => nb[t.id].map((n) => T[n]).filter((x) => x.terrain !== 'water' && x.owner !== f);
  const threat = (t: Tile) =>
    hostile(t).filter((x) => x.owner !== 'neutral').reduce((a, x) => a + Math.max(0, x.troops - 1), 0);
  const mine = ownedTiles(s, f);
  const frontier = mine.filter((t) => hostile(t).length > 0);

  if (s.pending) {
    const from = T[s.pending.from];
    const stillExposed = threat(from) > 0;
    const n = stillExposed
      ? Math.max(s.pending.min, Math.floor(s.pending.max * 0.6))
      : s.pending.max;
    return { type: 'move', p: f, n };
  }

  const targetValue = (from: Tile, to: Tile) => {
    const mods = combatMods(s, from, to);
    const defStrength = to.troops + mods.defBonus * 0.8 + (to.stronghold ? 1.5 : 0);
    const adv = from.troops - 1 - defStrength;
    let value = adv;
    if (to.capital) value += 4;
    const region = s.regions[to.region];
    const missing = region.tiles.filter((id) => T[id].owner !== f).length;
    if (missing === 1) value += 2.5;
    if (to.terrain === FACTIONS[f].resourceTerrain) value += 0.8;
    if (to.terrain === 'plains') value += 0.3;
    return { adv, value };
  };

  const bestAttack = () => {
    let best: { from: Tile; to: Tile; value: number } | null = null;
    for (const from of frontier) {
      if (from.troops < 2) continue;
      for (const to of hostile(from)) {
        const { adv, value } = targetValue(from, to);
        const ok = adv >= 1 || (to.capital && from.troops >= to.troops + 2);
        if (ok && (!best || value > best.value)) best = { from, to, value };
      }
    }
    return best;
  };

  if (s.phase === 'reinforce') {
    const ab = FACTIONS[f].ability;
    if (!p.abilityUsed && p.power >= ab.cost) {
      const target = abilityTarget(s, f, frontier, threat);
      if (target !== null) return { type: 'ability', p: f, tile: target };
    }
    const noChamp = frontier.filter((t) => !t.champion).sort((a, b) => b.troops - a.troops);
    const champions = mine.filter((t) => t.champion).length;
    if (p.gold >= COSTS.champion && noChamp.length && champions < 3 && p.gold >= COSTS.champion + (champions ? 3 : 0)) {
      return { type: 'buy', p: f, item: 'champion', tile: noChamp[0].id };
    }
    if (p.gold >= COSTS.troop && p.gold - COSTS.troop >= (champions < 2 ? 4 : 0)) {
      return { type: 'buy', p: f, item: 'troop' };
    }
    if (p.reinforcements > 0) {
      const cap = mine.find((t) => t.capital === f);
      if (cap) {
        const need = threat(cap) - cap.troops + 2;
        if (need > 0) return { type: 'place', p: f, tile: cap.id, n: Math.min(p.reinforcements, need) };
      }
      // Stack on the hex with the best attack opportunity, weighed by danger.
      let bestTile = frontier[0] ?? mine[0];
      let bestScore = -Infinity;
      for (const t of frontier) {
        let opp = -Infinity;
        for (const h of hostile(t)) {
          const v = targetValue({ ...t, troops: t.troops + p.reinforcements }, h).value;
          opp = Math.max(opp, v);
        }
        const score = opp + threat(t) * 0.35 + (t.champion ? 1 : 0);
        if (score > bestScore) { bestScore = score; bestTile = t; }
      }
      const n = frontier.length > 3 && p.reinforcements > 4 ? Math.ceil(p.reinforcements * 0.7) : p.reinforcements;
      return { type: 'place', p: f, tile: bestTile.id, n };
    }
    return { type: 'endPhase', p: f };
  }

  if (s.phase === 'attack') {
    const atk = bestAttack();
    if (atk) return { type: 'attack', p: f, from: atk.from.id, to: atk.to.id, blitz: true };
    return { type: 'endPhase', p: f };
  }

  if (s.phase === 'fortify' && !s.fortifyUsed) {
    const interior = mine.filter((t) => hostile(t).length === 0 && t.troops > 1).sort((a, b) => b.troops - a.troops);
    for (const src of interior) {
      const reach = [...reachable(s, src.id, f)].map((id) => T[id]).filter((t) => hostile(t).length > 0);
      if (!reach.length) continue;
      reach.sort((a, b) => threat(b) - b.troops - (threat(a) - a.troops));
      return { type: 'fortify', p: f, from: src.id, to: reach[0].id, n: src.troops - 1 };
    }
  }
  return { type: 'endPhase', p: f };
}

function abilityTarget(s: GameState, f: FactionId, frontier: Tile[], threat: (t: Tile) => number): number | null {
  const nb = neighbors(s);
  const T = s.tiles;
  if (f === 'necro') {
    const t = [...frontier].sort((a, b) => threat(b) + b.troops - (threat(a) + a.troops))[0];
    return t ? t.id : null;
  }
  if (f === 'giants') {
    const cands = frontier.filter((t) => !t.stronghold).sort((a, b) => (b.capital ? 10 : 0) + threat(b) - ((a.capital ? 10 : 0) + threat(a)));
    return cands.length && (threat(cands[0]) > 0 || cands[0].capital) ? cands[0].id : null;
  }
  // Elves: grow forest on own frontier plains/desert first, then neighbouring land.
  const own = frontier.filter((t) => t.terrain === 'plains' || t.terrain === 'desert').sort((a, b) => threat(b) - threat(a));
  if (own.length) return own[0].id;
  for (const t of frontier) for (const n of nb[t.id]) {
    const x = T[n];
    if (x.terrain === 'plains' || x.terrain === 'desert') return x.id;
  }
  return null;
}
