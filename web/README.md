# Juräa Frontiers — web game

Risk-style conquest on a Catan-like hex island. Death Cults, Evergarden and the
Giants fight for Juräa. Play against AI, pass-and-play on one device (hotseat),
or online with friends.

## Play without installing anything

Open `play/juraea-frontiers.html` (repo root) in a browser by double-clicking it.
`play/units.html` shows every unit sprite with its animations
(regenerate with `npx tsx scripts/build-preview.ts`). The rules are in `RULES.md`.
Everything is inside that one file. Online play needs the relay server; AI and
hotseat games work offline. Rebuild it after code changes with
`npm run build:single`.

## Run it locally

```bash
cd web
npm install
npm run dev
```

## Put it on your website

```bash
cd web
npm install
npm run build
```

Upload everything inside `web/dist/` to any folder on your web host (for example
`yoursite.com/juraea/`). It is plain HTML/JS/CSS with relative paths, so no
server code is needed for single-player and hotseat games.

## Online multiplayer (optional)

Online play needs the tiny relay in `server/` running on a host that can run
Node.js 18+ (a small VPS, Render, Railway, Fly.io, a Raspberry Pi…).

```bash
cd server
npm install
PORT=8787 npm start
```

Then either type its address into the game (Play online → Server), or bake it
into the build so players never see the field:

```bash
VITE_RELAY_URL=wss://relay.yoursite.com npm run build
```

If your website uses HTTPS, the relay must be reachable over `wss://` (put it
behind your web server's TLS, e.g. an nginx `location` with WebSocket upgrade).
Without a configured address the game tries `ws(s)://<your-site-host>:8787`.

How it works: the rules engine is deterministic (seeded dice live in the game
state), so the relay only orders and forwards actions inside a room. Every
browser applies the same action list and gets the same game. The room host's
browser plays the AI factions; if the host drops, another player takes over.

## Code map

| Path | What |
| --- | --- |
| `src/engine/` | Rules, map generator (port of `MapGenerator.java`), AI, seeded RNG. No DOM. |
| `src/render/` | SVG board (camera, picking), cartoon art, unit sprites (`units.ts`), animations. |
| `src/game/controller.ts` | Turn flow, input, HUD, event animations, saving. |
| `src/ui/` | Dice tray, icons. |
| `src/net/` | Online client. |
| `scripts/simulate.ts` | `npm test`: runs AI-vs-AI games and reports winners and game length. |

Faction names, units and terrain come from the Java prototype in `src/main`.
Balance knobs live in `src/engine/unitstats.ts` (unit stats, costs) and
`src/engine/rules.ts` (terrain, income, sieges).
