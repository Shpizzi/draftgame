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

export interface TradeProposal {
  out: PlayerSeason[]; // 1..TRADE.MAX_OUT players from the roster (their values sum into the offer)
  target: PlayerSeason; // player wanted from the season pool
}

export interface TradeOutcome {
  record: TradeRecord;
  roster: PlayerSeason[]; // post-trade roster — SHRINKS by (out − 1) on a many-for-1
  movesLeft: number;
}

/**
 * Resolve a trade proposal against the current roster.
 * - Burns a move (default; failed trades still consume the move).
 * - On a many-for-1 the roster SHRINKS: you give N players, receive 1, and the (N − 1)
 *   freed slots stay EMPTY — no auto-refill. Concentrating value into a star is paid for
 *   in depth. Keeping the roster playable (≥ rotation minimum) is enforced in the UI.
 */
export function resolveTrade(
  rng: Rng,
  roster: PlayerSeason[],
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
    return { record, roster, movesLeft: newMovesLeft };
  }

  // Remove the offered players, add the target. The roster shrinks by (out − 1):
  // a 2-for-1 leaves 1 hole, a 3-for-1 leaves 2. Holes are NOT refilled.
  const outIds = new Set(proposal.out.map((p) => p.id));
  const newRoster = roster.filter((p) => !outIds.has(p.id));
  newRoster.push(proposal.target);

  return { record, roster: newRoster, movesLeft: newMovesLeft };
}

export const STARTING_MOVES = TRADE_MOVES;
