import { sfx } from '../audio';
import { aiNextAction } from '../engine/ai';
import { FACTIONS, NEUTRAL, TERRAIN_INFO } from '../engine/factions';
import {
  FACTION_NAME, TERRAIN_COST, applyAction, attackError, neighbors, armiesAt, armyById, armyStrength, attackTargets, cityAt, computeIncome, currentPlayer, fortressAt, garrisonUnit, growTargets, hireCost, isCoastal,
  recruitCost, recruitable, regionOf, terraformTargets, tier3Count, tier3Limit, upkeepOf, wallAt,
  defenseBonus, landRegions, ownArmies, ownCities, ownedRegions, pathTo, reachable, unitCount, validate, type Reach,
} from '../engine/rules';
import type { Action, Army, FactionId, GameEvent, GameState, Owner, Tile } from '../engine/types';
import {
  ARMY_FREE_SIZE, CITY_ASSAULTS, CITY_COST, FACTION_UNITS, IMPROVE_COST, MAX_CITY_LEVEL, MAX_IMPROVE, MOVE_POINTS, NO_CITY_LIMIT, RAZE_GOLD,
  CITY_TUNE, DWARF_UNITS, SPELLS, UNIT_STATS, UPGRADE_COST, bounty, garrisonTier, hitRank, refund, unitCost,
  type UnitType,
} from '../engine/unitstats';
import type { Online, ServerMsg } from '../net/online';
import { Board } from '../render/board';
import { playtestReport, shareReport } from './report';
import * as fx from '../render/fx';
import { unitSvg } from '../render/units';
import { DiceTray, portrait } from '../ui/dice';
import { ICONS } from '../ui/icons';

export interface GameOptions {
  root: HTMLElement;
  state: GameState;
  online?: Online;
  appliedSeq?: number;
  onExit(): void;
  onRestart(): void;
  onHelp(): void;
  intro?: boolean;
}

export function crest(f: FactionId | 'neutral', cls = 'crest'): string {
  const col = f === 'neutral' ? NEUTRAL.color : FACTIONS[f].color;
  const unit = f === 'neutral' ? 'wildling' : FACTION_UNITS[f][0];
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><use href="#s-shield" style="color:${col}"/><use href="#unit-${unit}" x="14" y="12" width="72" height="72"/></svg>`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;

function unitSummary(units: Army['units']): string {
  const counts = new Map<UnitType, number>();
  for (const u of units) counts.set(u.type, (counts.get(u.type) ?? 0) + 1);
  return [...counts].sort((a, b) => UNIT_STATS[b[0]].tier - UNIT_STATS[a[0]].tier)
    .map(([t, n]) => `${n} ${n === 1 ? UNIT_STATS[t].name : UNIT_STATS[t].plural}`).join(', ');
}

export class GameController {
  state: GameState;
  board: Board;
  private el: HTMLElement;
  private dice: DiceTray;
  private q = <T extends HTMLElement>(sel: string) => this.el.querySelector(sel) as T;
  private queue: Action[] = [];
  private busy = false;
  private selArmy: number | null = null;
  private selCity: number | null = null;
  private splitPick: Set<number> | null = null;
  private pickMode: 'split' | 'dismiss' = 'split';
  private selTile: number | null = null;
  private selFort: number | null = null;
  /** Waiting for a target hex. */
  private mode: null | 'terraform' | 'volley' | 'wall' | 'treant' | 'build' = null;
  /** A rival army being looked at (read-only panel). */
  private selOther: number | null = null;
  /** Army being dragged, and the region under the pointer. */
  private dragArmy: number | null = null;
  private reach: Map<number, Reach> = new Map();
  private aiTimer = 0;
  private appliedSeq: number;
  private offNet?: () => void;
  private destroyed = false;
  private lastTurnKey = '';
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);

  constructor(private opts: GameOptions) {
    this.state = opts.state;
    this.appliedSeq = opts.appliedSeq ?? 0;
    this.el = document.createElement('div');
    this.el.className = 'game';
    this.el.innerHTML = this.template();
    opts.root.replaceChildren(this.el);
    this.board = new Board(this.q('.board-host'), {
      onTileClick: (id) => this.onTileClick(id),
      onTileHover: (id, x, y) => this.onHover(id, x, y),
      onTileLongPress: (id, x, y) => this.showTooltip(id, x, y, true),
      onDragStart: (id) => this.dragStart(id),
      onDragMove: (id, x, y) => this.dragMove(id, x, y),
      onDrop: (id) => this.drop(id),
    });
    this.dice = new DiceTray(this.el);
    this.measureInsets();
    this.board.build(this.state);
    this.bindHud();
    this.refresh();
    if (opts.intro !== false) fx.introDrop(this.board);
    window.addEventListener('keydown', this.keyHandler);
    if (opts.online) this.offNet = opts.online.on((m) => this.onNet(m));
    if (import.meta.env.DEV) Object.assign(window, { __jf: this, __ai: aiNextAction });
    const p = currentPlayer(this.state);
    this.lastTurnKey = `${this.state.turn}-${p.faction}`;
    setTimeout(() => {
      if (this.destroyed) return;
      void this.turnBanner(p.faction);
      this.scheduleAi();
    }, opts.intro === false ? 50 : 1100);
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.aiTimer);
    window.removeEventListener('keydown', this.keyHandler);
    this.offNet?.();
  }

  // ---------------- Who controls what ----------------
  private get online() { return this.opts.online; }

  controlsCurrent(): boolean {
    const p = currentPlayer(this.state);
    if (this.state.phase === 'over' || p.kind !== 'human') return false;
    return !this.online || p.controller === this.online.clientId;
  }

  private runsAi(): boolean {
    const p = currentPlayer(this.state);
    if (this.state.phase === 'over' || p.kind !== 'ai') return false;
    return !this.online || this.online.isHost;
  }

  private viewer(): FactionId | null {
    if (this.controlsCurrent()) return currentPlayer(this.state).faction;
    if (this.online) return this.state.players.find((p) => p.controller === this.online!.clientId)?.faction ?? null;
    const humans = this.state.players.filter((p) => p.kind === 'human');
    return humans.length === 1 ? humans[0].faction : null;
  }

  // ---------------- Action pipeline ----------------
  submit(a: Action) {
    const err = validate(this.state, a);
    if (err) { this.toast(err, 'warn'); sfx.error(); return; }
    if (this.online) this.online.send({ t: 'action', action: a });
    else this.enqueue(a);
  }

  private enqueue(a: Action) {
    this.queue.push(a);
    void this.pump();
  }

  private async pump() {
    if (this.busy || this.destroyed) return;
    this.busy = true;
    this.el.classList.add('is-busy');
    this.renderHint();
    while (this.queue.length && !this.destroyed) {
      const a = this.queue.shift()!;
      const prev = this.state;
      const r = applyAction(prev, a);
      if (r.error) continue;
      this.state = r.state;
      if (this.selArmy !== null && !armyById(this.state, this.selArmy)) this.selArmy = null;
      if (this.selOther !== null && !armyById(this.state, this.selOther)) this.selOther = null;
      await this.animate(r.events, prev, a);
      this.board.sync(this.state);
      this.refresh();
      this.save();
    }
    this.busy = false;
    this.el.classList.remove('is-busy');
    if (this.mode === 'build' && !this.buildActions().size) {
      this.mode = null;
      if (this.controlsCurrent()) this.toast(`Build mode done: ${this.buildBlocked().charAt(0).toLowerCase()}${this.buildBlocked().slice(1)}`, 'info');
    }
    if (this.dice.isOpen && !this.state.pendingFight && !this.state.pendingCity) this.dice.close();
    this.refresh();
    if (this.state.pendingFight && this.controlsCurrent()) {
      const f = currentPlayer(this.state).faction;
      if (this.dice.autoFight) {
        let stopped = false;
        this.dice.showAutoSwitch(() => { stopped = true; });
        setTimeout(() => {
          if (stopped || !this.state.pendingFight) { if (this.state.pendingFight) void this.dice.ask(this.state.pendingFight.round + 1).then((choice) => this.submit({ type: 'fight', p: f, choice })); return; }
          this.submit({ type: 'fight', p: f, choice: 'continue' });
        }, 450 / fx.motion.speed);
      } else {
        void this.dice.ask(this.state.pendingFight.round + 1).then((choice) => this.submit({ type: 'fight', p: f, choice }));
      }
    } else if (this.state.pendingCity && this.controlsCurrent()) {
      const f = currentPlayer(this.state).faction;
      const c = cityAt(this.state, this.state.pendingCity.city);
      const name = regionOf(this.state, this.state.pendingCity.city)?.name ?? 'The city';
      void this.dice.askCity(name, RAZE_GOLD * Math.max(1, c?.level ?? 1)).then((choice) => this.submit({ type: 'cityChoice', p: f, choice }));
    }
    this.scheduleAi();
  }

  private scheduleAi() {
    clearTimeout(this.aiTimer);
    if (this.destroyed || this.busy || !this.runsAi()) return;
    this.aiTimer = window.setTimeout(() => {
      if (this.destroyed || this.busy || !this.runsAi()) return;
      this.submit(aiNextAction(this.state));
    }, 260 / fx.motion.speed);
  }

  private onNet(m: ServerMsg) {
    if (m.t === 'action') {
      if (m.seq <= this.appliedSeq) return;
      this.appliedSeq = m.seq;
      this.enqueue(m.action);
    } else if (m.t === 'sync') {
      const missing = m.log.slice(this.appliedSeq);
      this.appliedSeq = m.log.length;
      missing.forEach((a) => this.queue.push(a));
      void this.pump();
    } else if (m.t === 'room') {
      this.refresh();
      this.scheduleAi();
    }
  }

  private save() {
    if (this.online) return;
    try {
      if (this.state.phase === 'over') localStorage.removeItem('jf-save');
      else localStorage.setItem('jf-save', JSON.stringify(this.state));
    } catch { /* storage unavailable */ }
  }

  // ---------------- Event animations ----------------
  private async animate(events: GameEvent[], prev: GameState, a: Action) {
    const watching = !this.controlsCurrent() || !!this.online;
    for (const e of events) {
      switch (e.type) {
        case 'moved': {
          const ar = armyById(prev, e.army);
          const top = ar ? [...ar.units].sort((x, y) => UNIT_STATS[y.type].tier - UNIT_STATS[x.type].tier)[0]?.type : 'wildling';
          fx.clearAim(this.board);
          if (watching) this.board.focus(e.path);
          this.board.sync(this.state);
          this.hideStack(e.path[e.path.length - 1], true);
          sfx.place();
          await fx.marchPath(this.board, ar?.tile ?? e.path[0], e.path, top ?? 'wildling', e.p);
          this.hideStack(e.path[e.path.length - 1], false);
          fx.popBadge(this.board, e.path[e.path.length - 1]);
          if (e.captured.length) sfx.conquer();
          for (const t of e.captured) fx.bounceTile(this.board, t, 0.8);
          break;
        }
        case 'combat': {
          this.hideTooltip();
          if (e.round === 1 && !e.volley) {
            this.board.focus([e.attacker.tile, e.defender.tile]);
            fx.showAim(this.board, e.attacker.tile, e.defender.tile, 'attack', e.p);
            sfx.whoosh();
            await fx.volley(this.board, e.attacker.tile, e.defender.tile, e.p, Math.min(4, e.attacker.units.length));
          }
          await this.dice.play(e, { att: FACTION_NAME(e.attacker.owner), def: e.wall ? 'Stone Wall' : e.garrison !== undefined ? `${FACTION_NAME(e.defender.owner)} city` : FACTION_NAME(e.defender.owner) });
          this.board.sync(this.state);
          const lostA = e.attacker.units.filter((u) => e.dead.includes(u.id)).length;
          const lostD = e.defender.units.filter((u) => e.dead.includes(u.id)).length;
          if (lostA) { fx.floatText(this.board, e.attacker.tile, `-${lostA}`, 'loss'); fx.shakeTile(this.board, e.attacker.tile); }
          if (lostD) { fx.floatText(this.board, e.defender.tile, `-${lostD}`, 'loss'); fx.shakeTile(this.board, e.defender.tile); }
          if (e.bounty.att) fx.floatText(this.board, e.attacker.tile, `+${e.bounty.att} gold`, 'gain', -30);
          if (e.bounty.def) fx.floatText(this.board, e.defender.tile, `+${e.bounty.def} gold`, 'gain', -30);
          if (e.defenderWiped) { sfx.conquer(); fx.confetti(this.board, e.defender.tile, [FACTIONS[e.p].color, FACTIONS[e.p].accent], 12); }
          if (e.final) fx.clearAim(this.board);
          break;
        }
        case 'retreat': {
          fx.clearAim(this.board);
          this.toast(`${FACTIONS[e.p].short} call off the attack.`, 'info', e.p);
          break;
        }
        case 'terraformed': {
          this.board.sync(this.state);
          if (e.to === 'corrupted') { sfx.doom(); void fx.abilityScene(this.board, e.tile, 'raise', this.q('.board-host')); }
          else { sfx.thud(); fx.shakeTile(this.board, e.tile); fx.floatText(this.board, e.tile, 'Cleared', 'info'); }
          break;
        }
        case 'discovered': {
          this.board.sync(this.state);
          sfx.fanfare();
          fx.bounceTile(this.board, e.tile, 1.4);
          this.toast(`${FACTIONS[e.p].short} discovered a dwarf fortress! Everyone can hire dwarves there now.`, 'good', e.p);
          break;
        }
        case 'hired': {
          this.board.sync(this.state);
          sfx.coin();
          const ar = armyById(this.state, e.army);
          if (ar) fx.placed(this.board, ar.tile, 1);
          break;
        }
        case 'spellCast': {
          this.board.sync(this.state);
          sfx.magic();
          this.toast(`${FACTIONS[e.p].short} cast ${SPELLS[e.p].name}!`, 'info', e.p);
          if (e.spell === 'colossus') await fx.abilityScene(this.board, e.tile, 'raise', this.q('.board-host'));
          if (e.spell === 'wall') await fx.abilityScene(this.board, e.tile, 'build', this.q('.board-host'));
          if (e.spell === 'volley') { const ar = armyById(this.state, e.army); if (ar) await fx.volley(this.board, ar.tile, e.tile, 'elves', 6); }
          break;
        }
        case 'wallFallen': {
          this.board.sync(this.state);
          sfx.thud();
          fx.confetti(this.board, e.tile, ['#b3a998', '#7d7466'], 14);
          break;
        }
        case 'raised': {
          await this.dice.playRaise(e.raise);
          this.board.sync(this.state);
          if (e.raise.raised) {
            const at = armyById(this.state, e.raise.army)?.tile ?? e.tile;
            void fx.abilityScene(this.board, at, 'raise', this.q('.board-host'));
            fx.floatText(this.board, at, `+${e.raise.raised} risen`, 'info', -26);
          }
          break;
        }
        case 'dismissed': {
          this.board.sync(this.state);
          sfx.coin();
          this.toast(`Dismissed ${plural(e.units, 'unit')} for ${e.refund} gold.`, 'info', e.p);
          break;
        }
        case 'upkeep': {
          if (this.controlsCurrent() || e.p === this.viewer()) {
            this.toast(e.unpaid ? `Could not pay ${e.unpaid} gold upkeep: ${plural(e.armies.length, 'army', 'armies')} on low morale (−1 attack and defence)!` : `Paid ${e.paid} gold upkeep for armies above ${ARMY_FREE_SIZE} units.`, e.unpaid ? 'warn' : 'info', e.p);
          }
          break;
        }
        case 'pillaged': {
          fx.floatText(this.board, e.tile, `+${e.gold} gold`, 'gain', -30);
          sfx.coin();
          break;
        }
        case 'split':
        case 'merged': {
          this.board.sync(this.state);
          fx.popBadge(this.board, e.tile);
          sfx.select();
          if (e.type === 'split') this.selArmy = e.newArmy;
          break;
        }
        case 'recruited': {
          this.board.sync(this.state);
          fx.placed(this.board, e.city, 1);
          sfx.coin();
          if (watching) { this.board.focus([e.city]); await fx.wait(200); }
          break;
        }
        case 'buildStarted': {
          this.board.sync(this.state);
          sfx.thud();
          await fx.abilityScene(this.board, e.tile, 'build', this.q('.board-host'));
          if (e.kind !== 'improve') this.toast(e.kind === 'city' ? `${FACTIONS[e.p].short} start building a city (2 turns).` : `${FACTIONS[e.p].short} upgrade a city (1 turn).`, 'info', e.p);
          break;
        }
        case 'built': {
          this.board.sync(this.state);
          sfx.fanfare();
          fx.bounceTile(this.board, e.tile, 1.4);
          fx.confetti(this.board, e.tile, [FACTIONS[e.p].color, '#ffd23f', '#fffdf5'], 16);
          if (e.kind === 'improve') { fx.floatText(this.board, e.tile, `+${e.level} gold/turn`, 'gain', -20); break; }
          this.toast(e.kind === 'city' ? `A new ${FACTIONS[e.p].short} city is finished!` : `City upgraded to level ${e.level}: its guard is now a tier-${garrisonTier(e.level)} unit.`, 'good', e.p);
          break;
        }
        case 'grown': {
          this.board.sync(this.state);
          sfx.magic();
          if (watching) this.board.focus([e.tile]);
          await fx.abilityScene(this.board, e.tile, 'enchant', this.q('.board-host'));
          break;
        }
        case 'healed': {
          const byArmy = new Map<number, number>();
          for (const h of e.units) byArmy.set(h.army, (byArmy.get(h.army) ?? 0) + 1);
          for (const [id, n] of byArmy) { const ar = armyById(this.state, id); if (ar) fx.floatText(this.board, ar.tile, `+${n} HP`, 'gain', 10); }
          break;
        }
        case 'cityFallen': {
          this.board.sync(this.state);
          sfx.conquer();
          fx.shakeTile(this.board, e.city);
          if (e.from === this.viewer()) this.toast(`${FACTIONS[e.p].short} have stormed your city!`, 'warn', e.p);
          break;
        }
        case 'cityRazed': {
          this.board.sync(this.state);
          sfx.doom();
          fx.confetti(this.board, e.city, ['#5a4a3c', '#8a7a6a', '#ff8a3c'], 18);
          fx.floatText(this.board, e.city, `+${e.gold} gold`, 'gain', -30);
          this.toast(`${FACTIONS[e.p].short} razed a ${FACTIONS[e.from].short} city!`, 'warn', e.p);
          break;
        }
        case 'cityCaptured': {
          this.board.sync(this.state);
          sfx.conquer();
          await fx.conquest(this.board, e.city, e.p);
          this.toast(`${FACTIONS[e.p].short} captured a ${FACTIONS[e.from].short} city!`, 'good', e.p);
          break;
        }
        case 'eliminated': {
          this.board.sync(this.state);
          sfx.doom();
          await this.bigBanner(`${FACTIONS[e.p].name} have fallen!`, e.reason === 'cities' ? `${NO_CITY_LIMIT} rounds without a city.` : 'Their last army was destroyed.', e.p);
          break;
        }
        case 'turn': {
          this.selArmy = null;
          this.selOther = null;
          this.mode = null;
          this.selCity = null;
          this.selTile = null;
          this.splitPick = null;
          const key = `${e.turn}-${e.p}`;
          if (key !== this.lastTurnKey) {
            this.lastTurnKey = key;
            this.refresh();
            if (this.controlsCurrent()) this.board.fit(true);
            await this.turnBanner(e.p);
            if (this.controlsCurrent()) {
              const pl = this.state.players.find((x) => x.faction === e.p)!;
              const warn = pl.noCity ? `  ·  No city for ${pl.noCity}/${NO_CITY_LIMIT} rounds!` : '';
              const i = e.income;
              const parts = [i.plains && `${i.plains} plains`, i.mountains && `${i.mountains} mountains`, i.forests >= 2 && `${Math.floor(i.forests / 2)} from forests`, i.cities && `${i.cities * 3 + i.coastal} from cities`, i.improvements && `${i.improvements} from improvements`, i.enchanted >= 3 && `${Math.floor(i.enchanted / 3)} enchanted`].filter(Boolean).join(', ');
              this.toast(`+${i.gold} gold (${parts})${i.upkeep ? `  ·  upkeep −${i.upkeep}` : ''}${warn}`, pl.noCity ? 'warn' : 'info', e.p);
            }
          }
          break;
        }
        case 'victory': {
          this.board.sync(this.state);
          this.refresh();
          await fx.wait(400);
          this.showVictory(e.p);
          break;
        }
      }
    }
    void a;
  }

  private hideStack(tile: number, hide: boolean) {
    const v = this.board.view(tile);
    if (v) v.badge.style.opacity = hide ? '0' : '';
  }

  // ---------------- Input ----------------
  private myArmiesAt(tile: number) {
    const f = currentPlayer(this.state).faction;
    return armiesAt(this.state, tile).filter((a) => a.owner === f);
  }

  /** Regions the current targeting mode accepts. */
  private modeTargets(): number[] {
    const s = this.state;
    const f = currentPlayer(s).faction;
    const ar = this.selArmy !== null ? armyById(s, this.selArmy) : undefined;
    const regions = landRegions(s).map((t) => t.id);
    switch (this.mode) {
      case 'terraform': return ar ? terraformTargets(s, ar) : [];
      case 'volley': return ar ? regions.filter((t) => !validate(s, { type: 'spell', p: f, army: ar.id, target: t })) : [];
      case 'wall': return regions.filter((t) => !validate(s, { type: 'spell', p: f, army: -1, target: t }));
      case 'treant': return regions.filter((t) => this.selCity !== null && !validate(s, { type: 'recruit', p: f, city: this.selCity, unit: 'treant', at: t }));
      case 'build': return [...this.buildActions().keys()];
      default: return [];
    }
  }

  /** Everything the build mode can do right now, by region: improve land, grow forest, upgrade cities. */
  private buildActions(): Map<number, Action> {
    const s = this.state;
    const out = new Map<number, Action>();
    if (!this.controlsCurrent() || s.pendingFight || s.pendingCity) return out;
    const f = currentPlayer(s).faction;
    const ok = (a: Action) => !validate(s, a);
    if (f === 'elves') {
      for (const c of ownCities(s, f)) {
        if (c.grew) continue;
        for (const t of growTargets(s, c.tile)) {
          const a: Action = { type: 'grow', p: f, city: c.tile, tile: t };
          if (!out.has(t) && ok(a)) out.set(t, a);
        }
      }
    } else {
      for (const t of ownedRegions(s, f)) {
        const a: Action = { type: 'improve', p: f, tile: t.id };
        if (ok(a)) out.set(t.id, a);
      }
    }
    for (const c of ownCities(s, f)) {
      const a: Action = { type: 'upgrade', p: f, city: c.tile };
      if (ok(a)) out.set(c.tile, a);
    }
    return out;
  }

  /** Why the build mode has nothing to offer. */
  private buildBlocked(): string {
    const s = this.state;
    const p = currentPlayer(s);
    if (p.faction === 'elves') {
      const cs = ownCities(s, p.faction);
      if (cs.length && cs.every((c) => c.grew)) return 'Every city has grown its forest this turn.';
      return p.gold < UPGRADE_COST(p.faction) ? 'No region to grow a forest on, and not enough gold to upgrade a city.' : 'Nothing to grow or upgrade right now.';
    }
    return p.gold < IMPROVE_COST[0] ? `Not enough gold: improving costs ${IMPROVE_COST[0]}.` : 'Nothing left to improve right now.';
  }

  private toggleBuild() {
    if (!this.controlsCurrent() || this.busy) return;
    if (this.mode === 'build') { this.mode = null; sfx.click(); this.refresh(); return; }
    if (!this.buildActions().size) { sfx.error(); this.toast(this.buildBlocked(), 'warn'); return; }
    this.clearSel();
    fx.clearAim(this.board);
    this.hideTooltip();
    this.mode = 'build';
    sfx.select();
    this.refresh();
  }

  /** Clicks only select. Armies march and attack by drag and drop. */
  private onTileClick(id: number) {
    if (!this.controlsCurrent() || this.busy) {
      if (id >= 0) this.showTooltip(id, 0, 0, true);
      return;
    }
    if (id < 0) { this.cancel(); return; }
    const s = this.state;
    const f = currentPlayer(s).faction;
    const sel = this.selArmy !== null ? armyById(s, this.selArmy) : undefined;
    if (this.mode === 'build') {
      // Stays on until switched off or nothing is left to build.
      const act = this.buildActions().get(id);
      if (act) this.submit(act); else sfx.error();
      return;
    }
    if (this.mode) {
      const mode = this.mode;
      const targets = this.modeTargets();
      this.mode = null;
      if (targets.includes(id)) {
        if (mode === 'terraform' && sel) this.submit({ type: 'terraform', p: f, army: sel.id, target: id });
        if (mode === 'volley' && sel) this.submit({ type: 'spell', p: f, army: sel.id, target: id });
        if (mode === 'wall') this.submit({ type: 'spell', p: f, army: -1, target: id });
        if (mode === 'treant' && this.selCity !== null) this.submit({ type: 'recruit', p: f, city: this.selCity, unit: 'treant', at: id });
      } else { sfx.error(); }
      this.refresh();
      return;
    }
    const fo = fortressAt(s, id);
    if (fo?.discovered) { this.clearSel(); this.selFort = id; sfx.select(); this.refresh(); return; }

    const mine = this.myArmiesAt(id);
    const city = cityAt(s, id);
    if (mine.length) {
      // Cycle through the armies in this region, then the city panel.
      const idx = sel ? mine.findIndex((a) => a.id === sel.id) : -1;
      if (idx >= 0 && idx < mine.length - 1) this.selectArmy(mine[idx + 1].id);
      else if (idx >= 0 && city && city.owner === f) this.selectCity(id);
      else if (idx >= 0) this.cancel();
      else this.selectArmy(mine[0].id);
      return;
    }
    if (city && city.owner === f) { this.selectCity(id); return; }
    const others = armiesAt(s, id);
    if (others.length) {
      // Look at a rival army.
      this.clearSel();
      this.selOther = others[(others.findIndex((a) => a.id === this.selOther) + 1) % others.length].id;
      sfx.select();
      this.refresh();
      this.showTooltip(id, 0, 0, true);
      return;
    }
    if (s.tiles[id].owner === f) { this.clearSel(); this.selTile = id; sfx.select(); this.refresh(); return; }
    this.cancel();
    this.showTooltip(id, 0, 0, true);
  }

  // ---------------- Drag and drop ----------------
  private dragStart(id: number): boolean {
    if (!this.controlsCurrent() || this.busy || this.mode || this.state.pendingFight || this.state.pendingCity) return false;
    const mine = this.myArmiesAt(id);
    if (!mine.length) return false;
    const ar = mine.find((a) => a.id === this.selArmy) ?? mine.find((a) => a.mp > 0) ?? mine[0];
    this.dragArmy = ar.id;
    if (this.selArmy !== ar.id) this.selectArmy(ar.id);
    return true;
  }

  private dragMove(id: number | null, x: number, y: number) {
    const ar = this.dragArmy !== null ? armyById(this.state, this.dragArmy) : undefined;
    this.hideTooltip();
    if (!ar || id === null || id === ar.tile) { fx.clearAim(this.board); return; }
    if (attackTargets(this.state, ar).includes(id)) {
      fx.showAim(this.board, ar.tile, id, 'attack', ar.owner as FactionId);
      this.showTooltip(id, x, y - 40, false);
      return;
    }
    const r = this.reach.get(id);
    if (r && r.stop) fx.showPath(this.board, ar.tile, pathTo(this.reach, id), r.cost, ar.mp - r.cost);
    else fx.showAim(this.board, ar.tile, id, 'blocked');
  }

  private drop(id: number | null) {
    const ar = this.dragArmy !== null ? armyById(this.state, this.dragArmy) : undefined;
    this.dragArmy = null;
    fx.clearAim(this.board);
    if (!ar || id === null || id === ar.tile || !this.controlsCurrent() || this.busy) return;
    const s = this.state;
    const f = ar.owner as FactionId;
    if (attackTargets(s, ar).includes(id)) { this.submit({ type: 'attack', p: f, army: ar.id, target: id }); return; }
    const r = this.reach.get(id);
    if (r && r.stop) { this.submit({ type: 'move', p: f, army: ar.id, path: pathTo(this.reach, id) }); return; }
    const enemy = armiesAt(s, id).some((a) => a.owner !== f) || (cityAt(s, id) && cityAt(s, id)!.owner !== f) || !!wallAt(s, id);
    this.toast(enemy ? (attackError(s, ar, id) ?? 'Cannot attack there.') : ar.mp <= 0 ? 'This army has no movement left.' : 'Not enough movement to get there.', 'warn');
    sfx.error();
  }

  private clearSel() {
    this.selArmy = null;
    this.selCity = null;
    this.selTile = null;
    this.selFort = null;
    this.selOther = null;
    this.mode = null;
    this.splitPick = null;
  }

  private selectArmy(id: number | null) {
    this.clearSel();
    this.selArmy = id;
    if (id !== null) sfx.select();
    fx.clearAim(this.board);
    this.refresh();
  }

  private selectCity(tile: number) {
    this.clearSel();
    this.selCity = tile;
    sfx.select();
    fx.clearAim(this.board);
    this.refresh();
  }

  private cancel() {
    this.clearSel();
    fx.clearAim(this.board);
    this.hideTooltip();
    this.refresh();
  }

  private onHover(id: number | null, x: number, y: number) {
    if (id === null || this.dragArmy !== null) { if (id === null) this.hideTooltip(); return; }
    this.showTooltip(id, x, y, false);
  }

  private onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (this.destroyed || tag === 'INPUT' || tag === 'TEXTAREA' || ((tag === 'BUTTON' || tag === 'SUMMARY') && (e.key === ' ' || e.key === 'Enter'))) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (this.q('.modal.open')) this.closeModal(); else this.cancel(); }
    else if (k === 'enter') { if (!this.q('.modal.open')) { e.preventDefault(); this.endTurn(); } }
    else if (k === 'tab') { e.preventDefault(); this.cycleArmy(); }
    else if (k === '+' || k === '=') this.board.zoomBy(1.2);
    else if (k === '-') this.board.zoomBy(1 / 1.2);
    else if (k === 'f') this.board.fit(true);
    else if (k === 'b') this.toggleBuild();
  }

  /** Select the next own army that can still act. */
  private cycleArmy() {
    if (!this.controlsCurrent()) return;
    const mine = ownArmies(this.state, currentPlayer(this.state).faction).filter((a) => a.mp > 0);
    if (!mine.length) return;
    const i = mine.findIndex((a) => a.id === this.selArmy);
    const next = mine[(i + 1) % mine.length];
    this.selectArmy(next.id);
    this.board.focus([next.tile]);
  }

  private endTurn() {
    if (!this.controlsCurrent() || this.busy) return;
    sfx.click();
    this.cancel();
    this.submit({ type: 'endTurn', p: currentPlayer(this.state).faction });
  }

  // ---------------- HUD ----------------
  private template(): string {
    return `
      <div class="board-host"></div>
      <header class="topbar plank">
        <div class="turn"><span class="turn-crest"></span><div class="turn-text"><b class="turn-name"></b><span class="turn-sub"></span></div></div>
        <div class="res">
          <span class="res-item res-gold" title="Gold">${ICONS.gold}<b></b><small></small></span>
          <span class="res-item res-cities" title="Cities">${ICONS.home}<b></b></span>
          <span class="res-item res-units" title="Units">${ICONS.troops}<b></b></span>
          <span class="res-item res-spell">${ICONS.bolt}<b></b></span>
        </div>
        <div class="top-btns">
          <button class="icon-btn btn-sound" aria-label="Toggle sound"></button>
          <button class="icon-btn btn-menu" aria-label="Menu">${ICONS.gear}</button>
        </div>
      </header>
      <aside class="players"></aside>
      <section class="command plank hidden" aria-live="polite"></section>
      <div class="hint"><span class="hint-text"></span></div>
      <div class="zoom">
        <button class="icon-btn btn-next" aria-label="Next army" title="Next army (Tab)">${ICONS.march}</button>
        <button class="icon-btn btn-zoom-in" aria-label="Zoom in">${ICONS.plus}</button>
        <button class="icon-btn btn-zoom-out" aria-label="Zoom out">${ICONS.minus}</button>
      </div>
      <button class="build-btn" aria-label="Build mode" title="Build mode (B)"><span class="build-ico"></span><span class="build-label"></span><b class="build-count"></b></button>
      <button class="btn go primary"><span class="primary-label">End turn</span></button>
      <div class="tooltip" role="tooltip"></div>
      <div class="banner"></div>
      <div class="toasts" aria-live="polite"></div>
      <div class="modal"><div class="modal-card plank"></div></div>`;
  }

  private measureInsets() {
    const set = () => {
      const m = innerWidth < 760;
      this.board.insets = m ? { top: 150, bottom: 210, left: 6, right: 6 } : { top: 92, bottom: 170, left: 24, right: innerWidth > 1100 ? 250 : 24 };
    };
    set();
    addEventListener('resize', set);
  }

  private bindHud() {
    this.q('.primary').addEventListener('click', () => this.endTurn());
    this.q('.btn-menu').addEventListener('click', () => { sfx.click(); this.openMenu(); });
    const snd = this.q('.btn-sound');
    const setSnd = () => { snd.innerHTML = sfx.muted ? ICONS.soundOff : ICONS.soundOn; };
    setSnd();
    snd.addEventListener('click', () => { sfx.toggle(); setSnd(); sfx.click(); });
    this.q('.btn-zoom-in').addEventListener('click', () => this.board.zoomBy(1.25));
    this.q('.btn-zoom-out').addEventListener('click', () => this.board.zoomBy(1 / 1.25));
    this.q('.btn-next').addEventListener('click', () => this.cycleArmy());
    this.q('.build-btn').addEventListener('click', () => this.toggleBuild());
    this.q('.command').addEventListener('click', (e) => this.onCommand(e));
    this.q('.modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) this.closeModal(); });
  }

  private onCommand(e: Event) {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-cmd]');
    if (!b || !this.controlsCurrent() || this.busy) return;
    const f = currentPlayer(this.state).faction;
    const cmd = b.dataset.cmd!;
    const ar = this.selArmy !== null ? armyById(this.state, this.selArmy) : undefined;
    sfx.click();
    switch (cmd) {
      case 'close': this.cancel(); break;
      case 'split': case 'dismiss': if (ar) { this.pickMode = cmd; this.splitPick = new Set(); this.refresh(); } break;
      case 'split-cancel': this.splitPick = null; this.refresh(); break;
      case 'split-ok': if (ar && this.splitPick) { this.submit({ type: this.pickMode, p: f, army: ar.id, units: [...this.splitPick] }); this.splitPick = null; } break;
      case 'noop': { const id = b.dataset.army ? Number(b.dataset.army) : ar?.id; if (id !== undefined) this.openUnit(id, Number(b.dataset.unit)); break; }
      case 'improve': { const tile = this.selTile ?? ar?.tile; if (tile !== undefined && tile !== null) this.submit({ type: 'improve', p: f, tile }); break; }
      case 'pick': {
        if (!this.splitPick) break;
        const id = Number(b.dataset.unit);
        if (this.splitPick.has(id)) this.splitPick.delete(id); else this.splitPick.add(id);
        this.refresh();
        break;
      }
      case 'merge': if (ar) this.submit({ type: 'merge', p: f, tile: ar.tile }); break;
      case 'build': if (ar) this.submit({ type: 'build', p: f, army: ar.id }); break;
      case 'other': {
        if (!ar) break;
        const other = this.myArmiesAt(ar.tile).find((x) => x.id !== ar.id);
        if (other) this.selectArmy(other.id);
        break;
      }
      case 'recruit': {
        if (this.selCity === null) break;
        if (b.dataset.unit === 'treant') { this.mode = 'treant'; this.refresh(); this.toast('Pick an enchanted forest for the Treant. That forest becomes plains.', 'info'); break; }
        this.submit({ type: 'recruit', p: f, city: this.selCity, unit: b.dataset.unit as UnitType });
        break;
      }
      case 'terraform': this.mode = this.mode === 'terraform' ? null : 'terraform'; this.refresh(); break;
      case 'spell': {
        if (f === 'necro' && ar) this.submit({ type: 'spell', p: f, army: ar.id });
        else { this.mode = f === 'elves' ? 'volley' : 'wall'; this.refresh(); }
        break;
      }
      case 'mode-cancel': this.mode = null; this.refresh(); break;
      case 'hire': {
        if (this.selFort === null) break;
        const army = ownArmies(this.state, f).find((x) => neighbors(this.state)[this.selFort!].includes(x.tile))?.id;
        if (army !== undefined) this.submit({ type: 'hire', p: f, fortress: this.selFort, unit: b.dataset.unit as UnitType, army });
        break;
      }
      case 'upgrade': if (this.selCity !== null) this.submit({ type: 'upgrade', p: f, city: this.selCity }); break;
      case 'select-recruits': {
        if (this.selCity === null) break;
        const inCity = this.myArmiesAt(this.selCity)[0];
        if (inCity) this.selectArmy(inCity.id);
        break;
      }
    }
  }

  refresh() {
    if (this.destroyed) return;
    const s = this.state;
    const p = currentPlayer(s);
    const fac = FACTIONS[p.faction];
    const mine = this.controlsCurrent();
    const viewer = this.viewer();
    this.el.style.setProperty('--turn', fac.color);
    this.el.style.setProperty('--turn-dark', fac.dark);
    this.el.style.setProperty('--turn-light', fac.light);
    this.el.classList.toggle('my-turn', mine);

    const bb = this.q('.build-btn');
    const buildable = mine && !this.busy ? this.buildActions().size : 0;
    bb.classList.toggle('hidden', !mine || s.phase === 'over');
    bb.classList.toggle('on', this.mode === 'build');
    bb.classList.toggle('empty', !buildable && this.mode !== 'build');
    const elfBuild = p.faction === 'elves';
    if (bb.dataset.f !== p.faction) { bb.dataset.f = p.faction; this.q('.build-ico').innerHTML = elfBuild ? ICONS.sapling : ICONS.hammer; }
    this.q('.build-label').textContent = this.mode === 'build' ? 'Done' : elfBuild ? 'Grow' : 'Improve';
    this.q('.build-count').textContent = buildable && this.mode !== 'build' ? String(buildable) : '';
    const crestEl = this.q('.turn-crest');
    if (crestEl.dataset.f !== p.faction) { crestEl.dataset.f = p.faction; crestEl.innerHTML = crest(p.faction); }
    this.q('.turn-name').textContent = fac.short;
    const who = mine ? (this.online || s.players.filter((x) => x.kind === 'human').length > 1 ? `${p.name}, your move` : 'Your move') : p.kind === 'ai' ? 'AI is plotting…' : `${p.name} is playing…`;
    this.q('.turn-sub').innerHTML = `<span class="turn-round">Round ${s.turn} · </span>${esc(who)}`;
    const shown = viewer ? s.players.find((x) => x.faction === viewer)! : p;
    this.q('.res-gold b').textContent = String(shown.gold);
    const inc = computeIncome(s, shown.faction);
    const net = inc.gold - inc.upkeep;
    const incEl = this.q('.res-gold small');
    incEl.textContent = `${net >= 0 ? '+' : '−'}${Math.abs(net)}`;
    incEl.classList.toggle('bad', net < 0 || inc.upkeep > 0);
    this.q('.res-gold').title = `Gold. Next turn +${inc.gold}${inc.upkeep ? `, upkeep −${inc.upkeep}` : ''}.`;
    this.q('.res-cities b').textContent = String(ownCities(s, shown.faction).length);
    this.q('.res-units b').textContent = String(unitCount(s, shown.faction));
    const sp = this.q('.res-spell');
    sp.querySelector('b')!.textContent = shown.spell ? String(shown.spell) : 'Ready';
    sp.classList.toggle('hot', !shown.spell);
    sp.title = `${SPELLS[shown.faction].name}: ${SPELLS[shown.faction].text} ${shown.spell ? `Ready in ${shown.spell} turn${shown.spell > 1 ? 's' : ''}.` : 'Ready! Use it from an army panel.'}`;
    this.q('.res-cities').classList.toggle('hot', shown.noCity > 0);

    this.renderPlayers();

    // Selection and reach.
    const sel = this.selArmy !== null ? armyById(s, this.selArmy) : undefined;
    if (!sel || sel.owner !== p.faction) this.selArmy = null;
    this.reach = sel && mine ? reachable(s, sel) : new Map();

    const prim = this.q<HTMLButtonElement>('.primary');
    prim.classList.toggle('hidden', !mine);
    prim.classList.toggle('waiting', !!s.pendingFight);
    this.q('.primary-label').textContent = 'End turn';

    this.renderCommand();
    this.renderHint();
    this.applyMarks();
  }

  private renderPlayers() {
    const s = this.state;
    const cur = currentPlayer(s).faction;
    const land = landRegions(s).length;
    this.q('.players').innerHTML = s.players.map((pl) => {
      const units = unitCount(s, pl.faction);
      const cities = ownCities(s, pl.faction).length;
      const hexes = ownedRegions(s, pl.faction).length;
      const tag = pl.kind === 'ai' ? 'AI' : this.online || s.players.filter((x) => x.kind === 'human').length > 1 ? esc(pl.name) : 'You';
      return `<div class="pl ${pl.faction === cur ? 'current' : ''} ${pl.alive ? '' : 'dead'}" style="--c:${FACTIONS[pl.faction].color}">
        ${pl.alive ? crest(pl.faction, 'pl-crest') : `<span class="pl-crest dead-ico">${ICONS.skull}</span>`}
        <div class="pl-main"><div class="pl-name">${FACTIONS[pl.faction].short}<span class="pl-tag">${tag}</span></div>
        <div class="pl-bar"><i style="width:${((hexes / land) * 100).toFixed(1)}%"></i></div>
        <div class="pl-stats"><span>${plural(units, 'unit')}</span><span class="${pl.noCity ? 'bad' : ''}">${pl.noCity ? `no city ${pl.noCity}/${NO_CITY_LIMIT}` : plural(cities, 'city', 'cities')}</span><span>${plural(hexes, 'region')}</span></div></div>
      </div>`;
    }).join('');
  }

  private renderCommand() {
    const box = this.q('.command');
    const s = this.state;
    const mine = this.controlsCurrent();
    const p = currentPlayer(s);
    const f = p.faction;
    const ar = this.selArmy !== null ? armyById(s, this.selArmy) : undefined;
    const other = this.selOther !== null ? armyById(s, this.selOther) : undefined;
    if (mine && other) {
      // Read-only look at a rival army.
      box.classList.remove('hidden');
      const t = s.tiles[other.tile];
      const def = defenseBonus(s, t, other.owner);
      const chips = [...other.units].sort((a, b) => hitRank(b.type) - hitRank(a.type) || a.hp - b.hp).map((u) =>
        `<button class="uchip" data-cmd="noop" data-army="${other.id}" data-unit="${u.id}" title="${UNIT_STATS[u.type].name}: details">${portrait(u)}</button>`).join('');
      box.innerHTML = `<div class="cmd-head"><b>${FACTION_NAME(other.owner)} army</b><span>${plural(other.units.length, 'unit')} · ${regionOf(s, other.tile)?.name ?? ''} · defence +${def.total}${def.labels.length ? ` (${def.labels.join(', ')})` : ''}</span><button class="icon-btn small cmd-close" data-cmd="close" aria-label="Close">${ICONS.close}</button></div>
        <div class="uchips">${chips}</div>
        <div class="cmd-actions"><span class="cmd-note">Drag one of your armies onto it to attack.</span></div>`;
      return;
    }
    if (!mine || (this.mode !== 'build' && !ar && this.selCity === null && this.selTile === null && this.selFort === null)) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    const btn = (cmd: string, label: string, opts: { disabled?: string | null; cls?: string; ico?: string } = {}) =>
      `<button class="btn small ${opts.cls ?? ''}" data-cmd="${cmd}" ${opts.disabled ? `disabled title="${esc(opts.disabled)}"` : ''}>${opts.ico ?? ''}${label}</button>`;
    const close = `<button class="icon-btn small cmd-close" data-cmd="close" aria-label="Close">${ICONS.close}</button>`;
    if (this.mode === 'build') {
      const elves = f === 'elves';
      const n = this.buildActions().size;
      const what = elves
        ? `Tap a glowing region to grow an enchanted forest (each city once per turn, next to it), or a city to upgrade it (${UPGRADE_COST(f)} gold).`
        : `Tap a glowing region to improve it: +1 gold per turn for ${IMPROVE_COST[0]} gold (level 2: ${IMPROVE_COST[1]}). Tap a city to upgrade it (${UPGRADE_COST(f)} gold).`;
      box.innerHTML = `<div class="cmd-head"><b>${elves ? 'Grow & build' : 'Improve & build'}</b><span>${what} ${plural(n, 'option')} left.</span>${close}</div>
        <div class="cmd-actions">${btn('mode-cancel', 'Done', { cls: 'go', ico: ICONS.check })}</div>`;
      return;
    }
    if (this.mode) {
      const what = { terraform: f === 'necro' ? 'Pick a forest to blight.' : 'Pick a forest to clear into plains.', volley: 'Pick an enemy army next to the archers.', wall: 'Pick an empty region next to one of your armies.', treant: 'Pick one of your enchanted forests.'}[this.mode];
      const title = { treant: 'Awaken a Treant', terraform: f === 'necro' ? 'Blight forest' : 'Clear forest', volley: SPELLS[f].name, wall: SPELLS[f].name }[this.mode];
      box.innerHTML = `<div class="cmd-head"><b>${title}</b><span>${what}</span>${close}</div>
        <div class="cmd-actions">${btn('mode-cancel', 'Cancel', { cls: 'ghost' })}</div>`;
      return;
    }
    if (this.selFort !== null) {
      const fo = this.selFort;
      const next = ownArmies(s, f).find((x) => neighbors(s)[fo].includes(x.tile));
      const finder = fortressAt(s, fo)?.finder ?? null;
      box.innerHTML = `<div class="cmd-head"><b>Dwarf fortress</b><span>Mercenaries join an army standing next to the fortress. ${finder === f ? 'You found it: 6 gold each.' : `${finder ? FACTIONS[finder].short + ' found it, so you pay' : 'You pay'} 9 gold.`}${next ? '' : ' <em class="warn">Move an army next to it first.</em>'}</span>${close}</div>
        <div class="recruits">${DWARF_UNITS.map((u) => {
          const st = UNIT_STATS[u];
          const cost = hireCost(s, fo, f);
          return `<button class="rcard" data-cmd="hire" data-unit="${u}" ${!next || p.gold < cost ? 'disabled' : ''} title="${esc(st.ability ?? '')}">${unitSvg(u)}<b>${st.name}</b><span class="rstats">+2/+2 vs ${FACTIONS[st.counters!].short}</span><span class="card-cost">${ICONS.gold}${cost}</span></button>`;
        }).join('')}</div>`;
      return;
    }

    if (ar) {
      const here = this.myArmiesAt(ar.tile);
      const t = s.tiles[ar.tile];
      const pick = this.splitPick;
      const chips = [...ar.units].sort((a, b) => hitRank(b.type) - hitRank(a.type) || a.hp - b.hp).map((u) =>
        `<button class="uchip ${pick?.has(u.id) ? 'picked' : ''}" data-cmd="${pick ? 'pick' : 'noop'}" data-unit="${u.id}" title="${UNIT_STATS[u.type].name}: details">${portrait(u)}</button>`).join('');
      const splitErr = validate(s, { type: 'split', p: f, army: ar.id, units: [ar.units[0]?.id ?? -1] });
      const buildErr = validate(s, { type: 'build', p: f, army: ar.id });
      const targets = attackTargets(s, ar).length;
      const upkeep = upkeepOf(ar);
      const def = defenseBonus(s, t, f);
      const status = `${plural(ar.units.length, 'unit')}${upkeep ? ` <em class="warn">(${ar.units.length - ARMY_FREE_SIZE} over ${ARMY_FREE_SIZE}: upkeep ${upkeep} gold/turn)</em>` : ''} · <b>${ar.mp}/${MOVE_POINTS}</b> movement · ${ar.attacked ? 'attacked this turn' : targets ? `${plural(targets, 'target')} in reach` : 'no attack used'}${ar.lowMorale ? ' · <em class="bad">low morale −1/−1</em>' : ''}`;
      const pickGold = pick ? ar.units.filter((u) => pick.has(u.id)).reduce((n, u) => n + refund(u.type), 0) : 0;
      const pickActions = pick ? (this.pickMode === 'split'
        ? `<span class="cmd-note">Tap units to split off (${pick.size} chosen)</span>${btn('split-cancel', 'Cancel', { cls: 'ghost' })}${btn('split-ok', `Split off ${pick.size}`, { cls: 'go', disabled: pick.size && pick.size < ar.units.length ? null : 'Pick at least one unit, but not all.' })}`
        : `<span class="cmd-note">Tap units to dismiss. You get a third of their price back.</span>${btn('split-cancel', 'Cancel', { cls: 'ghost' })}${btn('split-ok', `Dismiss ${pick.size} · +${pickGold} gold`, { cls: 'danger', disabled: pick.size ? null : 'Pick at least one unit.' })}`) : '';
      box.innerHTML = `
        <div class="cmd-head"><b>Army</b><span>${status}</span>${close}</div>
        <div class="uchips ${pick ? 'picking' : ''}">${chips}</div>
        <div class="cmd-actions">${pick ? pickActions
          : `${here.length === 2 ? btn('merge', 'Merge armies', { cls: 'go' }) + btn('other', 'Other army') : btn('split', 'Split', { disabled: splitErr && !splitErr.startsWith('Choose') ? splitErr : ar.units.length < 2 ? 'Needs at least 2 units.' : null })}
             ${btn('dismiss', 'Dismiss', { cls: 'ghost' })}
             ${btn('build', `Build city · ${CITY_COST(f)}`, { ico: ICONS.home, disabled: buildErr })}
             ${(f === 'necro' || ar.units.some((u) => u.type === 'mammoth')) ? btn('terraform', f === 'necro' ? 'Blight forest' : 'Clear forest', { ico: f === 'necro' ? ICONS.skull : ICONS.march, disabled: terraformTargets(s, ar).length ? null : ar.attacked ? 'Uses the attack for this turn.' : 'No healthy forest here or next to the army.' }) : ''}
             ${btn('spell', `${SPELLS[f].name}${p.spell ? ` (${p.spell})` : ''}`, { cls: p.spell ? '' : 'spell', ico: ICONS.bolt, disabled: p.spell ? `Recharges in ${p.spell} turn${p.spell > 1 ? 's' : ''}.` : f === 'necro' ? validate(s, { type: 'spell', p: f, army: ar.id }) : f === 'elves' && !ar.units.some((u) => u.type === 'archer') ? 'Needs archers in this army.' : null })}
             <span class="cmd-note">${TERRAIN_INFO[t.terrain].name}: defence +${def.total}${def.labels.length ? ` (${def.labels.join(', ')})` : ''}</span>`}
        </div>`;
      return;
    }
    if (this.selTile !== null) {
      const t = s.tiles[this.selTile];
      const yieldNow = (t.terrain === 'plains' || t.terrain === 'mountain' ? 1 : t.terrain === 'forest' ? 0.5 : 0) + t.improved;
      const building = s.builds.find((b) => b.tile === t.id);
      box.innerHTML = `
        <div class="cmd-head"><b>${TERRAIN_INFO[t.terrain].name}</b><span>Yields ${yieldNow} gold per turn${t.improved ? ` (improved ${t.improved}/${MAX_IMPROVE})` : ''}${building ? ` · ${building.kind === 'improve' ? 'improvement' : 'building'} ready next turn` : ''}</span>${close}</div>
        <div class="cmd-actions"><span class="cmd-note">${f === 'elves' ? 'Evergarden earns from cities and enchanted forests. Grow forests with the build button (bottom left).' : `Improve the whole region with the build button (bottom left): +1 gold each, max ${MAX_IMPROVE}. Improvements are destroyed if a rival takes the region.`}</span></div>`;
      return;
    }
    // City panel
    const c = cityAt(s, this.selCity!)!;
    const garrison = this.myArmiesAt(c.tile)[0];
    const guard = garrisonUnit(c);
    const upErr = validate(s, { type: 'upgrade', p: f, city: c.tile });
    const coastal = isCoastal(s, c.tile);
    box.innerHTML = `
      <div class="cmd-head"><b>${c.capital ? 'Capital' : 'City'}${c.level ? ` · level ${c.level}` : ''}</b><span>+${coastal ? 4 : 3} gold${coastal ? ' (by the sea)' : ''} · defence +${c.capital ? CITY_TUNE.capitalDef : CITY_TUNE.cityDef} inside · guard: ${UNIT_STATS[guard.type].name} (tier ${garrisonTier(c.level, c.capital)}) · ${CITY_ASSAULTS - c.assaults}/${CITY_ASSAULTS} assaults left this round</span>${close}</div>
      <div class="recruits">${recruitable(f).map((u) => {
        const st = UNIT_STATS[u];
        const cost = recruitCost(f, u);
        const capped = st.tier === 3 && tier3Count(s, f) >= tier3Limit(s, f);
        return `<button class="rcard" data-cmd="recruit" data-unit="${u}" ${p.gold < cost || capped ? 'disabled' : ''} title="${capped ? 'Tier-3 limit reached.' : st.ability ? esc(st.ability) : ''}">
          ${unitSvg(u)}<b>${st.name}</b><span class="rstats">${st.noDice ? 'Defence −1 at target · HP 1' : `ATK +${st.attack} · DEF +${st.defense} · HP ${st.hp}`}</span><span class="card-cost">${ICONS.gold}${cost}</span></button>`;
      }).join('')}</div>
      <div class="cmd-actions">
        ${btn('upgrade', `Upgrade · ${UPGRADE_COST(f)}`, { ico: ICONS.shield, disabled: c.level >= MAX_CITY_LEVEL ? 'Fully upgraded.' : upErr })}
        ${garrison ? btn('select-recruits', `Garrison (${garrison.units.length})`, { cls: 'go', ico: ICONS.troops }) : ''}
        <span class="cmd-note">Tier 3: ${tier3Count(s, f)}/${tier3Limit(s, f)} (2 + 1 per city). ${f === 'elves' ? 'Treants awaken in an enchanted forest; each city grows one forest per turn (build button). ' : ''}Recruits join the garrison.${garrison && garrison.units.length >= ARMY_FREE_SIZE ? ` Above ${ARMY_FREE_SIZE} units an army costs upkeep.` : ''}</span>
      </div>`;
  }

  /** Details for a single unit, with dismissal. */
  private openUnit(armyId: number, unitId: number) {
    const ar = armyById(this.state, armyId);
    const u = ar?.units.find((x) => x.id === unitId);
    if (!ar || !u) return;
    const st = UNIT_STATS[u.type];
    const fac = st.faction === 'neutral' || st.faction === 'dwarves' ? null : FACTIONS[st.faction];
    const mine = this.controlsCurrent() && ar.owner === currentPlayer(this.state).faction;
    const card = this.openModal(`
      <div class="unit-hero ${u.hp < st.hp ? 'hurt' : ''}">${unitSvg(u.type, 'idle')}</div>
      <h2>${st.name}</h2>
      <p class="sub">${fac ? fac.short : st.faction === 'dwarves' ? 'Dwarf mercenary' : 'Wildlands'} · tier ${st.tier}${st.counters ? ` · counters ${FACTIONS[st.counters].short}` : ''}</p>
      <dl class="unit-stats">
        <div><dt>Attack</dt><dd>+${st.attack}</dd></div>
        <div><dt>Defence</dt><dd>+${st.defense}</dd></div>
        <div><dt>HP</dt><dd class="${u.hp < st.hp ? 'bad' : ''}">${u.hp}/${st.hp}</dd></div>
        <div><dt>Cost</dt><dd>${unitCost(u.type) || '–'}</dd></div>
      </dl>
      ${st.ability ? `<p class="unit-ability">${esc(st.ability)}</p>` : ''}
      <p class="unit-note">Rolls 1 die in every fight round and adds its ${'attack or defence'}. Killing it gives ${bounty(u.type)} gold.${u.hp < st.hp ? ' Wounded: heals 1 HP per turn next to an own city.' : ''}</p>
      <div class="modal-actions">
        <button class="btn small u-anim">${ICONS.sword}Show attack</button>
        ${mine ? `<button class="btn danger small u-dismiss">Dismiss · +${refund(u.type)} gold</button>` : ''}
        <button class="btn go u-close">Close</button>
      </div>`, 'small unit-card');
    const sprite = card.querySelector('.sprite')!;
    card.querySelector('.u-anim')!.addEventListener('click', () => { sprite.classList.remove('a-attack'); void (sprite as HTMLElement).getBoundingClientRect(); sprite.classList.add('a-attack'); setTimeout(() => sprite.classList.remove('a-attack'), 700); });
    card.querySelector('.u-close')!.addEventListener('click', () => this.closeModal());
    card.querySelector('.u-dismiss')?.addEventListener('click', () => {
      this.closeModal();
      this.submit({ type: 'dismiss', p: currentPlayer(this.state).faction, army: ar.id, units: [u.id] });
    });
  }

  private renderHint() {
    const s = this.state;
    const hint = this.q('.hint');
    const text = this.q('.hint-text');
    const mine = this.controlsCurrent();
    hint.classList.toggle('hidden', !mine || s.phase === 'over');
    if (!mine) return;
    let t: string;
    const ar = this.selArmy !== null ? armyById(s, this.selArmy) : undefined;
    if (this.busy) t = 'Your orders are being carried out…';
    else if (this.splitPick) t = 'Choose the units for the new army.';
    else if (this.mode === 'build') t = 'Tap the glowing regions to build. Tap the build button again when you are done.';
    else if (ar) t = ar.mp > 0 ? 'Drag the army onto a region to march, or onto an enemy to attack.' : 'This army is done for the turn. Pick another or end the turn.';
    else if (this.selCity !== null) t = 'Recruit units into the city garrison.';
    else if (this.selTile !== null) t = 'Improve this region for more gold.';
    else if (this.selOther !== null) t = 'A rival army. Drag one of yours onto it to attack.';
    else t = s.pendingFight ? 'Keep fighting or retreat?' : s.pendingCity ? 'Raze the city or take it?' : 'Drag an army to march or attack. Tap a city or your land for more.';
    if (text.textContent !== t) text.textContent = t;
  }

  private applyMarks() {
    const s = this.state;
    if (!this.controlsCurrent() || this.busy) { this.board.mark({}); return; }
    if (this.mode) {
      const sel = this.selArmy !== null ? armyById(s, this.selArmy)?.tile ?? null : this.selCity;
      const peaceful = this.mode === 'build' || this.mode === 'treant';
      this.board.mark(peaceful ? { selected: sel, selectable: this.modeTargets(), dimOthers: true } : { selected: sel, targets: this.modeTargets(), dimOthers: true });
      return;
    }
    if (this.selFort !== null) { this.board.mark({ selected: this.selFort }); return; }
    const f = currentPlayer(s).faction;
    const ar = this.selArmy !== null ? armyById(s, this.selArmy) : undefined;
    if (ar) {
      const stops = [...this.reach].filter(([t, r]) => r.stop && t !== ar.tile).map(([t]) => t);
      this.board.mark({ selected: ar.tile, selectable: stops, targets: attackTargets(s, ar), dimOthers: true });
      return;
    }
    if (this.selCity !== null) { this.board.mark({ selected: this.selCity }); return; }
    if (this.selTile !== null) { this.board.mark({ selected: this.selTile }); return; }
    const active = ownArmies(s, f).filter((a) => a.mp > 0).map((a) => a.tile);
    const cities = ownCities(s, f).map((c) => c.tile);
    this.board.mark({ selectable: [...new Set([...active, ...cities])] });
  }

  // ---------------- Tooltip ----------------
  showTooltip(id: number, x: number, y: number, sticky: boolean) {
    const s = this.state;
    const t: Tile = s.tiles[id];
    const tip = this.q('.tooltip');
    const owner = t.owner as Owner | null;
    const armies = armiesAt(s, id);
    const city = cityAt(s, id);
    const build = s.builds.find((b) => b.tile === id);
    const head = owner ?? 'neutral';
    const rows: string[] = [];
    rows.push(`<div class="tip-row"><b>${TERRAIN_INFO[t.terrain].name}</b> ${TERRAIN_INFO[t.terrain].text}${t.improved ? ` <span class="tip-feat">Improved ${t.improved}/${MAX_IMPROVE}: +${t.improved} gold.</span>` : ''}${t.enchanted ? ' <span class="tip-feat">Enchanted: elves +1 defence.</span>' : ''}</div>`);
    const fo = fortressAt(s, id);
    if (fo?.discovered) rows.push(`<div class="tip-row tip-feat">Dwarf fortress: hire mercenaries with an army next to it.</div>`);
    const wl = wallAt(s, id);
    if (wl) rows.push(`<div class="tip-row tip-feat">Stone Wall (${wl.hp} HP): only Giants pass. Defence +4, never strikes back.</div>`);
    if (t.corrupted) rows.push(`<div class="tip-row tip-feat">Blighted forest: move cost 1, no elven bonus.</div>`);
    const reg = regionOf(s, id);
    if (reg) rows.unshift(`<div class="tip-row"><b>${reg.name}</b> · ${plural(reg.tiles.length, 'hex', 'hexes')}</div>`);
    if (city) rows.push(`<div class="tip-row tip-feat">${city.capital ? 'Capital' : 'City'} of ${FACTIONS[city.owner].short}, level ${city.level}. Guarded by a ${UNIT_STATS[garrisonUnit(city).type].name} (tier ${garrisonTier(city.level, city.capital)}) in fights. Attacked ${city.assaults}/${CITY_ASSAULTS} times this round.</div>`);
    if (build) rows.push(`<div class="tip-row tip-feat">${build.kind === 'city' ? 'City' : 'Upgrade'} ready in ${plural(build.turnsLeft, 'turn')}.</div>`);
    for (const a of armies) {
      const hurt = a.units.filter((u) => u.hp < UNIT_STATS[u.type].hp).length;
      rows.push(`<div class="tip-row"><b>${FACTION_NAME(a.owner)} army</b> ${unitSummary(a.units)}${hurt ? ` (${hurt} wounded)` : ''}</div>`);
    }
    const sel = this.selArmy !== null ? armyById(s, this.selArmy) : undefined;
    let battle = '';
    const bAct = this.mode === 'build' ? this.buildActions().get(id) : undefined;
    if (bAct) {
      const fNow = currentPlayer(s).faction;
      const label = bAct.type === 'improve' ? `Tap: improve to level ${t.improved + 1}, +1 gold per turn (${IMPROVE_COST[t.improved]} gold).`
        : bAct.type === 'grow' ? 'Tap: grow an enchanted forest here (+2 gold per turn, +1 defence).'
        : `Tap: upgrade the city to level ${(city?.level ?? 0) + 1} (${UPGRADE_COST(fNow)} gold, 1 turn).`;
      battle = `<div class="tip-row tip-feat">${label}</div>`;
    }
    if (sel && this.controlsCurrent() && attackTargets(s, sel).includes(id)) {
      const def = armies.filter((a) => a.owner !== sel.owner).flatMap((a) => a.units);
      if (city && city.owner !== sel.owner) def.push(garrisonUnit(city));
      const wall = wallAt(s, id);
      const defOwner: Owner = armies[0]?.owner ?? city?.owner ?? 'giants';
      const bonus = defenseBonus(s, t, defOwner);
      if (sel.units.some((u) => u.type === 'siege')) { bonus.total--; bonus.labels.push('Siege engine −1'); }
      const mine = armyStrength(sel.units.filter((u) => !UNIT_STATS[u.type].noDice), 'att');
      const theirs = wall && !def.length ? armyStrength([{ id: -1, type: 'wall', hp: wall.hp }], 'def') : armyStrength(def, 'def', bonus.total);
      const share = mine / (mine + theirs);
      battle = `<div class="tip-battle"><span class="tip-dice"><b>${sel.units.filter((u) => !UNIT_STATS[u.type].noDice).length}</b> dice vs <b>${def.length || 1}</b>${city && city.owner !== sel.owner ? ' (incl. city guard)' : ''}</span>
        <span class="odds" style="--p:${share.toFixed(2)}">Strength ${Math.round(share * 100)}% vs ${Math.round((1 - share) * 100)}%</span>
        ${bonus.labels.length ? `<span class="tip-mods">Defender: ${bonus.labels.join(', ')}</span>` : ''}</div>`;
    } else if (sel && this.controlsCurrent()) {
      const r = this.reach.get(id);
      if (r && r.stop) battle = `<div class="tip-row tip-feat">March here: ${r.cost} of ${sel.mp} movement.</div>`;
      else if (t.terrain !== 'water') battle = `<div class="tip-row">Entering costs ${TERRAIN_COST[t.terrain]} movement${armies.some((a) => a.owner === sel.owner) ? ' (−1 next to a friendly army)' : ''}.</div>`;
    }
    tip.innerHTML = `<div class="tip-head" style="--c:${head === 'neutral' ? NEUTRAL.dark : FACTIONS[head].color}">${crest(head, 'tip-crest')}<div><b>${owner ? FACTION_NAME(owner) : 'Unclaimed land'}</b><span>${armies.length ? plural(armies.reduce((n, a) => n + a.units.length, 0), 'unit') : 'No troops'}</span></div></div>
      ${rows.join('')}${battle}`;
    tip.classList.add('show');
    tip.classList.toggle('sticky', sticky);
    if (sticky) {
      const c = this.board.center(id);
      const sp = this.board.boardToScreen(c.x, c.y);
      x = sp.x; y = sp.y;
    }
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = x + 18, top = y + 18;
    if (left + w > innerWidth - 8) left = x - w - 18;
    if (top + h > innerHeight - 8) top = y - h - 18;
    tip.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, top)}px)`;
    if (sticky) { clearTimeout((tip as unknown as { _t: number })._t); (tip as unknown as { _t: number })._t = window.setTimeout(() => tip.classList.remove('show'), 2600); }
  }

  private hideTooltip() {
    this.q('.tooltip').classList.remove('show');
  }

  // ---------------- Toasts and banners ----------------
  toast(text: string, kind: 'info' | 'warn' | 'good' = 'info', f?: FactionId) {
    const box = this.q('.toasts');
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    if (f) el.style.setProperty('--c', FACTIONS[f].color);
    el.innerHTML = `${f ? crest(f, 'toast-crest') : ''}<span>${esc(text)}</span>`;
    box.appendChild(el);
    while (box.children.length > 3) box.firstElementChild!.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, kind === 'warn' ? 2600 : 3400);
  }

  private async turnBanner(f: FactionId) {
    const p = this.state.players.find((x) => x.faction === f)!;
    const fac = FACTIONS[f];
    const mine = this.controlsCurrent();
    const sub = mine ? 'Your turn' : p.kind === 'ai' ? 'AI turn' : `${esc(p.name)}'s turn`;
    await this.ribbon(`<b>${fac.name}</b><span>Round ${this.state.turn} · ${sub}</span>`, f, mine ? 1100 : 800, '');
  }

  private async bigBanner(title: string, sub: string, f: FactionId) {
    await this.ribbon(`<b>${esc(title)}</b><span>${esc(sub)}</span>`, f, 2200, 'big');
  }

  private async ribbon(html: string, f: FactionId, ms: number, cls: string) {
    const b = this.q('.banner');
    b.style.setProperty('--c', FACTIONS[f].color);
    b.style.setProperty('--cd', FACTIONS[f].dark);
    b.innerHTML = `<div class="ribbon ${cls}">${crest(f, 'banner-crest')}<div>${html}</div></div>`;
    b.classList.remove('show');
    b.classList.add('reset');
    void b.offsetWidth;
    b.classList.remove('reset');
    b.classList.add('show');
    sfx.horn();
    await fx.wait(ms);
    b.classList.remove('show');
  }

  // ---------------- Modals ----------------
  private openModal(html: string, cls = '') {
    const m = this.q('.modal');
    const card = m.querySelector('.modal-card') as HTMLElement;
    card.className = `modal-card plank ${cls}`;
    card.innerHTML = html;
    m.classList.add('open');
    return card;
  }

  private closeModal() {
    this.q('.modal').classList.remove('open');
  }

  private openMenu() {
    const speeds: [number, string][] = [[1, 'Normal'], [1.8, 'Fast'], [3.5, 'Turbo']];
    const card = this.openModal(`
      <h2>Paused</h2>
      <div class="menu-list">
        <button class="btn go m-resume">Resume</button>
        <button class="btn m-help">${ICONS.book}How to play</button>
        <div class="seg-label">Animation speed</div>
        <div class="seg">${speeds.map(([v, l]) => `<button class="seg-btn ${fx.motion.speed === v ? 'on' : ''}" data-speed="${v}">${l}</button>`).join('')}</div>
        ${this.online ? '' : '<button class="btn m-restart">New map, same factions</button>'}
        <button class="btn m-report">${ICONS.book}Playtest report</button>
        <button class="btn ghost m-quit">${ICONS.home}Leave to title</button>
      </div>`, 'small');
    card.querySelector('.m-report')!.addEventListener('click', () => {
      const c = this.openModal(`<h2>Playtest report</h2><p class="sub">Round ${this.state.turn}. Add what felt off, then copy it and send it on.</p>${this.reportBlock()}
        <div class="modal-actions"><button class="btn ghost r-back">Back</button></div>`, 'small');
      this.bindReport(c);
      c.querySelector('.r-back')!.addEventListener('click', () => this.openMenu());
    });
    card.querySelector('.m-resume')!.addEventListener('click', () => this.closeModal());
    card.querySelector('.m-help')!.addEventListener('click', () => { this.closeModal(); this.opts.onHelp(); });
    card.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach((b) => b.addEventListener('click', () => {
      fx.motion.speed = Number(b.dataset.speed);
      try { localStorage.setItem('jf-speed', b.dataset.speed!); } catch { /* storage unavailable */ }
      card.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('on', x === b));
    }));
    card.querySelector('.m-restart')?.addEventListener('click', () => { this.closeModal(); this.opts.onRestart(); });
    card.querySelector('.m-quit')!.addEventListener('click', () => { this.closeModal(); this.opts.onExit(); });
  }

  /** Notes field plus a button that copies the balance report. */
  private reportBlock(): string {
    return `<div class="report">
      <label class="report-label" for="report-notes">Playtest notes</label>
      <textarea id="report-notes" class="report-notes" rows="3" placeholder="What felt too strong, too weak or confusing?"></textarea>
      <button class="btn r-copy">${ICONS.book}Copy playtest report</button>
    </div>`;
  }

  private bindReport(card: HTMLElement) {
    const b = card.querySelector<HTMLButtonElement>('.r-copy')!;
    b.addEventListener('click', async () => {
      const notes = card.querySelector<HTMLTextAreaElement>('.report-notes')!.value;
      const how = await shareReport(playtestReport(this.state, notes), this.state.setup.seed);
      b.textContent = how === 'copied' ? 'Copied to clipboard' : 'Saved as a file';
    });
  }

  showVictory(f: FactionId) {
    const s = this.state;
    const viewer = this.viewer();
    (viewer === f || !viewer) ? sfx.fanfare() : sfx.doom();
    const fac = FACTIONS[f];
    const rows = s.players.map((pl) => `<tr class="${pl.faction === f ? 'win' : ''}"><td>${crest(pl.faction, 'mini-crest')}${FACTIONS[pl.faction].short}</td><td>${ownCities(s, pl.faction).length}</td><td>${unitCount(s, pl.faction)}</td><td>${pl.kills}</td><td>${pl.alive ? 'Victor' : 'Fallen'}</td></tr>`).join('');
    const card = this.openModal(`
      <div class="victory-crest">${crest(f, 'big-crest')}</div>
      <h2>${fac.name} ${f === 'elves' ? 'rules' : 'rule'} Juräa!</h2>
      <p class="sub">Every rival has fallen. Round ${s.turn}.</p>
      <p class="quote">“${fac.quote}”</p>
      <table class="stats"><thead><tr><th>Faction</th><th>Cities</th><th>Units</th><th>Slain</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      ${this.reportBlock()}
      <div class="modal-actions">
        <button class="btn ghost v-title">${ICONS.home}Title</button>
        ${this.online ? '' : '<button class="btn go v-again">Play again</button>'}
      </div>`, 'victory');
    this.bindReport(card);
    card.querySelector('.v-title')!.addEventListener('click', () => { this.closeModal(); this.opts.onExit(); });
    card.querySelector('.v-again')?.addEventListener('click', () => { this.closeModal(); this.opts.onRestart(); });
    const owned = ownedRegions(s, f);
    for (let i = 0; i < 5; i++) {
      const t = owned[Math.floor(Math.random() * owned.length)];
      if (t) setTimeout(() => fx.confetti(this.board, t.id, [fac.color, fac.accent, '#ffd23f', '#fffdf5'], 18), i * 300);
    }
  }
}

