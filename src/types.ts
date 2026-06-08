// Core domain types for the NBA Roster Draft game.
// The engine is domain-agnostic in spirit: it consumes PlayerSeason[] + config and
// returns results. These types are the contract between data, engine and UI.

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export type Tier = 'superstar' | 'star' | 'starter' | 'role';

export const POSITIONS: readonly Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

// --- Static data (from the dataset) ---
export interface PlayerSeason {
  id: string; // unique per player-season, e.g. "2024-lebron-james"
  name: string;
  team: string;
  season: number; // e.g. 2024
  position: Position;
  // base stats
  ppg: number;
  rpg: number;
  apg: number;
  gamesPlayed: number; // real → implicit injuries
  // advanced metrics
  bpm: number;
  vorp: number;
  // derived in the data/valuation pipeline
  quality: number; // composite (see valuation.ts)
  tradeValue: number; // 1–100, normalized within the season
  tier: Tier;
  // offense/defense split in [0,1], offSplit + defSplit = 1.
  // used to derive oRtg/dRtg from roster strength.
  offSplit: number;
}

export interface OriginalRoster {
  team: string;
  playerIds: string[];
  actualWins: number;
}

export interface SeasonData {
  season: number;
  players: PlayerSeason[];
  originalRosters: Record<string, OriginalRoster>; // keyed by team, for Comparative Bench
}

// --- Game state (runtime) ---
export type GamePhase = 'spin' | 'deal' | 'trade' | 'rotation' | 'sim' | 'reveal';

export interface TradeRecord {
  out: string[]; // ids sent away
  in: string; // id acquired
  offerValue: number;
  targetValue: number;
  acceptanceProb: number;
  succeeded: boolean;
}

export interface GameState {
  season: number;
  roster: PlayerSeason[]; // always 12
  rotation: string[]; // ids in rotation (5–10)
  movesLeft: number; // starts at TRADE_MOVES
  tradeHistory: TradeRecord[];
  phase: GamePhase;
  seed: string; // run seed (drives the whole run deterministically)
  result: SimResult | null;
}

export interface PlayerContribution {
  playerId: string;
  name: string;
  quality: number;
  availability: number; // real games-based availability used in sim
  minutesWeight: number; // share of rotation load
  contribution: number; // effective contribution that fed roster strength
  inRotation: boolean;
}

export interface InjuryEvent {
  playerId: string;
  name: string;
  gamesLost: number;
}

export interface SimResult {
  wins: number;
  losses: number;
  netRating: number;
  oRtg: number;
  dRtg: number;
  rosterStrength: number;
  fatigueFactor: number;
  benchDepthBonus: number;
  breakdown: PlayerContribution[]; // explainability: the numbers that produced the result
  injuryEvents: InjuryEvent[];
  seed: string;
}
