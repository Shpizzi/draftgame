'use client';

import { useGame } from '@/state/useGame';
import PlayerCard from '@/components/PlayerCard';
import TradePanel from '@/components/TradePanel';
import RotationPicker from '@/components/RotationPicker';
import SimReveal from '@/components/SimReveal';
import { ROTATION } from '@/config/gameConstants';

export default function Page() {
  const game = useGame();
  const { state, season } = game;

  return (
    <div className="wrap">
      <div className="spread">
        <div>
          <h1>🏀 NBA Roster Draft</h1>
          <p className="sub">
            Draw a random historical roster · optimize with 3 trades · set your rotation · simulate the season
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="seed">seed: {state.seed === 'pending' ? '—' : state.seed}</div>
          <button className="ghost" onClick={game.newRun} style={{ marginTop: 6 }}>
            New run ↻
          </button>
        </div>
      </div>

      {/* SPIN */}
      {state.phase === 'spin' && (
        <div className="panel">
          <h2>Spin the wheel</h2>
          <p className="hint">Pick a random season from the unlocked era (2020–2026).</p>
          <button className="primary" onClick={game.spin}>Spin →</button>
        </div>
      )}

      {/* DEAL */}
      {state.phase === 'deal' && season && (
        <div className="panel">
          <h2>The wheel landed on <span style={{ color: 'var(--accent)' }}>{state.season}</span></h2>
          <p className="hint">Deal a random 12-player roster from that season&apos;s pool.</p>
          <button className="primary" onClick={game.deal}>Deal roster →</button>
        </div>
      )}

      {/* TRADE */}
      {state.phase === 'trade' && season && (
        <>
          <div className="panel">
            <div className="spread">
              <h2 style={{ margin: 0 }}>Your roster · {state.season}</h2>
              <button className="primary" onClick={game.goToRotation}>
                Done trading → set rotation
              </button>
            </div>
            <p className="hint" style={{ marginBottom: 0 }}>
              12 players. Number top-right is trade value (1–100), color dot is tier.
            </p>
          </div>
          <div className="panel">
            <TradePanel
              roster={state.roster}
              season={season}
              movesLeft={state.movesLeft}
              previewTrade={game.previewTrade}
              commitTrade={game.commitTrade}
            />
          </div>
        </>
      )}

      {/* ROTATION */}
      {state.phase === 'rotation' && season && (
        <div className="panel">
          <RotationPicker
            roster={state.roster}
            rotation={state.rotation}
            toggleRotation={game.toggleRotation}
          />
          <div className="divider" />
          <div className="spread">
            <span className="hint">
              {state.rotation.length} in rotation (range {ROTATION.MIN}–{ROTATION.MAX})
            </span>
            <button className="primary" onClick={game.simulate}>
              Simulate season →
            </button>
          </div>
        </div>
      )}

      {/* REVEAL */}
      {state.phase === 'reveal' && season && state.result && game.score && (
        <div className="panel">
          <SimReveal state={state} season={season} score={game.score} />
          <div className="divider" />
          <button className="primary" onClick={game.newRun}>Play again ↻</button>
        </div>
      )}

      {(state.phase === 'trade' || state.phase === 'rotation') && (
        <p className="hint" style={{ textAlign: 'center' }}>
          All constants live in <span className="seed">config/gameConstants.ts</span> · everything is deterministic from the seed.
        </p>
      )}

      {/* collapsible roster glance during trade */}
      {state.phase === 'trade' && (
        <details className="panel">
          <summary style={{ cursor: 'pointer', color: 'var(--muted)' }}>
            Roster at a glance
          </summary>
          <div className="grid" style={{ marginTop: 12 }}>
            {state.roster.map((p) => (
              <PlayerCard key={p.id} player={p} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
