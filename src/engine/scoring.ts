// Scoring. MVP shows both modes (open question #3): absolute (wins) and relative
// (vs the real roster of that season — the Comparative Bench feedback).

import type { SeasonData, SimResult } from '@/types';

export interface Score {
  absolute: number; // wins
  netRating: number;
  // relative comparison vs the best real roster of that season
  relative: {
    bestRealTeam: string;
    bestRealWins: number;
    diff: number; // your wins - best real wins
  } | null;
}

/** Find the real roster of the season with the most actual wins, for comparison. */
export function bestRealRoster(season: SeasonData) {
  const rosters = Object.values(season.originalRosters);
  if (rosters.length === 0) return null;
  return rosters.reduce((best, r) => (r.actualWins > best.actualWins ? r : best));
}

export function scoreRun(result: SimResult, season: SeasonData): Score {
  const best = bestRealRoster(season);
  return {
    absolute: result.wins,
    netRating: result.netRating,
    relative: best
      ? {
          bestRealTeam: best.team,
          bestRealWins: best.actualWins,
          diff: result.wins - best.actualWins,
        }
      : null,
  };
}
