'use client';

import { useMemo, useState } from 'react';
import type { PlayerSeason, Position, SeasonData } from '@/types';
import { POSITIONS } from '@/types';
import PlayerCard from './PlayerCard';
import { createRng } from '@/engine/rng';
import { TRADE, TRADE_MOVES, ROSTER_SIZE, ROTATION } from '@/config/gameConstants';

const TARGET_COUNT = 24;

interface Props {
  roster: PlayerSeason[];
  season: SeasonData;
  movesLeft: number;
  higherProbUsed: boolean;
  previewTrade: (outIds: string[], inIds: string[], boost?: boolean) => number;
  commitTrade: (outIds: string[], inIds: string[], boost?: boolean) => void;
  onDone: () => void;
}

export default function TradePanel({
  roster,
  season,
  movesLeft,
  higherProbUsed,
  previewTrade,
  commitTrade,
  onDone,
}: Props) {
  const [outIds, setOutIds] = useState<string[]>([]);
  const [targetIds, setTargetIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [shuffleKey, setShuffleKey] = useState(0);
  const [posFilter, setPosFilter] = useState<Set<Position>>(new Set());
  const [boostArmed, setBoostArmed] = useState(false);

  const rosterIds = useMemo(() => new Set(roster.map((p) => p.id)), [roster]);

  const targets = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Position filters apply to the WHOLE pool first, BEFORE the deterministic shuffle/slice,
    // so a filtered browse still surfaces a varied sample (not just the few that survived a
    // post-sample filter).
    const pool = season.players.filter(
      (p) => !rosterIds.has(p.id) && (posFilter.size === 0 || posFilter.has(p.position)),
    );
    // Search = precise lookup across the (filtered) pool — find the exact player you want.
    if (q) {
      return pool
        .filter((p) => p.name.toLowerCase().includes(q))
        .sort((a, b) => b.tradeValue - a.tradeValue)
        .slice(0, TARGET_COUNT);
    }
    // Default = a RANDOM sample, so you discover players across tiers instead of always
    // seeing the same superstars. A separate rng (NOT the run rng) drives this — menu
    // presentation must never touch the engine's deterministic rolls. Stable per shuffleKey
    // (changes on "Change target") and per filter/roster.
    const rng = createRng(`targets-${season.season}-${shuffleKey}`);
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, TARGET_COUNT).sort((a, b) => b.tradeValue - a.tradeValue);
  }, [season.players, season.season, rosterIds, query, shuffleKey, posFilter]);

  const toggleOut = (id: string) => {
    setOutIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= TRADE.MAX_OUT) return cur; // cap players sent
      return [...cur, id];
    });
  };

  const toggleTarget = (id: string) => {
    setTargetIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= TRADE.MAX_IN) return cur; // cap players received
      return [...cur, id];
    });
  };

  const togglePosFilter = (pos: Position) => {
    setPosFilter((cur) => {
      const next = new Set(cur);
      if (next.has(pos)) next.delete(pos);
      else next.add(pos);
      return next;
    });
  };

  // roster composition per position (compact chips above "Your roster")
  const posCounts = useMemo(() => {
    const c: Record<Position, number> = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
    for (const p of roster) c[p.position] += 1;
    return c;
  }, [roster]);

  const selectedIn = season.players.filter((p) => targetIds.includes(p.id));
  const offerValue = roster
    .filter((p) => outIds.includes(p.id))
    .reduce((s, p) => s + p.tradeValue, 0);
  const targetValue = selectedIn.reduce((s, p) => s + p.tradeValue, 0);

  // Resulting roster size if this trade goes through, and whether it's legal.
  const resultSize = roster.length - outIds.length + targetIds.length;
  const bothSides = outIds.length >= 1 && targetIds.length >= 1;
  const overCap = resultSize > ROSTER_SIZE;
  const underFloor = resultSize < ROTATION.MIN;
  const valid = bothSides && !overCap && !underFloor;
  const reason = !bothSides
    ? ''
    : overCap
      ? `Roster would be ${resultSize} — over the ${ROSTER_SIZE} cap. Send more or receive fewer.`
      : underFloor
        ? `Roster would be ${resultSize} — below the ${ROTATION.MIN}-player minimum.`
        : '';

  const boostActive = boostArmed && !higherProbUsed;
  const prob = bothSides ? previewTrade(outIds, targetIds, boostActive) : 0;

  const doCommit = () => {
    if (!valid || movesLeft <= 0) return;
    commitTrade(outIds, targetIds, boostActive);
    setOutIds([]);
    setTargetIds([]);
    setQuery('');
    setBoostArmed(false);
  };

  // Stepper: current move = moves already used + 1 (while any remain).
  const movesUsed = TRADE_MOVES - movesLeft;
  const currentMove = Math.min(TRADE_MOVES, movesUsed + 1);
  const acceptColor = !bothSides
    ? 'var(--muted)'
    : prob >= 0.6 ? 'var(--good)' : prob >= 0.25 ? 'var(--accent)' : 'var(--bad)';

  return (
    <div className="panel trade-screen">
      {/* Header: year · stepper · Done */}
      <div className="trade-head">
        <h1 style={{ margin: 0 }}>{season.season}</h1>
        <div className="stepper">
          {Array.from({ length: TRADE_MOVES }).map((_, i) => {
            const step = i + 1;
            const done = step <= movesUsed;
            const current = step === currentMove && movesLeft > 0;
            return (
              <div key={step} className={`step${done ? ' done' : ''}${current ? ' current' : ''}`}>
                <span className="step-dot">{step}</span>
                {current && <span className="step-label">Make a trade</span>}
              </div>
            );
          })}
        </div>
        <button className="primary" onClick={onDone}>Done →</button>
      </div>

      <div className="spread" style={{ marginTop: 6, marginBottom: 14 }}>
        <h2 style={{ margin: 0 }}>Make a trade</h2>
        <div style={{ textAlign: 'right' }}>
          <div className="stat-label">Moves</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>
            {movesLeft > 0 ? currentMove : TRADE_MOVES}/{TRADE_MOVES}
          </div>
        </div>
      </div>

      {/* Two columns: Your roster | Target */}
      <div className="trade-cols">
        {/* LEFT — your roster */}
        <div className="trade-col">
          <div className="spread" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Your roster <span className="hint" style={{ fontWeight: 400 }}>({roster.length}/{ROSTER_SIZE})</span></h2>
            <span className="hint">Send {outIds.length}/{TRADE.MAX_OUT}</span>
          </div>
          <div className="pos-chips" style={{ marginBottom: 12 }}>
            {POSITIONS.map((pos) => (
              <span key={pos} className={`pos-chip${posCounts[pos] <= 1 ? ' thin' : ''}`}>
                <b>{posCounts[pos]}</b> {pos}
              </span>
            ))}
          </div>
          <div className="col-grid">
            {roster.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                tile
                action="send"
                onClick={() => toggleOut(p.id)}
                out={outIds.includes(p.id)}
              />
            ))}
          </div>
        </div>

        {/* RIGHT — target pool */}
        <div className="trade-col trade-col-target">
          <div className="spread" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Target <span className="hint" style={{ fontWeight: 400 }}>(receive {targetIds.length}/{TRADE.MAX_IN})</span></h2>
            <div className="row" style={{ gap: 8 }}>
              <button
                className={`ghost${boostActive ? ' armed' : ''}`}
                disabled={higherProbUsed}
                onClick={() => setBoostArmed((b) => !b)}
                title="One use per game — gives a low-probability trade a boost"
              >
                {higherProbUsed ? 'Higher prob. used' : boostActive ? '✓ Higher probability' : '⚡ Higher probability'}
              </button>
              <button className="ghost" onClick={() => setShuffleKey((k) => k + 1)} title="Reshuffle the available pool">
                ⟳ Change target
              </button>
            </div>
          </div>

          {/* role filters + search */}
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            {POSITIONS.map((pos) => (
              <button
                key={pos}
                className={`filter-chip${posFilter.has(pos) ? ' active' : ''}`}
                onClick={() => togglePosFilter(pos)}
              >
                {pos}
              </button>
            ))}
            {posFilter.size > 0 && (
              <button className="filter-chip" onClick={() => setPosFilter(new Set())}>clear</button>
            )}
            <input
              type="search"
              aria-label="Search the target pool by player name"
              placeholder="search any player…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ flex: 1, minWidth: 140, padding: '7px 12px' }}
            />
          </div>

          <div className="col-grid">
            {targets.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                tile
                action="pick"
                onClick={() => toggleTarget(p.id)}
                selected={targetIds.includes(p.id)}
              />
            ))}
            {targets.length === 0 && (
              <p className="hint">No players match these filters.</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="trade-bar">
        <div className="trade-bar-stat">
          <div className="stat-label">Offer value ({outIds.length})</div>
          <div className="trade-bar-num">{offerValue || '—'}</div>
        </div>
        <div style={{ fontSize: 20, color: 'var(--muted)' }}>→</div>
        <div className="trade-bar-stat">
          <div className="stat-label">Target value ({targetIds.length})</div>
          <div className="trade-bar-num">{targetValue || '—'}</div>
        </div>
        <div className="trade-bar-stat">
          <div className="stat-label">Roster after</div>
          <div className="trade-bar-num" style={{ color: overCap || underFloor ? 'var(--bad)' : 'var(--text)' }}>
            {bothSides ? `${resultSize}/${ROSTER_SIZE}` : `${roster.length}/${ROSTER_SIZE}`}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {reason && <span className="hint" style={{ color: 'var(--bad)', maxWidth: 260 }}>{reason}</span>}
        <div className="trade-bar-stat" style={{ textAlign: 'right' }}>
          <div className="stat-label">Acceptance{boostActive ? ' ⚡' : ''}</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: acceptColor }}>
            {bothSides ? `${Math.round(prob * 100)}%` : '—'}
          </div>
        </div>
        <button className="primary" disabled={!valid || movesLeft <= 0} onClick={doCommit}>
          Trade it
        </button>
      </div>
    </div>
  );
}
