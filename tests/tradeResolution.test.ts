import { describe, it, expect } from 'vitest';
import { createRng } from '@/engine/rng';
import { generateRoster } from '@/engine/rosterGenerator';
import { resolveTrade } from '@/engine/tradeSystem';
import { loadSeason } from './helpers';

const season = loadSeason(2024);

describe('trade resolution invariants', () => {
  it('many-for-1 shrinks the roster by (out − 1), leaving holes (no refill)', () => {
    let accepted = 0;
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
      const outcome = resolveTrade(rng, roster, { out, target }, 3);
      if (outcome.record.succeeded) {
        // 2-for-1 → roster drops by 1 (one hole), never refilled
        expect(outcome.roster).toHaveLength(roster.length - out.length + 1);
        expect(new Set(outcome.roster.map((p) => p.id)).size).toBe(outcome.roster.length);
        // the acquired player is in, the offered players are out
        expect(outcome.roster.some((p) => p.id === target.id)).toBe(true);
        for (const o of out) expect(outcome.roster.some((p) => p.id === o.id)).toBe(false);
        accepted++;
      }
      // move is always consumed (failed trade burns the move, default)
      expect(outcome.movesLeft).toBe(2);
    }
    expect(accepted).toBeGreaterThan(0); // sanity: some trades actually succeeded
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
      const outcome = resolveTrade(r, roster, { out: weakOut, target }, 3);
      if (!outcome.record.succeeded) {
        expect(outcome.roster).toEqual(roster); // unchanged
        expect(outcome.movesLeft).toBe(2); // burned anyway
        found = true;
      }
    }
    expect(found).toBe(true);
  });
});
