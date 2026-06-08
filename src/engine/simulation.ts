// SIMULATE: no game-by-game. Compute a season strength, convert to a W-L record,
// add bounded injury events and limited noise. Every output is explainable from the
// breakdown — never an opaque number.

import type {
  InjuryEvent,
  PlayerContribution,
  PlayerSeason,
  SimResult,
} from '@/types';
import type { Rng } from './rng';
import { availability } from './valuation';
import { MINUTES, ROTATION, SIM } from '@/config/gameConstants';

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Fatigue penalty for running a short rotation. 1.0 at/above ideal, down to a floor. */
export function fatigueFactor(rotationSize: number): number {
  const raw = 1 - ROTATION.K_FATIGUE * ((ROTATION.IDEAL - rotationSize) / ROTATION.IDEAL);
  return clamp(raw, ROTATION.FATIGUE_FLOOR, 1.0);
}

/** Bonus from quality sitting on the bench (out of rotation). */
export function benchDepthBonus(benchPlayers: PlayerSeason[]): number {
  if (benchPlayers.length === 0) return 0;
  const avgQuality =
    benchPlayers.reduce((s, p) => s + p.quality, 0) / benchPlayers.length;
  return ROTATION.BENCH_BONUS_SCALE * Math.max(0, avgQuality);
}

/** Logistic map of roster strength → expected wins in [0, GAMES]. */
export function logisticWins(strength: number): number {
  return SIM.GAMES / (1 + Math.exp(-SIM.LOGISTIC_STEEP * (strength - SIM.LOGISTIC_MIDPOINT)));
}

export interface SimInput {
  roster: PlayerSeason[];
  rotation: string[]; // ids in rotation
  seed: string;
}

export function simulateSeason(rng: Rng, input: SimInput): SimResult {
  const { roster, rotation } = input;
  const rotationSet = new Set(rotation);
  const rotationPlayers = roster.filter((p) => rotationSet.has(p.id));
  const benchPlayers = roster.filter((p) => !rotationSet.has(p.id));
  const rotationSize = rotationPlayers.length;

  // 1) Bounded injury events during the sim. Risk scales inversely with depth:
  // shorter rotation → higher per-player risk. Hard cap on event count and impact.
  const depthAmp =
    1 +
    SIM.INJURY_DEPTH_SCALE *
      Math.max(0, (ROTATION.IDEAL - rotationSize) / ROTATION.IDEAL);
  const eventRisk = SIM.INJURY_BASE_RISK * depthAmp;
  const injuryGamesLost = new Map<string, number>();
  const injuryEvents: InjuryEvent[] = [];
  for (const p of rotationPlayers) {
    if (injuryEvents.length >= SIM.INJURY_MAX_EVENTS) break;
    if (rng.chance(eventRisk)) {
      const gamesLost = rng.int(SIM.INJURY_GAMES_LOST_MIN, SIM.INJURY_GAMES_LOST_MAX);
      injuryGamesLost.set(p.id, gamesLost);
      injuryEvents.push({ playerId: p.id, name: p.name, gamesLost });
    }
  }

  // 2) Minutes weights within the rotation (∝ quality^POWER, normalized to sum 1).
  const rawWeights = rotationPlayers.map((p) => Math.pow(Math.max(0.01, p.quality), MINUTES.POWER));
  const weightSum = rawWeights.reduce((s, w) => s + w, 0) || 1;

  // 3) Per-player effective contribution = quality * (real availability minus sim injury).
  const breakdown: PlayerContribution[] = [];
  let weightedContribution = 0;
  rotationPlayers.forEach((p, i) => {
    const baseAvail = availability(p.gamesPlayed);
    const lost = injuryGamesLost.get(p.id) ?? 0;
    const effAvail = clamp(baseAvail - lost / SIM.GAMES, 0, 1);
    const minutesWeight = rawWeights[i] / weightSum;
    const contribution = p.quality * effAvail;
    weightedContribution += minutesWeight * contribution;
    breakdown.push({
      playerId: p.id,
      name: p.name,
      quality: p.quality,
      availability: effAvail,
      minutesWeight,
      contribution,
      inRotation: true,
    });
  });
  // Bench players appear in the breakdown too (zero rotation weight) for transparency.
  for (const p of benchPlayers) {
    breakdown.push({
      playerId: p.id,
      name: p.name,
      quality: p.quality,
      availability: availability(p.gamesPlayed),
      minutesWeight: 0,
      contribution: 0,
      inRotation: false,
    });
  }

  // 4) Roster strength, fatigue, bench depth.
  const fatigue = fatigueFactor(rotationSize);
  const depthBonus = benchDepthBonus(benchPlayers);
  const rosterStrength = weightedContribution * fatigue + depthBonus;

  // 5) Wins from logistic map + gaussian noise. Noise grows for short rotations
  // (wide rotation = more consistency).
  const expectedWins = logisticWins(rosterStrength);
  const sigma =
    SIM.WIN_NOISE_SIGMA * Math.pow(ROTATION.IDEAL / (rotationSize || 1), SIM.NOISE_SIZE_POWER);
  const wins = Math.round(clamp(expectedWins + rng.gaussian(0, sigma), 0, SIM.GAMES));
  const losses = SIM.GAMES - wins;

  // 6) Ratings derived from strength and the roster's offense/defense split.
  const netRating = (rosterStrength - SIM.LOGISTIC_MIDPOINT) * SIM.NET_RATING_SCALE;
  const avgOffSplit =
    rotationPlayers.reduce((s, p) => s + p.offSplit, 0) / (rotationSize || 1);
  const oRtg = SIM.LEAGUE_AVG_RATING + netRating * avgOffSplit;
  const dRtg = SIM.LEAGUE_AVG_RATING - netRating * (1 - avgOffSplit);

  return {
    wins,
    losses,
    netRating: round1(netRating),
    oRtg: round1(oRtg),
    dRtg: round1(dRtg),
    rosterStrength: round1(rosterStrength),
    fatigueFactor: round3(fatigue),
    benchDepthBonus: round1(depthBonus),
    breakdown,
    injuryEvents,
    seed: input.seed,
  };
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const round3 = (x: number) => Math.round(x * 1000) / 1000;
