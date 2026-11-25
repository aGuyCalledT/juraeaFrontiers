// Juräa Frontiers relay server.
// The game engine is deterministic, so the server only orders and relays
// actions inside a room. Every client applies the same action log and gets
// the same game. Run: `npm install && npm start` (PORT env, default 8787).
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT ?? 8787);
const ROOM_TTL_MS = 1000 * 60 * 60 * 6;
const MAX_MSG = 16 * 1024;
const rooms = new Map();

const http = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end(`Juräa Frontiers relay: ${rooms.size} room(s)\n`);
});
const wss = new WebSocketServer({ server: http, maxPayload: MAX_MSG });

const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
const newId = () => randomBytes(8).toString('hex');
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => A[Math.floor(Math.random() * A.length)]).join(''); } while (rooms.has(c));
  return c;
}
const clean = (s, n = 24) => String(s ?? '').replace(/[<>&"'`]/g, '').trim().slice(0, n) || 'Player';

function summary(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    members: [...room.members.values()].map((m) => ({ id: m.id, name: m.name, online: !!m.ws })),
    slots: room.slots,
    size: room.size,
    started: !!room.setup,
  };
}
function broadcast(room, msg) { for (const m of room.members.values()) send(m.ws, msg); }
function pushRoom(room) { broadcast(room, { t: 'room', room: summary(room) }); }

function ensureHost(room) {
  const host = room.members.get(room.hostId);
  if (host && host.ws) return;
  const next = [...room.members.values()].find((m) => m.ws);
  if (next) room.hostId = next.id;
}

const FACTIONS = ['necro', 'elves', 'giants'];

wss.on('connection', (ws) => {
  let me = null; // { id, name }
  let room = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;

    if (msg.t === 'hello') {
      me = { id: typeof msg.clientId === 'string' && /^[a-f0-9]{16}$/.test(msg.clientId) ? msg.clientId : newId(), name: clean(msg.name) };
      send(ws, { t: 'welcome', clientId: me.id });
      return;
    }
    if (!me) return;

    if (msg.t === 'create') {
      const code = newCode();
      room = {
        code, hostId: me.id, members: new Map(), setup: null, log: [], size: 'medium', touched: Date.now(),
        slots: FACTIONS.map((f, i) => ({ faction: f, kind: i === 0 ? 'human' : 'ai', controller: i === 0 ? me.id : '' })),
      };
      rooms.set(code, room);
      room.members.set(me.id, { ...me, ws });
      pushRoom(room);
      return;
    }

    if (msg.t === 'join') {
      const r = rooms.get(String(msg.code ?? '').toUpperCase());
      if (!r) { send(ws, { t: 'error', message: 'No room with that code.' }); return; }
      const existing = r.members.get(me.id);
      if (r.setup && !existing) { send(ws, { t: 'error', message: 'That match has already started.' }); return; }
      if (!existing && r.members.size >= 3) { send(ws, { t: 'error', message: 'That room is full.' }); return; }
      room = r;
      room.members.set(me.id, { ...me, ws });
      room.touched = Date.now();
      ensureHost(room);
      pushRoom(room);
      if (room.setup) send(ws, { t: 'sync', setup: room.setup, log: room.log });
      return;
    }

    if (!room) return;
    room.touched = Date.now();

    if (msg.t === 'lobby' && room.hostId === me.id && !room.setup) {
      if (!Array.isArray(msg.slots) || msg.slots.length !== 3) return;
      room.slots = msg.slots.map((s, i) => ({
        faction: FACTIONS[i],
        kind: ['human', 'ai', 'off'].includes(s.kind) ? s.kind : 'ai',
        controller: s.kind === 'human' && room.members.has(s.controller) ? s.controller : '',
      }));
      if (['small', 'medium', 'large'].includes(msg.size)) room.size = msg.size;
      pushRoom(room);
      return;
    }

    if (msg.t === 'claim' && !room.setup) {
      // Any member may take a free seat or give theirs back.
      for (const s of room.slots) if (s.controller === me.id) { s.kind = 'ai'; s.controller = ''; }
      const seat = room.slots.find((s) => s.faction === msg.faction);
      if (seat && !(seat.kind === 'human' && seat.controller && seat.controller !== me.id)) {
        seat.kind = 'human';
        seat.controller = me.id;
      }
      pushRoom(room);
      return;
    }

    if (msg.t === 'start' && room.hostId === me.id && !room.setup) {
      const s = msg.setup;
      if (!s || typeof s.seed !== 'number' || !Array.isArray(s.slots)) return;
      room.setup = s;
      room.log = [];
      broadcast(room, { t: 'start', setup: s });
      pushRoom(room);
      return;
    }

    if (msg.t === 'action' && room.setup) {
      const a = msg.action;
      if (!a || typeof a.type !== 'string' || typeof a.p !== 'string') return;
      // Only the player who controls a faction may act for it; the host runs AI factions.
      const slot = room.setup.slots.find((s) => s.faction === a.p);
      if (!slot) return;
      const allowed = slot.kind === 'ai' ? room.hostId === me.id : slot.controller === me.id;
      if (!allowed) return;
      room.log.push(a);
      broadcast(room, { t: 'action', seq: room.log.length, action: a });
      return;
    }

    if (msg.t === 'leave') {
      room.members.delete(me.id);
      if (!room.setup) for (const s of room.slots) if (s.controller === me.id) { s.kind = 'ai'; s.controller = ''; }
      if (room.members.size === 0) rooms.delete(room.code);
      else { ensureHost(room); pushRoom(room); }
      room = null;
    }
  });

  ws.on('close', () => {
    if (!room || !me) return;
    const m = room.members.get(me.id);
    if (m && m.ws === ws) m.ws = null;
    ensureHost(room);
    pushRoom(room);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, r] of rooms) {
    const anyone = [...r.members.values()].some((m) => m.ws);
    if (!anyone && now - r.touched > ROOM_TTL_MS / 6) rooms.delete(code);
    else if (now - r.touched > ROOM_TTL_MS) rooms.delete(code);
  }
}, 60_000);

http.listen(PORT, () => console.log(`Juräa Frontiers relay listening on :${PORT}`));
