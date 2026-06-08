'use client';

import { useMemo } from 'react';
import type { PlayerSeason } from '@/types';
import PlayerCard from './PlayerCard';
import { fatigueFactor } from '@/engine/simulation';
import { ROTATION } from '@/config/gameConstants';

interface Props {
  roster: PlayerSeason[];
  rotation: string[];
  toggleRotation: (id: string) => void;
}

const SIM_GAMES = 82;

export default function RotationPicker({ roster, rotation, toggleRotation }: Props) {
  const rotSet = useMemo(() => new Set(rotation), [rotation]);
  const size = rotation.length;
  const fatigue = fatigueFactor(size);

  // Injury Report: who on the roster missed real games that season.
  const injured = [...roster]
    .filter((p) => SIM_GAMES - p.gamesPlayed > 0)
    .sort((a, b) => a.gamesPlayed - b.gamesPlayed);

  const sorted = [...roster].sort((a, b) => b.quality - a.quality);

  return (
    <div>
      <div className="spread" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Set your rotation</h2>
        <div className="row">
          <span className="pill">{size} / {ROTATION.MAX} players</span>
          <span className={`pill ${fatigue >= 0.95 ? 'good' : fatigue >= 0.85 ? '' : 'bad'}`}>
            fatigue ×{fatigue.toFixed(2)}
          </span>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        Tap players to add/remove. Short rotation ({ROTATION.MIN}–6) = higher ceiling but more fatigue,
        bigger injury swings, less consistency. Wide ({ROTATION.IDEAL}–{ROTATION.MAX}) = steadier, but you dilute quality.
        Range {ROTATION.MIN}–{ROTATION.MAX}.
      </p>

      <div className="grid">
        {sorted.map((p) => (
          <PlayerCard
            key={p.id}
            player={p}
            onClick={() => toggleRotation(p.id)}
            selected={rotSet.has(p.id)}
            dim={!rotSet.has(p.id)}
            showAvailability
          />
        ))}
      </div>

      <div className="divider" />
      <h2>Injury Report <span className="hint">(real games missed that season)</span></h2>
      {injured.length === 0 ? (
        <p className="hint">Clean bill of health — everyone played a full season.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th className="num">Games played</th>
              <th className="num">Missed</th>
              <th className="num">Availability</th>
              <th>In rotation?</th>
            </tr>
          </thead>
          <tbody>
            {injured.map((p) => {
              const missed = SIM_GAMES - p.gamesPlayed;
              return (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="num">{p.gamesPlayed}</td>
                  <td className={`num ${missed > 20 ? 'injured' : ''}`}>{missed}</td>
                  <td className="num">{Math.round((p.gamesPlayed / SIM_GAMES) * 100)}%</td>
                  <td>{rotSet.has(p.id) ? '✓' : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
