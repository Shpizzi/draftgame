import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { generateRoster } from '@/engine/rosterGenerator';
import { resolveTrade } from '@/engine/tradeSystem';
import { ROSTER_SIZE } from '@/config/gameConstants';
import { loadSeason } from './helpers';

const season = loadSeason(2024);

describe('trade resolution invariants', () => {
  it('roster stays at ROSTER_SIZE after a 1-for-1 and a 2-for-1 (when accepted)', () => {
    let resized = 0;
    for (let i = 0; i < 300; i++) {
      const rng = createRng(`tr-${i}`);
      const roster = generateRoster(rng, season.players);
      const inRoster = new Set(roster.map((p) => p.id));
      // target: a high-value player not on the roster
      const target = [...season.players]
        .filter((p) => !inRoster.has(p.id))
        .sort((a, b) => b.tradeValue - a.tradeValue)[0];
      // offer two players to maximize accept odds (2-for-1)
      const out = [...roster].sort((a, b) => b.tradeValue - a.tradeValue).slice(0, 2);
      const outcome = resolveTrade(rng, roster, season.players, { out, target }, 3);
      if (outcome.record.succeeded) {
        expect(outcome.roster).toHaveLength(ROSTER_SIZE);
        expect(new Set(outcome.roster.map((p) => p.id)).size).toBe(ROSTER_SIZE);
        resized++;
      }
      // move is always consumed (failed trade burns the move, default)
      expect(outcome.movesLeft).toBe(2);
    }
    expect(resized).toBeGreaterThan(0); // sanity: some trades actually succeeded
  });

  it('failed trade leaves roster unchanged but still burns the move', () => {
    const rng = createRng('fail-seed-search');
    const roster = generateRoster(rng, season.players);
    const inRoster = new Set(roster.map((p) => p.id));
    const target = [...season.players]
      .filter((p) => !inRoster.has(p.id))
      .sort((a, b) => b.tradeValue - a.tradeValue)[0];
    const weakOut = [...roster].sort((a, b) => a.tradeValue - b.tradeValue).slice(0, 1);
    // search a seed that yields a rejection (large gap → low prob)
    let found = false;
    for (let i = 0; i < 100 && !found; i++) {
      const r = createRng(`reject-${i}`);
      const outcome = resolveTrade(r, roster, season.players, { out: weakOut, target }, 3);
      if (!outcome.record.succeeded) {
        expect(outcome.roster).toEqual(roster); // unchanged
        expect(outcome.movesLeft).toBe(2); // burned anyway
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});
