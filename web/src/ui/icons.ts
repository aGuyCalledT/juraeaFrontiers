// Authored UI icons: filled shapes with the same ink outline as the board art.
const I = '#2b1d14';
const s = `stroke="${I}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;
const wrap = (body: string) => `<svg class="ico" viewBox="0 0 32 32" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  gold: wrap(`<ellipse cx="16" cy="19" rx="11" ry="6" fill="#c8901c" ${s}/><ellipse cx="16" cy="14" rx="11" ry="6" fill="#ffd23f" ${s}/><ellipse cx="16" cy="14" rx="5" ry="2.4" fill="none" stroke="#c8901c" stroke-width="2"/>`),
  souls: wrap(`<path d="M8 28 Q6 14 16 5 Q26 14 24 28 L20 24 L16 28 L12 24 Z" fill="#8dff5a" ${s}/><circle cx="13" cy="15" r="2" fill="${I}"/><circle cx="19" cy="15" r="2" fill="${I}"/>`),
  mana: wrap(`<path d="M16 3 L25 15 L16 29 L7 15 Z" fill="#5fb8ff" ${s}/><path d="M16 3 L25 15 L16 15 Z" fill="#b8e2ff"/>`),
  ore: wrap(`<path d="M5 22 L9 10 L19 6 L27 13 L26 24 L15 27 Z" fill="#a59b8e" ${s}/><path d="M12 14 L16 12 M18 19 L22 17 M10 21 L13 20" stroke="#ffb02e" stroke-width="3" stroke-linecap="round"/>`),
  troops: wrap(`<path d="M6 18 Q6 6 16 6 Q26 6 26 18 L26 22 L6 22 Z" fill="#c0c7cf" ${s}/><path d="M16 6 L16 2" ${s}/><path d="M3 22 L29 22 L27 27 L5 27 Z" fill="#8b96a1" ${s}/>`),
  sword: wrap(`<path d="M24 3 L29 3 L29 8 L13 24 L8 19 Z" fill="#dfe6ec" ${s}/><path d="M6 17 L15 26" ${s}/><path d="M9 22 L4 27" stroke="${I}" stroke-width="5" stroke-linecap="round"/><path d="M9 22 L4 27" stroke="#8a5a2b" stroke-width="2.4" stroke-linecap="round"/>`),
  shield: wrap(`<path d="M16 3 L27 7 Q27 21 16 29 Q5 21 5 7 Z" fill="#5f8fd9" ${s}/><path d="M16 3 L16 29" stroke="#ffd23f" stroke-width="3"/>`),
  march: wrap(`<path d="M4 20 Q10 8 22 10 L22 5 L30 13 L22 21 L22 16 Q14 14 4 20 Z" fill="#7fcf52" ${s}/>`),
  crown: wrap(`<path d="M4 24 L6 10 L12 16 L16 6 L20 16 L26 10 L28 24 Z" fill="#ffd23f" ${s}/><path d="M4 24 L28 24 L28 28 L4 28 Z" fill="#e0a21c" ${s}/>`),
  skull: wrap(`<path d="M6 16 Q6 4 16 4 Q26 4 26 16 L23 20 L23 26 L9 26 L9 20 Z" fill="#f5f0df" ${s}/><circle cx="12" cy="15" r="3" fill="${I}"/><circle cx="20" cy="15" r="3" fill="${I}"/>`),
  gear: wrap(`<path d="M16 4 L19 4 L20 8 L24 10 L27 8 L29 11 L26 14 L26 18 L29 21 L27 24 L24 22 L20 24 L19 28 L13 28 L12 24 L8 22 L5 24 L3 21 L6 18 L6 14 L3 11 L5 8 L8 10 L12 8 L13 4 Z" fill="#c9b79a" ${s}/><circle cx="16" cy="16" r="4.5" fill="#6b5a45" ${s}/>`),
  soundOn: wrap(`<path d="M4 12 L10 12 L17 5 L17 27 L10 20 L4 20 Z" fill="#ffd23f" ${s}/><path d="M21 11 Q25 16 21 21 M24 7 Q31 16 24 25" fill="none" ${s}/>`),
  soundOff: wrap(`<path d="M4 12 L10 12 L17 5 L17 27 L10 20 L4 20 Z" fill="#c9b79a" ${s}/><path d="M21 12 L29 20 M29 12 L21 20" ${s}/>`),
  check: wrap(`<path d="M5 17 L13 25 L28 7" fill="none" stroke="${I}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 17 L13 25 L28 7" fill="none" stroke="#7fdc52" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`),
  cross: wrap(`<path d="M7 7 L25 25 M25 7 L7 25" stroke="${I}" stroke-width="7" stroke-linecap="round"/><path d="M7 7 L25 25 M25 7 L7 25" stroke="#ff5a4a" stroke-width="3.4" stroke-linecap="round"/>`),
  dice: wrap(`<rect x="4" y="4" width="24" height="24" rx="6" fill="#fffdf5" ${s}/><circle cx="11" cy="11" r="2.4" fill="${I}"/><circle cx="21" cy="21" r="2.4" fill="${I}"/><circle cx="16" cy="16" r="2.4" fill="${I}"/>`),
  bolt: wrap(`<path d="M18 3 L7 18 L15 18 L13 29 L25 13 L17 13 Z" fill="#ffd23f" ${s}/>`),
  close: wrap(`<path d="M8 8 L24 24 M24 8 L8 24" stroke="${I}" stroke-width="5" stroke-linecap="round"/>`),
  plus: wrap(`<path d="M16 6 L16 26 M6 16 L26 16" stroke="${I}" stroke-width="5" stroke-linecap="round"/>`),
  minus: wrap(`<path d="M6 16 L26 16" stroke="${I}" stroke-width="5" stroke-linecap="round"/>`),
  book: wrap(`<path d="M4 7 Q10 5 16 8 Q22 5 28 7 L28 26 Q22 24 16 27 Q10 24 4 26 Z" fill="#e8d3a6" ${s}/><path d="M16 8 L16 27" ${s}/>`),
  globe: wrap(`<circle cx="16" cy="16" r="12" fill="#5fb8ff" ${s}/><path d="M9 10 Q14 12 12 17 Q8 19 9 24 M19 6 Q17 11 22 13 Q27 13 26 19" fill="none" stroke="#3f9a3a" stroke-width="3" stroke-linecap="round"/>`),
  home: wrap(`<path d="M4 15 L16 5 L28 15 L25 15 L25 27 L7 27 L7 15 Z" fill="#e0452f" ${s}/><path d="M13 27 L13 19 L19 19 L19 27" fill="#4a2c18" ${s}/>`),
  wind: wrap(`<path d="M4 12 L20 12 Q25 12 25 8 Q25 4 21 4 M4 18 L26 18 Q30 18 30 22 Q30 26 26 26 M4 24 L14 24" fill="none" ${s}/>`),
};

export function powerIcon(f: string): string {
  return f === 'necro' ? ICONS.souls : f === 'elves' ? ICONS.mana : ICONS.ore;
}
