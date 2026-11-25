import { FACTIONS, NEUTRAL } from '../engine/factions';
import { HEX_SIZE, SQRT3, hexCorners, hexToPixel, key } from '../engine/hex';
import { neighbors } from '../engine/rules';
import type { GameState, Tile } from '../engine/types';
import { BADGE_PATH, INK, TERRAIN_COLORS, castleId, decorations, use } from './art';

const NS = 'http://www.w3.org/2000/svg';
const pts = (p: [number, number][]) => p.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const THICK = 11;

export interface BoardCallbacks {
  onTileClick(id: number): void;
  onTileHover(id: number | null, clientX: number, clientY: number): void;
  onTileLongPress?(id: number, clientX: number, clientY: number): void;
}

interface TileView {
  g: SVGGElement;
  inner: SVGGElement;
  top: SVGPolygonElement;
  side: SVGPolygonElement;
  deco: SVGGElement;
  ring: SVGPolygonElement;
  build: SVGGElement;
  units: SVGGElement;
  badge: SVGGElement;
  badgeIn: SVGGElement;
  badgeShape: SVGPathElement;
  badgeText: SVGTextElement;
  last: string;
  terrain: string;
}

export class Board {
  svg: SVGSVGElement;
  /** Animated sea lives in its own SVG so wave loops never repaint the tiles. */
  private seaSvg: SVGSVGElement;
  camera = { x: 0, y: 0, z: 1 };
  private views: TileView[] = [];
  private index = new Map<string, number>();
  private layers!: { sea: SVGGElement; foam: SVGGElement; tiles: SVGGElement; borders: SVGGElement; arrows: SVGGElement; badges: SVGGElement; fx: SVGGElement };
  private bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  private fitZ = 1;
  private hovered: number | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private drag: { x: number; y: number; cx: number; cy: number; moved: boolean; dist?: number; z?: number } | null = null;
  private camAnim = 0;
  private longPress = 0;
  insets = { top: 80, bottom: 100, left: 12, right: 12 };
  state!: GameState;

  constructor(private host: HTMLElement, private cb: BoardCallbacks) {
    this.seaSvg = document.createElementNS(NS, 'svg');
    this.seaSvg.classList.add('board-sea');
    this.seaSvg.setAttribute('aria-hidden', 'true');
    host.appendChild(this.seaSvg);
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.classList.add('board');
    this.svg.setAttribute('role', 'application');
    this.svg.setAttribute('aria-label', 'Hex map of Juräa');
    this.svg.innerHTML = `<defs>${this.gradients()}</defs>`;
    const mk = (cls: string, root: SVGSVGElement = this.svg) => {
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', cls);
      root.appendChild(g);
      return g;
    };
    this.layers = {
      sea: mk('l-sea', this.seaSvg), foam: mk('l-foam', this.seaSvg), tiles: mk('l-tiles'), borders: mk('l-borders'),
      arrows: mk('l-arrows'), badges: mk('l-badges'), fx: mk('l-fx'),
    };
    host.appendChild(this.svg);
    this.bindInput();
    this.layout();
    new ResizeObserver(() => { this.layout(); this.fit(false); }).observe(host);
  }

  get fxLayer() { return this.layers.fx; }
  get arrowLayer() { return this.layers.arrows; }

  private gradients(): string {
    return Object.entries(TERRAIN_COLORS)
      .map(([t, c]) => `<linearGradient id="g-${t}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${c.light}"/><stop offset="0.55" stop-color="${c.top}"/><stop offset="1" stop-color="${c.top}"/></linearGradient>
      <linearGradient id="gs-${t}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.side}"/><stop offset="1" stop-color="${c.deep}"/></linearGradient>`)
      .join('');
  }

  /** Builds every tile from scratch (new game). */
  build(state: GameState) {
    this.state = state;
    for (const l of Object.values(this.layers)) l.replaceChildren();
    this.views = [];
    this.index.clear();
    const land = state.tiles.filter((t) => t.terrain !== 'water');
    const xs = land.map((t) => hexToPixel(t.q, t.r));
    this.bounds = {
      minX: Math.min(...xs.map((p) => p.x)) - HEX_SIZE, maxX: Math.max(...xs.map((p) => p.x)) + HEX_SIZE,
      minY: Math.min(...xs.map((p) => p.y)) - HEX_SIZE - 30, maxY: Math.max(...xs.map((p) => p.y)) + HEX_SIZE + THICK,
    };
    state.tiles.forEach((t) => this.index.set(key(t.q, t.r), t.id));
    this.buildSea(state);

    const order = [...state.tiles].sort((a, b) => a.r - b.r || a.q - b.q);
    const views: TileView[] = new Array(state.tiles.length);
    for (const t of order) {
      if (t.terrain === 'water') continue;
      views[t.id] = this.makeTile(t);
    }
    this.views = views;
    this.drawBorders(state);
    this.sync(state, true);
    this.fit(false);
  }

  private buildSea(state: GameState) {
    const nb = neighbors(state);
    const shallow: string[] = [];
    const foam: string[] = [];
    for (const t of state.tiles) {
      const { x, y } = hexToPixel(t.q, t.r);
      if (t.terrain === 'water') {
        if (nb[t.id].some((n) => state.tiles[n].terrain !== 'water')) {
          shallow.push(`<polygon points="${pts(hexCorners(x, y + THICK, HEX_SIZE * 0.98))}"/>`);
        }
      } else {
        foam.push(`<polygon points="${pts(hexCorners(x, y + THICK, HEX_SIZE * 1.16))}"/>`);
      }
    }
    // Scattered animated waves around the island.
    const waves: string[] = [];
    const R = (state.radius + 3) * HEX_SIZE * 1.8;
    let seed = state.setup.seed;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let i = 0; i < 30; i++) {
      const x = (rnd() - 0.5) * R * 2;
      const y = (rnd() - 0.5) * R * 1.6;
      const id = this.index.get(this.pixelToKey(x, y));
      if (id !== undefined && state.tiles[id].terrain !== 'water') continue;
      const near = id !== undefined && nb[id].some((n) => state.tiles[n].terrain !== 'water');
      if (near) continue;
      waves.push(`<g class="wave" style="animation-delay:${(-rnd() * 6).toFixed(2)}s">${use('s-wave', x, y, 34 + rnd() * 20)}</g>`);
    }
    this.layers.sea.innerHTML = `<g class="shallows">${shallow.join('')}</g>${waves.join('')}`;
    this.layers.foam.innerHTML = `<g class="foam-a">${foam.join('')}</g>`;
  }

  private makeTile(t: Tile): TileView {
    const { x, y } = hexToPixel(t.q, t.r);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'tile');
    g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    g.dataset.id = String(t.id);
    g.innerHTML = `<g class="tile-in">
      <polygon class="side" points="${pts(hexCorners(0, THICK, HEX_SIZE))}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <polygon class="top" points="${pts(hexCorners(0, 0, HEX_SIZE))}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <polygon class="rim" points="${pts(hexCorners(0, 0, HEX_SIZE - 5))}"/>
      <polygon class="ring" points="${pts(hexCorners(0, 0, HEX_SIZE - 6))}"/>
      <g class="deco"></g><g class="build"></g><g class="units"></g>
      <polygon class="state" points="${pts(hexCorners(0, 0, HEX_SIZE - 3))}"/>
    </g>`;
    this.layers.tiles.appendChild(g);
    const badge = document.createElementNS(NS, 'g');
    badge.setAttribute('class', 'badge');
    badge.setAttribute('transform', `translate(${x.toFixed(1)} ${(y + 32).toFixed(1)}) scale(0.86)`);
    badge.innerHTML = `<g class="badge-in"><path class="badge-shape" d="${BADGE_PATH}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path class="badge-shine" d="M-16 -12 L16 -12 L16 -7 L-16 -7 Z"/><text class="badge-text" y="7" text-anchor="middle"></text></g>`;
    this.layers.badges.appendChild(badge);
    const q = <T extends Element>(sel: string, root: Element = g) => root.querySelector(sel) as unknown as T;
    return {
      g, inner: q('.tile-in'), top: q('.top'), side: q('.side'), deco: q('.deco'), ring: q('.ring'),
      build: q('.build'), units: q('.units'), badge, badgeIn: q('.badge-in', badge), badgeShape: q('.badge-shape', badge),
      badgeText: q('.badge-text', badge), last: '', terrain: '',
    };
  }

  private drawBorders(state: GameState) {
    const nb = neighbors(state);
    const segs: string[] = [];
    for (const t of state.tiles) {
      if (t.terrain === 'water') continue;
      const { x, y } = hexToPixel(t.q, t.r);
      const c = hexCorners(x, y, HEX_SIZE);
      for (const n of nb[t.id]) {
        const o = state.tiles[n];
        if (o.terrain === 'water' || o.region === t.region || o.id < t.id) continue;
        const op = hexToPixel(o.q, o.r);
        // the shared edge: the two corners closest to the neighbour centre
        const sorted = [...c].sort((a, b) => Math.hypot(a[0] - op.x, a[1] - op.y) - Math.hypot(b[0] - op.x, b[1] - op.y));
        segs.push(`M${sorted[0][0].toFixed(1)} ${sorted[0][1].toFixed(1)} L${sorted[1][0].toFixed(1)} ${sorted[1][1].toFixed(1)}`);
      }
    }
    this.layers.borders.innerHTML = `<path class="region-border" d="${segs.join(' ')}"/>`;
  }

  /** Updates tile visuals to match state. Returns ids whose visuals changed. */
  sync(state: GameState, force = false): number[] {
    this.state = state;
    const changed: number[] = [];
    for (const t of state.tiles) {
      const v = this.views[t.id];
      if (!v) continue;
      const sig = `${t.terrain}|${t.owner}|${t.troops}|${t.champion}|${t.stronghold}|${t.capital}`;
      if (!force && sig === v.last) continue;
      v.last = sig;
      changed.push(t.id);
      if (v.terrain !== t.terrain) {
        v.terrain = t.terrain;
        v.top.setAttribute('fill', `url(#g-${t.terrain})`);
        v.side.setAttribute('fill', `url(#gs-${t.terrain})`);
        v.g.classList.remove('t-plains', 't-forest', 't-mountain', 't-desert');
        v.g.classList.add('t-' + t.terrain);
        v.deco.innerHTML = decorations(t);
      }
      const owner = t.owner ?? 'neutral';
      const fac = owner === 'neutral' ? null : FACTIONS[owner];
      v.ring.setAttribute('stroke', fac ? fac.color : 'none');
      v.g.classList.toggle('owned', !!fac);
      // Buildings
      let build = '';
      if (t.capital) build += use(castleId(t.capital), 0, -2, 62, `style="color:${FACTIONS[t.capital].color}"`);
      if (t.stronghold) build += use('s-stronghold', 0, 22, 70);
      if (!fac && !t.capital) build += use('s-camp', 26, 18, 26);
      if (fac && !t.capital) build += use('s-flag', 34, -10, 30, `class="flag" style="color:${fac.color}"`);
      v.build.innerHTML = build;
      // Units: a few figures by army size, plus the champion.
      const n = t.troops >= 8 ? 3 : t.troops >= 4 ? 2 : 1;
      const fig = fac ? `u-${owner}` : 'u-neutral';
      const col = fac ? fac.color : NEUTRAL.color;
      const spots: [number, number][] = [[-30, 24], [-42, 12], [30, 24]];
      let units = '';
      for (let i = 0; i < n; i++) units += use(fig, spots[i][0], spots[i][1], i === 0 ? 30 : 26, `style="color:${col}"`);
      if (t.champion && fac) units += use(`c-${owner}`, 28, 26, 34, `class="champ" style="color:${fac.accent}"`);
      v.units.innerHTML = units;
      v.badgeShape.setAttribute('fill', fac ? fac.color : NEUTRAL.dark);
      v.badgeText.textContent = String(t.troops);
      v.badge.classList.toggle('neutral', !fac);
    }
    return changed;
  }

  view(id: number): TileView | undefined {
    return this.views[id];
  }

  center(id: number): { x: number; y: number } {
    const t = this.state.tiles[id];
    return hexToPixel(t.q, t.r);
  }

  /** Marks tiles with state classes for selection UI. */
  mark(marks: { selected?: number | null; targets?: Iterable<number>; selectable?: Iterable<number>; dimOthers?: boolean }) {
    const targets = new Set(marks.targets ?? []);
    const selectable = new Set(marks.selectable ?? []);
    for (const v of this.views) {
      if (!v) continue;
      const id = Number(v.g.dataset.id);
      v.g.classList.toggle('is-sel', marks.selected === id);
      v.g.classList.toggle('is-target', targets.has(id));
      v.g.classList.toggle('is-source', selectable.has(id) && marks.selected !== id);
      v.g.classList.toggle('is-dim', !!marks.dimOthers && marks.selected !== id && !targets.has(id) && !selectable.has(id));
    }
  }

  // ---------- Camera ----------
  // The SVGs are rendered with an overscan margin around the viewport. Pans
  // and zooms first move the already-rasterised layer with a GPU transform;
  // the viewBox (a full re-render) is only committed once the motion settles
  // or the layer would run out of overscan.
  private committed = { x: 0, y: 0, z: 0 };
  private commitTimer = 0;
  private margin = 0;

  private layout() {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    this.margin = Math.round(Math.max(w, h) * 0.3);
    for (const el of [this.svg, this.seaSvg]) {
      el.style.left = el.style.top = `${-this.margin}px`;
      el.style.width = `${w + 2 * this.margin}px`;
      el.style.height = `${h + 2 * this.margin}px`;
    }
    this.committed.z = 0;
  }

  applyCamera(commit = false) {
    const w = this.host.clientWidth || 1;
    const h = this.host.clientHeight || 1;
    const m = this.margin;
    const c = this.camera;
    const k = this.committed;
    const s = k.z ? c.z / k.z : 0;
    const tx = (k.x - c.x) * c.z;
    const ty = (k.y - c.y) * c.z;
    const far = !k.z || Math.abs(tx) > m * 0.8 || Math.abs(ty) > m * 0.8 || s < 0.8 || s > 1.25;
    clearTimeout(this.commitTimer);
    if (commit || far) {
      this.committed = { ...c };
      const vb = `${(c.x - (w / 2 + m) / c.z).toFixed(2)} ${(c.y - (h / 2 + m) / c.z).toFixed(2)} ${((w + 2 * m) / c.z).toFixed(2)} ${((h + 2 * m) / c.z).toFixed(2)}`;
      for (const el of [this.svg, this.seaSvg]) {
        el.setAttribute('viewBox', vb);
        el.style.transform = '';
      }
      return;
    }
    const t = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(4)})`;
    this.svg.style.transform = t;
    this.seaSvg.style.transform = t;
    this.commitTimer = window.setTimeout(() => this.applyCamera(true), 160);
  }

  fit(animate: boolean) {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    const { minX, maxX, minY, maxY } = this.bounds;
    const availW = w - this.insets.left - this.insets.right;
    const availH = h - this.insets.top - this.insets.bottom;
    this.fitZ = Math.min(availW / (maxX - minX), availH / (maxY - minY));
    // centre of the free area, expressed in board units
    const offX = (this.insets.left - this.insets.right) / 2 / this.fitZ;
    const offY = (this.insets.top - this.insets.bottom) / 2 / this.fitZ;
    const target = { x: (minX + maxX) / 2 - offX, y: (minY + maxY) / 2 - offY, z: this.fitZ };
    if (animate) this.animateCamera(target, 600);
    else { this.camera = target; this.applyCamera(true); }
  }

  get zoomLimits() {
    return { min: this.fitZ * 0.85, max: Math.max(this.fitZ * 3.2, 1.6) };
  }

  animateCamera(target: { x: number; y: number; z: number }, ms = 500) {
    cancelAnimationFrame(this.camAnim);
    if (ms <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.camera = { ...target };
      this.applyCamera(true);
      return;
    }
    const from = { ...this.camera };
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      this.camera = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, z: from.z + (target.z - from.z) * e };
      this.applyCamera(k >= 1);
      if (k < 1) this.camAnim = requestAnimationFrame(step);
    };
    this.camAnim = requestAnimationFrame(step);
  }

  /** Gently keeps a tile in view (used for AI and online moves). */
  focus(ids: number[]) {
    if (!ids.length) return;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const { z } = this.camera;
    const ps = ids.map((id) => this.center(id));
    const cx = ps.reduce((a, p) => a + p.x, 0) / ps.length;
    const cy = ps.reduce((a, p) => a + p.y, 0) / ps.length;
    const vx0 = this.camera.x - (w / 2 - this.insets.left - 60) / z;
    const vx1 = this.camera.x + (w / 2 - this.insets.right - 60) / z;
    const vy0 = this.camera.y - (h / 2 - this.insets.top - 60) / z;
    const vy1 = this.camera.y + (h / 2 - this.insets.bottom - 60) / z;
    if (cx > vx0 && cx < vx1 && cy > vy0 && cy < vy1) return;
    this.animateCamera({ x: cx, y: cy + (this.insets.bottom - this.insets.top) / 2 / z, z }, 450);
  }

  zoomBy(factor: number, sx?: number, sy?: number) {
    const rect = this.host.getBoundingClientRect();
    const px = sx ?? rect.left + rect.width / 2;
    const py = sy ?? rect.top + rect.height / 2;
    const before = this.screenToBoard(px, py);
    const { min, max } = this.zoomLimits;
    this.camera.z = Math.max(min, Math.min(max, this.camera.z * factor));
    this.applyCamera();
    const after = this.screenToBoard(px, py);
    this.camera.x += before.x - after.x;
    this.camera.y += before.y - after.y;
    this.applyCamera();
  }

  screenToBoard(sx: number, sy: number) {
    const rect = this.host.getBoundingClientRect();
    const { x, y, z } = this.camera;
    return { x: x + (sx - rect.left - rect.width / 2) / z, y: y + (sy - rect.top - rect.height / 2) / z };
  }

  boardToScreen(bx: number, by: number) {
    const rect = this.host.getBoundingClientRect();
    const { x, y, z } = this.camera;
    return { x: rect.left + rect.width / 2 + (bx - x) * z, y: rect.top + rect.height / 2 + (by - y) * z };
  }

  private pixelToKey(px: number, py: number): string {
    const q = ((SQRT3 / 3) * px - (1 / 3) * py) / HEX_SIZE;
    const r = ((2 / 3) * py) / HEX_SIZE;
    let rx = Math.round(q), rz = Math.round(r), ry = Math.round(-q - r);
    const dx = Math.abs(rx - q), dz = Math.abs(rz - r), dy = Math.abs(ry + q + r);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dz > dy) rz = -rx - ry;
    else ry = -rx - rz;
    void ry;
    return key(rx, rz);
  }

  tileAt(sx: number, sy: number): number | null {
    const p = this.screenToBoard(sx, sy);
    const id = this.index.get(this.pixelToKey(p.x, p.y));
    if (id === undefined || !this.state || this.state.tiles[id].terrain === 'water') return null;
    return id;
  }

  private setHover(id: number | null, x: number, y: number) {
    if (id !== this.hovered) {
      if (this.hovered !== null) this.views[this.hovered]?.g.classList.remove('is-hover');
      if (id !== null) this.views[id]?.g.classList.add('is-hover');
      this.hovered = id;
    }
    this.cb.onTileHover(id, x, y);
  }

  private bindInput() {
    const svg = this.svg;
    svg.addEventListener('pointerdown', (e) => {
      svg.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      cancelAnimationFrame(this.camAnim);
      if (this.pointers.size === 1) {
        this.drag = { x: e.clientX, y: e.clientY, cx: this.camera.x, cy: this.camera.y, moved: false };
        if (e.pointerType === 'touch') {
          clearTimeout(this.longPress);
          this.longPress = window.setTimeout(() => {
            if (this.drag && !this.drag.moved) {
              const id = this.tileAt(e.clientX, e.clientY);
              if (id !== null) { this.drag.moved = true; this.cb.onTileLongPress?.(id, e.clientX, e.clientY); }
            }
          }, 480);
        }
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.drag = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, cx: this.camera.x, cy: this.camera.y, moved: true, dist: Math.hypot(a.x - b.x, a.y - b.y), z: this.camera.z };
      }
    });
    svg.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) {
        if (e.pointerType === 'mouse') this.setHover(this.tileAt(e.clientX, e.clientY), e.clientX, e.clientY);
        return;
      }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const d = this.drag;
      if (!d) return;
      if (this.pointers.size >= 2 && d.dist) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const { min, max } = this.zoomLimits;
        const before = this.screenToBoard(mx, my);
        this.camera.z = Math.max(min, Math.min(max, d.z! * (dist / d.dist)));
        this.applyCamera();
        const after = this.screenToBoard(mx, my);
        this.camera.x += before.x - after.x;
        this.camera.y += before.y - after.y;
        this.applyCamera();
        return;
      }
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) > 7) { d.moved = true; svg.classList.add('dragging'); }
      if (d.moved) {
        this.camera.x = d.cx - dx / this.camera.z;
        this.camera.y = d.cy - dy / this.camera.z;
        this.clampCamera();
        this.applyCamera();
      }
    });
    const end = (e: PointerEvent) => {
      clearTimeout(this.longPress);
      const had = this.pointers.delete(e.pointerId);
      if (!had) return;
      const d = this.drag;
      if (this.pointers.size === 0) {
        svg.classList.remove('dragging');
        if (d && !d.moved && e.type === 'pointerup') {
          const id = this.tileAt(e.clientX, e.clientY);
          if (id !== null) this.cb.onTileClick(id);
          else this.cb.onTileClick(-1);
        }
        this.drag = null;
      } else if (this.pointers.size === 1) {
        const [p] = [...this.pointers.values()];
        this.drag = { x: p.x, y: p.y, cx: this.camera.x, cy: this.camera.y, moved: true };
      }
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.setHover(null, 0, 0); });
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY);
    }, { passive: false });
  }

  private clampCamera() {
    const { minX, maxX, minY, maxY } = this.bounds;
    this.camera.x = Math.max(minX - 100, Math.min(maxX + 100, this.camera.x));
    this.camera.y = Math.max(minY - 100, Math.min(maxY + 100, this.camera.y));
  }
}
