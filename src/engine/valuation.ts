// quality + tradeValue + tier, isolated behind a swappable interface.
// This is the single most credibility-critical formula — expect to retune it.
// It is PURE: same input → same output, no rng. Tiers are per-season percentiles.

import type { PlayerSeason, Tier } from '@/types';
import { SIM, TIER_PERCENTILES, VALUATION } from '@/config/gameConstants';

// Raw player-season as it arrives from the dataset, before derived fields exist.
export type RawPlayer = Omit<PlayerSeason, 'quality' | 'tradeValue' | 'tier'>;

export interface PlayerValuation {
  /** Availability in [0,1] from real games played. */
  availability(p: { gamesPlayed: number }): number;
  /** Composite quality for one player-season (rng-free). */
  quality(p: RawPlayer): number;
  /** Annotate a whole season's players with quality, tradeValue (1–100), tier. */
  valuateSeason(players: RawPlayer[]): PlayerSeason[];
}

export const availability = (gamesPlayed: number): number =>
  Math.max(0, Math.min(1, gamesPlayed / SIM.GAMES));

export const defaultValuation: PlayerValuation = {
  availability: (p) => availability(p.gamesPlayed),

  quality(p) {
    const avail = availability(p.gamesPlayed);
    // Regress BPM toward 0 by sample reliability (tiny samples → unreliable rate stat).
    const reliability = Math.min(1, p.gamesPlayed / VALUATION.RELIABLE_GAMES);
    const effectiveBpm = p.bpm * reliability;
    // availabilityFactor folds durability into value: a fragile star is worth less.
    return (
      VALUATION.W_BPM * effectiveBpm +
      VALUATION.W_VORP * p.vorp +
      VALUATION.W_AVAIL * avail
    );
  },

  valuateSeason(players) {
    const withQuality = players.map((p) => ({ ...p, quality: this.quality(p) }));

    // tradeValue: linear scale of quality into [MIN, MAX] within this season only.
    const qualities = withQuality.map((p) => p.quality);
    const qMin = Math.min(...qualities);
    const qMax = Math.max(...qualities);
    const span = qMax - qMin || 1;
    const { TRADE_VALUE_MIN: tvMin, TRADE_VALUE_MAX: tvMax } = VALUATION;

    // tier: per-season percentile cutoffs on quality (rank-based, robust to outliers).
    const sortedDesc = [...withQuality].sort((a, b) => b.quality - a.quality);
    const n = sortedDesc.length;
    const tierOf = (rankIndex: number): Tier => {
      const pct = rankIndex / n; // 0 = best
      if (pct < TIER_PERCENTILES.superstar) return 'superstar';
      if (pct < TIER_PERCENTILES.star) return 'star';
      if (pct < TIER_PERCENTILES.starter) return 'starter';
      return 'role';
    };
    const tierById = new Map<string, Tier>();
    sortedDesc.forEach((p, i) => tierById.set(p.id, tierOf(i)));

    return withQuality.map((p) => ({
      ...p,
      tradeValue: Math.round(
        tvMin + ((p.quality - qMin) / span) * (tvMax - tvMin),
      ),
      tier: tierById.get(p.id)!,
    }));
  },
};
