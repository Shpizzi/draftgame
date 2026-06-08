// TRADE: at-sight swaps constrained by trade value. The acceptance curve is the key
// mechanism — selling a "7" to reach an "8/9" is possible but unlikely and decreasing.
// Anchors (must hold): gap 5 → ~30%, gap <= 0 → ~99%.

import type { PlayerSeason, TradeRecord } from '@/types';
import type { Rng } from './rng';
import { TRADE, TRADE_MOVES } from '@/config/gameConstants';

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

/**
 * Apply the one-time "higher probability" power-up to a base acceptance prob.
 * boosted = p + BONUS*(1-p): largest absolute lift when p is low, tapers to ~0 as p→1.
 * Capped at 1 only — NEVER clamped down to TRADE.MAX, so an even/favorable swap stays at
 * its ~99%. Pass-through when boost is false. The single source of truth for the boost,
 * shared by both the preview (displayed %) and resolution (the rolled %), so they agree.
 */
export function boostedProb(prob: number, boost: boolean): number {
  if (!boost) return prob;
  return Math.min(1, prob + TRADE.HIGHER_PROB_BONUS * (1 - prob));
}

export interface TradeProposal {
  out: PlayerSeason[]; // 1..TRADE.MAX_OUT players from the roster — values sum into the offer
  in: PlayerSeason[]; // 1..TRADE.MAX_IN players wanted from the pool — values sum into the target
}

export interface TradeOutcome {
  record: TradeRecord;
  roster: PlayerSeason[]; // post-trade roster — SHRINKS by (out − 1) on a many-for-1
  movesLeft: number;
}

/**
 * Resolve a trade proposal against the current roster.
 * - Burns a move (default; failed trades still consume the move).
 * - Values SUM on each side: offer = Σ out values, target = Σ in values. The roster
 *   changes by (in − out): give 3 for 1 → 2 holes; give 1 for 2 → fill 1 hole. Holes are
 *   never auto-refilled, and keeping the result within [MIN, ROSTER_SIZE] is enforced
 *   upstream (the UI/orchestration), so the engine just applies the swap.
 */
export function resolveTrade(
  rng: Rng,
  roster: PlayerSeason[],
  proposal: TradeProposal,
  movesLeft: number,
  boost = false,
): TradeOutcome {
  const offerValue = proposal.out.reduce((s, p) => s + p.tradeValue, 0);
  const targetValue = proposal.in.reduce((s, p) => s + p.tradeValue, 0);
  const prob = boostedProb(acceptanceProb(offerValue, targetValue), boost);
  const succeeded = rng.chance(prob);

  const record: TradeRecord = {
    out: proposal.out.map((p) => p.id),
    in: proposal.in.map((p) => p.id),
    offerValue,
    targetValue,
    acceptanceProb: prob,
    succeeded,
  };

  // A move is always consumed (FAILED_TRADE_BURNS_MOVE default true).
  const cost = TRADE.FAILED_TRADE_BURNS_MOVE || succeeded ? 1 : 0;
  const newMovesLeft = Math.max(0, movesLeft - cost);

  if (!succeeded) {
    return { record, roster, movesLeft: newMovesLeft };
  }

  // Remove the offered players, add the acquired ones. Net size change = in − out.
  const outIds = new Set(proposal.out.map((p) => p.id));
  const newRoster = roster.filter((p) => !outIds.has(p.id));
  newRoster.push(...proposal.in);

  return { record, roster: newRoster, movesLeft: newMovesLeft };
}

export const STARTING_MOVES = TRADE_MOVES;
