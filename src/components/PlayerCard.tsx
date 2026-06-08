'use client';

import type { PlayerSeason } from '@/types';
import PlayerAvatar from './PlayerAvatar';

interface Props {
  player: PlayerSeason;
  onClick?: () => void;
  selected?: boolean;
  out?: boolean;
  dim?: boolean;
  showAvailability?: boolean;
}

export function tierLabel(tier: PlayerSeason['tier']): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}

export default function PlayerCard({
  player,
  onClick,
  selected,
  out,
  dim,
}: Props) {
  const cls = [
    'card',
    onClick ? 'selectable' : 'static',
    selected ? 'selected' : '',
    out ? 'out' : '',
    dim ? 'dim' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} onClick={onClick}>
      <div className="tv">{player.tradeValue}</div>
      <div className="card-head">
        <PlayerAvatar player={player} />
        <div className="card-id">
          <div className="name">{player.name}</div>
          <div className="meta">
            <span className="pos-badge">{player.position}</span>{' '}
            <span className={`tier-${player.tier}`}>
              <span className={`tier-dot dot-${player.tier}`} />
              {tierLabel(player.tier)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
