// ALL tunable numeric constants live here. The engine logic reads from this file;
// nothing numeric should be hardcoded in the engine modules. Every value is a
// starting point — adjust during playtesting. // TUNE

import type { Tier } from '@/types';

// --- Era packs (wheel) ---
export interface EraPack {
  id: string;
  label: string;
  startYear: number;
  endYear: number;
  unlocked: boolean;
}

export const ERA_PACKS: EraPack[] = [
  { id: 'eighties', label: '1984–1989', startYear: 1984, endYear: 1989, unlocked: true }, // TUNE
  { id: 'nineties', label: '1990–1999', startYear: 1990, endYear: 1999, unlocked: true },
  { id: 'aughts', label: '2000–2009', startYear: 2000, endYear: 2009, unlocked: true },
  { id: 'tens', label: '2010–2019', startYear: 2010, endYear: 2019, unlocked: true },
  { id: 'modern', label: '2020–2026', startYear: 2020, endYear: 2026, unlocked: true },
];

// --- Roster generation (DEAL) ---
export const ROSTER_SIZE = 12; // TUNE
export const TRADE_MOVES = 5; // TUNE

// Sampling weights per tier. NOTE: the effective pick probability for a tier is
// weight × (number of players in that tier), and tiers have very different sizes
// (role ≈ 60% of the pool, superstar ≈ 1%). So to make a tier appear at a target
// rate these weights are roughly INVERSE to tier size, not "rarer = smaller weight".
// Calibrated so a 12-man roster lands ~49% role / 39% starter / 11% star / 1.3%
// superstar, and ~80% of rosters open with at least one star-or-better anchor
// (the other ~20% start thin — no guarantees). // TUNE
export const TIER_WEIGHTS: Record<Tier, number> = {
  superstar: 12,
  star: 12,
  starter: 13,
  role: 8,
};

// Tier percentile cutoffs (top fraction) — computed per season in valuation. // TUNE
export const TIER_PERCENTILES = {
  superstar: 0.01, // top 1%
  star: 0.1, // next 9% (top 10% cumulative)
  starter: 0.4, // next 30% (top 40% cumulative)
  // role = the rest
};

// --- Valuation (quality / tradeValue) ---
// quality = W_BPM * bpm + W_VORP * vorp + W_AVAIL * availabilityFactor // TUNE
export const VALUATION = {
  W_BPM: 1.0,
  W_VORP: 2.5,
  W_AVAIL: 4.0,
  // BPM is a RATE stat and is wildly unreliable in tiny samples (a player with 1–2
  // games can post an absurd BPM). Regress BPM toward 0 by games-played reliability so a
  // cup-of-coffee player can't be valued like a star. VORP is cumulative and needs no
  // such fix. Players at/above RELIABLE_GAMES get their full BPM. // TUNE
  RELIABLE_GAMES: 25,
  // tradeValue scale within a season
  TRADE_VALUE_MIN: 1,
  TRADE_VALUE_MAX: 100,
};

// --- Trade acceptance ---
// acceptance(gap>0) = clamp(BASE * (REF/gap)^EXP, MIN, MAX)
// Softened so climbing in value is realistic (tradeValues are compressed — most
// players sit in the 20s, so a meaningful upgrade is a sizable gap). Anchors now:
// gap 5 → ~30%, gap 10 → ~17%, gap 20 → ~10%, gap <= 0 → GAP_LE_ZERO. // TUNE
export const TRADE = {
  GAP_LE_ZERO: 0.99,
  BASE: 0.3,
  REF: 5,
  EXP: 0.8,
  MIN: 0.03,
  MAX: 0.95,
  FAILED_TRADE_BURNS_MOVE: true, // open question #2 default: burn the move
  // Max players you can send away in one trade. Their tradeValues sum into the offer,
  // so a bigger package lands a bigger target; the roster refills with role players to
  // stay at ROSTER_SIZE. The engine handles any N; this only caps the UI. // TUNE
  MAX_OUT: 3,
};

// --- Rotation & fatigue ---
export const ROTATION = {
  MIN: 5,
  MAX: 10,
  IDEAL: 8, // IDEAL_ROTATION
  // Fatigue penalizes SHORT rotations (overworked starters). This is the force that
  // pushes back against the concentration advantage of going short. // TUNE
  K_FATIGUE: 0.22, // penalty slope for short rotations
  FATIGUE_FLOOR: 0.7, // fatigueFactor never drops below this
  // Small depth bonus for keeping real quality available off the rotation (next-man-up).
  // Kept modest so it doesn't perversely reward benching stars. // TUNE
  BENCH_BONUS_SCALE: 0.08,
};

// --- Simulation ---
export const SIM = {
  GAMES: 82,
  // logistic map of rosterStrength → expected wins.
  // wins = GAMES / (1 + exp(-STEEP * (strength - MIDPOINT)))
  // MIDPOINT must sit near the median rosterStrength the rosters actually produce, so the
  // MEDIAN random roster lands at ~.500 and a strong record has to be earned.
  // Recalibrated on REAL data (1984–2026) + the current generator: across eras the median
  // rosterStrength sits ~8–11 (aggregate ~9), p10 ~5, p90 ~15, elite max ~26.
  LOGISTIC_MIDPOINT: 9.0, // TUNE — aggregate median rosterStrength on real data → ~41W median
  LOGISTIC_STEEP: 0.118, // TUNE — maps ~31W (weak p10) → 41W (median) → 55W (p90) → ~72W (elite)
  // Gaussian noise on final wins. Scales DOWN with rotation size: wide rotations buy
  // consistency. sigma_eff = WIN_NOISE_SIGMA * (IDEAL / rotationSize) ^ NOISE_SIZE_POWER
  WIN_NOISE_SIGMA: 3.0, // TUNE — base sigma at the ideal rotation
  NOISE_SIZE_POWER: 1.6, // TUNE — how strongly short rotations add variance
  // injury events during sim — variance, but bounded
  INJURY_BASE_RISK: 0.08, // per rotation player base probability of an extra-injury event // TUNE
  INJURY_DEPTH_SCALE: 0.6, // short rotation amplifies risk up to this extra factor // TUNE
  INJURY_MAX_EVENTS: 3, // hard cap on injury events per sim (no wipeouts) // TUNE
  INJURY_GAMES_LOST_MIN: 5, // TUNE
  INJURY_GAMES_LOST_MAX: 20, // TUNE
  // net rating derivation from rosterStrength
  NET_RATING_SCALE: 0.7, // netRating = (strength - MIDPOINT) * scale // TUNE
  LEAGUE_AVG_RATING: 112, // baseline oRtg/dRtg around which the split pivots // TUNE
};

// --- Minutes weighting within rotation ---
// Starters carry more load. Weight rotation players by quality with this softening.
export const MINUTES = {
  // contribution weight_i ∝ quality_i ^ MINUTES_POWER, normalized across rotation.
  // Near-linear weighting so rotation size genuinely changes average quality: widening
  // a stars+scrubs roster DILUTES (scrubs get real minutes) → going short pays off;
  // widening a balanced roster costs almost nothing → go wide for consistency. This is
  // what creates the roster-dependent interior optimum. // TUNE
  POWER: 1.0,
};
