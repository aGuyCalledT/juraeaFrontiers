// Headless check: AI-only games must finish, deterministically.
import { aiNextAction } from '../src/engine/ai';
import { applyAction, createGame } from '../src/engine/rules';
import type { GameSetup } from '../src/engine/types';

const results: Record<string, number> = {};
let totalTurns = 0;
const N = Number(process.argv[2] ?? 60);
for (let g = 0; g < N; g++) {
  const setup: GameSetup = {
    seed: 1000 + g,
    size: (['small', 'medium', 'large'] as const)[g % 3],
    slots: [
      { faction: 'necro', kind: 'ai', name: 'A', controller: '' },
      { faction: 'elves', kind: 'ai', name: 'B', controller: '' },
      { faction: 'giants', kind: g % 5 === 4 ? 'off' : 'ai', name: 'C', controller: '' },
    ],
  };
  let { state } = createGame(setup);
  let steps = 0;
  while (state.phase !== 'over' && steps < 20000) {
    const a = aiNextAction(state);
    const r = applyAction(state, a);
    if (r.error) throw new Error(`game ${g} step ${steps}: ${r.error} ${JSON.stringify(a)} phase=${state.phase}`);
    state = r.state;
    steps++;
  }
  const w = (state.winner ?? "none") + (state.winner ? "@" + state.players.findIndex((p) => p.faction === state.winner) : "");
  results[w] = (results[w] ?? 0) + 1;
  totalTurns += state.turn;
  if (w === 'none') console.log('unfinished', g, setup.size, 'turn', state.turn);
}
console.log('wins', results, 'avg rounds', (totalTurns / N).toFixed(1));
