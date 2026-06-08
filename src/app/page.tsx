'use client';

import { useGame } from '@/state/useGame';
import TradePanel from '@/components/TradePanel';
import RotationPicker from '@/components/RotationPicker';
import SimReveal from '@/components/SimReveal';
import { ROTATION, ERA_PACKS, TRADE_MOVES } from '@/config/gameConstants';

const unlockedEras = ERA_PACKS.filter((e) => e.unlocked);
const FIRST_YEAR = Math.min(...unlockedEras.map((e) => e.startYear));
const LAST_YEAR = Math.max(...unlockedEras.map((e) => e.endYear));

export default function Page() {
  const game = useGame();
  const { state, season } = game;

  return (
    <div className="wrap">
      <div className="spread">
        <div>
          <h1>🏀 NBA Roster Draft</h1>
          <p className="sub">
            Draw a random historical roster · optimize with {TRADE_MOVES} trades · set your rotation · simulate the season
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
        <div className="panel hero">
          <h2 style={{ margin: 0 }}>Spin the wheel</h2>
          <div className="hero-big muted">XXXX</div>
          <p className="hint">Pick a random season from the unlocked eras ({FIRST_YEAR}–{LAST_YEAR}).</p>
          <button className="primary" onClick={game.spin}>Spin the wheel →</button>
        </div>
      )}

      {/* DEAL */}
      {state.phase === 'deal' && season && (
        <div className="panel hero">
          <h2 style={{ margin: 0 }}>The wheel landed on</h2>
          <div className="hero-big">{state.season}</div>
          <p className="hint">Deal a random 12-player roster from that season&apos;s pool.</p>
          <button className="primary" onClick={game.deal}>Deal roster →</button>
        </div>
      )}

      {/* TRADE */}
      {state.phase === 'trade' && season && (
        <TradePanel
          roster={state.roster}
          season={season}
          movesLeft={state.movesLeft}
          higherProbUsed={state.higherProbUsed}
          previewTrade={game.previewTrade}
          commitTrade={game.commitTrade}
          onDone={game.goToRotation}
        />
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
    </div>
  );
}
