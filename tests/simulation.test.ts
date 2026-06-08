import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { generateRoster } from '@/engine/rosterGenerator';
import { simulateSeason, fatigueFactor } from '@/engine/simulation';
import { ROTATION, SIM } from '@/config/gameConstants';
import { loadSeason } from './helpers';

const season = loadSeason(2024);

function topRotation(roster: { id: string; quality: number }[], size: number) {
  return [...roster].sort((a, b) => b.quality - a.quality).slice(0, size).map((p) => p.id);
}

describe('simulation', () => {
  it('produces wins/losses summing to GAMES, within [0, GAMES]', () => {
    for (let i = 0; i < 300; i++) {
      const rng = createRng(`sim-${i}`);
      const roster = generateRoster(rng, season.players);
      const rotation = topRotation(roster, 8);
      const res = simulateSeason(rng, { roster, rotation, seed: `sim-${i}` });
      expect(res.wins + res.losses).toBe(SIM.GAMES);
      expect(res.wins).toBeGreaterThanOrEqual(0);
      expect(res.wins).toBeLessThanOrEqual(SIM.GAMES);
    }
  });

  it('breakdown is explainable: every roster player present, rotation weights sum ~1', () => {
    const rng = createRng('breakdown');
    const roster = generateRoster(rng, season.players);
    const rotation = topRotation(roster, 8);
    const res = simulateSeason(rng, { roster, rotation, seed: 'breakdown' });
    expect(res.breakdown).toHaveLength(roster.length);
    const inRotation = res.breakdown.filter((b) => b.inRotation);
    expect(inRotation).toHaveLength(8);
    const weightSum = inRotation.reduce((s, b) => s + b.minutesWeight, 0);
    expect(weightSum).toBeCloseTo(1, 5);
    // bench players carry zero rotation contribution
    for (const b of res.breakdown.filter((x) => !x.inRotation)) {
      expect(b.contribution).toBe(0);
    }
  });

  it('injury events are bounded by the cap', () => {
    for (let i = 0; i < 300; i++) {
      const rng = createRng(`inj-${i}`);
      const roster = generateRoster(rng, season.players);
      const rotation = topRotation(roster, 5); // short rotation → more risk
      const res = simulateSeason(rng, { roster, rotation, seed: `inj-${i}` });
      expect(res.injuryEvents.length).toBeLessThanOrEqual(SIM.INJURY_MAX_EVENTS);
    }
  });

  it('is deterministic given a seed', () => {
    const roster = generateRoster(createRng('r'), season.players);
    const rotation = topRotation(roster, 8);
    const a = simulateSeason(createRng('s'), { roster, rotation, seed: 's' });
    const b = simulateSeason(createRng('s'), { roster, rotation, seed: 's' });
    expect(a.wins).toBe(b.wins);
    expect(a.netRating).toBe(b.netRating);
  });

  it('fatigueFactor: 1.0 at/above ideal, penalized below, never under floor', () => {
    expect(fatigueFactor(ROTATION.IDEAL)).toBe(1);
    expect(fatigueFactor(ROTATION.IDEAL + 2)).toBe(1);
    expect(fatigueFactor(5)).toBeLessThan(1);
    expect(fatigueFactor(5)).toBeGreaterThanOrEqual(ROTATION.FATIGUE_FLOOR);
  });

  it('stronger rosters win more on average than weaker ones', () => {
    // Build a clearly strong rotation (top quality) vs a weak one (bottom quality)
    const sorted = [...season.players].sort((a, b) => b.quality - a.quality);
    const strong = sorted.slice(0, 12);
    const weak = sorted.slice(-12);
    const avg = (roster: typeof strong) => {
      let total = 0;
      const N = 50;
      for (let i = 0; i < N; i++) {
        const rng = createRng(`cmp-${i}`);
        const rotation = topRotation(roster, 8);
        total += simulateSeason(rng, { roster, rotation, seed: `cmp-${i}` }).wins;
      }
      return total / N;
    };
    expect(avg(strong)).toBeGreaterThan(avg(weak));
  });
});
