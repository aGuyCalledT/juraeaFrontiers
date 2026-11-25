import type { Action, FactionId, GameSetup, SlotKind } from '../engine/types';

export interface LobbySlot {
  faction: FactionId;
  kind: SlotKind; // 'human' means a member claimed it
  controller: string; // member id for human slots
}

export interface RoomInfo {
  code: string;
  hostId: string;
  members: { id: string; name: string; online: boolean }[];
  slots: LobbySlot[];
  size: GameSetup['size'];
  started: boolean;
}

export type ServerMsg =
  | { t: 'welcome'; clientId: string }
  | { t: 'room'; room: RoomInfo }
  | { t: 'start'; setup: GameSetup }
  | { t: 'sync'; setup: GameSetup; log: Action[] }
  | { t: 'action'; seq: number; action: Action }
  | { t: 'error'; message: string };

export type ClientMsg =
  | { t: 'hello'; clientId?: string; name: string }
  | { t: 'create' }
  | { t: 'join'; code: string }
  | { t: 'lobby'; slots: LobbySlot[]; size: GameSetup['size'] }
  | { t: 'claim'; faction: FactionId | null }
  | { t: 'start'; setup: GameSetup }
  | { t: 'action'; action: Action }
  | { t: 'leave' };

export function defaultServerUrl(): string {
  const env = import.meta.env.VITE_RELAY_URL as string | undefined;
  if (env) return env;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const host = location.hostname || 'localhost';
  return `${proto}://${host}:8787`;
}

export class Online {
  ws: WebSocket | null = null;
  clientId = '';
  room: RoomInfo | null = null;
  private listeners = new Set<(m: ServerMsg) => void>();
  private retry = 0;
  private closedByUser = false;
  private outbox: ClientMsg[] = [];
  status: 'idle' | 'connecting' | 'online' | 'offline' = 'idle';
  onStatus: (s: Online['status']) => void = () => {};

  constructor(public url: string, public name: string) {
    try { this.clientId = sessionStorage.getItem('jf-client') ?? ''; } catch { /* storage unavailable */ }
  }

  on(fn: (m: ServerMsg) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  connect(): Promise<void> {
    this.closedByUser = false;
    return new Promise((resolve, reject) => {
      this.setStatus('connecting');
      let opened = false;
      let ws: WebSocket;
      try { ws = new WebSocket(this.url); } catch (e) { this.setStatus('offline'); reject(e); return; }
      this.ws = ws;
      ws.onopen = () => {
        opened = true;
        this.retry = 0;
        ws.send(JSON.stringify({ t: 'hello', clientId: this.clientId || undefined, name: this.name } satisfies ClientMsg));
      };
      ws.onmessage = (ev) => {
        let msg: ServerMsg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.t === 'welcome') {
          this.clientId = msg.clientId;
          try { sessionStorage.setItem('jf-client', msg.clientId); } catch { /* storage unavailable */ }
          this.setStatus('online');
          const queued = this.outbox.splice(0);
          if (this.room) queued.unshift({ t: 'join', code: this.room.code });
          for (const m of queued) ws.send(JSON.stringify(m));
          resolve();
        }
        if (msg.t === 'room') this.room = msg.room;
        for (const l of this.listeners) l(msg);
      };
      ws.onclose = () => {
        this.setStatus('offline');
        if (!opened) reject(new Error('Could not reach the server.'));
        if (!this.closedByUser && opened) {
          const delay = Math.min(8000, 500 * 2 ** this.retry++);
          setTimeout(() => this.connect().catch(() => undefined), delay);
        }
      };
    });
  }

  private setStatus(s: Online['status']) {
    this.status = s;
    this.onStatus(s);
  }

  send(m: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.status === 'online') this.ws.send(JSON.stringify(m));
    else this.outbox.push(m);
  }

  close() {
    this.closedByUser = true;
    try { this.send({ t: 'leave' }); } catch { /* already closed */ }
    this.ws?.close();
    this.room = null;
  }

  get isHost() {
    return !!this.room && this.room.hostId === this.clientId;
  }
}
