import { FACTIONS } from '../engine/factions';
import { ownCities, unitCount } from '../engine/rules';
import type { GameState } from '../engine/types';

/** Plain-text summary of a game, meant to be pasted into a playtest note. */
export function playtestReport(s: GameState, notes: string): string {
  const lines: string[] = [];
  const winner = s.winner ? FACTIONS[s.winner].short : 'none yet';
  lines.push(`Juräa Frontiers playtest report`);
  lines.push(`Date: ${new Date().toISOString().slice(0, 10)} · Map: ${s.setup.size} · Seed: ${s.setup.seed} · Round: ${s.turn} · Winner: ${winner}`);
  lines.push(`Players: ${s.setup.slots.map((x) => `${FACTIONS[x.faction].short} (${x.kind})`).join(', ')}`);
  lines.push('');
  const head = ['', ...s.players.map((p) => FACTIONS[p.faction].short)];
  const row = (label: string, get: (i: number) => string | number) => [label, ...s.players.map((_, i) => String(get(i)))];
  const st = (i: number) => s.players[i].stats;
  const rows = [
    head,
    row('Result', (i) => (s.players[i].alive ? (s.winner === s.players[i].faction ? 'won' : 'alive') : `fell r${st(i).fell}`)),
    row('Gold now', (i) => s.players[i].gold),
    row('Income total', (i) => st(i).income),
    row('Bounty + loot', (i) => st(i).loot),
    row('Upkeep paid', (i) => st(i).upkeep),
    row('Spent on units', (i) => st(i).spentUnits),
    row('Spent on building', (i) => st(i).spentBuild),
    row('Recruited', (i) => st(i).recruited),
    row('Dwarves hired', (i) => st(i).hired),
    row('Units slain', (i) => s.players[i].kills),
    row('Units lost', (i) => st(i).lost),
    row('Spells cast', (i) => st(i).spells),
    row('Forests changed', (i) => st(i).terraformed),
    row('Units (now / peak)', (i) => `${unitCount(s, s.players[i].faction)} / ${st(i).peakUnits}`),
    row('Cities (now / peak)', (i) => `${ownCities(s, s.players[i].faction).length} / ${st(i).peakCities}`),
    row('Peak hexes', (i) => st(i).peakTiles),
  ];
  const w = rows[0].map((_, c) => Math.max(...rows.map((r) => r[c].length)));
  for (const r of rows) lines.push(r.map((v, c) => (c === 0 ? v.padEnd(w[c]) : v.padStart(w[c]))).join('  '));
  lines.push('');
  lines.push('Notes:');
  lines.push(notes.trim() || '(none)');
  return lines.join('\n');
}

/** Copy to the clipboard, falling back to a download when that is blocked. */
export async function shareReport(text: string, seed: number): Promise<'copied' | 'saved'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `juraea-playtest-${seed}.txt` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'saved';
  }
}
