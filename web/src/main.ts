import '@fontsource/lilita-one/400.css';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import './styles.css';
import { sfx } from './audio';
import { FACTIONS, FACTION_ORDER } from './engine/factions';
import { applyAction, createGame } from './engine/rules';
import type { FactionId, GameSetup, GameState, SlotKind } from './engine/types';
import { GameController, crest } from './game/controller';
import { Online, defaultServerUrl, type LobbySlot, type RoomInfo, type ServerMsg } from './net/online';
import { SYMBOLS } from './render/art';
import { Board } from './render/board';
import * as fx from './render/fx';
import { ICONS } from './ui/icons';

const app = document.getElementById('app')!;
const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
sprite.setAttribute('class', 'sprite');
sprite.setAttribute('aria-hidden', 'true');
sprite.innerHTML = SYMBOLS;
document.body.prepend(sprite);

try { const sp = Number(localStorage.getItem('jf-speed')); if (sp) fx.motion.speed = sp; } catch { /* storage unavailable */ }

let game: GameController | null = null;
let titleBoard: Board | null = null;
let online: Online | null = null;
let drift = 0;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const randomSeed = () => (Math.random() * 2 ** 31) | 0;

function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem('jf-save');
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s.version === 1 && s.phase !== 'over' ? s : null;
  } catch { return null; }
}

function prefs(): { slots: Record<FactionId, SlotKind>; size: GameSetup['size']; name: string } {
  const d = { slots: { necro: 'human', elves: 'ai', giants: 'ai' } as Record<FactionId, SlotKind>, size: 'medium' as GameSetup['size'], name: 'Wanderer' };
  try { return { ...d, ...JSON.parse(localStorage.getItem('jf-prefs') ?? '{}') }; } catch { return d; }
}
function savePrefs(p: ReturnType<typeof prefs>) {
  try { localStorage.setItem('jf-prefs', JSON.stringify(p)); } catch { /* storage unavailable */ }
}

// ---------------- Title ----------------
function showTitle() {
  game?.destroy();
  game = null;
  online?.close();
  online = null;
  cancelAnimationFrame(drift);
  app.innerHTML = `
    <div class="title-screen">
      <div class="title-board"></div>
      <div class="sign">
        <div class="sign-ropes"></div>
        <div class="sign-board plank">
          <h1>Juräa <span>Frontiers</span></h1>
          <p>Three factions. One continent. Roll for it.</p>
        </div>
      </div>
      <nav class="title-menu plank">
        <div class="title-crests">${FACTION_ORDER.map((f) => crest(f, 'title-crest')).join('')}</div>
        <div class="title-buttons">
          ${loadSave() ? `<button class="btn go t-continue">Continue</button>` : ''}
          <button class="btn ${loadSave() ? '' : 'go'} t-play">New game</button>
          <button class="btn t-online">${ICONS.globe}Play online</button>
          <button class="btn ghost t-help">${ICONS.book}How to play</button>
        </div>
      </nav>
    </div>`;
  const host = app.querySelector('.title-board') as HTMLElement;
  const demo = createGame({ seed: randomSeed(), size: 'medium', slots: FACTION_ORDER.map((f) => ({ faction: f, kind: 'ai', name: '', controller: '' })) }).state;
  titleBoard = new Board(host, { onTileClick: () => {}, onTileHover: () => {} });
  titleBoard.insets = innerWidth < 760 ? { top: 150, bottom: 260, left: 0, right: 0 } : { top: 170, bottom: 190, left: 40, right: 40 };
  titleBoard.build(demo);
  fx.introDrop(titleBoard);
  const t0 = performance.now();
  const base = { ...titleBoard.camera };
  const reduced = fx.motion.reduced;
  const loop = (now: number) => {
    if (!titleBoard || reduced) return;
    const k = (now - t0) / 1000;
    titleBoard.camera = { x: base.x + Math.sin(k * 0.15) * 30, y: base.y + Math.cos(k * 0.12) * 16, z: base.z * (1 + Math.sin(k * 0.1) * 0.03) };
    titleBoard.applyCamera();
    drift = requestAnimationFrame(loop);
  };
  setTimeout(() => { if (titleBoard) { base.x = titleBoard.camera.x; base.y = titleBoard.camera.y; base.z = titleBoard.camera.z; drift = requestAnimationFrame(loop); } }, 1600);
  app.querySelector('.t-continue')?.addEventListener('click', () => { sfx.click(); const s = loadSave(); if (s) startGame(s, false); });
  app.querySelector('.t-play')!.addEventListener('click', () => { sfx.click(); showSetup(); });
  app.querySelector('.t-online')!.addEventListener('click', () => { sfx.click(); showOnline(); });
  app.querySelector('.t-help')!.addEventListener('click', () => { sfx.click(); showHelp(); });
}

// ---------------- Overlay panels ----------------
function panel(html: string, cls = ''): HTMLElement {
  closePanel();
  const wrap = document.createElement('div');
  wrap.className = 'overlay';
  wrap.innerHTML = `<div class="panel plank ${cls}"><button class="icon-btn panel-close" aria-label="Close">${ICONS.close}</button>${html}</div>`;
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  wrap.querySelector('.panel-close')!.addEventListener('click', () => { sfx.click(); closePanel(); });
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closePanel(); });
  return wrap.querySelector('.panel') as HTMLElement;
}
function closePanel() {
  document.querySelectorAll('.overlay').forEach((o) => { o.classList.remove('open'); setTimeout(() => o.remove(), 260); });
}

function factionCard(f: FactionId, controls: string) {
  const d = FACTIONS[f];
  return `<article class="fcard" data-f="${f}" style="--c:${d.color};--cd:${d.dark};--cl:${d.light}">
    <div class="fcard-top">${crest(f, 'fcard-crest')}<div><h3>${d.name}</h3><span class="fcard-people">${d.people} · ${d.resource} from ${d.resourceTerrain === 'mountain' ? 'mountains' : d.resourceTerrain === 'forest' ? 'forests' : 'deserts'}</span></div></div>
    <p class="fcard-quote">“${d.quote}”</p>
    <dl class="fcard-rules">
      <dt>${d.passive.name}</dt><dd>${d.passive.text}</dd>
      <dt>${d.ability.name} <em>${d.ability.cost} ${d.resource}</em></dt><dd>${d.ability.text}</dd>
    </dl>
    <div class="fcard-units">${d.units.infantry} · ${d.units.cavalry} · ${d.units.special}</div>
    <div class="fcard-ctl">${controls}</div>
  </article>`;
}

function seg(name: string, options: [string, string][], value: string) {
  return `<div class="seg" data-seg="${name}">${options.map(([v, l]) => `<button class="seg-btn ${v === value ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
}

function bindSeg(root: HTMLElement, onChange: (name: string, v: string) => void) {
  root.querySelectorAll<HTMLElement>('.seg').forEach((s) => s.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.seg-btn');
    if (!b || b.disabled) return;
    sfx.click();
    s.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('on', x === b));
    onChange(s.dataset.seg!, b.dataset.v!);
  }));
}

function showSetup() {
  const p = prefs();
  const sizes: [string, string][] = [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']];
  const kinds: [string, string][] = [['human', 'Player'], ['ai', 'AI'], ['off', 'Off']];
  const el = panel(`
    <h2>Choose your banners</h2>
    <p class="sub">Several players can share this device and take turns. At least two factions must take the field.</p>
    <div class="fcards">${FACTION_ORDER.map((f) => factionCard(f, seg('slot-' + f, kinds, p.slots[f]))).join('')}</div>
    <div class="setup-foot">
      <div class="setup-opt"><span class="seg-label">Map size</span>${seg('size', sizes, p.size)}</div>
      <p class="setup-err" role="alert"></p>
      <button class="btn go big s-start">Begin the conquest</button>
    </div>`, 'wide');
  const err = el.querySelector('.setup-err') as HTMLElement;
  const check = () => {
    const active = FACTION_ORDER.filter((f) => p.slots[f] !== 'off').length;
    const humans = FACTION_ORDER.filter((f) => p.slots[f] === 'human').length;
    err.textContent = active < 2 ? 'Field at least two factions.' : humans === 0 ? 'No players: the AIs will fight it out while you watch.' : '';
    (el.querySelector('.s-start') as HTMLButtonElement).disabled = active < 2;
    el.querySelectorAll<HTMLElement>('.fcard').forEach((c) => c.classList.toggle('off', p.slots[c.dataset.f as FactionId] === 'off'));
  };
  bindSeg(el, (name, v) => {
    if (name === 'size') p.size = v as GameSetup['size'];
    else p.slots[name.slice(5) as FactionId] = v as SlotKind;
    savePrefs(p);
    check();
  });
  check();
  el.querySelector('.s-start')!.addEventListener('click', () => {
    sfx.click();
    savePrefs(p);
    const setup: GameSetup = {
      seed: randomSeed(), size: p.size,
      slots: FACTION_ORDER.map((f) => ({ faction: f, kind: p.slots[f], name: FACTIONS[f].short, controller: '' })),
    };
    closePanel();
    startGame(createGame(setup).state, true);
  });
}

function showHelp() {
  panel(`
    <h2>How to play</h2>
    <div class="help">
      <section><h3>${ICONS.crown}Goal</h3><p>Capture every rival <b>capital</b> (the big castle). A faction that loses its capital is out, and its lands and gold go to the conqueror. Holding <b>75%</b> of the land also wins.</p></section>
      <section><h3>${ICONS.troops}1 · Reinforce</h3><p>You get troops each turn: one per 3 hexes (at least 3), +1 for your capital, plus the bonus of every region you fully hold. Tap your hexes to place them. Spend gold on extra troops or a <b>champion</b>, who adds +1 to the best die on that hex.</p></section>
      <section><h3>${ICONS.sword}2 · Attack</h3><p>Pick one of your hexes with 2+ troops, then an adjacent enemy or wild hex. You roll up to 3 dice, the defender up to 2 (3 in a capital or stronghold). Best dice are compared pairwise; ties go to the defender. Win the hex and you march in.</p></section>
      <section><h3>${ICONS.march}3 · Fortify</h3><p>Once per turn, move troops between two of your hexes that are connected through your land. Then end the turn.</p></section>
      <section><h3>${ICONS.dice}Terrain</h3><p><b>Plains</b> give gold. <b>Mountains</b> give defenders +1. <b>Forests</b> feed Evergarden’s Mana, <b>mountains</b> the Giants’ Ore and <b>deserts</b> the Death Cults’ Souls, which power each faction’s ability.</p></section>
      <section><h3>${ICONS.gear}Controls</h3><p>Drag to pan, scroll or pinch to zoom. Long-press a hex on touch screens for details. Keys: <kbd>Space</kbd> next phase, <kbd>1</kbd> <kbd>5</kbd> <kbd>A</kbd> placing amount, <kbd>B</kbd> blitz, <kbd>F</kbd> fit map, <kbd>Esc</kbd> cancel.</p></section>
    </div>`, 'wide');
}

// ---------------- Game ----------------
function startGame(state: GameState, intro: boolean, net?: Online, appliedSeq = 0) {
  closePanel();
  cancelAnimationFrame(drift);
  titleBoard = null;
  game?.destroy();
  app.innerHTML = '';
  game = new GameController({
    root: app, state, online: net, appliedSeq, intro,
    onExit: () => { try { if (!net) localStorage.setItem('jf-save', JSON.stringify(game!.state)); } catch { /* storage unavailable */ } showTitle(); },
    onRestart: () => {
      const setup = { ...state.setup, seed: randomSeed() };
      startGame(createGame(setup).state, true);
    },
    onHelp: () => showHelp(),
  });
}

// ---------------- Online ----------------
function showOnline() {
  const p = prefs();
  let url = defaultServerUrl();
  try { url = localStorage.getItem('jf-server') || url; } catch { /* storage unavailable */ }
  const el = panel(`
    <h2>Play online</h2>
    <p class="sub">One player creates a room and shares the code. Up to three people, empty seats can be AI.</p>
    <label class="field"><span>Your name</span><input class="o-name" maxlength="20" value="${esc(p.name)}" autocomplete="nickname"></label>
    <div class="online-actions">
      <button class="btn go o-create">Create room</button>
      <div class="join-row"><input class="o-code" maxlength="4" placeholder="CODE" aria-label="Room code" autocapitalize="characters"><button class="btn o-join">Join</button></div>
    </div>
    <details class="server"><summary>Server</summary><label class="field"><span>Relay address</span><input class="o-url" value="${esc(url)}"></label></details>
    <p class="setup-err" role="alert"></p>`, 'narrow');
  const err = el.querySelector('.setup-err') as HTMLElement;
  const go = async (code?: string) => {
    const name = (el.querySelector('.o-name') as HTMLInputElement).value.trim() || 'Wanderer';
    const u = (el.querySelector('.o-url') as HTMLInputElement).value.trim();
    p.name = name;
    savePrefs(p);
    try { localStorage.setItem('jf-server', u); } catch { /* storage unavailable */ }
    err.textContent = 'Connecting…';
    online?.close();
    online = new Online(u, name);
    try {
      await online.connect();
    } catch {
      err.textContent = 'Could not reach the relay server. Check the address under “Server”.';
      return;
    }
    err.textContent = '';
    const net = online;
    const off = net.on((m) => {
      if (m.t === 'error') err.textContent = m.message;
      if (m.t === 'room') { showLobby(net); off(); }
    });
    net.send(code ? { t: 'join', code: code.toUpperCase() } : { t: 'create' });
  };
  el.querySelector('.o-create')!.addEventListener('click', () => { sfx.click(); void go(); });
  el.querySelector('.o-join')!.addEventListener('click', () => {
    sfx.click();
    const code = (el.querySelector('.o-code') as HTMLInputElement).value.trim();
    if (code.length !== 4) { err.textContent = 'Room codes have four letters.'; return; }
    void go(code);
  });
}

function showLobby(net: Online) {
  const el = panel(`<div class="lobby"></div>`, 'wide');
  const box = el.querySelector('.lobby') as HTMLElement;
  el.querySelector('.panel-close')!.addEventListener('click', () => { net.close(); online = null; });
  const render = (room: RoomInfo) => {
    const host = net.isHost;
    const name = (id: string) => room.members.find((m) => m.id === id)?.name ?? '?';
    const kinds: [string, string][] = [['ai', 'AI'], ['off', 'Off']];
    const cards = room.slots.map((s: LobbySlot) => {
      let ctl = '';
      const mine = s.controller === net.clientId;
      if (s.kind === 'human') {
        ctl = `<div class="claimed">${mine ? 'You' : esc(name(s.controller))}</div>${mine ? '<button class="btn ghost small l-release">Leave seat</button>' : ''}`;
      } else {
        ctl = `<button class="btn small l-claim">Take this seat</button>${host ? seg('lk-' + s.faction, kinds, s.kind) : `<div class="claimed muted">${s.kind === 'ai' ? 'AI' : 'Empty'}</div>`}`;
      }
      return factionCard(s.faction, ctl);
    }).join('');
    const active = room.slots.filter((s) => s.kind !== 'off').length;
    box.innerHTML = `
      <h2>Room <span class="code">${room.code}</span></h2>
      <p class="sub">Share this code with friends. ${host ? 'You are the host: you start the match and run the AI.' : 'Waiting for the host to start.'}</p>
      <div class="members">${room.members.map((m) => `<span class="member ${m.online ? '' : 'away'}">${esc(m.name)}${m.id === room.hostId ? ' (host)' : ''}</span>`).join('')}</div>
      <div class="fcards">${cards}</div>
      <div class="setup-foot">
        ${host ? `<div class="setup-opt"><span class="seg-label">Map size</span>${seg('size', [['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']], room.size)}</div>
        <button class="btn go big l-start" ${active < 2 ? 'disabled' : ''}>Start match</button>` : ''}
      </div>`;
    const slots = room.slots.map((s) => ({ ...s }));
    const push = (size = room.size) => net.send({ t: 'lobby', slots, size });
    box.querySelectorAll<HTMLElement>('.fcard').forEach((card) => {
      const f = card.dataset.f as FactionId;
      const slot = slots.find((s) => s.faction === f)!;
      card.querySelector('.l-claim')?.addEventListener('click', () => { sfx.click(); net.send({ t: 'claim', faction: f }); });
      card.querySelector('.l-release')?.addEventListener('click', () => { sfx.click(); net.send({ t: 'claim', faction: null }); });
      card.classList.toggle('off', slot.kind === 'off');
    });
    bindSeg(box, (nm, v) => {
      if (nm === 'size') push(v as GameSetup['size']);
      else { const s = slots.find((x) => x.faction === nm.slice(3))!; s.kind = v as SlotKind; s.controller = ''; push(); }
    });
    box.querySelector('.l-start')?.addEventListener('click', () => {
      sfx.click();
      const setup: GameSetup = {
        seed: randomSeed(), size: room.size,
        slots: room.slots.map((s) => ({ faction: s.faction, kind: s.kind, controller: s.controller, name: s.kind === 'human' ? name(s.controller) : FACTIONS[s.faction].short })),
      };
      net.send({ t: 'start', setup });
    });
  };
  if (net.room) render(net.room);
  const off = net.on((m: ServerMsg) => {
    if (m.t === 'room' && !m.room.started) render(m.room);
    if (m.t === 'start') { off(); startGame(createGame(m.setup).state, true, net); }
    if (m.t === 'sync') {
      off();
      let st = createGame(m.setup).state;
      for (const a of m.log) st = applyAction(st, a).state;
      startGame(st, false, net, m.log.length);
    }
  });
}

showTitle();
