// TRADE: at-sight swaps constrained by trade value. The acceptance curve is the key
// mechanism — selling a "7" to reach an "8/9" is possible but unlikely and decreasing.
// Anchors (must hold): gap 5 → ~30%, gap <= 0 → ~99%.

import type { PlayerSeason, TradeRecord } from '@/types';
import type { Rng } from './rng';
import { ROSTER_SIZE, TRADE, TRADE_MOVES } from '@/config/gameConstants';
import { weightedSample } from './rosterGenerator';

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Acceptance probability given the offered total value and the target's value. */
export function acceptanceProb(offerValue: number, targetValue: number): number {
  const gap = targetValue - offerValue;
  if (gap <= 0) return TRADE.GAP_LE_ZERO;
  return clamp(
    TRADE.BASE * Math.pow(TRADE.REF / gap, TRADE.EXP),
    TRADE.MIN,
    TRADE.MAX,
  );
}

export interface TradeProposal {
  out: PlayerSeason[]; // 1 or 2 players from the roster
  target: PlayerSeason; // player wanted from the season pool
}

export interface TradeOutcome {
  record: TradeRecord;
  roster: PlayerSeason[]; // resulting roster (always ROSTER_SIZE)
  movesLeft: number;
  refilled: PlayerSeason | null; // role player added back when a 2-for-1 left a hole
}

/**
 * Resolve a trade proposal against the current roster.
 * - Burns a move (default; failed trades still consume the move).
 * - On a 2-for-1, the roster drops to 11 then is refilled with a weighted role draw
 *   from the pool, keeping size at ROSTER_SIZE. (Short-roster play is a UI choice
 *   handled elsewhere; the engine keeps the roster full by default.)
 */
export function resolveTrade(
  rng: Rng,
  roster: PlayerSeason[],
  pool: PlayerSeason[],
  proposal: TradeProposal,
  movesLeft: number,
): TradeOutcome {
  const offerValue = proposal.out.reduce((s, p) => s + p.tradeValue, 0);
  const targetValue = proposal.target.tradeValue;
  const prob = acceptanceProb(offerValue, targetValue);
  const succeeded = rng.chance(prob);

  const record: TradeRecord = {
    out: proposal.out.map((p) => p.id),
    in: proposal.target.id,
    offerValue,
    targetValue,
    acceptanceProb: prob,
    succeeded,
  };

  // A move is always consumed (FAILED_TRADE_BURNS_MOVE default true).
  const cost = TRADE.FAILED_TRADE_BURNS_MOVE || succeeded ? 1 : 0;
  const newMovesLeft = Math.max(0, movesLeft - cost);

  if (!succeeded) {
    return { record, roster, movesLeft: newMovesLeft, refilled: null };
  }

  // Remove the offered players, add the target.
  const outIds = new Set(proposal.out.map((p) => p.id));
  let newRoster = roster.filter((p) => !outIds.has(p.id));
  newRoster.push(proposal.target);

  // Refill back up to ROSTER_SIZE with weighted role-player draws from the pool.
  let refilled: PlayerSeason | null = null;
  if (newRoster.length < ROSTER_SIZE) {
    const inRoster = new Set(newRoster.map((p) => p.id));
    inRoster.add(proposal.target.id);
    const fillPool = pool.filter(
      (p) => !inRoster.has(p.id) && p.tier === 'role',
    );
    const usablePool = fillPool.length > 0
      ? fillPool
      : pool.filter((p) => !inRoster.has(p.id));
    const needed = ROSTER_SIZE - newRoster.length;
    const fillers = weightedSample(rng, usablePool, needed);
    if (fillers.length > 0) refilled = fillers[0];
    newRoster = newRoster.concat(fillers);
  }

  return { record, roster: newRoster, movesLeft: newMovesLeft, refilled };
}

export const STARTING_MOVES = TRADE_MOVES;
