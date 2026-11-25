// Hand-authored cartoon SVG art. Every symbol uses a 0..100 box with its
// "feet" at (50, 95). Faction-coloured parts use currentColor, so one symbol
// serves all factions: set `color` on the <use>.
import type { FactionId, Terrain, Tile } from '../engine/types';

export const INK = '#2b1d14';
const S = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
const S4 = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;

export const TERRAIN_COLORS: Record<Terrain, { top: string; light: string; side: string; deep: string }> = {
  plains: { top: '#9ccf45', light: '#c4e86a', side: '#5f8f25', deep: '#466d1a' },
  forest: { top: '#4f9a3a', light: '#74bd4c', side: '#2e6424', deep: '#214b1a' },
  mountain: { top: '#a7a096', light: '#c9c3b8', side: '#6c665e', deep: '#504b45' },
  peak: { top: '#8f8a93', light: '#e9edf3', side: '#5d5862', deep: '#433f47' },
  desert: { top: '#f0cb6b', light: '#ffe49a', side: '#b98a33', deep: '#8f6a25' },
  water: { top: '#3fb0d4', light: '#7fd3ea', side: '#1f7fa8', deep: '#16618a' },
};

export const SYMBOLS = `
<symbol id="s-tree" viewBox="0 0 100 100">
  <path d="M45 66 L44 94 L56 94 L55 66 Z" fill="#7a4a26" ${S}/>
  <path d="M50 10 C67 10 77 23 75 35 C88 40 90 58 78 66 C74 77 59 79 50 74 C41 79 26 77 22 66 C10 58 12 40 25 35 C23 23 33 10 50 10 Z" fill="#3f9a3a" ${S}/>
  <path d="M78 66 C74 77 59 79 50 74 C41 79 26 77 22 66 C34 70 62 72 78 60 Z" fill="#2c7430"/>
  <ellipse cx="40" cy="30" rx="12" ry="7" fill="#7fcb55"/>
  <circle cx="62" cy="46" r="4" fill="#7fcb55"/>
</symbol>
<symbol id="s-pine" viewBox="0 0 100 100">
  <path d="M45 82 L45 96 L55 96 L55 82 Z" fill="#6b3f1f" ${S}/>
  <path d="M50 6 L70 38 L61 38 L79 62 L66 62 L84 86 L16 86 L34 62 L21 62 L39 38 L30 38 Z" fill="#2f8040" ${S}/>
  <path d="M50 10 L68 38 L59 38 L77 62 L64 62 L81 84 L50 84 Z" fill="#1f5f30" opacity="0.55"/>
  <path d="M40 40 L46 30 M34 64 L41 54" stroke="#5fb85f" stroke-width="4" stroke-linecap="round"/>
</symbol>
<symbol id="s-mountain" viewBox="0 0 100 100">
  <path d="M3 95 L39 24 Q48 9 57 24 L97 95 Z" fill="#938c84" ${S}/>
  <path d="M50 14 Q54 17 57 24 L97 95 L56 95 L60 64 L50 50 Z" fill="#6f6962"/>
  <path d="M30 43 L39 24 Q48 9 57 24 L67 43 L59 38 L53 47 L46 38 L38 47 Z" fill="#fbfcff" ${S4}/>
  <path d="M20 80 L30 70 M70 72 L78 82" stroke="#5a554e" stroke-width="4" stroke-linecap="round"/>
</symbol>
<symbol id="s-hill" viewBox="0 0 100 100">
  <path d="M8 95 Q22 52 50 50 Q80 50 92 95 Z" fill="#8c867d" ${S}/>
  <path d="M50 50 Q80 50 92 95 L58 95 Q66 70 50 50Z" fill="#6f6962"/>
  <path d="M30 70 Q38 62 46 64" stroke="#b8b2a8" stroke-width="5" fill="none" stroke-linecap="round"/>
</symbol>
<symbol id="s-cactus" viewBox="0 0 100 100">
  <path d="M43 94 L43 34 Q43 24 50 24 Q57 24 57 34 L57 94 Z" fill="#5fae4a" ${S}/>
  <path d="M43 64 L35 64 Q29 64 29 58 L29 46 Q29 41 34 41 Q38 41 38 46 L38 55 L43 55" fill="#5fae4a" ${S}/>
  <path d="M57 56 L65 56 Q71 56 71 50 L71 40 Q71 35 66 35 Q62 35 62 40 L62 47 L57 47" fill="#5fae4a" ${S}/>
  <path d="M50 34 L50 88" stroke="#3f8a35" stroke-width="3"/>
</symbol>
<symbol id="s-dune" viewBox="0 0 100 100">
  <path d="M2 95 Q28 60 54 78 Q76 62 98 95 Z" fill="#e2b04e" ${S4}/>
  <path d="M20 84 Q34 74 46 82" stroke="#fbe1a0" stroke-width="4" fill="none" stroke-linecap="round"/>
</symbol>
<symbol id="s-bones" viewBox="0 0 100 100">
  <path d="M22 86 L78 66 M24 66 L76 88" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
  <path d="M22 86 L78 66 M24 66 L76 88" stroke="#f5f0df" stroke-width="8" stroke-linecap="round"/>
  <path d="M34 60 Q34 36 50 36 Q66 36 66 60 L60 68 L40 68 Z" fill="#f5f0df" ${S4}/>
  <circle cx="44" cy="54" r="4.5" fill="${INK}"/><circle cx="56" cy="54" r="4.5" fill="${INK}"/>
</symbol>
<symbol id="s-wheat" viewBox="0 0 100 100">
  <path d="M8 94 L24 56 L92 56 L78 94 Z" fill="#f2c64a" ${S4}/>
  <path d="M28 62 L18 90 M44 62 L36 90 M60 62 L54 90 M76 62 L72 90" stroke="#d39a24" stroke-width="4" stroke-linecap="round"/>
  <path d="M60 58 L60 30 M70 58 L72 34" stroke="${INK}" stroke-width="3"/>
  <ellipse cx="60" cy="28" rx="5" ry="9" fill="#ffd95e" ${S4}/>
  <ellipse cx="72" cy="32" rx="5" ry="9" fill="#ffd95e" ${S4}/>
</symbol>
<symbol id="s-tuft" viewBox="0 0 100 100">
  <path d="M24 94 Q28 66 38 90 Q44 50 52 90 Q60 62 70 94" stroke="#4e8a22" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</symbol>
<symbol id="s-sheep" viewBox="0 0 100 100">
  <path d="M34 80 L34 94 M48 82 L48 94 M62 82 L62 94 M72 78 L72 92" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
  <path d="M28 70 C16 66 18 50 30 50 C30 38 46 36 52 44 C60 36 76 40 74 52 C86 54 86 72 74 74 C70 86 54 86 50 80 C42 88 26 84 28 70 Z" fill="#fffdf5" ${S}/>
  <ellipse cx="78" cy="54" rx="10" ry="12" fill="#3a2a22" ${S4}/>
  <circle cx="81" cy="52" r="2.6" fill="#fff"/>
</symbol>
<symbol id="s-flowers" viewBox="0 0 100 100">
  <circle cx="30" cy="84" r="7" fill="#ff7aa8" ${S4}/><circle cx="54" cy="90" r="6" fill="#fff" ${S4}/><circle cx="72" cy="80" r="7" fill="#ffd23f" ${S4}/>
</symbol>
<symbol id="s-wave" viewBox="0 0 100 100">
  <path d="M10 60 Q22 48 34 60 Q46 72 58 60 Q70 48 82 60" stroke="#c8f1ff" stroke-width="7" fill="none" stroke-linecap="round"/>
</symbol>

<symbol id="s-flag" viewBox="0 0 100 100">
  <path d="M30 96 L30 10" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
  <path d="M30 96 L30 10" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/>
  <path d="M32 14 Q52 6 66 16 Q78 24 90 18 L84 36 L90 54 Q76 60 64 52 Q50 44 32 50 Z" fill="currentColor" ${S}/>
  <path d="M34 40 Q50 34 64 42 Q76 50 88 46 L90 54 Q76 60 64 52 Q50 44 34 50 Z" fill="#000" opacity="0.2"/>
  <circle cx="30" cy="9" r="6" fill="#ffd23f" ${S4}/>
</symbol>

<symbol id="s-castle-necro" viewBox="0 0 100 100">
  <path d="M18 95 L18 58 L82 58 L82 95 Z" fill="#5c5466" ${S}/>
  <path d="M14 60 L14 50 L24 50 L24 56 L32 56 L32 50 L42 50 L42 60 Z M58 60 L58 50 L68 50 L68 56 L76 56 L76 50 L86 50 L86 60 Z" fill="#6d6478" ${S4}/>
  <path d="M36 95 L36 30 L64 30 L64 95 Z" fill="#4a4253" ${S}/>
  <path d="M30 32 L50 2 L70 32 Z" fill="currentColor" ${S}/>
  <path d="M50 2 L70 32 L50 32 Z" fill="#000" opacity="0.25"/>
  <path d="M44 95 L44 80 Q50 72 56 80 L56 95 Z" fill="#1d1622" ${S4}/>
  <rect x="45" y="44" width="10" height="14" rx="5" fill="#8dff5a" stroke="${INK}" stroke-width="3"/>
  <rect x="24" y="68" width="8" height="10" rx="4" fill="#8dff5a" stroke="${INK}" stroke-width="3"/>
  <rect x="68" y="68" width="8" height="10" rx="4" fill="#8dff5a" stroke="${INK}" stroke-width="3"/>
  <circle cx="50" cy="22" r="3" fill="#8dff5a"/>
</symbol>
<symbol id="s-castle-elves" viewBox="0 0 100 100">
  <path d="M22 95 Q20 70 32 62 L68 62 Q80 70 78 95 Z" fill="#f3ead2" ${S}/>
  <path d="M38 95 L40 30 L60 30 L62 95 Z" fill="#fff6e0" ${S}/>
  <path d="M26 34 Q50 -6 74 34 Q62 42 50 36 Q38 42 26 34 Z" fill="#5fc25a" ${S}/>
  <path d="M30 66 Q14 58 18 44 Q30 48 32 62 Z M70 66 Q86 58 82 44 Q70 48 68 62 Z" fill="#5fc25a" ${S4}/>
  <path d="M50 36 Q50 22 50 10" stroke="#3f8f3a" stroke-width="4"/>
  <circle cx="50" cy="14" r="5" fill="currentColor" ${S4}/>
  <path d="M45 95 L45 82 Q50 74 55 82 L55 95 Z" fill="#7a4a26" ${S4}/>
  <path d="M46 52 Q50 44 54 52 L54 60 L46 60 Z" fill="currentColor" ${S4}/>
  <path d="M30 80 Q40 74 38 88 M70 80 Q60 74 62 88" stroke="#3f8f3a" stroke-width="4" fill="none" stroke-linecap="round"/>
</symbol>
<symbol id="s-castle-giants" viewBox="0 0 100 100">
  <path d="M10 95 L14 52 L86 52 L90 95 Z" fill="#9b8f80" ${S}/>
  <path d="M28 66 Q36 60 44 66 M56 78 Q64 72 72 78 M20 84 Q26 80 32 84" stroke="#6f655a" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M6 54 L50 20 L94 54 Z" fill="currentColor" ${S}/>
  <path d="M50 20 L94 54 L50 54 Z" fill="#000" opacity="0.22"/>
  <path d="M30 34 Q18 24 22 8 Q30 22 38 28 Z M70 34 Q82 24 78 8 Q70 22 62 28 Z" fill="#f6efe0" ${S4}/>
  <path d="M38 95 L38 74 Q50 62 62 74 L62 95 Z" fill="#4a2c18" ${S4}/>
  <path d="M50 64 L50 95" stroke="${INK}" stroke-width="3"/>
  <circle cx="50" cy="42" r="6" fill="#ffb02e" ${S4}/>
</symbol>
<symbol id="s-stronghold" viewBox="0 0 100 100">
  <path d="M4 95 L4 62 L14 62 L14 68 L24 68 L24 62 L34 62 L34 68 L44 68 L44 62 L56 62 L56 68 L66 68 L66 62 L76 62 L76 68 L86 68 L86 62 L96 62 L96 95 Z" fill="#b3a998" ${S}/>
  <path d="M4 82 L96 82 M28 68 L28 82 M52 82 L52 95 M74 68 L74 82" stroke="#7d7466" stroke-width="3"/>
  <path d="M40 95 L40 84 Q50 76 60 84 L60 95 Z" fill="#4a2c18" ${S4}/>
</symbol>
<symbol id="s-camp" viewBox="0 0 100 100">
  <path d="M8 92 L40 34 L72 92 Z" fill="#c98f52" ${S}/>
  <path d="M40 34 L72 92 L48 92 Z" fill="#a46c36"/>
  <path d="M32 92 L40 66 L48 92 Z" fill="#4a2c18" ${S4}/>
  <path d="M40 34 L34 22 M40 34 L46 22" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <path d="M70 92 L92 92" stroke="#6b3f1f" stroke-width="7" stroke-linecap="round"/>
  <path d="M74 88 Q72 76 81 68 Q82 78 88 80 Q90 86 86 90 Z" fill="#ff9b2e" ${S4}/>
  <path d="M80 88 Q79 82 82 78 Q84 83 85 86 Z" fill="#ffe36b"/>
</symbol>

<symbol id="u-necro" viewBox="0 0 100 100">
  <path d="M30 94 L36 56 Q50 48 64 56 L70 94 Z" fill="currentColor" ${S}/>
  <circle cx="50" cy="38" r="17" fill="#f5f0df" ${S}/>
  <circle cx="44" cy="37" r="4.5" fill="${INK}"/><circle cx="56" cy="37" r="4.5" fill="${INK}"/>
  <path d="M44 48 L56 48" stroke="${INK}" stroke-width="3"/>
  <path d="M74 96 L80 30" stroke="#6b3f1f" stroke-width="6" stroke-linecap="round"/>
  <path d="M76 34 Q90 30 86 18 Q78 26 72 26 Z" fill="#cfd3d6" ${S4}/>
</symbol>
<symbol id="u-elves" viewBox="0 0 100 100">
  <path d="M32 94 L38 56 Q50 50 62 56 L68 94 Z" fill="#4fa04a" ${S}/>
  <circle cx="50" cy="40" r="15" fill="#ffd9b3" ${S}/>
  <path d="M33 44 Q30 18 50 16 Q70 18 67 44 Q60 30 50 30 Q40 30 33 44 Z" fill="currentColor" ${S4}/>
  <path d="M34 40 L24 34 L35 46 M66 40 L76 34 L65 46" fill="#ffd9b3" ${S4}/>
  <path d="M22 30 Q14 60 24 86" stroke="#7a4a26" stroke-width="5" fill="none" stroke-linecap="round"/>
  <path d="M22 30 L24 86" stroke="${INK}" stroke-width="2"/>
</symbol>
<symbol id="u-giants" viewBox="0 0 100 100">
  <path d="M22 94 L26 54 Q50 42 74 54 L78 94 Z" fill="currentColor" ${S}/>
  <path d="M26 70 L74 70" stroke="#6b3f1f" stroke-width="7"/>
  <circle cx="50" cy="36" r="17" fill="#d99a6c" ${S}/>
  <path d="M36 26 Q26 14 30 4 Q36 16 42 22 Z M64 26 Q74 14 70 4 Q64 16 58 22 Z" fill="#f6efe0" ${S4}/>
  <path d="M42 34 L46 36 M58 34 L54 36" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <path d="M40 46 Q50 52 60 46" stroke="${INK}" stroke-width="3" fill="none"/>
  <path d="M82 96 L84 50" stroke="#6b3f1f" stroke-width="7" stroke-linecap="round"/>
  <ellipse cx="84" cy="46" rx="10" ry="12" fill="#7a4a26" ${S4}/>
</symbol>
<symbol id="u-neutral" viewBox="0 0 100 100">
  <path d="M24 94 Q22 64 40 58 L58 58 Q78 64 76 94 Z" fill="#8a6a48" ${S}/>
  <path d="M28 52 Q30 26 52 24 Q74 26 72 52 Q62 44 50 46 Q38 44 28 52 Z" fill="#6d5236" ${S}/>
  <path d="M30 34 L22 16 L40 26 M70 34 L78 16 L60 26" fill="#6d5236" ${S4}/>
  <circle cx="42" cy="44" r="3.5" fill="#ffd23f"/><circle cx="58" cy="44" r="3.5" fill="#ffd23f"/>
  <path d="M44 56 L50 60 L56 56" stroke="${INK}" stroke-width="3" fill="none"/>
</symbol>
<symbol id="c-necro" viewBox="0 0 100 100">
  <path d="M26 96 L36 46 Q50 36 64 46 L74 96 Z" fill="#3b2650" ${S}/>
  <path d="M34 50 Q32 18 50 12 Q68 18 66 50 Q58 40 50 40 Q42 40 34 50 Z" fill="#2a1a3a" ${S}/>
  <circle cx="44" cy="38" r="3.5" fill="#8dff5a"/><circle cx="56" cy="38" r="3.5" fill="#8dff5a"/>
  <path d="M80 96 L80 24" stroke="#4a3a2a" stroke-width="6" stroke-linecap="round"/>
  <circle cx="80" cy="18" r="9" fill="#8dff5a" ${S4}/>
  <path d="M36 70 L64 70" stroke="currentColor" stroke-width="6"/>
</symbol>
<symbol id="c-elves" viewBox="0 0 100 100">
  <path d="M28 96 L36 50 Q50 42 64 50 L72 96 Z" fill="#3e7fd0" ${S}/>
  <circle cx="50" cy="46" r="12" fill="#ffd9b3" ${S4}/>
  <path d="M28 44 Q46 40 72 44 L54 2 Q46 22 28 44 Z" fill="currentColor" ${S}/>
  <path d="M44 54 Q50 70 56 54" fill="#f5f0df" ${S4}/>
  <path d="M82 96 L82 30" stroke="#7a4a26" stroke-width="6" stroke-linecap="round"/>
  <path d="M82 14 L86 24 L96 26 L88 32 L90 42 L82 36 L74 42 L76 32 L68 26 L78 24 Z" fill="#ffe36b" ${S4}/>
</symbol>
<symbol id="c-giants" viewBox="0 0 100 100">
  <path d="M24 96 L30 50 Q50 40 70 50 L76 96 Z" fill="#7a4a26" ${S}/>
  <path d="M30 64 Q50 74 70 64" stroke="currentColor" stroke-width="7" fill="none"/>
  <path d="M32 46 Q32 18 50 18 Q68 18 68 46 Z" fill="#f2e6cc" ${S}/>
  <path d="M40 34 L46 36 M60 34 L54 36" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  <path d="M32 28 Q16 22 14 6 Q26 14 36 20 Z M68 28 Q84 22 86 6 Q74 14 64 20 Z" fill="#f6efe0" ${S4}/>
  <path d="M42 18 L50 4 L58 18" fill="currentColor" ${S4}/>
  <path d="M84 96 L84 40" stroke="#6b3f1f" stroke-width="6" stroke-linecap="round"/>
  <circle cx="84" cy="36" r="6" fill="#ffb02e" ${S4}/>
</symbol>
<symbol id="s-scaffold" viewBox="0 0 100 100">
  <path d="M14 94 L14 40 M86 94 L86 40 M14 40 L86 40 M14 66 L86 66 M14 40 L86 94 M86 40 L14 94" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>
  <path d="M14 94 L14 40 M86 94 L86 40 M14 40 L86 40 M14 66 L86 66 M14 40 L86 94 M86 40 L14 94" stroke="#c98f52" stroke-width="4" stroke-linecap="round"/>
  <path d="M30 94 L30 76 L70 76 L70 94 Z" fill="#b3a998" ${S4}/>
  <path d="M30 84 L70 84 M50 76 L50 84" stroke="#7d7466" stroke-width="3"/>
  <path d="M50 40 L50 12" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
  <path d="M51 12 L72 18 L51 25 Z" fill="currentColor" ${S4}/>
</symbol>
<symbol id="s-peak" viewBox="0 0 100 100">
  <path d="M2 96 L34 30 Q42 16 48 26 L54 34 L62 12 Q68 2 74 12 L98 96 Z" fill="#7e7884" ${S}/>
  <path d="M68 6 Q72 8 74 12 L98 96 L60 96 L70 50 Z M46 24 L54 34 L48 96 L36 96 L44 48 Z" fill="#5d5862" opacity=".8"/>
  <path d="M52 40 L62 12 Q68 2 74 12 L82 36 L74 32 L68 40 L62 32 Z M26 48 L34 30 Q42 16 48 26 L54 36 L46 34 L40 42 L34 36 Z" fill="#fbfcff" ${S4}/>
  <path d="M10 88 Q30 80 50 86 Q72 80 92 88" stroke="#e9edf3" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/>
</symbol>
<symbol id="s-farm" viewBox="0 0 100 100">
  <path d="M38 94 L42 50 L58 50 L62 94 Z" fill="#f3ead2" ${S}/>
  <path d="M36 52 L50 34 L64 52 Z" fill="#c94f3a" ${S}/>
  <path d="M46 94 L46 80 Q50 74 54 80 L54 94 Z" fill="#7a4a26" ${S4}/>
  <g transform="translate(50 42)"><path d="M0 0 L-6 -38 L6 -38 Z M0 0 L38 -6 L38 6 Z M0 0 L6 38 L-6 38 Z M0 0 L-38 6 L-38 -6 Z" fill="#fffdf5" ${S4}/><circle r="5" fill="#ffd23f" ${S4}/></g>
</symbol>
<symbol id="s-mine" viewBox="0 0 100 100">
  <path d="M14 94 Q14 46 50 42 Q86 46 86 94 Z" fill="#8f8a85" ${S}/>
  <path d="M32 94 L32 66 Q50 52 68 66 L68 94 Z" fill="#2b2026" ${S4}/>
  <path d="M30 66 L70 66 M36 66 L36 94 M64 66 L64 94" stroke="#8a5a2b" stroke-width="6" stroke-linecap="round"/>
  <path d="M40 90 L60 90 L56 80 L44 80 Z" fill="#ffd23f" ${S4}/>
</symbol>
<symbol id="s-lumber" viewBox="0 0 100 100">
  <path d="M12 94 L88 94 L88 78 L12 78 Z M20 78 L80 78 L80 62 L20 62 Z M30 62 L70 62 L70 46 L30 46 Z" fill="#a46c36" ${S}/>
  <circle cx="12" cy="86" r="7" fill="#f2c97a" ${S4}/><circle cx="20" cy="70" r="7" fill="#f2c97a" ${S4}/><circle cx="30" cy="54" r="7" fill="#f2c97a" ${S4}/>
  <path d="M66 40 L84 18" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M80 12 L92 22 L84 28 Z" fill="#c9cdd2" ${S4}/>
</symbol>
<symbol id="s-well" viewBox="0 0 100 100">
  <ellipse cx="50" cy="80" rx="30" ry="14" fill="#b3a998" ${S}/>
  <ellipse cx="50" cy="76" rx="20" ry="8" fill="#4fb8e0" ${S4}/>
  <path d="M22 76 L22 36 M78 76 L78 36" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M22 76 L22 36 M78 76 L78 36" stroke="#8a5a2b" stroke-width="3"/>
  <path d="M14 40 L50 18 L86 40 Z" fill="#c94f3a" ${S}/>
</symbol>
<symbol id="s-fortress" viewBox="0 0 100 100">
  <path d="M4 96 L30 34 Q38 20 46 32 L56 20 Q62 12 68 22 L96 96 Z" fill="#8f8a85" ${S}/>
  <path d="M26 96 L26 58 L36 58 L36 64 L46 64 L46 58 L56 58 L56 64 L66 64 L66 58 L76 58 L76 96 Z" fill="#b8925a" ${S}/>
  <path d="M40 96 L40 78 Q51 66 62 78 L62 96 Z" fill="#3b2617" ${S4}/>
  <path d="M42 80 L60 80 M51 70 L51 96" stroke="#ffd23f" stroke-width="3"/>
  <path d="M50 58 L50 30" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
  <path d="M51 30 L72 36 L51 42 Z" fill="#3e6fb3" ${S4}/>
  <path d="M30 74 L36 74 M66 74 L72 74" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"/>
</symbol>
<symbol id="s-deadtree" viewBox="0 0 100 100">
  <path d="M46 94 L48 50 L36 36 M48 60 L62 42 L70 46 M48 50 L50 30" stroke="${INK}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M46 94 L48 50 L36 36 M48 60 L62 42 L70 46 M48 50 L50 30" stroke="#5a3d55" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="36" cy="36" r="5" fill="#8dff5a" ${S4}/>
</symbol>
<symbol id="s-unknown" viewBox="0 0 100 100">
  <path d="M4 96 L36 30 Q46 16 56 30 L96 96 Z" fill="#7d7884" ${S}/>
  <path d="M40 62 Q40 48 50 48 Q60 48 60 58 Q60 66 52 68 L52 76" stroke="${INK}" stroke-width="10" fill="none" stroke-linecap="round"/>
  <path d="M40 62 Q40 48 50 48 Q60 48 60 58 Q60 66 52 68 L52 76" stroke="#ffd23f" stroke-width="5" fill="none" stroke-linecap="round"/>
  <circle cx="52" cy="88" r="5" fill="#ffd23f" ${S4}/>
</symbol>
<symbol id="s-star" viewBox="0 0 100 100">
  <path d="M50 8 L62 38 L94 40 L69 60 L78 92 L50 74 L22 92 L31 60 L6 40 L38 38 Z" fill="#ffd23f" ${S}/>
</symbol>
<symbol id="s-sparkle" viewBox="0 0 100 100">
  <path d="M50 10 Q56 44 90 50 Q56 56 50 90 Q44 56 10 50 Q44 44 50 10 Z" fill="#d8ffb0" ${S4}/>
</symbol>
<symbol id="s-shield" viewBox="0 0 100 100">
  <path d="M50 4 L92 16 Q92 66 50 96 Q8 66 8 16 Z" fill="currentColor" ${S}/>
</symbol>
`;

export const BADGE_PATH = 'M-19 -15 L19 -15 Q21 -15 21 -12 L21 2 Q21 14 0 22 Q-21 14 -21 2 L-21 -12 Q-21 -15 -19 -15 Z';

export function use(id: string, x: number, y: number, size: number, extra = ''): string {
  return `<use href="#${id}" x="${(x - size / 2).toFixed(1)}" y="${(y - size * 0.95).toFixed(1)}" width="${size}" height="${size}" ${extra}/>`;
}

function rand(seed: number) {
  let s = seed | 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) | 0;
    return ((s ^ (s >>> 13)) >>> 0) / 4294967296;
  };
}

type Item = [string, number, number, number];

/** Decorations in tile-local coordinates (hex centre at 0,0, size 60). */
export function decorations(t: Tile, hasBuilding = false): string {
  const r = rand(t.deco + (t.terrain.charCodeAt(0) << 8));
  const items: Item[] = [];
  const j = (v: number) => v + (r() - 0.5) * 6;
  switch (t.terrain) {
    case 'forest': {
      if (t.corrupted) {
        const spots: [number, number][] = hasBuilding ? [[-38, 0], [34, 4]] : [[-24, -24], [8, -32], [30, -12], [-36, 0], [-2, -6]];
        for (const [x, y] of spots) items.push(['s-deadtree', j(x), j(y), 30]);
        break;
      }
      const slots: [number, number][] = [[-24, -24], [6, -34], [30, -14], [-38, 0], [-4, -8], [24, 8], [34, -36]];
      const n = hasBuilding ? 3 : 5 + Math.floor(r() * 2);
      const pick = hasBuilding ? [[-38, 0], [34, 4], [36, -30]] : slots.slice(0, n);
      for (const [x, y] of pick) items.push([r() < 0.55 ? 's-pine' : 's-tree', j(x), j(y), 28 + r() * 8]);
      break;
    }
    case 'peak': {
      items.push(['s-peak', 0, 8, 96]);
      break;
    }
    case 'mountain': {
      if (hasBuilding) {
        items.push(['s-hill', -36, 4, 30], ['s-hill', 36, 2, 26]);
      } else {
        const flip = r() < 0.5 ? -1 : 1;
        items.push(['s-mountain', 6 * flip, -6, 62]);
        items.push(['s-mountain', -26 * flip, 4, 40]);
        if (r() < 0.6) items.push(['s-hill', 32 * flip, 6, 26]);
      }
      break;
    }
    case 'desert': {
      items.push(['s-dune', j(-14), j(-18), 44]);
      if (!hasBuilding) items.push(['s-dune', j(18), j(-30), 36]);
      items.push(['s-cactus', j(hasBuilding ? 36 : 24), j(hasBuilding ? 4 : -6), 30]);
      if (r() < 0.6) items.push(['s-bones', j(-34), j(6), 20]);
      if (!hasBuilding && r() < 0.5) items.push(['s-cactus', j(-30), j(-30), 22]);
      break;
    }
    case 'plains': {
      if (!hasBuilding) items.push(['s-wheat', j(-14), j(-22), 40]);
      items.push(['s-tuft', j(26), j(-28), 18], ['s-tuft', j(-38), j(4), 16], ['s-tuft', j(36), j(8), 16]);
      if (!hasBuilding && r() < 0.6) items.push(['s-sheep', j(22), j(-4), 24]);
      if (r() < 0.5) items.push(['s-flowers', j(hasBuilding ? -30 : 6), j(hasBuilding ? -30 : -40), 20]);
      break;
    }
    default:
      break;
  }
  items.sort((a, b) => a[2] - b[2]);
  return items.map(([id, x, y, s]) => use(id, x, y, s)).join('');
}

export function castleId(f: FactionId): string {
  return `s-castle-${f}`;
}

export const IMPROVEMENT_SYMBOL: Record<string, string> = { plains: 's-farm', forest: 's-lumber', mountain: 's-mine', desert: 's-well' };
