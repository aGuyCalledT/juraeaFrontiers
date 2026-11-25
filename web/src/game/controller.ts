import { sfx } from '../audio';
import { aiNextAction } from '../engine/ai';
import { FACTIONS, NEUTRAL, TERRAIN_INFO } from '../engine/factions';
import {
  FACTION_NAME, TERRAIN_COST, applyAction, armiesAt, armyById, armyStrength, attackTargets, cityAt, computeIncome, currentPlayer, isCoastal, upkeepOf,
  defenseBonus, landTiles, ownArmies, ownCities, ownedTiles, pathTo, reachable, unitCount, validate, type Reach,
} from '../engine/rules';
import type { Action, Army, FactionId, GameEvent, GameState, Owner, Tile } from '../engine/types';
import {
  ARMY_FREE_SIZE, CITY_COST, FACTION_UNITS, IMPROVE_COST, MAX_CITY_LEVEL, MAX_IMPROVE, MOVE_POINTS, NO_CITY_LIMIT, SIEGE_ROUNDS,
  UNIT_STATS, UPGRADE_COST, bounty, refund, unitCost,
  type UnitType,
} from '../engine/unitstats';
import type { Online, ServerMsg } from '../net/online';
import { Board } from '../render/board';
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
  private reach: Map<number, Reach> = new Map();
  private hoverTile: number | null = null;
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
      await this.animate(r.events, prev, a);
      this.board.sync(this.state);
      this.refresh();
      this.save();
    }
    this.busy = false;
    this.el.classList.remove('is-busy');
    if (this.dice.isOpen && !this.state.pendingFight) this.dice.close();
    this.refresh();
    if (this.state.pendingFight && this.controlsCurrent()) {
      const f = currentPlayer(this.state).faction;
      void this.dice.ask().then((choice) => this.submit({ type: 'fight', p: f, choice }));
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
          for (const t of e.forested) void fx.abilityScene(this.board, t, 'enchant', this.q('.board-host'));
          if (e.captured.length) sfx.conquer();
          for (const t of e.captured) fx.bounceTile(this.board, t, 0.8);
          break;
        }
        case 'combat': {
          this.hideTooltip();
          if (e.round === 1) {
            this.board.focus([e.attacker.tile, e.defender.tile]);
            fx.showAim(this.board, e.attacker.tile, e.defender.tile, 'attack', e.p);
            sfx.whoosh();
            await fx.volley(this.board, e.attacker.tile, e.defender.tile, e.p, Math.min(4, e.attacker.units.length));
          }
          await this.dice.play(e, { att: FACTION_NAME(e.attacker.owner), def: FACTION_NAME(e.defender.owner) });
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
          if (this.controlsCurrent()) { this.selArmy = e.army; }
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
          this.toast(e.kind === 'city' ? `A new ${FACTIONS[e.p].short} city is finished!` : `City upgraded to level ${e.level}: sieges take ${SIEGE_ROUNDS + e.level} rounds.`, 'good', e.p);
          break;
        }
        case 'enchanted': {
          this.board.sync(this.state);
          sfx.magic();
          await fx.abilityScene(this.board, e.tile, 'enchant', this.q('.board-host'));
          break;
        }
        case 'healed': {
          const byArmy = new Map<number, number>();
          for (const h of e.units) byArmy.set(h.army, (byArmy.get(h.army) ?? 0) + 1);
          for (const [id, n] of byArmy) { const ar = armyById(this.state, id); if (ar) fx.floatText(this.board, ar.tile, `+${n} HP`, 'gain', 10); }
          break;
        }
        case 'siege': {
          this.board.sync(this.state);
          const c = cityAt(this.state, e.city);
          if (c && c.owner === this.viewer()) this.toast(`${FACTIONS[e.p].short} besiege your city: ${e.rounds}/${e.needed} rounds!`, 'warn', e.p);
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

  private onTileClick(id: number) {
    if (!this.controlsCurrent() || this.busy) {
      if (id >= 0) this.showTooltip(id, 0, 0, true);
      return;
    }
    if (id < 0) { this.cancel(); return; }
    const s = this.state;
    const f = currentPlayer(s).faction;
    const sel = this.selArmy !== null ? armyById(s, this.selArmy) : undefined;

    if (sel) {
      // Attack an adjacent enemy.
      if (attackTargets(s, sel).includes(id)) {
        this.submit({ type: 'attack', p: f, army: sel.id, target: id });
        return;
      }
      // March to a reachable hex.
      const r = this.reach.get(id);
      if (r && r.stop && id !== sel.tile) {
        this.submit({ type: 'move', p: f, army: sel.id, path: pathTo(this.reach, id) });
        return;
      }
    }
    const mine = this.myArmiesAt(id);
    const city = cityAt(s, id);
    if (mine.length) {
      // Cycle through the armies on this hex, then the city panel.
      const idx = sel ? mine.findIndex((a) => a.id === sel.id) : -1;
      if (idx >= 0 && idx < mine.length - 1) this.selectArmy(mine[idx + 1].id);
      else if (idx >= 0 && city && city.owner === f) this.selectCity(id);
      else if (idx >= 0) this.cancel();
      else this.selectArmy(mine[0].id);
      return;
    }
    if (city && city.owner === f) { this.selectCity(id); return; }
    if (!sel && s.tiles[id].owner === f) { this.selArmy = null; this.selCity = null; this.selTile = id; sfx.select(); this.refresh(); return; }
    if (sel) {
      const blocked = armiesAt(s, id).some((a) => a.owner !== f);
      this.toast(blocked ? (sel.attacked ? 'This army already attacked this turn.' : sel.mp < 1 ? 'No movement left to attack.' : 'Too far away to attack.') : sel.mp <= 0 ? 'This army has no movement left.' : 'Not enough movement to get there.', 'warn');
      sfx.error();
      return;
    }
    this.showTooltip(id, 0, 0, true);
  }

  private selectArmy(id: number | null) {
    this.selArmy = id;
    this.selCity = null;
    this.selTile = null;
    this.splitPick = null;
    if (id !== null) sfx.select();
    fx.clearAim(this.board);
    this.refresh();
  }

  private selectCity(tile: number) {
    this.selArmy = null;
    this.selCity = tile;
    this.selTile = null;
    this.splitPick = null;
    sfx.select();
    fx.clearAim(this.board);
    this.refresh();
  }

  private cancel() {
    this.selArmy = null;
    this.selCity = null;
    this.selTile = null;
    this.splitPick = null;
    fx.clearAim(this.board);
    this.hideTooltip();
    this.refresh();
  }

  private onHover(id: number | null, x: number, y: number) {
    this.hoverTile = id;
    if (id === null) { this.hideTooltip(); this.updateAim(); return; }
    this.showTooltip(id, x, y, false);
    this.updateAim();
  }

  private updateAim() {
    if (this.busy || this.selArmy === null || this.hoverTile === null) { if (!this.busy) fx.clearAim(this.board); return; }
    const ar = armyById(this.state, this.selArmy);
    if (!ar) return;
    const t = this.hoverTile;
    if (attackTargets(this.state, ar).includes(t)) { fx.showAim(this.board, ar.tile, t, 'attack', ar.owner as FactionId); return; }
    const r = this.reach.get(t);
    if (r && r.stop && t !== ar.tile) fx.showPath(this.board, ar.tile, pathTo(this.reach, t), r.cost, ar.mp - r.cost);
    else fx.clearAim(this.board);
  }

  private onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (this.destroyed || tag === 'INPUT' || ((tag === 'BUTTON' || tag === 'SUMMARY') && (e.key === ' ' || e.key === 'Enter'))) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (this.q('.modal.open')) this.closeModal(); else this.cancel(); }
    else if (k === 'enter') { if (!this.q('.modal.open')) { e.preventDefault(); this.endTurn(); } }
    else if (k === 'tab') { e.preventDefault(); this.cycleArmy(); }
    else if (k === '+' || k === '=') this.board.zoomBy(1.2);
    else if (k === '-') this.board.zoomBy(1 / 1.2);
    else if (k === 'f') this.board.fit(true);
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
      case 'noop': if (ar) this.openUnit(ar.id, Number(b.dataset.unit)); break;
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
      case 'enchant': if (ar) this.submit({ type: 'enchant', p: f, army: ar.id }); break;
      case 'other': {
        if (!ar) break;
        const other = this.myArmiesAt(ar.tile).find((x) => x.id !== ar.id);
        if (other) this.selectArmy(other.id);
        break;
      }
      case 'recruit': if (this.selCity !== null) this.submit({ type: 'recruit', p: f, city: this.selCity, unit: b.dataset.unit as UnitType }); break;
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
    const land = landTiles(s).length;
    this.q('.players').innerHTML = s.players.map((pl) => {
      const units = unitCount(s, pl.faction);
      const cities = ownCities(s, pl.faction).length;
      const hexes = ownedTiles(s, pl.faction).length;
      const tag = pl.kind === 'ai' ? 'AI' : this.online || s.players.filter((x) => x.kind === 'human').length > 1 ? esc(pl.name) : 'You';
      return `<div class="pl ${pl.faction === cur ? 'current' : ''} ${pl.alive ? '' : 'dead'}" style="--c:${FACTIONS[pl.faction].color}">
        ${pl.alive ? crest(pl.faction, 'pl-crest') : `<span class="pl-crest dead-ico">${ICONS.skull}</span>`}
        <div class="pl-main"><div class="pl-name">${FACTIONS[pl.faction].short}<span class="pl-tag">${tag}</span></div>
        <div class="pl-bar"><i style="width:${((hexes / land) * 100).toFixed(1)}%"></i></div>
        <div class="pl-stats"><span>${plural(units, 'unit')}</span><span class="${pl.noCity ? 'bad' : ''}">${pl.noCity ? `no city ${pl.noCity}/${NO_CITY_LIMIT}` : plural(cities, 'city', 'cities')}</span><span>${hexes} hexes</span></div></div>
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
    if (!mine || (!ar && this.selCity === null && this.selTile === null)) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    box.classList.remove('hidden');
    const btn = (cmd: string, label: string, opts: { disabled?: string | null; cls?: string; ico?: string } = {}) =>
      `<button class="btn small ${opts.cls ?? ''}" data-cmd="${cmd}" ${opts.disabled ? `disabled title="${esc(opts.disabled)}"` : ''}>${opts.ico ?? ''}${label}</button>`;
    const improveBtn = (tile: number) => {
      const t = s.tiles[tile];
      if (cityAt(s, tile) || t.owner !== f) return '';
      if (t.improved >= MAX_IMPROVE) return `<span class="cmd-note">Fully improved (+${t.improved} gold)</span>`;
      const err = validate(s, { type: 'improve', p: f, tile });
      return btn('improve', `Improve +1 gold · ${IMPROVE_COST[t.improved]}`, { ico: ICONS.gold, disabled: err });
    };
    const close = `<button class="icon-btn small cmd-close" data-cmd="close" aria-label="Close">${ICONS.close}</button>`;

    if (ar) {
      const here = this.myArmiesAt(ar.tile);
      const t = s.tiles[ar.tile];
      const pick = this.splitPick;
      const chips = [...ar.units].sort((a, b) => UNIT_STATS[b.type].tier - UNIT_STATS[a.type].tier || a.hp - b.hp).map((u) =>
        `<button class="uchip ${pick?.has(u.id) ? 'picked' : ''}" data-cmd="${pick ? 'pick' : 'noop'}" data-unit="${u.id}" title="${UNIT_STATS[u.type].name}: details">${portrait(u)}</button>`).join('');
      const splitErr = validate(s, { type: 'split', p: f, army: ar.id, units: [ar.units[0]?.id ?? -1] });
      const buildErr = validate(s, { type: 'build', p: f, army: ar.id });
      const enchantErr = f === 'elves' && ar.units.some((u) => u.type === 'druid') ? validate(s, { type: 'enchant', p: f, army: ar.id }) : 'skip';
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
             ${improveBtn(ar.tile)}
             ${enchantErr !== 'skip' ? btn('enchant', 'Enchant forest', { ico: ICONS.bolt, disabled: enchantErr }) : ''}
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
        <div class="cmd-actions">${improveBtn(t.id)}<span class="cmd-note">Improvements add +1 gold each (max ${MAX_IMPROVE}, 1 turn to build). They are destroyed if a rival takes the hex.</span></div>`;
      return;
    }
    // City panel
    const c = cityAt(s, this.selCity!)!;
    const garrison = this.myArmiesAt(c.tile)[0];
    const sieges = Object.entries(c.siege).filter(([, n]) => n).map(([sf, n]) => `${FACTIONS[sf as FactionId].short} ${n}/${SIEGE_ROUNDS + c.level}`);
    const upErr = validate(s, { type: 'upgrade', p: f, city: c.tile });
    const coastal = isCoastal(s, c.tile);
    box.innerHTML = `
      <div class="cmd-head"><b>${c.capital ? 'Capital' : 'City'}${c.level ? ` · level ${c.level}` : ''}</b><span>+${coastal ? 4 : 3} gold${coastal ? ' (by the sea)' : ''} · defence +1 inside · siege takes ${SIEGE_ROUNDS + c.level} rounds${sieges.length ? ` · <em class="bad">besieged: ${sieges.join(', ')}</em>` : ''}</span>${close}</div>
      <div class="recruits">${FACTION_UNITS[f].map((u) => {
        const st = UNIT_STATS[u];
        const cost = unitCost(u);
        return `<button class="rcard" data-cmd="recruit" data-unit="${u}" ${p.gold < cost ? 'disabled' : ''} title="${st.ability ? esc(st.ability) : ''}">
          ${unitSvg(u)}<b>${st.name}</b><span class="rstats">ATK +${st.attack} · DEF +${st.defense} · HP ${st.hp}</span><span class="card-cost">${ICONS.gold}${cost}</span></button>`;
      }).join('')}</div>
      <div class="cmd-actions">
        ${btn('upgrade', `Upgrade · ${UPGRADE_COST(f)}`, { ico: ICONS.shield, disabled: c.level >= MAX_CITY_LEVEL ? 'Fully upgraded.' : upErr })}
        ${garrison ? btn('select-recruits', `Garrison (${garrison.units.length})`, { cls: 'go', ico: ICONS.troops }) : ''}
        <span class="cmd-note">Recruits join the garrison inside the city.${garrison && garrison.units.length >= ARMY_FREE_SIZE ? ` Above ${ARMY_FREE_SIZE} units an army costs upkeep.` : ''}</span>
      </div>`;
  }

  /** Details for a single unit, with dismissal. */
  private openUnit(armyId: number, unitId: number) {
    const ar = armyById(this.state, armyId);
    const u = ar?.units.find((x) => x.id === unitId);
    if (!ar || !u) return;
    const st = UNIT_STATS[u.type];
    const fac = st.faction === 'neutral' ? null : FACTIONS[st.faction];
    const mine = this.controlsCurrent() && ar.owner === currentPlayer(this.state).faction;
    const card = this.openModal(`
      <div class="unit-hero ${u.hp < st.hp ? 'hurt' : ''}">${unitSvg(u.type, 'idle')}</div>
      <h2>${st.name}</h2>
      <p class="sub">${fac ? fac.short : 'Wildlands'} · tier ${st.tier}</p>
      <dl class="unit-stats">
        <div><dt>Attack</dt><dd>+${st.attack}</dd></div>
        <div><dt>Defence</dt><dd>+${st.defense}</dd></div>
        <div><dt>HP</dt><dd class="${u.hp < st.hp ? 'bad' : ''}">${u.hp}/${st.hp}</dd></div>
        <div><dt>Cost</dt><dd>${st.faction === 'neutral' ? '–' : unitCost(u.type)}</dd></div>
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
    else if (ar) t = ar.mp > 0 ? 'Choose a hex to march to, or an adjacent enemy to attack.' : 'This army is done for the turn. Pick another or end the turn.';
    else if (this.selCity !== null) t = 'Recruit units into the city garrison.';
    else if (this.selTile !== null) t = 'Improve this hex for more gold.';
    else t = s.pendingFight ? 'Fight round 2 or retreat?' : 'Choose an army, a city or your land.';
    if (text.textContent !== t) text.textContent = t;
  }

  private applyMarks() {
    const s = this.state;
    if (!this.controlsCurrent() || this.busy) { this.board.mark({}); return; }
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
    if (city) rows.push(`<div class="tip-row tip-feat">${city.capital ? 'Capital' : 'City'} of ${FACTIONS[city.owner].short}${city.level ? `, level ${city.level}` : ''}. Siege: ${SIEGE_ROUNDS + city.level} rounds.</div>`);
    if (build) rows.push(`<div class="tip-row tip-feat">${build.kind === 'city' ? 'City' : 'Upgrade'} ready in ${plural(build.turnsLeft, 'turn')}.</div>`);
    for (const a of armies) {
      const hurt = a.units.filter((u) => u.hp < UNIT_STATS[u.type].hp).length;
      rows.push(`<div class="tip-row"><b>${FACTION_NAME(a.owner)} army</b> ${unitSummary(a.units)}${hurt ? ` (${hurt} wounded)` : ''}</div>`);
    }
    const sel = this.selArmy !== null ? armyById(s, this.selArmy) : undefined;
    let battle = '';
    if (sel && this.controlsCurrent() && attackTargets(s, sel).includes(id)) {
      const def = armies.filter((a) => a.owner !== sel.owner).flatMap((a) => a.units);
      const bonus = defenseBonus(s, t, armies[0].owner);
      const mine = armyStrength(sel.units, 'att');
      const theirs = armyStrength(def, 'def', bonus.total);
      const share = mine / (mine + theirs);
      battle = `<div class="tip-battle"><span class="tip-dice"><b>${sel.units.length}</b> dice vs <b>${def.length}</b>${sel.units.length !== def.length ? ` (${Math.abs(sel.units.length - def.length)} spare lost)` : ''}</span>
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
        <button class="btn ghost m-quit">${ICONS.home}Leave to title</button>
      </div>`, 'small');
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
      <div class="modal-actions">
        <button class="btn ghost v-title">${ICONS.home}Title</button>
        ${this.online ? '' : '<button class="btn go v-again">Play again</button>'}
      </div>`, 'victory');
    card.querySelector('.v-title')!.addEventListener('click', () => { this.closeModal(); this.opts.onExit(); });
    card.querySelector('.v-again')?.addEventListener('click', () => { this.closeModal(); this.opts.onRestart(); });
    const owned = ownedTiles(s, f);
    for (let i = 0; i < 5; i++) {
      const t = owned[Math.floor(Math.random() * owned.length)];
      if (t) setTimeout(() => fx.confetti(this.board, t.id, [fac.color, fac.accent, '#ffd23f', '#fffdf5'], 18), i * 300);
    }
  }
}

