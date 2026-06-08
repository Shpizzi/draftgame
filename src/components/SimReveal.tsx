'use client';

import type { GameState, SeasonData } from '@/types';
import type { Score } from '@/engine/scoring';

interface Props {
  state: GameState;
  season: SeasonData;
  score: Score;
}

export default function SimReveal({ state, season, score }: Props) {
  const result = state.result!;
  const nameById = new Map(season.players.map((p) => [p.id, p.name]));

  const rotationBreakdown = [...result.breakdown]
    .filter((b) => b.inRotation)
    .sort((a, b) => b.contribution - a.contribution);
  const maxContribution = Math.max(...rotationBreakdown.map((b) => b.contribution), 0.01);

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>
        {season.season} season result
      </h2>

      <div className="kpis">
        <div className="kpi">
          <div className="stat-label">Record</div>
          <div className="stat-big">{result.wins}–{result.losses}</div>
        </div>
        <div className="kpi">
          <div className="stat-label">Net rating</div>
          <div className="stat-big" style={{ color: result.netRating >= 0 ? 'var(--good)' : 'var(--bad)' }}>
            {result.netRating > 0 ? '+' : ''}{result.netRating}
          </div>
        </div>
        <div className="kpi">
          <div className="stat-label">Off / Def rating</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>
            {result.oRtg} / {result.dRtg}
          </div>
        </div>
        <div className="kpi">
          <div className="stat-label">Roster strength</div>
          <div style={{ fontSize: 24, fontWeight: 700, marginTop: 6 }}>
            {result.rosterStrength}
            <span className="hint" style={{ fontSize: 12 }}> ×{result.fatigueFactor} fatigue</span>
          </div>
        </div>
      </div>

      {/* Comparative Bench */}
      {score.relative && (
        <div className="panel" style={{ marginTop: 20, marginBottom: 0, background: 'var(--panel-2)' }}>
          <h2>Comparative Bench</h2>
          <div className="spread">
            <div>
              <div className="stat-label">You</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{result.wins} W</div>
            </div>
            <div style={{ fontSize: 20, color: 'var(--muted)' }}>vs</div>
            <div>
              <div className="stat-label">Best real team ({score.relative.bestRealTeam})</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{score.relative.bestRealWins} W</div>
            </div>
            <div style={{ flex: 1 }} />
            <span className={`pill ${score.relative.diff >= 0 ? 'good' : 'bad'}`} style={{ fontSize: 15 }}>
              {score.relative.diff >= 0 ? `+${score.relative.diff}` : score.relative.diff} vs best
            </span>
          </div>
        </div>
      )}

      {/* Breakdown — explainability */}
      <div className="divider" />
      <h2>Why this result <span className="hint">(rotation contribution breakdown)</span></h2>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th className="num">Quality</th>
            <th className="num">Availability</th>
            <th className="num">Minutes</th>
            <th className="num">Contribution</th>
            <th style={{ width: '22%' }}></th>
          </tr>
        </thead>
        <tbody>
          {rotationBreakdown.map((b) => (
            <tr key={b.playerId}>
              <td>{b.name}</td>
              <td className="num">{b.quality.toFixed(1)}</td>
              <td className={`num ${b.availability < 0.7 ? 'injured' : ''}`}>
                {Math.round(b.availability * 100)}%
              </td>
              <td className="num">{Math.round(b.minutesWeight * 100)}%</td>
              <td className="num">{b.contribution.toFixed(1)}</td>
              <td>
                <div className="bar">
                  <span style={{ width: `${(b.contribution / maxContribution) * 100}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Injury events during the sim */}
      <div className="divider" />
      <h2>Sim injury events</h2>
      {result.injuryEvents.length === 0 ? (
        <p className="hint">No in-season injuries this run.</p>
      ) : (
        <ul>
          {result.injuryEvents.map((e, i) => (
            <li key={i} className="injured">
              {e.name} — lost {e.gamesLost} games to injury during the season
            </li>
          ))}
        </ul>
      )}

      {/* Trade History Tracker */}
      <div className="divider" />
      <h2>Trade History</h2>
      {state.tradeHistory.length === 0 ? (
        <p className="hint">No trades — you rode the roster you were dealt.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Sent</th>
              <th>Received</th>
              <th className="num">Offer → Target</th>
              <th className="num">Odds</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {state.tradeHistory.map((t, i) => (
              <tr key={i}>
                <td>{t.out.map((id) => nameById.get(id) ?? id).join(' + ')}</td>
                <td>{t.in.map((id) => nameById.get(id) ?? id).join(' + ')}</td>
                <td className="num">{t.offerValue} → {t.targetValue}</td>
                <td className="num">{Math.round(t.acceptanceProb * 100)}%</td>
                <td>
                  <span className={`pill ${t.succeeded ? 'good' : 'bad'}`}>
                    {t.succeeded ? 'Accepted' : 'Rejected'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
