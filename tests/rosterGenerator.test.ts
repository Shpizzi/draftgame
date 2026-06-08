import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { generateRoster } from '@/engine/rosterGenerator';
import { POSITIONS } from '@/types';
import { ROSTER_SIZE } from '@/config/gameConstants';
import { loadSeason } from './helpers';

const season = loadSeason(2024);

describe('roster generation', () => {
  it('always produces exactly ROSTER_SIZE players, unique', () => {
    for (let i = 0; i < 200; i++) {
      const roster = generateRoster(createRng(`gen-${i}`), season.players);
      expect(roster).toHaveLength(ROSTER_SIZE);
      expect(new Set(roster.map((p) => p.id)).size).toBe(ROSTER_SIZE);
    }
  });

  it('guarantees at least one player per position', () => {
    for (let i = 0; i < 200; i++) {
      const roster = generateRoster(createRng(`cover-${i}`), season.players);
      for (const pos of POSITIONS) {
        expect(roster.some((p) => p.position === pos)).toBe(true);
      }
    }
  });

  it('is deterministic given a seed', () => {
    const a = generateRoster(createRng('same'), season.players).map((p) => p.id);
    const b = generateRoster(createRng('same'), season.players).map((p) => p.id);
    expect(a).toEqual(b);
  });

  it('tier distribution is role/starter-heavy, superstars rare (statistical bands)', () => {
    const counts: Record<string, number> = { superstar: 0, star: 0, starter: 0, role: 0 };
    const N = 400;
    for (let i = 0; i < N; i++) {
      const roster = generateRoster(createRng(`dist-${i}`), season.players);
      for (const p of roster) counts[p.tier]++;
    }
    const total = N * ROSTER_SIZE;
    const roleStarterShare = (counts.role + counts.starter) / total;
    const superstarShare = counts.superstar / total;
    // ~80% role/starter target
    expect(roleStarterShare).toBeGreaterThan(0.7);
    // superstars should appear but be rare per slot
    expect(superstarShare).toBeLessThan(0.03);
  });
});
