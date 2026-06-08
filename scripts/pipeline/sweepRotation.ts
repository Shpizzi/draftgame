// Measures whether the rotation-size dilemma actually bites. For many random rosters,
// sweep rotationSize 5..10, average wins over many seeds (washing out noise/injury),
// and print mean wins vs rotation size. We want an INTERIOR tradeoff: top-heavy rosters
// favor short, balanced/fragile rosters favor wide — neither extreme should dominate.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRng } from '../../src/engine/rng';
import { generateRoster } from '../../src/engine/rosterGenerator';
import { simulateSeason } from '../../src/engine/simulation';
import type { PlayerSeason, SeasonData } from '../../src/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const season: SeasonData = JSON.parse(
  readFileSync(resolve(__dirname, '../../data/seasons/2024.json'), 'utf8'),
);

function topRotation(roster: PlayerSeason[], size: number) {
  return [...roster].sort((a, b) => b.quality - a.quality).slice(0, size).map((p) => p.id);
}

function meanAndStd(arr: number[]) {
  const m = arr.reduce((s, x) => s + x, 0) / arr.length;
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
  return { m, sd: Math.sqrt(v) };
}

// Average wins for a given roster across many seeds, per rotation size.
function sweep(roster: PlayerSeason[], seeds = 200) {
  const out: Record<number, { m: number; sd: number }> = {};
  for (let size = 5; size <= 10; size++) {
    const rotation = topRotation(roster, size);
    const wins: number[] = [];
    for (let s = 0; s < seeds; s++) {
      const rng = createRng(`sweep-${size}-${s}`);
      wins.push(simulateSeason(rng, { roster, rotation, seed: `${s}` }).wins);
    }
    out[size] = meanAndStd(wins);
  }
  return out;
}

function describe(label: string, roster: PlayerSeason[]) {
  const res = sweep(roster, 400);
  const line = Object.entries(res)
    .map(([size, { m, sd }]) => `r${size}:${m.toFixed(1)}±${sd.toFixed(1)}`)
    .join('  ');
  const best = Object.entries(res).reduce((b, [size, v]) => (v.m > b.v ? { size, v: v.m } : b), { size: '?', v: -1 });
  const avgQ = (roster.reduce((s, p) => s + p.quality, 0) / roster.length).toFixed(1);
  console.log(`${label.padEnd(26)} ${line}   BEST=r${best.size} (avgQ=${avgQ})`);
}

// Build an archetype at a target average quality by scaling a real roster's qualities.
function archetype(label: string, picks: PlayerSeason[]) {
  describe(label, picks);
}

// 1) Random rosters (the common case)
console.log('--- random rosters ---');
for (let i = 0; i < 6; i++) {
  const roster = generateRoster(createRng(`roster-${i}`), season.players);
  describe(`random #${i}`, roster);
}

// 2) Extreme archetypes
// pick players nearest a target quality
const near = (q: number, exclude = new Set<string>()) =>
  [...season.players]
    .filter((p) => !exclude.has(p.id))
    .sort((a, b) => Math.abs(a.quality - q) - Math.abs(b.quality - q))[0];

console.log('--- archetypes (mid-strength zone, logistic responsive) ---');

// stars+scrubs: 3 good (q~14) + 9 scrubs (q~2). Concentrating minutes on the 3 should
// beat diluting with scrubs → SHORT expected to win on mean.
{
  const used = new Set<string>();
  const stars: PlayerSeason[] = [];
  for (let i = 0; i < 3; i++) { const p = near(14, used); used.add(p.id); stars.push(p); }
  const scrubs: PlayerSeason[] = [];
  for (let i = 0; i < 9; i++) { const p = near(2, used); used.add(p.id); scrubs.push(p); }
  archetype('stars+scrubs (q14x3+q2x9)', [...stars, ...scrubs]);
}

// balanced: 12 similar mid players (q~7). Widening barely dilutes → WIDE wins (fatigue).
{
  const used = new Set<string>();
  const bal: PlayerSeason[] = [];
  for (let i = 0; i < 12; i++) { const p = near(7, used); used.add(p.id); bal.push(p); }
  archetype('balanced (q7x12)', bal);
}

// fragile stars: good quality but low availability → injuries likely → WIDE spreads risk.
{
  const fragile = [...season.players]
    .filter((p) => p.gamesPlayed < 50 && p.quality > 8)
    .sort((a, b) => b.quality - a.quality)
    .slice(0, 12);
  if (fragile.length === 12) archetype('fragile stars (lowGP)', fragile);
  else console.log('fragile stars: not enough players, skipped');
}
