'use client';

// React orchestration layer. Holds ONE rng instance per run (in a ref) so the whole
// run is deterministic given its seed — same contract as the engine tests. The engine
// stays pure; this hook just sequences phases and stores UI-facing state.

import { useCallback, useRef, useState } from 'react';
import type { GameState, PlayerSeason, SeasonData, SimResult } from '@/types';
import { createRng, freshSeed, type Rng } from '@/engine/rng';
import { spinWheel } from '@/engine/wheel';
import { generateRoster } from '@/engine/rosterGenerator';
import {
  acceptanceProb,
  resolveTrade,
  STARTING_MOVES,
  type TradeProposal,
} from '@/engine/tradeSystem';
import { simulateSeason } from '@/engine/simulation';
import { scoreRun, type Score } from '@/engine/scoring';
import { getSeason } from '@/data/loadSeasons';
import { ROTATION } from '@/config/gameConstants';

function defaultRotation(roster: PlayerSeason[]): string[] {
  return [...roster]
    .sort((a, b) => b.quality - a.quality)
    .slice(0, ROTATION.IDEAL)
    .map((p) => p.id);
}

export interface UseGame {
  state: GameState;
  season: SeasonData | null;
  score: Score | null;
  // actions
  newRun: () => void;
  spin: () => void;
  deal: () => void;
  previewTrade: (outIds: string[], targetId: string) => number; // acceptance prob
  commitTrade: (outIds: string[], targetId: string) => void;
  toggleRotation: (id: string) => void;
  goToRotation: () => void;
  simulate: () => void;
  reset: () => void;
}

const initialState = (seed: string): GameState => ({
  season: 0,
  roster: [],
  rotation: [],
  movesLeft: STARTING_MOVES,
  tradeHistory: [],
  phase: 'spin',
  seed,
  result: null,
});

// Stable placeholder used for the first server + client render. The real seed is
// generated client-side after mount (in an effect) to avoid an SSR/client hydration
// mismatch — freshSeed() uses Date.now()/Math.random() and must never run during SSR.
const PENDING_SEED = 'pending';

export function useGame(): UseGame {
  const rngRef = useRef<Rng | null>(null);
  const seasonRef = useRef<SeasonData | null>(null);
  const [state, setState] = useState<GameState>(() => initialState(PENDING_SEED));
  const [season, setSeason] = useState<SeasonData | null>(null);
  const [score, setScore] = useState<Score | null>(null);

  // Lazily ensure the run rng exists. If the seed is still the SSR placeholder, generate
  // a real one NOW (client-side, inside a user action) — never during render/SSR, so the
  // initial server + client render stay identical (no hydration mismatch).
  const ensureRng = useCallback((): Rng => {
    if (!rngRef.current) {
      const seed = state.seed === PENDING_SEED ? freshSeed() : state.seed;
      rngRef.current = createRng(seed);
      if (seed !== state.seed) setState((s) => ({ ...s, seed }));
    }
    return rngRef.current;
  }, [state.seed]);

  const newRun = useCallback(() => {
    const seed = freshSeed();
    rngRef.current = createRng(seed);
    seasonRef.current = null;
    setSeason(null);
    setScore(null);
    setState(initialState(seed));
  }, []);

  const reset = newRun;

  const spin = useCallback(() => {
    const rng = ensureRng();
    const year = spinWheel(rng);
    const data = getSeason(year);
    seasonRef.current = data;
    setSeason(data);
    setState((s) => ({ ...s, season: year, phase: 'deal' }));
  }, [ensureRng]);

  const deal = useCallback(() => {
    const rng = ensureRng();
    const data = seasonRef.current;
    if (!data) return;
    const roster = generateRoster(rng, data.players);
    setState((s) => ({
      ...s,
      roster,
      rotation: defaultRotation(roster),
      phase: 'trade',
    }));
  }, [ensureRng]);

  const findPlayer = (id: string): PlayerSeason | undefined => {
    const data = seasonRef.current;
    return data?.players.find((p) => p.id === id);
  };

  const previewTrade = useCallback((outIds: string[], targetId: string): number => {
    const target = findPlayer(targetId);
    if (!target) return 0;
    const offerValue = state.roster
      .filter((p) => outIds.includes(p.id))
      .reduce((sum, p) => sum + p.tradeValue, 0);
    return acceptanceProb(offerValue, target.tradeValue);
  }, [state.roster]);

  const commitTrade = useCallback((outIds: string[], targetId: string) => {
    const rng = ensureRng();
    const data = seasonRef.current;
    if (!data || state.movesLeft <= 0) return;
    const outPlayers = state.roster.filter((p) => outIds.includes(p.id));
    const target = findPlayer(targetId);
    if (!target || outPlayers.length === 0) return;
    const proposal: TradeProposal = { out: outPlayers, target };
    const outcome = resolveTrade(rng, state.roster, data.players, proposal, state.movesLeft);
    setState((s) => ({
      ...s,
      roster: outcome.roster,
      // keep rotation valid: drop ids no longer on the roster
      rotation: s.rotation.filter((id) => outcome.roster.some((p) => p.id === id)),
      movesLeft: outcome.movesLeft,
      tradeHistory: [...s.tradeHistory, outcome.record],
    }));
  }, [ensureRng, state.movesLeft, state.roster]);

  const toggleRotation = useCallback((id: string) => {
    setState((s) => {
      const inRot = s.rotation.includes(id);
      let next = inRot ? s.rotation.filter((r) => r !== id) : [...s.rotation, id];
      // enforce size bounds
      if (next.length < ROTATION.MIN || next.length > ROTATION.MAX) {
        if (next.length > ROTATION.MAX) return s; // ignore over-max
        if (next.length < ROTATION.MIN) return s; // ignore under-min
      }
      // keep order by roster quality for stable display
      const order = new Map(s.roster.map((p, i) => [p.id, i]));
      next = next.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
      return { ...s, rotation: next };
    });
  }, []);

  const goToRotation = useCallback(() => {
    // Re-derive the default rotation from the FINAL post-trade roster, so players you
    // traded for (typically high quality) start in the rotation, not benched. Rotation
    // is only user-editable in the phase that follows, so this clobbers no manual edits.
    setState((s) => ({ ...s, rotation: defaultRotation(s.roster), phase: 'rotation' }));
  }, []);

  const simulate = useCallback(() => {
    const rng = ensureRng();
    const data = seasonRef.current;
    if (!data) return;
    // Clamp rotation to [MIN, MAX] before simulating. Trading away rotation players can
    // shrink it below MIN; pad with the best available roster players if so.
    let rotation = state.rotation;
    if (rotation.length < ROTATION.MIN) {
      const inRot = new Set(rotation);
      const fillers = [...state.roster]
        .filter((p) => !inRot.has(p.id))
        .sort((a, b) => b.quality - a.quality)
        .slice(0, ROTATION.MIN - rotation.length)
        .map((p) => p.id);
      rotation = [...rotation, ...fillers];
    } else if (rotation.length > ROTATION.MAX) {
      rotation = rotation.slice(0, ROTATION.MAX);
    }
    const result: SimResult = simulateSeason(rng, {
      roster: state.roster,
      rotation,
      seed: state.seed,
    });
    setScore(scoreRun(result, data));
    setState((s) => ({ ...s, result, phase: 'reveal' }));
  }, [ensureRng, state.roster, state.rotation, state.seed]);

  return {
    state,
    season,
    score,
    newRun,
    spin,
    deal,
    previewTrade,
    commitTrade,
    toggleRotation,
    goToRotation,
    simulate,
    reset,
  };
}
