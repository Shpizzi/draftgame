// @vitest-environment jsdom
// Drives the REAL orchestration hook through the full loop: spin → deal → trade →
// rotation → sim → reveal. This is the end-to-end coverage the engine tests can't give
// (they call engine functions directly; this exercises useGame's state transitions).

import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGame } from '@/state/useGame';
import { ROTATION, ROSTER_SIZE, TRADE_MOVES, ERA_PACKS } from '@/config/gameConstants';

const unlocked = ERA_PACKS.filter((e) => e.unlocked);
const FIRST_YEAR = Math.min(...unlocked.map((e) => e.startYear));
const LAST_YEAR = Math.max(...unlocked.map((e) => e.endYear));

describe('full game loop (useGame)', () => {
  it('plays spin → deal → trade → rotation → simulate → reveal end-to-end', () => {
    const { result } = renderHook(() => useGame());

    expect(result.current.state.phase).toBe('spin');

    act(() => result.current.spin());
    expect(result.current.state.phase).toBe('deal');
    expect(result.current.season).not.toBeNull();
    expect(result.current.state.season).toBeGreaterThanOrEqual(FIRST_YEAR);
    expect(result.current.state.season).toBeLessThanOrEqual(LAST_YEAR);

    act(() => result.current.deal());
    expect(result.current.state.phase).toBe('trade');
    expect(result.current.state.roster).toHaveLength(ROSTER_SIZE);
    expect(result.current.state.movesLeft).toBe(TRADE_MOVES);

    // Trade two role players up for a high-value target (the central strategy).
    const season = result.current.season!;
    const rosterIds = new Set(result.current.state.roster.map((p) => p.id));
    const target = [...season.players]
      .filter((p) => !rosterIds.has(p.id))
      .sort((a, b) => b.tradeValue - a.tradeValue)[0];
    const out = [...result.current.state.roster]
      .sort((a, b) => a.tradeValue - b.tradeValue)
      .slice(0, 2)
      .map((p) => p.id);

    // preview returns a probability in [0,1]
    let prob = 0;
    act(() => { prob = result.current.previewTrade(out, [target.id]); });
    expect(prob).toBeGreaterThan(0);
    expect(prob).toBeLessThanOrEqual(1);

    act(() => result.current.commitTrade(out, [target.id]));
    expect(result.current.state.movesLeft).toBe(TRADE_MOVES - 1); // move burned
    expect(result.current.state.tradeHistory).toHaveLength(1);

    const tradeRec = result.current.state.tradeHistory[0];
    // 2-for-1: a successful swap shrinks the roster by one (a hole); a rejection leaves it full.
    expect(result.current.state.roster).toHaveLength(
      tradeRec.succeeded ? ROSTER_SIZE - 1 : ROSTER_SIZE,
    );

    act(() => result.current.goToRotation());
    expect(result.current.state.phase).toBe('rotation');
    const rotSize = result.current.state.rotation.length;
    expect(rotSize).toBeGreaterThanOrEqual(ROTATION.MIN);
    expect(rotSize).toBeLessThanOrEqual(ROTATION.MAX);

    // THE REGRESSION GUARD: a successfully acquired player must start in the rotation,
    // not silently benched. (Was the bug: rotation frozen at deal time.)
    if (tradeRec.succeeded) {
      for (const id of tradeRec.in) {
        expect(result.current.state.roster.some((p) => p.id === id)).toBe(true);
        expect(result.current.state.rotation).toContain(id);
      }
    }

    act(() => result.current.simulate());
    expect(result.current.state.phase).toBe('reveal');
    const res = result.current.state.result!;
    expect(res.wins + res.losses).toBe(82);
    expect(res.breakdown.length).toBe(result.current.state.roster.length);
    expect(result.current.score).not.toBeNull();
  });

  it('higher-probability power-up boosts the rolled prob and is spent once', () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.spin());
    act(() => result.current.deal());

    const season = result.current.season!;
    const rosterIds = new Set(result.current.state.roster.map((p) => p.id));
    // one weak player out for the top target → big value gap → low base prob (room to boost)
    const target = [...season.players]
      .filter((p) => !rosterIds.has(p.id))
      .sort((a, b) => b.tradeValue - a.tradeValue)[0];
    const weakOut = [...result.current.state.roster]
      .sort((a, b) => a.tradeValue - b.tradeValue)
      .slice(0, 1)
      .map((p) => p.id);

    let base = 0;
    let boosted = 0;
    act(() => { base = result.current.previewTrade(weakOut, [target.id], false); });
    act(() => { boosted = result.current.previewTrade(weakOut, [target.id], true); });
    expect(boosted).toBeGreaterThan(base);

    // commit WITH the power-up: it is consumed, and the recorded (rolled) prob is the boosted one
    expect(result.current.state.higherProbUsed).toBe(false);
    act(() => result.current.commitTrade(weakOut, [target.id], true));
    expect(result.current.state.higherProbUsed).toBe(true);
    expect(result.current.state.tradeHistory[0].acceptanceProb).toBeCloseTo(boosted, 5);
  });

  it('toggleRotation respects MIN/MAX bounds', () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.spin());
    act(() => result.current.deal());
    act(() => result.current.goToRotation());

    // try to remove below MIN
    const ids = [...result.current.state.rotation];
    act(() => {
      for (const id of ids) result.current.toggleRotation(id); // attempt to empty it
    });
    expect(result.current.state.rotation.length).toBeGreaterThanOrEqual(ROTATION.MIN);

    // try to add above MAX
    const benchIds = result.current.state.roster
      .map((p) => p.id)
      .filter((id) => !result.current.state.rotation.includes(id));
    act(() => {
      for (const id of benchIds) result.current.toggleRotation(id);
    });
    expect(result.current.state.rotation.length).toBeLessThanOrEqual(ROTATION.MAX);
  });
});
