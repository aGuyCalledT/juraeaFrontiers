import { FACTIONS, NEUTRAL } from '../engine/factions';
import { hexDistance } from '../engine/hex';
import type { FactionId, Owner } from '../engine/types';
import { INK, use } from './art';
import type { Board } from './board';

const NS = 'http://www.w3.org/2000/svg';
export const BOUNCE = 'cubic-bezier(.34,1.56,.64,1)';
export const OUT = 'cubic-bezier(.16,1,.3,1)';

export const motion = {
  speed: 1, // >1 = faster
  get reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  },
};

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms / motion.speed));

function anim(el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (motion.reduced) return null;
  const o = { ...opts, duration: Number(opts.duration ?? 300) / motion.speed, delay: Number(opts.delay ?? 0) / motion.speed };
  return el.animate(frames, o);
}

const done = (a: Animation | null) => (a ? a.finished.then(() => undefined).catch(() => undefined) : Promise.resolve());

const colorOf = (o: Owner | null) => (!o || o === 'neutral' ? NEUTRAL.color : FACTIONS[o].color);

/** Island assembles: tiles drop in, rippling out from the centre. */
export function introDrop(board: Board) {
  const st = board.state;
  st.tiles.forEach((t) => {
    const v = board.view(t.id);
    if (!v) return;
    const d = hexDistance(0, 0, t.q, t.r);
    const delay = d * 70 + (t.deco % 60);
    anim(v.inner, [
      { transform: 'translateY(-260px) scale(0.7)', opacity: 0 },
      { transform: 'translateY(8px) scale(1.04, 0.94)', opacity: 1, offset: 0.7 },
      { transform: 'translateY(0) scale(1)', opacity: 1 },
    ], { duration: 620, delay, easing: OUT, fill: 'backwards' });
    anim(v.badgeIn, [{ transform: 'scale(0)' }, { transform: 'scale(1.25)', offset: 0.6 }, { transform: 'scale(1)' }], {
      duration: 380, delay: delay + 500, easing: BOUNCE, fill: 'backwards',
    });
  });
}

export function popBadge(board: Board, id: number) {
  const v = board.view(id);
  if (!v) return;
  anim(v.badgeIn, [{ transform: 'scale(1)' }, { transform: 'scale(1.45)' }, { transform: 'scale(1)' }], { duration: 360, easing: BOUNCE });
}

export function bounceTile(board: Board, id: number, strength = 1) {
  const v = board.view(id);
  if (!v) return null;
  return anim(v.inner, [
    { transform: 'translateY(0) scale(1)' },
    { transform: `translateY(${-14 * strength}px) scale(${1 + 0.04 * strength})` },
    { transform: `translateY(3px) scale(${1 + 0.03 * strength}, ${1 - 0.05 * strength})` },
    { transform: 'translateY(0) scale(1)' },
  ], { duration: 520, easing: OUT });
}

export function shakeTile(board: Board, id: number) {
  const v = board.view(id);
  if (!v) return;
  anim(v.inner, [
    { transform: 'translateX(0)' }, { transform: 'translateX(-6px) rotate(-1.5deg)' }, { transform: 'translateX(5px) rotate(1deg)' },
    { transform: 'translateX(-3px)' }, { transform: 'translateX(0)' },
  ], { duration: 360, easing: 'ease-out' });
}

export function shakeScreen(el: HTMLElement, power = 1) {
  anim(el, [
    { transform: 'translate(0,0)' }, { transform: `translate(${-7 * power}px, ${5 * power}px)` }, { transform: `translate(${6 * power}px, ${-4 * power}px)` },
    { transform: `translate(${-3 * power}px, ${2 * power}px)` }, { transform: 'translate(0,0)' },
  ], { duration: 380, easing: 'ease-out' });
}

export function floatText(board: Board, id: number, text: string, kind: 'gain' | 'loss' | 'info' = 'gain', dy = 0) {
  const c = board.center(id);
  const t = document.createElementNS(NS, 'text');
  t.setAttribute('class', `float float-${kind}`);
  t.setAttribute('x', String(c.x));
  t.setAttribute('y', String(c.y - 10 + dy));
  t.setAttribute('text-anchor', 'middle');
  t.textContent = text;
  board.fxLayer.appendChild(t);
  const a = anim(t, [
    { transform: 'translateY(10px) scale(0.4)', opacity: 0 },
    { transform: 'translateY(-14px) scale(1.15)', opacity: 1, offset: 0.25 },
    { transform: 'translateY(-26px) scale(1)', opacity: 1, offset: 0.7 },
    { transform: 'translateY(-44px) scale(0.95)', opacity: 0 },
  ], { duration: 1100, easing: OUT });
  if (a) a.finished.finally(() => t.remove()); else setTimeout(() => t.remove(), 800);
}

function bezier(a: { x: number; y: number }, b: { x: number; y: number }, lift: number) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 - lift;
  return { mx, my, at: (k: number) => ({ x: (1 - k) ** 2 * a.x + 2 * (1 - k) * k * mx + k * k * b.x, y: (1 - k) ** 2 * a.y + 2 * (1 - k) * k * my + k * k * b.y }) };
}

/** Persistent aiming arrow between two hexes (attack / fortify preview). */
export function showAim(board: Board, from: number, to: number | null, kind: 'attack' | 'move', f?: FactionId) {
  const layer = board.arrowLayer;
  layer.replaceChildren();
  if (to === null) return;
  const a = board.center(from);
  const b = board.center(to);
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const s = { x: a.x + Math.cos(ang) * 12, y: a.y + Math.sin(ang) * 12 - 22 };
  const e = { x: b.x - Math.cos(ang) * 14, y: b.y - Math.sin(ang) * 14 - 16 };
  const bz = bezier(s, e, 78);
  const end = bz.at(1), pre = bz.at(0.9);
  const ha = Math.atan2(end.y - pre.y, end.x - pre.x);
  const head = [[6, 0], [-22, -16], [-22, 16]].map(([x, y]) => [end.x + x * Math.cos(ha) - y * Math.sin(ha), end.y + x * Math.sin(ha) + y * Math.cos(ha)]);
  const d = `M${s.x} ${s.y} Q${bz.mx} ${bz.my} ${end.x} ${end.y}`;
  const color = kind === 'attack' ? (f ? FACTIONS[f].color : '#ff5a3c') : '#7fdc52';
  layer.innerHTML = `<g class="aim aim-${kind}"><path d="${d}" stroke="${INK}" stroke-width="17" fill="none" stroke-linecap="round" opacity="0.35" transform="translate(0 10)"/><path d="${d}" stroke="${INK}" stroke-width="16" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#fff4dc" stroke-width="10" fill="none" stroke-linecap="round"/><path class="aim-dash" d="${d}" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="14 12"/><polygon points="${head.map((p) => p.join(',')).join(' ')}" fill="${color}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/></g>`;
}

export function clearAim(board: Board) {
  board.arrowLayer.replaceChildren();
}

const PROJECTILE: Record<FactionId, (c: string) => string> = {
  necro: () => `<circle r="9" fill="#8dff5a" stroke="${INK}" stroke-width="3"/><circle cx="-3" cy="-2" r="2.4" fill="${INK}"/><circle cx="3" cy="-2" r="2.4" fill="${INK}"/>`,
  elves: () => `<path d="M-14 0 L10 0" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M-14 0 L10 0" stroke="#c98f52" stroke-width="2.6"/><path d="M8 -6 L18 0 L8 6 Z" fill="#dfe6ec" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M-16 -5 L-10 0 L-16 5" fill="#ffe36b" stroke="${INK}" stroke-width="2"/>`,
  giants: () => `<path d="M-10 -6 L-2 -11 L9 -7 L11 4 L3 10 L-8 8 Z" fill="#9b8f80" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M-3 -3 L3 -5" stroke="#6f655a" stroke-width="2.4"/>`,
};

/** Volley of faction projectiles flying in an arc. */
export async function volley(board: Board, from: number, to: number, f: FactionId, count = 3) {
  if (motion.reduced) return;
  const a = board.center(from);
  const b = board.center(to);
  const flights: Promise<void>[] = [];
  for (let i = 0; i < count; i++) {
    flights.push(new Promise((resolve) => {
      const g = document.createElementNS(NS, 'g');
      g.innerHTML = PROJECTILE[f]('');
      board.fxLayer.appendChild(g);
      const jitter = { x: (Math.random() - 0.5) * 30, y: (Math.random() - 0.5) * 20 };
      const bz = bezier({ x: a.x, y: a.y - 20 }, { x: b.x + jitter.x, y: b.y - 10 + jitter.y }, 70 + Math.random() * 30);
      const dur = 520 / motion.speed;
      const t0 = performance.now() + (i * 110) / motion.speed;
      const spin = f === 'giants';
      const step = (now: number) => {
        const k = Math.max(0, Math.min(1, (now - t0) / dur));
        const p = bz.at(k);
        const q = bz.at(Math.min(1, k + 0.02));
        const ang = spin ? k * 720 : (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
        g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${ang.toFixed(1)})`);
        g.style.opacity = k <= 0 ? '0' : '1';
        if (k < 1) requestAnimationFrame(step);
        else { g.remove(); impact(board, b.x + jitter.x, b.y - 10 + jitter.y, f); resolve(); }
      };
      requestAnimationFrame(step);
    }));
  }
  await Promise.all(flights);
}

function impact(board: Board, x: number, y: number, f: FactionId) {
  const color = f === 'necro' ? '#8dff5a' : f === 'elves' ? '#ffe36b' : '#d9c7a6';
  for (let i = 0; i < 5; i++) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', String(x));
    c.setAttribute('cy', String(y));
    c.setAttribute('r', String(4 + Math.random() * 4));
    c.setAttribute('fill', color);
    c.setAttribute('stroke', INK);
    c.setAttribute('stroke-width', '2');
    board.fxLayer.appendChild(c);
    const ang = Math.random() * Math.PI * 2;
    const dist = 18 + Math.random() * 18;
    const a = anim(c, [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist - 10}px) scale(0.2)`, opacity: 0 },
    ], { duration: 420, easing: OUT });
    if (a) a.finished.finally(() => c.remove()); else c.remove();
  }
}

/** Conquest: tile hops, flag drops in, confetti in the faction colour. */
export async function conquest(board: Board, id: number, f: FactionId) {
  const v = board.view(id);
  if (!v) return;
  bounceTile(board, id, 1.4);
  anim(v.ring, [{ strokeWidth: '0', opacity: 0 }, { strokeWidth: '22', opacity: 1, offset: 0.4 }, { strokeWidth: '7', opacity: 1 }], { duration: 650, easing: OUT });
  const flag = v.build.querySelector('.flag');
  if (flag) anim(flag, [{ transform: 'translateY(-90px)', opacity: 0 }, { transform: 'translateY(4px)', opacity: 1, offset: 0.6 }, { transform: 'translateY(0)' }], { duration: 560, easing: BOUNCE, delay: 120 });
  confetti(board, id, [FACTIONS[f].color, FACTIONS[f].accent, '#fffdf5'], 16);
  await wait(450);
}

export function confetti(board: Board, id: number, colors: string[], n: number) {
  if (motion.reduced) return;
  const c = board.center(id);
  for (let i = 0; i < n; i++) {
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', String(c.x - 4));
    r.setAttribute('y', String(c.y - 20));
    r.setAttribute('width', '8');
    r.setAttribute('height', '12');
    r.setAttribute('rx', '2');
    r.setAttribute('fill', colors[i % colors.length]);
    r.setAttribute('stroke', INK);
    r.setAttribute('stroke-width', '1.6');
    board.fxLayer.appendChild(r);
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const dist = 50 + Math.random() * 60;
    const dx = Math.cos(ang) * dist;
    const dy = Math.sin(ang) * dist;
    const a = anim(r, [
      { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx * 1.3}px, ${dy + 70}px) rotate(${Math.random() * 720}deg)`, opacity: 0 },
    ], { duration: 1100 + Math.random() * 300, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
    if (a) a.finished.finally(() => r.remove()); else r.remove();
  }
}

/** Troops arrive: badge pops, figures hop. */
export function placed(board: Board, id: number, n: number) {
  popBadge(board, id);
  floatText(board, id, `+${n}`, 'gain');
  const v = board.view(id);
  if (!v) return;
  anim(v.units, [{ transform: 'translateY(-26px)', opacity: 0.2 }, { transform: 'translateY(2px)', opacity: 1, offset: 0.7 }, { transform: 'translateY(0)' }], { duration: 420, easing: BOUNCE });
}

export async function march(board: Board, from: number, to: number, f: FactionId, n: number) {
  const a = board.center(from);
  const b = board.center(to);
  if (!motion.reduced) {
    const g = document.createElementNS(NS, 'g');
    g.innerHTML = use(`u-${f}`, 0, 12, 34, `style="color:${FACTIONS[f].color}"`);
    board.fxLayer.appendChild(g);
    const an = anim(g, [
      { transform: `translate(${a.x}px, ${a.y}px)` },
      { transform: `translate(${(a.x + b.x) / 2}px, ${(a.y + b.y) / 2 - 24}px)`, offset: 0.5 },
      { transform: `translate(${b.x}px, ${b.y}px)` },
    ], { duration: 460, easing: 'ease-in-out' });
    await done(an);
    g.remove();
  }
  popBadge(board, to);
  floatText(board, to, `+${n}`, 'gain');
}

/** Faction ability scenes. */
export async function abilityScene(board: Board, id: number, f: FactionId, screen: HTMLElement) {
  const c = board.center(id);
  const v = board.view(id);
  if (f === 'necro') {
    for (let i = 0; i < 10; i++) {
      const g = document.createElementNS(NS, 'g');
      g.innerHTML = `<path d="M-8 10 Q-10 -6 0 -14 Q10 -6 8 10 L4 6 L0 10 L-4 6 Z" fill="#8dff5a" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="-3" cy="-4" r="1.8" fill="${INK}"/><circle cx="3" cy="-4" r="1.8" fill="${INK}"/>`;
      board.fxLayer.appendChild(g);
      const x = c.x + (Math.random() - 0.5) * 80;
      const y = c.y + 20 + Math.random() * 10;
      const a = anim(g, [
        { transform: `translate(${x}px, ${y}px) scale(0.3)`, opacity: 0 },
        { transform: `translate(${x + (Math.random() - 0.5) * 20}px, ${y - 40}px) scale(1)`, opacity: 1, offset: 0.4 },
        { transform: `translate(${x + (Math.random() - 0.5) * 40}px, ${y - 110}px) scale(0.8)`, opacity: 0 },
      ], { duration: 1100, delay: i * 60, easing: OUT, fill: 'backwards' });
      if (a) a.finished.finally(() => g.remove()); else g.remove();
    }
    if (v) anim(v.top, [{ filter: 'brightness(1)' }, { filter: 'brightness(0.6) saturate(1.6)' }, { filter: 'brightness(1)' }], { duration: 900 });
    await wait(500);
  } else if (f === 'elves') {
    if (v) anim(v.deco, [{ transform: 'scale(0)', opacity: 0 }, { transform: 'scale(1.15)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)' }], { duration: 700, easing: BOUNCE });
    for (let i = 0; i < 14; i++) {
      const leaf = document.createElementNS(NS, 'path');
      leaf.setAttribute('d', 'M0 -8 Q8 -2 0 8 Q-8 -2 0 -8 Z');
      leaf.setAttribute('fill', i % 3 ? '#5fc25a' : '#ffe36b');
      leaf.setAttribute('stroke', INK);
      leaf.setAttribute('stroke-width', '2');
      board.fxLayer.appendChild(leaf);
      const ang = (i / 14) * Math.PI * 2;
      const a = anim(leaf, [
        { transform: `translate(${c.x}px, ${c.y}px) rotate(0deg) scale(0.4)`, opacity: 1 },
        { transform: `translate(${c.x + Math.cos(ang) * 70}px, ${c.y + Math.sin(ang) * 55 - 20}px) rotate(${200 + i * 30}deg) scale(1)`, opacity: 0 },
      ], { duration: 900, easing: OUT });
      if (a) a.finished.finally(() => leaf.remove()); else leaf.remove();
    }
    await wait(500);
  } else {
    const sh = v?.build.querySelector('use[href="#s-stronghold"]');
    if (sh) anim(sh, [{ transform: 'translateY(-140px)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1, offset: 0.55 }, { transform: 'translateY(-10px)', offset: 0.75 }, { transform: 'translateY(0)' }], { duration: 700, easing: 'cubic-bezier(.5,0,.75,0)' });
    await wait(380);
    shakeScreen(screen, 1.2);
    for (let i = 0; i < 9; i++) {
      const p = document.createElementNS(NS, 'circle');
      p.setAttribute('r', String(8 + Math.random() * 8));
      p.setAttribute('fill', '#e6dac6');
      p.setAttribute('stroke', INK);
      p.setAttribute('stroke-width', '2');
      board.fxLayer.appendChild(p);
      const dir = i < 4.5 ? -1 : 1;
      const a = anim(p, [
        { transform: `translate(${c.x + dir * 20}px, ${c.y + 40}px) scale(0.4)`, opacity: 1 },
        { transform: `translate(${c.x + dir * (50 + Math.random() * 30)}px, ${c.y + 30 - Math.random() * 30}px) scale(1.2)`, opacity: 0 },
      ], { duration: 700, easing: OUT });
      if (a) a.finished.finally(() => p.remove()); else p.remove();
    }
    await wait(300);
  }
}

export function pulseColor(owner: Owner | null) {
  return colorOf(owner);
}
