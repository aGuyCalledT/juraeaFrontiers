import type { FactionId, Terrain } from './types';

export interface FactionDef {
  id: FactionId;
  name: string;
  short: string;
  people: string;
  quote: string;
  resource: string;
  resourceTerrain: Terrain;
  color: string;
  dark: string;
  light: string;
  accent: string;
  units: { infantry: string; cavalry: string; special: string };
  passive: { name: string; text: string };
  ability: { name: string; cost: number; text: string; verb: string };
}

// Names and units come from Faction.java and src/main/resources/data/*.json.
export const FACTIONS: Record<FactionId, FactionDef> = {
  necro: {
    id: 'necro',
    name: 'The Death Cults',
    short: 'Death Cults',
    people: 'Necromancers',
    quote: 'What is dead may never die! Blessed be Solomon.',
    resource: 'Souls',
    resourceTerrain: 'desert',
    color: '#8e4fc4',
    dark: '#4a2370',
    light: '#c9a2ee',
    accent: '#8dff5a',
    units: { infantry: 'Skeletons', cavalry: 'Death Knights', special: 'Death Priest' },
    passive: {
      name: 'Undead Army',
      text: 'Conquering a rival faction’s hex raises +1 skeleton. Each faction soldier slain gives 1 Soul.',
    },
    ability: {
      name: 'Raise the Fallen',
      cost: 5,
      text: '+2 skeletons on one of your hexes.',
      verb: 'Pick one of your hexes to raise the dead',
    },
  },
  elves: {
    id: 'elves',
    name: 'Evergarden',
    short: 'Evergarden',
    people: 'Elves',
    quote: 'We do not conquer the land; we grow with it.',
    resource: 'Mana',
    resourceTerrain: 'forest',
    color: '#f0b928',
    dark: '#8a5b08',
    light: '#ffe48a',
    accent: '#5fd35a',
    units: { infantry: 'Warriors', cavalry: 'Eagle Riders', special: 'Wizard' },
    passive: {
      name: 'Forest Wardens',
      text: '+1 to your best die when attacking from or defending in a forest.',
    },
    ability: {
      name: 'Overgrowth',
      cost: 3,
      text: 'Turn a plains or desert hex you own (or next to you) into forest. If it is yours, +1 warrior.',
      verb: 'Pick a plains or desert hex to overgrow',
    },
  },
  giants: {
    id: 'giants',
    name: 'The Giants',
    short: 'Giants',
    people: 'Giants',
    quote: 'This land was gifted to the children of Mammon.',
    resource: 'Ore',
    resourceTerrain: 'mountain',
    color: '#e0452f',
    dark: '#7c1a10',
    light: '#ffab96',
    accent: '#ffb02e',
    units: { infantry: 'Iron Guts', cavalry: 'Horn Riders', special: 'Shaman' },
    passive: {
      name: 'Colossi',
      text: '+1 to your best die when attacking from a mountain, and when attacking or defending with 5+ troops.',
    },
    ability: {
      name: 'Stronghold',
      cost: 3,
      text: 'Fortify one of your hexes: defenders there roll 3 dice, +2 iron guts move in.',
      verb: 'Pick one of your hexes to fortify',
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

export const COSTS = { troop: 3, champion: 7 };

export const TERRAIN_INFO: Record<Terrain, { name: string; text: string }> = {
  plains: { name: 'Plains', text: '+1 Gold per turn.' },
  forest: { name: 'Forest', text: '+1 Mana for Evergarden.' },
  mountain: { name: 'Mountains', text: 'Defender +1 on best die. +1 Ore for Giants.' },
  desert: { name: 'Desert', text: '+1 Soul for the Death Cults.' },
  water: { name: 'Sea', text: 'Impassable.' },
};

export function ownerColor(owner: string | null): string {
  if (!owner || owner === 'neutral') return NEUTRAL.color;
  return FACTIONS[owner as FactionId].color;
}
