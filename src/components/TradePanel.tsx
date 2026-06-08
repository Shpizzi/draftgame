'use client';

import { useMemo, useState } from 'react';
import type { PlayerSeason, SeasonData } from '@/types';
import PlayerCard from './PlayerCard';
import PositionBalance from './PositionBalance';
import { createRng } from '@/engine/rng';
import { TRADE, ROSTER_SIZE } from '@/config/gameConstants';

const TARGET_COUNT = 24;

interface Props {
  roster: PlayerSeason[];
  season: SeasonData;
  movesLeft: number;
  previewTrade: (outIds: string[], targetId: string) => number;
  commitTrade: (outIds: string[], targetId: string) => void;
}

export default function TradePanel({
  roster,
  season,
  movesLeft,
  previewTrade,
  commitTrade,
}: Props) {
  const [outIds, setOutIds] = useState<string[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [shuffleKey, setShuffleKey] = useState(0);

  const rosterIds = useMemo(() => new Set(roster.map((p) => p.id)), [roster]);

  const targets = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = season.players.filter((p) => !rosterIds.has(p.id));
    // Search = precise lookup across the FULL pool (find the exact player you want).
    if (q) {
      return pool
        .filter((p) => p.name.toLowerCase().includes(q))
        .sort((a, b) => b.tradeValue - a.tradeValue)
        .slice(0, TARGET_COUNT);
    }
    // Default = a RANDOM sample of the whole season pool, not the top-by-value players,
    // so you discover players across tiers instead of always seeing the same superstars.
    // A separate rng (NOT the run rng) drives this — menu presentation must never touch
    // the engine's deterministic sim/trade rolls. Stable per shuffleKey; changes after a
    // trade (roster changes) or when you press Shuffle.
    const rng = createRng(`targets-${season.season}-${shuffleKey}`);
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, TARGET_COUNT).sort((a, b) => b.tradeValue - a.tradeValue);
  }, [season.players, season.season, rosterIds, query, shuffleKey]);

  const toggleOut = (id: string) => {
    setOutIds((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= TRADE.MAX_OUT) return cur; // max N-for-1
      return [...cur, id];
    });
  };

  const emptySlots = ROSTER_SIZE - roster.length;
  const target = targetId ? season.players.find((p) => p.id === targetId) ?? null : null;
  const offerValue = roster
    .filter((p) => outIds.includes(p.id))
    .reduce((s, p) => s + p.tradeValue, 0);
  const canPreview = outIds.length >= 1 && !!target;
  const prob = canPreview ? previewTrade(outIds, target!.id) : 0;

  const doCommit = () => {
    if (!canPreview || movesLeft <= 0) return;
    commitTrade(outIds, target!.id);
    setOutIds([]);
    setTargetId(null);
    setQuery('');
  };

  return (
    <div>
      <div className="spread" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Make a trade</h2>
        <span className="moves">Moves left: <b>{movesLeft}</b></span>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        Select <b>1 to {TRADE.MAX_OUT}</b> players to send away, then pick a target. Offer ≥ target value → ~99% accepted.
        Each attempt burns a move, success or not. <b>Many-for-1 leaves empty roster slots</b> — you trade depth for a star.
      </p>

      <div className="divider" />
      <div className="spread" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Roster balance <span className="hint" style={{ fontWeight: 400 }}>(players per position)</span></h2>
        <span className={`pill ${emptySlots > 0 ? 'bad' : ''}`}>
          {roster.length}/{ROSTER_SIZE}{emptySlots > 0 ? ` · ${emptySlots} empty` : ''}
        </span>
      </div>
      <PositionBalance roster={roster} />

      <div className="divider" />
      <h2>Send away ({outIds.length}/{TRADE.MAX_OUT})</h2>
      <div className="grid">
        {roster.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            onClick={() => toggleOut(p.id)}
            out={outIds.includes(p.id)}
          />
        ))}
      </div>

      <div className="divider" />
      <div className="spread">
        <h2 style={{ margin: 0 }}>
          Target <span className="hint" style={{ fontWeight: 400 }}>
            {query ? '(search results)' : '(random from the season — shuffle or search)'}
          </span>
        </h2>
        <div className="row">
          {!query && (
            <button className="ghost" onClick={() => setShuffleKey((k) => k + 1)}>
              ⟳ Shuffle
            </button>
          )}
          <input
            placeholder="search any player…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              background: 'var(--panel-2)', border: '1px solid var(--border)',
              color: 'var(--text)', borderRadius: 8, padding: '8px 12px', font: 'inherit',
            }}
          />
        </div>
      </div>
      <div className="grid" style={{ marginTop: 12 }}>
        {targets.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            onClick={() => setTargetId(p.id)}
            selected={targetId === p.id}
          />
        ))}
      </div>

      <div className="divider" />
      <div className="panel" style={{ background: 'var(--panel-2)', marginBottom: 0 }}>
        <div className="spread">
          <div>
            <div className="stat-label">Offer value</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{offerValue || '—'}</div>
          </div>
          <div style={{ fontSize: 22, color: 'var(--muted)' }}>→</div>
          <div>
            <div className="stat-label">Target value</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{target ? target.tradeValue : '—'}</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: 'right' }}>
            <div className="stat-label">Acceptance</div>
            <div
              style={{
                fontSize: 28, fontWeight: 800,
                color: !canPreview ? 'var(--muted)' : prob >= 0.6 ? 'var(--good)' : prob >= 0.25 ? 'var(--accent)' : 'var(--bad)',
              }}
            >
              {canPreview ? `${Math.round(prob * 100)}%` : '—'}
            </div>
          </div>
          <button
            className="primary"
            disabled={!canPreview || movesLeft <= 0}
            onClick={doCommit}
            style={{ marginLeft: 8 }}
          >
            Propose trade
          </button>
        </div>
      </div>
    </div>
  );
}
