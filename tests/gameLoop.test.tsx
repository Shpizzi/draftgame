// @vitest-environment jsdom
// Drives the REAL orchestration hook through the full loop: spin → deal → trade →
// rotation → sim → reveal. This is the end-to-end coverage the engine tests can't give
// (they call engine functions directly; this exercises useGame's state transitions).

import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGame } from '@/state/useGame';
import { ROTATION, ROSTER_SIZE, TRADE_MOVES } from '@/config/gameConstants';

describe('full game loop (useGame)', () => {
  it('plays spin → deal → trade → rotation → simulate → reveal end-to-end', () => {
    const { result } = renderHook(() => useGame());

    expect(result.current.state.phase).toBe('spin');

    act(() => result.current.spin());
    expect(result.current.state.phase).toBe('deal');
    expect(result.current.season).not.toBeNull();
    expect(result.current.state.season).toBeGreaterThanOrEqual(2020);

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
    act(() => { prob = result.current.previewTrade(out, target.id); });
    expect(prob).toBeGreaterThan(0);
    expect(prob).toBeLessThanOrEqual(1);

    act(() => result.current.commitTrade(out, target.id));
    expect(result.current.state.movesLeft).toBe(TRADE_MOVES - 1); // move burned
    expect(result.current.state.roster).toHaveLength(ROSTER_SIZE); // still full
    expect(result.current.state.tradeHistory).toHaveLength(1);

    const tradeRec = result.current.state.tradeHistory[0];

    act(() => result.current.goToRotation());
    expect(result.current.state.phase).toBe('rotation');
    const rotSize = result.current.state.rotation.length;
    expect(rotSize).toBeGreaterThanOrEqual(ROTATION.MIN);
    expect(rotSize).toBeLessThanOrEqual(ROTATION.MAX);

    // THE REGRESSION GUARD: a successfully acquired player must start in the rotation,
    // not silently benched. (Was the bug: rotation frozen at deal time.)
    if (tradeRec.succeeded) {
      expect(result.current.state.roster.some((p) => p.id === tradeRec.in)).toBe(true);
      expect(result.current.state.rotation).toContain(tradeRec.in);
    }

    act(() => result.current.simulate());
    expect(result.current.state.phase).toBe('reveal');
    const res = result.current.state.result!;
    expect(res.wins + res.losses).toBe(82);
    expect(res.breakdown.length).toBe(ROSTER_SIZE);
    expect(result.current.score).not.toBeNull();
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
