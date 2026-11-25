import { sfx } from '../audio';
import { FACTIONS, NEUTRAL } from '../engine/factions';
import { dieTotal } from '../engine/rules';
import type { CombatRound, DieRoll, FactionId, Owner } from '../engine/types';
import { motion, wait } from '../render/fx';

const PIPS: Record<number, number[]> = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};

function face(v: number): string {
  return Array.from({ length: 9 }, (_, i) => `<i class="${PIPS[v].includes(i) ? 'on' : ''}"></i>`).join('');
}

export class DiceTray {
  el: HTMLElement;
  private skip = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'dice-tray';
    this.el.setAttribute('aria-live', 'polite');
    this.el.addEventListener('pointerdown', () => { this.skip = true; });
    parent.appendChild(this.el);
  }

  private dieEl(d: DieRoll, color: string, dark: string) {
    const el = document.createElement('div');
    el.className = 'die';
    el.style.setProperty('--die', color);
    el.style.setProperty('--die-dark', dark);
    el.innerHTML = `<div class="die-face">${face(1 + Math.floor(Math.random() * 6))}</div>${d.bonus ? `<b class="die-bonus">+${d.bonus}</b>` : ''}`;
    return el;
  }

  async play(att: FactionId, def: Owner, rounds: CombatRound[], attMods: string[], defMods: string[], names: { att: string; def: string }) {
    this.skip = false;
    const af = FACTIONS[att];
    const dfc = def === 'neutral' ? { color: '#f5f0df', dark: NEUTRAL.dark } : { color: FACTIONS[def].color, dark: FACTIONS[def].dark };
    const modChips = (m: string[]) => m.map((x) => `<span class="mod">+1 ${x}</span>`).join('');
    this.el.innerHTML = `
      <div class="tray-head">
        <div class="side side-att"><span class="side-name">${names.att}</span><div class="mods">${modChips(attMods)}</div></div>
        <div class="vs">VS</div>
        <div class="side side-def"><span class="side-name">${names.def}</span><div class="mods">${modChips(defMods)}</div></div>
      </div>
      <div class="tray-body">
        <div class="dice dice-att"></div>
        <div class="dice dice-def"></div>
      </div>
      <div class="tray-foot"><span class="tally tally-att"></span><span class="round-no"></span><span class="tally tally-def"></span></div>`;
    const attBox = this.el.querySelector('.dice-att') as HTMLElement;
    const defBox = this.el.querySelector('.dice-def') as HTMLElement;
    const tallyA = this.el.querySelector('.tally-att') as HTMLElement;
    const tallyD = this.el.querySelector('.tally-def') as HTMLElement;
    const roundNo = this.el.querySelector('.round-no') as HTMLElement;
    this.el.classList.add('open');
    await wait(motion.reduced ? 0 : 260);
    let lostA = 0;
    let lostD = 0;
    for (let ri = 0; ri < rounds.length; ri++) {
      const r = rounds[ri];
      const fast = ri > 0 || this.skip;
      const sp = this.skip ? 4 : fast ? 2.2 : 1;
      const atts = r.att.map((d) => this.dieEl(d, af.color, af.dark));
      const defs = r.def.map((d) => this.dieEl(d, dfc.color, dfc.dark));
      attBox.replaceChildren(...atts);
      defBox.replaceChildren(...defs);
      roundNo.textContent = rounds.length > 1 ? `Round ${ri + 1} of ${rounds.length}` : '';
      if (!fast || ri % 3 === 0) sfx.dice();
      const all = [...atts, ...defs];
      const rolls = [...r.att, ...r.def];
      all.forEach((el, i) => el.classList.add('rolling'));
      if (!motion.reduced) {
        const steps = Math.round(7 / sp);
        for (let s = 0; s < steps; s++) {
          all.forEach((el) => { (el.firstElementChild as HTMLElement).innerHTML = face(1 + Math.floor(Math.random() * 6)); });
          await wait(65 / sp);
        }
      }
      all.forEach((el, i) => {
        el.classList.remove('rolling');
        el.classList.add('landed');
        (el.firstElementChild as HTMLElement).innerHTML = face(rolls[i].value);
      });
      await wait(160 / sp);
      // Compare pairs best against best.
      const pairs = Math.min(r.att.length, r.def.length);
      for (let i = 0; i < pairs; i++) {
        const aWins = dieTotal(r.att[i]) > dieTotal(r.def[i]);
        (aWins ? defs[i] : atts[i]).classList.add('lost');
        (aWins ? atts[i] : defs[i]).classList.add('won');
      }
      for (let i = pairs; i < atts.length; i++) atts[i].classList.add('idle');
      for (let i = pairs; i < defs.length; i++) defs[i].classList.add('idle');
      if (r.defLoss) sfx.hit();
      lostA += r.attLoss;
      lostD += r.defLoss;
      tallyA.textContent = lostA ? `Lost ${lostA}` : 'No losses';
      tallyD.textContent = lostD ? `Lost ${lostD}` : 'No losses';
      tallyA.classList.toggle('bad', lostA > 0);
      tallyD.classList.toggle('bad', lostD > 0);
      await wait((fast ? 260 : 620) / (this.skip ? 3 : 1));
    }
    await wait(this.skip ? 150 : 450);
    this.el.classList.remove('open');
  }
}
