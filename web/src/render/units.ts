// Unit sprites (rules v2). Cartoon vectors in the board's style: umber ink
// outline, flat colour with one shade and one highlight per material.
// Box: 120 x 120, feet on y = 110, every unit faces right (towards its target).
// Animated parts carry classes that units.css drives:
//   .u-rig     whole figure (breathing, hit, death)
//   .u-weapon  swings / recoils on attack
//   .u-fx      hidden effect shown on attack (flash, spell, arrow)
// Faction trim uses currentColor.

import { UNIT_STATS, type UnitType } from '../engine/unitstats';

export type UnitId = UnitType;

export type AttackStyle = 'swing' | 'cast' | 'shoot' | 'cannon' | 'stomp';

export interface UnitSprite {
  id: UnitId;
  name: string;
  faction: 'necro' | 'elves' | 'giants' | 'neutral' | 'dwarves';
  tier: 1 | 2 | 3;
  attack: number;
  defense: number;
  hp: number;
  style: AttackStyle;
  /** Inner SVG markup for viewBox 0 0 120 120. */
  art: string;
}

const K = '#2b1d14';
const o = (w = 3.5) => `stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const shadow = (rx = 24) => `<ellipse class="u-shadow" cx="60" cy="110" rx="${rx}" ry="5" fill="#000" opacity=".22"/>`;
/** Bone limb: ink line under a bone-coloured line. */
const bone = (d: string, w = 5) => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w + 4}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#efe6cf" stroke-width="${w}" stroke-linecap="round"/>`;
const BONE = '#efe6cf';
const BONE_SHADE = '#cbbf9f';
const GLOW = '#8dff5a';

// ---------------------------------------------------------------- Necros
const skeleton = `
${shadow(20)}
<g class="u-rig">
  ${bone('M54 80 L50 95 L47 107')}${bone('M66 80 L70 95 L73 107')}
  <path d="M42 108 L52 106 M68 106 L78 108" ${o(5)}/>
  <path d="M48 82 Q60 74 72 82 L70 88 Q60 84 50 88 Z" fill="currentColor" ${o()}/>
  <path d="M51 86 L48 96 L54 90 L57 98 L60 89 L64 97 L66 89 L71 95 L69 86 Z" fill="currentColor" ${o(2.5)}/>
  ${bone('M60 80 L60 60', 4)}
  <path d="M47 52 Q60 46 73 52 Q74 66 60 72 Q46 66 47 52 Z" fill="${BONE}" ${o()}/>
  <path d="M51 56 Q60 53 69 56 M50 61 Q60 58 70 61 M52 66 Q60 63 68 66" fill="none" stroke="${K}" stroke-width="2.4" stroke-linecap="round"/>
  <g class="u-shield">
    ${bone('M49 54 L40 66 L38 76', 4)}
    <circle cx="35" cy="74" r="11" fill="#7a4a26" ${o()}/>
    <circle cx="35" cy="74" r="11" fill="none" stroke="currentColor" stroke-width="3"/>
    <circle cx="35" cy="74" r="3" fill="#b9b2a5" ${o(2)}/>
  </g>
  <g class="u-weapon" style="transform-origin: 80px 68px">
    ${bone('M71 54 L78 62 L81 68', 4)}
    <path d="M78 66 L88 64" ${o(4)}/>
    <path d="M83 64 L103 30 L106 33 L88 66 Z" fill="#b8b2a8" ${o(3)}/>
    <path d="M95 46 L98 45 M99 39 L102 39" stroke="${K}" stroke-width="2"/>
    <path d="M83 64 L80 70" stroke="#6b3f1f" stroke-width="5" stroke-linecap="round"/>
  </g>
  <g class="u-head">
    <path d="M44 32 Q44 14 60 14 Q76 14 76 32 Q76 40 70 43 L70 48 L50 48 L50 43 Q44 40 44 32 Z" fill="${BONE}" ${o()}/>
    <path d="M70 18 Q76 24 76 32 Q76 40 70 43 L70 48 L64 48 Q72 36 70 18 Z" fill="${BONE_SHADE}"/>
    <ellipse cx="53" cy="31" rx="5" ry="6" fill="${K}"/><ellipse cx="67" cy="31" rx="5" ry="6" fill="${K}"/>
    <circle cx="54" cy="31" r="1.8" fill="${GLOW}"/><circle cx="68" cy="31" r="1.8" fill="${GLOW}"/>
    <path d="M58 39 L60 36 L62 39 Z" fill="${K}"/>
    <path d="M52 44 L52 48 M56 44 L56 48 M60 44 L60 48 M64 44 L64 48 M68 44 L68 48" stroke="${K}" stroke-width="1.8"/>
    <path d="M50 22 Q54 19 58 21" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>
  </g>
</g>`;

const lich = `
<ellipse class="u-shadow" cx="60" cy="111" rx="18" ry="4" fill="#000" opacity=".18"/>
<g class="u-rig u-float">
  <path d="M40 54 Q38 80 34 100 L42 94 L46 102 L52 95 L58 104 L64 95 L70 103 L76 94 L82 100 Q80 80 78 54 Q60 44 40 54 Z" fill="#3b2650" ${o()}/>
  <path d="M60 50 Q72 50 78 54 Q80 80 82 100 L76 94 L70 103 L66 96 Q72 74 60 50 Z" fill="#2a1a3a"/>
  <path d="M46 58 L50 96 M72 58 L68 96" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
  <path d="M46 58 L50 96 M72 58 L68 96" stroke="${K}" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>
  <path d="M42 56 Q32 66 30 76" fill="none" stroke="#3b2650" stroke-width="11" stroke-linecap="round"/>
  <path d="M42 56 Q32 66 30 76" fill="none" ${o()} opacity=".0"/>
  ${bone('M30 74 L26 80', 3)}${bone('M30 74 L31 82', 3)}
  <g class="u-weapon" style="transform-origin: 88px 74px">
    <path d="M78 58 Q86 64 88 72" fill="none" stroke="#3b2650" stroke-width="11" stroke-linecap="round"/>
    <path d="M92 108 L92 26" stroke="${K}" stroke-width="8" stroke-linecap="round"/>
    <path d="M92 108 L92 26" stroke="#4a3a2a" stroke-width="4" stroke-linecap="round"/>
    ${bone('M86 72 L92 72', 4)}
    <path d="M84 30 Q92 12 100 30 Q92 26 84 30 Z" fill="${BONE}" ${o(2.5)}/>
    <circle cx="92" cy="22" r="8" fill="${GLOW}" ${o(3)}/>
    <circle cx="90" cy="20" r="2.6" fill="#e9ffd9"/>
    <g class="u-fx">
      <circle cx="92" cy="22" r="18" fill="${GLOW}" opacity=".45"/>
      <path d="M92 2 L95 14 L106 10 L98 20 L110 24 L97 27 L102 38 L92 30 L82 38 L87 27 L74 24 L86 20 L78 10 L89 14 Z" fill="${GLOW}" ${o(2.5)}/>
    </g>
  </g>
  <g class="u-head">
    <path d="M42 46 Q40 18 60 14 Q80 18 78 46 Q70 40 60 40 Q50 40 42 46 Z" fill="#2a1a3a" ${o()}/>
    <path d="M47 42 Q47 24 60 24 Q73 24 73 42 Q73 50 67 52 L53 52 Q47 50 47 42 Z" fill="${BONE}" ${o(3)}/>
    <ellipse cx="55" cy="38" rx="4" ry="5" fill="${K}"/><ellipse cx="66" cy="38" rx="4" ry="5" fill="${K}"/>
    <circle cx="55" cy="38" r="2.4" fill="${GLOW}"/><circle cx="66" cy="38" r="2.4" fill="${GLOW}"/>
    <path d="M56 48 L56 52 M60 48 L60 52 M64 48 L64 52" stroke="${K}" stroke-width="1.6"/>
    <path d="M48 24 L50 12 L55 20 L60 8 L65 20 L70 12 L72 24 Z" fill="#ffd23f" ${o(3)}/>
    <circle cx="60" cy="19" r="2.4" fill="${GLOW}" ${o(1.5)}/>
  </g>
</g>`;

const priest = `
${shadow(24)}
<g class="u-rig">
  <path d="M40 58 Q34 84 30 108 L90 108 Q86 84 80 58 Q60 50 40 58 Z" fill="#f3eddc" ${o()}/>
  <path d="M64 54 Q74 54 80 58 Q86 84 90 108 L72 108 Q76 80 64 54 Z" fill="#d8cfb7"/>
  <path d="M38 90 Q60 96 82 90 L84 100 Q60 106 36 100 Z" fill="#ffd23f" ${o(2.5)}/>
  <path d="M52 58 L50 108 L60 108 L58 58 Z M62 58 L60 108 L70 108 L68 58 Z" fill="currentColor" ${o(2.5)}/>
  <path d="M51 74 L58 74 M51 86 L58 86 M62 74 L69 74 M62 86 L69 86" stroke="#ffd23f" stroke-width="2.5"/>
  <path d="M40 60 Q30 72 30 84" fill="none" stroke="${K}" stroke-width="13" stroke-linecap="round"/>
  <path d="M40 60 Q30 72 30 84" fill="none" stroke="#f3eddc" stroke-width="8" stroke-linecap="round"/>
  ${bone('M30 84 L28 90', 3)}${bone('M30 84 L33 91', 3)}
  <g class="u-weapon" style="transform-origin: 92px 80px">
    <path d="M80 60 Q88 70 90 80" fill="none" stroke="${K}" stroke-width="13" stroke-linecap="round"/>
    <path d="M80 60 Q88 70 90 80" fill="none" stroke="#f3eddc" stroke-width="8" stroke-linecap="round"/>
    <path d="M94 110 L94 30" stroke="${K}" stroke-width="8" stroke-linecap="round"/>
    <path d="M94 110 L94 30" stroke="#e0a21c" stroke-width="4" stroke-linecap="round"/>
    <path d="M94 32 Q94 12 106 12 Q116 12 116 22 Q116 30 108 30 Q104 30 104 26" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>
    <path d="M94 32 Q94 12 106 12 Q116 12 116 22 Q116 30 108 30 Q104 30 104 26" fill="none" stroke="#ffd23f" stroke-width="4" stroke-linecap="round"/>
    <path d="M106 22 Q102 14 108 8 Q108 16 112 18 Q112 24 106 22 Z" fill="${GLOW}" ${o(2)}/>
    ${bone('M88 80 L94 80', 4)}
    <g class="u-fx">
      <circle cx="108" cy="20" r="16" fill="${GLOW}" opacity=".4"/>
      <path d="M108 0 Q100 10 106 18 Q96 14 98 4 M108 0 Q118 10 110 18 Q122 14 118 4" fill="${GLOW}" ${o(2)}/>
    </g>
  </g>
  <g class="u-head">
    <path d="M48 44 Q48 28 60 28 Q72 28 72 44 Q72 52 66 54 L54 54 Q48 52 48 44 Z" fill="${BONE}" ${o(3)}/>
    <ellipse cx="55" cy="42" rx="4" ry="5" fill="${K}"/><ellipse cx="66" cy="42" rx="4" ry="5" fill="${K}"/>
    <circle cx="55" cy="42" r="1.8" fill="${GLOW}"/><circle cx="66" cy="42" r="1.8" fill="${GLOW}"/>
    <path d="M57 50 L57 54 M61 50 L61 54 M65 50 L65 54" stroke="${K}" stroke-width="1.6"/>
    <path d="M46 32 Q46 10 60 2 Q74 10 74 32 Z" fill="#f3eddc" ${o()}/>
    <path d="M60 2 Q74 10 74 32 L64 32 Q68 14 60 2 Z" fill="#d8cfb7"/>
    <path d="M46 32 L74 32 L74 27 L46 27 Z" fill="#ffd23f" ${o(2.5)}/>
    <path d="M60 5 L60 27" stroke="#ffd23f" stroke-width="3"/>
    <path d="M53 14 Q53 9 60 9 Q67 9 67 14 Q67 18 64 19 L56 19 Q53 18 53 14 Z" fill="currentColor" ${o(2)}/>
    <circle cx="57.5" cy="14" r="1.6" fill="${K}"/><circle cx="62.5" cy="14" r="1.6" fill="${K}"/>
  </g>
</g>`;

// ---------------------------------------------------------------- Elves
const SKIN = '#ffd9b3';
const SKIN_SHADE = '#eab68c';
const LEAF = '#4fa04a';
const LEAF_D = '#2f7a3a';
const LEAF_L = '#7fcb55';
const WOOD = '#8a5a2b';

const archer = `
${shadow(20)}
<g class="u-rig">
  <path d="M53 84 L50 106 M67 84 L70 106" stroke="${K}" stroke-width="9" stroke-linecap="round"/>
  <path d="M53 84 L50 106 M67 84 L70 106" stroke="#6b4a2a" stroke-width="5" stroke-linecap="round"/>
  <path d="M44 106 L54 104 M66 104 L76 106" ${o(5)}/>
  <path d="M36 50 L30 90 L38 86 Z" fill="currentColor" ${o(2.5)}/>
  <path d="M44 50 Q60 44 76 50 L78 88 Q60 94 42 88 Z" fill="${LEAF}" ${o()}/>
  <path d="M62 47 Q70 47 76 50 L78 88 Q70 91 64 92 Q70 70 62 47 Z" fill="${LEAF_D}"/>
  <path d="M42 74 L78 74" stroke="#6b4a2a" stroke-width="5"/><rect x="56" y="71" width="8" height="6" rx="1" fill="#ffd23f" ${o(1.8)}/>
  <path d="M60 48 L60 70" stroke="currentColor" stroke-width="3"/>
  <path d="M38 46 L46 42 L50 64 L42 66 Z" fill="#7a4a26" ${o(2.5)}/>
  <path d="M40 44 L36 34 M43 43 L41 32 M46 42 L46 31" stroke="${K}" stroke-width="2"/>
  <path d="M34 34 L38 32 M39 31 L43 30 M44 30 L48 30" stroke="#ff7a59" stroke-width="3" stroke-linecap="round"/>
  <g class="u-weapon" style="transform-origin: 88px 60px">
    <path d="M74 56 L86 58" stroke="${K}" stroke-width="9" stroke-linecap="round"/>
    <path d="M74 56 L86 58" stroke="${LEAF}" stroke-width="5" stroke-linecap="round"/>
    <path d="M90 26 Q106 60 90 94" fill="none" stroke="${K}" stroke-width="8" stroke-linecap="round"/>
    <path d="M90 26 Q106 60 90 94" fill="none" stroke="${WOOD}" stroke-width="4" stroke-linecap="round"/>
    <path d="M90 26 L72 60 L90 94" fill="none" stroke="#f5efe0" stroke-width="1.6"/>
    <g class="u-arrow">
      <path d="M72 60 L108 60" stroke="${K}" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M72 60 L108 60" stroke="#c98f52" stroke-width="2"/>
      <path d="M106 55 L116 60 L106 65 Z" fill="#dfe6ec" ${o(2)}/>
      <path d="M70 56 L76 60 L70 64" fill="#ffe36b" ${o(1.6)}/>
    </g>
    <circle cx="72" cy="60" r="4.5" fill="${SKIN}" ${o(2.5)}/>
    <circle cx="90" cy="60" r="4.5" fill="${SKIN}" ${o(2.5)}/>
  </g>
  <g class="u-head">
    <path d="M47 32 L36 24 L48 38 Z M73 32 L84 24 L72 38 Z" fill="${SKIN}" ${o(2.5)}/>
    <circle cx="60" cy="34" r="13" fill="${SKIN}" ${o()}/>
    <path d="M66 24 Q73 30 72 38 Q70 44 64 46 Q70 36 66 24 Z" fill="${SKIN_SHADE}"/>
    <circle cx="56" cy="35" r="2" fill="${K}"/><circle cx="66" cy="35" r="2" fill="${K}"/>
    <path d="M58 41 Q61 43 64 41" stroke="${K}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M44 34 Q42 12 60 10 Q78 12 76 34 Q72 22 60 21 Q48 22 44 34 Z" fill="currentColor" ${o(3)}/>
    <path d="M60 10 Q72 14 74 26 Q66 18 60 18 Z" fill="#fff" opacity=".3"/>
  </g>
</g>`;

const druid = `
${shadow(22)}
<g class="u-rig">
  <path d="M42 54 Q36 82 32 108 L86 108 Q84 82 78 54 Q60 46 42 54 Z" fill="#6d5a3a" ${o()}/>
  <path d="M64 50 Q74 50 78 54 Q84 82 86 108 L70 108 Q74 78 64 50 Z" fill="#54442c"/>
  <path d="M48 56 Q46 84 44 108 L52 108 Q54 82 56 56 Z" fill="${LEAF}" ${o(2.5)}/>
  <path d="M34 98 Q42 94 46 100 Q52 94 58 100 Q64 94 70 100 Q76 94 86 98" fill="none" stroke="${LEAF_D}" stroke-width="3" stroke-linecap="round"/>
  <path d="M38 78 Q60 84 82 78" stroke="currentColor" stroke-width="5" fill="none"/>
  <path d="M38 78 Q60 84 82 78" stroke="${K}" stroke-width="1.5" fill="none" opacity=".4"/>
  <path d="M42 58 Q32 68 32 80" fill="none" stroke="${K}" stroke-width="12" stroke-linecap="round"/>
  <path d="M42 58 Q32 68 32 80" fill="none" stroke="#6d5a3a" stroke-width="7" stroke-linecap="round"/>
  <circle cx="32" cy="82" r="4.5" fill="${SKIN}" ${o(2.5)}/>
  <g class="u-weapon" style="transform-origin: 90px 78px">
    <path d="M78 58 Q86 68 88 78" fill="none" stroke="${K}" stroke-width="12" stroke-linecap="round"/>
    <path d="M78 58 Q86 68 88 78" fill="none" stroke="#6d5a3a" stroke-width="7" stroke-linecap="round"/>
    <path d="M92 110 Q88 80 94 50 Q98 34 90 22" fill="none" stroke="${K}" stroke-width="9" stroke-linecap="round"/>
    <path d="M92 110 Q88 80 94 50 Q98 34 90 22" fill="none" stroke="${WOOD}" stroke-width="5" stroke-linecap="round"/>
    <path d="M94 40 Q102 34 104 26" fill="none" stroke="${K}" stroke-width="6" stroke-linecap="round"/>
    <path d="M94 40 Q102 34 104 26" fill="none" stroke="${WOOD}" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M104 26 Q112 22 112 30 Q106 32 104 26 Z M90 22 Q82 14 88 10 Q92 16 90 22 Z M96 48 Q104 50 102 56 Q96 54 96 48 Z" fill="${LEAF_L}" ${o(2)}/>
    <circle cx="94" cy="20" r="6" fill="#bff58a" ${o(2.5)}/>
    <circle cx="88" cy="78" r="4.5" fill="${SKIN}" ${o(2.5)}/>
    <g class="u-fx">
      <circle cx="94" cy="20" r="16" fill="#bff58a" opacity=".45"/>
      <path d="M94 0 Q102 8 96 14 M112 12 Q106 16 102 14 M78 8 Q86 12 88 16" stroke="${LEAF_L}" stroke-width="4" stroke-linecap="round" fill="none"/>
      <path d="M106 2 Q112 6 108 10 Q104 6 106 2 Z M80 2 Q86 4 84 8 Q80 6 80 2 Z" fill="${LEAF_L}" ${o(1.5)}/>
    </g>
  </g>
  <g class="u-head">
    <path d="M46 44 Q44 62 40 70 L50 62 L52 46 Z M74 44 Q76 62 80 70 L70 62 L68 46 Z" fill="#f2efe6" ${o(2.5)}/>
    <path d="M48 34 L38 28 L49 40 Z M72 34 L82 28 L71 40 Z" fill="${SKIN}" ${o(2.5)}/>
    <circle cx="60" cy="38" r="12" fill="${SKIN}" ${o()}/>
    <circle cx="56" cy="39" r="2" fill="${K}"/><circle cx="65" cy="39" r="2" fill="${K}"/>
    <path d="M57 45 Q60 47 63 45" stroke="${K}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M44 40 Q40 14 60 10 Q80 14 76 40 Q72 26 60 26 Q48 26 44 40 Z" fill="#6d5a3a" ${o(3)}/>
    <path d="M46 24 Q50 14 56 18 Q58 10 64 14 Q70 8 72 18 Q78 16 76 26" fill="${LEAF}" ${o(2.5)}/>
    <circle cx="60" cy="14" r="3" fill="currentColor" ${o(1.5)}/>
  </g>
</g>`;

const treant = `
${shadow(32)}
<g class="u-rig">
  <path d="M30 110 Q36 100 42 98 L40 110 Z M52 110 L50 98 L58 100 L60 110 Z M90 110 Q84 100 78 98 L80 110 Z M66 110 L66 100 L74 98 L72 110 Z" fill="#6b4524" ${o(3)}/>
  <path d="M38 102 Q34 70 40 50 L80 50 Q86 70 82 102 Q60 108 38 102 Z" fill="#8a5a2b" ${o()}/>
  <path d="M66 50 L80 50 Q86 70 82 102 Q74 104 68 105 Q74 76 66 50 Z" fill="#6b4524"/>
  <path d="M46 62 Q44 80 48 96 M58 70 Q56 84 60 100 M72 60 Q74 74 72 90" stroke="#5a3a1c" stroke-width="2.5" fill="none" stroke-linecap="round"/>
  <path d="M38 84 Q60 90 82 84" stroke="currentColor" stroke-width="6" fill="none"/>
  <path d="M38 84 Q60 90 82 84" stroke="${K}" stroke-width="1.5" fill="none" opacity=".4"/>
  <g class="u-arm-l">
    <path d="M42 60 Q26 66 20 82" fill="none" stroke="${K}" stroke-width="14" stroke-linecap="round"/>
    <path d="M42 60 Q26 66 20 82" fill="none" stroke="#8a5a2b" stroke-width="9" stroke-linecap="round"/>
    <path d="M20 82 L12 90 M20 82 L18 94 M20 82 L26 92" stroke="${K}" stroke-width="6" stroke-linecap="round"/>
    <path d="M20 82 L12 90 M20 82 L18 94 M20 82 L26 92" stroke="#8a5a2b" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  <g class="u-weapon" style="transform-origin: 78px 60px">
    <path d="M78 60 Q96 60 104 44" fill="none" stroke="${K}" stroke-width="14" stroke-linecap="round"/>
    <path d="M78 60 Q96 60 104 44" fill="none" stroke="#8a5a2b" stroke-width="9" stroke-linecap="round"/>
    <path d="M104 44 L112 36 M104 44 L104 32 M104 44 L114 48" stroke="${K}" stroke-width="6" stroke-linecap="round"/>
    <path d="M104 44 L112 36 M104 44 L104 32 M104 44 L114 48" stroke="#8a5a2b" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M96 54 Q102 50 104 56 Q98 58 96 54 Z" fill="${LEAF_L}" ${o(1.8)}/>
  </g>
  <g class="u-head">
    <path d="M22 44 Q14 30 26 22 Q26 6 46 8 Q56 -2 72 6 Q90 2 96 18 Q108 24 100 40 Q104 52 86 54 Q72 62 58 54 Q40 60 32 52 Q18 54 22 44 Z" fill="${LEAF}" ${o()}/>
    <path d="M58 54 Q72 62 86 54 Q104 52 100 40 Q90 48 76 46 Q66 52 58 54 Z" fill="${LEAF_D}"/>
    <path d="M36 22 Q42 16 50 20 M66 12 Q74 8 80 14 M28 36 Q32 32 38 34" stroke="${LEAF_L}" stroke-width="4" fill="none" stroke-linecap="round"/>
    <circle cx="44" cy="30" r="3.5" fill="#ff8fb0" ${o(1.5)}/><circle cx="82" cy="24" r="3.5" fill="#fff" ${o(1.5)}/>
    <path d="M46 60 Q52 54 58 60 M64 60 Q70 54 76 60" stroke="${K}" stroke-width="3" fill="none" stroke-linecap="round"/>
    <ellipse cx="52" cy="64" rx="4" ry="4.5" fill="${K}"/><ellipse cx="70" cy="64" rx="4" ry="4.5" fill="${K}"/>
    <circle cx="52" cy="64" r="2" fill="#ffe36b"/><circle cx="70" cy="64" r="2" fill="#ffe36b"/>
    <path d="M52 76 Q61 82 70 76 Q61 78 52 76 Z" fill="${K}" ${o(2)}/>
  </g>
</g>`;

// ---------------------------------------------------------------- Giants
const GSKIN = '#d99a6c';
const GSKIN_D = '#b57a50';
const IRON = '#8f969e';
const IRON_D = '#646a72';

const giantBody = (belly: string) => `
  <path d="M46 92 L42 108 M74 92 L78 108" stroke="${K}" stroke-width="14" stroke-linecap="round"/>
  <path d="M46 92 L42 108 M74 92 L78 108" stroke="${GSKIN}" stroke-width="9" stroke-linecap="round"/>
  <path d="M34 110 Q34 104 42 104 Q50 104 50 110 Z M70 110 Q70 104 78 104 Q86 104 86 110 Z" fill="#5a3a1c" ${o(3)}/>
  <path d="M32 58 Q30 96 60 98 Q90 96 88 58 Q60 46 32 58 Z" fill="${GSKIN}" ${o()}/>
  <path d="M66 50 Q80 52 88 58 Q90 96 60 98 Q82 84 66 50 Z" fill="${GSKIN_D}"/>
  ${belly}
  <path d="M34 86 Q60 96 86 86 L84 98 Q60 104 36 98 Z" fill="currentColor" ${o(3)}/>
  <path d="M56 98 L54 108 L62 104 L66 108 L64 98" fill="currentColor" ${o(2.5)}/>`;

const giantHead = `
  <g class="u-head">
    <circle cx="60" cy="38" r="15" fill="${GSKIN}" ${o()}/>
    <path d="M44 30 Q44 16 60 16 Q76 16 76 30 L76 34 L44 34 Z" fill="${IRON}" ${o(3)}/>
    <path d="M60 16 Q76 16 76 30 L76 34 L66 34 Q70 22 60 16 Z" fill="${IRON_D}"/>
    <path d="M58 16 L58 34" stroke="${K}" stroke-width="2"/>
    <path d="M45 26 Q32 22 30 8 Q38 18 46 20 Z M75 26 Q88 22 90 8 Q82 18 74 20 Z" fill="#f6efe0" ${o(2.5)}/>
    <path d="M52 39 L56 40 M68 39 L64 40" stroke="${K}" stroke-width="3" stroke-linecap="round"/>
    <path d="M46 44 Q50 60 60 60 Q70 60 74 44 Q66 50 60 48 Q54 50 46 44 Z" fill="#b5652a" ${o(2.5)}/>
    <path d="M56 49 Q60 52 64 49" stroke="${K}" stroke-width="2" fill="none" stroke-linecap="round"/>
  </g>`;

const irongut = `
${shadow(28)}
<g class="u-rig">
  ${giantBody(`<path d="M42 64 Q60 58 78 64 Q82 80 60 86 Q38 80 42 64 Z" fill="${IRON}" ${o(3)}/>
  <path d="M60 60 Q74 60 78 64 Q82 80 60 86 Q72 74 60 60 Z" fill="${IRON_D}"/>
  <circle cx="48" cy="68" r="1.8" fill="${K}"/><circle cx="72" cy="68" r="1.8" fill="${K}"/><circle cx="50" cy="79" r="1.8" fill="${K}"/><circle cx="70" cy="79" r="1.8" fill="${K}"/>
  <path d="M50 64 Q56 62 60 63" stroke="#d6dbe0" stroke-width="2.5" fill="none" stroke-linecap="round"/>`)}
  <path d="M34 60 Q22 70 24 86" fill="none" stroke="${K}" stroke-width="15" stroke-linecap="round"/>
  <path d="M34 60 Q22 70 24 86" fill="none" stroke="${GSKIN}" stroke-width="10" stroke-linecap="round"/>
  <circle cx="24" cy="88" r="6.5" fill="${GSKIN}" ${o(3)}/>
  <g class="u-weapon" style="transform-origin: 84px 66px">
    <path d="M84 58 Q94 62 90 68" fill="none" stroke="${K}" stroke-width="15" stroke-linecap="round"/>
    <path d="M84 58 Q94 62 90 68" fill="none" stroke="${GSKIN}" stroke-width="10" stroke-linecap="round"/>
    <path d="M86 72 L104 18" stroke="${K}" stroke-width="10" stroke-linecap="round"/>
    <path d="M86 72 L104 18" stroke="#7a4a26" stroke-width="6" stroke-linecap="round"/>
    <path d="M96 40 Q92 22 104 6 Q118 14 114 34 Q108 44 96 40 Z" fill="#8a5a2b" ${o()}/>
    <path d="M104 6 Q118 14 114 34 Q110 40 104 41 Q112 22 104 6 Z" fill="#6b4524"/>
    <path d="M96 24 L88 22 M100 12 L94 6 M112 18 L120 14 M114 30 L122 32 M104 38 L104 46" stroke="${K}" stroke-width="4" stroke-linecap="round"/>
    <path d="M96 24 L90 22.5 M100 12 L95.5 7.5 M112 18 L118 15 M114 30 L120 31.5 M104 38 L104 44" stroke="${IRON}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="90" cy="68" r="7" fill="${GSKIN}" ${o(3)}/>
  </g>
  ${giantHead}
</g>`;

const belcher = `
${shadow(30)}
<g class="u-rig">
  ${giantBody(`<path d="M36 62 Q52 74 54 96" stroke="#6b3f1f" stroke-width="7" fill="none"/>
  <path d="M36 62 Q52 74 54 96" stroke="${K}" stroke-width="1.5" fill="none" opacity=".5"/>
  <circle cx="44" cy="70" r="4" fill="#3a3a40" ${o(2)}/><circle cx="50" cy="80" r="4" fill="#3a3a40" ${o(2)}/>`)}
  <path d="M34 60 Q24 70 28 84" fill="none" stroke="${K}" stroke-width="15" stroke-linecap="round"/>
  <path d="M34 60 Q24 70 28 84" fill="none" stroke="${GSKIN}" stroke-width="10" stroke-linecap="round"/>
  <g class="u-weapon" style="transform-origin: 60px 70px">
    <path d="M30 74 L96 60 L98 76 L34 86 Z" fill="#3a3a40" ${o()}/>
    <path d="M32 82 L97 70 L98 76 L34 86 Z" fill="#24242a"/>
    <path d="M36 72 L40 86 M58 67 L61 82 M78 63 L81 78" stroke="#8f969e" stroke-width="5"/>
    <path d="M36 72 L40 86 M58 67 L61 82 M78 63 L81 78" stroke="${K}" stroke-width="1.5" opacity=".6"/>
    <ellipse cx="98" cy="68" rx="6" ry="10" transform="rotate(-10 98 68)" fill="#4a4a52" ${o(3)}/>
    <ellipse cx="99" cy="68" rx="3" ry="6" transform="rotate(-10 99 68)" fill="${K}"/>
    <path d="M28 78 Q20 78 22 84 Q26 88 32 84" fill="#3a3a40" ${o(3)}/>
    <path d="M40 66 Q56 62 72 60" stroke="#c9cdd2" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/>
    <circle cx="62" cy="84" r="7" fill="${GSKIN}" ${o(3)}/>
    <circle cx="28" cy="84" r="6" fill="${GSKIN}" ${o(3)}/>
    <g class="u-fx">
      <path d="M104 66 L114 54 L114 62 L124 58 L116 68 L124 76 L113 74 L112 84 L104 72 Z" fill="#ffd23f" ${o(2.5)}/>
      <path d="M106 68 L112 62 L112 66 L118 66 L112 70 L114 76 L108 72 Z" fill="#fff6c8"/>
      <circle class="u-smoke" cx="110" cy="56" r="7" fill="#d8d2c6" ${o(2)}/>
      <circle class="u-smoke" cx="118" cy="48" r="5" fill="#d8d2c6" ${o(2)}/>
    </g>
  </g>
  ${giantHead}
</g>`;

const mammoth = `
<ellipse class="u-shadow" cx="58" cy="110" rx="44" ry="6" fill="#000" opacity=".22"/>
<g class="u-rig">
  <path d="M24 90 L22 108 M40 92 L40 108 M66 92 L66 108 M82 90 L84 108" stroke="${K}" stroke-width="15" stroke-linecap="round"/>
  <path d="M24 90 L22 108 M40 92 L40 108 M66 92 L66 108 M82 90 L84 108" stroke="#7a5030" stroke-width="10" stroke-linecap="round"/>
  <path d="M14 110 L30 110 M32 110 L48 110 M58 110 L74 110 M76 110 L92 110" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
  <path d="M12 80 Q6 50 30 34 Q58 18 84 32 Q100 42 98 66 Q96 90 72 96 Q46 100 26 96 Q14 92 12 80 Z" fill="#8a5a36" ${o()}/>
  <path d="M84 32 Q100 42 98 66 Q96 90 72 96 Q60 98 50 98 Q86 80 84 32 Z" fill="#6b4224"/>
  <path d="M18 70 Q14 82 20 90 M28 78 Q26 88 30 94 M44 82 Q44 90 46 96 M62 84 Q64 92 64 96" stroke="#5a361c" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M26 40 Q34 34 42 36 M50 28 Q58 26 66 28" stroke="#b5835a" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path d="M34 38 Q46 30 66 34 L70 60 Q50 64 30 58 Z" fill="currentColor" ${o(3)}/>
  <path d="M34 38 Q46 30 66 34 L67 40 Q48 36 35 44 Z" fill="#ffd23f" ${o(2)}/>
  <path d="M30 58 Q50 64 70 60 L70 64 Q50 68 30 62 Z" fill="#ffd23f" ${o(2)}/>
  <path d="M50 34 L50 10" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
  <path d="M50 34 L50 10" stroke="#7a4a26" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M51 10 Q60 6 66 12 Q72 16 78 12 L74 22 Q66 26 58 20 Q54 18 51 20 Z" fill="currentColor" ${o(2.5)}/>
  <g class="u-weapon u-head" style="transform-origin: 86px 50px">
    <path d="M78 34 Q96 24 108 40 Q116 54 110 70 Q106 80 108 92 Q110 100 104 102 Q98 100 100 92 Q98 82 94 74 Q84 70 78 60 Z" fill="#8a5a36" ${o()}/>
    <path d="M108 40 Q116 54 110 70 Q106 80 108 92 Q110 100 104 102 Q108 84 104 70 Q110 56 108 40 Z" fill="#6b4224"/>
    <path d="M102 82 L106 84 M101 88 L105 90" stroke="#5a361c" stroke-width="2" stroke-linecap="round"/>
    <path d="M78 40 Q70 46 74 56 Q80 54 82 46 Z" fill="#6b4224" ${o(2.5)}/>
    <circle cx="96" cy="46" r="3" fill="${K}"/><circle cx="97" cy="45" r="1" fill="#fff"/>
    <path d="M92 40 Q96 37 100 40" stroke="${K}" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M100 62 Q108 74 102 86 Q96 96 82 92 Q92 88 94 80 Q96 72 92 64 Z" fill="#f6efe0" ${o(3)}/>
    <path d="M100 66 Q104 76 100 84" stroke="#d9cfb6" stroke-width="2" fill="none"/>
    <path d="M86 26 Q90 22 96 26" stroke="#b5835a" stroke-width="3" fill="none" stroke-linecap="round"/>
  </g>
</g>`;


// ---------------------------------------------------------------- Bone Colossus
const colossus = `
${shadow(30)}
<g class="u-rig">
  ${bone('M48 84 L42 98 L40 108', 8)}${bone('M72 84 L78 98 L80 108', 8)}
  <path d="M30 110 L50 108 M70 108 L90 110" ${o(7)}/>
  <path d="M42 82 Q60 72 78 82 L76 90 Q60 84 44 90 Z" fill="currentColor" ${o()}/>
  ${bone('M60 82 L60 58', 7)}
  <path d="M36 44 Q60 34 84 44 Q86 66 60 74 Q34 66 36 44 Z" fill="${BONE}" ${o()}/>
  <path d="M42 50 Q60 44 78 50 M41 57 Q60 51 79 57 M44 64 Q60 58 76 64" fill="none" stroke="${K}" stroke-width="3" stroke-linecap="round"/>
  <path d="M60 40 L60 72" stroke="${BONE_SHADE}" stroke-width="4"/>
  ${bone('M38 46 L24 62 L20 80', 7)}
  <circle cx="19" cy="84" r="7" fill="${BONE}" ${o(3)}/>
  <g class="u-weapon" style="transform-origin: 86px 60px">
    ${bone('M82 46 L92 58 L94 66', 7)}
    <path d="M94 70 L108 14" stroke="${K}" stroke-width="12" stroke-linecap="round"/>
    <path d="M94 70 L108 14" stroke="${BONE}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="109" cy="12" r="9" fill="${BONE}" ${o(3)}/>
    <circle cx="101" cy="22" r="6" fill="${BONE}" ${o(3)}/>
    <circle cx="94" cy="68" r="7" fill="${BONE}" ${o(3)}/>
  </g>
  <g class="u-head">
    <path d="M42 26 Q42 4 60 4 Q78 4 78 26 Q78 34 72 37 L72 42 L48 42 L48 37 Q42 34 42 26 Z" fill="${BONE}" ${o()}/>
    <ellipse cx="53" cy="24" rx="5.5" ry="6.5" fill="${K}"/><ellipse cx="67" cy="24" rx="5.5" ry="6.5" fill="${K}"/>
    <circle cx="53" cy="24" r="2.6" fill="${GLOW}"/><circle cx="67" cy="24" r="2.6" fill="${GLOW}"/>
    <path d="M58 32 L60 29 L62 32 Z" fill="${K}"/>
    <path d="M50 38 L50 42 M55 38 L55 42 M60 38 L60 42 M65 38 L65 42 M70 38 L70 42" stroke="${K}" stroke-width="2"/>
    <path d="M44 14 L36 4 L46 9 Z M76 14 L84 4 L74 9 Z" fill="${BONE}" ${o(2.5)}/>
  </g>
</g>`;

// ---------------------------------------------------------------- Dwarves
const DSKIN = '#f2b98d';
const dwarfBody = (beard: string, tunic: string, extra = '') => `
  <path d="M48 92 L46 108 M72 92 L74 108" stroke="${K}" stroke-width="12" stroke-linecap="round"/>
  <path d="M48 92 L46 108 M72 92 L74 108" stroke="#5a3a1c" stroke-width="7" stroke-linecap="round"/>
  <path d="M38 110 Q38 104 46 104 Q54 104 54 110 Z M66 110 Q66 104 74 104 Q82 104 82 110 Z" fill="#3b2617" ${o(3)}/>
  <path d="M34 64 Q32 96 60 96 Q88 96 86 64 Q60 54 34 64 Z" fill="${tunic}" ${o()}/>
  <path d="M34 84 L86 84" stroke="#6b3f1f" stroke-width="6"/>
  <rect x="55" y="80" width="10" height="8" rx="1.5" fill="#ffd23f" ${o(2)}/>
  ${extra}
  <circle cx="60" cy="48" r="14" fill="${DSKIN}" ${o()}/>
  <path d="M44 50 Q42 80 60 84 Q78 80 76 50 Q70 58 60 58 Q50 58 44 50 Z" fill="${beard}" ${o(3)}/>
  <path d="M52 66 Q60 70 68 66 M50 74 Q60 78 70 74" stroke="${K}" stroke-width="1.5" fill="none" opacity=".35"/>
  <circle cx="55" cy="47" r="2" fill="${K}"/><circle cx="65" cy="47" r="2" fill="${K}"/>
  <ellipse cx="60" cy="53" rx="4" ry="3" fill="#e08f6a" ${o(1.5)}/>`;

const runepriest = `
${shadow(20)}
<g class="u-rig">
  ${dwarfBody('#f1efe6', '#3e6fb3', `<path d="M42 66 L52 92 M78 66 L68 92" stroke="#ffd23f" stroke-width="3"/>`)}
  <g class="u-head"><path d="M44 42 Q44 26 60 24 Q76 26 76 42 Z" fill="#3e6fb3" ${o(3)}/><path d="M46 40 L74 40" stroke="#ffd23f" stroke-width="3"/><circle cx="60" cy="30" r="3.5" fill="#7ff0ff" ${o(1.5)}/></g>
  <path d="M36 66 Q26 74 28 86" fill="none" stroke="${K}" stroke-width="11" stroke-linecap="round"/><path d="M36 66 Q26 74 28 86" fill="none" stroke="#3e6fb3" stroke-width="6" stroke-linecap="round"/>
  <g class="u-weapon" style="transform-origin: 86px 76px">
    <path d="M84 66 Q92 70 90 78" fill="none" stroke="${K}" stroke-width="11" stroke-linecap="round"/><path d="M84 66 Q92 70 90 78" fill="none" stroke="#3e6fb3" stroke-width="6" stroke-linecap="round"/>
    <path d="M92 108 L92 30" stroke="${K}" stroke-width="8" stroke-linecap="round"/><path d="M92 108 L92 30" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/>
    <rect x="80" y="14" width="24" height="20" rx="4" fill="#9ba3ab" ${o(3)}/>
    <path d="M86 20 L92 28 L98 20 M92 18 L92 30" stroke="#7ff0ff" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <circle cx="90" cy="78" r="5" fill="${DSKIN}" ${o(2.5)}/>
    <g class="u-fx"><circle cx="92" cy="24" r="18" fill="#7ff0ff" opacity=".45"/><path d="M92 2 L96 16 L110 14 L98 22 L106 34 L92 26 L78 34 L86 22 L74 14 L88 16 Z" fill="#c8faff" ${o(2)}/></g>
  </g>
</g>`;

const axedwarf = `
${shadow(20)}
<g class="u-rig">
  ${dwarfBody('#c4652a', '#3f8a4a', `<path d="M36 70 L84 70" stroke="#c94f3a" stroke-width="5"/><path d="M36 76 L84 76" stroke="#c94f3a" stroke-width="5" opacity=".6"/>`)}
  <g class="u-head"><path d="M44 44 Q42 28 60 26 Q78 28 76 44 Q70 38 60 38 Q50 38 44 44 Z" fill="#c94f3a" ${o(3)}/><circle cx="60" cy="24" r="4" fill="#fff" ${o(2)}/></g>
  <path d="M36 66 Q26 74 28 86" fill="none" stroke="${K}" stroke-width="11" stroke-linecap="round"/><path d="M36 66 Q26 74 28 86" fill="none" stroke="#3f8a4a" stroke-width="6" stroke-linecap="round"/>
  <g class="u-weapon" style="transform-origin: 84px 74px">
    <path d="M84 66 Q92 70 88 76" fill="none" stroke="${K}" stroke-width="11" stroke-linecap="round"/><path d="M84 66 Q92 70 88 76" fill="none" stroke="#3f8a4a" stroke-width="6" stroke-linecap="round"/>
    <path d="M86 78 L104 26" stroke="${K}" stroke-width="8" stroke-linecap="round"/><path d="M86 78 L104 26" stroke="#8a5a2b" stroke-width="4" stroke-linecap="round"/>
    <path d="M98 30 Q90 18 100 10 L114 22 Q110 34 98 30 Z" fill="#c9cdd2" ${o(3)}/>
    <path d="M102 14 L112 24" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="88" cy="76" r="5" fill="${DSKIN}" ${o(2.5)}/>
  </g>
</g>`;

const thunderer = `
${shadow(20)}
<g class="u-rig">
  ${dwarfBody('#8a8f96', '#7a3b2e', `<path d="M40 68 L80 92 M80 68 L40 92" stroke="#3b2617" stroke-width="4"/><circle cx="48" cy="74" r="3" fill="#ffd23f" ${o(1.5)}/><circle cx="72" cy="74" r="3" fill="#ffd23f" ${o(1.5)}/>`)}
  <g class="u-head"><path d="M44 44 Q44 28 60 27 Q76 28 76 44 Z" fill="#9ba3ab" ${o(3)}/><path d="M42 44 L78 44" stroke="${K}" stroke-width="6" stroke-linecap="round"/><path d="M42 44 L78 44" stroke="#c9cdd2" stroke-width="3" stroke-linecap="round"/><path d="M60 27 L60 18" stroke="${K}" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="17" r="4" fill="#ffd23f" ${o(2)}/></g>
  <g class="u-weapon" style="transform-origin: 70px 74px">
    <path d="M36 66 Q34 78 46 80" fill="none" stroke="${K}" stroke-width="11" stroke-linecap="round"/><path d="M36 66 Q34 78 46 80" fill="none" stroke="#7a3b2e" stroke-width="6" stroke-linecap="round"/>
    <path d="M40 86 L54 74 L60 78 L46 92 Z" fill="#8a5a2b" ${o(3)}/>
    <path d="M54 76 L112 52" stroke="${K}" stroke-width="10" stroke-linecap="round"/><path d="M54 76 L112 52" stroke="#5e6670" stroke-width="5.5" stroke-linecap="round"/>
    <path d="M60 73 L84 63" stroke="#c9cdd2" stroke-width="2" stroke-linecap="round"/>
    <circle cx="46" cy="80" r="5" fill="${DSKIN}" ${o(2.5)}/>
    <path d="M84 66 Q90 72 80 76" fill="none" stroke="${K}" stroke-width="11" stroke-linecap="round"/><path d="M84 66 Q90 72 80 76" fill="none" stroke="#7a3b2e" stroke-width="6" stroke-linecap="round"/>
    <circle cx="80" cy="66" r="5" fill="${DSKIN}" ${o(2.5)}/>
    <g class="u-fx"><circle cx="116" cy="50" r="10" fill="#ffd23f" opacity=".85"/><path d="M116 36 L119 46 L130 44 L121 51 L128 60 L117 55 L110 64 L111 53 L100 50 L111 47 Z" fill="#fff2a8" ${o(2)}/><circle cx="104" cy="40" r="5" fill="#e6e2da" opacity=".8"/></g>
  </g>
</g>`;

const wall = `
${shadow(34)}
<g class="u-rig">
  <path d="M14 108 L14 52 L26 52 L26 60 L38 60 L38 52 L50 52 L50 60 L62 60 L62 52 L74 52 L74 60 L86 60 L86 52 L98 52 L98 60 L106 60 L106 108 Z" fill="#b3a998" ${o()}/>
  <path d="M14 72 L106 72 M14 90 L106 90 M34 60 L34 72 M60 72 L60 90 M84 60 L84 72 M40 90 L40 108 M80 90 L80 108" stroke="#7d7466" stroke-width="3.5"/>
  <path d="M86 52 L98 52 L98 108 L106 108 L106 60 Z" fill="#8f8577" opacity=".6"/>
  <path d="M20 66 Q26 62 30 66" stroke="#ddd5c6" stroke-width="3" fill="none" stroke-linecap="round"/>
  <path d="M46 34 L46 52" stroke="${K}" stroke-width="5" stroke-linecap="round"/><path d="M47 34 L66 40 L47 46 Z" fill="currentColor" ${o(3)}/>
</g>`;

// Siege engine: a covered battering ram on wheels, built by every faction.
const siege = `
${shadow(36)}
<g class="u-rig">
  <path d="M22 96 L98 96" stroke="${K}" stroke-width="10" stroke-linecap="round"/>
  <path d="M22 96 L98 96" stroke="#7a4a26" stroke-width="5" stroke-linecap="round"/>
  <path d="M28 94 L44 50 L76 50 L92 94" fill="none" stroke="${K}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M28 94 L44 50 L76 50 L92 94" fill="none" stroke="#9a6534" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="M36 52 L60 30 L84 52 Z" fill="#b97a3e" ${o()}/>
  <path d="M42 50 L60 34 M50 51 L64 38 M60 51 L70 42 M70 51 L76 46" stroke="#8a5a2b" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M60 30 L60 14" stroke="${K}" stroke-width="5" stroke-linecap="round"/>
  <path d="M61 14 L78 19 L61 25 Z" fill="currentColor" ${o(3)}/>
  <path d="M50 52 L50 66 M70 52 L70 66" stroke="${K}" stroke-width="3" stroke-linecap="round"/>
  <g class="u-weapon" style="transform-origin: 60px 60px">
    <rect x="26" y="64" width="64" height="12" rx="6" fill="#8a5a2b" ${o()}/>
    <path d="M32 68 L84 68" stroke="#a8743f" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M88 61 L104 63 L106 70 L104 77 L88 79 Z" fill="${IRON}" ${o()}/>
    <path d="M92 64 L101 65" stroke="#c9ced3" stroke-width="2.5" stroke-linecap="round"/>
  </g>
  <circle cx="34" cy="98" r="11" fill="#9a6534" ${o()}/><circle cx="34" cy="98" r="3.5" fill="${K}"/>
  <circle cx="86" cy="98" r="11" fill="#9a6534" ${o()}/><circle cx="86" cy="98" r="3.5" fill="${K}"/>
  <path d="M34 89 L34 107 M25 98 L43 98 M86 89 L86 107 M77 98 L95 98" stroke="${K}" stroke-width="2.2" opacity=".6"/>
</g>`;

// ---------------------------------------------------------------- Neutral
const wildling = `
${shadow(20)}
<g class="u-rig">
  <path d="M53 86 L50 106 M67 86 L70 106" stroke="${K}" stroke-width="9" stroke-linecap="round"/>
  <path d="M53 86 L50 106 M67 86 L70 106" stroke="#5a3a1c" stroke-width="5" stroke-linecap="round"/>
  <path d="M38 96 Q34 66 46 56 L74 56 Q86 66 82 96 Q60 102 38 96 Z" fill="#8a6a48" ${o()}/>
  <path d="M66 56 L74 56 Q86 66 82 96 Q76 98 70 99 Q76 78 66 56 Z" fill="#6d5236"/>
  <path d="M40 90 L44 98 L48 90 L52 98 L56 90 L60 98 L64 90 L68 98 L72 90 L76 98 L80 90" fill="none" stroke="#d8c3a0" stroke-width="3" stroke-linejoin="round"/>
  <path d="M42 62 Q32 70 32 82" fill="none" stroke="${K}" stroke-width="11" stroke-linecap="round"/>
  <path d="M42 62 Q32 70 32 82" fill="none" stroke="#8a6a48" stroke-width="6" stroke-linecap="round"/>
  <circle cx="32" cy="84" r="4.5" fill="#e0b48a" ${o(2.5)}/>
  <g class="u-weapon" style="transform-origin: 84px 70px">
    <path d="M78 62 Q86 66 86 72" fill="none" stroke="${K}" stroke-width="11" stroke-linecap="round"/>
    <path d="M78 62 Q86 66 86 72" fill="none" stroke="#8a6a48" stroke-width="6" stroke-linecap="round"/>
    <path d="M86 74 L100 34" stroke="${K}" stroke-width="9" stroke-linecap="round"/>
    <path d="M86 74 L100 34" stroke="#7a4a26" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="101" cy="32" rx="7" ry="10" transform="rotate(20 101 32)" fill="#8a5a2b" ${o(3)}/>
    <circle cx="86" cy="74" r="4.5" fill="#e0b48a" ${o(2.5)}/>
  </g>
  <g class="u-head">
    <circle cx="60" cy="44" r="12" fill="#e0b48a" ${o()}/>
    <circle cx="56" cy="45" r="2" fill="${K}"/><circle cx="65" cy="45" r="2" fill="${K}"/>
    <path d="M55 52 Q60 49 65 52" stroke="${K}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M44 48 Q42 22 60 20 Q78 22 76 48 Q70 34 60 34 Q50 34 44 48 Z" fill="#6d5236" ${o(3)}/>
    <path d="M46 30 L40 12 L54 24 Z M74 30 L80 12 L66 24 Z" fill="#6d5236" ${o(3)}/>
    <path d="M45 26 L42 17 L50 23 Z M75 26 L78 17 L70 23 Z" fill="#c9a37a"/>
    <circle cx="54" cy="28" r="2" fill="#ffd23f"/><circle cx="66" cy="28" r="2" fill="#ffd23f"/>
    <path d="M56 32 L60 35 L64 32" fill="#f6efe0" ${o(1.5)}/>
  </g>
</g>`;

const ART: Record<UnitId, string> = { skeleton, lich, priest, colossus, archer, druid, treant, irongut, belcher, mammoth, axedwarf, runepriest, thunderer, wildling, wall, siege };
const STYLE: Record<UnitId, AttackStyle> = {
  skeleton: 'swing', lich: 'cast', priest: 'cast', colossus: 'swing', archer: 'shoot', druid: 'cast', treant: 'swing',
  irongut: 'swing', belcher: 'cannon', mammoth: 'stomp', axedwarf: 'swing', runepriest: 'cast', thunderer: 'cannon', wildling: 'swing', wall: 'stomp', siege: 'stomp',
};
/** Size relative to the 120px box. Giants tower over everyone, the mammoth most of all. */
export const UNIT_SCALE: Record<UnitId, number> = {
  skeleton: 0.74, lich: 0.8, priest: 0.84, archer: 0.74, druid: 0.8, treant: 1.0,
  irongut: 1.08, belcher: 1.1, mammoth: 1.32, wildling: 0.74,
  colossus: 1.12, axedwarf: 0.62, runepriest: 0.66, thunderer: 0.7, wall: 0.95, siege: 0.86,
};

const scaled = (id: UnitId) => {
  const k = UNIT_SCALE[id];
  return `<g transform="translate(60 112) scale(${k}) translate(-60 -112)">${ART[id]}</g>`;
};

export const UNITS: Record<UnitId, UnitSprite> = Object.fromEntries(
  (Object.keys(ART) as UnitId[]).map((id) => {
    const st = UNIT_STATS[id];
    return [id, { id, name: st.name, faction: st.faction, tier: st.tier, attack: st.attack, defense: st.defense, hp: st.hp, style: STYLE[id], art: scaled(id) }];
  }),
) as Record<UnitId, UnitSprite>;

export const UNIT_ORDER: UnitId[] = ['skeleton', 'lich', 'priest', 'colossus', 'archer', 'druid', 'treant', 'irongut', 'belcher', 'mammoth', 'axedwarf', 'runepriest', 'thunderer', 'siege', 'wildling', 'wall'];

export const TRIM: Record<UnitSprite['faction'], string> = { necro: '#8e4fc4', elves: '#f0b928', giants: '#e0452f', neutral: '#b9a88f', dwarves: '#3e6fb3' };

/** Standalone <svg> for a unit. */
export function unitSvg(id: UnitId, cls = ''): string {
  const u = UNITS[id];
  return `<svg class="sprite s-${u.style} ${cls}" data-unit="${id}" viewBox="0 0 120 120" style="color:${TRIM[u.faction]}" role="img" aria-label="${u.name}">${u.art}</svg>`;
}

/** <symbol> definitions for the map (static, no animation). */
export function unitSymbols(): string {
  return UNIT_ORDER.map((id) => `<symbol id="unit-${id}" viewBox="0 0 120 120" overflow="visible">${UNITS[id].art}</symbol>`).join('');
}

/** Plays an animation on a sprite element. Resolves when it ends. */
export function playUnit(el: Element, anim: 'attack' | 'hit' | 'die' | 'idle'): Promise<void> {
  el.classList.remove('a-attack', 'a-hit', 'a-die');
  if (anim === 'idle') return Promise.resolve();
  void (el as HTMLElement).getBoundingClientRect();
  el.classList.add(`a-${anim}`);
  const ms = anim === 'die' ? 900 : anim === 'hit' ? 450 : 700;
  return new Promise((r) => setTimeout(() => { if (anim !== 'die') el.classList.remove(`a-${anim}`); r(); }, ms));
}
