import { FACTIONS, NEUTRAL } from '../engine/factions';
import { HEX_SIZE, SQRT3, hexCorners, hexToPixel, key } from '../engine/hex';
import { neighbors } from '../engine/rules';
import type { GameState, Tile } from '../engine/types';
import { BADGE_PATH, INK, TERRAIN_COLORS, castleId, decorations, use } from './art';
import type { Army, FactionId } from '../engine/types';
import { UNIT_STATS } from '../engine/unitstats';

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
    this.sync(state, true);
    this.fit(false);
  }

  private buildSea(state: GameState) {
    const nb = neighbors(state);
    const shallow: string[] = [];
    const foam: string[] = [];
    const coast: string[] = [];
    for (const t of state.tiles) {
      const { x, y } = hexToPixel(t.q, t.r);
      if (t.terrain === 'water') {
        if (nb[t.id].some((n) => state.tiles[n].terrain !== 'water')) {
          shallow.push(`<polygon points="${pts(hexCorners(x, y + THICK, HEX_SIZE * 0.98))}"/>`);
        }
      } else {
        foam.push(`<polygon points="${pts(hexCorners(x, y + THICK, HEX_SIZE * 1.16))}"/>`);
        // Wave lap: trace each shore edge slightly out to sea.
        const c = hexCorners(x, y + THICK, HEX_SIZE * 1.3);
        for (const n of nb[t.id]) {
          const o = state.tiles[n];
          if (o.terrain !== 'water') continue;
          const op = hexToPixel(o.q, o.r);
          const e = [...c].sort((a, b) => Math.hypot(a[0] - op.x, a[1] - op.y) - Math.hypot(b[0] - op.x, b[1] - op.y));
          coast.push(`M${e[0][0].toFixed(1)} ${e[0][1].toFixed(1)}L${e[1][0].toFixed(1)} ${e[1][1].toFixed(1)}`);
        }
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
    this.layers.foam.innerHTML = `<path class="coast" d="${coast.join('')}"/><path class="coast coast-2" d="${coast.join('')}"/><g class="foam-a">${foam.join('')}</g>`;
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
    badge.setAttribute('class', 'stack');
    badge.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    badge.innerHTML = `<g class="badge-in"></g>`;
    this.layers.badges.appendChild(badge);
    const q = <T extends Element>(sel: string, root: Element = g) => root.querySelector(sel) as unknown as T;
    return {
      g, inner: q('.tile-in'), top: q('.top'), side: q('.side'), deco: q('.deco'), ring: q('.ring'),
      build: q('.build'), units: q('.units'), badge, badgeIn: q('.badge-in', badge), last: '', terrain: '',
    };
  }

  /** Updates tile visuals to match state. Returns ids whose visuals changed. */
  sync(state: GameState, force = false): number[] {
    this.state = state;
    const changed: number[] = [];
    const cur = state.phase === 'play' ? state.players[state.current].faction : null;
    for (const t of state.tiles) {
      const v = this.views[t.id];
      if (!v) continue;
      const armies = state.armies.filter((a) => a.tile === t.id);
      const city = state.cities.find((c) => c.tile === t.id);
      const build = state.builds.find((b) => b.tile === t.id);
      const sig = JSON.stringify([t.terrain, t.owner, t.enchanted, armies.map((a) => [a.id, a.owner, a.mp, a.attacked, a.units.map((u) => u.type + u.hp)]), city, build, cur]);
      if (!force && sig === v.last) continue;
      v.last = sig;
      changed.push(t.id);
      const hasBuilding = !!city || build?.kind === 'city';
      const decoKey = t.terrain + (hasBuilding ? '*' : '');
      if (v.terrain !== decoKey) {
        v.terrain = decoKey;
        v.top.setAttribute('fill', `url(#g-${t.terrain})`);
        v.side.setAttribute('fill', `url(#gs-${t.terrain})`);
        v.g.classList.remove('t-plains', 't-forest', 't-mountain', 't-desert');
        v.g.classList.add('t-' + t.terrain);
        v.deco.innerHTML = decorations(t, hasBuilding);
      }
      const owner = t.owner;
      const fac = owner && owner !== 'neutral' ? FACTIONS[owner] : null;
      v.ring.setAttribute('stroke', fac ? fac.color : 'none');
      v.g.classList.toggle('owned', !!fac);
      v.g.classList.toggle('enchanted', t.enchanted);
      // Buildings
      let b = '';
      if (t.enchanted) b += use('s-sparkle', -30, -24, 22) + use('s-sparkle', 32, -6, 16);
      if (city) {
        const cf = FACTIONS[city.owner];
        b += use(castleId(city.owner), 0, city.capital ? -2 : -6, city.capital ? 64 : 54, `style="color:${cf.color}"`);
        for (let i = 0; i < city.level; i++) b += use('s-star', -14 + i * 14 - (city.level - 1) * 0, -60, 16);
      } else if (build?.kind === 'city') {
        b += use('s-scaffold', 0, -4, 54, `style="color:${FACTIONS[build.owner].color}"`);
      }
      if (fac && !city && !build && !armies.length) b += use('s-flag', 34, -10, 30, `class="flag" style="color:${fac.color}"`);
      v.build.innerHTML = b;
      v.units.innerHTML = '';
      // Armies and markers (drawn above all tiles).
      let top = '';
      if (armies.length === 1) top += armyToken(armies[0], 0, 36, 1, armies[0].owner === cur);
      else if (armies.length === 2) top += armyToken(armies[0], -24, 30, 0.8, armies[0].owner === cur) + armyToken(armies[1], 24, 40, 0.8, armies[1].owner === cur);
      if (city) {
        const sieges = Object.entries(city.siege).filter(([, n]) => n);
        sieges.forEach(([f, n], i) => { top += siegeMarker(f as FactionId, n!, 3 + city.level, 0, -78 - i * 26); });
      }
      if (build) top += buildMarker(build.kind, build.turnsLeft, 26, -46);
      v.badgeIn.innerHTML = top;
      v.badge.classList.toggle('has-army', armies.length > 0);
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

const ownerColor = (o: Army['owner']) => (o === 'neutral' ? NEUTRAL.dark : FACTIONS[o].color);

/** A small stack of unit figures with a count badge and movement pips. */
export function armyToken(a: Army, x: number, y: number, k: number, active: boolean): string {
  const units = [...a.units].sort((p, q) => UNIT_STATS[q.type].tier - UNIT_STATS[p.type].tier);
  const shown: string[] = [];
  for (const u of units) { if (!shown.includes(u.type)) shown.push(u.type); if (shown.length === 3) break; }
  while (shown.length < Math.min(3, units.length)) shown.push(units[shown.length].type);
  const size = 68 * k;
  const spots = [[0, 0], [-19 * k, -8 * k], [19 * k, -8 * k]];
  const order = [2, 1, 0].filter((i) => i < shown.length);
  const figs = order.map((i) => use(`unit-${shown[i]}`, x + spots[i][0], y + spots[i][1] - 4 * k, size, i ? 'class="back"' : '')).join('');
  const wounded = a.units.some((u) => u.hp < UNIT_STATS[u.type].hp);
  const col = ownerColor(a.owner);
  const bx = x + 26 * k, by = y - 4 * k;
  const pips = active ? [0, 1, 2].map((i) => `<circle cx="${(x - 12 * k + i * 12 * k).toFixed(1)}" cy="${(y + 9 * k).toFixed(1)}" r="${(4 * k).toFixed(1)}" class="pip ${i < a.mp ? 'on' : ''}"/>`).join('') : '';
  return `<g class="army ${active && a.mp <= 0 ? 'spent' : ''} ${a.attacked ? 'attacked' : ''}" data-army="${a.id}">
    <ellipse cx="${x}" cy="${y + 2}" rx="${28 * k}" ry="${7 * k}" fill="#000" opacity=".18"/>
    ${figs}
    <g transform="translate(${bx.toFixed(1)} ${by.toFixed(1)}) scale(${(0.74 * k).toFixed(2)})"><path d="${BADGE_PATH}" fill="${col}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><text class="badge-text" y="7" text-anchor="middle">${a.units.length}</text>${wounded ? `<circle cx="17" cy="-14" r="6" fill="#ff5a4a" stroke="${INK}" stroke-width="2.5"/>` : ''}</g>
    ${pips}
  </g>`;
}

function siegeMarker(f: FactionId, n: number, need: number, x: number, y: number): string {
  const col = FACTIONS[f].color;
  return `<g class="siege" transform="translate(${x} ${y})"><rect x="-30" y="-12" width="60" height="24" rx="8" fill="${col}" stroke="${INK}" stroke-width="3"/>
    <path d="M-23 7 L-11 -6 M-11 7 L-23 -6" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M-23 7 L-11 -6 M-11 7 L-23 -6" stroke="#eef2f5" stroke-width="2.4" stroke-linecap="round"/>
    <text class="badge-text small" x="9" y="6" text-anchor="middle">${n}/${need}</text></g>`;
}

function buildMarker(kind: 'city' | 'upgrade', left: number, x: number, y: number): string {
  return `<g class="buildmark" transform="translate(${x} ${y})"><circle r="12" fill="#ffd23f" stroke="${INK}" stroke-width="3"/>
    <path d="M-5 5 L4 -4 M1 -7 L7 -1" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><text class="badge-text small" x="16" y="12">${left}</text><title>${kind === 'city' ? 'City' : 'Upgrade'} ready in ${left} turn${left > 1 ? 's' : ''}</title></g>`;
}
