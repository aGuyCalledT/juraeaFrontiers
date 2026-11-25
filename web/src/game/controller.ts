import { sfx } from '../audio';
import { aiNextAction } from '../engine/ai';
import { COSTS, FACTIONS, NEUTRAL, TERRAIN_INFO } from '../engine/factions';
import {
  applyAction, combatMods, computeIncome, currentPlayer, landTiles, neighbors, ownedTiles, reachable, validate,
} from '../engine/rules';
import type { Action, FactionId, GameEvent, GameState, Owner, Tile } from '../engine/types';
import type { Online, ServerMsg } from '../net/online';
import { Board } from '../render/board';
import * as fx from '../render/fx';
import { DiceTray } from '../ui/dice';
import { ICONS, powerIcon } from '../ui/icons';

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

type UiMode = 'idle' | 'champion' | 'ability';
const PHASES = [
  ['reinforce', 'Reinforce', ICONS.troops],
  ['attack', 'Attack', ICONS.sword],
  ['fortify', 'Fortify', ICONS.march],
] as const;

export function crest(f: FactionId | 'neutral', cls = 'crest'): string {
  const col = f === 'neutral' ? NEUTRAL.color : FACTIONS[f].color;
  const unit = f === 'neutral' ? 'u-neutral' : `u-${f}`;
  const tint = f === 'neutral' ? NEUTRAL.light : FACTIONS[f].light;
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><use href="#s-shield" style="color:${col}"/><use href="#${unit}" x="20" y="16" width="60" height="60" style="color:${tint}"/></svg>`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ownerName = (o: Owner | null) => (!o || o === 'neutral' ? NEUTRAL.name : FACTIONS[o].short);

export class GameController {
  state: GameState;
  board: Board;
  private el: HTMLElement;
  private dice: DiceTray;
  private q = <T extends HTMLElement>(sel: string) => this.el.querySelector(sel) as T;
  private queue: Action[] = [];
  private busy = false;
  private selected: number | null = null;
  private hoverTile: number | null = null;
  private mode: UiMode = 'idle';
  private placeAmount: 1 | 5 | 'all' = 1;
  private blitz = false;
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
    if (import.meta.env.DEV) (window as unknown as { __jf: GameController }).__jf = this;
    const p = currentPlayer(this.state);
    this.lastTurnKey = `${this.state.turn}-${p.faction}`;
    setTimeout(() => {
      if (this.destroyed) return;
      this.turnBanner(p.faction);
      this.scheduleAi();
    }, opts.intro === false ? 50 : 1100);
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.aiTimer);
    window.removeEventListener('keydown', this.keyHandler);
    this.offNet?.();
  }

  // ---------------- Ownership of input ----------------
  private get online() { return this.opts.online; }

  private controlsCurrent(): boolean {
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
      await this.animate(r.events, prev, a);
      this.board.sync(this.state);
      this.refresh();
      this.save();
    }
    this.busy = false;
    this.el.classList.remove('is-busy');
    this.refresh();
    this.scheduleAi();
  }

  private scheduleAi() {
    clearTimeout(this.aiTimer);
    if (this.destroyed || this.busy || !this.runsAi()) return;
    const delay = this.state.phase === 'reinforce' ? 380 : 520;
    this.aiTimer = window.setTimeout(() => {
      if (this.destroyed || this.busy || !this.runsAi()) return;
      this.submit(aiNextAction(this.state));
    }, delay / fx.motion.speed);
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

  // ---------------- Animations for events ----------------
  private async animate(events: GameEvent[], prev: GameState, a: Action) {
    const watching = !this.controlsCurrent() || this.online;
    for (const e of events) {
      switch (e.type) {
        case 'placed': {
          this.board.sync(this.state);
          if (watching) this.board.focus([e.tile]);
          fx.placed(this.board, e.tile, e.n);
          sfx.place();
          if (watching) await fx.wait(260);
          break;
        }
        case 'bought': {
          sfx.coin();
          if (e.item === 'champion' && e.tile !== undefined) {
            this.board.sync(this.state);
            fx.bounceTile(this.board, e.tile, 1.2);
            fx.confetti(this.board, e.tile, [FACTIONS[e.p].accent, '#ffd23f'], 10);
            this.toast(`${FACTIONS[e.p].units.special} joins the army`, 'info');
            if (watching) await fx.wait(450);
          } else {
            this.bump('.res-troops');
            if (watching) await fx.wait(180);
          }
          break;
        }
        case 'ability': {
          this.board.sync(this.state);
          this.board.focus([e.tile]);
          e.p === 'giants' ? sfx.thud() : sfx.magic();
          this.toast(`${FACTIONS[e.p].ability.name}!`, 'info', e.p);
          await fx.abilityScene(this.board, e.tile, e.p, this.q('.board-host'));
          if (e.p === 'necro') fx.floatText(this.board, e.tile, '+2', 'gain');
          if (e.p === 'giants') fx.floatText(this.board, e.tile, '+2', 'gain');
          if (e.p === 'elves' && this.state.tiles[e.tile].owner === 'elves') fx.floatText(this.board, e.tile, '+1', 'gain');
          break;
        }
        case 'combat': {
          this.hideTooltip();
          this.board.focus([e.from, e.to]);
          fx.showAim(this.board, e.from, e.to, 'attack', e.p);
          sfx.whoosh();
          await fx.volley(this.board, e.from, e.to, e.p, Math.min(3, prev.tiles[e.from].troops - 1));
          await this.dice.play(e.p, e.defender, e.rounds, e.attMods, e.defMods, {
            att: FACTIONS[e.p].short, def: ownerName(e.defender),
          });
          fx.clearAim(this.board);
          const lostA = e.rounds.reduce((x, r) => x + r.attLoss, 0);
          const lostD = e.rounds.reduce((x, r) => x + r.defLoss, 0);
          this.board.sync(this.state);
          if (lostA) { fx.floatText(this.board, e.from, `-${lostA}`, 'loss'); fx.shakeTile(this.board, e.from); }
          if (lostD) { fx.floatText(this.board, e.to, `-${lostD}`, 'loss'); fx.shakeTile(this.board, e.to); }
          if (lostA + lostD >= 6) fx.shakeScreen(this.q('.board-host'), 0.8);
          if (!e.conquered) await fx.wait(250);
          break;
        }
        case 'conquered': {
          this.board.sync(this.state);
          sfx.conquer();
          await fx.conquest(this.board, e.tile, e.p);
          const t = this.state.tiles[e.tile];
          const region = this.state.regions[t.region];
          if (region.tiles.every((id) => this.state.tiles[id].owner === e.p)) {
            this.toast(`${FACTIONS[e.p].short} hold all of ${region.name} (+${region.bonus} troops per turn)`, 'good', e.p);
          }
          break;
        }
        case 'moved': {
          if (a.type === 'fortify' || a.type === 'move') this.board.focus([e.from, e.to]);
          this.board.sync(this.state);
          await fx.march(this.board, e.from, e.to, e.p, e.n);
          break;
        }
        case 'raised': {
          fx.floatText(this.board, e.tile, '+1 risen', 'info', -26);
          break;
        }
        case 'eliminated': {
          this.board.sync(this.state);
          sfx.doom();
          await this.bigBanner(`${FACTIONS[e.p].name} have fallen!`, `${FACTIONS[e.by].short} seized their capital and lands.`, e.by);
          break;
        }
        case 'phase': {
          this.selected = null;
          this.mode = 'idle';
          fx.clearAim(this.board);
          this.stampPhase(e.phase);
          break;
        }
        case 'turn': {
          this.selected = null;
          this.mode = 'idle';
          const key = `${e.turn}-${e.p}`;
          if (key !== this.lastTurnKey) {
            this.lastTurnKey = key;
            this.refresh();
            if (this.controlsCurrent()) this.board.fit(true);
            await this.turnBanner(e.p);
            const inc = e.income;
            if (this.controlsCurrent()) {
              const parts = [`+${inc.troops} troops`, `+${inc.gold} gold`, `+${inc.power} ${FACTIONS[e.p].resource}`];
              this.toast(parts.join('  ·  ') + (inc.regions.length ? `  ·  ${inc.regions.join(', ')}` : ''), 'info', e.p);
            }
          }
          break;
        }
        case 'victory': {
          this.board.sync(this.state);
          this.refresh();
          await fx.wait(400);
          this.showVictory(e.p, e.reason);
          break;
        }
      }
    }
  }

  // ---------------- Input ----------------
  private onTileClick(id: number) {
    if (!this.controlsCurrent() || this.busy || this.state.pending) {
      if (id >= 0) this.showTooltip(id, 0, 0, true);
      return;
    }
    const s = this.state;
    const p = currentPlayer(s);
    const f = p.faction;
    if (id < 0) { this.cancel(); return; }
    const t = s.tiles[id];
    sfx.click();

    if (this.mode === 'champion') {
      this.submit({ type: 'buy', p: f, item: 'champion', tile: id });
      this.mode = 'idle';
      this.refresh();
      return;
    }
    if (this.mode === 'ability') {
      this.submit({ type: 'ability', p: f, tile: id });
      this.mode = 'idle';
      this.refresh();
      return;
    }

    if (s.phase === 'reinforce') {
      if (t.owner !== f) { this.toast('Place troops on your own hexes.', 'warn'); return; }
      if (p.reinforcements <= 0) { this.toast('No troops left to place. Start the attack!', 'warn'); return; }
      const n = this.placeAmount === 'all' ? p.reinforcements : Math.min(this.placeAmount, p.reinforcements);
      this.submit({ type: 'place', p: f, tile: id, n });
      return;
    }

    if (s.phase === 'attack') {
      const nb = neighbors(s);
      if (this.selected !== null && this.selected !== id && t.owner !== f && nb[this.selected].includes(id)) {
        this.submit({ type: 'attack', p: f, from: this.selected, to: id, blitz: this.blitz });
        return;
      }
      if (t.owner === f) {
        if (this.selected === id) { this.selected = null; }
        else if (t.troops < 2) { this.toast('A hex needs at least 2 troops to attack.', 'warn'); }
        else if (!nb[id].some((n) => s.tiles[n].terrain !== 'water' && s.tiles[n].owner !== f)) { this.toast('No enemies next to that hex.', 'warn'); }
        else { this.selected = id; sfx.select(); }
        this.refresh();
        return;
      }
      this.toast('First pick one of your hexes to attack from.', 'warn');
      return;
    }

    if (s.phase === 'fortify') {
      if (s.fortifyUsed) { this.toast('You already moved troops this turn.', 'warn'); return; }
      if (this.selected !== null && t.owner === f && id !== this.selected && reachable(s, this.selected, f).has(id)) {
        const from = this.selected;
        this.askAmount('Move troops', `From ${TERRAIN_INFO[s.tiles[from].terrain].name} to ${TERRAIN_INFO[t.terrain].name}`, 1, s.tiles[from].troops - 1, s.tiles[from].troops - 1, (n) => {
          this.submit({ type: 'fortify', p: f, from, to: id, n });
          this.selected = null;
        });
        return;
      }
      if (t.owner === f) {
        if (this.selected === id) this.selected = null;
        else if (t.troops < 2) this.toast('Needs at least 2 troops to move some.', 'warn');
        else if (!reachable(s, id, f).size) this.toast('No connected hex to move to.', 'warn');
        else { this.selected = id; sfx.select(); }
        this.refresh();
      }
    }
  }

  private cancel() {
    this.selected = null;
    this.mode = 'idle';
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
    const s = this.state;
    if (this.busy) return;
    if (this.selected === null || this.hoverTile === null) { fx.clearAim(this.board); return; }
    const f = currentPlayer(s).faction;
    const t = s.tiles[this.hoverTile];
    if (s.phase === 'attack' && t.owner !== f && neighbors(s)[this.selected].includes(t.id)) fx.showAim(this.board, this.selected, t.id, 'attack', f);
    else if (s.phase === 'fortify' && t.owner === f && t.id !== this.selected && reachable(s, this.selected, f).has(t.id)) fx.showAim(this.board, this.selected, t.id, 'move');
    else fx.clearAim(this.board);
  }

  private onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName;
    if (this.destroyed || tag === 'INPUT' || ((tag === 'BUTTON' || tag === 'SUMMARY') && (e.key === ' ' || e.key === 'Enter'))) return;
    const k = e.key.toLowerCase();
    if (k === 'escape') { if (this.q('.modal.open')) this.closeModal(); else this.cancel(); }
    else if (k === ' ' || k === 'enter') { if (!this.q('.modal.open') && !this.state.pending) { e.preventDefault(); this.primary(); } }
    else if (k === '1') this.setPlace(1);
    else if (k === '5') this.setPlace(5);
    else if (k === 'a') this.setPlace('all');
    else if (k === 'b') { this.blitz = !this.blitz; this.refresh(); }
    else if (k === '+' || k === '=') this.board.zoomBy(1.2);
    else if (k === '-') this.board.zoomBy(1 / 1.2);
    else if (k === 'f') this.board.fit(true);
  }

  private setPlace(v: 1 | 5 | 'all') {
    this.placeAmount = v;
    this.refresh();
  }

  private primary() {
    if (!this.controlsCurrent() || this.busy) return;
    const p = currentPlayer(this.state);
    if (this.state.phase === 'reinforce' && p.reinforcements > 0) {
      this.toast(`Place ${p.reinforcements} more troop${p.reinforcements > 1 ? 's' : ''} first.`, 'warn');
      this.bump('.primary');
      return;
    }
    sfx.click();
    this.selected = null;
    this.submit({ type: 'endPhase', p: p.faction });
  }

  // ---------------- HUD ----------------
  private template(): string {
    return `
      <div class="board-host"></div>
      <header class="topbar plank">
        <div class="turn"><span class="turn-crest"></span><div class="turn-text"><b class="turn-name"></b><span class="turn-sub"></span></div></div>
        <ol class="phases">${PHASES.map(([id, label, ico]) => `<li data-phase="${id}">${ico}<span>${label}</span></li>`).join('')}</ol>
        <div class="res">
          <span class="res-item res-gold" title="Gold">${ICONS.gold}<b></b></span>
          <span class="res-item res-power"><span class="res-power-ico"></span><b></b></span>
          <span class="res-item res-troops" title="Troops to place">${ICONS.troops}<b></b></span>
        </div>
        <div class="top-btns">
          <button class="icon-btn btn-sound" aria-label="Toggle sound"></button>
          <button class="icon-btn btn-menu" aria-label="Menu">${ICONS.gear}</button>
        </div>
      </header>
      <aside class="players"></aside>
      <div class="tray">
        <button class="card card-troop"><span class="card-ico">${ICONS.troops}</span><span class="card-title">Recruit</span><span class="card-cost">${ICONS.gold}${COSTS.troop}</span></button>
        <button class="card card-champ"><span class="card-ico card-champ-ico"></span><span class="card-title">Champion</span><span class="card-cost">${ICONS.gold}${COSTS.champion}</span></button>
        <button class="card card-ability"><span class="card-ico card-ability-ico">${ICONS.bolt}</span><span class="card-title card-ability-name"></span><span class="card-cost card-ability-cost"></span></button>
      </div>
      <div class="hint"><span class="hint-text"></span><span class="chips"></span></div>
      <div class="zoom">
        <button class="icon-btn btn-zoom-in" aria-label="Zoom in">${ICONS.plus}</button>
        <button class="icon-btn btn-zoom-out" aria-label="Zoom out">${ICONS.minus}</button>
      </div>
      <button class="btn primary"><span class="primary-label"></span></button>
      <div class="tooltip" role="tooltip"></div>
      <div class="banner"></div>
      <div class="toasts" aria-live="polite"></div>
      <div class="modal"><div class="modal-card plank"></div></div>`;
  }

  private measureInsets() {
    const mobile = innerWidth < 760;
    this.board.insets = mobile
      ? { top: 178, bottom: 172, left: 6, right: 6 }
      : { top: 92, bottom: 128, left: 24, right: innerWidth > 1100 ? 250 : 24 };
    addEventListener('resize', () => {
      const m = innerWidth < 760;
      this.board.insets = m ? { top: 178, bottom: 172, left: 6, right: 6 } : { top: 92, bottom: 128, left: 24, right: innerWidth > 1100 ? 250 : 24 };
    });
  }

  private bindHud() {
    this.q('.primary').addEventListener('click', () => this.primary());
    this.q('.btn-menu').addEventListener('click', () => { sfx.click(); this.openMenu(); });
    const snd = this.q('.btn-sound');
    const setSnd = () => { snd.innerHTML = sfx.muted ? ICONS.soundOff : ICONS.soundOn; };
    setSnd();
    snd.addEventListener('click', () => { sfx.toggle(); setSnd(); sfx.click(); });
    this.q('.btn-zoom-in').addEventListener('click', () => this.board.zoomBy(1.25));
    this.q('.btn-zoom-out').addEventListener('click', () => this.board.zoomBy(1 / 1.25));
    this.q('.card-troop').addEventListener('click', () => {
      if (!this.controlsCurrent() || this.busy) return;
      this.submit({ type: 'buy', p: currentPlayer(this.state).faction, item: 'troop' });
    });
    this.q('.card-champ').addEventListener('click', () => {
      if (!this.controlsCurrent() || this.busy) return;
      sfx.click();
      this.mode = this.mode === 'champion' ? 'idle' : 'champion';
      this.selected = null;
      this.refresh();
    });
    this.q('.card-ability').addEventListener('click', () => {
      if (!this.controlsCurrent() || this.busy) return;
      sfx.click();
      this.mode = this.mode === 'ability' ? 'idle' : 'ability';
      this.selected = null;
      this.refresh();
    });
    this.q('.chips').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      sfx.click();
      const v = b.dataset.place;
      if (v) this.setPlace(v === 'all' ? 'all' : (Number(v) as 1 | 5));
      if (b.dataset.blitz !== undefined) { this.blitz = b.dataset.blitz === '1'; this.refresh(); }
      if (b.dataset.cancel !== undefined) this.cancel();
    });
    this.q('.modal').addEventListener('click', (e) => { if (e.target === e.currentTarget && !this.state.pending) this.closeModal(); });
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

    // Top bar
    const crestEl = this.q('.turn-crest');
    if (crestEl.dataset.f !== p.faction) { crestEl.dataset.f = p.faction; crestEl.innerHTML = crest(p.faction); }
    this.q('.turn-name').textContent = fac.short;
    const who = mine ? (this.online || s.players.filter((x) => x.kind === 'human').length > 1 ? `${p.name}, your move` : 'Your move') : p.kind === 'ai' ? 'AI is plotting…' : `${p.name} is playing…`;
    this.q('.turn-sub').innerHTML = `<span class="turn-round">Round ${s.turn} · </span>${esc(who)}`;
    this.el.querySelectorAll<HTMLElement>('.phases li').forEach((li) => {
      const order = ['reinforce', 'attack', 'fortify'];
      li.classList.toggle('active', li.dataset.phase === s.phase);
      li.classList.toggle('done', order.indexOf(li.dataset.phase!) < order.indexOf(s.phase));
    });
    const shown = viewer ? s.players.find((x) => x.faction === viewer)! : p;
    this.q('.res-gold b').textContent = String(shown.gold);
    const pw = this.q('.res-power');
    pw.title = FACTIONS[shown.faction].resource;
    if (pw.dataset.f !== shown.faction) { pw.dataset.f = shown.faction; this.q('.res-power-ico').innerHTML = powerIcon(shown.faction); }
    this.q('.res-power b').textContent = String(shown.power);
    this.q('.res-troops b').textContent = String(p.reinforcements);
    this.q('.res-troops').classList.toggle('hot', mine && s.phase === 'reinforce' && p.reinforcements > 0);

    this.renderPlayers();

    // Tray
    const tray = this.q('.tray');
    tray.classList.toggle('hidden', !mine || s.phase === 'over');
    const inReinforce = s.phase === 'reinforce';
    const troopCard = this.q<HTMLButtonElement>('.card-troop');
    troopCard.disabled = !inReinforce || p.gold < COSTS.troop;
    troopCard.title = 'Buy one extra troop to place';
    const champ = this.q<HTMLButtonElement>('.card-champ');
    champ.disabled = !inReinforce || p.gold < COSTS.champion;
    champ.classList.toggle('armed', this.mode === 'champion');
    champ.title = `${fac.units.special}: +1 to the best die when attacking from or defending this hex`;
    const ci = this.q('.card-champ-ico');
    if (ci.dataset.f !== p.faction) { ci.dataset.f = p.faction; ci.innerHTML = `<svg viewBox="0 0 100 100"><use href="#c-${p.faction}" style="color:${fac.accent}"/></svg>`; }
    this.q('.card-champ .card-title').textContent = fac.units.special;
    const ab = this.q<HTMLButtonElement>('.card-ability');
    ab.disabled = p.abilityUsed || p.power < fac.ability.cost || s.phase === 'over';
    ab.classList.toggle('armed', this.mode === 'ability');
    ab.title = fac.ability.text;
    this.q('.card-ability-name').textContent = fac.ability.name;
    this.q('.card-ability-cost').innerHTML = `${powerIcon(p.faction)}${fac.ability.cost}`;

    // Primary button
    const prim = this.q<HTMLButtonElement>('.primary');
    prim.classList.toggle('hidden', !mine);
    const label = s.phase === 'reinforce'
      ? p.reinforcements > 0 ? (innerWidth < 760 ? `${p.reinforcements} to place` : `${p.reinforcements} troop${p.reinforcements > 1 ? 's' : ''} to place`) : 'To battle!'
      : s.phase === 'attack' ? 'Fortify' : 'End turn';
    this.q('.primary-label').textContent = label;
    prim.classList.toggle('waiting', s.phase === 'reinforce' && p.reinforcements > 0);

    this.renderHint();
    this.applyMarks();
    if (s.pending && mine && !this.busy && !this.q('.modal.open')) this.askMoveIn();
  }

  private renderPlayers() {
    const s = this.state;
    const land = landTiles(s).length;
    const cur = currentPlayer(s).faction;
    const box = this.q('.players');
    box.innerHTML = s.players.map((pl) => {
      const owned = ownedTiles(s, pl.faction);
      const troops = owned.reduce((a, t) => a + t.troops, 0);
      const share = owned.length / land;
      const tag = pl.kind === 'ai' ? 'AI' : this.online ? esc(pl.name) : s.players.filter((x) => x.kind === 'human').length > 1 ? esc(pl.name) : 'You';
      const inc = pl.alive ? computeIncome(s, pl.faction).troops : 0;
      return `<div class="pl ${pl.faction === cur ? 'current' : ''} ${pl.alive ? '' : 'dead'}" style="--c:${FACTIONS[pl.faction].color}">
        ${pl.alive ? crest(pl.faction, 'pl-crest') : `<span class="pl-crest dead-ico">${ICONS.skull}</span>`}
        <div class="pl-main"><div class="pl-name">${FACTIONS[pl.faction].short}<span class="pl-tag">${tag}</span></div>
        <div class="pl-bar"><i style="width:${(share * 100).toFixed(1)}%"></i><em style="left:${75}%"></em></div>
        <div class="pl-stats"><span title="Hexes">${owned.length} hexes</span><span title="Troops on the map">${troops} troops</span><span title="Troops per turn">+${inc}/turn</span></div></div>
      </div>`;
    }).join('');
  }

  private renderHint() {
    const s = this.state;
    const p = currentPlayer(s);
    const fac = FACTIONS[p.faction];
    const hint = this.q('.hint');
    const text = this.q('.hint-text');
    const chips = this.q('.chips');
    const mine = this.controlsCurrent();
    hint.classList.toggle('hidden', !mine || s.phase === 'over');
    if (!mine) return;
    let t = '';
    let c = '';
    if (this.busy) {
      t = s.phase === 'attack' ? 'Battle! The dice decide…' : 'Your orders are being carried out…';
      if (text.textContent !== t) text.textContent = t;
      chips.innerHTML = '';
      return;
    }
    const chip = (attr: string, label: string, on: boolean) => `<button class="chip ${on ? 'on' : ''}" ${attr}>${label}</button>`;
    if (this.mode === 'champion') {
      t = `Choose one of your hexes for your ${fac.units.special}.`;
      c = chip('data-cancel', 'Cancel', false);
    } else if (this.mode === 'ability') {
      t = fac.ability.verb + '.';
      c = chip('data-cancel', 'Cancel', false);
    } else if (s.phase === 'reinforce') {
      t = p.reinforcements > 0 ? 'Choose your hexes to place troops.' : 'All troops placed. Buy more, or march to battle.';
      c = chip('data-place="1"', '+1', this.placeAmount === 1) + chip('data-place="5"', '+5', this.placeAmount === 5) + chip('data-place="all"', 'All', this.placeAmount === 'all');
    } else if (s.phase === 'attack') {
      t = this.selected === null ? 'Pick a hex with 2+ troops to attack from.' : 'Now pick an adjacent enemy hex.';
      c = chip('data-blitz="0"', 'Roll once', !this.blitz) + chip('data-blitz="1"', 'Blitz', this.blitz);
    } else if (s.phase === 'fortify') {
      t = s.fortifyUsed ? 'Troops moved. End your turn.' : this.selected === null ? 'Optional: pick a hex to move troops from.' : 'Pick a connected hex of yours.';
    }
    if (text.textContent !== t) text.textContent = t;
    if (chips.innerHTML !== c) chips.innerHTML = c;
  }

  private applyMarks() {
    const s = this.state;
    const mine = this.controlsCurrent() && !this.busy;
    if (!mine) { this.board.mark({}); return; }
    const p = currentPlayer(s);
    const f = p.faction;
    const nb = neighbors(s);
    const own = ownedTiles(s, f);
    if (this.mode === 'champion') {
      this.board.mark({ selectable: own.filter((t) => !t.champion).map((t) => t.id), dimOthers: true });
      return;
    }
    if (this.mode === 'ability') {
      const ids = s.tiles.filter((t) => t.terrain !== 'water' && !validate(s, { type: 'ability', p: f, tile: t.id })).map((t) => t.id);
      this.board.mark({ selectable: ids, dimOthers: true });
      return;
    }
    if (s.phase === 'reinforce') {
      this.board.mark({ selectable: p.reinforcements > 0 ? own.map((t) => t.id) : [] });
    } else if (s.phase === 'attack') {
      if (this.selected === null) {
        const ids = own.filter((t) => t.troops >= 2 && nb[t.id].some((n) => s.tiles[n].terrain !== 'water' && s.tiles[n].owner !== f)).map((t) => t.id);
        this.board.mark({ selectable: ids });
      } else {
        const targets = nb[this.selected].filter((n) => s.tiles[n].terrain !== 'water' && s.tiles[n].owner !== f);
        this.board.mark({ selected: this.selected, targets, dimOthers: true });
      }
    } else if (s.phase === 'fortify' && !s.fortifyUsed) {
      if (this.selected === null) {
        this.board.mark({ selectable: own.filter((t) => t.troops >= 2 && reachable(s, t.id, f).size > 0).map((t) => t.id) });
      } else {
        this.board.mark({ selected: this.selected, selectable: [...reachable(s, this.selected, f)], dimOthers: true });
      }
    } else {
      this.board.mark({});
    }
  }

  private bump(sel: string) {
    const el = this.q(sel);
    if (!el || fx.motion.reduced) return;
    el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 320, easing: fx.BOUNCE });
  }

  private stampPhase(phase: string) {
    const li = this.el.querySelector(`.phases li[data-phase="${phase}"]`);
    if (li && !fx.motion.reduced) li.animate([{ transform: 'scale(1.5) rotate(-6deg)', filter: 'brightness(1.6)' }, { transform: 'scale(1) rotate(0)', filter: 'brightness(1)' }], { duration: 420, easing: fx.BOUNCE });
    sfx.horn();
  }

  // ---------------- Tooltip ----------------
  private showTooltip(id: number, x: number, y: number, sticky: boolean) {
    const s = this.state;
    const t: Tile = s.tiles[id];
    const tip = this.q('.tooltip');
    const region = s.regions[t.region];
    const viewer = this.viewer();
    const regionOwned = viewer ? region.tiles.filter((rid) => s.tiles[rid].owner === viewer).length : -1;
    const owner = t.owner as Owner;
    const feats: string[] = [];
    if (t.capital) feats.push(`Capital of ${FACTIONS[t.capital].short}: 3 defence dice, +1 walls`);
    if (t.stronghold) feats.push('Stronghold: 3 defence dice');
    if (t.champion && owner !== 'neutral') feats.push(`${FACTIONS[owner].units.special} stationed (+1)`);
    let battle = '';
    const cur = currentPlayer(s);
    if (this.controlsCurrent() && s.phase === 'attack' && this.selected !== null && t.owner !== cur.faction && neighbors(s)[this.selected].includes(id)) {
      const from = s.tiles[this.selected];
      const m = combatMods(s, from, t);
      const chance = estimateWin(from.troops, t.troops, m.attBonus, m.defBonus, t.stronghold || !!t.capital);
      battle = `<div class="tip-battle"><span class="tip-dice"><b>${Math.min(3, from.troops - 1)}</b> dice vs <b>${Math.min(t.stronghold || t.capital ? 3 : 2, t.troops)}</b></span>
        <span class="odds" style="--p:${chance}">Blitz win chance ${Math.round(chance * 100)}%</span>
        ${m.att.length ? `<span class="tip-mods">You: ${m.att.map((x) => '+1 ' + x).join(', ')}</span>` : ''}
        ${m.def.length ? `<span class="tip-mods">Them: ${m.def.map((x) => '+1 ' + x).join(', ')}</span>` : ''}</div>`;
    }
    tip.innerHTML = `<div class="tip-head" style="--c:${owner === 'neutral' ? NEUTRAL.dark : FACTIONS[owner].color}">${crest(owner, 'tip-crest')}<div><b>${ownerName(owner)}</b><span>${t.troops} troop${t.troops === 1 ? '' : 's'}</span></div></div>
      <div class="tip-row"><b>${TERRAIN_INFO[t.terrain].name}</b> ${TERRAIN_INFO[t.terrain].text}</div>
      <div class="tip-row"><b>${region.name}</b> ${region.tiles.length} hexes${regionOwned >= 0 ? `, you hold ${regionOwned}` : ''} · whole region +${region.bonus} troops/turn</div>
      ${feats.map((f) => `<div class="tip-row tip-feat">${f}</div>`).join('')}${battle}`;
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
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, kind === 'warn' ? 2200 : 3400);
  }

  private async turnBanner(f: FactionId) {
    const p = this.state.players.find((x) => x.faction === f)!;
    const b = this.q('.banner');
    const fac = FACTIONS[f];
    const mine = this.controlsCurrent();
    const sub = mine ? 'Your turn' : p.kind === 'ai' ? 'AI turn' : `${esc(p.name)}'s turn`;
    b.style.setProperty('--c', fac.color);
    b.style.setProperty('--cd', fac.dark);
    b.innerHTML = `<div class="ribbon">${crest(f, 'banner-crest')}<div><b>${fac.name}</b><span>Round ${this.state.turn} · ${sub}</span></div></div>`;
    b.classList.remove('show');
    b.classList.add('reset');
    void b.offsetWidth;
    b.classList.remove('reset');
    b.classList.add('show');
    sfx.horn();
    await fx.wait(mine ? 1100 : 900);
    b.classList.remove('show');
  }

  private async bigBanner(title: string, sub: string, f: FactionId) {
    const b = this.q('.banner');
    b.style.setProperty('--c', FACTIONS[f].color);
    b.style.setProperty('--cd', FACTIONS[f].dark);
    b.innerHTML = `<div class="ribbon big">${crest(f, 'banner-crest')}<div><b>${esc(title)}</b><span>${esc(sub)}</span></div></div>`;
    b.classList.remove('show');
    b.classList.add('reset');
    void b.offsetWidth;
    b.classList.remove('reset');
    b.classList.add('show');
    await fx.wait(2200);
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

  private askAmount(title: string, sub: string, min: number, max: number, start: number, done: (n: number) => void, cancellable = true) {
    let n = start;
    const card = this.openModal(`
      <h2>${esc(title)}</h2><p class="sub">${esc(sub)}</p>
      <div class="amount">
        <button class="icon-btn amt-minus" aria-label="Fewer">${ICONS.minus}</button>
        <output class="amt-val">${n}</output>
        <button class="icon-btn amt-plus" aria-label="More">${ICONS.plus}</button>
      </div>
      <input class="amt-range" type="range" min="${min}" max="${max}" value="${n}" aria-label="Troops">
      <div class="modal-actions">
        ${cancellable ? '<button class="btn ghost amt-cancel">Cancel</button>' : `<button class="btn ghost amt-min">Only ${min}</button>`}
        <button class="btn go amt-ok">March ${n}</button>
      </div>`, 'small');
    const val = card.querySelector('.amt-val') as HTMLOutputElement;
    const range = card.querySelector('.amt-range') as HTMLInputElement;
    const ok = card.querySelector('.amt-ok') as HTMLButtonElement;
    const set = (v: number) => { n = Math.max(min, Math.min(max, v)); val.textContent = String(n); range.value = String(n); ok.textContent = `March ${n}`; };
    card.querySelector('.amt-minus')!.addEventListener('click', () => { sfx.click(); set(n - 1); });
    card.querySelector('.amt-plus')!.addEventListener('click', () => { sfx.click(); set(n + 1); });
    range.addEventListener('input', () => set(Number(range.value)));
    ok.addEventListener('click', () => { this.closeModal(); done(n); });
    card.querySelector('.amt-cancel')?.addEventListener('click', () => { this.closeModal(); this.cancel(); });
    card.querySelector('.amt-min')?.addEventListener('click', () => { this.closeModal(); done(min); });
    ok.focus();
  }

  private askMoveIn() {
    const pend = this.state.pending!;
    const f = currentPlayer(this.state).faction;
    this.askAmount('Victory! Move in', `How many ${FACTIONS[f].units.infantry.toLowerCase()} march into the conquered hex?`, pend.min, pend.max, pend.max, (n) => {
      this.submit({ type: 'move', p: f, n });
    }, false);
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

  private showVictory(f: FactionId, reason: 'last' | 'domination') {
    const s = this.state;
    const viewer = this.viewer();
    const won = viewer === f || (!viewer && true);
    won ? sfx.fanfare() : sfx.doom();
    const fac = FACTIONS[f];
    const rows = s.players.map((pl) => `<tr class="${pl.faction === f ? 'win' : ''}"><td>${crest(pl.faction, 'mini-crest')}${FACTIONS[pl.faction].short}</td><td>${ownedTiles(s, pl.faction).length}</td><td>${pl.kills}</td><td>${pl.alive ? (pl.faction === f ? 'Victor' : 'Defeated') : 'Fallen'}</td></tr>`).join('');
    const card = this.openModal(`
      <div class="victory-crest">${crest(f, 'big-crest')}</div>
      <h2>${fac.name} ${f === 'elves' ? 'rules' : 'rule'} Juräa!</h2>
      <p class="sub">${reason === 'last' ? 'Every rival capital has fallen.' : 'They hold three quarters of the continent.'} Round ${s.turn}.</p>
      <p class="quote">“${fac.quote}”</p>
      <table class="stats"><thead><tr><th>Faction</th><th>Hexes</th><th>Slain</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <div class="modal-actions">
        <button class="btn ghost v-title">${ICONS.home}Title</button>
        ${this.online ? '' : '<button class="btn go v-again">Play again</button>'}
      </div>`, 'victory');
    card.style.setProperty('--c', fac.color);
    card.querySelector('.v-title')!.addEventListener('click', () => { this.closeModal(); this.opts.onExit(); });
    card.querySelector('.v-again')?.addEventListener('click', () => { this.closeModal(); this.opts.onRestart(); });
    for (let i = 0; i < 5; i++) {
      const caps = ownedTiles(s, f);
      const t = caps[Math.floor(Math.random() * caps.length)];
      if (t) setTimeout(() => fx.confetti(this.board, t.id, [fac.color, fac.accent, '#ffd23f', '#fffdf5'], 18), i * 300);
    }
  }
}

/** Quick Monte Carlo estimate of a blitz attack succeeding (display only). */
function estimateWin(att: number, def: number, ab: number, db: number, three: boolean): number {
  let wins = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    let a = att, d = def;
    while (a > 1 && d > 0) {
      const ar = Array.from({ length: Math.min(3, a - 1) }, () => 1 + Math.floor(Math.random() * 6)).sort((x, y) => y - x);
      const dr = Array.from({ length: Math.min(three ? 3 : 2, d) }, () => 1 + Math.floor(Math.random() * 6)).sort((x, y) => y - x);
      ar[0] += ab; dr[0] += db;
      ar.sort((x, y) => y - x); dr.sort((x, y) => y - x);
      for (let k = 0; k < Math.min(ar.length, dr.length); k++) { if (ar[k] > dr[k]) d--; else a--; }
    }
    if (d <= 0) wins++;
  }
  return wins / N;
}
