import { sfx } from '../audio';
import { FACTIONS, NEUTRAL } from '../engine/factions';
import type { CombatEvent, Owner, Unit } from '../engine/types';
import { UNIT_STATS } from '../engine/unitstats';
import { motion, wait } from '../render/fx';
import { playUnit, unitSvg } from '../render/units';

const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
const face = (v: number) => Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'on' : ''}"></i>`).join('');
const rnd = () => 1 + Math.floor(Math.random() * 6);

interface Slot { unit: Unit; el: HTMLElement; sprite: Element; die: HTMLElement; hp: HTMLElement; hpLeft: number }

const colours = (o: Owner) => (o === 'neutral' ? { c: '#f5f0df', d: NEUTRAL.dark } : { c: FACTIONS[o].color, d: FACTIONS[o].dark });

export class DiceTray {
  el: HTMLElement;
  private skip = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'dice-tray battle';
    this.el.setAttribute('aria-live', 'polite');
    this.el.addEventListener('pointerdown', () => { this.skip = true; });
    parent.appendChild(this.el);
  }

  private w(ms: number) { return wait(this.skip ? ms / 4 : ms); }

  async play(ev: CombatEvent, names: { att: string; def: string }) {
    this.skip = false;
    const big = ev.attacker.units.length + ev.defender.units.length > 14;
    const side = (cls: string, title: string, mods: string[], o: Owner) => `
      <div class="bside ${cls}" style="--c:${colours(o).c};--cd:${colours(o).d}">
        <div class="bside-head"><b>${title}</b>${mods.map((m) => `<span class="mod">${m}</span>`).join('')}</div>
        <div class="slots"></div>
      </div>`;
    this.el.classList.toggle('big', big);
    this.el.innerHTML = `
      <div class="bfield">${side('att', names.att, ['Attacking'], ev.attacker.owner)}<div class="vs">VS</div>${side('def', names.def, ev.terrainBonus, ev.defender.owner)}</div>
      <div class="bstatus"></div><div class="raise-row"></div>`;
    const status = this.el.querySelector('.bstatus') as HTMLElement;
    const say = (t: string) => { status.textContent = t; };
    const mk = (units: Unit[], box: HTMLElement, o: Owner) => units.map((u) => {
      const el = document.createElement('div');
      el.className = 'slot';
      const max = UNIT_STATS[u.type].hp;
      const bone = u.type === 'priest' ? ' bone' : '';
      el.innerHTML = `${unitSvg(u.type, 'idle' + (box.closest('.def') ? ' flip' : ''))}
        <div class="die${bone}" style="--die:${colours(o).c};--die-dark:${colours(o).d}"><div class="die-face">${face(rnd())}</div></div>
        <div class="hp">${Array.from({ length: max }, (_, i) => `<i class="${i < u.hp ? 'on' : ''}"></i>`).join('')}</div>`;
      box.appendChild(el);
      return { unit: u, el, sprite: el.querySelector('.sprite')!, die: el.querySelector('.die') as HTMLElement, hp: el.querySelector('.hp') as HTMLElement, hpLeft: u.hp };
    });
    const attBox = this.el.querySelector('.att .slots') as HTMLElement;
    const defBox = this.el.querySelector('.def .slots') as HTMLElement;
    const slots = new Map<number, Slot>();
    for (const s of mk(ev.attacker.units, attBox, ev.attacker.owner)) slots.set(s.unit.id, s);
    for (const s of mk(ev.defender.units, defBox, ev.defender.owner)) slots.set(s.unit.id, s);
    this.el.classList.add('open');
    await this.w(motion.reduced ? 0 : 320);

    // 1. Everyone rolls.
    say('Every unit rolls a die…');
    sfx.dice();
    const allDice = [...ev.attDice, ...ev.defDice];
    for (const d of allDice) slots.get(d.unit)?.die.classList.add('rolling');
    if (!motion.reduced) for (let i = 0; i < 7; i++) { for (const d of allDice) { const s = slots.get(d.unit); if (s) s.die.firstElementChild!.innerHTML = face(rnd()); } await this.w(60); }
    for (const d of allDice) {
      const s = slots.get(d.unit);
      if (!s) continue;
      s.die.classList.remove('rolling');
      s.die.classList.add('landed');
      s.die.firstElementChild!.innerHTML = face(d.roll);
      s.die.insertAdjacentHTML('beforeend', `<b class="die-total">${d.total}</b>${d.bonus ? `<em class="die-bonus">${d.bonus > 0 ? '+' : ''}${d.bonus}</em>` : ''}`);
    }
    await this.w(500);

    const hurt = async (id: number) => {
      const s = slots.get(id);
      if (!s) return;
      s.hpLeft -= 1;
      const pips = s.hp.querySelectorAll('i');
      pips[s.hpLeft]?.classList.remove('on');
      if (s.hpLeft <= 0) { s.el.classList.add('dead'); void playUnit(s.sprite, 'die'); }
      else void playUnit(s.sprite, 'hit');
    };

    // 2. Lead Belcher cannon shots.
    for (const shot of ev.shots) {
      const s = slots.get(shot.shooter);
      if (!s) continue;
      say('Lead Belcher rolled a 6: cannon shot!');
      void playUnit(s.sprite, 'attack');
      sfx.thud();
      for (let i = 0; i < shot.rolls.length; i++) {
        s.el.insertAdjacentHTML('beforeend', `<div class="mini-die ${shot.rolls[i] >= 4 ? 'hit' : ''}">${shot.rolls[i]}</div>`);
        await this.w(380);
        if (shot.rolls[i] >= 4 && shot.hits[i] !== undefined) { await hurt(shot.hits[i]); sfx.hit(); }
        await this.w(300);
      }
    }
    for (const d of allDice) if (d.void) slots.get(d.unit)?.die.classList.add('void');

    // 3. Best against best.
    const order = (dice: typeof ev.attDice) => dice.filter((d) => !d.void).sort((a, b) => b.total - a.total);
    const A = order(ev.attDice), D = order(ev.defDice);
    A.forEach((d, i) => slots.get(d.unit)?.die.setAttribute('data-rank', String(i + 1)));
    D.forEach((d, i) => slots.get(d.unit)?.die.setAttribute('data-rank', String(i + 1)));
    say(`Highest against highest: ${ev.pairs.length} pair${ev.pairs.length === 1 ? '' : 's'}${A.length !== D.length ? `, ${Math.abs(A.length - D.length)} spare ${Math.abs(A.length - D.length) === 1 ? 'die is' : 'dice are'} lost` : ''}.`);
    await this.w(300);
    const pace = ev.pairs.length > 6 ? 170 : 330;
    for (const pr of ev.pairs) {
      const a = slots.get(pr.att)!, d = slots.get(pr.def)!;
      a.die.classList.add('cmp'); d.die.classList.add('cmp');
      const win = pr.winner === 'att' ? a : d;
      void playUnit(win.sprite, 'attack');
      win.die.classList.add('won');
      (pr.winner === 'att' ? d : a).die.classList.add('lost');
      await this.w(pace);
      await hurt(pr.victim);
      if (pr.winner === 'att') sfx.hit(); else sfx.click();
      await this.w(pace);
      a.die.classList.remove('cmp'); d.die.classList.remove('cmp');
    }
    for (const d of [...A.slice(ev.pairs.length), ...D.slice(ev.pairs.length)]) slots.get(d.unit)?.die.classList.add('spare');
    const lostA = ev.attacker.units.filter((u) => ev.dead.includes(u.id)).length;
    const lostD = ev.defender.units.filter((u) => ev.dead.includes(u.id)).length;
    say(`${names.att} lost ${lostA}, ${names.def} lost ${lostD}.`);
    await this.w(600);

    // 4. The dead may rise.
    if (ev.raise) {
      const row = this.el.querySelector('.raise-row') as HTMLElement;
      row.classList.add('show');
      say(`The Death Cults roll for the fallen: every 6 rises as a skeleton.`);
      const n = ev.raise.rolls.length;
      row.innerHTML = ev.raise.rolls.map((_, i) => `<div class="die raise ${i >= n - ev.raise!.priestRolls ? 'bone' : ''}"><div class="die-face">${face(rnd())}</div></div>`).join('');
      const dice = [...row.children] as HTMLElement[];
      dice.forEach((d) => d.classList.add('rolling'));
      sfx.dice();
      if (!motion.reduced) for (let i = 0; i < 6; i++) { dice.forEach((d) => { d.firstElementChild!.innerHTML = face(rnd()); }); await this.w(60); }
      let left = ev.raise.raised;
      dice.forEach((d, i) => {
        d.classList.remove('rolling');
        d.firstElementChild!.innerHTML = face(ev.raise!.rolls[i]);
        if (ev.raise!.rolls[i] === 6) d.classList.add(left-- > 0 ? 'won' : 'capped');
      });
      await this.w(450);
      if (ev.raise.raised) {
        sfx.magic();
        const box = ev.attacker.owner === 'necro' ? attBox : defBox;
        for (let i = 0; i < ev.raise.raised; i++) {
          const el = document.createElement('div');
          el.className = 'slot risen';
          el.innerHTML = unitSvg('skeleton', 'idle' + (box === defBox ? ' flip' : ''));
          box.appendChild(el);
          await this.w(160);
        }
        say(`${ev.raise.raised} skeleton${ev.raise.raised > 1 ? 's rise' : ' rises'} to join the Death Cults!`);
      } else say('No skeletons rise this time.');
      await this.w(800);
    }
    await this.w(this.skip ? 200 : 500);
    this.el.classList.remove('open');
    await wait(motion.reduced ? 0 : 300);
  }
}
