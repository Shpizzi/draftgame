'use client';

import { useState } from 'react';
import type { PlayerSeason } from '@/types';

// Player headshots come from Basketball-Reference, keyed by the bbref player id that is
// embedded in our PlayerSeason id ("2024-achiupr01" → "achiupr01"). Not every player has
// a headshot on file, and the network can fail — so we always render an initials fallback
// (tier-colored) the moment the image errors or is missing.

const BBREF_HEADSHOT = (slug: string) =>
  `https://www.basketball-reference.com/req/202106291/images/headshots/${slug}.jpg`;

function bbrefSlug(id: string): string {
  const dash = id.indexOf('-');
  return dash >= 0 ? id.slice(dash + 1) : id;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

interface Props {
  player: Pick<PlayerSeason, 'id' | 'name' | 'tier'>;
  size?: number;
}

export default function PlayerAvatar({ player, size = 46 }: Props) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };

  if (failed) {
    return (
      <div
        className={`avatar avatar-fallback dot-${player.tier}`}
        style={{ ...style, fontSize: Math.round(size * 0.34) }}
        aria-hidden
      >
        {initials(player.name)}
      </div>
    );
  }

  return (
    <img
      className="avatar"
      style={style}
      src={BBREF_HEADSHOT(bbrefSlug(player.id))}
      alt={player.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
