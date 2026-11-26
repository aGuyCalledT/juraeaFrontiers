import type { FactionId } from './types';

export type UnitType =
  | 'skeleton' | 'lich' | 'priest' | 'colossus'
  | 'archer' | 'druid' | 'treant'
  | 'irongut' | 'belcher' | 'mammoth'
  | 'runepriest' | 'woodcutter' | 'slayer'
  | 'wildling' | 'wall' | 'siege';

export interface UnitStats {
  type: UnitType;
  name: string;
  plural: string;
  faction: FactionId | 'neutral' | 'dwarves';
  tier: 1 | 2 | 3;
  /** Dwarves: +2 attack and defence against this faction. */
  counters?: FactionId;
  attack: number;
  defense: number;
  hp: number;
  ability?: string;
  /** Does not roll in fights (siege engines). */
  noDice?: boolean;
}

export const UNIT_STATS: Record<UnitType, UnitStats> = {
  skeleton: { type: 'skeleton', name: 'Skeleton', plural: 'Skeletons', faction: 'necro', tier: 1, attack: 0, defense: 0, hp: 1 },
  lich: { type: 'lich', name: 'Lich', plural: 'Liches', faction: 'necro', tier: 2, attack: 3, defense: 0, hp: 1 },
  priest: {
    type: 'priest', name: 'Death Priest', plural: 'Death Priests', faction: 'necro', tier: 3, attack: 1, defense: 1, hp: 2,
    ability: 'Adds 3 raising rolls per priest after a fight (1 per fallen unit if fewer than 3 died).',
  },
  archer: { type: 'archer', name: 'Elven Archer', plural: 'Elven Archers', faction: 'elves', tier: 1, attack: 1, defense: 0, hp: 1 },
  druid: {
    type: 'druid', name: 'Druid', plural: 'Druids', faction: 'elves', tier: 2, attack: 1, defense: 1, hp: 2,
    ability: 'Each turn, heals 1 HP on the best wounded unit in its army.',
  },
  treant: {
    type: 'treant', name: 'Treant', plural: 'Treants', faction: 'elves', tier: 3, attack: 2, defense: 3, hp: 2,
    ability: 'Awakens in any enchanted forest; the forest becomes plains.',
  },
  irongut: { type: 'irongut', name: 'Iron Gut', plural: 'Iron Guts', faction: 'giants', tier: 1, attack: 2, defense: 0, hp: 2 },
  belcher: {
    type: 'belcher', name: 'Lead Belcher', plural: 'Lead Belchers', faction: 'giants', tier: 2, attack: 2, defense: 0, hp: 2,
    ability: 'Attacking or defending (even against Arrow Rain): on a 6 the cannon fires again; 4+ wounds the weakest enemy before the exchange, another 6 fires once more.',
  },
  mammoth: {
    type: 'mammoth', name: 'Mammoth', plural: 'Mammoths', faction: 'giants', tier: 3, attack: 2, defense: 4, hp: 2,
    ability: 'Each turn, heals 1 HP on the best wounded non-mammoth unit in its army.',
  },
  colossus: {
    type: 'colossus', name: 'Bone Colossus', plural: 'Bone Colossi', faction: 'necro', tier: 3, attack: 3, defense: 1, hp: 3,
    ability: 'Built by the Death Cults’ spell from three skeletons.',
  },
  runepriest: {
    type: 'runepriest', name: 'Rune Priest', plural: 'Rune Priests', faction: 'dwarves', tier: 2, attack: 1, defense: 1, hp: 2, counters: 'necro',
    ability: 'Dwarf mercenary. +2 attack and defence against the Death Cults.',
  },
  woodcutter: {
    type: 'woodcutter', name: 'Woodcutter', plural: 'Woodcutters', faction: 'dwarves', tier: 2, attack: 1, defense: 1, hp: 2, counters: 'elves',
    ability: 'Dwarf mercenary. +2 attack and defence against Evergarden.',
  },
  slayer: {
    type: 'slayer', name: 'Giant Slayer', plural: 'Giant Slayers', faction: 'dwarves', tier: 2, attack: 1, defense: 1, hp: 2, counters: 'giants',
    ability: 'Dwarf mercenary. +2 attack and defence against the Giants.',
  },
  wildling: { type: 'wildling', name: 'Wildling', plural: 'Wildlings', faction: 'neutral', tier: 1, attack: 0, defense: 1, hp: 1 },
  siege: {
    type: 'siege', name: 'Siege Engine', plural: 'Siege Engines', faction: 'neutral', tier: 1, attack: 0, defense: 0, hp: 1, noDice: true,
    ability: 'Travels with an army and lowers the defence of the region it attacks by 1 (several do not stack). Does not fight; takes hits after all tier-1 units.',
  },
  wall: {
    type: 'wall', name: 'Stone Wall', plural: 'Stone Walls', faction: 'giants', tier: 1, attack: 0, defense: 4, hp: 2,
    ability: 'Blocks everyone but the Giants; Giant armies standing in its region are entrenched (+1 defence). Never strikes back; attacking it uses up all movement.',
  },
};

export const DWARF_UNITS: UnitType[] = ['runepriest', 'woodcutter', 'slayer'];
export const DWARF_COST = 6; // for the side that found the fortress
export const DWARF_COST_OTHERS = 9;
/** Tunable numbers for the necromancers' raising (kept in one object for balance runs). */
export const RAISE = { on: 6, priestRolls: 3 };
export const SPELL_COOLDOWN = 3;
export const ENCHANTED_GOLD = 2; // Evergarden: gold per enchanted forest
export const WALL_HP = 2; // +1 for every 10 rounds played
export function wallHp(turn: number): number { return WALL_HP + Math.floor(turn / 10); }

export const SPELLS: Record<FactionId, { name: string; text: string }> = {
  necro: { name: 'Bone Colossus', text: 'Fuse 3 skeletons of one army into a Bone Colossus (tier 3).' },
  elves: { name: 'Arrow Rain', text: 'The archers of one army shoot an adjacent enemy army. The enemy cannot strike back.' },
  giants: { name: 'Stone Wall', text: 'Raise a wall on an empty region next to a Giant army. Only Giants can pass it; Giants standing there get +1 defence.' },
};

export const FACTION_UNITS: Record<FactionId, [UnitType, UnitType, UnitType]> = {
  necro: ['skeleton', 'lich', 'priest'],
  elves: ['archer', 'druid', 'treant'],
  giants: ['irongut', 'belcher', 'mammoth'],
};

const TIER_COST = { 1: 3, 2: 6, 3: 9 } as const;

export function unitCost(type: UnitType): number {
  const s = UNIT_STATS[type];
  if (s.faction === 'dwarves') return DWARF_COST;
  if (type === 'colossus' || type === 'wall') return 0;
  if (type === 'siege') return SIEGE_COST;
  return TIER_COST[s.tier] * (s.faction === 'giants' ? 2 : 1);
}

export function baseCost(f: FactionId): number {
  return unitCost(FACTION_UNITS[f][0]);
}

/** Gold back when a unit is dismissed: a third of its price. */
export function refund(type: UnitType): number {
  if (type === 'colossus') return 3;
  return Math.floor(unitCost(type) / 3);
}

/** Gold for killing a unit: tier 3 units and wildlings give 1. */
export function bounty(type: UnitType): number {
  const s = UNIT_STATS[type];
  return (s.tier === 3 || s.faction === 'neutral') && type !== 'wall' && type !== 'siege' ? 1 : 0;
}

export const IMPROVE_COST = [3, 6] as const; // level 1, level 2 (the same for everyone)
export const MAX_IMPROVE = 2;
export const ARMY_FREE_SIZE = 8; // every unit above this costs 1 gold per turn
export const START_GOLD = 10;
export const CITY_COST = (f: FactionId) => baseCost(f) * 3;
export const UPGRADE_COST = (f: FactionId) => baseCost(f) * 2;
export const MAX_CITY_LEVEL = 3;
export const MOVE_POINTS = 3;
export const NO_CITY_LIMIT = 3;

/** Siege engines can be built by every faction. */
export const SIEGE_COST = 4;
export function siegeCost(f: FactionId): number { return SIEGE_COST * (f === 'giants' ? 2 : 1); }
/** Order in which hits land: tier 1, then siege engines, then tier 2 and 3. */
export function hitRank(type: UnitType): number { return type === 'siege' ? 1.5 : UNIT_STATS[type].tier; }
/** Enemy attacks a city may suffer per round. */
export const CITY_ASSAULTS = 2;
/** Gold looted when razing a city, per level (level 0 counts as 1). */
export const RAZE_GOLD = 3;
/** Cities start at level 1; the garrison has the city's level as its tier. */
export function garrisonTier(level: number, capital = false): 1 | 2 | 3 { return Math.max(1, Math.min(3, level + (capital ? CITY_TUNE.capitalGuard : 0))) as 1 | 2 | 3; }
/** City defence numbers (one object so balance runs can change them). */
export const CITY_TUNE = { cityDef: 1, capitalDef: 2, capitalGuard: 1 };
/** Evergarden cities grow enchanted forest up to this many regions away (1 = neighbouring regions). */
export const GROW_RANGE = 1;
