import type { FactionId, Terrain } from './types';

export interface FactionDef {
  id: FactionId;
  name: string;
  short: string;
  people: string;
  quote: string;
  color: string;
  dark: string;
  light: string;
  accent: string;
  passive: { name: string; text: string };
}

// Names and units come from Faction.java and src/main/resources/data/*.json.
export const FACTIONS: Record<FactionId, FactionDef> = {
  necro: {
    id: 'necro',
    name: 'The Death Cults',
    short: 'Death Cults',
    people: 'Necromancers',
    quote: 'What is dead may never die! Blessed be Solomon.',
    color: '#8e4fc4',
    dark: '#4a2370',
    light: '#c9a2ee',
    accent: '#8dff5a',
    passive: {
      name: 'Undead Army',
      text: 'After every fight, each fallen unit (friend or foe) rolls a die: every 6 rises as a skeleton.',
    },
  },
  elves: {
    id: 'elves',
    name: 'Evergarden',
    short: 'Evergarden',
    people: 'Elves',
    quote: 'We do not conquer the land; we grow with it.',
    color: '#f0b928',
    dark: '#8a5b08',
    light: '#ffe48a',
    accent: '#5fd35a',
    passive: {
      name: 'Forest Wardens',
      text: 'Forest grows on every plains or desert hex they claim. +1 defence in forests.',
    },
  },
  giants: {
    id: 'giants',
    name: 'The Giants',
    short: 'Giants',
    people: 'Giants',
    quote: 'This land was gifted to the children of Mammon.',
    color: '#e0452f',
    dark: '#7c1a10',
    light: '#ffab96',
    accent: '#ffb02e',
    passive: {
      name: 'Colossi',
      text: 'Much stronger units, but every unit and building costs twice as much.',
    },
  },
};

export const NEUTRAL = {
  name: 'Wildlands',
  color: '#b9a88f',
  dark: '#6b5a45',
  light: '#e6dac6',
};

export const FACTION_ORDER: FactionId[] = ['necro', 'elves', 'giants'];

export const TERRAIN_INFO: Record<Terrain, { name: string; text: string }> = {
  plains: { name: 'Plains', text: 'Move 1 · +1 gold.' },
  forest: { name: 'Forest', text: 'Move 2 · +1 gold per 2 forests.' },
  mountain: { name: 'Mountains', text: 'Move 3 · +1 gold · defenders +1.' },
  peak: { name: 'High peak', text: 'Impassable.' },
  desert: { name: 'Desert', text: 'Move 1 · no gold.' },
  water: { name: 'Sea', text: 'Impassable.' },
};

export function ownerColor(owner: string | null): string {
  if (!owner || owner === 'neutral') return NEUTRAL.color;
  return FACTIONS[owner as FactionId].color;
}
