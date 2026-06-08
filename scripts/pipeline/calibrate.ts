// Calibration helper (not part of the game). Samples many real rosters from the fake
// data and prints the distribution of rosterStrength and resulting wins, so the
// logistic midpoint/steepness in gameConstants can be tuned to land sensibly.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRng } from '../../src/engine/rng';
import { generateRoster } from '../../src/engine/rosterGenerator';
import { simulateSeason, logisticWins } from '../../src/engine/simulation';
import type { SeasonData } from '../../src/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const season: SeasonData = JSON.parse(
  readFileSync(resolve(__dirname, '../../data/seasons/2024.json'), 'utf8'),
);

const N = 2000;
const strengths: number[] = [];
const winsArr: number[] = [];
for (let i = 0; i < N; i++) {
  const rng = createRng(`calib-${i}`);
  const roster = generateRoster(rng, season.players);
  // pick a mid rotation of 8 (the ideal)
  const rotation = [...roster]
    .sort((a, b) => b.quality - a.quality)
    .slice(0, 8)
    .map((p) => p.id);
  const res = simulateSeason(rng, { roster, rotation, seed: `calib-${i}` });
  strengths.push(res.rosterStrength);
  winsArr.push(res.wins);
}

const pct = (arr: number[], p: number) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(p * (s.length - 1))];
};
const fmt = (arr: number[]) =>
  `min=${pct(arr, 0).toFixed(1)} p10=${pct(arr, 0.1).toFixed(1)} p50=${pct(arr, 0.5).toFixed(1)} p90=${pct(arr, 0.9).toFixed(1)} max=${pct(arr, 1).toFixed(1)}`;

console.log('rosterStrength:', fmt(strengths));
console.log('wins:        ', fmt(winsArr));
console.log('logisticWins at p10/p50/p90 strength:',
  logisticWins(pct(strengths, 0.1)).toFixed(1),
  logisticWins(pct(strengths, 0.5)).toFixed(1),
  logisticWins(pct(strengths, 0.9)).toFixed(1),
);
