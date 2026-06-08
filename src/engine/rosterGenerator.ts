// DEAL: draw a 12-player roster from a season pool with rarity-weighted sampling,
// guaranteeing at least one eligible player per position while staying at exactly 12.

import type { PlayerSeason, Position } from '@/types';
import { POSITIONS } from '@/types';
import type { Rng } from './rng';
import { ROSTER_SIZE, TIER_WEIGHTS } from '@/config/gameConstants';

/** Weighted sample of `count` distinct players (by tier weight), without replacement. */
export function weightedSample(
  rng: Rng,
  pool: PlayerSeason[],
  count: number,
): PlayerSeason[] {
  const remaining = [...pool];
  const picked: PlayerSeason[] = [];
  const n = Math.min(count, remaining.length);
  for (let k = 0; k < n; k++) {
    const total = remaining.reduce((s, p) => s + TIER_WEIGHTS[p.tier], 0);
    let r = rng.next() * total;
    let idx = 0;
    for (; idx < remaining.length; idx++) {
      r -= TIER_WEIGHTS[remaining[idx].tier];
      if (r <= 0) break;
    }
    if (idx >= remaining.length) idx = remaining.length - 1;
    picked.push(remaining[idx]);
    remaining.splice(idx, 1);
  }
  return picked;
}

/**
 * Ensure every position in POSITIONS appears at least once in the roster, keeping
 * size fixed. For each missing position, draw a player of that position from the
 * unused pool and swap out a surplus role player (a duplicate of an over-covered
 * position, lowest quality first) so the count never drifts off ROSTER_SIZE.
 */
export function enforcePositionCoverage(
  rng: Rng,
  roster: PlayerSeason[],
  pool: PlayerSeason[],
): PlayerSeason[] {
  const result = [...roster];
  const inRoster = new Set(result.map((p) => p.id));

  const missing = (): Position[] =>
    POSITIONS.filter((pos) => !result.some((p) => p.position === pos));

  for (const pos of missing()) {
    const candidates = pool.filter(
      (p) => p.position === pos && !inRoster.has(p.id),
    );
    if (candidates.length === 0) continue; // pool can't cover this position; skip
    const incoming = weightedSample(rng, candidates, 1)[0];

    // Find a swap victim: a player whose position is covered more than once,
    // preferring the lowest-quality such player so we never drop a needed role.
    const counts = new Map<Position, number>();
    for (const p of result) counts.set(p.position, (counts.get(p.position) ?? 0) + 1);
    const victims = result
      .filter((p) => (counts.get(p.position) ?? 0) > 1)
      .sort((a, b) => a.quality - b.quality);
    if (victims.length === 0) continue; // nothing safe to drop; leave as is

    const victim = victims[0];
    const vi = result.findIndex((p) => p.id === victim.id);
    result.splice(vi, 1, incoming);
    inRoster.delete(victim.id);
    inRoster.add(incoming.id);
  }

  return result;
}

/** Generate the initial 12-player roster for a season. */
export function generateRoster(rng: Rng, pool: PlayerSeason[]): PlayerSeason[] {
  const drawn = weightedSample(rng, pool, ROSTER_SIZE);
  return enforcePositionCoverage(rng, drawn, pool);
}
