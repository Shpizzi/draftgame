'use client';

import type { KeyboardEvent } from 'react';
import type { PlayerSeason } from '@/types';
import PlayerAvatar from './PlayerAvatar';

interface Props {
  player: PlayerSeason;
  onClick?: () => void;
  selected?: boolean;
  out?: boolean;
  dim?: boolean;
  showAvailability?: boolean;
  // Photo-centric vertical layout (trade grid). `action` drives the footer label:
  // 'send' for your-roster cards, 'pick' for target-pool cards.
  tile?: boolean;
  action?: 'send' | 'pick';
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
  tile,
  action = 'pick',
}: Props) {
  const cls = [
    'card',
    tile ? 'tile' : '',
    onClick ? 'selectable' : 'static',
    selected ? 'selected' : '',
    out ? 'out' : '',
    dim ? 'dim' : '',
  ].filter(Boolean).join(' ');

  // Toggle ("pressed") state for assistive tech — the visual cue (border/opacity/footer)
  // alone isn't exposed to screen readers.
  const pressed = tile
    ? (action === 'send' ? !!out : !!selected)
    : (!!selected || !!out);

  // When the card is clickable it's a div-as-button: make it focusable, expose its toggle
  // state, and handle Enter + Space (preventDefault on Space so it toggles instead of scrolling).
  const interactive = onClick
    ? {
        role: 'button' as const,
        tabIndex: 0,
        'aria-pressed': pressed,
        'aria-label': `${player.name}, ${player.position}, trade value ${player.tradeValue}${pressed ? ', selected' : ''}`,
        onKeyDown: (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        },
      }
    : {};

  if (tile) {
    const picked = action === 'send' ? out : selected;
    const foot = action === 'send'
      ? (picked ? '✓ Sending' : 'Send')
      : (picked ? '✓ Receiving' : 'Pick');
    return (
      <div className={cls} onClick={onClick} {...interactive}>
        <div className="tv">{player.tradeValue}</div>
        <div className="tile-ring" style={{ boxShadow: `0 0 0 2px var(--${player.tier})` }}>
          <PlayerAvatar player={player} size={62} />
        </div>
        <div className="tile-name">{player.name}</div>
        <div className="tile-team">
          {player.team} · <span className="pos-badge">{player.position}</span>
        </div>
        <div className="tile-foot">{foot}</div>
      </div>
    );
  }

  return (
    <div className={cls} onClick={onClick} {...interactive}>
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
