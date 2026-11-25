export type FactionId = 'necro' | 'elves' | 'giants';
export type Owner = FactionId | 'neutral';
export type Terrain = 'plains' | 'forest' | 'mountain' | 'desert' | 'water';
export type Phase = 'reinforce' | 'attack' | 'fortify' | 'over';
export type SlotKind = 'human' | 'ai' | 'off';

export interface Tile {
  id: number;
  q: number;
  r: number;
  terrain: Terrain;
  region: number; // -1 for water
  owner: Owner | null; // null for water
  troops: number;
  champion: boolean;
  stronghold: boolean;
  capital: FactionId | null;
  deco: number; // stable per-tile random for decoration layout
}

export interface Region {
  id: number;
  name: string;
  tiles: number[];
  bonus: number;
}

export interface PlayerState {
  faction: FactionId;
  kind: 'human' | 'ai';
  /** online: client id controlling this slot ('' = local) */
  controller: string;
  name: string;
  alive: boolean;
  gold: number;
  power: number; // faction resource: souls / mana / ore
  reinforcements: number;
  abilityUsed: boolean;
  conquered: number; // hexes conquered this turn
  kills: number;
}

export interface PendingMove {
  from: number;
  to: number;
  min: number;
  max: number;
}

export interface GameSetup {
  seed: number;
  size: 'small' | 'medium' | 'large';
  slots: { faction: FactionId; kind: SlotKind; name: string; controller: string }[];
}

export interface GameState {
  version: 1;
  setup: GameSetup;
  rng: number;
  radius: number;
  tiles: Tile[];
  regions: Region[];
  players: PlayerState[]; // turn order
  current: number;
  phase: Phase;
  turn: number;
  fortifyUsed: boolean;
  pending: PendingMove | null;
  winner: FactionId | null;
  actionCount: number;
  /** Undead Army trigger for the pending move-in */
  raiseOnMove: boolean;
}

export type Action =
  | { type: 'place'; p: FactionId; tile: number; n: number }
  | { type: 'buy'; p: FactionId; item: 'troop' | 'champion'; tile?: number }
  | { type: 'ability'; p: FactionId; tile: number }
  | { type: 'attack'; p: FactionId; from: number; to: number; blitz: boolean }
  | { type: 'move'; p: FactionId; n: number }
  | { type: 'fortify'; p: FactionId; from: number; to: number; n: number }
  | { type: 'endPhase'; p: FactionId };

export interface DieRoll {
  value: number; // raw 1..6
  bonus: number; // added to this die
}

export interface CombatRound {
  att: DieRoll[];
  def: DieRoll[];
  attLoss: number;
  defLoss: number;
}

export type GameEvent =
  | { type: 'placed'; tile: number; n: number; p: FactionId }
  | { type: 'bought'; item: 'troop' | 'champion'; tile?: number; p: FactionId }
  | {
      type: 'combat';
      p: FactionId;
      from: number;
      to: number;
      defender: Owner;
      rounds: CombatRound[];
      attMods: string[];
      defMods: string[];
      conquered: boolean;
    }
  | { type: 'conquered'; p: FactionId; tile: number; from: Owner }
  | { type: 'moved'; from: number; to: number; n: number; p: FactionId }
  | { type: 'ability'; p: FactionId; tile: number }
  | { type: 'raised'; p: FactionId; tile: number; n: number }
  | { type: 'eliminated'; p: FactionId; by: FactionId }
  | { type: 'phase'; p: FactionId; phase: Phase }
  | { type: 'turn'; p: FactionId; turn: number; income: Income }
  | { type: 'victory'; p: FactionId; reason: 'last' | 'domination' };

export interface Income {
  troops: number;
  gold: number;
  power: number;
  regions: string[];
}
