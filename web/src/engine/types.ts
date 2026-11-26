import type { UnitType } from './unitstats';

export type FactionId = 'necro' | 'elves' | 'giants';
export type Owner = FactionId | 'neutral';
export type Terrain = 'plains' | 'forest' | 'mountain' | 'peak' | 'desert' | 'water';
export type Phase = 'play' | 'over';
export type SlotKind = 'human' | 'ai' | 'off';

export interface Tile {
  id: number;
  q: number;
  r: number;
  terrain: Terrain;
  region: number; // -1 for water
  /** Last side that stood here (null = nobody yet, also for water). */
  owner: Owner | null;
  enchanted: boolean;
  /** Improvement level 0..2, each +1 gold per turn. */
  improved: number;
  /** Necromancers blighted this forest: move cost 1, no elven bonus. */
  corrupted: boolean;
  deco: number;
}

export interface Unit {
  id: number;
  type: UnitType;
  hp: number;
}

export interface Army {
  id: number;
  owner: Owner;
  tile: number;
  units: Unit[];
  mp: number;
  attacked: boolean;
  /** Could not pay upkeep: -1 attack and defence until upkeep is paid again. */
  lowMorale: boolean;
}

export interface City {
  /** Anchor hex of the city's region. */
  tile: number;
  owner: FactionId;
  /** 1..3; the hidden garrison has this tier. */
  level: number;
  capital: boolean;
  /** Attacks suffered since the start of the current player's turn (max 2). */
  assaults: number;
  /** Evergarden: this city already grew an enchanted forest this round. */
  grew: boolean;
}

export interface Build {
  tile: number;
  owner: FactionId;
  kind: 'city' | 'upgrade' | 'improve';
  turnsLeft: number;
}

/** A fight waiting for the attacker to fight another round or retreat. */
export interface PendingFight {
  army: number;
  target: number;
  round: number;
  /** Fallen skeletons and other fallen units (two skeletons count as one for raising). */
  skelDeaths: number;
  otherDeaths: number;
  necroPriests: number;
  /** Hidden city garrison, if the target is a city. */
  garrison: Unit | null;
}

/** An enemy city has fallen: the attacker decides to take or raze it. */
export interface PendingCity {
  army: number;
  city: number;
}

/** 2-4 hexes that act as one field. All its hexes share terrain and owner. */
export interface Region {
  id: number;
  name: string;
  tiles: number[];
  /** The hex where armies, cities and markers stand; also the region's id in actions. */
  anchor: number;
}

export interface PlayerState {
  faction: FactionId;
  kind: 'human' | 'ai';
  /** online: client id controlling this slot ('' = local) */
  controller: string;
  name: string;
  alive: boolean;
  gold: number;
  /** consecutive own turns started without a city */
  noCity: number;
  /** Own turns until the faction spell is ready (0 = ready). */
  spell: number;
  kills: number;
  /** Running totals for the end-of-game report (playtesting and balance). */
  stats: PlayerStats;
}

export interface PlayerStats {
  income: number;
  loot: number;
  upkeep: number;
  spentUnits: number;
  spentBuild: number;
  recruited: number;
  hired: number;
  lost: number;
  spells: number;
  terraformed: number;
  peakUnits: number;
  peakCities: number;
  peakTiles: number;
  /** Round in which the faction fell; 0 while alive. */
  fell: number;
}

export interface GameSetup {
  seed: number;
  size: 'small' | 'medium' | 'large';
  slots: { faction: FactionId; kind: SlotKind; name: string; controller: string }[];
}

export interface GameState {
  version: 6;
  setup: GameSetup;
  rng: number;
  radius: number;
  tiles: Tile[];
  regions: Region[];
  armies: Army[];
  cities: City[];
  builds: Build[];
  players: PlayerState[]; // turn order
  current: number;
  phase: Phase;
  turn: number;
  nextId: number;
  winner: FactionId | null;
  actionCount: number;
  pendingFight: PendingFight | null;
  pendingCity: PendingCity | null;
  fortresses: { tile: number; discovered: boolean; finder?: FactionId | null }[];
  walls: { tile: number; hp: number }[];
}

export type Action =
  | { type: 'move'; p: FactionId; army: number; path: number[] }
  | { type: 'attack'; p: FactionId; army: number; target: number }
  | { type: 'split'; p: FactionId; army: number; units: number[] }
  | { type: 'merge'; p: FactionId; tile: number }
  | { type: 'recruit'; p: FactionId; city: number; unit: UnitType; at?: number }
  | { type: 'hire'; p: FactionId; fortress: number; unit: UnitType; army: number }
  | { type: 'terraform'; p: FactionId; army: number; target: number }
  | { type: 'spell'; p: FactionId; army: number; target?: number }
  | { type: 'build'; p: FactionId; army: number }
  | { type: 'upgrade'; p: FactionId; city: number }
  | { type: 'grow'; p: FactionId; city: number; tile: number }
  | { type: 'improve'; p: FactionId; tile: number }
  | { type: 'cityChoice'; p: FactionId; choice: 'take' | 'raze' }
  | { type: 'dismiss'; p: FactionId; army: number; units: number[] }
  | { type: 'fight'; p: FactionId; choice: 'continue' | 'retreat' }
  | { type: 'endTurn'; p: FactionId };

export interface CombatDie {
  unit: number; // unit id
  type: UnitType;
  roll: number;
  bonus: number;
  total: number;
  /** removed before the comparison (died to a cannon shot) */
  void?: boolean;
}

export interface CannonShot {
  side: 'att' | 'def';
  shooter: number; // unit id
  rolls: number[]; // each extra roll; >= 4 hits
  hits: number[]; // unit ids wounded, in order
}

export interface CombatPair {
  att: number; // unit id
  def: number;
  winner: 'att' | 'def';
  victim: number; // unit id that took the hit
}

export interface RaiseResult {
  rolls: number[];
  priestRolls: number; // how many of the rolls came from death priests (the last ones)
  raised: number;
  army: number;
}

export interface CombatEvent {
  type: 'combat';
  p: FactionId;
  attacker: { army: number; tile: number; owner: Owner; units: Unit[] };
  defender: { armies: number[]; tile: number; owner: Owner; units: Unit[] };
  attDice: CombatDie[];
  defDice: CombatDie[];
  shots: CannonShot[];
  pairs: CombatPair[];
  dead: number[]; // unit ids
  raise: RaiseResult | null;
  defenderWiped: boolean;
  attackerWiped: boolean;
  /** Arrow Rain: only the defenders can be hurt. */
  volley?: boolean;
  /** The defender is a Stone Wall. */
  wall?: boolean;
  /** Id of the hidden city garrison among the defenders. */
  garrison?: number;
  terrainBonus: string[];
  attackMods: string[];
  round: number;
  /** True when the fight is over after this round (a side was wiped out). */
  final: boolean;
  bounty: { att: number; def: number };
}

export type GameEvent =
  | { type: 'moved'; p: FactionId; army: number; path: number[]; captured: number[] }
  | CombatEvent
  | { type: 'split'; p: FactionId; army: number; newArmy: number; tile: number }
  | { type: 'merged'; p: FactionId; army: number; tile: number }
  | { type: 'recruited'; p: FactionId; city: number; unit: UnitType; army: number }
  | { type: 'buildStarted'; p: FactionId; tile: number; kind: 'city' | 'upgrade' | 'improve' }
  | { type: 'built'; p: FactionId; tile: number; kind: 'city' | 'upgrade' | 'improve'; level: number }
  | { type: 'retreat'; p: FactionId; army: number; target: number }
  | { type: 'raised'; p: FactionId; raise: RaiseResult; tile: number }
  | { type: 'dismissed'; p: FactionId; army: number; units: number; refund: number }
  | { type: 'upkeep'; p: FactionId; paid: number; unpaid: number; armies: number[] }
  | { type: 'pillaged'; p: FactionId; tile: number; gold: number }
  | { type: 'terraformed'; p: FactionId; tile: number; to: 'plains' | 'corrupted' }
  | { type: 'discovered'; p: FactionId; tile: number }
  | { type: 'hired'; p: FactionId; fortress: number; unit: UnitType; army: number }
  | { type: 'spellCast'; p: FactionId; spell: 'colossus' | 'volley' | 'wall'; army: number; tile: number }
  | { type: 'wallFallen'; p: FactionId; tile: number }
  | { type: 'grown'; p: FactionId; tile: number; city: number }
  | { type: 'healed'; p: FactionId; units: { army: number; unit: number; by: 'city' | 'mammoth' | 'druid' }[] }
  | { type: 'cityFallen'; p: FactionId; city: number; from: FactionId }
  | { type: 'cityCaptured'; p: FactionId; city: number; from: FactionId }
  | { type: 'cityRazed'; p: FactionId; city: number; from: FactionId; gold: number }
  | { type: 'eliminated'; p: FactionId; reason: 'units' | 'cities' }
  | { type: 'turn'; p: FactionId; turn: number; income: Income }
  | { type: 'victory'; p: FactionId };

export interface Income {
  gold: number;
  plains: number;
  mountains: number;
  forests: number;
  cities: number;
  coastal: number;
  improvements: number;
  enchanted: number;
  upkeep: number;
}
