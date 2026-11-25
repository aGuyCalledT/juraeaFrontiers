import { sfx } from '../audio';
import { FACTIONS, NEUTRAL } from '../engine/factions';
import type { CombatDie, CombatEvent, Owner, RaiseResult, Unit } from '../engine/types';
import { RAISE, UNIT_STATS } from '../engine/unitstats';
import { motion, wait } from '../render/fx';
import { playUnit, unitSvg } from '../render/units';
import { ICONS } from './icons';

const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
const face = (v: number) => Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'on' : ''}"></i>`).join('');
const rnd = () => 1 + Math.floor(Math.random() * 6);
const colours = (o: Owner) => (o === 'neutral' ? { c: '#f5f0df', d: NEUTRAL.dark } : { c: FACTIONS[o].color, d: FACTIONS[o].dark });
const sign = (n: number) => (n >= 0 ? `+${n}` : `−${-n}`);

/** A unit portrait: framed, red-tinted when wounded. */
export function portrait(u: Unit, cls = ''): string {
  const max = UNIT_STATS[u.type].hp;
  const hurt = u.hp < max;
  return `<span class="portrait ${hurt ? 'hurt' : ''} ${cls}" data-unit="${u.id}">${unitSvg(u.type)}<span class="hp">${Array.from({ length: max }, (_, i) => `<i class="${i < u.hp ? 'on' : ''}"></i>`).join('')}</span></span>`;
}

interface Cell { unit: Unit; el: HTMLElement; sprite: Element; roll: HTMLElement; hp: number }

export class DiceTray {
  el: HTMLElement;
  private skip = false;
  private cells = new Map<number, Cell>();

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'dice-tray battle';
    this.el.setAttribute('aria-live', 'polite');
    this.el.addEventListener('pointerdown', (e) => { if (!(e.target as HTMLElement).closest('button')) this.skip = true; });
    parent.appendChild(this.el);
  }

  private w(ms: number) { return wait(this.skip ? ms / 4 : ms); }
  get isOpen() { return this.el.classList.contains('open'); }

  close() {
    this.el.classList.remove('open');
  }

  private side(u: Unit, d: CombatDie | undefined, o: Owner, right: boolean): string {
    const st = UNIT_STATS[u.type];
    const bone = u.type === 'priest' ? ' bone' : '';
    const c = colours(o);
    return `<div class="bcell ${right ? 'right' : ''}" data-cell="${u.id}">
      ${portrait(u)}
      <span class="bname">${st.name}</span>
      ${d ? `<span class="broll${bone}" style="--die:${c.c};--die-dark:${c.d}"><b class="bdie">${rnd()}</b><span class="bmod">${sign(d.bonus)}</span><span class="beq">=</span><b class="btotal">?</b></span>` : '<span class="broll none">no die</span>'}
    </div>`;
  }

  /** Plays one combat round as a list of pairs, strongest at the top. Leaves the tray open. */
  async play(ev: CombatEvent, names: { att: string; def: string }) {
    this.skip = false;
    this.cells.clear();
    const A = ev.attDice.filter((d) => !d.void).sort((x, y) => y.total - x.total);
    const D = ev.defDice.filter((d) => !d.void).sort((x, y) => y.total - x.total);
    const voidA = ev.attDice.filter((d) => d.void), voidD = ev.defDice.filter((d) => d.void);
    const uA = new Map(ev.attacker.units.map((u) => [u.id, u]));
    const uD = new Map(ev.defender.units.map((u) => [u.id, u]));
    const rows: string[] = [];
    const n = Math.max(A.length, D.length);
    for (let i = 0; i < n; i++) {
      const a = A[i], d = D[i];
      rows.push(`<div class="brow ${a && d ? '' : 'spare'}" data-row="${i}">
        ${a ? this.side(uA.get(a.unit)!, a, ev.attacker.owner, false) : '<div class="bcell empty"></div>'}
        <div class="bmid">${a && d ? '<span class="bvs">vs</span>' : '<span class="blost">die lost</span>'}</div>
        ${d ? this.side(uD.get(d.unit)!, d, ev.defender.owner, true) : '<div class="bcell empty right"></div>'}
      </div>`);
    }
    for (const v of [...voidA.map((d) => [d, 'att'] as const), ...voidD.map((d) => [d, 'def'] as const)]) {
      const [d, sideName] = v;
      const u = (sideName === 'att' ? uA : uD).get(d.unit)!;
      const cell = this.side(u, undefined, sideName === 'att' ? ev.attacker.owner : ev.defender.owner, sideName === 'def');
      rows.push(`<div class="brow spare">${sideName === 'att' ? cell : '<div class="bcell empty"></div>'}<div class="bmid"><span class="blost">shot down</span></div>${sideName === 'def' ? cell : '<div class="bcell empty right"></div>'}</div>`);
    }
    const ca = colours(ev.attacker.owner), cd = colours(ev.defender.owner);
    this.el.innerHTML = `
      <div class="bhead">
        <div class="bteam" style="--c:${ca.c}"><b>${names.att}</b><span>attacks${ev.attackMods.length ? ' · ' + ev.attackMods.join(', ') : ''}</span></div>
        <div class="bround">Round ${ev.round} of 2</div>
        <div class="bteam right" style="--c:${cd.c}"><b>${names.def}</b><span>${ev.terrainBonus.length ? ev.terrainBonus.join(', ') : 'no defence bonus'}</span></div>
      </div>
      <div class="bshots"></div>
      <div class="blist">${rows.join('')}</div>
      <div class="bstatus"></div>
      <div class="raise-row"></div>
      <div class="bchoice"></div>`;
    for (const el of this.el.querySelectorAll<HTMLElement>('[data-cell]')) {
      const id = Number(el.dataset.cell);
      const unit = uA.get(id) ?? uD.get(id)!;
      this.cells.set(id, { unit, el, sprite: el.querySelector('.sprite')!, roll: el.querySelector('.broll') as HTMLElement, hp: unit.hp });
    }
    const status = this.el.querySelector('.bstatus') as HTMLElement;
    const say = (t: string) => { status.textContent = t; };
    this.el.classList.add('open');
    await this.w(motion.reduced ? 0 : 280);

    // Roll: numbers tumble, then settle with their modifiers added.
    say(`Every unit rolls a die and adds its ${ev.round === 1 ? 'attack or defence' : 'bonus'}.`);
    sfx.dice();
    const allDice = [...ev.attDice, ...ev.defDice].filter((d) => !d.void);
    if (!motion.reduced) for (let i = 0; i < 7; i++) {
      for (const d of allDice) { const c = this.cells.get(d.unit); if (c) c.roll.querySelector('.bdie')!.textContent = String(rnd()); }
      await this.w(55);
    }
    for (const d of allDice) {
      const c = this.cells.get(d.unit);
      if (!c) continue;
      c.roll.querySelector('.bdie')!.textContent = String(d.roll);
      c.roll.querySelector('.btotal')!.textContent = String(d.total);
      c.roll.classList.add('landed');
      if (d.roll === 6) c.roll.classList.add('six');
    }
    await this.w(450);

    // Cannon shots before the exchange.
    const shots = this.el.querySelector('.bshots') as HTMLElement;
    for (const shot of ev.shots) {
      const c = this.cells.get(shot.shooter);
      if (c) void playUnit(c.sprite, 'attack');
      sfx.thud();
      const victims = shot.hits.map((h) => (uA.get(h) ?? uD.get(h))).filter(Boolean) as Unit[];
      shots.insertAdjacentHTML('beforeend', `<div class="bshot">Lead Belcher rolled a 6! Cannon: ${shot.rolls.map((r) => `<b class="${r >= 4 ? 'hit' : ''}">${r}</b>`).join(' ')} ${victims.length ? `· hits ${victims.map((v) => UNIT_STATS[v.type].name).join(', ')}` : '· missed'}</div>`);
      for (const h of shot.hits) { await this.w(260); this.hurt(h); sfx.hit(); }
      await this.w(350);
    }

    // Resolve the pairs from the top.
    const pace = ev.pairs.length > 6 ? 200 : 360;
    for (let i = 0; i < ev.pairs.length; i++) {
      const pr = ev.pairs[i];
      const row = this.el.querySelector(`[data-row="${i}"]`) as HTMLElement | null;
      row?.classList.add('active');
      row?.scrollIntoView({ block: 'nearest' });
      const win = this.cells.get(pr.winner === 'att' ? pr.att : pr.def);
      if (win) { void playUnit(win.sprite, 'attack'); win.roll.classList.add('won'); }
      this.cells.get(pr.winner === 'att' ? pr.def : pr.att)?.roll.classList.add('lost');
      row?.querySelector('.bmid')?.insertAdjacentHTML('beforeend', `<span class="barrow ${pr.winner}">${ICONS.sword}</span>`);
      await this.w(pace);
      this.hurt(pr.victim);
      if (pr.winner === 'att') sfx.hit(); else sfx.click();
      await this.w(pace * 0.6);
      row?.classList.remove('active');
    }
    const lostA = ev.attacker.units.filter((u) => ev.dead.includes(u.id)).length;
    const lostD = ev.defender.units.filter((u) => ev.dead.includes(u.id)).length;
    const loot = ev.bounty.att || ev.bounty.def ? ` Bounty: ${[ev.bounty.att ? `${names.att} +${ev.bounty.att}` : '', ev.bounty.def ? `${names.def} +${ev.bounty.def}` : ''].filter(Boolean).join(', ')} gold.` : '';
    say(`${names.att} lost ${lostA}, ${names.def} lost ${lostD}.${loot}${ev.defenderWiped ? ` ${names.def} are wiped out!` : ev.attackerWiped ? ` ${names.att} are wiped out!` : ''}`);
    await this.w(ev.final ? 700 : 400);
  }

  private hurt(id: number) {
    const c = this.cells.get(id);
    if (!c) return;
    c.hp -= 1;
    const p = c.el.querySelector('.portrait') as HTMLElement;
    p.classList.add('hurt');
    const pips = p.querySelectorAll('.hp i');
    pips[c.hp]?.classList.remove('on');
    void playUnit(c.sprite, 'hit');
    if (c.hp <= 0) setTimeout(() => c.el.classList.add('dead'), 300);
  }

  /** Attacker's choice after round 1. */
  ask(): Promise<'continue' | 'retreat'> {
    const box = this.el.querySelector('.bchoice') as HTMLElement;
    this.el.classList.add('open');
    box.innerHTML = `<button class="btn ghost small b-retreat">Retreat</button><button class="btn go b-fight">${ICONS.sword}Fight round 2</button>`;
    return new Promise((resolve) => {
      box.querySelector('.b-fight')!.addEventListener('click', () => { box.innerHTML = ''; resolve('continue'); });
      box.querySelector('.b-retreat')!.addEventListener('click', () => { box.innerHTML = ''; resolve('retreat'); });
    });
  }

  /** The necromancers' raising roll after a fight. */
  async playRaise(r: RaiseResult) {
    const row = this.el.querySelector('.raise-row') as HTMLElement | null;
    if (!row || !this.isOpen) return;
    row.classList.add('show');
    const status = this.el.querySelector('.bstatus') as HTMLElement;
    status.textContent = 'The Death Cults roll for the fallen: every 5 or 6 rises as a skeleton.';
    const n = r.rolls.length;
    row.innerHTML = r.rolls.map((_, i) => `<div class="die raise ${i >= n - r.priestRolls ? 'bone' : ''}"><div class="die-face">${face(rnd())}</div></div>`).join('');
    const dice = [...row.children] as HTMLElement[];
    dice.forEach((d) => d.classList.add('rolling'));
    sfx.dice();
    if (!motion.reduced) for (let i = 0; i < 6; i++) { dice.forEach((d) => { d.firstElementChild!.innerHTML = face(rnd()); }); await this.w(60); }
    let left = r.raised;
    dice.forEach((d, i) => {
      d.classList.remove('rolling');
      d.firstElementChild!.innerHTML = face(r.rolls[i]);
      if (r.rolls[i] >= RAISE.on) d.classList.add(left-- > 0 ? 'won' : 'capped');
    });
    await this.w(450);
    if (r.raised) { sfx.magic(); status.textContent = `${r.raised} skeleton${r.raised > 1 ? 's rise' : ' rises'} to join the Death Cults!`; }
    else status.textContent = 'No skeletons rise this time.';
    await this.w(900);
  }
}
