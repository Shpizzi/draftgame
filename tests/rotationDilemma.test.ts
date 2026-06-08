import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { simulateSeason } from '@/engine/simulation';
import type { PlayerSeason } from '@/types';
import { loadSeason } from './helpers';

// Locks in the core design dilemma (brief §3.6): rotation size must matter and depend
// on roster shape. If this regresses, the game's central decision is broken.

const season = loadSeason(2024);

function near(q: number, exclude: Set<string>): PlayerSeason {
  const p = [...season.players]
    .filter((x) => !exclude.has(x.id))
    .sort((a, b) => Math.abs(a.quality - q) - Math.abs(b.quality - q))[0];
  exclude.add(p.id);
  return p;
}

function topRotation(roster: PlayerSeason[], size: number) {
  return [...roster].sort((a, b) => b.quality - a.quality).slice(0, size).map((p) => p.id);
}

function winStats(roster: PlayerSeason[], size: number, seeds = 400) {
  const rotation = topRotation(roster, size);
  const wins: number[] = [];
  for (let s = 0; s < seeds; s++) {
    wins.push(simulateSeason(createRng(`d-${size}-${s}`), { roster, rotation, seed: `${s}` }).wins);
  }
  const m = wins.reduce((a, b) => a + b, 0) / wins.length;
  const sd = Math.sqrt(wins.reduce((a, b) => a + (b - m) ** 2, 0) / wins.length);
  return { m, sd };
}

describe('rotation dilemma', () => {
  it('stars+scrubs roster: SHORT rotation beats WIDE on mean (concentration pays off)', () => {
    const used = new Set<string>();
    const stars = [near(14, used), near(14, used), near(14, used)];
    const scrubs = Array.from({ length: 9 }, () => near(2, used));
    const roster = [...stars, ...scrubs];
    const short = winStats(roster, 5);
    const wide = winStats(roster, 10);
    expect(short.m).toBeGreaterThan(wide.m);
  });

  it('SHORT rotations are higher-variance than WIDE (risk/reward axis)', () => {
    const roster = [...season.players].sort((a, b) => b.quality - a.quality).slice(20, 32);
    const short = winStats(roster, 5);
    const wide = winStats(roster, 10);
    expect(short.sd).toBeGreaterThan(wide.sd * 1.5);
  });
});
